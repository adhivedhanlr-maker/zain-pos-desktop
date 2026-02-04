import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Package } from 'lucide-react';
import api from '../lib/api';

interface TopProduct {
    product: {
        id: string;
        name: string;
        category: {
            name: string;
        };
    };
    totalQuantity: number;
    totalRevenue: number;
}

interface RevenueData {
    totalRevenue: number;
    averageRevenue: number;
    totalOrders: number;
    period: string;
}

export default function Reports() {
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [revenue, setRevenue] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const [productsRes, revenueRes] = await Promise.all([
                api.get('/reports/top-products?limit=10'),
                api.get('/reports/revenue?days=30'),
            ]);

            setTopProducts(productsRes.data);
            setRevenue(revenueRes.data);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const chartData = topProducts.map(item => ({
        name: item.product.name.substring(0, 20),
        quantity: item.totalQuantity,
        revenue: item.totalRevenue,
    }));

    const pieData = topProducts.slice(0, 5).map(item => ({
        name: item.product.name,
        value: item.totalRevenue,
    }));

    const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Reports</h1>
                <p className="text-gray-600 mt-1">Analytics and performance insights</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <TrendingUp className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Revenue (30d)</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ₹{revenue?.totalRevenue.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Package className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{revenue?.totalOrders || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-50 rounded-lg">
                            <Users className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Avg Order Value</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ₹{revenue?.averageRevenue.toFixed(0) || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products Bar Chart */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Quantity</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="quantity" fill="#0ea5e9" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Revenue Pie Chart */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Product</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name.substring(0, 15)}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Products Table */}
            <div className="card overflow-x-auto">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h2>
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Qty Sold</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topProducts.map((item, index) => (
                            <tr key={item.product.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        index === 1 ? 'bg-gray-100 text-gray-700' :
                                            index === 2 ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-50 text-gray-600'
                                        }`}>
                                        {index + 1}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-sm font-medium text-gray-900">{item.product.name}</td>
                                <td className="py-3 px-4 text-sm text-gray-600">{item.product.category.name}</td>
                                <td className="py-3 px-4 text-sm text-gray-900 text-right">{item.totalQuantity}</td>
                                <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                                    ₹{item.totalRevenue.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
