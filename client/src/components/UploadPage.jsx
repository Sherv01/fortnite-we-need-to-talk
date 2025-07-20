import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      console.log('Sending request to backend');
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else if (url) {
        formData.append('url', url);
      } else {
        setError('Please select a file or enter a URL');
        return;
      }

      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: { 'Content-Type': file ? 'multipart/form-data' : 'application/x-www-form-urlencoded' },
        timeout: 600000, // 10 minutes
      });
      console.log('Received response:', response.data);

      navigate(`/feedback/${response.data.video_id}`, {
        state: {
          video_path: response.data.video_path,
          advice: response.data.advice,
          chapters: response.data.chapters,
          summary: response.data.summary
        }
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload video. Ensure it meets requirements (360p-4K, 4s-60min, <2GB, audio track).');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-fortnite-blue to-fortnite-cyan flex flex-col items-center justify-center">
      <h1
        className="text-4xl text-fortnite-yellow mb-8"
        style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
      >
        Upload Your Fortnite Clip
      </h1>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="mb-4">
          <label
            className="block text-black text-lg mb-2"
            style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
          >
            Upload Video File
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div className="mb-4">
          <label
            className="block text-black text-lg mb-2"
            style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
          >
            Or Enter Video URL
          </label>
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://example.com/video.mp4"
            className="w-full p-2 border border-gray-300 rounded"
            style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
          />
        </div>
        {error && (
          <p className="text-red-500 mb-4" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          className="parallelogram text-black font-bold py-2 px-4 text-xl bg-white hover:bg-fortnite-yellow hover:scale-110 transition-all w-full"
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        >
          <span className="inline-block transform skew-[20deg]">Upload</span>
        </button>
      </form>
    </div>
  );
};

export default UploadPage;