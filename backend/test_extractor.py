"""Self-check for detect_score_changes: synthesize a 3-page video and verify detection.

Run directly: python test_extractor.py
"""
import os

import cv2
import numpy as np

from extractor import DOWNLOADS_DIR, detect_score_changes


def _make_synthetic_video(path, width, height, fps, frames_per_page):
    colors = [(255, 255, 255), (40, 40, 200), (40, 180, 40)]  # 3 visually distinct "pages"
    fourcc = cv2.VideoWriter_fourcc(*'XVID')
    writer = cv2.VideoWriter(path, fourcc, fps, (width, height))
    for color in colors:
        frame = np.full((height, width, 3), color, dtype=np.uint8)
        for _ in range(frames_per_page):
            writer.write(frame)
    writer.release()


def demo():
    fps = 10
    frames_per_page = 20
    width, height = 200, 100
    filename = 'test_synthetic.avi'
    path = os.path.join(DOWNLOADS_DIR, filename)

    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    _make_synthetic_video(path, width, height, fps, frames_per_page)

    try:
        duration_ms = int(3 * frames_per_page / fps * 1000)
        result = detect_score_changes(
            filename, 0, 0, width, height, 0, duration_ms, threshold_percent=5.0)

        assert len(result) == 3, f"expected 3 distinct pages, got {len(result)}"

        page_duration_ms = frames_per_page / fps * 1000
        expected_times = [0, page_duration_ms, 2 * page_duration_ms]
        for (timestamp, _), expected in zip(result, expected_times):
            assert abs(timestamp - expected) < page_duration_ms / 2, (
                f"timestamp {timestamp} too far from expected page start {expected}")

        print(f"OK: detected {len(result)} pages at {[t for t, _ in result]}ms")
    finally:
        if os.path.exists(path):
            os.remove(path)


if __name__ == '__main__':
    demo()
