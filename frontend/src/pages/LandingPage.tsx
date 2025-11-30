import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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
                throw new Error(data.error || 'Failed to download video');
            }

            // Navigate to editor with video data
            navigate('/editor', { state: { videoData: data } });

        } catch (error) {
            console.error('Error:', error);
            setError(error instanceof Error ? error.message : 'Failed to process video');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h1>VidToScore</h1>
            <p>Extract sheet music from YouTube videos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                    type="text"
                    value={url}
                    onChange={handleInputChange}
                    placeholder="Enter YouTube URL"
                    style={{ padding: '0.5rem', fontSize: '1rem' }}
                    disabled={loading}
                />
                {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
                <button
                    onClick={handleClick}
                    disabled={loading}
                    style={{ padding: '0.5rem', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                    {loading ? 'Processing...' : 'Continue to Editor'}
                </button>
            </div>
        </div>
    );
}
