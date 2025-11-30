# VidToScore - Final Project Proposal

## Team Information

**Working Solo:** Yeongheon (Aiden) Lee

## Project Pitch

**VidToScore** is a web application that extracts musical scores or sheet music from video content and converts them into a downloadable PDF format. Musicians and music students often encounter valuable sheet music in YouTube videos (tutorials, performances, lessons), but have no easy way to extract and save these scores for practice or reference if the creator did not make a score pdf available. VidToScore solves this problem by allowing users to select specific time ranges and screen regions from videos, automatically extracting frames at specified intervals, and compiling them into a clean, organized PDF document.

**Key Features:**

- YouTube video URL input and preview
- Intuitive video editor interface with timeline controls
- Precise time range selection (start, end, interval parameters)
- Visual region selection to crop specific areas of video frames
- Automatic frame extraction at user-defined intervals
- PDF generation with customizable layout (images per page, spacing, sizing)
- Download functionality for the generated PDF

**Value Proposition:** This tool eliminates the need for manual screenshot-taking and tedious PDF compilation, saving musicians time while studying from video content.

## Technology Stack

### Frontend

- **React** with **TypeScript** - Component-based UI with type safety
- **Vite** - Fast development server and build tool
- **HTML5 Canvas/Video API** - For video playback and frame manipulation (not entirely sure on this part)
- **CSS3** - Styling and responsive design
- Other css libraries maybe

### Backend

- I initially started with Flask because of the video/image processing libraries available, but would be open to try using next.js for backend if the same functionalities exist.
- **Python Flask** - RESTful API server
- **yt-dlp** - YouTube video downloading library
- **OpenCV (cv2)** - Video processing and frame extraction
- **Pillow (PIL)** - Image manipulation and processing
- **ReportLab or img2pdf** - PDF generation from extracted images
- **CORS** - Cross-origin resource sharing for frontend-backend communication

### Additional Technologies

- Maybe database to store user and their generated scores, but don't think it's necessary
- Framer motion to just make things look nicer maybe

## Milestone Goals

### Milestone 1: Backend Video Processing

- [ ] Set up Flask server with basic routing
- [ ] Implement YouTube video download functionality using yt-dlp
- [ ] Create video frame extraction logic with OpenCV
- [ ] Test time-based frame extraction (start, end, interval parameters)
- [ ] Implement basic image cropping based on coordinate parameters

### Milestone 2: Frontend Core Interface

- [ ] Set up React + Vite + TypeScript project structure
- [ ] Create landing page with URL input form
- [ ] Implement video player component with HTML5 Video API
- [ ] Build time parameter controls (start/end time inputs and sliders)
- [ ] Design and implement visual region selection tool (canvas overlay)
- [ ] Connect frontend to backend API endpoints

### Milestone 3: Image Processing & PDF Generation

- [ ] Implement backend PDF generation from extracted frames
- [ ] Add frontend controls for PDF layout customization (images per page, spacing, sizing)
- [ ] Create preview functionality for extracted frames
- [ ] Implement download mechanism for generated PDF
- [ ] Handle error cases (invalid URLs, processing failures)

### Final Polish & Testing

- [ ] UI/UX improvements and responsive design
- [ ] Performance optimization (large video handling, processing time)
- [ ] Comprehensive testing across different video formats
- [ ] Documentation and deployment preparation

## Unique Technologies for Extra Credit

- Not sure what counts as unique technology...

## Development Priority

The project will prioritize backend functionality first (video downloading, frame extraction, PDF generation) to ensure core features work reliably before building the user interface. This approach allows for easier testing and debugging of the processing pipeline independently of frontend concerns.
