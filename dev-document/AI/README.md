# AI Module: Architecture & Folder Structure Guide

This document describes the inner workings, component architecture, and directory structure of the **AI Processing Engine** (`laolicenceplate/AI`).

---

## 1. AI Component Architecture

The AI module is built as a hierarchical processing pipeline that detects vehicles, locates their plates, corrects tilt, runs OCR, and classifies plate types in a cascaded flow.

### Pipeline Workflow
The pipeline in [pipeline.py](file:///c:/Users/billi/Desktop/laolicenceplate/AI/src/pipeline.py) operates as follows:

```
[Input Image]
      │
      ▼
┌─────────────────────────┐
│ 1. Vehicle Detection    │ ➔ yolov8n.onnx (filters Cars, Trucks, Buses)
└─────────┬───────────────┘
          │ (For each vehicle crop)
          ▼
┌─────────────────────────┐
│ 2. Plate Detection      │ ➔ vehicle_plate.onnx (locates plate box inside vehicle)
└─────────┬───────────────┘
          │ (For each plate crop)
          ▼
┌─────────────────────────┐
│ 3. Deskew / Rotation    │ ➔ Rotates plate image at angles [-10, -5, 0, 5, 10]
└─────────┬───────────────┘
          │ (Passes deskewed crop)
          ▼
┌─────────────────────────┐
│ 4. Plate OCR (Text)     │ ➔ plate_text.onnx (detects char box coordinates & labels)
└─────────┬───────────────┘
          │ (Passes deskewed crop)
          ▼
┌─────────────────────────┐
│ 5. AI Plate Classifier  │ ➔ plate_classifier.onnx (deep learning style classifier)
└─────────┬───────────────┘
          │
          ▼
   [Final Result]
```

### Key Subsystems:
1.  **Vehicle Detector (Stage 1):** Detects vehicles using `yolov8n.onnx` (pre-trained COCO classes: 2: Car, 5: Bus, 7: Truck) with a default confidence threshold of `0.25`. This minimizes false plate detections by forcing plates to reside within valid vehicles.
2.  **Plate Detector (Stage 2):** Runs `vehicle_plate.onnx` on the vehicle bounding box crop. This localized search is faster and more accurate than scanning the entire image.
3.  **Deskewing & Tilt Correction (Stage 3):** To improve OCR accuracy on angled cameras, the plate crop is rotated across a sequence of candidate angles (`-10`, `-5`, `0`, `5`, `10` degrees). The angle producing the highest OCR confidence is selected.
4.  **OCR Text Reader (Stage 4):** Uses `plate_text.onnx` to read the characters, map characters back to Lao letters using a dictionary, reconstruct digits/provinces, and automatically clean lookalikes (e.g. `O` ➔ `0` in numerical parts).
5.  **AI Plate Classifier (Stage 5):** Direct deep-learning image classification using `plate_classifier.onnx` (trained via YOLOv8-classify). Predicts the plate registry style directly (`private`, `state`, `business_100`, `business_1`, `public`, `foreign`) and maps them to human-readable plate names and colors.
6.  **Duplicate Plate Suppression (NMS):** If a single plate causes multiple overlapping bounding boxes, a custom **Intersection over Union (IoU) Non-Maximum Suppression** filter suppresses boxes with IoU $> 0.4$, returning only the highest confidence plate.

---

## 2. Directory and File Structure

Here is the file structure of the `/AI` workspace directory with descriptions of each file's purpose:

```
laolicenceplate/AI/
├── .venv/                     # Python local virtual environment (DirectML GPU)
├── models/                    # ONNX model files (ignored from git)
│   ├── yolov8n.onnx           # Vehicle object detector
│   ├── vehicle_plate.onnx     # License plate box detector
│   ├── plate_text.onnx        # Lao character and digit OCR model
│   └── plate_classifier.onnx  # Deep learning license plate type classifier
├── runs/                      # Local testing output folder (ignored from git)
│   └── color_ocr_results/     # Output images with bounding boxes & texts
├── src/                       # Core python source scripts
│   ├── __init__.py            # Python package initializer
│   ├── color_utils.py         # [DEPRECATED] Former HSV color segmenter
│   ├── config.py              # Hyperparameters, paths, letter & province maps
│   ├── ocr_utils.py           # Deskewing, character decoding, and OCR inference
│   ├── pipeline.py            # Main LicensePlatePipeline orchestration class
│   └── visual_utils.py        # Visual drawing of bounding boxes and crops
├── test_images/               # Folder for test images (ignored from git)
│   ├── .gitkeep               # Directory tracker for Git
│   └── image.png              # Sample test image
├── main.py                    # Local CLI execution harness for testing
├── requirements.txt           # Python dependency file for the AI environment
└── workflow.md                # System flow details
```

---

## 3. Technology Stack & Execution Providers

*   **Primary Language:** Python 3.10+
*   **Inference Engine:** ONNX Runtime (`onnxruntime-directml`)
*   **Hardware Acceleration:** DirectML (`DmlExecutionProvider`) targeting DirectX 12 compatible GPUs (e.g., NVIDIA RTX 3060 Laptop GPU).
*   **Image Processing:** OpenCV (`opencv-python`) and NumPy.
*   **Deep Learning Models:** Exported Ultralytics YOLOv8 ONNX models.
