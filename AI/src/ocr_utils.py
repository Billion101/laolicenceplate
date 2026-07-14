import cv2
import numpy as np
from . import config

def boxes_to_dicts(boxes, names):
    """Convert ultralytics Boxes to a list of plain dicts."""
    result = []
    for box in boxes:
        xyxy = box.xyxy[0].cpu().numpy()
        xmin, ymin, xmax, ymax = map(float, xyxy)
        result.append({
            'xmin': xmin, 'ymin': ymin, 'xmax': xmax, 'ymax': ymax,
            'y_center': (ymin + ymax) / 2.0,
            'class': names[int(box.cls[0])],
            'conf': float(box.conf[0]),
        })
    return result


def nms_by_overlap(boxes, iou_thresh=0.6, iom_thresh=0.8):
    """Remove duplicate boxes using IoU / IoM thresholds (confidence-first)."""
    boxes = sorted(boxes, key=lambda b: b['conf'], reverse=True)
    kept = []
    for box in boxes:
        bw = box['xmax'] - box['xmin']
        bh = box['ymax'] - box['ymin']
        box_area = bw * bh
        duplicate = False
        for k in kept:
            xi1 = max(box['xmin'], k['xmin']); yi1 = max(box['ymin'], k['ymin'])
            xi2 = min(box['xmax'], k['xmax']); yi2 = min(box['ymax'], k['ymax'])
            inter = max(0.0, xi2 - xi1) * max(0.0, yi2 - yi1)
            k_area = (k['xmax'] - k['xmin']) * (k['ymax'] - k['ymin'])
            union = box_area + k_area - inter
            if (inter / union > iou_thresh if union > 0 else False) or \
               (inter / min(box_area, k_area) > iom_thresh if min(box_area, k_area) > 0 else False):
                duplicate = True
                break
        if not duplicate:
            kept.append(box)
    return kept


def group_into_lines(boxes, overlap_ratio_thresh=0.4):
    """Group boxes into text lines based on vertical overlap."""
    lines = []
    for box in sorted(boxes, key=lambda b: b['xmin']):
        placed = False
        for line in lines:
            ref = line[0]
            overlap = min(box['ymax'], ref['ymax']) - max(box['ymin'], ref['ymin'])
            min_h = min(box['ymax'] - box['ymin'], ref['ymax'] - ref['ymin'])
            if min_h > 0 and overlap / min_h > overlap_ratio_thresh:
                line.append(box)
                placed = True
                break
        if not placed:
            lines.append([box])
    lines.sort(key=lambda line: sum(b['y_center'] for b in line) / len(line))
    return lines


def correct_context(line):
    """Replace letters in digit positions and vice-versa based on spatial grouping."""
    # Filter out province names to focus only on letters/digits
    chars_only = [box for box in line if box['class'] not in config.LAO_PROVINCE_MAP]
    if not chars_only:
        return line
        
    n = len(chars_only)
    
    # We want to find the transition index from letter zone to digit zone in chars_only.
    best_s = min(2, n)
    best_penalty = 99999.0
    
    min_s = max(0, n - 4)
    max_s = min(2, n)
    
    for s in range(min_s, max_s + 1):
        penalty = 0.0
        for idx, box in enumerate(chars_only):
            cls = box['class']
            
            # Definite properties
            is_def_digit = cls.isdigit() and (cls not in config.DIGIT_TO_LETTER)
            is_def_letter = (not cls.isdigit()) and (cls not in config.LETTER_TO_DIGIT)
            
            if idx < s:  # Letter zone
                if is_def_digit:
                    penalty += 10.0
                elif cls.isdigit():
                    penalty += 1.5
            else:  # Digit zone
                if is_def_letter:
                    penalty += 10.0
                elif not cls.isdigit():
                    penalty += 1.5
                    
        # Bias: standard Lao plate has 2 letters and 4 digits if n=6.
        if n == 6 and s == 2:
            penalty -= 0.1
        elif n == 5 and s == 1:
            penalty -= 0.05
        elif n == 5 and s == 2:
            penalty -= 0.05
            
        if penalty < best_penalty:
            best_penalty = penalty
            best_s = s
            
    # Apply corrections to the original line boxes based on whether their chars_only index is in digit zone
    for idx, box in enumerate(chars_only):
        cls = box['class']
        in_digit_zone = (idx >= best_s)
        
        if in_digit_zone and not cls.isdigit() and cls in config.LETTER_TO_DIGIT:
            box['class'] = config.LETTER_TO_DIGIT[cls]
        elif not in_digit_zone and cls.isdigit() and cls in config.DIGIT_TO_LETTER:
            box['class'] = config.DIGIT_TO_LETTER[cls]
            
    return line


