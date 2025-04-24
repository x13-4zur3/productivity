import { motion } from 'framer-motion';
import { format, startOfWeek, addDays } from 'date-fns';

function WeeklyProgress({ todos, isDarkMode }) {
  const startOfCurrentWeek = startOfWeek(new Date());
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfCurrentWeek, i);
    const dayTodos = todos.filter(todo => 
      format(new Date(todo.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
    const completed = dayTodos.filter(todo => todo.completed).length;
    
    return {
      date,
      total: dayTodos.length,
      completed,
    };
  });

  return (
    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h3 className="text-lg font-semibold mb-4">Weekly Progress</h3>
      <div className="flex justify-between items-end h-32">
        {weekDays.map((day, index) => {
          const height = day.total ? (day.completed / day.total) * 100 : 0;
          
          return (
            <div key={index} className="flex flex-col items-center">
              <motion.div
                className="w-8 bg-blue-500 rounded-t-lg"
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5 }}
              />
              <span className="text-sm mt-2">{format(day.date, 'EEE')}</span>
              <span className="text-xs text-gray-500">
                {day.completed}/{day.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyProgress;

