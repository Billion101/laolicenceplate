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

## Requirements

- Python 3.10+
- NVIDIA GPU with CUDA 12.1 support (recommended: RTX 3050 Ti or better)
- CUDA Toolkit 12.1 — download from [developer.nvidia.com/cuda-downloads](https://developer.nvidia.com/cuda-downloads)

> **CPU fallback:** The training script will automatically fall back to CPU if no compatible GPU is found, but training will be significantly slower.

## Setup

### 1. Create and activate the virtual environment

```bash
cd AI
python -m venv .venv
# Windows
.venv\Scripts\activate
```

### 2. Install PyTorch with CUDA 12.1 support

This project uses GPU-accelerated training. Install the correct PyTorch build for CUDA 12.1:

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

> If you are using a different CUDA version, find the matching command at [pytorch.org/get-started/locally](https://pytorch.org/get-started/locally/).

### 3. Install remaining dependencies

```bash
pip install ultralytics
```

### 4. Verify GPU is detected

```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
```

Expected output on a CUDA-capable machine:
```
CUDA available: True
GPU: NVIDIA GeForce RTX 3050 Ti Laptop GPU
```

## Training

Run the training script from the `AI/` directory:

```bash
python train.py
```

The script automatically detects and uses a GPU (CUDA) if available, otherwise falls back to CPU. Training with a GPU is ~10–50x faster than CPU depending on hardware. Training results (weights, metrics, charts) are saved to `AI/runs/detect/train/`.

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
