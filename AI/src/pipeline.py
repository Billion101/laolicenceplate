import cv2
import numpy as np
import ultralytics.utils.checks
ultralytics.utils.checks.AUTOINSTALL = False
from ultralytics import YOLO
from . import config
from . import ocr_utils
from . import visual_utils

def _calculate_iou(box1, box2):
    """Calculate the Intersection over Union (IoU) of two bounding boxes."""
    x_left = max(box1[0], box2[0])
    y_top = max(box1[1], box2[1])
    x_right = min(box1[2], box2[2])
    y_bottom = min(box1[3], box2[3])

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union_area = float(box1_area + box2_area - intersection_area)
    
    return intersection_area / union_area if union_area > 0.0 else 0.0


class LicensePlatePipeline:
    """End-to-end processing pipeline for Lao license plate reading and classification."""
    
    def __init__(self, plate_model_path=None, text_model_path=None, vehicle_model_path=None, classifier_model_path=None):
        # Default to paths defined in config if not specified
        self.plate_model_path = plate_model_path or config.PLATE_MODEL_PATH
        self.text_model_path = text_model_path or config.TEXT_MODEL_PATH
        self.vehicle_model_path = vehicle_model_path or config.VEHICLE_MODEL_PATH
        self.classifier_model_path = classifier_model_path or config.CLASSIFIER_MODEL_PATH
        
        # Load YOLO models
        self.plate_model = YOLO(self.plate_model_path, task='detect')
        self.text_model  = YOLO(self.text_model_path, task='detect')
        self.vehicle_model = YOLO(self.vehicle_model_path, task='detect')
        self.classifier_model = YOLO(self.classifier_model_path, task='classify')
        
    def process_image(self, img):
        """
        Process the image hierarchically (detect cars, detect plates in cars, ocr/deskew)
        and return a list of dictionary results for detected plates along with the annotated BGR image.
        """
        h, w = img.shape[:2]
        
        # --- Stage 1: Vehicle Bounding Box Detection ---
        vehicle_boxes = self.vehicle_model(img, conf=config.VEHICLE_CONF, classes=config.VEHICLE_CLASSES, verbose=False)[0].boxes
        
        crops = []
        if vehicle_boxes:
            for v_idx, v_box in enumerate(vehicle_boxes):
                vx1 = max(0, int(v_box.xyxy[0][0]))
                vy1 = max(0, int(v_box.xyxy[0][1]))
                vx2 = min(w, int(v_box.xyxy[0][2]))
                vy2 = min(h, int(v_box.xyxy[0][3]))
                vehicle_crop = img[vy1:vy2, vx1:vx2]
                if vehicle_crop.size == 0:
                    continue
                
                # Detect plate inside the vehicle crop
                v_h, v_w = vehicle_crop.shape[:2]
                plate_boxes = self.plate_model(vehicle_crop, conf=config.PLATE_CONF_HIGH, iou=config.PLATE_IOU, verbose=False)[0].boxes
                if not plate_boxes:
                    plate_boxes = self.plate_model(vehicle_crop, conf=config.PLATE_CONF_LOW, iou=config.PLATE_IOU, verbose=False)[0].boxes
                
                for b in plate_boxes:
                    px1 = max(0, int(b.xyxy[0][0]) - config.PLATE_INITIAL_PADDING)
                    py1 = max(0, int(b.xyxy[0][1]) - config.PLATE_INITIAL_PADDING)
                    px2 = min(v_w, int(b.xyxy[0][2]) + config.PLATE_INITIAL_PADDING)
                    py2 = min(v_h, int(b.xyxy[0][3]) + config.PLATE_INITIAL_PADDING)
                    
                    cls_name = self.plate_model.names[int(b.cls[0])]
                    crops.append({
                        'box': (vx1 + px1, vy1 + py1, vx1 + px2, vy1 + py2),
                        'conf': float(b.conf[0]),
                        'style': cls_name,
                        'is_fallback': False,
                        'vehicle_crop': vehicle_crop,
                        'vehicle_box': (vx1, vy1, vx2, vy2)
                    })
        
        # Fallback to whole image plate scan if no vehicle plates are found
        if not crops:
            plate_boxes = self.plate_model(img, conf=config.PLATE_CONF_HIGH, iou=config.PLATE_IOU, verbose=False)[0].boxes
            if not plate_boxes:
                plate_boxes = self.plate_model(img, conf=config.PLATE_CONF_LOW, iou=config.PLATE_IOU, verbose=False)[0].boxes
            
            if plate_boxes:
                for b in plate_boxes:
                    xmin = max(0, int(b.xyxy[0][0]) - config.PLATE_INITIAL_PADDING)
                    ymin = max(0, int(b.xyxy[0][1]) - config.PLATE_INITIAL_PADDING)
                    xmax = min(w, int(b.xyxy[0][2]) + config.PLATE_INITIAL_PADDING)
                    ymax = min(h, int(b.xyxy[0][3]) + config.PLATE_INITIAL_PADDING)
                    
                    cls_name = self.plate_model.names[int(b.cls[0])]
                    crops.append({
                        'box': (xmin, ymin, xmax, ymax),
                        'conf': float(b.conf[0]),
                        'style': cls_name,
                        'is_fallback': False,
                        'vehicle_crop': img,
                        'vehicle_box': (0, 0, w, h)
                    })
            else:
                # Fallback to whole image if absolutely no plate detected
                crops.append({
                    'box': (0, 0, w, h),
                    'conf': 1.0,
                    'style': 'plate-white',
                    'is_fallback': True,
                    'vehicle_crop': img,
                    'vehicle_box': (0, 0, w, h)
                })

        # Remove duplicate plate crops representing the same physical license plate using IoU NMS
        if crops:
            crops = sorted(crops, key=lambda x: x['conf'], reverse=True)
            filtered_crops = []
            for c in crops:
                is_duplicate = False
                for kept in filtered_crops:
                    if _calculate_iou(c['box'], kept['box']) > 0.4:
                        is_duplicate = True
                        break
                if not is_duplicate:
                    filtered_crops.append(c)
            crops = filtered_crops

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

            # --- Stage 4: AI Plate Type Classification ---
            auto_cropped_rotated = ocr_utils.auto_crop_plate_by_chars(rotated, text_boxes)
            class_results = self.classifier_model(auto_cropped_rotated, conf=0.25, verbose=False)[0]
            class_id = class_results.probs.top1
            predicted_style = class_results.names[class_id]

            # Map the class output to human-readable Lao plate names
            class_mapping = {
                'private': 'Private License Plate',
                'state': 'State License Plate',
                'business_100': 'Business License Plate (100%)',
                'business_1': 'Business License Plate (1%)',
                'public': 'Public License Plate',
                'foreign': 'Foreign License Plate'
            }
            plate_type = class_mapping.get(predicted_style, "Unknown License Plate Type")

            # Map background color names for drawing overlays and logs
            bg_color_mapping = {
                'private': 'Yellow', 'state': 'Blue', 'public': 'Red',
                'business_100': 'White', 'business_1': 'White', 'foreign': 'Yellow'
            }
            bg_color = bg_color_mapping.get(predicted_style, "Unknown")

            font_color_mapping = {
                'private': 'Black', 'state': 'White', 'public': 'White',
                'business_100': 'Black', 'business_1': 'Blue', 'foreign': 'Blue'
            }
            font_color = font_color_mapping.get(predicted_style, "Unknown")

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
                'crop': auto_cropped_rotated,
                'vehicle_crop': crop_info['vehicle_crop'],
                'vehicle_box': crop_info['vehicle_box']
            })

            # Draw vehicle box boundary
            vx1, vy1, vx2, vy2 = crop_info['vehicle_box']
            if not crop_info['is_fallback'] and (vx2 - vx1) < w and (vy2 - vy1) < h:
                cv2.rectangle(annotated_img, (vx1, vy1), (vx2, vy2), (0, 255, 0), 2)
                cv2.putText(annotated_img, "Vehicle", (vx1, vy1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            # Draw license plate panel overlay
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