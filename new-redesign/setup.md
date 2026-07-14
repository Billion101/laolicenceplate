# Lao License Plate AI Model Tester (new-redesign)

This subdirectory contains a database-free model validation sandbox. It allows developers to upload images or stream their webcam feed to individually test the predictions of the 4 core ONNX models that power the unified cascade pipeline.

---

## 1. How the Architecture Works
*   **Frontend UI:** A tabbed dashboard built with React (Vite) and styled with flex glass-accents. It has 4 tabs, one for each model, with toggles for file uploads and live camera feeds.
*   **Backend API:** A lightweight FastAPI server that mounts the ONNX models directly using `ultralytics` and returns predictions, bounding boxes, OCR text reconstructions, and dynamic plate badges to the client.
*   **No DB Dependency:** Unlike the main app, this sandbox is completely decoupled from MongoDB and does not persist any logs on disk or in the database.

---

## 2. Backend Startup Instructions

The backend runs on **Python** and uses the 4 ONNX models located inside `new-redesign/AI/models/`.

### 🪟 Windows Setup

#### Step 1: Open PowerShell or Command Prompt in the backend folder
```powershell
cd new-redesign/backend
```

#### Step 2: Initialize Virtual Environment & Start Server
You can either create a fresh environment or reuse the preconfigured one from the main backend folder:

*   **Option A: Reuse pre-existing environment (Recommended / Fast)**
    ```powershell
    & "..\..\backend\.venv\Scripts\python.exe" run.py
    ```

*   **Option B: Create a fresh virtual environment**
    ```powershell
    # Create the environment
    python -m venv .venv
    
    # Activate the environment
    .\.venv\Scripts\Activate.ps1
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Run the server
    python run.py
    ```

---

### 🍎 macOS Setup

#### Step 1: Open Terminal in the backend folder
```bash
cd new-redesign/backend
```

#### Step 2: Initialize Virtual Environment & Start Server
You can either create a fresh environment or reuse the preconfigured one from the main backend folder:

*   **Option A: Reuse pre-existing environment (Recommended / Fast)**
    ```bash
    ../../backend/.venv/bin/python run.py
    ```

*   **Option B: Create a fresh virtual environment**
    ```bash
    # Create the environment
    python3 -m venv .venv
    
    # Activate the environment
    source .venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Run the server
    python run.py
    ```

The backend server will host the API endpoints at `http://localhost:8001`.

---

## 3. Frontend Startup Instructions (Windows & macOS)

The frontend is a **React + TypeScript (Vite)** application.

### Step 1: Open Terminal in the frontend folder
*   **Command:**
    ```bash
    cd new-redesign/frontend
    ```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Launch Vite Dev Server
```bash
npm run dev
```

Vite will launch the local web server at `http://localhost:5173/`. Open this URL in your web browser.

---

## 4. How to Test Every Model

Once both servers are running and the top status badge reads **`Backend Live`**, you can test each model by selecting their tab:

### 📸 Tab 1: Vehicle Detector (`vehicle_detect.onnx`)
*   **Target Input:** Upload any full vehicle image or street scene.
*   **Output:** Shows the image with highlighted bounding boxes around vehicles (e.g. Cars, Buses, Trucks) alongside confidence percentages and numerical coordinates.

### 🔍 Tab 2: Plate Detector (`vehicle_plate.onnx`)
*   **Target Input:** Upload a vehicle image containing a license plate.
*   **Output:** Shows the bounding boxes marking the exact location of the license plate on the vehicle.

### 🔠 Tab 3: Plate OCR (`plate_text.onnx`)
*   **Target Input:** Upload a **cropped** close-up image of a license plate.
*   **Output:** 
    *   Highlights bounding boxes around each individual letter/digit character.
    *   Sorts and filters character coords to output the reconstructed English sequence (e.g., `VTE | A A 1 2 3 4`) and Lao text sequence (e.g., `ນະຄອນຫຼວງວຽງຈັນ (Vientiane) | ກ ກ 1 2 3 4`).

### 🏷️ Tab 4: Plate Type Classifier (`plate_classifier.onnx`)
*   **Target Input:** Upload a **cropped** close-up image of a license plate.
*   **Output:** 
    *   Renders a **realistic, custom-colored license plate badge** representing the style predicted by the classifier (e.g., Yellow background for private, Blue background for government, Red for military/police).
    *   Applies the Lao province character heuristic rule (e.g. automatically distinguishing between Business 1% and International Organization plates by scanning for province characters).

---

## 5. Live Camera Stream Testing
Each tab includes a **"Live Camera Stream"** option next to "Upload Image File":
1.  Select **"Live Camera Stream"** inside the Input Setup panel.
2.  Select your camera device from the **"Select Camera Source"** dropdown (allows choosing between built-in webcams, back-cameras, or virtual cameras).
3.  Click **"Turn On Video Camera"** (the browser will request webcam access).
4.  Once the video feed starts, click **"Start Real-Time Scan"**.
5.  The page will capture frames from your video feed and send them to the active model in the background every 250ms.
6.  **Heuristic Filtering:** The screen will dynamically calculate the best frame and lock onto only the highest-confidence prediction candidate (so that the results do not flicker or jump).
7.  Click **"Reset Match"** to reset the locked frame, or click **"Stop Scan"** when you are done.
