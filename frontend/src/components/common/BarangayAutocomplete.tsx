import { useState, useRef, useEffect } from 'react';
import { getBarangays } from '../../lib/ph_locations';

type Props = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
};

export function BarangayAutocomplete({ value, onChange, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const allBarangays = getBarangays('Lagonglong');
  const query = value.trim().toLowerCase();
  
  const results = allBarangays.filter(b => b.toLowerCase().startsWith(query));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Example: Poblacion"
        className={className}
      />
      
      {isOpen && value.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-auto">
          {results.length > 0 ? (
            results.map((b) => (
              <div
                key={b}
                onClick={() => {
                  onChange(b);
                  setIsOpen(false);
                }}
                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 font-medium text-gray-900 dark:text-white"
              >
                {b}
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              No barangay found in Lagonglong
            </div>
          )}
        </div>
      )}
    </div>
  );
}
