import os
from pathlib import Path
from ultralytics import YOLO
import config

def main():
    # ==========================================================================
    # 1. MODEL & DATASET CONFIGURATION
    # ==========================================================================
    # Target model selection (Switch keys between "plate" and "text" as needed)
    model_type = "text"  # Options: "plate", "vehicle", "text"
    
    # Initialize the YOLO model with pre-defined weights from config
    model_weights = config.DEFAULT_WEIGHTS[model_type]
    model = YOLO(model_weights) 

    # Construct the absolute path to the dataset configuration file (data.yaml)
    dataset_dir = config.DATASETS[model_type]
    data_yaml_path = os.path.join(dataset_dir, "data.yaml")

    print(f"[str] Initializing YOLO training pipeline for: [{model_type.upper()}]")
    print(f"[str] Using weights: {model_weights}")
    print(f"[str] Using dataset configuration: {data_yaml_path}\n")

    # ==========================================================================
    # 2. MODEL TRAINING PIPELINE
    # ==========================================================================
    # Start the training process using hyperparameters managed in config.py
    model.train(
        data=data_yaml_path,
        epochs=config.TRAIN_CONFIG["epochs"],
        imgsz=config.TRAIN_CONFIG["imgsz"],
        batch=config.TRAIN_CONFIG["batch"],
        device=config.TRAIN_CONFIG["device"],
        workers=config.TRAIN_CONFIG["workers"],
        project=config.MODELS[model_type],  # Target directory (e.g., models/text/)
        name="train_run"                    # Subfolder name for this training session
    )

if __name__ == '__main__':
    main()