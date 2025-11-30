import cv2
import subprocess
import os
from pathlib import Path
import uuid
from PIL import Image
import io


class VideoDownloadError(Exception):
    """Raised when a video download fails for any reason."""
    pass


download_dir = "downloads"

# Get absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, download_dir)


def download_video(vid_url):
    try:

        Path(download_dir).mkdir(exist_ok=True)

        # Generate unique filename using UUID
        unique_filename = f"{uuid.uuid4()}.mp4"
        video_file_path = os.path.join(download_dir, unique_filename)
        command = [
            "yt-dlp",
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--merge-output-format", "mp4",
            "-o", video_file_path,
            vid_url
        ]
        subprocess.run(command, capture_output=True, text=True, check=True)

        return unique_filename

    except subprocess.CalledProcessError as e:
        raise VideoDownloadError(
            f"Error downloading video at {vid_url}: {e.stderr}")


def extract(file_name, x1, y1, x2, y2, start, end, interval):
    video_file_path = os.path.join(DOWNLOADS_DIR, file_name)

    if not os.path.exists(video_file_path):
        raise FileNotFoundError(f"Video file not found: {video_file_path}")

    result = []
    video = cv2.VideoCapture(video_file_path)

    if not video.isOpened():
        raise ValueError("Failed to open video file")

    # Get video dimensions for validation
    frame_width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Validate crop coordinates
    if x1 < 0 or y1 < 0 or x2 > frame_width or y2 > frame_height:
        video.release()
        raise ValueError(f"Crop coordinates out of bounds. Video size: {frame_width}x{frame_height}, Crop: ({x1},{y1}) to ({x2},{y2})")

    if x1 >= x2 or y1 >= y2:
        video.release()
        raise ValueError(f"Invalid crop coordinates: ({x1},{y1}) to ({x2},{y2})")

    for time in range(start, end, interval):
        video.set(cv2.CAP_PROP_POS_MSEC, time)
        success, img = video.read()
        if success and img is not None:
            cropped_img = img[y1:y2, x1:x2]
            # Verify cropped image is not empty
            if cropped_img.size > 0:
                result.append(cropped_img)
            else:
                print(f"Warning: Empty crop at time {time}ms")

    video.release()

    if not result:
        raise ValueError("No frames were extracted. Check your time range and crop coordinates.")

    return result


def frames_to_pdf(frames):
    """Convert list of OpenCV frames to PDF bytes."""
    if not frames:
        return None

    # Convert OpenCV images (BGR) to PIL Images (RGB)
    pil_images = []
    for i, frame in enumerate(frames):
        if frame is None or frame.size == 0:
            print(f"Warning: Skipping empty frame at index {i}")
            continue
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb_frame)
            pil_images.append(pil_img)
        except Exception as e:
            print(f"Warning: Failed to convert frame {i}: {e}")
            continue

    if not pil_images:
        return None

    # Save as PDF in memory
    pdf_bytes = io.BytesIO()
    pil_images[0].save(
        pdf_bytes,
        'PDF',
        resolution=100.0,
        save_all=True,
        append_images=pil_images[1:]
    )
    pdf_bytes.seek(0)
    return pdf_bytes


# res = extract("https://www.youtube.com/watch?v=vBDpwjn2SZ0",
#               0, 0, 800, 400, 8000, 180000, 15000)

# for i, img in enumerate(res):
#     cv2.imshow(f'Image {i}', img)
#     cv2.waitKey(1000)  # Display for 500ms
#     cv2.destroyAllWindows()
