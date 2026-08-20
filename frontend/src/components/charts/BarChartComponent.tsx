import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BarChartProps {
  data: any[];
  title: string;
  xAxisKey: string;
  bars: Array<{
    key: string;
    fill: string;
    name: string;
  }>;
  height?: number;
}

export const BarChartComponent: React.FC<BarChartProps> = ({
  data,
  title,
  xAxisKey,
  bars,
  height = 300,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.fill} name={bar.name} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
