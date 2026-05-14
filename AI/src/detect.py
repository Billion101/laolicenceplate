"""
detect.py
Script for running inference with a trained YOLO model on images or video.
Supports usage via command line arguments.
"""
import argparse
import os
from ultralytics import YOLO

def main():
    parser = argparse.ArgumentParser(description="YOLO Object Detection Script")
    parser.add_argument('--model', type=str, required=True, help='Path to trained model (.pt)')
    parser.add_argument('--source', type=str, required=True, help='Path to image, folder, or video for detection')
    parser.add_argument('--output', type=str, default='runs/detect/predict', help='Output directory for results')
    parser.add_argument('--show', action='store_true', help='Show results after detection')
    args = parser.parse_args()

    # Load model
    model = YOLO(args.model)

    # Run detection
    results = model(args.source, save=True, project=args.output)

    # Show results if requested
    if args.show:
        for r in results:
            r.show()

    print(f"Detection complete. Results saved to: {args.output}")

if __name__ == "__main__":
    main()
