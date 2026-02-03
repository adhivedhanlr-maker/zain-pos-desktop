import React, { useEffect, useState } from 'react';
import { Printer, Search, Trash2, Filter } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { db } from '../lib/db';
import { auditService } from '../services/audit.service';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { formatIndianCurrency } from '../lib/format';
import { useAuthStore } from '../store/authStore';

type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export const Sales: React.FC = () => {
    const [sales, setSales] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const { user } = useAuthStore();

    // Void Modal State
    const [voidSaleId, setVoidSaleId] = useState<string | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);

    const handleVoidClick = (id: string) => {
        setVoidSaleId(id);
        setVoidReason('');
    };

    const confirmVoid = async () => {
        if (!voidSaleId || !voidReason.trim()) return;

        setIsVoiding(true);
        try {
            // Find sale to get billNo for log
            const sale = sales.find(s => s.id === voidSaleId);

            await db.sales.update({
                where: { id: voidSaleId },
                data: { status: 'VOIDED' }
            });

            await auditService.log(
                'SALE_VOID',
                JSON.stringify({ billNo: sale?.billNo || 'Unknown', reason: voidReason }),
                user?.id
            );

            loadSales();
            setVoidSaleId(null);
        } catch (error: any) {
            console.error('Failed to void sale:', error);
            alert(`Failed to void sale: ${error.message || error}`);
        } finally {
            setIsVoiding(false);
        }
    };

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        try {
            setLoading(true);
            const data = await db.sales.findMany({
                include: {
                    items: true,
                    user: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            setSales(data);
        } catch (error) {
            console.error('Failed to load sales:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter by time period
    const getDateRange = () => {
        const now = new Date();
        switch (timePeriod) {
            case 'today':
                return { start: startOfDay(now), end: endOfDay(now) };
            case 'week':
                return { start: startOfWeek(now), end: endOfWeek(now) };
            case 'month':
                return { start: startOfMonth(now), end: endOfMonth(now) };
            case 'year':
                return { start: startOfYear(now), end: endOfYear(now) };
            case 'all':
            default:
                return null;
        }
    };

    const filteredSales = sales.filter((s) => {
        // Search filter
        const matchesSearch = s.billNo.toString().includes(searchQuery) ||
            s.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

        // Time period filter
        const dateRange = getDateRange();
        const matchesTimePeriod = !dateRange || (
            new Date(s.createdAt) >= dateRange.start &&
            new Date(s.createdAt) <= dateRange.end
        );

        // Payment method filter
        const matchesPayment = paymentFilter === 'all' || s.paymentMethod === paymentFilter;

        return matchesSearch && matchesTimePeriod && matchesPayment;
    });

    // Calculate summary stats for filtered sales (excluding VOIDED)
    const activeSales = filteredSales.filter(s => s.status !== 'VOIDED');
    const totalRevenue = activeSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const totalBills = activeSales.length;

    return (
        <div className="space-y-6">
            {/* Header with Search and Filters */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by bill number or customer..."
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                    </Button>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                    <div className="card p-4">
                        <div className="flex gap-4 items-center">
                            <label className="text-sm font-medium">Payment Method:</label>
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                            >
                                <option value="all">All Methods</option>
                                <option value="CASH">Cash</option>
                                <option value="CARD">Card</option>
                                <option value="UPI">UPI</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Time Period Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setTimePeriod('today')}
                    className={`px-4 py-2 font-medium transition-colors ${timePeriod === 'today'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Today
                </button>
                <button
                    onClick={() => setTimePeriod('week')}
                    className={`px-4 py-2 font-medium transition-colors ${timePeriod === 'week'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    This Week
                </button>
                <button
                    onClick={() => setTimePeriod('month')}
                    className={`px-4 py-2 font-medium transition-colors ${timePeriod === 'month'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    This Month
                </button>
                <button
                    onClick={() => setTimePeriod('year')}
                    className={`px-4 py-2 font-medium transition-colors ${timePeriod === 'year'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    This Year
                </button>
                <button
                    onClick={() => setTimePeriod('all')}
                    className={`px-4 py-2 font-medium transition-colors ${timePeriod === 'all'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    All Time
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Bills</p>
                    <p className="text-2xl font-bold mt-1">{totalBills}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                        {formatIndianCurrency(totalRevenue)}
                    </p>
                </div>
                <div className="card">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Average Bill</p>
                    <p className="text-2xl font-bold mt-1">
                        {formatIndianCurrency(totalBills > 0 ? totalRevenue / totalBills : 0)}
                    </p>
                </div>
            </div>

            {/* Sales Table */}
            <div className="card overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Bill No</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Cashier</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <tr key={index}>
                                    <td><Skeleton className="h-4 w-24" /></td>
                                    <td><Skeleton className="h-4 w-32" /></td>
                                    <td><Skeleton className="h-4 w-32" /></td>
                                    <td><Skeleton className="h-4 w-12" /></td>
                                    <td><Skeleton className="h-4 w-20" /></td>
                                    <td><Skeleton className="h-6 w-16" /></td>
                                    <td><Skeleton className="h-4 w-24" /></td>
                                    <td><Skeleton className="h-8 w-24" /></td>
                                </tr>
                            ))
                        ) : filteredSales.length > 0 ? (
                            filteredSales.map((sale) => (
                                <tr key={sale.id} className={sale.status === 'VOIDED' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                                    <td className="font-medium">
                                        <div className="flex items-center gap-2">
                                            #{sale.billNo}
                                            {sale.status === 'VOIDED' && (
                                                <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200 font-bold">
                                                    VOIDED
                                                </span>
                                            )}
                                            {sale.isHistorical && !sale.status && (
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200">
                                                    Old Data
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={sale.status === 'VOIDED' ? 'line-through text-gray-500' : ''}>
                                        {format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm')}
                                    </td>
                                    <td className={sale.status === 'VOIDED' ? 'line-through text-gray-500' : ''}>
                                        {sale.customerName || '-'}
                                    </td>
                                    <td className={sale.status === 'VOIDED' ? 'line-through text-gray-500' : ''}>
                                        {sale.items.length}
                                    </td>
                                    <td className={`font-semibold ${sale.status === 'VOIDED' ? 'line-through text-gray-500' : ''}`}>
                                        {formatIndianCurrency(sale.grandTotal)}
                                    </td>
                                    <td>
                                        <span className={`badge ${sale.status === 'VOIDED' ? 'bg-red-100 text-red-800' : 'badge-info'}`}>
                                            {sale.status === 'VOIDED' ? 'VOIDED' : sale.paymentMethod}
                                        </span>
                                    </td>
                                    <td>{sale.user.name}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" size="sm">
                                                <Printer className="w-4 h-4" />
                                            </Button>

                                            {user?.role === 'ADMIN' && sale.status !== 'VOIDED' && (
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    title="Void Bill"
                                                    onClick={() => handleVoidClick(sale.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-500">
                                    No sales found for the selected period
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Void Modal */}
            <Modal
                isOpen={!!voidSaleId}
                onClose={() => setVoidSaleId(null)}
                title="Void Sale"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to void this sale? This action cannot be undone.
                    </p>
                    <Input
                        label="Reason"
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Enter reason for cancellation"
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="secondary"
                            onClick={() => setVoidSaleId(null)}
                            disabled={isVoiding}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={confirmVoid}
                            disabled={isVoiding || !voidReason.trim()}
                        >
                            {isVoiding ? 'Voiding...' : 'Confirm Void'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
