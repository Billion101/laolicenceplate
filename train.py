from pathlib import Path
import torch
from ultralytics import YOLO

BASE_DIR = Path(__file__).parent

def main():
    # 1. โหลด Model เริ่มต้น (แนะนำ yolov8n.pt เพราะเบาและเหมาะกับ 3050 Ti)
    model = YOLO(str(BASE_DIR / 'models' / 'yolov8n.pt'))

    # ตรวจสอบ GPU
    device = 0 if torch.cuda.is_available() else 'cpu'
    print(f'Using device: {"GPU (CUDA)" if device == 0 else "CPU"}')

    # 2. สั่งเทรน
    model.train(
        data=str(BASE_DIR / 'dataset' / 'data.yaml'),  # ชื่อไฟล์ yaml ที่เราสร้างไว้
        epochs=100,          # เทรนกี่รอบ (ลอง 50-100 ก่อน)
        imgsz=640,           # ขนาดรูป
        batch=16,            # จำนวนรูปต่อการประมวลผล 1 ครั้ง (3050 Ti แนะนำ 16 หรือ 32)
        device=device,       # ใช้ GPU ถ้ามี หรือ CPU
        workers=2            # จำนวน CPU thread ที่ช่วยโหลดข้อมูล
    )

if __name__ == '__main__':
    main()