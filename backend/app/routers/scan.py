import cv2
import numpy as np
import base64
import time
import os
import asyncio
from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
from ..services.ai_service import AIService
from ..db import get_database
from .. import config

router = APIRouter(prefix="/api/v1/scan", tags=["Scanning & OCR"])

# Pydantic schema for database response
class PlateLogResponse(BaseModel):
    timestamp: float
    ocr_en: str
    ocr_lao: str
    bg_color: str
    font_color: str
    plate_type: str
    confidence: float

async def log_detection_to_db(detection: dict):
    """Save a plate detection log entry into MongoDB and save the crop image locally."""
    db = get_database()
    
    # 1. Pop the numpy crop arrays immediately to clean the dictionary for JSON responses
    crop_img = detection.pop('crop', None)
    vehicle_crop = detection.pop('vehicle_crop', None)
    detection.pop('vehicle_box', None)
    
    # Generate a unique ObjectId
    doc_id = ObjectId()
    str_id = str(doc_id)
    
    # Save the crop image locally if it exists and is a valid numpy array
    image_url = ""
    if crop_img is not None and isinstance(crop_img, np.ndarray) and crop_img.size > 0:
        static_dir = os.path.join(config.BACKEND_DIR, "static")
        plates_dir = os.path.join(static_dir, "plates")
        os.makedirs(plates_dir, exist_ok=True)
        
        file_name = f"{str_id}.jpg"
        file_path = os.path.join(plates_dir, file_name)
        try:
            cv2.imwrite(file_path, crop_img)
            # Use relative URL that can be accessed via backend's static route
            image_url = f"/static/plates/{file_name}"
        except Exception as file_err:
            print(f"[FILE ERROR] Failed to save crop image to {file_path}: {file_err}")

    # Save the vehicle crop image locally if it exists and is a valid numpy array
    vehicle_image_url = ""
    if vehicle_crop is not None and isinstance(vehicle_crop, np.ndarray) and vehicle_crop.size > 0:
        static_dir = os.path.join(config.BACKEND_DIR, "static")
        vehicles_dir = os.path.join(static_dir, "vehicles")
        os.makedirs(vehicles_dir, exist_ok=True)
        
        file_name = f"{str_id}.jpg"
        file_path = os.path.join(vehicles_dir, file_name)
        try:
            cv2.imwrite(file_path, vehicle_crop)
            # Use relative URL that can be accessed via backend's static route
            vehicle_image_url = f"/static/vehicles/{file_name}"
        except Exception as file_err:
            print(f"[FILE ERROR] Failed to save vehicle crop image to {file_path}: {file_err}")

    if db is None:
        print("[DB WARNING] MongoDB not connected. Skipping log write.")
        # Update the detection dictionary with image_urls for inline JSON responses
        detection["image_url"] = image_url
        detection["vehicle_image_url"] = vehicle_image_url
        return False
    
    try:
        log_entry = {
            "_id": doc_id,
            "timestamp": time.time(),
            "ocr_en": detection.get("ocr_en", ""),
            "ocr_lao": detection.get("ocr_lao", ""),
            "bg_color": detection.get("bg_color", ""),
            "font_color": detection.get("font_color", ""),
            "plate_type": detection.get("plate_type", ""),
            "confidence": float(detection.get("confidence", 0.0)),
            "image_url": image_url,
            "vehicle_image_url": vehicle_image_url
        }
        await db[config.LOGS_COLLECTION].insert_one(log_entry)
        
        # Update the detection dictionary with dynamic image_urls
        detection["image_url"] = image_url
        detection["vehicle_image_url"] = vehicle_image_url
        return True
    except Exception as e:
        print(f"[DB ERROR] Failed to save detection log to MongoDB: {e}")
        return False


