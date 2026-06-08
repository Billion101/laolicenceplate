# Lao License Plate Detection & OCR System

ระบบตรวจจับป้ายทะเบียน (YOLOv8 สองขั้นตอน) — โครงงานสำหรับฝึกและทดสอบการตรวจจับป้ายทะเบียนลาวและการอ่านข้อความ (OCR)

### 🎯 วัตถุประสงค์
ระบบนี้ทำงานเป็น **สองขั้นตอน**:
1. **Stage 1 (Vehicle-Plate Detection)**: ตรวจจับและแยกแผ่นป้ายทะเบียนจากรูปภาพ
2. **Stage 2 (Plate-Text OCR)**: อ่านข้อความตัวอักษรและตัวเลขบนป้ายทะเบียน

### 📁 ไฟล์หลักและบทบาท
| ไฟล์ | วัตถุประสงค์ |
|------|-----------|
| [config.py](config.py) | ตั้งค่าพาธ dataset, พาธ models, และพารามิเตอร์การฝึก |
| [train.py](train.py) | สคริปต์ฝึกโมเดล (เลือก model_type เป็น `text` หรือ `plate`) |
| [src/detect.py](src/detect.py) | สคริปต์ inference สองขั้นตอน (ตรวจจับ + OCR) |
| `datasets/` | ข้อมูล training ที่มี structure: `train/`, `valid/`, `test/` |
| `models/` | เก็บไฟล์ weights ที่ฝึก (.pt files) |
| `test_image/` | โฟลเดอร์สำหรับวางรูปตัวอย่างเพื่อทดสอบ |

---

## 🔧 ขั้นตอนติดตั้ง (Windows PowerShell)

### 1️⃣ สร้างและเปิดใช้งาน Virtual Environment

```powershell
# เข้าไปยังโฟลเดอร์ AI
cd AI

# สร้าง virtual environment
python -m venv .venv

# อนุญาตให้รัน PowerShell scripts (ครั้งเดียว)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# เปิดใช้งาน virtual environment
.venv\Scripts\Activate.ps1
```

✅ **ตรวจสอบ**: หลังเปิด virtual environment ต้องเห็น `(.venv)` ที่หน้า prompt

### 2️⃣ อัพเดต pip และติดตั้ง Dependencies

```powershell
# อัพเดต pip ให้เป็นเวอร์ชันล่าสุด
pip install -U pip

# ติดตั้ง libraries หลัก
pip install ultralytics torch torchvision opencv-python pyyaml
```

**ไลบรารี่ที่ต้อง**:
- `ultralytics` — YOLOv8 library
- `torch` — PyTorch (GPU/CPU tensor computation)
- `torchvision` — image processing utilities
- `opencv-python` — image I/O และ visualization
- `pyyaml` — parsing dataset configuration files

### 3️⃣ ตรวจสอบการติดตั้ง

```powershell
# ตรวจสอบ Python version (ต้องเป็น 3.7 ขึ้นไป)
python --version

# ตรวจสอบ PyTorch installation
python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'GPU available: {torch.cuda.is_available()}')"

# ตรวจสอบ OpenCV
python -c "import cv2; print(f'OpenCV version: {cv2.__version__}')"

# ตรวจสอบ Ultralytics
python -c "from ultralytics import YOLO; print('Ultralytics imported successfully')"
```

---

## 📊 โครงสร้าง Dataset
โปรเจคต้องการข้อมูลในรูปแบบ **YOLO format** สำหรับทั้งสองโมเดล

### โครงสร้างสำหรับ Vehicle-Plate Detection
```
datasets/
  vehicle-plate/
    data.yaml
    train/
      images/      (รูปภาพ .jpg/.png)
      labels/      (ไฟล์ .txt ในรูปแบบ YOLO)
    valid/
      images/
      labels/
    test/
      images/
      labels/
```

### โครงสร้างสำหรับ Plate-Text OCR
```
datasets/
  plate-text/
    data.yaml
    train/
      images/      (ตัดเฉพาะส่วนป้าย)
      labels/      (เทกซ์บาวนด์บ็อกส์รอบตัวอักษร)
    valid/
      images/
      labels/
    test/
      images/
      labels/
```

### การตรวจสอบ data.yaml

