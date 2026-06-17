# Lao License Plate Recognition & Classification System (LPR)

An end-to-end, high-performance Intelligent Transportation System (ITS) designed to detect vehicles, locate license plates, perform Optical Character Recognition (OCR) for Lao script characters, and dynamically classify plate types based on background and font colors.

---

## 1. Project Core Concept

Lao PDR has a unique, color-coded license plate system where background and text color combinations signify the legal status and usage type of the vehicle (e.g., private citizen, commercial transport, state official, or foreign diplomat). Additionally, plates contain Lao characters representing alphanumeric sequences and provinces.

This project implements an **end-to-end AI pipelines to web service** that automates the recognition and auditing of these vehicles:

```
┌─────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  React Frontend │ ◄───► │  FastAPI Backend │ ◄───► │  AI ONNX Engine  │
│  (UI/UX Portal) │       │   (Controller)   │       │ (DirectML GPU)   │
└─────────────────┘       └────────┬─────────┘       └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │   MongoDB Logs   │
                          │ & Local Images   │
                          └──────────────────┘
```

---

## 2. Key Features & Technologies

*   **Hierarchical Object Detection (YOLOv8 Cascade):** 
    Detects the vehicle context first (Car, Truck, Bus) using `yolov8n.onnx`, and then restricts the license plate search (`vehicle_plate.onnx`) to within that vehicle box. This prevents false positive detections (e.g., signs, billboards, or background objects) and boosts accuracy.
*   **Tilt Correction & Deskewing:**
    When cameras capture plates from skewed angles, the system applies a sequence of rotations (`[-10, -5, 0, 5, 10]` degrees) to the cropped image, dynamically feeding each to the OCR model and selecting the angle producing the highest confidence.
*   **Deep Learning OCR (`plate_text.onnx`):**
    Recognizes alphanumeric symbols and matches them to the appropriate Lao letter mappings (e.g. `A` ➔ `ກ`, `B` ➔ `ຂ`) and Lao provinces (e.g. `VTE` ➔ `ນະຄອນຫຼວງວຽງຈັນ (Vientiane)`).
*   **Dynamic Color Classification (HSV Median Rules):**
    Analyzes the plate's background and font colors using the HSV (Hue, Saturation, Value) color space to classify the vehicle's registry category (Private, Business, State, Public, Foreign). Includes shadow compensation for Dark Blue state plates.
*   **Hardware Acceleration (ONNX + DirectML):**
    Configured to utilize **DirectML** for hardware acceleration, enabling fast, real-time GPU-powered inference on Windows systems (e.g., NVIDIA RTX 3060 Laptop GPUs) without complex CUDA setups.
*   **Comprehensive Scanning Options:**
    Supports drag-and-drop static image uploads, as well as real-time canvas-based video frame streaming using the client's webcam.

---

## 3. Documentation Index

Detailed architectural descriptions, setup guides, and module rules are organized in the **[dev-document/](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document)** directory:

*   📖 **[Setup & Installation Guide](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document/SETUP.md):** Step-by-step instructions on setting up environments, installing DirectML dependencies, configuring MongoDB, and running the system.
*   📖 **[System Architecture Guide](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document/ARCHITECTURE.md):** Complete operational workflow walkthrough, database schema details, and backend endpoint mapping.
*   📖 **[AI Processing Engine Architecture](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document/AI/README.md):** Detailed overview of the YOLO cascade pipeline, deskewing algorithm, and AI file structure.
*   📖 **[FastAPI Backend Guide](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document/backend/README.md):** Explanation of routing endpoints, database logging logic, static file delivery, and the Singleton `AIService` structure.
*   📖 **[React Frontend Guide](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document/frontend/README.md):** Component hierarchy (ImageScanner, VideoScanner, Database History) and services schema.
*   📖 **[Lao Plate Type Color Logic](file:///c:/Users/billi/Desktop/laolicenceplate/dev-document/AI/PLATE_TYPE_LOGIC.md):** Specific HSV range boundaries, majority voting heuristics, and fallback plate rules.

---

## 4. Root Folder Structure

```
laolicenceplate/
├── AI/                       # AI Pipeline engine (ONNX Runtime, DirectML, Python)
├── backend/                  # FastAPI web server, image storage, MongoDB controller
├── dev-document/             # Development documentation, guides, and plans
├── frontend/                 # React, TypeScript, and Vite single page application
├── .gitignore                # Global git ignore configurations
├── LICENSE                   # Project License
└── README.md                 # Project Overview (This file)
```
