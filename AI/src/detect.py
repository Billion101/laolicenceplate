from ultralytics import YOLO
import cv2
import os

# 1. Load the two-stage model pipeline
plate_model = YOLO("models/vehicle-plate/train_run-2/weights/best.pt") 
text_model = YOLO("models/plate-text/train_run/weights/best.pt")   

folder = "test_image" 
BASE_SAVE_DIR = "runs/two_stage_results_final" 
os.makedirs(BASE_SAVE_DIR, exist_ok=True)

for file in os.listdir(folder):
    if not file.lower().endswith((".jpg", ".jpeg", ".png")):
        continue

    img_path = os.path.join(folder, file)
    img = cv2.imread(img_path)
    if img is None: 
        continue

    print(f"Running Stage 1: Detecting license plate in {file}...")
    
    # [Hyperparameter Tuning] Lower confidence threshold to 0.18 
    # to improve recall on blue plates and white plates with blue text.
    plate_results = plate_model(img, conf=0.18, iou=0.3, verbose=False)
    plate_boxes = plate_results[0].boxes

    if len(plate_boxes) == 0:
        print(f"No license plate detected in {file}")
        continue

    for idx, box in enumerate(plate_boxes):
        xyxy = box.xyxy[0].cpu().numpy()
        xmin, ymin, xmax, ymax = map(int, xyxy)

        # [Accuracy Enhancement] Add 5-pixel padding around the cropped plate 
        # to prevent border clipping, allowing better character recognition near the edges.
        h, w, _ = img.shape
        xmin = max(0, xmin - 5)
        ymin = max(0, ymin - 5)
        xmax = min(w, xmax + 5)
        ymax = min(h, ymax + 5)

        cropped_plate = img[ymin:ymax, xmin:xmax]
        
        print(f"Plate {idx+1} located -> Forwarding to Lao OCR text model...")

        # [Hyperparameter Tuning] Raise character confidence to 0.35 to filter out false positives.
        # Set iou=0.3 for NMS (Non-Maximum Suppression) to clear overlapping bounding boxes (crucial for blue plates).
        text_results = text_model(cropped_plate, conf=0.35, iou=0.3, verbose=False)
        
        annotated_plate = text_results[0].plot()

        save_name = f"final_{os.path.splitext(file)[0]}_p{idx+1}.jpg"
        cv2.imwrite(os.path.join(BASE_SAVE_DIR, save_name), annotated_plate)

        cv2.imshow(f"Result Plate {idx+1}", annotated_plate)
        cv2.waitKey(0)

cv2.destroyAllWindows()