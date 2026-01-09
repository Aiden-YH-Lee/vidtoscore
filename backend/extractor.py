import cv2
import os
from pathlib import Path
import uuid
from PIL import Image, ImageDraw, ImageFont
import io
import yt_dlp


class VideoDownloadError(Exception):
    """Raised when a video download fails for any reason."""
    pass


download_dir = "downloads"

# Get absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, download_dir)


def download_video(vid_url, progress_callback=None):
    try:
        Path(download_dir).mkdir(exist_ok=True)

        # Generate unique filename using UUID
        unique_filename = f"{uuid.uuid4()}.mp4"

        def my_hook(d):
            if progress_callback:
                progress_callback(d)

        ydl_opts = {
            'format': 'best',  # Simpler format selection for compatibility
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(download_dir, unique_filename),
            'progress_hooks': [my_hook],
            'quiet': True,
            'no_warnings': True,
            # Use Android client to reduce bot detection
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
        }

        # Handle cookies from environment variable
        cookies_content = os.environ.get('YOUTUBE_COOKIES')
        cookies_file = None
        if cookies_content:
            cookies_file = os.path.join(BASE_DIR, 'cookies.txt')
            # Write cookies to a temporary file
            with open(cookies_file, 'w') as f:
                f.write(cookies_content)
            ydl_opts['cookiefile'] = cookies_file

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(vid_url, download=True)
                video_title = info.get('title', 'Unknown Title')
        finally:
            # Clean up cookies file if it was created
            if cookies_file and os.path.exists(cookies_file):
                try:
                    os.remove(cookies_file)
                except:
                    pass

        return unique_filename, video_title

    except Exception as e:
        raise VideoDownloadError(
            f"Error downloading video at {vid_url}: {str(e)}")


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
        raise ValueError(
            f"Crop coordinates out of bounds. Video size: {frame_width}x{frame_height}, Crop: ({x1},{y1}) to ({x2},{y2})")

    if x1 >= x2 or y1 >= y2:
        video.release()
        raise ValueError(
            f"Invalid crop coordinates: ({x1},{y1}) to ({x2},{y2})")

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
        raise ValueError(
            "No frames were extracted. Check your time range and crop coordinates.")

    return result


