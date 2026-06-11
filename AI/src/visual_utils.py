import cv2
import numpy as np

def draw_text_utf8(img, text, position, font_size=20, color=(255, 255, 255)):
    """Draw UTF-8 text (like Lao script) using PIL on an OpenCV BGR image."""
    try:
        from PIL import Image, ImageDraw, ImageFont
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil_img)
        
        fonts_to_try = [
            "C:/Windows/Fonts/LaoUI.ttf",
            "C:/Windows/Fonts/dokchampa.ttf",
            "C:/Windows/Fonts/saysettha.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/tahoma.ttf",
            "msgothic.ttc"
        ]
        
        font = None
        for font_path in fonts_to_try:
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except IOError:
                continue
                
        if font is None:
            font = ImageFont.load_default()
            
        draw.text(position, text, font=font, fill=color)
        return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception:
        # Fallback to standard putText if PIL fails
        ascii_text = text.encode("ascii", "ignore").decode()
        cv2.putText(img, ascii_text, position, cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        return img


def draw_results_overlay(img, plate_box, text_en, text_lao, plate_style, bg_color_cv, font_color_cv, plate_type):
    """Draw a stylish overlay panel detailing license plate text, type, and colors."""
    annotated = img.copy()
    xmin, ymin, xmax, ymax = map(int, plate_box)
    
    # Select box color matching plate style
    box_color = (0, 255, 0) # Green default
    if "yellow" in plate_style.lower():
        box_color = (0, 255, 255) # Yellow
    elif "blue" in plate_style.lower():
        box_color = (255, 100, 0) # Blue
    elif "white" in plate_style.lower():
        box_color = (255, 255, 255) # White
    elif "black" in plate_style.lower():
        box_color = (40, 40, 40) # Dark grey for black
        
    # Draw bounding box
    cv2.rectangle(annotated, (xmin, ymin), (xmax, ymax), box_color, 3)
    
    # Draw a glassmorphism style card panel above or below the plate
    panel_h = 135
    panel_w = 420
    px1 = max(10, xmin)
    py1 = max(10, ymin - panel_h - 15)
    if py1 < 10:
        py1 = min(img.shape[0] - panel_h - 10, ymax + 15)
    
    px2 = min(img.shape[1] - 10, px1 + panel_w)
    py2 = py1 + panel_h
    
    # Translucent card background
    overlay = annotated.copy()
    cv2.rectangle(overlay, (px1, py1), (px2, py2), (15, 15, 15), -1)
    cv2.rectangle(overlay, (px1, py1), (px2, py2), box_color, 2)
    cv2.addWeighted(overlay, 0.82, annotated, 0.18, 0, annotated)
    
    # Render texts
    # Row 1: English OCR
    cv2.putText(annotated, f"OCR (EN): {text_en}", (px1 + 15, py1 + 25), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.60, (0, 255, 0), 2, cv2.LINE_AA)
    
    # Row 2: Lao OCR (Rendered via PIL)
    annotated = draw_text_utf8(annotated, f"OCR (LAO): {text_lao}", 
                               (px1 + 15, py1 + 40), font_size=16, color=(255, 255, 255))
    
    # Row 3: License Plate Type
    cv2.putText(annotated, f"Type: {plate_type}", (px1 + 15, py1 + 80), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2, cv2.LINE_AA)
    
    # Row 4: OpenCV HSV Color Analysis Output
    cv2.putText(annotated, f"BG Color: {bg_color_cv}", (px1 + 15, py1 + 102), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(annotated, f"Text Color: {font_color_cv}", (px1 + 220, py1 + 102), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1, cv2.LINE_AA)
    
    # Row 5: Footer
    cv2.putText(annotated, "Lao License Plate Color & OCR Unified System", (px1 + 15, py1 + 124), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.40, (120, 120, 120), 1, cv2.LINE_AA)
    
    return annotated
