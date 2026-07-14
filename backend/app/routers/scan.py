import cv2
import numpy as np
import base64
import time
import os
import asyncio
from fastapi import APIRouter, UploadFile, File, Query, Form
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


def edit_distance(s1: str, s2: str) -> int:
    """Calculate Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]


def is_same_plate(p1: str, p2: str) -> bool:
    """Determine if two plate OCR strings represent the same vehicle."""
    n1 = "".join(c for c in p1 if c.isalnum()).upper()
    n2 = "".join(c for c in p2 if c.isalnum()).upper()
    
    if not n1 or not n2:
        return False
        
    if n1 == n2:
        return True
        
    # Check substring inclusion if both are reasonably long
    if len(n1) >= 5 and len(n2) >= 5:
        if n1 in n2 or n2 in n1:
            return True
            
    # Fuzzy edit distance matching to handle OCR errors/noise
    dist = edit_distance(n1, n2)
    max_len = max(len(n1), len(n2))
    
    if max_len >= 8 and dist <= 2:
        return True
    if max_len >= 5 and dist <= 1:
        return True
        
    return False


# In-memory tracking cache to prevent duplicate detections of the same car/plate
RECENT_DETECTIONS = []
RECENT_DETECTIONS_COOLDOWN = 10.0  # seconds


def calculate_box_iou(box1, box2) -> float:
    """Calculate Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2]."""
    if not box1 or not box2:
        return 0.0
        
    xA = max(box1[0], box2[0])
    yA = max(box1[1], box2[1])
    xB = min(box1[2], box2[2])
    yB = min(box1[3], box2[3])
    
    interArea = max(0, xB - xA) * max(0, yB - yA)
    box1Area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2Area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    unionArea = box1Area + box2Area - interArea
    if unionArea == 0:
        return 0.0
        
    return interArea / unionArea


def check_duplicate_and_update(ocr_en: str, confidence: float, vehicle_box=None, plate_box=None) -> tuple:
    """
    Check if the plate or vehicle has been recently detected to avoid duplicate DB logging.
    If the new detection has higher confidence, flag it for database updating.
    Returns: (is_duplicate, is_better_match, cached_id)
    """
    global RECENT_DETECTIONS
    current_time = time.time()
    
    # Prune expired items
    RECENT_DETECTIONS = [
        item for item in RECENT_DETECTIONS 
        if current_time - item["timestamp"] < RECENT_DETECTIONS_COOLDOWN
    ]
    
    for item in RECENT_DETECTIONS:
        # Match condition 1: OCR is the same (ignoring identical province text prefix)
        ocr_match = False
        p1_clean = ocr_en.split("|")[-1]
        p2_clean = item["ocr_en"].split("|")[-1]
        n1 = "".join(c for c in p1_clean if c.isalnum()).upper()
        n2 = "".join(c for c in p2_clean if c.isalnum()).upper()
        if is_same_plate(n1, n2):
            ocr_match = True
            
        # Match condition 2: Bounding Box Overlap (IoU tracking between sequential frames)
        box_match = False
        if vehicle_box and item.get("vehicle_box"):
            iou = calculate_box_iou(vehicle_box, item["vehicle_box"])
            if iou > 0.4:
                box_match = True
                
        if plate_box and item.get("plate_box"):
            piou = calculate_box_iou(plate_box, item["plate_box"])
            if piou > 0.4:
                box_match = True

        # Treat as duplicate if EITHER OCR matches OR spatial box coordinates overlap
        if ocr_match or box_match:
            # Reset timestamp (heartbeat)
            item["timestamp"] = current_time
            if vehicle_box:
                item["vehicle_box"] = vehicle_box
            if plate_box:
                item["plate_box"] = plate_box
            
            # Check if this new detection has higher confidence
            if confidence > item["confidence"]:
                item["confidence"] = confidence
                item["ocr_en"] = ocr_en
                return True, True, item["_id"]
            return True, False, item["_id"]
            
    return False, False, None


async def log_detection_to_db(detection: dict, existing_id=None):
    """Save a plate detection log entry into MongoDB and save the crop image locally."""
    db = get_database()
    
    # 1. Pop the numpy crop arrays immediately to clean the dictionary for JSON responses
    crop_img = detection.pop('crop', None)
    vehicle_crop = detection.pop('vehicle_crop', None)
    detection.pop('vehicle_box', None)
    
    # Use existing ID if updating, otherwise generate a unique ObjectId
    doc_id = existing_id if existing_id is not None else ObjectId()
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
            "timestamp": time.time(),
            "ocr_en": detection.get("ocr_en", ""),
            "ocr_lao": detection.get("ocr_lao", ""),
            "bg_color": detection.get("bg_color", ""),
            "font_color": detection.get("font_color", ""),
            "plate_type": detection.get("plate_type", ""),
            "confidence": float(detection.get("confidence", 0.0)),
        }
        if image_url:
            log_entry["image_url"] = image_url
        if vehicle_image_url:
            log_entry["vehicle_image_url"] = vehicle_image_url

        if existing_id is not None:
            existing_doc = await db[config.LOGS_COLLECTION].find_one({"_id": existing_id})
            if existing_doc:
                await db[config.LOGS_COLLECTION].update_one({"_id": existing_id}, {"$set": log_entry})
                detection["image_url"] = image_url if image_url else existing_doc.get("image_url", "")
                detection["vehicle_image_url"] = vehicle_image_url if vehicle_image_url else existing_doc.get("vehicle_image_url", "")
                return True

        # Otherwise perform insert
        log_entry["_id"] = doc_id
        if "image_url" not in log_entry:
            log_entry["image_url"] = image_url
        if "vehicle_image_url" not in log_entry:
            log_entry["vehicle_image_url"] = vehicle_image_url

        await db[config.LOGS_COLLECTION].insert_one(log_entry)
        
        # Update the detection dictionary with dynamic image_urls
        detection["image_url"] = log_entry["image_url"]
        detection["vehicle_image_url"] = log_entry["vehicle_image_url"]
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
    Reads chunk-by-chunk to handle large files (e.g. 400MB+) safely without memory exhaustion.
    """
    temp_dir = os.path.join(config.BACKEND_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"temp_upload_{int(time.time())}_{file.filename}"
    temp_video_path = os.path.join(temp_dir, temp_filename)

    try:
        with open(temp_video_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # Read in 1MB chunks
                if not chunk:
                    break
                buffer.write(chunk)
    except Exception as e:
        return {"success": False, "error": f"Failed to save video: {str(e)}"}

    return {"success": True, "filename": temp_filename}


@router.get("/video/stream", summary="Stream processed frames of an uploaded video")
async def stream_video(filename: str = Query(...)):
    """
    Accepts a temporary video filename, processes it frame-by-frame, and streams
    the annotated frames back in real-time as an MJPEG stream.
    Updates duplicate plate logs with higher confidence detections in real-time.
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
                
                # Log detections to MongoDB if found, filtering out duplicates or updating better matches
                for res in results:
                    ocr = res.get("ocr_en", "")
                    conf = res.get("confidence", 0.0)
                    vbox = res.get("vehicle_box")
                    pbox = res.get("box")
                    if ocr:
                        is_dup, is_better, cached_id = check_duplicate_and_update(ocr, conf, vbox, pbox)
                        if not is_dup:
                            doc_id = ObjectId()
                            await log_detection_to_db(res, existing_id=doc_id)
                            RECENT_DETECTIONS.append({
                                "_id": doc_id,
                                "ocr_en": ocr,
                                "confidence": conf,
                                "vehicle_box": vbox,
                                "plate_box": pbox,
                                "timestamp": time.time()
                            })
                        elif is_better:
                            await log_detection_to_db(res, existing_id=cached_id)

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


@router.delete("/delete/{log_id}", summary="Delete a single scan log and its associated crops")
async def delete_log(log_id: str):
    """
    Deletes a specific log record from MongoDB by its ID and deletes the 
    corresponding cropped plate and vehicle images from disk.
    """
    db = get_database()
    if db is None:
        return {"success": False, "error": "MongoDB is not connected"}
        
    try:
        obj_id = ObjectId(log_id)
    except Exception:
        return {"success": False, "error": "Invalid log ID format"}

    # 1. Delete database log record
    db_deleted = False
    try:
        del_res = await db[config.LOGS_COLLECTION].delete_one({"_id": obj_id})
        if del_res.deleted_count > 0:
            db_deleted = True
    except Exception as e:
        print(f"[DB DELETE ERROR] Failed to delete document {log_id}: {e}")
        return {"success": False, "error": f"Database deletion failed: {str(e)}"}

    # 2. Delete crop images on disk (if they exist)
    static_dir = os.path.join(config.BACKEND_DIR, "static")
    plates_path = os.path.join(static_dir, "plates", f"{log_id}.jpg")
    vehicles_path = os.path.join(static_dir, "vehicles", f"{log_id}.jpg")
    
    file_deleted_count = 0
    for path in [plates_path, vehicles_path]:
        if os.path.exists(path):
            try:
                os.remove(path)
                file_deleted_count += 1
            except Exception as fe:
                print(f"[FILE DELETE ERROR] Failed to remove {path}: {fe}")
                
    if not db_deleted:
        return {"success": False, "error": "Log record not found in database"}
        
    return {
        "success": True, 
        "message": f"Successfully deleted log {log_id} and {file_deleted_count} crop images."
    }

@router.post("/flexible-pipeline", summary="Sandbox inference without saving to DB")
async def scan_flexible_sandbox(
    file: UploadFile = File(...),
    run_vehicle: bool = Form(True),
    run_plate: bool = Form(True),
    run_ocr: bool = Form(True),
    run_classifier: bool = Form(True)
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"success": False, "error": "Invalid image file"}

    pipeline = AIService.get_pipeline()
    vehicle_model = pipeline.vehicle_model
    plate_model = pipeline.plate_model
    text_model = pipeline.text_model
    classifier_model = pipeline.classifier_model

    h, w = img.shape[:2]
    annotated_img = img.copy()
    detections = []
    
    ocr_en = ""
    ocr_lao = ""
    
    predicted_style = ""
    classifier_conf = 0.0
    style_label = ""
    bg_color = ""
    font_color = ""

    def crop_box(image, box):
        x1, y1, x2, y2 = [max(0, int(c)) for c in box]
        ih, iw = image.shape[:2]
        x2, y2 = min(iw, x2), min(ih, y2)
        return image[y1:y2, x1:x2]

    # Reconstruct text utility function (same as in scan.py/AI)
    from src.ocr_utils import reconstruct_plate_text

    # CASE A: Run Vehicle Detection first
    if run_vehicle:
        vehicle_results = vehicle_model(img, verbose=False)[0]
        for b in vehicle_results.boxes:
            v_xyxy = b.xyxy[0].tolist()
            v_conf = float(b.conf[0])
            cv2.rectangle(annotated_img, (int(v_xyxy[0]), int(v_xyxy[1])), (int(v_xyxy[2]), int(v_xyxy[3])), (0, 255, 0), 2)
            cv2.putText(annotated_img, f"Vehicle {v_conf:.2f}", (int(v_xyxy[0]), int(v_xyxy[1]) - 5), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
            detections.append({
                "box": [round(x, 1) for x in v_xyxy],
                "confidence": round(v_conf, 4),
                "class_name": "Vehicle"
            })

            if run_plate:
                v_crop = crop_box(img, v_xyxy)
                if v_crop.size > 0:
                    plate_results = plate_model(v_crop, verbose=False)[0]
                    for pb in plate_results.boxes:
                        p_xyxy = pb.xyxy[0].tolist()
                        p_conf = float(pb.conf[0])
                        abs_p_box = [
                            v_xyxy[0] + p_xyxy[0],
                            v_xyxy[1] + p_xyxy[1],
                            v_xyxy[0] + p_xyxy[2],
                            v_xyxy[1] + p_xyxy[3]
                        ]
                        cv2.rectangle(annotated_img, (int(abs_p_box[0]), int(abs_p_box[1])), (int(abs_p_box[2]), int(abs_p_box[3])), (255, 0, 0), 2)
                        cv2.putText(annotated_img, f"Plate {p_conf:.2f}", (int(abs_p_box[0]), int(abs_p_box[1]) - 5),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                        
                        detections.append({
                            "box": [round(x, 1) for x in abs_p_box],
                            "confidence": round(p_conf, 4),
                            "class_name": "Plate"
                        })

                        p_crop = crop_box(v_crop, p_xyxy)
                        if p_crop.size > 0:
                            if run_ocr:
                                text_results = text_model(p_crop, verbose=False)[0]
                                if text_results.boxes:
                                    t_en, t_lao, _ = reconstruct_plate_text(text_results.boxes, text_model.names)
                                    ocr_en = t_en
                                    ocr_lao = t_lao
                                    for tb in text_results.boxes:
                                        tb_xyxy = tb.xyxy[0].tolist()
                                        abs_tb_box = [
                                            abs_p_box[0] + tb_xyxy[0],
                                            abs_p_box[1] + tb_xyxy[1],
                                            abs_p_box[0] + tb_xyxy[2],
                                            abs_p_box[1] + tb_xyxy[3]
                                        ]
                                        cv2.rectangle(annotated_img, (int(abs_tb_box[0]), int(abs_tb_box[1])), (int(abs_tb_box[2]), int(abs_tb_box[3])), (0, 255, 255), 1)
                            if run_classifier:
                                class_results = classifier_model(p_crop, verbose=False)[0]
                                top1_id = class_results.probs.top1
                                classifier_conf = float(class_results.probs.top1conf)
                                predicted_style = class_results.names[top1_id]
                                
    # CASE B: No Vehicle Detection, but Plate Detection is on
    elif run_plate:
        plate_results = plate_model(img, verbose=False)[0]
        for pb in plate_results.boxes:
            p_xyxy = pb.xyxy[0].tolist()
            p_conf = float(pb.conf[0])
            cv2.rectangle(annotated_img, (int(p_xyxy[0]), int(p_xyxy[1])), (int(p_xyxy[2]), int(p_xyxy[3])), (255, 0, 0), 2)
            cv2.putText(annotated_img, f"Plate {p_conf:.2f}", (int(p_xyxy[0]), int(p_xyxy[1]) - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            
            detections.append({
                "box": [round(x, 1) for x in p_xyxy],
                "confidence": round(p_conf, 4),
                "class_name": "Plate"
            })

            p_crop = crop_box(img, p_xyxy)
            if p_crop.size > 0:
                if run_ocr:
                    text_results = text_model(p_crop, verbose=False)[0]
                    if text_results.boxes:
                        t_en, t_lao, _ = reconstruct_plate_text(text_results.boxes, text_model.names)
                        ocr_en = t_en
                        ocr_lao = t_lao
                        for tb in text_results.boxes:
                            tb_xyxy = tb.xyxy[0].tolist()
                            abs_tb_box = [
                                p_xyxy[0] + tb_xyxy[0],
                                p_xyxy[1] + tb_xyxy[1],
                                p_xyxy[0] + tb_xyxy[2],
                                p_xyxy[1] + tb_xyxy[3]
                            ]
                            cv2.rectangle(annotated_img, (int(abs_tb_box[0]), int(abs_tb_box[1])), (int(abs_tb_box[2]), int(abs_tb_box[3])), (0, 255, 255), 1)
                if run_classifier:
                    class_results = classifier_model(p_crop, verbose=False)[0]
                    top1_id = class_results.probs.top1
                    classifier_conf = float(class_results.probs.top1conf)
                    predicted_style = class_results.names[top1_id]

    # CASE C: Neither Vehicle nor Plate detection, but OCR is on
    elif run_ocr:
        text_results = text_model(img, verbose=False)[0]
        if text_results.boxes:
            t_en, t_lao, _ = reconstruct_plate_text(text_results.boxes, text_model.names)
            ocr_en = t_en
            ocr_lao = t_lao
            for tb in text_results.boxes:
                tb_xyxy = tb.xyxy[0].tolist()
                cv2.rectangle(annotated_img, (int(tb_xyxy[0]), int(tb_xyxy[1])), (int(tb_xyxy[2]), int(tb_xyxy[3])), (0, 255, 255), 1)
                
                detections.append({
                    "box": [round(x, 1) for x in tb_xyxy],
                    "confidence": round(float(tb.conf[0]), 4),
                    "char": text_model.names[int(tb.cls[0])]
                })

        if run_classifier:
            class_results = classifier_model(img, verbose=False)[0]
            top1_id = class_results.probs.top1
            classifier_conf = float(class_results.probs.top1conf)
            predicted_style = class_results.names[top1_id]

    # CASE D: Only Classifier is enabled
    elif run_classifier:
        class_results = classifier_model(img, verbose=False)[0]
        top1_id = class_results.probs.top1
        classifier_conf = float(class_results.probs.top1conf)
        predicted_style = class_results.names[top1_id]

    if predicted_style:
        class_mapping = {
            'private': 'Private License Plate (Yellow bg, Black text)',
            'government': 'Government License Plate (Blue bg, White text)',
            'state': 'Government License Plate (Blue bg, White text)',
            'business_100': 'Business License Plate 100% (White bg, Black text)',
            'business_1': 'Business License Plate 1% (White bg, Blue text)',
            'military_police': 'Military/Police License Plate (Red bg, White text)',
            'public': 'Military/Police License Plate (Red bg, White text)',
            'foreign': 'Foreign License Plate (Yellow bg, Blue text)',
            'international_organization': 'International Organization Plate (White bg, Blue text)'
        }
        bg_color_mapping = {
            'private': 'Yellow', 'government': 'Blue', 'state': 'Blue', 'military_police': 'Red', 'public': 'Red',
            'business_100': 'White', 'business_1': 'White', 'foreign': 'Yellow',
            'international_organization': 'White'
        }
        font_color_mapping = {
            'private': 'Black', 'government': 'White', 'state': 'White', 'military_police': 'White', 'public': 'White',
            'business_100': 'Black', 'business_1': 'Blue', 'foreign': 'Blue',
            'international_organization': 'Blue'
        }
        style_label = class_mapping.get(predicted_style, "Unknown License Plate Type")
        bg_color = bg_color_mapping.get(predicted_style, "Unknown")
        font_color = font_color_mapping.get(predicted_style, "Unknown")

    _, encoded = cv2.imencode('.jpg', annotated_img)
    base64_image = base64.b64encode(encoded).decode('utf-8')
    return {
        "success": True,
        "annotated_image": f"data:image/jpeg;base64,{base64_image}",
        "detections": detections,
        "text_en": ocr_en,
        "text_lao": ocr_lao,
        "predicted_style": predicted_style,
        "confidence": round(classifier_conf, 4) if predicted_style else None,
        "label": style_label if predicted_style else None,
        "bg_color": bg_color if predicted_style else None,
        "font_color": font_color if predicted_style else None
    }



