import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Sale } from '../types';

interface SalesChartProps {
  sales: Sale[];
}

const SalesChart: React.FC<SalesChartProps> = ({ sales }) => {
  // Group sales by date (using created_at)
  const groupedData = sales.reduce((acc, sale) => {
    // Extract YYYY-MM-DD from created_at ISO string
    const date = sale.created_at.split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, amount: 0, orders: 0 };
    }
    acc[date].amount += sale.amount;
    acc[date].orders += 1;
    return acc;
  }, {} as Record<string, { date: string; amount: number; orders: number }>);

  const chartData = Object.values(groupedData).sort((a: { date: string }, b: { date: string }) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-white rounded-xl border border-gray-100 text-gray-400">
        No data to display
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Trend</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d6efd" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#0d6efd" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
            <XAxis 
              dataKey="date" 
              tick={{fontSize: 12, fill: '#6c757d'}} 
              axisLine={false}
              tickLine={false}
              tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {day: '2-digit', month: 'short'})}
            />
            <YAxis 
              tick={{fontSize: 12, fill: '#6c757d'}} 
              axisLine={false}
              tickLine={false}
              tickFormatter={(num) => `$${(num / 1000).toFixed(1)}k`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Area 
              type="monotone" 
              dataKey="amount" 
              stroke="#0d6efd" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorAmount)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesChart;