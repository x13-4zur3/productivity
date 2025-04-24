import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../contexts/ThemeContext';

function Navbar() {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
    } shadow-lg transition-colors duration-200`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex space-x-8">
            <Link 
              to="/" 
              className={`text-lg font-semibold hover:text-blue-500 transition-colors ${
                isActive('/') ? 'text-blue-500' : ''
              }`}
            >
              Journal
            </Link>
            <Link 
              to="/todos" 
              className={`text-lg font-semibold hover:text-blue-500 transition-colors ${
                isActive('/todos') ? 'text-blue-500' : ''
              }`}
            >
              Todo List
            </Link>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '🌞' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
