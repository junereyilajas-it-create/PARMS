import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
}

interface FilterBarProps {
  filters: FilterOption[];
  onFilterChange: (filterName: string, value: string) => void;
  onReset: () => void;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  onSearch,
  searchPlaceholder = 'Search...',
}) => {
  return (
    <div className="filter-bar bg-white p-6 rounded-lg shadow mb-6">

      {onSearch && (
        <div className="mb-4">
          <input
            type="text"
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      <div className="filter-fields grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {filters.map((filter) => (
          <div key={filter.label}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {filter.label}
            </label>
            <select
              value={filter.value}
              onChange={(e) => onFilterChange(filter.label, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All {filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
      >
        <Filter size={16} /> More Filters
      </button><button onClick={onReset} className="filter-reset"><RotateCcw size={14}/> Reset</button>
    </div>
  );
};
