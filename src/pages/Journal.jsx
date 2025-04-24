import { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import Clock from '../components/Clock';
import { format } from 'date-fns';
import React from 'react';
import {
  TagIcon,
  PencilIcon,
  TrashIcon,
  FaceSmileIcon,
  FaceFrownIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';

function Journal() {
  const { isDarkMode } = useContext(ThemeContext);
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem('journalEntries');
    return saved ? JSON.parse(saved) : [];
  });
  const [newEntry, setNewEntry] = useState('');
  const [selectedMood, setSelectedMood] = useState('neutral');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    localStorage.setItem('journalEntries', JSON.stringify(entries));
  }, [entries]);

  const moods = {
    happy: { icon: FaceSmileIcon, color: 'text-yellow-500' },
    sad: { icon: FaceFrownIcon, color: 'text-blue-500' },
    loved: { icon: HeartIcon, color: 'text-red-500' },
    neutral: { icon: FaceSmileIcon, color: 'text-gray-500' },
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newEntry.trim()) return;

    const entry = {
      id: Date.now(),
      content: newEntry,
      date: new Date().toISOString(),
      mood: selectedMood,
      tags: tags,
    };

    setEntries([entry, ...entries]);
    setNewEntry('');
    setTags([]);
    setSelectedMood('neutral');
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    setTags([...tags, newTag.trim()]);
    setNewTag('');
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const deleteEntry = (id) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  const toggleTagFilter = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.every(tag => entry.tags && entry.tags.includes(tag));
    return matchesSearch && matchesTags;
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
          <h2 className="text-xl font-semibold mb-4">Journal Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{entries.length}</div>
              <div className="text-sm text-gray-500">Total Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {entries.filter(e => e.date.startsWith(format(new Date(), 'yyyy-MM'))).length}
              </div>
              <div className="text-sm text-gray-500">This Month</div>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-lg shadow-lg ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-4">
            <div className="flex gap-4 mb-4">
              {Object.entries(moods).map(([mood, { icon: Icon, color }]) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setSelectedMood(mood)}
                  className={`p-2 rounded-full ${
                    selectedMood === mood 
                      ? 'bg-gray-200 dark:bg-gray-700' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${color}`} />
                </button>
              ))}
            </div>
            <textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              className={`w-full p-4 rounded-lg border min-h-[200px] ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
              placeholder="Write your thoughts..."
            />
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className={`px-3 py-1 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
              placeholder="Add tags..."
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg dark:hover:bg-blue-900"
            >
              <TagIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm dark:bg-blue-900 dark:text-blue-200"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save Entry
          </button>
        </form>

        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search entries..."
            className={`w-full px-4 py-2 rounded-lg border ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300'
            }`}
          />
        </div>

        <AnimatePresence>
          <div className="space-y-6">
            {filteredEntries.map(entry => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-6 rounded-lg border ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(entry.date), 'MMMM do, yyyy')}
                    </div>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {entry.tags.map(tag => (
                          <span
                            key={tag}
                            onClick={() => toggleTagFilter(tag)}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs cursor-pointer dark:bg-blue-900 dark:text-blue-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.mood && (
                      <span className="p-1">
                        {React.createElement(moods[entry.mood].icon, {
                          className: `w-5 h-5 ${moods[entry.mood].color}`
                        })}
                      </span>
                    )}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded-full dark:hover:bg-red-900"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap">{entry.content}</p>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default Journal;
