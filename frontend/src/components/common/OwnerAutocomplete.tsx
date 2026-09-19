import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import api from '../../lib/api';

type OwnerRecord = {
  owner_id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  contact_number?: string;
  email?: string;
};

type Props = {
  value?: number;
  onSelect: (owner: OwnerRecord | null) => void;
  error?: boolean;
};

export function OwnerAutocomplete({ value, onSelect, error }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OwnerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<OwnerRecord | null>(null);
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

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim() || (selectedOwner && `${selectedOwner.first_name} ${selectedOwner.last_name}` === query)) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.get(`/owners/search?q=${encodeURIComponent(query)}`);
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
      } catch (err) {
        console.error('Failed to fetch owners:', err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedOwner]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedOwner) {
              setSelectedOwner(null);
              onSelect(null);
            }
          }}
          placeholder="Search registered owner (e.g., Junerey)"
          className={`w-full p-2 pl-9 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${error ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}`}
        />
        <div className="absolute left-3 top-2.5 text-gray-400">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((owner) => (
            <div
              key={owner.owner_id}
              onClick={() => {
                const name = `${owner.first_name} ${owner.last_name}`;
                setQuery(name);
                setSelectedOwner(owner);
                setIsOpen(false);
                onSelect(owner);
              }}
              className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="font-medium text-gray-900 dark:text-white">
                {owner.first_name} {owner.middle_name ? `${owner.middle_name} ` : ''}{owner.last_name}
              </div>
              <div className="text-sm text-gray-500 flex justify-between">
                <span>Owner ID: {owner.owner_id}</span>
                {owner.email && <span>{owner.email}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && query.length > 0 && !loading && results.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
          No matching owners found.
        </div>
      )}
    </div>
  );
}
