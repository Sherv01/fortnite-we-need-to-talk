import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import MapView from './components/MapView';
import UploadPage from './components/UploadPage';
import GalleryPage from './components/GalleryPage';
import FeedbackPage from './components/FeedbackPage';

function App() {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/feedback/:video_id" element={<FeedbackPage />} />
      </Routes>
    </Router>
  );
}

export default App;