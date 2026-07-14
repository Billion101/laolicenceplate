import sys
import os
import cv2
import numpy as np
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# Add the AI folder to system path to allow importing src helper modules
AI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "AI")
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from src.ocr_utils import find_best_rotation_and_ocr, reconstruct_plate_text
from src.config import LAO_PROVINCE_MAP

app = FastAPI(
    title="Lao License Plate Model Testing API",
    description="Endpoint testing utility to run each of the 4 ONNX models individually.",
    version="1.0.0"
)

# Enable CORS for Vite Frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load YOLO ONNX Models (Using Task-Specific Instantiations)
# ---------------------------------------------------------------------------
MODELS_DIR = os.path.join(AI_DIR, "models")

print("--> Loading vehicle_detect model...")
vehicle_model = YOLO(os.path.join(MODELS_DIR, "vehicle_detect.onnx"), task="detect")

print("--> Loading vehicle_plate model...")
plate_model = YOLO(os.path.join(MODELS_DIR, "vehicle_plate.onnx"), task="detect")

print("--> Loading plate_text model...")
text_model = YOLO(os.path.join(MODELS_DIR, "plate_text.onnx"), task="detect")

print("--> Loading plate_classifier model...")
classifier_model = YOLO(os.path.join(MODELS_DIR, "plate_classifier.onnx"), task="classify")

print("--> All ONNX Models loaded successfully!")

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def decode_upload_image(file_contents: bytes) -> np.ndarray:
    """Decode uploaded file bytes into an OpenCV BGR image."""
    nparr = np.frombuffer(file_contents, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def encode_image_base64(img: np.ndarray) -> str:
    """Encode an OpenCV image to base64 jpeg string."""
    _, encoded = cv2.imencode('.jpg', img)
    return base64.b64encode(encoded).decode('utf-8')

# ---------------------------------------------------------------------------
# Test Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {"status": "online", "message": "Model testing API is running."}

@app.post("/api/v1/test/vehicle-detect", summary="Test vehicle detection model")
async def test_vehicle_detect(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_upload_image(contents)
    if img is None:
        return {"success": False, "error": "Invalid image file"}

    # Run inference
    results = vehicle_model(img, verbose=False)[0]
    
    # Draw annotations
    annotated_img = results.plot()
    base64_image = encode_image_base64(annotated_img)

    # Format detections
    detections = []
    names = results.names
    for b in results.boxes:
        xyxy = b.xyxy[0].tolist()
        conf = float(b.conf[0])
        cls_id = int(b.cls[0])
        cls_name = names.get(cls_id, f"Class {cls_id}")
        detections.append({
            "box": [round(x, 1) for x in xyxy],
            "confidence": round(conf, 4),
            "class_name": cls_name
        })

    return {
        "success": True,
        "annotated_image": f"data:image/jpeg;base64,{base64_image}",
        "detections": detections
    }

@app.post("/api/v1/test/plate-detect", summary="Test license plate detection model")
async def test_plate_detect(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_upload_image(contents)
    if img is None:
        return {"success": False, "error": "Invalid image file"}

    # Run inference
    results = plate_model(img, verbose=False)[0]
    
    # Draw annotations
    annotated_img = results.plot()
    base64_image = encode_image_base64(annotated_img)

    # Format detections
    detections = []
    names = results.names
    for b in results.boxes:
        xyxy = b.xyxy[0].tolist()
        conf = float(b.conf[0])
        cls_id = int(b.cls[0])
        cls_name = names.get(cls_id, f"Class {cls_id}")
        detections.append({
            "box": [round(x, 1) for x in xyxy],
            "confidence": round(conf, 4),
            "class_name": cls_name
        })

    return {
        "success": True,
        "annotated_image": f"data:image/jpeg;base64,{base64_image}",
        "detections": detections
    }

@app.post("/api/v1/test/plate-ocr", summary="Test character detection & text OCR model")
async def test_plate_ocr(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_upload_image(contents)
    if img is None:
        return {"success": False, "error": "Invalid image file"}

    # 1. Use the best-rotation deskew utility (simulates pipeline deskewing)
    rotated, text_results = find_best_rotation_and_ocr(img, text_model)
    text_boxes = text_results[0].boxes
    
    # Draw boxes
    annotated_img = text_results[0].plot()
    base64_image = encode_image_base64(annotated_img)

    # 2. Reconstruct characters to text sequences
    text_en = ""
    text_lao = ""
    detections = []
    
    if text_boxes:
        text_en, text_lao, _ = reconstruct_plate_text(text_boxes, text_model.names)
        
        # Format detections
        for b in text_boxes:
            xyxy = b.xyxy[0].tolist()
            conf = float(b.conf[0])
            cls_name = text_model.names[int(b.cls[0])]
            detections.append({
                "box": [round(x, 1) for x in xyxy],
                "confidence": round(conf, 4),
                "char": cls_name
            })

    return {
        "success": True,
        "annotated_image": f"data:image/jpeg;base64,{base64_image}",
        "detections": detections,
        "text_en": text_en,
        "text_lao": text_lao
    }

@app.post("/api/v1/test/plate-classify", summary="Test plate style classification model")
async def test_plate_classify(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_upload_image(contents)
    if img is None:
        return {"success": False, "error": "Invalid image file"}

    # Run inference
    results = classifier_model(img, verbose=False)[0]
    top1_id = results.probs.top1
    confidence = float(results.probs.top1conf)
    predicted_style = results.names[top1_id]

    # Heuristic Rule: distinguish business_1 and international_organization
    if predicted_style in ['business_1', 'international_organization', 'state', 'public']:
        # Run text_model inside the crop to see if a Lao province matches
        text_results = text_model(img, verbose=False)[0]
        has_province = False
        for b in text_results.boxes:
            cls_name = text_model.names[int(b.cls[0])]
            if cls_name in LAO_PROVINCE_MAP:
                has_province = True
                break
        
        if predicted_style in ['business_1', 'international_organization']:
            if has_province:
                predicted_style = 'business_1'
            else:
                predicted_style = 'international_organization'

    # Map the class output to human-readable Lao plate names
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

    # Map background color names
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

    return {
        "success": True,
        "predicted_style": predicted_style,
        "confidence": round(confidence, 4),
        "label": class_mapping.get(predicted_style, "Unknown License Plate Type"),
        "bg_color": bg_color_mapping.get(predicted_style, "Unknown"),
        "font_color": font_color_mapping.get(predicted_style, "Unknown")
    }