**ตัวอย่าง** `datasets/vehicle-plate/data.yaml`:
```yaml
path: C:/path/to/laolicenceplate/AI/datasets/vehicle-plate  # ใช้ full path หรือ relative path
train: train/images
val: valid/images
test: test/images

nc: 1           # จำนวน classes (vehicle-plate มี 1 class คือ "plate")
names: ['plate']  # ชื่อ classes
```

**ตัวอย่าง** `datasets/plate-text/data.yaml`:
```yaml
path: C:/path/to/laolicenceplate/AI/datasets/plate-text
train: train/images
val: valid/images
test: test/images

nc: 36          # จำนวน characters (0-9, a-z, etc.)
names: ['0','1','2','3','4','5','6','7','8','9','a','b','c',...] 
```

---

## 🏋️ การฝึกโมเดล (Training)

### ขั้นตอน 1: ตั้งค่า config.py

เปิดไฟล์ [config.py](config.py) และปรับพารามิเตอร์ตามต้องการ:

```python
# ตั้งค่าการฝึก
TRAIN_CONFIG = {
    "epochs": 100,       # จำนวน epoch (1 epoch = 1 รอบผ่านทั้ง dataset)
    "imgsz": 640,        # ขนาดรูปที่ feed เข้า model (640x640)
    "batch": 16,         # จำนวนรูปต่อ batch (ลดลงถ้า GPU memory เพียงพอ)
    "device": 0,         # GPU device: 0 = GPU แรก, 'cpu' = CPU
    "workers": 2,        # จำนวน worker threads สำหรับ data loading
}
```

**คำแนะนำ**:
- ถ้า GPU memory น้อย → ลดค่า `batch` ลง (8 หรือ 4)
- ถ้าใช้ CPU → ตั้ง `device: 'cpu'` (จะช้าแต่ใช้ได้)
- ถ้า GPU ไม่ติดตั้ง → ตั้ง `device: 'cpu'` และลดค่า `epochs` (เช่น 20)

### ขั้นตอน 2: รันการฝึก

```powershell
# เปิด virtual environment ก่อน (ถ้ายังไม่ได้เปิด)
.venv\Scripts\Activate.ps1

# รัน training script
python train.py
```

**ระหว่างการฝึก** จะเห็น:
- ความคืบหน้า: `Epoch 1/100: 100%|████████| 50/50 [00:25<00:00, 2.0s/it]`
- ค่า loss และ accuracy
- ผลลัพธ์ตัวอย่างทั้งหมด

### ขั้นตอน 3: ตรวจสอบผลลัพธ์

หลังการฝึกเสร็จ ไฟล์ weights จะถูกบันทึกที่:

```
models/<model_type>/train_run/weights/
  ├── best.pt      ← ใช้ไฟล์นี้สำหรับ inference (best validation accuracy)
  └── last.pt      ← last checkpoint (ถ้าต้องการ resume)
```

สิ่งอื่น ๆ ที่บันทึกเพิ่มเติม:
```
models/<model_type>/train_run/
  ├── args.yaml    (hyperparameters ที่ใช้)
  ├── results.csv  (metrics ต่อ epoch)
  └── weights/
```

---

## 🔍 การตรวจจับ (Inference / Two-Stage Detection)

### ขั้นตอน 1: เตรียมรูปภาพทดสอบ

1. วางรูปภาพทดสอบ (.jpg, .jpeg, .png) ไว้ใน `test_image/` โฟลเดอร์
2. รูปต้องมีรถและป้ายทะเบียน

```
test_image/
  ├── sample_plate_1.jpg
  ├── sample_plate_2.jpg
  └── ...
```

### ขั้นตอน 2: เตรียมไฟล์ weights

ตรวจสอบให้แน่ใจว่ามี weights files ที่ถูกต้อง:

```powershell
# ตรวจสอบโครงสร้าง models folder
Get-ChildItem models -Recurse -Include "best.pt"
```

ต้องเห็นผลลัพธ์:
```
models/vehicle-plate/train_run-2/weights/best.pt   ← Stage 1
models/plate-text/train_run/weights/best.pt        ← Stage 2
```

ถ้าไม่มี → ฝึกโมเดลก่อน (ดู section "การฝึกโมเดล")

### ขั้นตอน 3: เปิด src/detect.py และตรวจสอบพาธ

ไฟล์ [src/detect.py](src/detect.py) ได้กำหนดให้แล้ว:

```python
# Stage 1: ตรวจจับป้ายทะเบียน
plate_model = YOLO("models/vehicle-plate/train_run3/weights/best.pt")

# Stage 2: อ่านข้อความ
text_model = YOLO("models/plate-text/train_run/weights/best.pt")
```

