import { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import TodoItem from '../components/TodoItem';
import Clock from '../components/Clock';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

function TodoList() {
  const { isDarkMode } = useContext(ThemeContext);
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('date');

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    const todo = {
      id: Date.now(),
      text: newTodo,
      completed: false,
      dueDate: newDueDate,
      createdAt: new Date().toISOString(),
      priority: 'low',
      subtasks: []
    };

    setTodos([todo, ...todos]);
    setNewTodo('');
    setNewDueDate(null);
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const updateSubtasks = (todoId, newSubtasks) => {
    setTodos(todos.map(todo =>
      todo.id === todoId ? { ...todo, subtasks: newSubtasks } : todo
    ));
  };

  const updatePriority = (todoId, priority) => {
    setTodos(todos.map(todo =>
      todo.id === todoId ? { ...todo, priority } : todo
    ));
  };

  const filteredTodos = todos
    .filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'priority') {
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.priority] - priority[b.priority];
      }
      if (sort === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const pageVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Clock isDarkMode={isDarkMode} />
        
        <div className={`p-4 rounded-lg shadow-lg ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{todos.filter(t => !t.completed).length}</div>
              <div className="text-sm text-gray-500">Active Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{todos.filter(t => t.completed).length}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-lg shadow-lg ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add a new task..."
              className={`flex-1 px-4 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            />
            <DatePicker
              selected={newDueDate}
              onChange={date => setNewDueDate(date)}
              placeholderText="Due date"
              className={`px-4 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        <div className="flex justify-between mb-6">
          <div className="flex gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`rounded-lg px-3 py-1 ${
                isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100'
              }`}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`rounded-lg px-3 py-1 ${
                isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100'
              }`}
            >
              <option value="date">Date Created</option>
              <option value="priority">Priority</option>
              <option value="dueDate">Due Date</option>
            </select>
          </div>
        </div>

        <AnimatePresence>
          <div className="space-y-4">
            {filteredTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onUpdateSubtasks={updateSubtasks}
                onUpdatePriority={updatePriority}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default TodoList;