def frames_to_pdf(frames, frames_per_page=1, frame_width_percent=95, gap=10, title=None):
    """Convert list of OpenCV frames to PDF bytes with layout options."""
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

    # A4 page dimensions at 300 DPI (high quality)
    DPI = 300  # Increase from 72 (screen) to 300 (print quality)
    DPI_SCALE = DPI / 72.0  # Scale factor: 300/72 = 4.17

    A4_WIDTH = int(595 * DPI_SCALE)   # 2480 pixels at 300 DPI
    A4_HEIGHT = int(842 * DPI_SCALE)  # 3508 pixels at 300 DPI
    PAGE_MARGIN = int(40 * DPI_SCALE)  # Scale margins proportionally
    TITLE_HEIGHT = int(30 * DPI_SCALE) if title else 0  # Scale title height

    # Scale gap for higher DPI
    scaled_gap = int(gap * DPI_SCALE)

    print(
        f"Generating PDF at {DPI} DPI: {len(pil_images)} frames, {frames_per_page} per page, {frame_width_percent}% width, {gap}px gap")
    print(f"Page dimensions: {A4_WIDTH}x{A4_HEIGHT} pixels")
    if title:
        print(f"Adding title: {title}")

    # Get original frame dimensions
    original_frame_width, original_frame_height = pil_images[0].size
    print(
        f"Original frame size: {original_frame_width}x{original_frame_height}")

    # Calculate available space
    available_width = A4_WIDTH - (2 * PAGE_MARGIN)
    available_height = A4_HEIGHT - (2 * PAGE_MARGIN) - TITLE_HEIGHT

    # Get aspect ratio
    aspect_ratio = original_frame_height / original_frame_width

    # Calculate maximum frame dimensions based on two constraints:
    # 1. Width constraint: frames should be frame_width_percent of available width
    width_constrained_width = int(
        available_width * (frame_width_percent / 100.0))
    width_constrained_height = int(width_constrained_width * aspect_ratio)

    # 2. Height constraint: frames must fit in available height with gaps
    max_frame_height = (available_height - (scaled_gap *
                        (frames_per_page - 1))) // frames_per_page
    height_constrained_height = max_frame_height
    height_constrained_width = int(height_constrained_height / aspect_ratio)

    # Use the constraint that gives smaller frames (prevents overflow)
    if width_constrained_height * frames_per_page + (gap * (frames_per_page - 1)) <= available_height:
        # Width constraint is the limiting factor
        target_frame_width = width_constrained_width
        target_frame_height = width_constrained_height
        print(f"Using width constraint: {frame_width_percent}% of page width")
    else:
        # Height constraint is the limiting factor
        target_frame_width = height_constrained_width
        target_frame_height = height_constrained_height
        print(f"Using height constraint: filling available vertical space")

    print(f"Available space: {available_width}x{available_height}px")
    print(f"Scaled frame size: {target_frame_width}x{target_frame_height}px")
    print(
        f"Total content height: {(target_frame_height * frames_per_page) + (scaled_gap * (frames_per_page - 1))}px / {available_height}px")

    # Resize all frames to the target size
    resized_frames = []
    for img in pil_images:
        resized = img.resize(
            (target_frame_width, target_frame_height), Image.Resampling.LANCZOS)
        resized_frames.append(resized)

    print(f"Resized {len(resized_frames)} frames")

    # Create pages with vertically stacked frames
    pdf_pages = []
    total_pages = (len(resized_frames) + frames_per_page -
                   1) // frames_per_page  # Calculate total pages
    for page_num, page_start in enumerate(range(0, len(resized_frames), frames_per_page)):
        page_frames = resized_frames[page_start:page_start + frames_per_page]
        print(f"Creating page {page_num + 1} with {len(page_frames)} frames")

        # Create blank A4 page
        page = Image.new('RGB', (A4_WIDTH, A4_HEIGHT), 'white')
        draw = ImageDraw.Draw(page)

        # Add title at the top if provided
        y_offset = PAGE_MARGIN
        if title:
            try:
                # Try different fonts that support Unicode/CJK characters
                # Scale font size for higher DPI
                title_font_size = int(16 * DPI_SCALE)
                font_paths = [
                    # macOS - supports all Unicode
                    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
                    "/System/Library/Fonts/AppleSDGothicNeo.ttc",  # macOS - Korean support
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
                    "/Windows/Fonts/malgun.ttf",  # Windows Korean
                    "/Windows/Fonts/arial.ttf",  # Windows
                ]
                font = None
                for font_path in font_paths:
                    try:
                        font = ImageFont.truetype(font_path, title_font_size)
                        break
                    except:
                        continue

                if font is None:
                    font = ImageFont.load_default()
            except:
                font = ImageFont.load_default()

            # Draw title centered at top
            bbox = draw.textbbox((0, 0), title, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = (A4_WIDTH - text_width) // 2
            draw.text((text_x, y_offset), title, fill='black', font=font)
            y_offset += TITLE_HEIGHT

        # Stack frames vertically, centered horizontally
        for idx, frame_img in enumerate(page_frames):
            x_offset = (A4_WIDTH - frame_img.width) // 2  # Center horizontally
            print(f"  Placing frame {idx + 1} at ({x_offset}, {y_offset})")
            page.paste(frame_img, (x_offset, y_offset))
            y_offset += frame_img.height + scaled_gap

        # Add page number at the bottom
        try:
            page_num_text = f"{page_num + 1} / {total_pages}"
            # Use small font for page number, scaled for DPI
            page_num_font_size = int(10 * DPI_SCALE)
            try:
                page_num_font = ImageFont.truetype(
                    "/System/Library/Fonts/Helvetica.ttc", page_num_font_size)
            except:
                page_num_font = ImageFont.load_default()

            # Calculate position (centered at bottom)
            bbox = draw.textbbox((0, 0), page_num_text, font=page_num_font)
            text_width = bbox[2] - bbox[0]
            text_x = (A4_WIDTH - text_width) // 2
            text_y = A4_HEIGHT - PAGE_MARGIN + \
                int(10 * DPI_SCALE)  # Below the margin
            draw.text((text_x, text_y), page_num_text,
                      fill='#999999', font=page_num_font)
        except Exception as e:
            print(f"Warning: Could not add page number: {e}")

        pdf_pages.append(page)

    print(f"Created {len(pdf_pages)} PDF pages")

    # Save as PDF with high resolution
    pdf_bytes = io.BytesIO()
    pdf_pages[0].save(
        pdf_bytes,
        'PDF',
        resolution=float(DPI),  # Use 300 DPI instead of 72
        save_all=True,
        append_images=pdf_pages[1:] if len(pdf_pages) > 1 else []
    )
    pdf_bytes.seek(0)
    print(f"PDF generated at {DPI} DPI")
    return pdf_bytes


# res = extract("https://www.youtube.com/watch?v=vBDpwjn2SZ0",
#               0, 0, 800, 400, 8000, 180000, 15000)

# for i, img in enumerate(res):
#     cv2.imshow(f'Image {i}', img)
#     cv2.waitKey(1000)  # Display for 500ms
#     cv2.destroyAllWindows()
