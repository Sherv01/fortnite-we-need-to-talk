import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Physics, useBox } from '@react-three/cannon';
import axios from 'axios';

const Island = () => {
  const { scene } = useGLTF('/assets/fortnite_island.glb');
  const [floorRef] = useBox(() => ({
    type: 'Static',
    args: [10, 1, 10], // 10x10 floor
    position: [0, -0.5, 0], // Aligned with map surface
  }));
  const [northWallRef] = useBox(() => ({
    type: 'Static',
    args: [10, 1, 0.5],
    position: [0, -0.15, 5], // Top edge (z=5)
  }));
  const [southWallRef] = useBox(() => ({
    type: 'Static',
    args: [10, 1, 0.5],
    position: [0, -0.15, -5], // Bottom edge (z=-5)
  }));
  const [eastWallRef] = useBox(() => ({
    type: 'Static',
    args: [0.5, 1, 10],
    position: [5, -0.15, 0], // Right edge (x=5)
  }));
  const [westWallRef] = useBox(() => ({
    type: 'Static',
    args: [0.5, 1, 10],
    position: [-5, -0.15, 0], // Left edge (x=-5)
  }));

  return (
    <>
      <primitive object={scene} scale={[1, 1, 1]} />
      <mesh ref={floorRef} visible={false}>
        <boxGeometry args={[10, 1, 10]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      <mesh ref={northWallRef} visible={false}>
        <boxGeometry args={[10, 1, 0.5]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      <mesh ref={southWallRef} visible={false}>
        <boxGeometry args={[10, 1, 0.5]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      <mesh ref={eastWallRef} visible={false}>
        <boxGeometry args={[0.5, 1, 10]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      <mesh ref={westWallRef} visible={false}>
        <boxGeometry args={[0.5, 1, 10]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
    </>
  );
};

const Chest = ({ id, position, onClick }) => {
  const { scene } = useGLTF('/assets/chest.glb');
  const [ref] = useBox(() => ({
    mass: 1,
    args: [0.1, 0.1, 0.1], // Tighter physics box
    position,
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    angularVelocity: [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1],
    allowSleep: false,
    onCollide: () => console.log(`Chest ${id} collided with map`),
  }));

  return (
    <primitive
      object={scene}
      ref={ref}
      scale={[0.0001, 0.0001, 0.0001]} // Smaller scale
      onClick={onClick}
    />
  );
};

// Fallback cube if chest.glb is unavailable
const Cube = ({ id, position, onClick }) => {
  const [ref] = useBox(() => ({
    mass: 1,
    args: [0.2, 0.2, 0.2], // Tighter physics box
    position,
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    angularVelocity: [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1],
    allowSleep: false,
    onCollide: () => console.log(`Cube ${id} collided with map`),
  }));

  return (
    <mesh
      ref={ref}
      scale={[0.2, 0.2, 0.2]} // Smaller scale
      onClick={onClick}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#F3CF1A" />
    </mesh>
  );
};

const MapView = () => {
  const [chests, setChests] = useState([]);
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

  // Fetch videos on mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        console.log('Fetching videos for MapView');
        const response = await axios.get('http://localhost:5000/api/videos');
        setVideos(response.data);
      } catch (err) {
        console.error('Error fetching videos in MapView:', err);
      }
    };
    fetchVideos();
  }, []);

  // Handle chest click to navigate to a random video
  const handleChestClick = () => {
    if (videos.length === 0) {
      window.alert('No videos available! Upload a clip to get started.');
      return;
    }
    const randomIndex = Math.floor(Math.random() * videos.length);
    const randomVideo = videos[randomIndex];
    navigate(`/feedback/${randomVideo.video_id}`, {
      state: {
        video_path: randomVideo.video_path,
        advice: randomVideo.advice,
        chapters: randomVideo.chapters,
        summary: randomVideo.summary
      }
    });
  };

  const addChest = () => {
    const id = chests.length + 1;
    // Spawn within ±0.5x0.5 central area
    const offsetX = 0.1 + (Math.random() - 0.5) * 1; // ±0.5
    const offsetZ = 0.1 + (Math.random() - 0.5) * 1; // ±0.5
    setChests([...chests, { id, position: [offsetX, 1, offsetZ] }]);
  };

  return (
    <div className="relative h-[calc(100vh-80px)]">
      <button
        className="parallelogram absolute top-4 right-4 text-black font-bold py-2 px-4 text-xl bg-fortnite-yellow hover:bg-[#F3CF1A] hover:scale-110 transition-all z-10"
        style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
        onClick={addChest}
      >
        <span className="inline-block transform skew-[20deg]">Surprise Me</span>
      </button>
      <Canvas
        camera={{ position: [0.2, 0.3, 0.2], fov: 50 }}
        style={{ pointerEvents: 'auto' }}
      >
        <Physics gravity={[0, -9.81, 0]}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Island />
          {chests.map((chest) => (
            // Use Chest if chest.glb exists, else Cube
            <Chest
              key={chest.id}
              id={chest.id}
              position={chest.position}
              onClick={handleChestClick}
            />
            // <Cube key={chest.id} id={chest.id} position={chest.position} onClick={handleChestClick} />
          ))}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={0.01}
            maxDistance={0.85}
            target={[0, 0, 0]}
          />
        </Physics>
      </Canvas>
    </div>
  );
};

export default MapView;