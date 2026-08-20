import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  icon,
  className = '',
}) => {
  return (
    <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            {trend && (
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                <span>
                  {trend.isPositive ? '+' : '-'}
                  {trend.value}% {trend.label}
                </span>
              </div>
            )}
          </div>
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
};
