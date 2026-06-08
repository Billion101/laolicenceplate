import os

# Base directory of the project
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Dataset Paths
DATASETS = {
    "plate": os.path.join(BASE_DIR, "datasets", "vehicle-plate"),
    "vehicle": os.path.join(BASE_DIR, "datasets", "vehicle"),
    "text": os.path.join(BASE_DIR, "datasets", "plate-text"),
}

# Model Directories (For storing trained weights, logs, etc.)
MODELS = {
    "plate": os.path.join(BASE_DIR, "models", "vehicle-plate"),
    "vehicle": os.path.join(BASE_DIR, "models", "vehicle"),
    "text": os.path.join(BASE_DIR, "models", "plate-text"),
}

# Training Configurations
TRAIN_CONFIG = {
    "epochs": 100,
    "imgsz": 640,
    "batch": 16,

    "device": 0,  # GPU device index, e.g. 0 for RTX 3050 Ti, or 'cpu'
    "workers": 2,
}

# Default Pretrained Weights
DEFAULT_WEIGHTS = {
    "plate": "yolov8n.pt",
    "vehicle": "yolov8n.pt",
    "text": "yolov8n.pt",
}

# Project Output Directories
RUNS_DIR = os.path.join(BASE_DIR, "runs")
