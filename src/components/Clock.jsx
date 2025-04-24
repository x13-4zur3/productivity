import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

function Clock({ isDarkMode }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center p-4 rounded-lg shadow-lg ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}
    >
      <motion.div
        key={time.getSeconds()}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-4xl font-bold mb-2"
      >
        {format(time, 'HH:mm:ss')}
      </motion.div>
      <div className="text-sm text-gray-500">
        {format(time, 'EEEE, MMMM do, yyyy')}
      </div>
    </motion.div>
  );
}

export default Clock;

