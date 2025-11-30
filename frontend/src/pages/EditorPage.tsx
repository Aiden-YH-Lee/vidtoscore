import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface VideoData {
    filename: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
}

export default function EditorPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);

    const videoData = location.state?.videoData as VideoData | undefined;

    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [interval, setInterval] = useState(1000);
    const [currentTime, setCurrentTime] = useState(0);

    const [crop, setCrop] = useState<Crop>({
        unit: 'px',
        x: 0,
        y: 0,
        width: 100,
        height: 100
    });

    const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
    const [showCropTool, setShowCropTool] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState('');
    const [frameScale, setFrameScale] = useState({ width: 1, height: 1 });
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (!videoData) {
            navigate('/');
        } else {
            setEndTime(videoData.duration);
        }
    }, [videoData, navigate]);

    if (!videoData) {
        return null;
    }

    const videoUrl = `http://localhost:8080/api/video/file/${videoData.filename}`;

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleSetStart = () => {
        const currentMs = Math.floor(currentTime * 1000);
        setStartTime(currentMs);
    };

    const handleSetEnd = () => {
        const currentMs = Math.floor(currentTime * 1000);
        setEndTime(currentMs);
    };

    const captureCurrentFrame = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/png');
            setCapturedFrame(frameData);
            setShowCropTool(true);

            // Store actual frame dimensions for scaling calculations
            setFrameScale({
                width: video.videoWidth,
                height: video.videoHeight
            });

            // Initialize crop to a reasonable default
            setCrop({
                unit: 'px',
                x: 0,
                y: 0,
                width: Math.min(canvas.width, 800),
                height: Math.min(canvas.height, 400)
            });
        }
    };

    // Calculate scale ratio when image is displayed
    const handleImageLoad = () => {
        if (imgRef.current) {
            const displayedWidth = imgRef.current.clientWidth;
            const displayedHeight = imgRef.current.clientHeight;
            console.log('Actual video size:', frameScale.width, 'x', frameScale.height);
            console.log('Displayed image size:', displayedWidth, 'x', displayedHeight);
        }
    };

    const handleExtract = async () => {
        if (startTime >= endTime) {
            setError('End time must be after start time');
            return;
        }

        if (interval <= 0) {
            setError('Interval must be greater than 0');
            return;
        }

        if (!crop.width || !crop.height) {
            setError('Please select a crop region');
            return;
        }

        // Calculate scale ratio between displayed image and actual video
        const displayedWidth = imgRef.current?.clientWidth || frameScale.width;
        const displayedHeight = imgRef.current?.clientHeight || frameScale.height;

        const scaleX = frameScale.width / displayedWidth;
        const scaleY = frameScale.height / displayedHeight;

        // Scale crop coordinates to match actual video dimensions
        const x1 = Math.max(0, Math.round(crop.x * scaleX));
        const y1 = Math.max(0, Math.round(crop.y * scaleY));
        const x2 = Math.round((crop.x + (crop.width || 0)) * scaleX);
        const y2 = Math.round((crop.y + (crop.height || 0)) * scaleY);

        console.log('Crop (displayed):', crop.x, crop.y, crop.width, crop.height);
        console.log('Scale:', scaleX, scaleY);
        console.log('Crop (actual):', x1, y1, x2 - x1, y2 - y1);

        if (x1 < 0 || y1 < 0 || x1 >= x2 || y1 >= y2) {
            setError('Invalid crop coordinates. Please redraw the crop region.');
            return;
        }

        setExtracting(true);
        setError('');

        try {
            const response = await fetch('http://localhost:8080/api/video/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: videoData.filename,
                    x1,
                    y1,
                    x2,
                    y2,
                    start: startTime,
                    end: endTime,
                    interval: interval
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Extraction failed');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sheet_music.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Error:', error);
            setError(error instanceof Error ? error.message : 'Failed to extract frames');
        } finally {
            setExtracting(false);
        }
    };

    const estimatedFrames = Math.ceil((endTime - startTime) / interval);

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Video Editor</h1>
            <button onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
                Back to Home
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Video Player Section */}
                <div>
                    <h2>Video Preview</h2>
                    <div style={{ backgroundColor: '#000', position: 'relative' }}>
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            controls
                            style={{ width: '100%', height: 'auto', maxHeight: '500px' }}
                            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                            onError={(e) => {
                                console.error('Video error:', e);
                                setError('Failed to load video. Please try again.');
                            }}
                            onLoadedMetadata={() => console.log('Video loaded')}
                            crossOrigin="anonymous"
                        />
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <p>Current Time: {formatTime(currentTime * 1000)}</p>
                        <p>Duration: {formatTime(videoData.duration)}</p>
                        <p>Resolution: {videoData.width} x {videoData.height}</p>
                        <p style={{ fontSize: '0.8rem', color: '#888', wordBreak: 'break-all' }}>
                            Video: {videoData.filename}
                        </p>
                    </div>
                </div>

                {/* Controls Section */}
                <div>
                    <h2>Extraction Settings</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Time Range Controls */}
                        <div>
                            <h3>Time Range</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button onClick={handleSetStart}>Set Start</button>
                                <input
                                    type="number"
                                    value={startTime}
                                    onChange={(e) => setStartTime(Number(e.target.value))}
                                    style={{ width: '100px' }}
                                />
                                <span>ms ({formatTime(startTime)})</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                <button onClick={handleSetEnd}>Set End</button>
                                <input
                                    type="number"
                                    value={endTime}
                                    onChange={(e) => setEndTime(Number(e.target.value))}
                                    style={{ width: '100px' }}
                                />
                                <span>ms ({formatTime(endTime)})</span>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                <label>
                                    Interval (ms):
                                    <input
                                        type="number"
                                        value={interval}
                                        onChange={(e) => setInterval(Number(e.target.value))}
                                        style={{ marginLeft: '0.5rem', width: '100px' }}
                                        min="100"
                                        step="100"
                                    />
                                </label>
                            </div>

                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                Estimated frames: {estimatedFrames}
                            </p>
                        </div>

                        {/* Crop Region Controls */}
                        <div>
                            <h3>Crop Region</h3>
                            <button onClick={captureCurrentFrame}>
                                {showCropTool ? 'Recapture Frame' : 'Capture Frame for Cropping'}
                            </button>

                            {showCropTool && capturedFrame && (
                                <div style={{ marginTop: '1rem' }}>
                                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                        Draw a rectangle around the sheet music:
                                    </p>
                                    <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc' }}>
                                        <ReactCrop
                                            crop={crop}
                                            onChange={(c) => {
                                                // Ensure coordinates are not negative
                                                const validCrop = {
                                                    ...c,
                                                    x: Math.max(0, c.x || 0),
                                                    y: Math.max(0, c.y || 0)
                                                };
                                                setCrop(validCrop);
                                            }}
                                            minWidth={50}
                                            minHeight={50}
                                        >
                                            <img
                                                ref={imgRef}
                                                src={capturedFrame}
                                                alt="Video frame"
                                                style={{ maxWidth: '100%' }}
                                                onLoad={handleImageLoad}
                                            />
                                        </ReactCrop>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                                        Crop: ({Math.round(crop.x)}, {Math.round(crop.y)}) -
                                        {Math.round(crop.width || 0)} x {Math.round(crop.height || 0)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Extract Button */}
                        <div style={{ marginTop: '1rem' }}>
                            {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}
                            <button
                                onClick={handleExtract}
                                disabled={extracting || !showCropTool}
                                style={{
                                    padding: '1rem 2rem',
                                    fontSize: '1.1rem',
                                    backgroundColor: showCropTool ? '#4CAF50' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: extracting || !showCropTool ? 'not-allowed' : 'pointer',
                                    width: '100%'
                                }}
                            >
                                {extracting ? 'Extracting...' : 'Extract to PDF'}
                            </button>
                            {!showCropTool && (
                                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                                    Please capture a frame and select crop region first
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
