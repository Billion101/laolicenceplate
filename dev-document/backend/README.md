# Backend Module: Architecture & Folder Structure Guide

This document describes the design patterns, endpoints, database persistence, and directory structure of the **FastAPI Backend Server** (`laolicenceplate/backend`).

---

## 1. Backend Architecture

The backend is built using **FastAPI**, a modern, high-performance web framework for Python. It acts as the orchestration layer between the React client and the AI models, storing scans and static assets.

```
┌──────────────┐             ┌────────────────────────────────────────┐
│              │ ➔ (POST img)│           FastAPI Web Server           │
│              ├────────────►│  routers/scan.py: /scan/image          │
│              │             │         │                              │
│              │             │         ▼                              │
│              │             │  services/ai_service.py: AIService     │
│ React Client │             │         │                              │
│              │             │         ▼                              │
│              │             │  [AI processing pipeline.py]           │
│              │             │         │                              │
│              │             │         ▼                              │
│              │◄────────────┤  Saves images & logs details to DB     │
│              │ ◀─(GET logs)│                                        │
└──────────────┘             └─────────┬────────────────────┬─────────┘
                                       │                    │
                                       ▼                    ▼
                              ┌────────────────┐    ┌────────────────┐
                              │  Local Disk    │    │    MongoDB     │
                              │ static/plates/ │    │  "lao_plate"   │
                              │ static/vehic/  │    │  database      │
                              └────────────────┘    └────────────────┘
```

### Key Subsystems:

1.  **Singleton AI Model Wrapper (`AIService`):**
    *   ONNX models are massive and slow to load. To prevent the server from reloading the weights on every API request (which would crash memory and cause major delays), the backend wraps the pipeline in a singleton class: [ai_service.py](file:///c:/Users/billi/Desktop/laolicenceplate/backend/app/services/ai_service.py).
    *   The model weights are loaded into GPU memory *once* when the FastAPI server starts.
2.  **Stateless File Storage:**
    *   When an image is processed, the backend extracts the cropped plate region and cropped vehicle region.
    *   It saves these crops as `.jpg` images in `backend/static/plates/` and `backend/static/vehicles/`.
    *   These folders are mounted by FastAPI's `StaticFiles` provider, making them accessible via HTTP routes (e.g. `/static/plates/<id>.jpg`).
3.  **MongoDB Log Database:**
    *   The database is initialized in [db.py](file:///c:/Users/billi/Desktop/laolicenceplate/backend/app/db.py).
    *   Each scanned item is saved with the following JSON schema:
        ```json
        {
          "_id": "ObjectId",
          "plate_text": "ກກ 1234",
          "plate_type": "Private License Plate",
          "confidence": 0.89,
          "bg_color": "Yellow",
          "font_color": "Black",
          "image_url": "/static/plates/uuid.jpg",
          "vehicle_image_url": "/static/vehicles/uuid.jpg",
          "timestamp": "ISODate"
        }
        ```

---

## 2. API Endpoints

The endpoints are exposed by the scan router: [scan.py](file:///c:/Users/billi/Desktop/laolicenceplate/backend/app/routers/scan.py):

*   `POST /scan/image`
    *   **Description:** Accepts a multipart form image upload. It runs the AI pipeline, crops the plate and vehicle, saves them locally, records a document in MongoDB, and returns the detection results.
*   `GET /scan/logs`
    *   **Description:** Queries MongoDB for previous scans, sorted by the most recent timestamp.

---

## 3. Directory and File Structure

Here is the file structure of the `/backend` workspace directory:

```
laolicenceplate/backend/
├── .venv/                     # Python local virtual environment (DirectML GPU)
├── app/                       # FastAPI application module
│   ├── __init__.py            # Main application init
│   ├── config.py              # Backend configuration (MongoDB URIs, paths)
│   ├── db.py                  # MongoDB database connections and logging logic
│   ├── main.py                # Server entry point (CORS settings, static folders mount)
│   ├── routers/               # API endpoint routers
│   │   ├── __init__.py
│   │   └── scan.py            # Upload scanner and DB logs API routes
│   └── services/              # Singleton service providers
│       ├── __init__.py
│       └── ai_service.py      # Thread-safe AI Pipeline model loader
├── static/                    # Local image storage folder (ignored from git)
│   ├── plates/                # Saved crops of license plates
│   │   └── .gitkeep           # Keeps directory structure in Git
│   └── vehicles/              # Saved crops of vehicles
│       └── .gitkeep           # Keeps directory structure in Git
├── backend-workflow.md        # Technical workflow documentation
├── requirements.txt           # Python dependencies (fastapi, pymongo, etc.)
└── run.py                     # Execution helper to boot FastAPI on port 8000
```

---

## 4. Technical Stack

*   **Framework:** FastAPI with Uvicorn server
*   **Database:** MongoDB via PyMongo
*   **Imaging:** OpenCV (`opencv-python-headless`) & NumPy
*   **Environment Configuration:** Python dotenv or config files
