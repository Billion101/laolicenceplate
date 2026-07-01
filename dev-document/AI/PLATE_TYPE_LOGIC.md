# Lao License Plate Type Classification: Deep Learning Classifier Guide

This document details the architecture, class mappings, color reconstruction, and integration details of the deep learning classification model (**`plate_classifier.onnx`**) used to dynamically identify Lao license plate types.

---

## 1. Shift from Heuristics to AI Classification

Previously, the system classified plate types using manual HSV color extraction rules (cropping the inner 84%, sorting pixel values, and performing color thresholding). 

### Why the Shift to Deep Learning?
*   **Robustness to Lighting:** Manual HSV thresholds are highly sensitive to glare, shadow (e.g. state plates appearing black in low light), and camera exposure.
*   **Immunity to Dirt & Wear:** Dirty, rusty, or faded plates would shift in hue/saturation, causing rule-based classifiers to fail.
*   **Frame/Bracket Noise:** External metal frames, brackets, and vehicle paint around the edges of the plate crop no longer need strict safe-zone masking.
*   **End-to-End Classification:** The classifier directly evaluates the global visual appearance of the license plate crop at a resolution of $64\times 64$ pixels.

---

## 2. Classification Classes & Mappings

The new **`plate_classifier.onnx`** model (trained as a YOLOv8-classify model) outputs a prediction vector across **7 target classes**. 

The system maps the top predicted class label to the corresponding Lao license plate type, background color, and font color for UI display and database logging inside [pipeline.py](file:///c:/Users/billi/Desktop/laolicenceplate/AI/src/pipeline.py):

| Model Class Output | Lao License Plate Type | Display BG Color | Display Font Color | User / Registry Type |
| :--- | :--- | :--- | :--- | :--- |
| `private` | Private License Plate | Yellow | Black | General citizens |
| `government` | Government License Plate | Blue | White | Government / State officials |
| `business_100` | Business License Plate (100%) | White | Black | Commercial, logistics, freight |
| `business_1` | Business License Plate (1%) | White | Blue | Joint-venture / Business imports |
| `military_police` | Military/Police License Plate | Red | White | Military or Public Security officials |
| `foreign` | Foreign License Plate | Yellow | Blue | Diplomatic, Consular, Foreign guests |
| `international_organization` | International Organization Plate | White | Blue | International organizations (e.g. UN, NGO) |

---

## 3. Integration & Code Execution Flow

The classification step is executed inside [pipeline.py](file:///c:/Users/billi/Desktop/laolicenceplate/AI/src/pipeline.py#L155-L182) as **Stage 4** of the plate crop processing:

1.  **Model Inference:** 
    The rotated, deskewed plate crop is resized and passed directly to the classification model:
    ```python
    class_results = self.classifier_model(rotated, conf=0.25, verbose=False)[0]
    ```
2.  **Top Category Extraction:**
    The category ID containing the highest probability is retrieved:
    ```python
    class_id = class_results.probs.top1
    predicted_style = class_results.names[class_id]
    ```
3.  **Attribute Association:**
    The predicted style is mapped to the final `plate_type`, `bg_color`, and `font_color` using static Python dictionaries. 

---

## 4. Retraining and Fine-Tuning the Model

If the system encounters classification errors in production (e.g. misclassifying a specific new style of plates), you can retrain the model inside the **`train-plate-type/`** workspace.

### Steps to Retrain:
1.  **Collect Crops:** Extract plate crops that were misclassified or belong to edge-case scenarios.
2.  **Organize Dataset:** Save the crops under `train-plate-type/train/<class_name>/` and `train-plate-type/val/<class_name>/`.
3.  **Execute Training:** Run the YOLOv8 classification training script:
    ```bash
    python train-plate-type/train.py
    ```
4.  **Export to ONNX:** Export the updated model weights (`best.pt` ➔ `best.onnx`) and move the output to the active models directory:
    *   **Source:** `train-plate-type/runs/classify/train/weights/best.onnx`
    *   **Destination:** `AI/models/plate_classifier.onnx`
