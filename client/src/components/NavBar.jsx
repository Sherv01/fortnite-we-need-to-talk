import { NavLink } from 'react-router-dom';

const NavBar = () => {
  return (
    <nav className="flex justify-center space-x-4 py-4">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `parallelogram text-black font-bold py-2 px-4 text-xl ${
            isActive ? 'bg-[#F3CF1A] shadow-lg' : 'bg-white'
          }`
        }
        style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
      >
        Map
      </NavLink>
      <NavLink
        to="/upload"
        className={({ isActive }) =>
          `parallelogram text-black font-bold py-2 px-4 text-xl ${
            isActive ? 'bg-[#F3CF1A] shadow-lg' : 'bg-white'
          }`
        }
        style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
      >
        Upload
      </NavLink>
      <NavLink
        to="/gallery"
        className={({ isActive }) =>
          `parallelogram text-black font-bold py-2 px-4 text-xl ${
            isActive ? 'bg-[#F3CF1A] shadow-lg' : 'bg-white'
          }`
        }
        style={{ fontFamily: "'Luckiest Guy', sans-serif" }}
      >
        Gallery
      </NavLink>
    </nav>
  );
};

export default NavBar;