ถ้าโฟลเดอร์แตกต่างจากโค้ด → อัพเดตชื่อโฟลเดอร์ให้ตรงกับ `models/` ที่มีจริง

### ขั้นตอน 4: รันการตรวจจับ

```powershell
# เปิด virtual environment
.venv\Scripts\Activate.ps1

# รัน detection script
python src/detect.py
```

**ผลลัพธ์**:
- จะแสดงหน้าต่าง OpenCV สำหรับรูปแต่ละแผ่นป้าย
- ตัวอักษรและตัวเลขจะถูกทำให้ highlight
- ผลลัพธ์ images บันทึกไว้ที่ `runs/two_stage_results_final/`

**ตัวอย่างชื่อไฟล์ผลลัพธ์**:
```
runs/two_stage_results_final/
  ├── final_sample_plate_1_p1.jpg   (Plate 1 ของรูป 1)
  ├── final_sample_plate_1_p2.jpg   (Plate 2 ของรูป 1)
  └── final_sample_plate_2_p1.jpg   (Plate 1 ของรูป 2)
```

---

## ⚙️ Hyperparameter Tuning Guide

### Stage 1: Vehicle-Plate Detection (src/detect.py)

```python
plate_results = plate_model(img, conf=0.18, iou=0.3, verbose=False)
```

| Parameter | ค่าปัจจุบัน | ความหมาย | เมื่อปรับค่า |
|-----------|----------|---------|----------|
| `conf` | 0.18 | ความมั่นใจของ detection (0.0 - 1.0) | ↓ เพิ่ม recall (หาป้ายมากขึ้น) แต่อาจ false positive ↑ ลด false positive แต่อาจพลาดป้าย |
| `iou` | 0.3 | Non-Maximum Suppression threshold | ↓ ลบ overlapping boxes มากขึ้น (ใช้สำหรับป้ายสีน้ำเงิน) ↑ เก็บ overlapping boxes มากขึ้น |

### Stage 2: Plate-Text OCR (src/detect.py)

```python
text_results = text_model(cropped_plate, conf=0.35, iou=0.3, verbose=False)
```

| Parameter | ค่าปัจจุบัน | ความหมาย | เมื่อปรับค่า |
|-----------|----------|---------|----------|
| `conf` | 0.35 | ความมั่นใจของการจดจำตัวอักษร | ↓ อ่านตัวอักษรมากขึ้น (อาจผิด) ↑ ลบ false positives แต่อาจพลาด |
| `iou` | 0.3 | ลบ bounding boxes ที่ซ้อนทับ | ↓ ลบซ้อนทับมากขึ้น (ป้ายน้ำเงินต้องใช้) ↑ เก็บซ้อนทับมากขึ้น |

**การปรับแนะนำ**:
- ป้ายสีน้ำเงิน (ปัญหา overlapping) → ลดค่า `iou` ลง (0.2 - 0.25)
- ป้ายเบลอ/มืด → ลดค่า `conf` ลง (0.1 - 0.15)
- false positives หลาย → เพิ่มค่า `conf` ขึ้น (0.4 - 0.5)

---

## ❌ การแก้ไขปัญหา

### ❓ ปัญหา: GPU ไม่ทำงาน / ใช้ CPU แทน

**สาเหตุ**:
- ไม่ติดตั้ง CUDA / GPU drivers
- ค่า `device` ผิด

**วิธีแก้**:
1. ตรวจสอบ GPU:
   ```powershell
   python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name())"
   ```
   ถ้า output `False` → ใช้ CPU ได้

2. ตั้ง device เป็น CPU ใน `config.py`:
   ```python
   "device": 'cpu'
   ```

3. ลดค่า `epochs` และ `batch` (training จะช้า แต่ใช้ได้)

---

### ❓ ปัญหา: "ModuleNotFoundError: No module named 'ultralytics'"

**สาเหตุ**: ไม่ได้เปิด virtual environment หรือติดตั้ง package ไม่ถูก

**วิธีแก้**:
```powershell
# เปิด virtual environment
.venv\Scripts\Activate.ps1

# ติดตั้งใหม่
pip install ultralytics
```

---

### ❓ ปัญหา: "FileNotFoundError: .../data.yaml"

**สาเหตุ**: ไฟล์ `data.yaml` หา path ไม่เจอ

