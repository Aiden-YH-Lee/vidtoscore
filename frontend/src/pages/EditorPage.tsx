import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface VideoData {
    filename: string;
    title: string;
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
    interface FrameData {
        id: number;
        data: string;
        timestamp: number;
    }
    const [previewFrames, setPreviewFrames] = useState<FrameData[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [extractedFrameDimensions, setExtractedFrameDimensions] = useState({ width: 1, height: 1 });
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

    // Recalculate optimal frames per page when crop or settings change
    useEffect(() => {
        calculateOptimalFramesPerPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crop.width, crop.height, frameWidthPercent, frameGap]);

    // Keyboard shortcuts for video navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const video = videoRef.current;
            if (!video || !videoData) return;

            // Ignore if user is typing in an input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const frameDuration = 1 / videoData.fps; // Duration of one frame in seconds
            const smallJump = 1; // 1 second for Shift+Arrow
            const largeJump = 5; // 5 seconds for regular Arrow

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Frame-by-frame backward
                        video.currentTime = Math.max(0, video.currentTime - frameDuration);
                    } else if (e.metaKey || e.ctrlKey) {
                        // 1 second backward
                        video.currentTime = Math.max(0, video.currentTime - smallJump);
                    } else {
                        // 5 seconds backward
                        video.currentTime = Math.max(0, video.currentTime - largeJump);
                    }
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Frame-by-frame forward
                        video.currentTime = Math.min(videoData.duration / 1000, video.currentTime + frameDuration);
                    } else if (e.metaKey || e.ctrlKey) {
                        // 1 second forward
                        video.currentTime = Math.min(videoData.duration / 1000, video.currentTime + smallJump);
                    } else {
                        // 5 seconds forward
                        video.currentTime = Math.min(videoData.duration / 1000, video.currentTime + largeJump);
                    }
                    break;

                case ' ':
                    e.preventDefault();
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                    break;

                case 's':
                    if (!e.metaKey && !e.ctrlKey) { // Avoid interfering with Cmd+S/Ctrl+S
                        e.preventDefault();
                        const currentMs = Math.floor(video.currentTime * 1000);
                        setStartTime(currentMs);
                    }
                    break;

                case 'e':
                    if (!e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        const currentMs = Math.floor(video.currentTime * 1000);
                        setEndTime(currentMs);
                    }
                    break;

                case 'c':
                    if (!e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        // Trigger capture - we'll need to use a state or ref for this
                        video.dispatchEvent(new CustomEvent('captureFrame'));
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [videoData]);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const videoUrl = videoData ? `${API_URL}/api/video/file/${videoData.filename}` : '';

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Parse MM:SS format to milliseconds
    const parseTime = (timeStr: string): number => {
        const parts = timeStr.split(':');
        if (parts.length === 1) {
            // Just a number, treat as seconds
            const seconds = parseInt(parts[0]) || 0;
            return seconds * 1000;
        } else if (parts.length === 2) {
            // MM:SS format
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            return (minutes * 60 + seconds) * 1000;
        }
        return 0;
    };

    const handleSetStart = () => {
        const currentMs = Math.floor(currentTime * 1000);
        setStartTime(currentMs);
    };

    const handleSetEnd = () => {
        const currentMs = Math.floor(currentTime * 1000);
        setEndTime(currentMs);
    };

    const handleMeasureInterval = () => {
        const currentMs = Math.floor(currentTime * 1000);
        const diff = currentMs - startTime;
        if (diff >= 100) {
            setInterval(diff);
        } else {
            alert("Interval must be at least 100ms. Please advance the video past the Start Time.");
        }
    };

    const captureCurrentFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        // If this is the first capture, seek to middle of video first
        if (!showCropTool && videoData) {
            const middleTime = videoData.duration / 2000; // Convert ms to seconds and divide by 2
            console.log(`First capture: seeking to middle of video (${formatTime(middleTime * 1000)})`);

            // Set up one-time event listener for when seek completes
            const handleSeeked = () => {
                video.removeEventListener('seeked', handleSeeked);
                performCapture();
            };

            video.addEventListener('seeked', handleSeeked);
            video.currentTime = middleTime;
            return; // Exit and let the seeked event trigger the capture
        }

        // Otherwise capture current frame immediately
        performCapture();
    }, [showCropTool, videoData]);

    const performCapture = () => {
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

    // Listen for capture frame event from keyboard shortcut
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleCaptureEvent = () => {
            captureCurrentFrame();
        };

        video.addEventListener('captureFrame', handleCaptureEvent);
        return () => video.removeEventListener('captureFrame', handleCaptureEvent);
    }, [captureCurrentFrame]);

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

    // Calculate optimal frames per page based on crop dimensions
    const calculateOptimalFramesPerPage = () => {
        if (!crop.width || !crop.height) return;

        // Use A4 dimensions (at 72 DPI for calculation, will scale proportionally at 300 DPI)
        const A4_WIDTH = 595;
        const A4_HEIGHT = 842;
        const PAGE_MARGIN = 40;
        const TITLE_HEIGHT = 30;

        const availableWidth = A4_WIDTH - (2 * PAGE_MARGIN);
        const availableHeight = A4_HEIGHT - (2 * PAGE_MARGIN) - TITLE_HEIGHT; // Backend doesn't subtract page number space

        const aspectRatio = crop.height / crop.width;

        // Try different frame counts and find the maximum that fits
        let optimalFrames = 1;
        for (let testFrames = 1; testFrames <= 20; testFrames++) {
            // Calculate frame size using width constraint
            const targetWidth = availableWidth * (frameWidthPercent / 100);
            const targetHeight = targetWidth * aspectRatio;

            // Calculate total height needed for this many frames
            const totalHeight = (targetHeight * testFrames) + (frameGap * (testFrames - 1));

            // Check if it fits with some safety margin (5px)
            if (totalHeight <= availableHeight - 5) {
                optimalFrames = testFrames;
            } else {
                // Exceeded available space, use previous value
                break;
            }
        }

        console.log('Optimal frames calculation:', {
            cropSize: `${crop.width}x${crop.height}`,
            aspectRatio: aspectRatio.toFixed(3),
            availableHeight: availableHeight.toFixed(0),
            optimalFrames
        });

        if (optimalFrames > 0 && optimalFrames !== framesPerPage) {
            setFramesPerPage(optimalFrames);
            console.log(`Auto-set frames per page to ${optimalFrames}`);
        }
    };

    // Delete a frame from preview
    const handleDeleteFrame = (frameId: number) => {
        setPreviewFrames(frames => frames.filter(f => f.id !== frameId));
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

            const frames: FrameData[] = [];
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
            let frameId = 0;
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
                            frames.push({ id: frameId++, data: dataUrl, timestamp: time });
                            console.log(`Extracted frame ${frameId} at ${time}ms`);
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
            setExtractedFrameDimensions({ width: finalWidth, height: finalHeight });
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
        setExtracting(true);
        setError('');

        try {
            let response;

            // If we have preview frames, use them directly
            if (previewFrames.length > 0) {
                console.log(`Extracting PDF from ${previewFrames.length} previewed frames`);

                response = await fetch(`${API_URL}/api/video/extract-from-frames`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        frames: previewFrames.map(f => f.data),
                        framesPerPage: framesPerPage,
                        frameWidthPercent: frameWidthPercent,
                        gap: frameGap,
                        title: videoData!.title
                    }),
                });
            } else {
                // Fall back to extracting from video (old method)
                console.log('No preview frames available, extracting from video');

                if (startTime >= endTime) {
                    setError('End time must be after start time');
                    setExtracting(false);
                    return;
                }

                if (interval <= 0) {
                    setError('Interval must be greater than 0');
                    setExtracting(false);
                    return;
                }

                if (!crop.width || !crop.height) {
                    setError('Please select a crop region');
                    setExtracting(false);
                    return;
                }

                // Scale crop coordinates from displayed image to natural image size
                const scaleX = capturedImageDimensions.natural.width / capturedImageDimensions.displayed.width;
                const scaleY = capturedImageDimensions.natural.height / capturedImageDimensions.displayed.height;

                const x1 = Math.max(0, Math.round(crop.x * scaleX));
                const y1 = Math.max(0, Math.round(crop.y * scaleY));
                const x2 = Math.min(videoDimensions.width, Math.round((crop.x + (crop.width || 0)) * scaleX));
                const y2 = Math.min(videoDimensions.height, Math.round((crop.y + (crop.height || 0)) * scaleY));

                if (x1 >= x2 || y1 >= y2) {
                    setError('Invalid crop region. Please redraw the crop area.');
                    setExtracting(false);
                    return;
                }

                response = await fetch(`${API_URL}/api/video/extract`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: videoData!.filename,
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
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Extraction failed');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Use video title as filename, sanitized for file system
            const sanitizedTitle = videoData!.title
                .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
                .replace(/\s+/g, '_')          // Replace spaces with underscores
                .substring(0, 100);            // Limit length
            a.download = `${sanitizedTitle || 'sheet_music'}.pdf`;
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

    const styles = {
        container: {
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            padding: '2rem'
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            background: 'white',
            padding: '1.5rem 2rem',
            borderRadius: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        },
        title: {
            fontSize: '2rem',
            fontWeight: '800',
            color: '#1f2937',
            margin: 0,
            letterSpacing: '-0.02em'
        },
        backButton: {
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            color: '#6b7280',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        },
        card: {
            background: 'white',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            height: '100%'
        },
        sectionTitle: {
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#1f2937',
            marginTop: 0,
            marginBottom: '1.5rem',
            letterSpacing: '-0.01em'
        },
        button: {
            padding: '0.75rem 1.25rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            color: 'white',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        },
        input: {
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            outline: 'none',
            transition: 'all 0.2s ease',
            fontFamily: 'monospace',
            background: '#f9fafb'
        },
        subsectionTitle: {
            fontSize: '1rem',
            fontWeight: '600',
            color: '#4b5563',
            marginBottom: '0.75rem',
            marginTop: '1.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
        } as React.CSSProperties,
        previewContainer: {
            marginTop: '2rem',
            padding: '2rem',
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        } as React.CSSProperties
    };

    if (!videoData) {
        return null;
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Video Editor</h1>
                <button
                    onClick={() => navigate('/')}
                    style={styles.backButton}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e5e7eb';
                        e.currentTarget.style.color = '#1f2937';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.color = '#6b7280';
                    }}
                >
                    ← Back to Home
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Video Player Section */}
                <div style={styles.card}>
                    <h2 style={styles.sectionTitle}>Video Preview</h2>
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
                        <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {videoData.title}
                        </p>

                        {/* Detailed time display */}
                        <div style={{
                            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                            padding: '1rem',
                            borderRadius: '8px',
                            marginBottom: '0.75rem',
                            border: '1px solid #e5e7eb'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Current Time:</span>
                                    <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
                                        {formatTime(currentTime * 1000)}.{Math.floor((currentTime * 1000) % 1000).toString().padStart(3, '0')}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Frame:</span>
                                    <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
                                        {Math.floor(currentTime * videoData.fps)} / {Math.floor((videoData.duration / 1000) * videoData.fps)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p>Duration: {formatTime(videoData.duration)}</p>
                        <p>Resolution: {videoData.width} x {videoData.height}</p>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                            FPS: {videoData.fps.toFixed(2)} ({(1000 / videoData.fps).toFixed(0)}ms per frame)
                        </p>
                    </div>

                    {/* Keyboard Shortcuts Help */}
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%)',
                        borderRadius: '12px',
                        border: '1px solid #d1d9ff'
                    }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', color: '#4338ca' }}>
                            ⌨️ Keyboard Shortcuts
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'grid', gap: '0.4rem' }}>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>Space</kbd> Play/Pause</div>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>←/→</kbd> Jump 5 seconds</div>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>Cmd/Ctrl + ←/→</kbd> Jump 1 second</div>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>Shift + ←/→</kbd> Frame by frame</div>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>S</kbd> Set Start Time</div>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>E</kbd> Set End Time</div>
                            <div><kbd style={{ background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>C</kbd> Capture Frame</div>
                        </div>
                    </div>
                </div>

                {/* Controls Section */}
                <div style={styles.card}>
                    <h2 style={styles.sectionTitle}>Extraction Settings</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Time Range Controls */}
                        <div>
                            <h3 style={styles.subsectionTitle}>Time Range</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button onClick={handleSetStart} style={{ ...styles.button, minWidth: '80px', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>Set Start</button>
                                <input
                                    type="text"
                                    value={formatTime(startTime)}
                                    onChange={(e) => {
                                        const ms = parseTime(e.target.value);
                                        if (ms >= 0) setStartTime(ms);
                                    }}
                                    placeholder="MM:SS"
                                    style={{ ...styles.input, width: '80px', padding: '0.5rem' }}
                                />
                                <span style={{ fontSize: '0.85rem', color: '#666' }}>({startTime}ms)</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                <button onClick={handleSetEnd} style={{ ...styles.button, minWidth: '80px', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>Set End</button>
                                <input
                                    type="text"
                                    value={formatTime(endTime)}
                                    onChange={(e) => {
                                        const ms = parseTime(e.target.value);
                                        if (ms >= 0) setEndTime(ms);
                                    }}
                                    placeholder="MM:SS"
                                    style={{ ...styles.input, width: '80px', padding: '0.5rem' }}
                                />
                                <span style={{ fontSize: '0.85rem', color: '#666' }}>({endTime}ms)</span>
                            </div>

                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center' }}>
                                    Interval (ms):
                                    <input
                                        type="number"
                                        value={interval}
                                        onChange={(e) => setInterval(Number(e.target.value))}
                                        style={{ ...styles.input, marginLeft: '0.5rem', width: '100px', padding: '0.5rem' }}
                                        min="100"
                                        step="100"
                                    />
                                </label>
                                <button
                                    onClick={handleMeasureInterval}
                                    style={{ ...styles.button, fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                                    title="Set interval to the duration between Start Time and current video time"
                                >
                                    Measure from Start
                                </button>
                            </div>

                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                Estimated frames: {estimatedFrames}
                            </p>
                        </div>

                        {/* Crop Region Controls */}
                        <div>
                            <h3 style={styles.subsectionTitle}>Crop Region</h3>
                            <button onClick={captureCurrentFrame} style={styles.button}>
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
                            <h3 style={styles.subsectionTitle}>PDF Layout (A4 Page)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                        Frames per page:
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="number"
                                            value={framesPerPage}
                                            onChange={(e) => setFramesPerPage(Math.max(1, Number(e.target.value)))}
                                            style={{ ...styles.input, width: '80px', padding: '0.5rem' }}
                                            min="1"
                                            max="20"
                                        />
                                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                                            (stacked vertically)
                                        </span>
                                        {crop.width && crop.height && (
                                            <button
                                                onClick={calculateOptimalFramesPerPage}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    backgroundColor: '#4CAF50',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease',
                                                    boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                                                }}
                                                title="Auto-calculate optimal frames per page"
                                            >
                                                Auto
                                            </button>
                                        )}
                                    </div>
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
                                        style={{ ...styles.input, width: '80px', padding: '0.5rem' }}
                                        min="0"
                                        max="50"
                                    />
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>px</span>
                                </div>
                            </div>
                        </div>

                        {/* Preview and Extract Buttons */}
                        <div style={{ marginTop: '1rem' }}>
                            {error && <p style={{ color: '#ef4444', marginBottom: '0.5rem', fontWeight: '500' }}>{error}</p>}

                            <button
                                onClick={handlePreview}
                                disabled={extracting || !showCropTool}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    background: showCropTool ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: extracting || !showCropTool ? 'not-allowed' : 'pointer',
                                    width: '100%',
                                    marginBottom: '0.5rem',
                                    transition: 'all 0.3s ease',
                                    boxShadow: showCropTool ? '0 2px 8px rgba(33, 150, 243, 0.3)' : 'none'
                                }}
                            >
                                {extracting ? 'Generating...' : 'Preview Frames'}
                            </button>

                            <button
                                onClick={handleExtract}
                                disabled={extracting || (!showCropTool && previewFrames.length === 0)}
                                style={{
                                    padding: '1rem 2rem',
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    background: (showCropTool || previewFrames.length > 0) ? 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)' : '#ccc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: extracting || (!showCropTool && previewFrames.length === 0) ? 'not-allowed' : 'pointer',
                                    width: '100%',
                                    transition: 'all 0.3s ease',
                                    boxShadow: (showCropTool || previewFrames.length > 0) ? '0 2px 8px rgba(76, 175, 80, 0.3)' : 'none'
                                }}
                            >
                                {extracting ? 'Extracting...' :
                                    previewFrames.length > 0 ? `Extract ${previewFrames.length} Frames to PDF` :
                                        'Extract to PDF'}
                            </button>
                            {!showCropTool && previewFrames.length === 0 && (
                                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                                    Please capture a frame and select crop region first
                                </p>
                            )}
                            {previewFrames.length > 0 && (
                                <p style={{ fontSize: '0.9rem', color: '#4CAF50', marginTop: '0.5rem' }}>
                                    Ready to extract {previewFrames.length} previewed frame{previewFrames.length > 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Page-based Preview Section */}
            {showPreview && previewFrames.length > 0 && (
                <div style={styles.previewContainer}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
                            PDF Preview ({previewFrames.length} frames, {Math.ceil(previewFrames.length / framesPerPage)} pages)
                        </h2>
                        <button
                            onClick={() => setShowPreview(false)}
                            style={{
                                padding: '0.75rem 1.25rem',
                                fontSize: '0.95rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                backgroundColor: '#fff',
                                color: '#667eea',
                                border: '2px solid #667eea',
                                borderRadius: '10px',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#667eea';
                                e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff';
                                e.currentTarget.style.color = '#667eea';
                            }}
                        >
                            Close Preview
                        </button>
                    </div>

                    <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.95rem' }}>
                        Layout: {framesPerPage} frame{framesPerPage > 1 ? 's' : ''} per page (stacked vertically), {frameWidthPercent}% width, {frameGap}px gap
                    </p>

                    {/* Page Preview - A4 sized pages with vertically stacked frames */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2rem',
                        maxHeight: '800px',
                        overflow: 'auto',
                        padding: '2rem',
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                        borderRadius: '12px'
                    }}>
                        {(() => {
                            const pages = [];
                            const totalPages = Math.ceil(previewFrames.length / framesPerPage);

                            // Calculate frame dimensions like the backend does
                            const A4_WIDTH = 595;
                            const A4_HEIGHT = 842;
                            const PAGE_MARGIN = 40;
                            // Title takes 30px + 15px margin = 45px total in the preview layout
                            const TITLE_HEIGHT = videoData.title ? 45 : 0;

                            const availableWidth = A4_WIDTH - (2 * PAGE_MARGIN);
                            const availableHeight = A4_HEIGHT - (2 * PAGE_MARGIN) - TITLE_HEIGHT;

                            // Get aspect ratio from actual extracted frame dimensions
                            const aspectRatio = extractedFrameDimensions.height / extractedFrameDimensions.width;

                            // Width constraint
                            const widthConstrainedWidth = availableWidth * (frameWidthPercent / 100);
                            const widthConstrainedHeight = widthConstrainedWidth * aspectRatio;

                            // Height constraint
                            const maxFrameHeight = (availableHeight - (frameGap * (framesPerPage - 1))) / framesPerPage;

                            // Use the smaller of the two constraints
                            let targetFrameWidth: number;
                            let targetFrameHeight: number;

                            if (widthConstrainedHeight * framesPerPage + (frameGap * (framesPerPage - 1)) <= availableHeight) {
                                targetFrameWidth = widthConstrainedWidth;
                                targetFrameHeight = widthConstrainedHeight;
                            } else {
                                targetFrameHeight = maxFrameHeight;
                                targetFrameWidth = targetFrameHeight / aspectRatio;
                            }

                            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                                const pageFrames = previewFrames.slice(
                                    pageNum * framesPerPage,
                                    (pageNum + 1) * framesPerPage
                                );

                                pages.push(
                                    <div key={pageNum} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'center',
                                        gap: '20px'
                                    }}>
                                        {/* A4 Page */}
                                        <div style={{
                                            backgroundColor: 'white',
                                            padding: '40px',
                                            border: 'none',
                                            borderRadius: '12px',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                                            width: '595px', // A4 width (matches backend PDF)
                                            minHeight: '842px', // A4 height
                                            position: 'relative',
                                            boxSizing: 'border-box'
                                        }}>
                                            {/* Title (if present) */}
                                            {videoData.title && (
                                                <div style={{
                                                    fontSize: '1rem',
                                                    color: '#000',
                                                    marginBottom: '15px',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {videoData.title}
                                                </div>
                                            )}

                                            {/* Page number at bottom - absolute positioned to not affect layout */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '12px',
                                                left: '0',
                                                right: '0',
                                                fontSize: '16px',
                                                fontWeight: '600',
                                                color: '#555',
                                                textAlign: 'center'
                                            }}>
                                                {pageNum + 1} / {totalPages}
                                            </div>

                                            {/* Vertically stacked frames */}
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: `${frameGap}px`,
                                                alignItems: 'center'
                                            }}>
                                                {pageFrames.map((frame, frameIdx) => (
                                                    <div key={frame.id} style={{
                                                        width: `${targetFrameWidth}px`,
                                                        border: '1px solid #ddd',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}>
                                                        <img
                                                            src={frame.data}
                                                            alt={`Frame ${pageNum * framesPerPage + frameIdx + 1}`}
                                                            style={{ width: '100%', height: 'auto', display: 'block' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Side controls - outside the A4 page */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px',
                                            paddingTop: videoData.title ? '95px' : '50px',
                                            minWidth: '80px'
                                        }}>
                                            {pageFrames.map((frame, frameIdx) => (
                                                <div key={frame.id} style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    height: `${targetFrameHeight + frameGap}px`,
                                                    fontSize: '0.75rem',
                                                    color: '#666'
                                                }}>
                                                    <span style={{ fontWeight: '600' }}>#{pageNum * framesPerPage + frameIdx + 1}</span>
                                                    <span>{formatTime(frame.timestamp)}</span>
                                                    <button
                                                        onClick={() => handleDeleteFrame(frame.id)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.3s ease',
                                                            boxShadow: '0 2px 6px rgba(255, 68, 68, 0.3)'
                                                        }}
                                                        title="Delete this frame"
                                                    >
                                                        Delete
                                                    </button>
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
