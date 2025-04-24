import { motion } from 'framer-motion';

function ProgressBar({ value, total, className }) {
  const percentage = Math.round((value / total) * 100) || 0;
  
  return (
    <div className={`w-full h-2 bg-gray-200 rounded-full dark:bg-gray-700 ${className}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`h-full rounded-full ${
          percentage < 30
            ? 'bg-red-500'
            : percentage < 70
            ? 'bg-yellow-500'
            : 'bg-green-500'
        }`}
      />
    </div>
  );
}

export default ProgressBar;