**วิธีแก้**:
1. ตรวจสอบโครงสร้างโฟลเดอร์:
   ```powershell
   ls datasets/vehicle-plate/    # ควรเห็น data.yaml
   ls datasets/plate-text/       # ควรเห็น data.yaml
   ```

2. ตรวจสอบ `data.yaml` ให้ `path:` ชี้ถูก:
   ```yaml
   path: C:/full/path/to/laolicenceplate/AI/datasets/vehicle-plate
   ```

---

### ❓ ปัญหา: "FileNotFoundError" ไฟล์ weights ไม่เจอ

**สาเหตุ**: ชื่อโฟลเดอร์ใน `src/detect.py` ไม่ตรงกับ `models/` จริง

**วิธีแก้**:
1. ตรวจสอบโครงสร้าง models:
   ```powershell
   ls models/
   ls models/vehicle-plate/
   ls models/plate-text/
   ```

2. ดูชื่อ train run ที่มีจริง:
   ```powershell
   ls models/vehicle-plate/
   # อาจเห็น: train_run, train_run-2, train_run3 เป็นต้น
   ```

3. อัพเดต `src/detect.py` ให้ตรงกับชื่อจริง:
   ```python
   plate_model = YOLO("models/vehicle-plate/train_run-2/weights/best.pt")  # ตัวอย่าง
   ```

---

### ❓ ปัญหา: "CUDA out of memory"

**สาเหตุ**: Batch size ใหญ่เกินสำหรับ GPU

**วิธีแก้**:
ลดค่า batch ใน `config.py`:
```python
TRAIN_CONFIG = {
    ...
    "batch": 8,  # ลดจาก 16 เป็น 8
    ...
}
```

---

### ❓ ปัญหา: ตรวจจับป้ายไม่ได้ / false negatives หลาย

**สาเหตุ**: 
- Model ฝึกไม่ดี
- ความมั่นใจ (`conf`) สูงเกินไป
- ข้อมูล training ไม่สมดุล

**วิธีแก้**:
1. ลดค่า `conf` ใน `src/detect.py`:
   ```python
   plate_results = plate_model(img, conf=0.10, iou=0.3, verbose=False)  # ลดจาก 0.18
   ```

2. ฝึก epoch มากขึ้น:
   ```python
   "epochs": 200  # ใน config.py
   ```

3. เพิ่มข้อมูล training และตรวจสอบ data.yaml ให้ถูกต้อง

---

### ❓ ปัญหา: OCR ข้อความไม่ถูก / false positives

**สาเหตุ**:
- โมเดล OCR ต้องฝึกเพิ่มเติม
- การ crop ป้าย ไม่ดีพอ (border clipping)
- ความมั่นใจสำหรับ OCR ต่ำเกินไป

**วิธีแก้**:
1. เพิ่มค่า `conf` สำหรับ OCR:
   ```python
   text_results = text_model(cropped_plate, conf=0.50, iou=0.3, verbose=False)  # ขึ้นจาก 0.35
   ```

2. ปรับค่า padding เมื่อ crop:
   ```python
   xmin = max(0, xmin - 10)  # เพิ่ม padding จาก 5 เป็น 10
   ```

3. ตรวจสอบ `results.csv` ใน `models/plate-text/train_run/` เพื่อดูว่า model มี accuracy ดีไหม

---

## 📝 Notes สำคัญ

1. **ลำดับการรัน**: ต้องฝึก Stage 1 และ Stage 2 ก่อนจึงจะ inference ได้
2. **Path issue**: ถ้า path error → ใช้ absolute path ใน `data.yaml` และ `src/detect.py`
3. **GPU Support**: หากติดตั้ง CUDA + GPU drivers ถูก training จะเร็วขึ้นมาก
4. **Dataset Balance**: ข้อมูล train/valid/test ต้องมีการแยก อย่าให้ข้อมูลเดียวกันใน train + test

---

## 🚀 Quick Start Reference

```powershell
# 1. เปิด venv
.venv\Scripts\Activate.ps1

# 2. ฝึก Stage 1 (detect plates)
python train.py  # edit config: model_type = "plate"

# 3. ฝึก Stage 2 (OCR text)
python train.py  # edit config: model_type = "text"

# 4. ทดสอบ
python src/detect.py

# ผลลัพธ์ดูที่: runs/two_stage_results_final/
```

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
