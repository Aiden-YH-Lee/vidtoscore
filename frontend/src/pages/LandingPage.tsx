import { useState } from 'react';

export default function LandingPage() {
    const [url, setUrl] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
    }

    const handleClick = async () => {
        console.log('URL submitted:', url);
        try {
            const res = await fetch('http://localhost:5000/api/video/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            console.log('Response:', data);
        } catch (error) {
            console.error('Error:', error);
        }
    }

    return (
        <div>
            <h1>VidToScore</h1>
            <p>Extract sheet music from YouTube videos</p>
            <input
                type="text"
                value={url}
                onChange={handleInputChange}
                placeholder="Enter YouTube URL"
            />
            <button
                onClick={handleClick}
            >Extract</button>
        </div>
    );
}
