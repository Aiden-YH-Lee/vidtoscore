from flask import Flask, request, jsonify, send_file
from extractor import download_video, extract, frames_to_pdf, VideoDownloadError
from flask_cors import CORS
import cv2
import os
import base64
import numpy as np
from PIL import Image
import io
import threading
import uuid


import time

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*",
     "methods": ["GET", "POST", "OPTIONS"]}})

# Get absolute path to backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, 'downloads')

# Ensure downloads directory exists
if not os.path.exists(DOWNLOADS_DIR):
    os.makedirs(DOWNLOADS_DIR)

# Store download tasks
download_tasks = {}


def cleanup_old_files():
    """Delete files older than 1 hour to prevent disk fill-up."""
    try:
        current_time = time.time()
        for filename in os.listdir(DOWNLOADS_DIR):
            file_path = os.path.join(DOWNLOADS_DIR, filename)
            # If file is older than 1 hour (3600 seconds)
            if os.path.getmtime(file_path) < current_time - 3600:
                try:
                    os.remove(file_path)
                    print(f"Cleaned up old file: {filename}")
                except Exception as e:
                    print(f"Error deleting {filename}: {e}")

        # Also cleanup old tasks from memory
        keys_to_delete = []
        for task_id, task in download_tasks.items():
            # If task is completed/error and older than 1 hour (approx)
            # Note: We don't have task timestamp, so we'll just clear completed ones if list gets too big
            if task.get('status') in ['completed', 'error']:
                keys_to_delete.append(task_id)

        # Only clear tasks if we have too many (prevent memory leak)
        if len(download_tasks) > 100:
            for k in keys_to_delete:
                del download_tasks[k]

    except Exception as e:
        print(f"Cleanup error: {e}")


