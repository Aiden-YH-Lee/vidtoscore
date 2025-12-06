# vidtoscore

Extract sheet music (scores) or slides from videos into a PDF. The app downloads a video (e.g. from YouTube), allows you to select a crop region and time range, and exports the extracted frames into a high-quality PDF.

## Features

- **Video Download**: Supports YouTube and other platforms via `yt-dlp`.
- **Interactive Editor**:
  - **Time Range**: Set start and end times to extract only the relevant part of the video.
  - **Cropping**: Draw a crop rectangle on a preview frame to isolate the score or slide.
  - **Preview**: See exactly which frames will be extracted before generating the PDF.
  - **Extraction**: Extract frames at a constant time interval (e.g., every 5 seconds).
  - **PDF Export**: Generates an A4 PDF with vertically stacked frames. Customizable layout (frames per page, width, gap).

## Architecture

### Frontend (`/frontend`)

- React + Vite application.
- Provides the UI for video playback, cropping (using `react-image-crop`), and settings configuration.
- Communicates with the backend to analyze video frames and generate PDFs.

### Backend (`/backend`)

- Flask application.
- Handles video downloading (`yt-dlp`).
- Performs frame extraction using OpenCV (`cv2`).
- Implements "Smart Extraction" logic using image difference thresholds.
- Generates PDFs using `PIL` (Pillow).

## API Endpoints

- `POST /api/video/upload`: Download a video from a URL.
- `POST /api/video/extract`: Extract frames and generate PDF (supports both Interval and Smart modes).
- `POST /api/video/analyze`: Analyze video for "Smart Mode" timestamps without generating PDF (for preview).
- `POST /api/video/extract-from-frames`: Generate PDF from a list of base64 encoded images (used after preview).
- `GET /api/video/file/<filename>`: Stream the video file to the frontend.

## Running the Project

### Prerequisites

- Python 3.8+
- Node.js 16+
- `ffmpeg` (required for `yt-dlp` and video processing)

### 1. Backend Setup

Navigate to the `backend` directory:

```bash
cd backend
```

Create a virtual environment (optional but recommended):

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the Flask application (runs on port 8080):

```bash
flask run --port 8080
```

### 2. Frontend Setup

Navigate to the `frontend` directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open your browser at the URL shown (usually `http://localhost:5173`).

## Usage Guide

1. **Paste URL**: Enter a YouTube URL on the landing page and click "Start".
2. **Set Time**: Scrub to the start of the score and click "Set Start". Do the same for "Set End".
3. **Crop**: Click "Capture Frame for Cropping", then draw a box around the music staff.
4. **Choose Mode**:
   - **Fixed Interval**: Good for constant tempo. Set the interval (e.g., 5000ms).
   - **Smart (Scene Detect)**: Best for page turns.
     - **Threshold**: Lower = more sensitive (detects small changes). Higher = less sensitive.
     - **Min Cooldown**: Minimum time to wait after a detection (prevents duplicate captures of the same page).
5. **Preview**: Click "Preview Frames" to see what will be captured. You can delete individual bad frames.
6. **Extract**: Click "Extract to PDF" to download your sheet music.
