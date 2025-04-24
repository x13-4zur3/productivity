import { motion } from 'framer-motion';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';

function ThemeSelector({ currentTheme, onThemeChange, isDarkMode }) {
  const themes = [
    { id: 'light', icon: SunIcon, label: 'Light' },
    { id: 'dark', icon: MoonIcon, label: 'Dark' },
    { id: 'system', icon: ComputerDesktopIcon, label: 'System' }
  ];

  return (
    <div className={`inline-flex rounded-lg p-1 ${
      isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
    }`}>
      {themes.map(theme => (
        <button
          key={theme.id}
          onClick={() => onThemeChange(theme.id)}
          className={`relative px-3 py-2 rounded-md flex items-center space-x-2 ${
            currentTheme === theme.id
              ? isDarkMode
                ? 'bg-gray-700 text-white'
                : 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {currentTheme === theme.id && (
            <motion.div
              layoutId="theme-selector-active"
              className="absolute inset-0 rounded-md"
              transition={{ type: "spring", duration: 0.5 }}
            />
          )}
          <theme.icon className="w-5 h-5" />
          <span className="text-sm font-medium">{theme.label}</span>
        </button>
      ))}
    </div>
  );
}

export default ThemeSelector;

