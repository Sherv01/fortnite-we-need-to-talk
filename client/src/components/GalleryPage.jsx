import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const GalleryPage = () => {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);
  const [loadingThumbnails, setLoadingThumbnails] = useState({});
  const [thumbnailErrors, setThumbnailErrors] = useState({});

  // Truncate summary to first 4 words with ellipsis
  const truncateSummary = (summary) => {
    if (!summary || typeof summary !== 'string') return 'No summary available';
    const words = summary.split(' ');
    return words.length > 10 ? words.slice(0, 10).join(' ') + '...' : summary;
  };

  // Debounce function to limit API calls
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Generate thumbnail with debouncing
  const generateThumbnail = debounce(async (video_id, summary) => {
    try {
      console.log(`Generating thumbnail for video ${video_id}`);
      const response = await axios.post('http://localhost:5000/api/generate-image', {
        video_id,
        summary
      });
      if (response.data.error) {
        setThumbnailErrors(prev => ({ ...prev, [video_id]: response.data.error }));
      }
      // Refetch videos to update thumbnail_urls
      const updatedResponse = await axios.get('http://localhost:5000/api/videos');
      setVideos(updatedResponse.data);
    } catch (err) {
      console.error(`Failed to generate thumbnail for video ${video_id}:`, err);
      setThumbnailErrors(prev => ({ ...prev, [video_id]: err.response?.data?.error || 'Failed to generate thumbnail' }));
    }
    setLoadingThumbnails(prev => ({ ...prev, [video_id]: false }));
  }, 1000);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        console.log('Fetching videos from backend');
        const response = await axios.get('http://localhost:5000/api/videos');
        console.log('Received videos:', response.data);
        setVideos(response.data);

        // Initialize loading state and generate thumbnails
        const initialLoading = {};
        response.data.forEach(video => {
          if (!video.thumbnail_url || video.thumbnail_url === 'http://localhost:5173/placeholder.png') {
            initialLoading[video.video_id] = true;
            generateThumbnail(video.video_id, video.summary);
          }
        });
        setLoadingThumbnails(initialLoading);
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError('Failed to load videos. Please try again later.');
      }
    };
    fetchVideos();
  }, []);

  const retryThumbnail = async (video_id, summary) => {
    setLoadingThumbnails(prev => ({ ...prev, [video_id]: true }));
    setThumbnailErrors(prev => ({ ...prev, [video_id]: null }));
    generateThumbnail(video_id, summary);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-fortnite-blue to-fortnite-cyan flex flex-col">
      {/* Navbar */}
      <nav className="bg-fortnite-yellow p-4 flex justify-center space-x-4">
        <Link
          to="/"
          className="text-black text-xl"
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        >
          Upload
        </Link>
        <Link
          to="/gallery"
          className="text-black text-xl underline"
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        >
          Gallery
        </Link>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-4">
        <h1
          className="text-4xl text-fortnite-yellow mb-8 text-center"
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        >
          Fortnite VOD Gallery
        </h1>
        {error && (
          <p className="text-red-500 text-lg text-center" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {videos.length > 0 ? (
            videos.map((video) => (
              <Link
                key={video.video_id}
                to={`/feedback/${video.video_id}`}
                state={{
                  video_path: video.video_path,
                  advice: video.advice,
                  chapters: video.chapters,
                  summary: video.summary
                }}
                className="bg-white p-4 rounded-lg shadow-lg hover:scale-105 transition-all"
              >
                <h2
                  className="text-xl text-fortnite-yellow mb-2"
                  style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                >
                  {video.filename.replace(/%20/g, ' ')}
                </h2>
                {loadingThumbnails[video.video_id] ? (
                  <div className="w-full h-40 bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                    <p className="text-gray-500" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                      Generating thumbnail...
                    </p>
                  </div>
                ) : thumbnailErrors[video.video_id] ? (
                  <div className="w-full h-40 bg-gray-200 rounded-lg mb-2 flex flex-col items-center justify-center">
                    <p className="text-red-500 text-sm" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                      {thumbnailErrors[video.video_id]}
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        retryThumbnail(video.video_id, video.summary);
                      }}
                      className="mt-2 bg-fortnite-yellow text-black px-4 py-2 rounded"
                      style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <img
                    src={video.thumbnail_url || '/placeholder.png'}
                    alt={video.filename}
                    className="w-full h-40 object-cover rounded-lg mb-2"
                  />
                )}
                <p className="text-black" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                  {truncateSummary(video.summary)}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-gray-500 text-lg text-center col-span-full" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
              No videos available. Upload a clip to get started!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GalleryPage;