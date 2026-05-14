# Lao License Plate Detection

A YOLOv8-based object detection project for recognizing and classifying Lao license plates from images or video.

## Project Structure

```
laolicenceplate/
├── AI/
│   ├── .venv/                   # Python virtual environment (project-specific)
│   ├── dataset/
│   │   ├── data.yaml            # Dataset configuration (paths, class names)
│   │   ├── train/               # Training split
│   │   │   ├── images/          # Training images
│   │   │   └── labels/          # YOLO-format annotation files
│   │   ├── valid/               # Validation split
│   │   │   ├── images/
│   │   │   └── labels/
│   │   └── test/                # Test split
│   │       ├── images/
│   │       └── labels/
│   ├── models/
│   │   ├── yolov8n.pt           # Pre-trained YOLOv8 nano base weights
│   │   └── yolo26n.pt           # Alternative base weights
│   ├── runs/
│   │   └── detect/              # Training output (saved automatically by YOLO)
│   │       └── train/           # Model weights, metrics, and charts per run
│   ├── src/
│   │   └── detect.py            # Inference script (run detection on images/video)
│   └── train.py                 # Training script (fine-tune the model on the dataset)
└── README.md
```

## Classes

The model is trained to detect 5 license plate types:

| Class Index | Label |
|---|---|
| 0 | `plate-blue` |
| 1 | `plate-darkBlue-white-font` |
| 2 | `plate-white` |
| 3 | `plate-white-blue-font` |
| 4 | `plate-yellow` |

## Setup

### 1. Create and activate the virtual environment

```bash
cd AI
python -m venv .venv
# Windows
.venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install torch ultralytics
```

## Training

Run the training script from the `AI/` directory:

```bash
python train.py
```

The script automatically detects and uses a GPU (CUDA) if available, otherwise falls back to CPU. Training results (weights, metrics, charts) are saved to `AI/runs/detect/train/`.

## Inference

Run detection on an image or video using a trained model:

```bash
python src/detect.py --model runs/detect/train/weights/best.pt --source path/to/image.jpg
```

### Arguments

| Argument | Required | Description |
|---|---|---|
| `--model` | Yes | Path to trained `.pt` weights file |
| `--source` | Yes | Path to an image, folder, or video file |
| `--output` | No | Output directory (default: `runs/detect/predict`) |
| `--show` | No | Display results after detection |

## Dataset

Dataset sourced from [Roboflow Universe](https://universe.roboflow.com/test-mln3u/license-plate-mar58/dataset/1) under CC BY 4.0.
