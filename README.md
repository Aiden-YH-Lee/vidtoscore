# vidtoscore

**Notice**: Unfortunately youtube blocks requests coming from deployed servers, so the deployed website does not work. You can clone the repo and run it locally. If you encounter yt-dlp related issues, it is probably this: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp

Extract sheet music (scores) or slides from videos into a PDF. The app downloads a video (e.g. from YouTube), allows you to select a crop region and time range, and exports the extracted frames into a high-quality PDF.

## Demo


https://github.com/user-attachments/assets/2e1999bd-2ada-4627-9feb-e22709a91cd7



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
- Generates PDFs using `PIL` (Pillow).

## Running the Project

### Option 1: Using Docker (Recommended)

The easiest way to run the project is with Docker Compose:

**Prerequisites:**

- Docker and Docker Compose installed

**Steps:**

1. Clone the repository and navigate to the project directory:

```bash
cd vidtoscore
```

1. Build and run the containers:

```bash
docker compose up --build --watch
```

1. Access the application:
   - Frontend: <http://localhost:5173>
   - Backend API: <http://localhost:8080>

To stop the containers, press `Ctrl+C` or run:

```bash
docker compose down
```

### Option 2: Running Locally (Manual Setup)

**Prerequisites:**

- Python 3.8+
- Node.js 16+
- `ffmpeg` (required for `yt-dlp` and video processing)

#### 1. Backend Setup

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
flask run --host=0.0.0.0 --port=8080
```

#### 2. Frontend Setup

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
3. **Set Interval**: Set the time interval (e.g., 5000ms) for frame extraction.
4. **Crop**: Click "Capture Frame for Cropping", then draw a box around the music staff.
5. **Preview**: Click "Preview Frames" to see what will be captured. You can delete individual bad frames.
6. **Extract**: Click "Extract to PDF" to download your sheet music.