@app.route('/api/video/upload', methods=['POST'])
def upload_video():
    # Run cleanup before starting new download
    cleanup_old_files()

    try:
        data = request.json
        url = data.get('url')

        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        task_id = str(uuid.uuid4())
        download_tasks[task_id] = {
            'status': 'downloading',
            'progress': 0,
            'message': 'Starting download...'
        }

        def download_worker(tid, video_url):
            try:
                def progress_hook(d):
                    if d['status'] == 'downloading':
                        p = d.get('_percent_str', '0%').replace('%', '')
                        try:
                            download_tasks[tid]['progress'] = float(p)
                            download_tasks[tid]['message'] = f"Downloading: {d.get('_percent_str')}"
                        except:
                            pass
                    elif d['status'] == 'finished':
                        download_tasks[tid]['progress'] = 99
                        download_tasks[tid]['message'] = 'Processing video metadata...'

                # Download the video and get title
                filename, title = download_video(
                    video_url, progress_callback=progress_hook)

                # Get video metadata
                video_path = os.path.join(DOWNLOADS_DIR, filename)
                video = cv2.VideoCapture(video_path)

                if not video.isOpened():
                    raise Exception(
                        'Failed to read video file. Make sure ffmpeg is installed.')

                fps = video.get(cv2.CAP_PROP_FPS)
                frame_count = video.get(cv2.CAP_PROP_FRAME_COUNT)
                width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

                # Calculate duration, handle edge cases
                if fps > 0 and frame_count > 0:
                    duration = int(frame_count / fps * 1000)  # in milliseconds
                else:
                    video.release()
                    raise Exception(
                        'Invalid video file - could not determine duration')

                video.release()

                download_tasks[tid]['status'] = 'completed'
                download_tasks[tid]['progress'] = 100
                download_tasks[tid]['result'] = {
                    'filename': filename,
                    'title': title,
                    'duration': duration,
                    'width': width,
                    'height': height,
                    'fps': fps
                }

            except Exception as e:
                download_tasks[tid]['status'] = 'error'
                download_tasks[tid]['error'] = str(e)

        thread = threading.Thread(target=download_worker, args=(task_id, url))
        thread.start()

        return jsonify({'taskId': task_id})

    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@app.route('/api/video/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = download_tasks.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task)


@app.route('/api/video/extract', methods=['POST'])
def extract_frames():
    try:
        data = request.json

        filename = data.get('filename')
        x1 = int(data.get('x1', 0))
        y1 = int(data.get('y1', 0))
        x2 = int(data.get('x2', 0))
        y2 = int(data.get('y2', 0))
        start = int(data.get('start', 0))
        end = int(data.get('end', 0))
        interval = int(data.get('interval', 1000))
        frames_per_page = int(data.get('framesPerPage', 1))
        frame_width_percent = int(data.get('frameWidthPercent', 95))
        gap = int(data.get('gap', 10))

        # Extract frames
        frames = extract(filename, x1, y1, x2, y2, start, end, interval)

        if not frames:
            return jsonify({'error': 'No frames extracted'}), 400

        # Convert to PDF with vertical stacking layout
        pdf_bytes = frames_to_pdf(
            frames,
            frames_per_page=frames_per_page,
            frame_width_percent=frame_width_percent,
            gap=gap
        )

        if not pdf_bytes:
            return jsonify({'error': 'Failed to generate PDF'}), 500

        return send_file(
            pdf_bytes,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='sheet_music.pdf'
        )

    except Exception as e:
        return jsonify({'error': f'Extraction failed: {str(e)}'}), 500


@app.route('/api/video/extract-from-frames', methods=['POST'])
def extract_from_frames():
    """Generate PDF from base64 encoded frames sent from frontend."""
    try:
        data = request.json

        frames_data = data.get('frames', [])
        frames_per_page = int(data.get('framesPerPage', 1))
        frame_width_percent = int(data.get('frameWidthPercent', 95))
        gap = int(data.get('gap', 10))
        title = data.get('title')  # Optional title

        if not frames_data:
            return jsonify({'error': 'No frames provided'}), 400

        # Convert base64 frames to OpenCV format
        frames = []
        for frame_b64 in frames_data:
            try:
                # Remove data URL prefix if present (e.g., "data:image/png;base64,")
                if ',' in frame_b64:
                    frame_b64 = frame_b64.split(',', 1)[1]

                # Decode base64 to bytes
                img_bytes = base64.b64decode(frame_b64)

                # Convert to PIL Image
                pil_img = Image.open(io.BytesIO(img_bytes))

                # Convert PIL to OpenCV (RGB -> BGR)
                opencv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                frames.append(opencv_img)
            except Exception as e:
                print(f"Error decoding frame: {e}")
                continue

        if not frames:
            return jsonify({'error': 'Failed to decode frames'}), 400

        print(f"Received {len(frames)} frames for PDF generation")

        # Generate PDF
        pdf_bytes = frames_to_pdf(
            frames,
            frames_per_page=frames_per_page,
            frame_width_percent=frame_width_percent,
            gap=gap,
            title=title
        )

        if not pdf_bytes:
            return jsonify({'error': 'Failed to generate PDF'}), 500

        return send_file(
            pdf_bytes,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='sheet_music.pdf'
        )

    except Exception as e:
        print(f"Error in extract_from_frames: {str(e)}")
        return jsonify({'error': f'PDF generation failed: {str(e)}'}), 500


@app.route('/api/video/file/<filename>')
def serve_video(filename):
    try:
        video_path = os.path.join(DOWNLOADS_DIR, filename)
        print(f"Serving video from: {video_path}")
        print(f"File exists: {os.path.exists(video_path)}")

        if not os.path.exists(video_path):
            return jsonify({'error': f'Video file not found: {video_path}'}), 404

        # Use Flask's built-in range request support
        response = send_file(
            video_path,
            mimetype='video/mp4',
            as_attachment=False,
            conditional=True,
            max_age=0
        )

        # Add CORS and caching headers
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Cache-Control'] = 'no-cache'

        return response

    except Exception as e:
        print(f"Error serving video: {str(e)}")
        return jsonify({'error': str(e)}), 500
