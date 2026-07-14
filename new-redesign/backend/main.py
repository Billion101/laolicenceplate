import sys
import os
import cv2
import numpy as np
import base64
from fastapi import FastAPI, UploadFile, File, Form
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

@app.post("/api/v1/test/flexible-pipeline", summary="Test the cascade pipeline with flexible model choices")
async def test_flexible_pipeline(
    file: UploadFile = File(...),
    run_vehicle: bool = Form(True),
    run_plate: bool = Form(True),
    run_ocr: bool = Form(True),
    run_classifier: bool = Form(True)
):
    contents = await file.read()
    img = decode_upload_image(contents)
    if img is None:
        return {"success": False, "error": "Invalid image file"}

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

    base64_image = encode_image_base64(annotated_img)
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

