import React, { useEffect, useState } from 'react';
import {
    TrendingUp,
    DollarSign,
    ShoppingBag,
    AlertTriangle,
    Package,
} from 'lucide-react';
import { reportsService } from '../services/reports.service';
import { Loading } from '../components/ui/Loading';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [todayStats, setTodayStats] = useState<any>(null);
    const [lowStockItems, setLowStockItems] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [dailyReport, lowStock, topSelling] = await Promise.all([
                reportsService.getDailySalesReport(),
                reportsService.getLowStockItems(),
                reportsService.getTopSellingProducts(5),
            ]);

            setTodayStats(dailyReport);
            setLowStockItems(lowStock);
            setTopProducts(topSelling);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loading size="lg" text="Loading dashboard..." />
            </div>
        );
    }

    const stats = [
        {
            label: "Today's Sales",
            value: `₹${todayStats?.totalSales?.toFixed(2) || '0.00'}`,
            icon: DollarSign,
            color: 'bg-green-500',
            change: '+12.5%',
        },
        {
            label: 'Total Bills',
            value: todayStats?.numberOfBills || 0,
            icon: ShoppingBag,
            color: 'bg-blue-500',
            change: '+8.2%',
        },
        {
            label: 'Tax Collected',
            value: `₹${todayStats?.totalTax?.toFixed(2) || '0.00'}`,
            icon: TrendingUp,
            color: 'bg-purple-500',
            change: '+5.1%',
        },
        {
            label: 'Low Stock Items',
            value: lowStockItems.length,
            icon: AlertTriangle,
            color: 'bg-orange-500',
            alert: lowStockItems.length > 0,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <div className="card gradient-primary text-white">
                <h1 className="text-2xl font-bold mb-2">Welcome to Zain POS</h1>
                <p className="text-white/90">
                    Here's what's happening with your store today.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="stat-card">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="stat-label">{stat.label}</p>
                                    <p className="stat-value mt-2">{stat.value}</p>
                                    {stat.change && (
                                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                            {stat.change} from yesterday
                                        </p>
                                    )}
                                    {stat.alert && (
                                        <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                                            Needs attention
                                        </p>
                                    )}
                                </div>
                                <div className={`${stat.color} p-3 rounded-lg`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Charts and Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Selling Products */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Top Selling Products
                    </h3>
                    {topProducts.length > 0 ? (
                        <div className="space-y-3">
                            {topProducts.map((product, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium">{product.productName}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {product.totalQuantity} units sold
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-green-600 dark:text-green-400">
                                            ₹{product.totalRevenue.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">No sales data yet</p>
                    )}
                </div>

                {/* Low Stock Alerts */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Low Stock Alerts
                    </h3>
                    {lowStockItems.length > 0 ? (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {lowStockItems.map((item: any, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium">{item.product.name}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {item.size && `Size: ${item.size}`}
                                            {item.color && ` | Color: ${item.color}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-orange-600 dark:text-orange-400">
                                            {item.stock} left
                                        </p>
                                        <p className="text-xs text-gray-500">Min: {item.minStock}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">
                            All products are well stocked
                        </p>
                    )}
                </div>
            </div>

            {/* Payment Methods Breakdown */}
            {todayStats?.paymentBreakdown && (
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Payment Methods (Today)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(todayStats.paymentBreakdown).map(([method, amount]: any) => (
                            <div
                                key={method}
                                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                                <p className="text-sm text-gray-600 dark:text-gray-400">{method}</p>
                                <p className="text-2xl font-bold mt-1">₹{amount.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
