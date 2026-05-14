# Lao License Plate Detection

A YOLOv8-based object detection project for detecting and classifying Lao vehicle license plates.

## Classes

| Class | Description |
|---|---|
| `plate-blue` | Blue plate |
| `plate-darkBlue-white-font` | Dark blue plate with white font |
| `plate-white` | White plate |
| `plate-white-blue-font` | White plate with blue font |
| `plate-yellow` | Yellow plate |

## Dataset

| Split | Images |
|---|---|
| Train | 843 |
| Valid | 81 |
| Test | 40 |

Source: [Roboflow — license-plate-mar58](https://universe.roboflow.com/test-mln3u/license-plate-mar58/dataset/1)

## Project Structure

```
laolicenceplate/
├── dataset/          # YOLO-format dataset (images + labels)
│   └── data.yaml
├── models/           # Pretrained weights
│   └── yolov8n.pt
├── runs/             # Training outputs (saved automatically)
├── train.py          # Training script
└── .venv/            # Python virtual environment
```

## Requirements

- Python 3.12
- ultralytics, torch, torchvision (installed via pip)

## Training

```bash
# Activate virtual environment
.venv\Scripts\activate

# Run training (100 epochs, GPU auto-detected)
python train.py
```

Training results are saved to `runs/detect/train*/`.

