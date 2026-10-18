import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

interface DonutChartProps {
  data: any[];
  title: string;
  colors: string[];
  height?: number;
}

export const DonutChartComponent: React.FC<DonutChartProps> = ({
  data,
  title,
  colors,
  height = 300,
}) => {
  const { isDark } = useTheme();
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl shadow-sm text-gray-900 dark:text-gray-100 transition-colors">
      {title && <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke={isDark ? '#111827' : '#ffffff'} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f9fafb' : '#111827', borderRadius: '8px' }} />
          <Legend wrapperStyle={{ color: isDark ? '#d1d5db' : '#374151' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