def fix_lookalike_pair(letters):
    """If two letters are lookalikes, pick the higher-confidence one for both."""
    if len(letters) != 2:
        return letters
    c1, c2 = letters[0]['class'], letters[1]['class']
    if c1 == c2:
        return letters
    for group in config.LOOKALIKE_GROUPS:
        if {c1, c2} == group:
            winner = c1 if letters[0]['conf'] >= letters[1]['conf'] else c2
            letters[0]['class'] = letters[1]['class'] = winner
            break
    return letters


def _placeholder(ref, xmin, xmax):
    return {'xmin': xmin, 'ymin': ref['ymin'], 'xmax': xmax, 'ymax': ref['ymax'],
            'y_center': ref['y_center'], 'class': '?', 'conf': 0.0}


def fill_digit_gaps(letters, digits):
    """Insert '?' placeholders for missing digits to achieve a 4-digit layout."""
    if not digits:
        return letters, digits

    digits.sort(key=lambda b: b['xmin'])
    avg_w = sum(b['xmax'] - b['xmin'] for b in digits) / len(digits)

    # Missing letter prefix
    if len(letters) == 1:
        dist = (digits[0]['xmin'] + digits[0]['xmax']) / 2 - \
               (letters[0]['xmin'] + letters[0]['xmax']) / 2
        if dist > 2.0 * avg_w:
            letters.append(_placeholder(letters[0],
                                         letters[0]['xmax'] + 5,
                                         letters[0]['xmax'] + avg_w + 5))

    # Internal gaps
    filled = []
    for i, d in enumerate(digits):
        filled.append(d)
        if i < len(digits) - 1:
            dist = (digits[i + 1]['xmin'] + digits[i + 1]['xmax']) / 2 - \
                   (d['xmin'] + d['xmax']) / 2
            n_missing = int(round(dist / avg_w)) - 1
            if dist > 1.7 * avg_w:
                for s in range(n_missing):
                    filled.append(_placeholder(d,
                                               d['xmax'] + s * avg_w + 5,
                                               d['xmax'] + (s + 1) * avg_w + 5))

    # Boundary gaps to ensure 4 digits
    needed = 4 - len(filled)
    if needed > 0:
        if letters:
            last_letter = max(letters, key=lambda b: b['xmax'])
            gap_before = filled[0]['xmin'] - last_letter['xmax']
            ref = filled[0]
            if gap_before > 1.5 * avg_w:
                for s in range(needed):
                    filled.insert(0, _placeholder(ref,
                                                   last_letter['xmax'] + s * avg_w + 5,
                                                   last_letter['xmax'] + (s + 1) * avg_w + 5))
            else:
                for s in range(needed):
                    filled.append(_placeholder(filled[-1],
                                               filled[-1]['xmax'] + s * avg_w + 5,
                                               filled[-1]['xmax'] + (s + 1) * avg_w + 5))
        else:
            for s in range(needed):
                filled.append(_placeholder(filled[-1],
                                           filled[-1]['xmax'] + s * avg_w + 5,
                                           filled[-1]['xmax'] + (s + 1) * avg_w + 5))

    return letters, filled


def reconstruct_plate_text(text_boxes, names):
    """Reconstruct plate text string representations in English and Lao script."""
    if not text_boxes:
        return "", "", []

    boxes = nms_by_overlap(boxes_to_dicts(text_boxes, names))
    lines = group_into_lines(boxes)

    # Ensure at least one province line exists
    has_province = any(b['class'] in config.LAO_PROVINCE_MAP for line in lines for b in line)
    if not has_province:
        lines.insert(0, [{'xmin': 0, 'ymin': 0, 'xmax': 0, 'ymax': -10,
                          'y_center': -5, 'class': 'VTE', 'conf': 0.0, 'is_guessed': True}])

    en_parts, lao_parts, all_chars = [], [], []

    for line in lines:
        line.sort(key=lambda b: b['xmin'])
        line = correct_context(line)

        letters = [b for b in line if not b['class'].isdigit() and b['class'] not in config.LAO_PROVINCE_MAP]
        digits  = [b for b in line if b['class'].isdigit() or b['class'] == '?']

        letters = fix_lookalike_pair(letters)
        letters, digits = fill_digit_gaps(letters, digits)

        province = [b for b in line if b['class'] in config.LAO_PROVINCE_MAP]
        assembled = sorted(province + letters + digits, key=lambda b: b['xmin'])

        en_words, lao_words = [], []
        for box in assembled:
            cls = box['class']
            en_words.append(cls)
            if cls in config.LAO_LETTER_MAP:
                lao_words.append(config.LAO_LETTER_MAP[cls])
            elif cls in config.LAO_PROVINCE_MAP:
                suffix = " (Guessed)" if box.get('is_guessed') else ""
                lao_words.append(config.LAO_PROVINCE_MAP[cls] + suffix)
            else:
                lao_words.append(cls)

        en_parts.append(" ".join(en_words))
        lao_parts.append(" ".join(lao_words))
        all_chars.extend(assembled)

    return " | ".join(en_parts), " | ".join(lao_parts), all_chars


