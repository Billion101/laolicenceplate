import os

# ---------------------------------------------------------------------------
# Directory & Weights Paths
# ---------------------------------------------------------------------------
SRC_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SRC_DIR)

# Path to YOLO models inside Re-Clean/models/
PLATE_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "vehicle_plate.onnx")
TEXT_MODEL_PATH  = os.path.join(PROJECT_ROOT, "models", "plate_text.onnx")
VEHICLE_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "vehicle_detect.onnx")
CLASSIFIER_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "plate_classifier.onnx")

# Default test and output directories
TEST_IMAGE_DIR = os.path.join(PROJECT_ROOT, "test_images")
OUTPUT_SAVE_DIR = os.path.join(PROJECT_ROOT, "runs", "color_ocr_results")

# ---------------------------------------------------------------------------
# YOLO & OCR Thresholds
# ---------------------------------------------------------------------------
PLATE_CONF_HIGH = 0.18
PLATE_CONF_LOW  = 0.10
PLATE_IOU       = 0.3

VEHICLE_CONF    = 0.25
VEHICLE_CLASSES = [2, 5, 7]  # COCO indexes: Car (2), Bus (5), Truck (7)

OCR_CONF        = 0.25
OCR_CONF_RETRY  = 0.20
OCR_IOU         = 0.60
MIN_CHARS       = 4

# Optimized list of rotation angles for tilt correction (deskewing)
ROTATE_ANGLES   = [0, -5, 5, -10, 10]
VALID_EXTENSIONS = (".jpg", ".jpeg", ".png")

# ---------------------------------------------------------------------------
# Lao Character & Province Mappings
# ---------------------------------------------------------------------------
LAO_LETTER_MAP = {
    'A': 'ກ', 'B': 'ຂ', 'C': 'ຄ', 'D': 'ງ', 'E': 'ຈ', 'F': 'ສ', 'G': 'ຊ',
    'H': 'ຍ', 'I': 'ດ', 'J': 'ຕ', 'K': 'ຖ', 'L': 'ທ', 'M': 'ນ', 'N': 'ບ',
    'O': 'ປ', 'P': 'ຜ', 'Q': 'ຝ', 'R': 'ພ', 'S': 'ຟ', 'T': 'ມ', 'U': 'ຢ',
    'V': 'ຣ', 'W': 'ລ', 'X': 'ວ', 'Y': 'ຫ', 'Z': 'ອ', 'AA': 'ຮ',
}

LAO_PROVINCE_MAP = {
    'VTE': 'ນະຄອນຫຼວງວຽງຈັນ (Vientiane)',
    'VTE2': 'ນະຄອນຫຼວງວຽງຈັນ (Vientiane)',
    'SVK': 'ສະຫວັນນະເຂດ (Savannakhet)',
    'LPB': 'ຫຼວງພະບາງ (Luang Prabang)',
    'KHM': 'ຄໍາມ່ວນ (Khammouane)',
    'LNT': 'ຫຼວງນໍ້າທາ (Luang Namtha)',
    'XYL': 'ໄຊຍະບູລີ (Xayaboury)',
    'XEK': 'ເຊກອງ (Sekong)',
    'CPS': 'ຈຳປາສັກ (Champasak)',
    'VTP': 'ແຂວງວຽງຈັນ (Vientiane Prov.)',
    'BLK': 'ບໍລິຄຳໄຊ (Bolikhamsai)',
    'BOK': 'ບໍ່ແກ້ວ (Bokeo)',
    'HPN': 'ຫົວພັນ (Houaphanh)',
    'XKH': 'ຊຽງຂວາງ (Xiengkhouang)',
    'ODX': 'ອຸດົມໄຊ (Oudomxay)',
    'PSL': 'ຜົ້ງສາລີ (Phongsaly)',
    'ATP': 'ອັດຕະປື (Attapeu)',
    'XAY': 'ໄຊສົມບູນ (Xaysomboun)',
    'XSB': 'ໄຊສົມບູນ (Xaysomboun)',
    'SLV': 'ສາລະວັນ (Salavan)',
}

LETTER_TO_DIGIT = {
    'O': '0', 'o': '0', 'I': '1', 'l': '1', 'S': '5', 's': '5',
    'B': '8', 'G': '6', 'Z': '2', 'A': '4'
}

DIGIT_TO_LETTER = {
    '0': 'O', '1': 'I', '5': 'S', '8': 'B'
}

LOOKALIKE_GROUPS = [
    {'A', 'C'}, {'N', 'M'}, {'X', 'Z'}, {'F', 'S'},
    {'B', 'T'}, {'W', 'X'}, {'H', 'Y'},
]

# ---------------------------------------------------------------------------
# Plate Cropping & Padding Settings
# ---------------------------------------------------------------------------
# Padding (pixels) to expand the initial plate crop coordinates.
# Ensures no characters are clipped prior to rotation and character detection,
# and provides a perfect 20px border for the plate classifier.
PLATE_INITIAL_PADDING = 20

# Ratio of padding relative to text block size to expand the auto-cropped plate crop.
# 0.15 means 15% padding on all sides around the union of character bounding boxes.
PLATE_AUTO_CROP_PADDING_RATIO = 0.15

