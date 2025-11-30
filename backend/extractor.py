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
    video_file_path = os.path.join(download_dir, file_name)

    result = []
    video = cv2.VideoCapture(video_file_path)

    for time in range(start, end, interval):
        video.set(cv2.CAP_PROP_POS_MSEC, time)
        success, img = video.read()
        if success:
            cropped_img = img[y1:y2, x1:x2]
            result.append(cropped_img)

    video.release()
    return result


def frames_to_pdf(frames):
    """Convert list of OpenCV frames to PDF bytes."""
    if not frames:
        return None

    # Convert OpenCV images (BGR) to PIL Images (RGB)
    pil_images = []
    for frame in frames:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame)
        pil_images.append(pil_img)

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
