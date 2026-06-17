import cv2
import numpy as np
from ultralytics import YOLO
from . import config
from . import ocr_utils
from . import color_utils
from . import visual_utils

class LicensePlatePipeline:
    """End-to-end processing pipeline for Lao license plate reading and classification."""
    
    def __init__(self, plate_model_path=None, text_model_path=None):
        # Default to paths defined in config if not specified
        self.plate_model_path = plate_model_path or config.PLATE_MODEL_PATH
        self.text_model_path = text_model_path or config.TEXT_MODEL_PATH
        
        # Load YOLO models
        self.plate_model = YOLO(self.plate_model_path, task='detect')
        self.text_model  = YOLO(self.text_model_path, task='detect')
        
    def process_image(self, img):
        """
        Process the image and return a list of dictionary results for detected plates
        along with the annotated BGR image.
        """
        h, w = img.shape[:2]
        
        # --- Stage 1: Plate Bounding Box Detection ---
        plate_boxes = self.plate_model(img, conf=config.PLATE_CONF_HIGH, iou=config.PLATE_IOU, verbose=False)[0].boxes
        if not plate_boxes:
            plate_boxes = self.plate_model(img, conf=config.PLATE_CONF_LOW, iou=config.PLATE_IOU, verbose=False)[0].boxes

        crops = []
        if plate_boxes:
            for b in plate_boxes:
                xmin = max(0, int(b.xyxy[0][0]) - 5)
                ymin = max(0, int(b.xyxy[0][1]) - 5)
                xmax = min(w, int(b.xyxy[0][2]) + 5)
                ymax = min(h, int(b.xyxy[0][3]) + 5)
                cls_name = self.plate_model.names[int(b.cls[0])]
                crops.append({
                    'box': (xmin, ymin, xmax, ymax),
                    'conf': float(b.conf[0]),
                    'style': cls_name,
                    'is_fallback': False
                })
        else:
            # Fallback to whole image if no plate is detected
            crops.append({
                'box': (0, 0, w, h),
                'conf': 1.0,
                'style': 'plate-white',
                'is_fallback': True
            })

        results = []
        annotated_img = img.copy()

        for idx, crop_info in enumerate(crops):
            xmin, ymin, xmax, ymax = crop_info['box']
            crop = img[ymin:ymax, xmin:xmax]
            
            # --- Stage 2: Deskew and Character Detection ---
            rotated, text_results = ocr_utils.find_best_rotation_and_ocr(crop, self.text_model)
            text_boxes = text_results[0].boxes

            # Adaptive low-confidence retry if characters are missing
            if len(text_boxes) < config.MIN_CHARS:
                text_results = self.text_model(rotated, conf=config.OCR_CONF_RETRY, iou=config.OCR_IOU,
                                              agnostic_nms=True, verbose=False)
                text_boxes = text_results[0].boxes

            if not text_boxes:
                continue

            # --- Stage 3: OCR Text Reconstruction ---
            text_en, text_lao, chars = ocr_utils.reconstruct_plate_text(text_boxes, self.text_model.names)

            # --- Stage 4: Color Analysis ---
            bg_color, font_color, bg_hsv = color_utils.analyze_plate_colors(rotated, chars)

            # Determine Lao license plate type based on color rules
            plate_type = color_utils.get_plate_type(bg_color, font_color)

            # Save result dictionary
            results.append({
                'plate_index': idx + 1,
                'box': (xmin, ymin, xmax, ymax),
                'confidence': crop_info['conf'],
                'style': crop_info['style'],
                'ocr_en': text_en,
                'ocr_lao': text_lao,
                'bg_color': bg_color,
                'font_color': font_color,
                'plate_type': plate_type,
                'is_fallback': crop_info['is_fallback'],
                'crop': rotated
            })

            # Draw visual overlay on image
            annotated_img = visual_utils.draw_results_overlay(
                annotated_img,
                (xmin, ymin, xmax, ymax),
                text_en,
                text_lao,
                crop_info['style'],
                bg_color,
                font_color,
                plate_type
            )

        return results, annotated_img