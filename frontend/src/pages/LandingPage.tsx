import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const navigate = useNavigate();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
        setError('');
    }

    const handleClick = async () => {
        if (!url.trim()) {
            setError('Please enter a YouTube URL');
            return;
        }

        setLoading(true);
        setError('');
        setProgress(0);
        setStatusMessage('Starting download...');

        try {
            const res = await fetch('http://localhost:8080/api/video/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to start download');
            }

            const taskId = data.taskId;

            // Poll for status
            const pollInterval = window.setInterval(async () => {
                try {
                    const statusRes = await fetch(`http://localhost:8080/api/video/status/${taskId}`);
                    const statusData = await statusRes.json();

                    if (!statusRes.ok) {
                        clearInterval(pollInterval);
                        throw new Error(statusData.error || 'Failed to check status');
                    }

                    if (statusData.status === 'error') {
                        clearInterval(pollInterval);
                        setError(statusData.error || 'Download failed');
                        setLoading(false);
                    } else if (statusData.status === 'completed') {
                        clearInterval(pollInterval);
                        setProgress(100);
                        setStatusMessage('Complete!');
                        // Navigate to editor with video data
                        navigate('/editor', { state: { videoData: statusData.result } });
                    } else {
                        // Update progress
                        setProgress(statusData.progress || 0);
                        setStatusMessage(statusData.message || 'Processing...');
                    }
                } catch (err) {
                    clearInterval(pollInterval);
                    console.error('Polling error:', err);
                    setError('Failed to check download status');
                    setLoading(false);
                }
            }, 500);

        } catch (error) {
            console.error('Error:', error);
            setError(error instanceof Error ? error.message : 'Failed to process video');
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '600px',
                background: 'white',
                borderRadius: '24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
                padding: '4rem',
                animation: 'fadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '20px',
                        margin: '0 auto 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                        color: 'white',
                        boxShadow: '0 10px 25px rgba(102, 126, 234, 0.4)'
                    }}>
                        🎵
                    </div>
                    <h1 style={{
                        fontSize: '3rem',
                        fontWeight: '800',
                        color: '#1f2937',
                        marginBottom: '0.75rem',
                        letterSpacing: '-0.02em'
                    }}>
                        VidToScore
                    </h1>
                    <p style={{
                        fontSize: '1.25rem',
                        color: '#6b7280',
                        margin: 0,
                        lineHeight: 1.6
                    }}>
                        Extract sheet music from YouTube videos<br />
                        <span style={{ fontSize: '1rem', opacity: 0.8 }}>Fast, easy, and high quality.</span>
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <input
                            type="text"
                            value={url}
                            onChange={handleInputChange}
                            placeholder="Paste YouTube URL here..."
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem 1.25rem',
                                fontSize: '1rem',
                                border: '2px solid #e5e7eb',
                                borderRadius: '12px',
                                outline: 'none',
                                transition: 'all 0.3s ease',
                                backgroundColor: loading ? '#f9fafb' : 'white',
                                cursor: loading ? 'not-allowed' : 'text',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#667eea'}
                            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                        />
                        {error && (
                            <p style={{
                                color: '#ef4444',
                                fontSize: '0.875rem',
                                marginTop: '0.5rem',
                                marginBottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span>⚠️</span>
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleClick}
                        disabled={loading}
                        style={{
                            padding: '1rem 2rem',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: 'white',
                            background: loading
                                ? '#9ca3af'
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: loading
                                ? 'none'
                                : '0 4px 15px rgba(102, 126, 234, 0.4)',
                            transform: loading ? 'none' : 'translateY(0)',
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                            }
                        }}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                <span style={{
                                    width: '20px',
                                    height: '20px',
                                    border: '3px solid rgba(255,255,255,0.3)',
                                    borderTopColor: 'white',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }}></span>
                                {statusMessage || 'Processing Video...'}
                            </span>
                        ) : (
                            'Continue to Editor →'
                        )}
                    </button>

                    {loading && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '3px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    backgroundColor: '#667eea',
                                    transition: 'width 0.3s ease',
                                    borderRadius: '3px'
                                }} />
                            </div>
                            <p style={{
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                color: '#6b7280',
                                marginTop: '0.5rem',
                                marginBottom: 0
                            }}>
                                {Math.round(progress)}%
                            </p>
                        </div>
                    )}
                </div>

                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        </div>
    );
}
