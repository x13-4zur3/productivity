import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDownIcon, 
  ChevronUpIcon,
  PlusCircleIcon,
  TrashIcon,
  FlagIcon
} from '@heroicons/react/24/outline';

function TodoItem({ 
  todo, 
  onToggle, 
  onDelete, 
  onUpdateSubtasks, 
  onUpdatePriority,
  isDarkMode 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const priorityColors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500'
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;

    const updatedSubtasks = [...(todo.subtasks || []), {
      id: Date.now(),
      text: newSubtask,
      completed: false
    }];
    onUpdateSubtasks(todo.id, updatedSubtasks);
    setNewSubtask('');
  };

  const toggleSubtask = (subtaskId) => {
    const updatedSubtasks = todo.subtasks.map(subtask =>
      subtask.id === subtaskId 
        ? { ...subtask, completed: !subtask.completed }
        : subtask
    );
    onUpdateSubtasks(todo.id, updatedSubtasks);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-lg border shadow-sm ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggle(todo.id)}
              className="w-5 h-5 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className={`flex-1 ${todo.completed ? 'line-through text-gray-500' : ''}`}>
              {todo.text}
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={todo.priority || 'low'}
              onChange={(e) => onUpdatePriority(todo.id, e.target.value)}
              className={`rounded px-2 py-1 text-sm ${
                isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100'
              }`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            
            <div className={`w-3 h-3 rounded-full ${priorityColors[todo.priority || 'low']}`} />
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-5 h-5" />
              ) : (
                <ChevronDownIcon className="w-5 h-5" />
              )}
            </button>
            
            <button
              onClick={() => onDelete(todo.id)}
              className="p-1 text-red-500 hover:bg-red-100 rounded-full dark:hover:bg-red-900"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 space-y-3"
            >
              {todo.dueDate && (
                <div className="text-sm text-gray-500">
                  Due: {new Date(todo.dueDate).toLocaleDateString()}
                </div>
              )}
              
              <form onSubmit={handleAddSubtask} className="flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add subtask..."
                  className={`flex-1 px-3 py-1 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                />
                <button
                  type="submit"
                  className="p-2 text-blue-500 hover:bg-blue-100 rounded-full dark:hover:bg-blue-900"
                >
                  <PlusCircleIcon className="w-5 h-5" />
                </button>
              </form>

              <div className="space-y-2">
                {todo.subtasks?.map(subtask => (
                  <motion.div
                    key={subtask.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-2 pl-6"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => toggleSubtask(subtask.id)}
                      className="w-4 h-4 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className={subtask.completed ? 'line-through text-gray-500' : ''}>
                      {subtask.text}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default TodoItem;

