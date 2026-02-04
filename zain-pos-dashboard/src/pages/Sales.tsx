import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import api from '../lib/api';

interface DailySales {
    date: string;
    sales: number;
    orders: number;
}

export default function Sales() {
    const [dailySales, setDailySales] = useState<DailySales[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            const response = await api.get('/sales/daily');
            setDailySales(response.data);
        } catch (error) {
            console.error('Failed to fetch sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalSales = dailySales.reduce((sum, day) => sum + day.sales, 0);
    const totalOrders = dailySales.reduce((sum, day) => sum + day.orders, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 lg:pb-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Sales</h1>
                <p className="text-gray-600 mt-1">Track your sales performance over time</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <TrendingUp className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Revenue (30 days)</p>
                            <p className="text-2xl font-bold text-gray-900">₹{totalSales.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Calendar className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-50 rounded-lg">
                            <TrendingUp className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Average Order</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ₹{totalOrders > 0 ? (totalSales / totalOrders).toFixed(0) : 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sales Chart */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend (Last 30 Days)</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={dailySales}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis />
                        <Tooltip
                            formatter={(value: number) => [`₹${value}`, 'Sales']}
                            labelFormatter={(date) => new Date(date).toLocaleDateString('en-IN')}
                        />
                        <Line
                            type="monotone"
                            dataKey="sales"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Sales Table */}
            <div className="card overflow-x-auto">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Breakdown</h2>
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Orders</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Sales</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailySales.slice().reverse().map((day) => (
                            <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 text-sm text-gray-900">
                                    {new Date(day.date).toLocaleDateString('en-IN', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-900 text-right">{day.orders}</td>
                                <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                                    ₹{day.sales.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600 text-right">
                                    ₹{day.orders > 0 ? (day.sales / day.orders).toFixed(0) : 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
