import React, { useEffect, useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingBag,
    AlertTriangle,
    Package,
    Calendar,
} from 'lucide-react';
import { reportsService } from '../services/reports.service';
import { db } from '../lib/db';
import { Loading } from '../components/ui/Loading';
import { formatIndianCurrency, calculatePercentageChange } from '../lib/format';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { startOfMonth, endOfMonth, eachDayOfInterval, format as formatDate } from 'date-fns';

type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [todayStats, setTodayStats] = useState<any>(null);
    const [yesterdayStats, setYesterdayStats] = useState<any>(null);
    const [allTimeStats, setAllTimeStats] = useState<any>(null);
    const [lowStockItems, setLowStockItems] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');

    useEffect(() => {
        loadDashboardData();
    }, []);

    useEffect(() => {
        loadChartData();
    }, [filterPeriod]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [dailyReport, yesterdayReport, lowStock, topSelling] = await Promise.all([
                reportsService.getDailySalesReport(),
                reportsService.getYesterdaySalesReport(),
                reportsService.getLowStockItems(),
                reportsService.getTopSellingProducts(5),
            ]);

            setTodayStats(dailyReport);
            setYesterdayStats(yesterdayReport);
            setLowStockItems(lowStock);
            setTopProducts(topSelling);

            // Get all-time stats
            const allSales = await db.sales.findMany({
                select: {
                    grandTotal: true,
                    items: true,
                },
            });

            const totalRevenue = allSales.reduce((sum: number, sale: any) => sum + sale.grandTotal, 0);
            const totalItems = allSales.reduce((sum: number, sale: any) =>
                sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0);

            setAllTimeStats({
                totalRevenue,
                totalItems,
                totalSales: allSales.length,
            });
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadChartData = async () => {
        try {
            if (filterPeriod === 'today') {
                // Show hourly breakdown for today
                const todayReport = await reportsService.getDailySalesReport();
                const hours = Array.from({ length: 24 }, (_, i) => i);

                const hourlyData = hours.map(hour => {
                    const hourSales = todayReport.sales.filter((sale: any) => {
                        const saleHour = new Date(sale.createdAt).getHours();
                        return saleHour === hour;
                    });

                    return {
                        date: `${hour}:00`,
                        sales: hourSales.reduce((sum: number, sale: any) => sum + sale.grandTotal, 0),
                        bills: hourSales.length,
                    };
                });

                setChartData(hourlyData);
            } else if (filterPeriod === 'week') {
                // Show last 7 days
                const days = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    return date;
                });

                const weekData = await Promise.all(
                    days.map(async (day) => {
                        const report = await reportsService.getDailySalesReport(day);
                        return {
                            date: formatDate(day, 'EEE dd'),
                            sales: report.totalSales,
                            bills: report.numberOfBills,
                        };
                    })
                );

                setChartData(weekData);
            } else if (filterPeriod === 'month') {
                const monthlyReport = await reportsService.getMonthlySalesReport();
                const days = eachDayOfInterval({
                    start: startOfMonth(new Date()),
                    end: endOfMonth(new Date()),
                });

                const data = days.map(day => {
                    const dayNum = day.getDate();
                    const dayData = monthlyReport.dailyBreakdown[dayNum] || { sales: 0, count: 0 };
                    return {
                        date: formatDate(day, 'dd MMM'),
                        sales: dayData.sales,
                        bills: dayData.count,
                    };
                });

                setChartData(data);
            } else if (filterPeriod === 'year') {
                // Show monthly breakdown for current year
                const months = Array.from({ length: 12 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(i);
                    return date;
                });

                const yearData = await Promise.all(
                    months.map(async (month) => {
                        const report = await reportsService.getMonthlySalesReport(month);
                        return {
                            date: formatDate(month, 'MMM'),
                            sales: report.totalSales,
                            bills: report.numberOfBills,
                        };
                    })
                );

                setChartData(yearData);
            } else if (filterPeriod === 'all') {
                // Show all-time data grouped by month
                const allSales = await db.sales.findMany({
                    select: {
                        createdAt: true,
                        grandTotal: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                });

                // Group by month-year
                const monthlyMap = new Map<string, { sales: number; count: number }>();

                allSales.forEach((sale: any) => {
                    const date = new Date(sale.createdAt);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const existing = monthlyMap.get(key) || { sales: 0, count: 0 };
                    existing.sales += sale.grandTotal;
                    existing.count += 1;
                    monthlyMap.set(key, existing);
                });

                const allTimeData = Array.from(monthlyMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([key, data]) => {
                        const [year, month] = key.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1);
                        return {
                            date: formatDate(date, 'MMM yyyy'),
                            sales: data.sales,
                            bills: data.count,
                        };
                    });

                setChartData(allTimeData);
            }
        } catch (error) {
            console.error('Failed to load chart data:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loading size="lg" text="Loading dashboard..." />
            </div>
        );
    }

    // Calculate comparisons
    const salesChange = calculatePercentageChange(
        todayStats?.totalSales || 0,
        yesterdayStats?.totalSales || 0
    );
    const billsChange = calculatePercentageChange(
        todayStats?.numberOfBills || 0,
        yesterdayStats?.numberOfBills || 0
    );
    const taxChange = calculatePercentageChange(
        todayStats?.totalTax || 0,
        yesterdayStats?.totalTax || 0
    );

    const stats = [
        {
            label: "Today's Sales",
            value: formatIndianCurrency(todayStats?.totalSales || 0),
            icon: DollarSign,
            color: 'bg-green-500',
            change: salesChange,
        },
        {
            label: 'All-Time Revenue',
            value: formatIndianCurrency(allTimeStats?.totalRevenue || 0),
            icon: TrendingUp,
            color: 'bg-indigo-500',
            subtext: `${allTimeStats?.totalSales || 0} invoices`,
        },
        {
            label: 'Total Bills (Today)',
            value: todayStats?.numberOfBills || 0,
            icon: ShoppingBag,
            color: 'bg-blue-500',
            change: billsChange,
        },
        {
            label: 'Tax Collected (Today)',
            value: formatIndianCurrency(todayStats?.totalTax || 0),
            icon: Package,
            color: 'bg-purple-500',
            change: taxChange,
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
                                        <div className="flex items-center gap-1 mt-1">
                                            {stat.change.isIncrease ? (
                                                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            ) : (
                                                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                            )}
                                            <p className={`text-sm ${stat.change.isIncrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {stat.change.display} from yesterday
                                            </p>
                                        </div>
                                    )}
                                    {stat.subtext && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {stat.subtext}
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

            {/* Sales Chart */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Sales Overview
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterPeriod('today')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterPeriod === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setFilterPeriod('week')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterPeriod === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setFilterPeriod('month')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterPeriod === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setFilterPeriod('year')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterPeriod === 'year' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Year
                        </button>
                        <button
                            onClick={() => setFilterPeriod('all')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterPeriod === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            All Time
                        </button>
                    </div>
                </div>

                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            formatter={(value: any, name: string) => {
                                if (name === 'sales') return [formatIndianCurrency(value), 'Revenue'];
                                if (name === 'bills') return [value, 'Bills'];
                                return [value, name];
                            }}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                            }}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => {
                                if (value === 'sales') return 'Revenue (₹)';
                                if (value === 'bills') return 'Number of Bills';
                                return value;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="sales"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            name="sales"
                        />
                        <Line
                            type="monotone"
                            dataKey="bills"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            name="bills"
                        />
                    </LineChart>
                </ResponsiveContainer>
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
                                            {formatIndianCurrency(product.totalRevenue)}
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
            {todayStats?.paymentBreakdown && Object.keys(todayStats.paymentBreakdown).length > 0 && (
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Payment Methods (Today)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(todayStats.paymentBreakdown).map(([method, amount]: any) => (
                            <div
                                key={method}
                                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                                <p className="text-sm text-gray-600 dark:text-gray-400">{method}</p>
                                <p className="text-2xl font-bold mt-1">{formatIndianCurrency(amount)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
