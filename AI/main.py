import os
import cv2
import time
from src import config
from src.pipeline import LicensePlatePipeline

def main():
    print("==================================================")
    print("Lao License Plate OCR & Color Type Reader (Unified)")
    print("==================================================")
    
    # Instantiate the unified pipeline
    print("--> Loading YOLO models...")
    pipeline = LicensePlatePipeline()

    test_folder = config.TEST_IMAGE_DIR
    save_folder = config.OUTPUT_SAVE_DIR
    os.makedirs(save_folder, exist_ok=True)

    if not os.path.exists(test_folder):
        print(f"Error: test_image directory not found: {test_folder}")
        return

    # Scan test folder
    valid_ext = config.VALID_EXTENSIONS
    files = [f for f in os.listdir(test_folder) if f.lower().endswith(valid_ext)]
    print(f"--> Found {len(files)} test images in {test_folder}")

    t_start = time.time()

    for file in files:
        img_path = os.path.join(test_folder, file)
        print(f"\nProcessing image: {file}")
        t_img = time.time()

        img = cv2.imread(img_path)
        if img is None:
            print(f"Error: cannot read image: {file}")
            continue

        # Execute end-to-end pipeline processing
        results, annotated_img = pipeline.process_image(img)

        if results:
            print(f"   Detections count: {len(results)}")
            for res in results:
                print(f"   --- Plate {res['plate_index']} ---")
                print(f"      OCR (EN):  {res['ocr_en']}")
                print(f"      OCR (LAO): {res['ocr_lao']}")
                print(f"      Background Color: {res['bg_color']}")
                print(f"      Text Color:       {res['font_color']}")
                print(f"      Plate Type:       {res['plate_type']}")
                print(f"      Confidence:       {res['confidence']:.2f}")

            # Save visual results
            stem = os.path.splitext(file)[0]
            save_path = os.path.join(save_folder, f"color_ocr_result_{stem}.png")
            cv2.imwrite(save_path, annotated_img)
            print(f"   [Output] Saved result overlay to: {save_path}")
        else:
            print("   No plate or characters processed.")

        print(f"   Processed {file} in {time.time() - t_img:.3f}s")

    print(f"\n==================================================")
    print(f"All done in {time.time() - t_start:.3f}s")
    print("==================================================")


if __name__ == "__main__":
    main()
