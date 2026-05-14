from pathlib import Path
import torch
from ultralytics import YOLO

BASE_DIR = Path(__file__).parent

def main():
    # 1. Load the base model (yolov8n.pt is recommended — lightweight and suitable for RTX 3050 Ti)
    model = YOLO(str(BASE_DIR / 'models' / 'yolov8n.pt'))

    # 2. Detect available device (GPU preferred, fallback to CPU)
    device = 0 if torch.cuda.is_available() else 'cpu'
    print(f'Using device: {"GPU (CUDA)" if device == 0 else "CPU"}')

    # 3. Start training
    model.train(
        data=str(BASE_DIR / 'dataset' / 'data.yaml'),  # path to the dataset YAML file
        epochs=100,          # number of training epochs (50–100 recommended to start)
        imgsz=640,           # input image size
        batch=16,            # batch size (16 or 32 recommended for RTX 3050 Ti)
        device=0,       # use GPU if available, otherwise CPU
        workers=2,            # number of CPU threads for data loading
    )

if __name__ == '__main__':
    main()