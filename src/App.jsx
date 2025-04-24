import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, ThemeContext } from './contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Journal from './pages/Journal';
import TodoList from './pages/TodoList';
import './styles/index.css';

function AppContent() {
  const { isDarkMode } = useContext(ThemeContext);
  const location = useLocation();
  
  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <Navbar />
      <AnimatePresence mode="wait">
        <main className="container mx-auto px-4 py-8 min-h-[calc(100vh-4rem)]">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Journal />} />
            <Route path="/todos" element={<TodoList />} />
          </Routes>
        </main>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
