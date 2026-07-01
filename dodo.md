# Project Setup: YOLO Model Training

Follow these steps to set up your environment and install the required dependencies for training your model.

### 1. Create and Navigate to the Project Directory

Open your terminal or command prompt and run the following commands to create your project folder and move into it:

```bash
mkdir train-model4

cd train-model4

python train.py

python -m venv .venv

pip install ultralytics torch opencv-python pyyaml
```

---

### 2. Create and Set Up the Frontend Project (React + Vite + TypeScript)

To set up a modern React TS web application using Vite, run the following commands in your terminal:

```bash
# 1. Create a new React + TypeScript project using Vite
npm create vite@latest frontend -- --template react-ts

# 2. Navigate to the created project folder
cd frontend

# 3. Install the default node dependencies
npm install

# 4. Install supporting packages (e.g. axios for backend connection)
npm install axios

# 5. Launch the local development server (usually http://localhost:5173)
npm run dev
```
