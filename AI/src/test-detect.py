from pathlib import Path
from ultralytics import YOLO
import cv2

# 1. INITIALIZATION & CONFIGURATION

# Load pre-trained YOLO model for license plate detection
model = YOLO("models/plate-text/train_run/weights/best.pt")

# Define confidence thresholds for evaluation
CONF_THRESHOLDS = [0.01, 0.20, 0.40, 0.60, 0.80, 0.90, 0.95, 0.99]

# Define directory paths using pathlib for cleaner path manipulation
IMAGE_DIR = Path("test_image")
BASE_SAVE_DIR = Path("runs/detect")
BASE_SAVE_DIR.mkdir(parents=True, exist_ok=True)

# Filter and collect all valid image files in the directory
image_extensions = {".jpg", ".jpeg", ".png"}
image_files = [f for f in IMAGE_DIR.iterdir() if f.suffix.lower() in image_extensions]

print(f"--> Found {len(image_files)} images to process.")

# 2. MAIN PROCESSING LOOP
for img_path in image_files:
    print(f"\n" + "="*50)
    print(f"Processing Image: {img_path.name}")
    print("="*50)

    # Read image once per file to optimize performance
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"Error: Failed to read image {img_path.name}")
        continue

    # Create a subfolder named after the image (without extension)
    output_subdir = BASE_SAVE_DIR / img_path.stem
    output_subdir.mkdir(parents=True, exist_ok=True)

    # Evaluate the image against each confidence threshold
    for conf_val in CONF_THRESHOLDS:
        print(f"Testing Confidence Threshold: {conf_val}")

        # Run inference using the pre-loaded image array
        results = model(img, conf=conf_val, verbose=False)
        boxes = results[0].boxes
        print(f"   -> Total detections found: {len(boxes)}")

        # Log detailed detection info
        for i, box in enumerate(boxes):
            cls_id = int(box.cls[0])
            conf_score = float(box.conf[0])
            class_name = model.names[cls_id]
            print(f"      [{i+1}] {class_name} | Confidence: {conf_score:.4f}")

        # Render bounding boxes and labels onto the image
        annotated_img = results[0].plot()

        # Save the annotated result
        save_path = output_subdir / f"conf_{conf_val:.2f}.jpg"
        cv2.imwrite(str(save_path), annotated_img)
        print(f"Saved: {save_path}")

        # Display the result (Reuses the same window per image to prevent desktop clutter)
        window_name = f"Evaluation: {img_path.stem}"
        cv2.imshow(window_name, annotated_img)
        
        # Wait for a key press before moving to the next threshold
        cv2.waitKey(0)

# Clean up all UI windows after completing the experiment
cv2.destroyAllWindows()
print("All experiments completed successfully!")