@router.post("/image", summary="Scan a single license plate image")
async def scan_image(file: UploadFile = File(...)):
    """
    Accepts an uploaded image file, processes it, saves metadata 
    to MongoDB, and returns OCR detection details.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"success": False, "error": "Invalid image file"}

    pipeline = AIService.get_pipeline()
    results, annotated_img = pipeline.process_image(img)

    # Convert annotated image to base64 for convenient inline display
    _, encoded_img = cv2.imencode('.jpg', annotated_img)
    base64_image = base64.b64encode(encoded_img).decode('utf-8')

    # Save to MongoDB
    for res in results:
        await log_detection_to_db(res)

    return {
        "success": True,
        "detections_count": len(results),
        "detections": results,
        "annotated_image": f"data:image/jpeg;base64,{base64_image}"
    }


@router.post("/video/upload", summary="Upload a video file for processing")
async def upload_video(file: UploadFile = File(...)):
    """
    Accepts an uploaded video file, stores it temporarily, and returns the filename
    so that it can be streamed via a GET request in an <img> tag.
    """
    temp_dir = os.path.join(config.BACKEND_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"temp_upload_{int(time.time())}_{file.filename}"
    temp_video_path = os.path.join(temp_dir, temp_filename)

    try:
        with open(temp_video_path, "wb") as buffer:
            contents = await file.read()
            buffer.write(contents)
    except Exception as e:
        return {"success": False, "error": f"Failed to save video: {str(e)}"}

    return {"success": True, "filename": temp_filename}


@router.get("/video/stream", summary="Stream processed frames of an uploaded video")
async def stream_video(filename: str = Query(...)):
    """
    Accepts a temporary video filename, processes it frame-by-frame, and streams
    the annotated frames back in real-time as an MJPEG stream.
    """
    temp_dir = os.path.join(config.BACKEND_DIR, "temp")
    temp_video_path = os.path.join(temp_dir, filename)

    if not os.path.exists(temp_video_path):
        return {"success": False, "error": "Video file not found"}

    async def frame_generator():
        pipeline = AIService.get_pipeline()
        cap = cv2.VideoCapture(temp_video_path)
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Run plate detection and overlay
                results, annotated_frame = pipeline.process_image(frame)
                
                # Log detections to MongoDB if found
                for res in results:
                    await log_detection_to_db(res)

                # Encode frame to JPEG
                ret_enc, jpeg = cv2.imencode('.jpg', annotated_frame)
                if not ret_enc:
                    continue

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b' \r\n')
                
                # Control frame rate slightly so CPU is not overloaded
                await asyncio.sleep(0.03) # ~30 FPS
        finally:
            cap.release()
            # Clean up temp file when stream closes or finishes
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)

    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")





@router.get("/logs", summary="Fetch recent detection logs from MongoDB")
async def get_logs(limit: int = Query(50, ge=1, le=500)):
    """
    Retrieves the latest license plate detection records from the MongoDB collection.
    """
    db = get_database()
    if db is None:
        return {"success": False, "error": "MongoDB is not connected", "logs": []}

    try:
        # DB Projection returning all details for frontend card rendering
        projection = {
            "_id": 1,
            "timestamp": 1,
            "ocr_en": 1,
            "ocr_lao": 1,
            "bg_color": 1,
            "font_color": 1,
            "plate_type": 1,
            "confidence": 1,
            "image_url": 1,
            "vehicle_image_url": 1
        }
        cursor = db[config.LOGS_COLLECTION].find({}, projection).sort("timestamp", -1).limit(limit)
        logs = []
        async for document in cursor:
            # Convert ObjectId to string for JSON serialization
            document["_id"] = str(document["_id"])
            logs.append(document)
        return logs
    except Exception as e:
        return []


@router.delete("/clear-all", summary="Clear all database logs and physical crop images on disk")
async def clear_all_data():
    """
    Deletes all records from MongoDB and cleans up all JPG image crops 
    saved on disk under static/plates/ and static/vehicles/.
    """
    db = get_database()
    deleted_count = 0
    
    # 1. Clear database logs collection
    if db is not None:
        try:
            delete_res = await db[config.LOGS_COLLECTION].delete_many({})
            deleted_count = delete_res.deleted_count
        except Exception as e:
            print(f"[DB DELETE ERROR] Failed to clear collection: {e}")
            
    # 2. Clear local static images on disk
    static_dir = os.path.join(config.BACKEND_DIR, "static")
    plates_dir = os.path.join(static_dir, "plates")
    vehicles_dir = os.path.join(static_dir, "vehicles")
    
    deleted_files = 0
    
    for directory in [plates_dir, vehicles_dir]:
        if os.path.exists(directory):
            for file_name in os.listdir(directory):
                file_path = os.path.join(directory, file_name)
                if os.path.isfile(file_path) and file_name.lower().endswith('.jpg'):
                    try:
                        os.remove(file_path)
                        deleted_files += 1
                    except Exception as fe:
                        print(f"[FILE DELETE ERROR] Failed to remove {file_path}: {fe}")
                        
    return {
        "success": True,
        "message": f"Successfully deleted {deleted_count} database logs and {deleted_files} local image files."
    }

