import { useState, useRef, useEffect } from 'react';
import { getMunicipalities } from '../../lib/ph_locations';
import { ChevronDown } from 'lucide-react';

type Props = {
  province: string;
  value: string;
  onChange: (val: string) => void;
  error?: boolean;
};

export function MunicipalitySelector({ province, value, onChange, error }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterLetter, setFilterLetter] = useState<string>('');
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const municipalities = getMunicipalities(province);
  const letters = Array.from(new Set(municipalities.map(m => m.name[0].toUpperCase()))).sort();

  const displayed = municipalities.filter(m => {
    if (filterLetter && m.name[0].toUpperCase() !== filterLetter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className={`w-full p-2 border rounded-lg flex justify-between items-center cursor-pointer bg-white dark:bg-gray-800 ${error ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 dark:border-gray-600'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
          {value || 'Select Municipality ▼'}
        </span>
        <ChevronDown size={16} className="text-gray-500" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input 
              type="text" 
              placeholder="Search municipality..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              <button 
                type="button"
                onClick={() => setFilterLetter('')}
                className={`px-2 py-0.5 text-xs rounded ${!filterLetter ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                All
              </button>
              {letters.map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setFilterLetter(l)}
                  className={`px-2 py-0.5 text-xs rounded ${filterLetter === l ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-48 overflow-auto">
            {displayed.length > 0 ? displayed.map(m => (
              <div 
                key={m.name}
                className="p-2 hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer text-sm border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                onClick={() => { onChange(m.name); setIsOpen(false); }}
              >
                {m.name}
              </div>
            )) : (
              <div className="p-4 text-center text-sm text-gray-500">No municipalities found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
