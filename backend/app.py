from flask import Flask, request, jsonify, send_file
from extractor import download_video, extract, frames_to_pdf, VideoDownloadError
from flask_cors import CORS
import cv2
import os


app = Flask(__name__)
CORS(app)

# Get absolute path to backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, 'downloads')


@app.route('/api/video/upload', methods=['POST'])
def upload_video():
    try:
        data = request.json
        url = data.get('url')

        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        # Download the video
        filename = download_video(url)

        # Get video metadata
        video_path = os.path.join(DOWNLOADS_DIR, filename)
        video = cv2.VideoCapture(video_path)

        if not video.isOpened():
            return jsonify({'error': 'Failed to read video file. Make sure ffmpeg is installed.'}), 500

        fps = video.get(cv2.CAP_PROP_FPS)
        frame_count = video.get(cv2.CAP_PROP_FRAME_COUNT)
        width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Calculate duration, handle edge cases
        if fps > 0 and frame_count > 0:
            duration = int(frame_count / fps * 1000)  # in milliseconds
        else:
            video.release()
            return jsonify({'error': 'Invalid video file - could not determine duration'}), 500

        video.release()

        return jsonify({
            'filename': filename,
            'duration': duration,
            'width': width,
            'height': height,
            'fps': fps
        })

    except VideoDownloadError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


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

        # Extract frames
        frames = extract(filename, x1, y1, x2, y2, start, end, interval)

        if not frames:
            return jsonify({'error': 'No frames extracted'}), 400

        # Convert to PDF
        pdf_bytes = frames_to_pdf(frames)

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
