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
    const [videoDimensions, setVideoDimensions] = useState({ width: 1, height: 1 });
    const [capturedImageDimensions, setCapturedImageDimensions] = useState({ natural: { width: 1, height: 1 }, displayed: { width: 1, height: 1 } });
    const imgRef = useRef<HTMLImageElement>(null);

    // Preview and layout controls
    const [previewFrames, setPreviewFrames] = useState<string[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [framesPerPage, setFramesPerPage] = useState(3); // Default: fit 3 frames per page
    const [frameGap, setFrameGap] = useState(10); // Gap between frames in pixels
    const [frameWidthPercent, setFrameWidthPercent] = useState(95); // Frame width as % of page width

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
            setVideoDimensions({
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
            const natural = {
                width: imgRef.current.naturalWidth,
                height: imgRef.current.naturalHeight
            };
            const displayed = {
                width: imgRef.current.clientWidth,
                height: imgRef.current.clientHeight
            };
            setCapturedImageDimensions({ natural, displayed });
            console.log('Natural image size:', natural.width, 'x', natural.height);
            console.log('Displayed image size:', displayed.width, 'x', displayed.height);
            console.log('Scale factor:', natural.width / displayed.width);
        }
    };

    // Generate preview frames
    const handlePreview = async () => {
        const video = videoRef.current;
        if (!video || !crop.width || !crop.height) {
            setError('Please select a crop region first');
            return;
        }

        setExtracting(true);
        setError('');
        setPreviewFrames([]);

        try {
            // Scale crop coordinates from displayed image to natural image size
            const scaleX = capturedImageDimensions.natural.width / capturedImageDimensions.displayed.width;
            const scaleY = capturedImageDimensions.natural.height / capturedImageDimensions.displayed.height;

            const x1 = Math.max(0, Math.round(crop.x * scaleX));
            const y1 = Math.max(0, Math.round(crop.y * scaleY));
            const width = Math.round((crop.width || 0) * scaleX);
            const height = Math.round((crop.height || 0) * scaleY);

            // Ensure coordinates are within video bounds
            const x2 = Math.min(videoDimensions.width, x1 + width);
            const y2 = Math.min(videoDimensions.height, y1 + height);
            const finalWidth = x2 - x1;
            const finalHeight = y2 - y1;

            console.log('Crop (displayed):', crop.x, crop.y, crop.width, crop.height);
            console.log('Scale factors:', scaleX, scaleY);
            console.log('Crop (natural):', x1, y1, finalWidth, finalHeight);
            console.log('Extracting frames with time:', startTime, 'to', endTime, 'interval', interval);

            const frames: string[] = [];
            const canvas = document.createElement('canvas');
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                setError('Failed to create canvas context');
                setExtracting(false);
                return;
            }

            const originalTime = video.currentTime;

            // Extract frames
            for (let time = startTime; time < endTime; time += interval) {
                await new Promise<void>((resolve) => {
                    const seekHandler = () => {
                        try {
                            // Draw cropped region
                            ctx.drawImage(
                                video,
                                x1, y1, finalWidth, finalHeight,  // source
                                0, 0, finalWidth, finalHeight      // destination
                            );
                            const dataUrl = canvas.toDataURL('image/png');
                            frames.push(dataUrl);
                            console.log(`Extracted frame at ${time}ms`);
                        } catch (e) {
                            console.error('Error drawing frame:', e);
                        }
                        video.removeEventListener('seeked', seekHandler);
                        resolve();
                    };

                    video.addEventListener('seeked', seekHandler);
                    video.currentTime = time / 1000;
                });
            }

            // Restore original time
            video.currentTime = originalTime;

            console.log(`Extracted ${frames.length} frames`);
            setPreviewFrames(frames);
            setShowPreview(true);
            setExtracting(false);
        } catch (error) {
            console.error('Preview error:', error);
            setError('Failed to generate preview: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setExtracting(false);
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

        // Scale crop coordinates from displayed image to natural image size
        const scaleX = capturedImageDimensions.natural.width / capturedImageDimensions.displayed.width;
        const scaleY = capturedImageDimensions.natural.height / capturedImageDimensions.displayed.height;

        const x1 = Math.max(0, Math.round(crop.x * scaleX));
        const y1 = Math.max(0, Math.round(crop.y * scaleY));
        const x2 = Math.min(videoDimensions.width, Math.round((crop.x + (crop.width || 0)) * scaleX));
        const y2 = Math.min(videoDimensions.height, Math.round((crop.y + (crop.height || 0)) * scaleY));

        console.log('Video dimensions:', videoDimensions.width, 'x', videoDimensions.height);
        console.log('Crop (displayed):', crop.x, crop.y, crop.width, crop.height);
        console.log('Scale factors:', scaleX, scaleY);
        console.log('Crop (scaled):', x1, y1, x2, y2);
        console.log('Crop size:', x2 - x1, 'x', y2 - y1);

        if (x1 >= x2 || y1 >= y2) {
            setError('Invalid crop region. Please redraw the crop area.');
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
                    interval: interval,
                    framesPerPage: framesPerPage,
                    frameWidthPercent: frameWidthPercent,
                    gap: frameGap
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

                        {/* PDF Layout Controls */}
                        <div>
                            <h3>PDF Layout (A4 Page)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                        Frames per page:
                                    </label>
                                    <input
                                        type="number"
                                        value={framesPerPage}
                                        onChange={(e) => setFramesPerPage(Math.max(1, Number(e.target.value)))}
                                        style={{ width: '80px', padding: '0.4rem' }}
                                        min="1"
                                        max="10"
                                    />
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                                        (stacked vertically)
                                    </span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                        Frame width: {frameWidthPercent}% of page
                                    </label>
                                    <input
                                        type="range"
                                        value={frameWidthPercent}
                                        onChange={(e) => setFrameWidthPercent(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                        min="70"
                                        max="100"
                                        step="5"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                        Gap between frames:
                                    </label>
                                    <input
                                        type="number"
                                        value={frameGap}
                                        onChange={(e) => setFrameGap(Math.max(0, Number(e.target.value)))}
                                        style={{ width: '80px', padding: '0.4rem' }}
                                        min="0"
                                        max="50"
                                    />
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>px</span>
                                </div>
                            </div>
                        </div>

                        {/* Preview and Extract Buttons */}
                        <div style={{ marginTop: '1rem' }}>
                            {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

                            <button
                                onClick={handlePreview}
                                disabled={extracting || !showCropTool}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    fontSize: '1rem',
                                    backgroundColor: showCropTool ? '#2196F3' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: extracting || !showCropTool ? 'not-allowed' : 'pointer',
                                    width: '100%',
                                    marginBottom: '0.5rem'
                                }}
                            >
                                {extracting ? 'Generating...' : 'Preview Frames'}
                            </button>

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

            {/* Page-based Preview Section */}
            {showPreview && previewFrames.length > 0 && (
                <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#2c2c2c', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ color: '#fff', margin: 0 }}>
                            PDF Preview ({previewFrames.length} frames, {Math.ceil(previewFrames.length / framesPerPage)} pages)
                        </h2>
                        <button
                            onClick={() => setShowPreview(false)}
                            style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#fff', border: 'none', borderRadius: '4px' }}
                        >
                            Close Preview
                        </button>
                    </div>

                    <p style={{ marginBottom: '1.5rem', color: '#ccc' }}>
                        Layout: {framesPerPage} frame{framesPerPage > 1 ? 's' : ''} per page (stacked vertically), {frameWidthPercent}% width, {frameGap}px gap
                    </p>

                    {/* Page Preview - A4 sized pages with vertically stacked frames */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2rem',
                        maxHeight: '800px',
                        overflow: 'auto',
                        padding: '1rem'
                    }}>
                        {(() => {
                            const pages = [];
                            const totalPages = Math.ceil(previewFrames.length / framesPerPage);

                            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                                const pageFrames = previewFrames.slice(
                                    pageNum * framesPerPage,
                                    (pageNum + 1) * framesPerPage
                                );

                                pages.push(
                                    <div key={pageNum} style={{
                                        backgroundColor: 'white',
                                        padding: '40px',
                                        border: '1px solid #888',
                                        borderRadius: '4px',
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                                        width: '700px', // Larger for better visibility
                                        minHeight: '990px', // A4 ratio: 700 * 1.414
                                        margin: '0 auto',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            color: '#666',
                                            marginBottom: '10px',
                                            textAlign: 'center',
                                            fontWeight: 'bold'
                                        }}>
                                            Page {pageNum + 1} of {totalPages}
                                        </div>
                                        {/* Vertically stacked frames */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: `${frameGap}px`,
                                            alignItems: 'center'
                                        }}>
                                            {pageFrames.map((frame, frameIdx) => (
                                                <div key={frameIdx} style={{
                                                    width: `${frameWidthPercent}%`,
                                                    border: '1px solid #ddd',
                                                    overflow: 'hidden',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                }}>
                                                    <img
                                                        src={frame}
                                                        alt={`Frame ${pageNum * framesPerPage + frameIdx + 1}`}
                                                        style={{ width: '100%', height: 'auto', display: 'block' }}
                                                    />
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        color: '#999',
                                                        padding: '3px',
                                                        textAlign: 'center',
                                                        backgroundColor: '#f9f9f9'
                                                    }}>
                                                        #{pageNum * framesPerPage + frameIdx + 1}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return pages;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
