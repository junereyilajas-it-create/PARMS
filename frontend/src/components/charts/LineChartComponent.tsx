import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

interface LineChartProps {
  data: any[];
  title: string;
  xAxisKey: string;
  lines: Array<{
    key: string;
    stroke: string;
    name: string;
  }>;
  height?: number;
}

export const LineChartComponent: React.FC<LineChartProps> = ({
  data,
  title,
  xAxisKey,
  lines,
  height = 300,
}) => {
  const { isDark } = useTheme();
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl shadow-sm text-gray-900 dark:text-gray-100 transition-colors">
      {title && <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
          <XAxis dataKey={xAxisKey} stroke={isDark ? '#9ca3af' : '#6b7280'} tick={{ fill: isDark ? '#9ca3af' : '#6b7280' }} />
          <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} tick={{ fill: isDark ? '#9ca3af' : '#6b7280' }} />
          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f9fafb' : '#111827', borderRadius: '8px' }} />
          <Legend wrapperStyle={{ color: isDark ? '#d1d5db' : '#374151' }} />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.stroke}
              name={line.name}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
