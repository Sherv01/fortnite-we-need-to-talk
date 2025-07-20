import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import axios from 'axios';

const FeedbackPage = () => {
  const { video_id } = useParams();
  const { state } = useLocation();
  const [activeTab, setActiveTab] = useState('feedback');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatError, setChatError] = useState(null);

  const { video_path = '', advice = { good: [], bad: [], improve: [] }, chapters = [], summary = '' } = state || {};

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleChatInput = (e) => {
    setChatInput(e.target.value);
    setChatError(null);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      console.log('Sending chat message:', chatInput);
      const response = await axios.post('http://localhost:5000/api/chat', {
        video_id,
        message: chatInput,
        summary
      });
      console.log('Chat response:', response.data);
      setChatHistory(response.data.history);
      setChatInput('');
    } catch (err) {
      console.error('Chat submit error:', err);
      setChatError('Failed to get AI response. Try again later.');
    }
  };

  console.log('FeedbackPage state:', { video_id, video_path, advice, chapters, summary });

  // Error boundary fallback
  if (!video_path || !advice) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-fortnite-blue to-fortnite-cyan flex flex-col items-center justify-center">
        <p className="text-red-500 text-lg" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
          No video or feedback data available. Please upload a video first.
        </p>
        <Link
          to="/"
          className="text-fortnite-yellow text-xl mt-4"
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // URL-encode filename for video URL
  const encodedVideoPath = encodeURIComponent(video_path.split('/').pop());
  const videoUrl = video_path.startsWith('http') ? video_path : `http://localhost:5000/uploads/${encodedVideoPath}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-fortnite-blue to-fortnite-cyan flex flex-col">
      {/* Navbar */}
      <nav className="bg-fortnite-yellow p-4 flex justify-center space-x-4">
        <button
          className={`text-black text-xl ${activeTab === 'feedback' ? 'underline' : ''}`}
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
          onClick={() => handleTabChange('feedback')}
        >
          Feedback
        </button>
        <button
          className={`text-black text-xl ${activeTab === 'followup' ? 'underline' : ''}`}
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
          onClick={() => handleTabChange('followup')}
        >
          Follow Up
        </button>
        <Link
          to="/"
          className="text-black text-xl"
          style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        >
          Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 p-4">
        {/* Left: Video Player */}
        <div className="w-full md:w-1/2 p-4">
          <h2
            className="text-2xl text-fortnite-yellow mb-4"
            style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
          >
            Your Clip
          </h2>
          {video_path ? (
            <video
              controls
              src={videoUrl}
              className="w-full rounded-lg shadow-lg"
              onError={(e) => {
                console.error('Video playback error:', e);
                console.log('Attempted video URL:', videoUrl);
              }}
            />
          ) : (
            <p className="text-red-500 text-lg" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
              No video available.
            </p>
          )}
        </div>

        {/* Right: Feedback/Follow Up */}
        <div className="w-full md:w-1/2 p-4">
          {activeTab === 'feedback' && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2
                className="text-2xl text-fortnite-yellow mb-4"
                style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
              >
                Feedback
              </h2>
              {advice ? (
                <>
                  <h3
                    className="text-xl text-black mb-2"
                    style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                  >
                    What You Did Well
                  </h3>
                  <ul className="list-disc pl-5 mb-4">
                    {advice.good.length > 0 ? (
                      advice.good.map((item, index) => (
                        <li key={index} className="text-black">{item}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">No positive feedback available</li>
                    )}
                  </ul>
                  <h3
                    className="text-xl text-black mb-2"
                    style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                  >
                    What You Did Poorly
                  </h3>
                  <ul className="list-disc pl-5 mb-4">
                    {advice.bad.length > 0 ? (
                      advice.bad.map((item, index) => (
                        <li key={index} className="text-black">{item}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">No negative feedback available</li>
                    )}
                  </ul>
                  <h3
                    className="text-xl text-black mb-2"
                    style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                  >
                    How to Improve
                  </h3>
                  <ul className="list-disc pl-5">
                    {advice.improve.length > 0 ? (
                      advice.improve.map((item, index) => (
                        <li key={index} className="text-black">{item}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">No improvement suggestions available</li>
                    )}
                  </ul>
                  <h3
                    className="text-xl text-black mb-2 mt-4"
                    style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                  >
                    Chapters
                  </h3>
                  <ul className="list-disc pl-5">
                    {chapters.length > 0 ? (
                      chapters.map((chapter, index) => (
                        <li key={index} className="text-black">
                          {chapter.chapter_title} ({chapter.start}s - {chapter.end}s): {chapter.chapter_summary}
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500">No chapters available</li>
                    )}
                  </ul>
                </>
              ) : (
                <p className="text-red-500 text-lg" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                  No feedback available.
                </p>
              )}
            </div>
          )}
          {activeTab === 'followup' && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2
                className="text-2xl text-fortnite-yellow mb-4"
                style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
              >
                Follow Up
              </h2>
              <div className="h-64 overflow-y-auto bg-gray-100 p-4 rounded-lg mb-4">
                {chatHistory.length > 0 ? (
                  chatHistory.map((chat, index) => (
                    <div key={index} className="mb-2">
                      <p className="text-black font-bold" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                        You: {chat.user}
                      </p>
                      <p className="text-gray-700" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                        SypherPK: {chat.ai}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                    AI responses will appear here...
                  </p>
                )}
              </div>
              {chatError && (
                <p className="text-red-500 mb-4" style={{ fontFamily: "'Luckiest Guy', sans-serif" }}>
                  {chatError}
                </p>
              )}
              <form onSubmit={handleChatSubmit} className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={handleChatInput}
                  placeholder="Type your message..."
                  className="flex-1 p-2 border border-gray-300 rounded"
                  style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                />
                <button
                  type="submit"
                  className="parallelogram text-black font-bold py-2 px-4 text-xl bg-white hover:bg-fortnite-yellow hover:scale-110 transition-all"
                  style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
                >
                  <span className="inline-block transform skew-[20deg]">Send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;