def rotate_image(img, angle):
    """Rotate image by a given angle, expanding size to fit rotated bounds."""
    (h, w) = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    cos, sin = abs(M[0, 0]), abs(M[0, 1])
    nW = int(h * sin + w * cos)
    nH = int(h * cos + w * sin)
    M[0, 2] += nW / 2 - w // 2
    M[1, 2] += nH / 2 - h // 2
    return cv2.warpAffine(img, M, (nW, nH), borderMode=cv2.BORDER_REPLICATE)


def apply_clahe(img):
    """Apply Contrast Limited Adaptive Histogram Equalization to normalize illumination."""
    if img is None or img.size == 0:
        return img
    # Convert BGR to LAB color space
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    # Apply CLAHE to the lightness channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    # Merge channels and convert back to BGR
    merged = cv2.merge((cl, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def find_best_rotation_and_ocr(plate_img, text_model):
    """Try multiple rotations and return the one producing the highest OCR confidence score."""
    # Apply CLAHE to enhance contrast and character definition
    processed_plate = apply_clahe(plate_img)
    
    best_score, best_angle, best_results, best_img = -1.0, 0, None, processed_plate

    for angle in config.ROTATE_ANGLES:
        rotated = processed_plate if angle == 0 else rotate_image(processed_plate, angle)
        results = text_model(rotated, conf=config.OCR_CONF, iou=config.OCR_IOU,
                             agnostic_nms=True, verbose=False)
        boxes = results[0].boxes
        score = len(boxes) * 10.0 + sum(float(b.conf[0]) for b in boxes)
        
        # Early-exit optimization: if 0 degrees yields a good detection, skip other angles
        if angle == 0 and len(boxes) >= 6:
            conf_vals = [float(b.conf[0]) for b in boxes]
            avg_conf = sum(conf_vals) / len(conf_vals)
            # If we have at least 6 characters with an average confidence of 82% or higher,
            # it's a clean upright plate. Exit early to save processing time.
            if avg_conf >= 0.82:
                return rotated, results

        if score > best_score:
            best_score, best_angle, best_results, best_img = score, angle, results, rotated

    return best_img, best_results


def auto_crop_plate_by_chars(rotated_img, text_boxes):
    """
    Auto-crop the rotated plate image around the detected characters 
    to remove outer background elements (car body paint, frames).
    """
    if not text_boxes or len(text_boxes) == 0:
        return rotated_img
        
    h, w = rotated_img.shape[:2]
    
    # Extract coordinates of all character boxes
    xmins, ymins, xmaxs, ymaxs = [], [], [], []
    for b in text_boxes:
        xyxy = b.xyxy[0].cpu().numpy()
        xmins.append(xyxy[0])
        ymins.append(xyxy[1])
        xmaxs.append(xyxy[2])
        ymaxs.append(xyxy[3])
        
    xmin = min(xmins)
    ymin = min(ymins)
    xmax = max(xmaxs)
    ymax = max(ymaxs)
    
    # Calculate text block size
    tw = xmax - xmin
    th = ymax - ymin
    
    # Set a fixed padding of exactly 20px on all sides (top, bottom, left, right)
    # This ensures we capture enough plate background color (blue/red/yellow) for 
    # the classifier without expanding out into the car bumper paint.
    pad_w = 20
    pad_h = 20
    
    # Apply padding
    px1 = max(0, int(xmin - pad_w))
    py1 = max(0, int(ymin - pad_h))
    px2 = min(w, int(xmax + pad_w))
    py2 = min(h, int(ymax + pad_h))
    
    # Check if the cropped area is valid and has actual content
    if (px2 - px1) > 20 and (py2 - py1) > 20:
        return rotated_img[py1:py2, px1:px2]
        
    return rotated_img

