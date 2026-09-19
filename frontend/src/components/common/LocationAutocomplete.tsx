import { useState, useRef, useEffect } from 'react';

type Props = {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
};

export function LocationAutocomplete({ value, onChange, options, placeholder, emptyMessage, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = query.trim().toLowerCase();
  
  const results = options.filter(opt => {
    if (value && opt.toLowerCase() === value.toLowerCase()) return false;
    return opt.toLowerCase().includes(search);
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (query !== value) {
          setQuery(value);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input 
            readOnly 
            value={value} 
            className={`${className} bg-gray-100 dark:bg-gray-800 cursor-default w-full m-0`} 
          />
        </div>
        <button 
          type="button" 
          onClick={() => {
            onChange('');
            setQuery('');
            setIsOpen(true);
          }}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-3 py-2.5 rounded shrink-0 m-0 h-full"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      
      {isOpen && query.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-auto">
          {results.length > 0 ? (
            results.map((opt) => (
              <div
                key={opt}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setQuery(opt);
                  setIsOpen(false);
                }}
                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 font-medium text-gray-900 dark:text-white"
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              {emptyMessage || "No matches found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
