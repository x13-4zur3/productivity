import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  ListNumberedIcon,
} from '@heroicons/react/24/outline';

function RichTextToolbar({ onFormat, isDarkMode }) {
  const tools = [
    { icon: BoldIcon, format: 'bold', label: 'Bold' },
    { icon: ItalicIcon, format: 'italic', label: 'Italic' },
    { icon: UnderlineIcon, format: 'underline', label: 'Underline' },
    { icon: ListBulletIcon, format: 'bullet', label: 'Bullet List' },
    { icon: ListNumberedIcon, format: 'number', label: 'Numbered List' },
  ];

  return (
    <div className="flex gap-2 mb-2">
      {tools.map(({ icon: Icon, format, label }) => (
        <button
          key={format}
          onClick={() => onFormat(format)}
          className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
          title={label}
        >
          <Icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}

export default RichTextToolbar;

