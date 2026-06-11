import cv2
import numpy as np
from collections import Counter
from . import config

def get_plate_type(bg_color, font_color):
    """Determine the Lao license plate type based on color combination rules."""
    plate_type = config.COLOR_COMBINATION_TO_PLATE_TYPE.get((bg_color, font_color))
    if plate_type:
        return plate_type
        
    bg = bg_color.lower()
    font = font_color.lower()
    
    # Loose match/fallbacks if color classification is slightly shifted
    if bg == "yellow" and font == "black":
        return "Private License Plate"
    elif bg == "white" and font == "black":
        return "Business License Plate (100%)"
    elif (bg == "blue" or bg == "dark blue") and font == "white":
        return "State License Plate"
    elif bg == "white" and font == "blue":
        return "Business License Plate (1%)"
    elif bg == "red" and font == "white":
        return "Public License Plate"
    elif bg == "yellow" and font == "blue":
        return "Foreign License Plate"
        
    # Broad background-only fallback defaults
    if bg == "yellow":
        return "Private License Plate"
    elif bg == "white":
        return "Business License Plate (100%)"
    elif bg in ["blue", "dark blue"]:
        return "State License Plate"
    elif bg == "red":
        return "Public License Plate"
    elif bg == "black":
        return "Business License Plate (1%)"
        
    return "Unknown License Plate Type"


def classify_hsv_color(h, s, v):
    """Classify an HSV pixel/color into human-readable Lao license plate colors."""
    # Black: very low brightness (Value)
    if v < 85:
        # Exception: if it's highly saturated blue, return Dark Blue
        if 90 <= h <= 145 and s >= 45:
            return "Dark Blue"
        return "Black"
        
    # White/Grey: low saturation (grey is just shaded white in license plates)
    if s < 60:
        if v >= 70:
            return "White"
        else:
            return "Black"
            
    # Yellow: Hue around 11 to 35, moderate saturation and brightness
    if 11 <= h <= 35 and s >= 50 and v >= 55:
        return "Yellow"
        
    # Blue / Dark Blue: Hue around 90 to 145, moderate-to-high saturation
    if 90 <= h <= 145 and s >= 40 and v >= 50:
        if v < 110:
            return "Dark Blue"
        else:
            return "Blue"
            
    # Red: Hue around 0-10 or 160-180
    if (0 <= h <= 10 or 160 <= h <= 180) and s >= 40 and v >= 50:
        return "Red"
            
    return "Unknown"


def analyze_plate_colors(plate_img, text_boxes):
    """
    Analyze the plate crop to dynamically determine the background color 
    and the font/letter color.
    """
    hsv = cv2.cvtColor(plate_img, cv2.COLOR_BGR2HSV)
    height, width = plate_img.shape[:2]

    # --- 1. Background Color Extraction ---
    # Crop the inner 84% to avoid brackets, plate frames, and dark border shadows
    border_y = int(height * 0.08)
    border_x = int(width * 0.08)
    inner_hsv = hsv[border_y:height-border_y, border_x:width-border_x]
    if inner_hsv.size == 0:
        inner_hsv = hsv

    bg_pixels = inner_hsv.reshape(-1, 3)

    # Calculate median HSV values for the background color
    bg_h = float(np.median(bg_pixels[:, 0]))
    bg_s = float(np.median(bg_pixels[:, 1]))
    bg_v = float(np.median(bg_pixels[:, 2]))
    bg_color = classify_hsv_color(bg_h, bg_s, bg_v)

    # --- 2. Font/Letter Color Extraction ---
    font_color_candidates = []
    
    for box in text_boxes:
        # Handle both dictionary character lists and YOLO Box formats
        if isinstance(box, dict):
            xmin, ymin, xmax, ymax = int(box['xmin']), int(box['ymin']), int(box['xmax']), int(box['ymax'])
        else:
            xyxy = box.xyxy[0].cpu().numpy()
            xmin, ymin, xmax, ymax = map(int, xyxy)
            
        xmin, ymin = max(0, xmin), max(0, ymin)
        xmax, ymax = min(width, xmax), min(height, ymax)
        
        char_hsv = hsv[ymin:ymax, xmin:xmax]
        if char_hsv.size == 0:
            continue
        
        char_pixels = char_hsv.reshape(-1, 3)
        
        # Segment character stroke pixels (foreground).
        # We take the 10% darkest pixels (for light backgrounds) or 10% brightest pixels (for dark backgrounds)
        if bg_color in ["White", "Yellow"]:
            v_vals = char_pixels[:, 2]
            thresh_idx = np.argsort(v_vals)[:max(1, len(v_vals) // 10)]
            stroke_pixels = char_pixels[thresh_idx]
        else:
            v_vals = char_pixels[:, 2]
            thresh_idx = np.argsort(v_vals)[-max(1, len(v_vals) // 10):]
            stroke_pixels = char_pixels[thresh_idx]
            
        if len(stroke_pixels) > 0:
            stroke_h = float(np.median(stroke_pixels[:, 0]))
            stroke_s = float(np.median(stroke_pixels[:, 1]))
            stroke_v = float(np.median(stroke_pixels[:, 2]))
            char_color = classify_hsv_color(stroke_h, stroke_s, stroke_v)
            font_color_candidates.append(char_color)

    # Get dominant font color using majority vote
    if font_color_candidates:
        valid_candidates = [c for c in font_color_candidates if c != "Unknown"]
        if not valid_candidates:
            valid_candidates = font_color_candidates
        font_color = Counter(valid_candidates).most_common(1)[0][0]
    else:
        # Logic fallbacks based on background color if OCR detected nothing
        if bg_color in ["White", "Yellow"]:
            font_color = "Black"
        elif bg_color in ["Blue", "Dark Blue"]:
            font_color = "White"
        elif bg_color == "Black":
            font_color = "Blue"
        elif bg_color == "Red":
            font_color = "White"
        else:
            font_color = "Unknown"

    return bg_color, font_color, (bg_h, bg_s, bg_v)
