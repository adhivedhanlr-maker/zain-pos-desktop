import React, { useEffect, useState } from 'react';
import { Printer, Search, Trash2, Filter, RefreshCcw, Calendar as CalendarIcon, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { db } from '../lib/db';
import { auditService } from '../services/audit.service';
import { printService } from '../services/print.service';
import { format, isSameDay, isSameWeek, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { formatIndianCurrency } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useNavigate } from 'react-router-dom';

type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export const Sales: React.FC = () => {
    const [sales, setSales] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [limit, setLimit] = useState(50);
    const [hasMore, setHasMore] = useState(true);
    const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
    const [shopSettings, setShopSettings] = useState<any>(null);
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { addItem, clearCart } = useCartStore();

    // Void Modal State
    const [voidSaleId, setVoidSaleId] = useState<string | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);
    const [updatingPayment, setUpdatingPayment] = useState<string | null>(null);

    useEffect(() => {
        // Only trigger full load on filter change, not on limit change
        loadSales(false);
        loadShopSettings();
    }, [timePeriod, selectedDate]);

    // Handle Load More separately
    useEffect(() => {
        if (limit > 50) {
            loadSales(true);
        }
    }, [limit]);

    const loadShopSettings = async () => {
        try {
            const result = await window.electronAPI.db.query({
                model: 'setting',
                method: 'findUnique',
                args: { where: { key: 'SHOP_SETTINGS' } }
            });
            if (result.success && result.data && result.data.value) {
                setShopSettings(JSON.parse(result.data.value));
            }
        } catch (error) {
            console.error('Failed to load shop settings:', error);
        }
    };

    const loadSales = async (isMore = false) => {
        try {
            if (isMore) setLoadingMore(true);
            else setLoading(true);

            let where: any = {};

            if (timePeriod === 'today') {
                const start = startOfDay(new Date(selectedDate));
                const end = endOfDay(new Date(selectedDate));
                where.createdAt = { gte: start.toISOString(), lte: end.toISOString() };
            } else if (timePeriod === 'week') {
                where.createdAt = { gte: startOfWeek(new Date()).toISOString(), lte: endOfWeek(new Date()).toISOString() };
            } else if (timePeriod === 'month') {
                where.createdAt = { gte: startOfMonth(new Date()).toISOString(), lte: endOfMonth(new Date()).toISOString() };
            } else if (timePeriod === 'year') {
                where.createdAt = { gte: startOfYear(new Date()).toISOString(), lte: endOfYear(new Date()).toISOString() };
            }

            const data = await db.sales.findMany({
                where,
                include: {
                    items: true,
                    user: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: isMore ? sales.length : 0,
            });

            if (isMore) {
                setSales(prev => [...prev, ...data]);
            } else {
                setSales(data);
            }
            setHasMore(data.length === 50);
        } catch (error) {
            console.error('Failed to load sales:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    if (!user) return <div className="p-8 text-center text-gray-500">Authenticating...</div>;

    if (user.role !== 'ADMIN' && !user.permViewSales) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
                    <Trash2 className="w-12 h-12" />
                </div>
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-gray-500 max-w-md">
                    You do not have permission to view sales history.
                    Please contact your administrator to request access.
                </p>
            </div>
        );
    }

    const handleVoidClick = (id: string) => {
        setVoidSaleId(id);
        setVoidReason('');
    };

    const handleExchange = (sale: any) => {
        // Clear current cart
        clearCart();

        // Load items from this sale into POS cart
        sale.items.forEach((item: any) => {
            addItem({
                variantId: item.variantId,
                productName: item.productName,
                variantInfo: item.variantInfo || '',
                barcode: '', // Not strictly needed for cart display in edit mode
                quantity: item.quantity,
                mrp: item.mrp,
                sellingPrice: item.sellingPrice,
                discount: item.discount,
                taxRate: item.taxRate
            });
        });

        // Navigate to POS with original sale ID
        navigate('/pos', { state: { sale } });
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

    const handleUpdatePayment = async (saleId: string, currentMethod: string) => {
        const methods: ('CASH' | 'CARD' | 'UPI')[] = ['CASH', 'CARD', 'UPI'];
        const nextMethod = methods[(methods.indexOf(currentMethod as any) + 1) % methods.length];

        try {
            setUpdatingPayment(saleId);
            await db.sales.update({
                where: { id: saleId },
                data: { paymentMethod: nextMethod }
            });

            await auditService.log(
                'SALE_UPDATE',
                `Changed payment method to ${nextMethod} for Sale ID: ${saleId}`,
                user?.id
            );

            // Update local state without full reload for better UX
            setSales(prev => prev.map(s => s.id === saleId ? { ...s, paymentMethod: nextMethod } : s));
        } catch (error: any) {
            console.error('Failed to update payment method:', error);
            alert('Failed to update payment method');
        } finally {
            setUpdatingPayment(null);
        }
    };

    const handlePrintReceipt = async (sale: any) => {
        try {
            const receiptData = {
                billNo: sale.billNo,
                date: new Date(sale.createdAt),
                shopName: shopSettings?.shopName || 'ZAIN GENTS PALACE',
                shopAddress: shopSettings?.address || 'CHIRAMMAL TOWER, BEHIND CANARA BANK\nRAJA ROAD, NILESHWAR',
                shopPhone: shopSettings?.phone || '9037106449, 7907026827',
                gstin: shopSettings?.gstin || '32PVGPS0686J1ZV',
                logo: shopSettings?.logo,
                customerName: sale.customerName,
                items: sale.items.map((item: any) => ({
                    name: item.productName,
                    variantInfo: item.variantInfo,
                    quantity: item.quantity,
                    mrp: item.mrp || 0,
                    rate: item.sellingPrice,
                    discount: item.discount || 0,
                    taxRate: item.taxRate || 0,
                    total: item.total || (item.sellingPrice * item.quantity - (item.discount || 0)),
                })),
                subtotal: sale.subtotal,
                discount: sale.discount,
                cgst: sale.cgst || (sale.taxAmount / 2),
                sgst: sale.sgst || (sale.taxAmount / 2),
                grandTotal: sale.grandTotal,
                paymentMethod: sale.paymentMethod,
                paidAmount: sale.paidAmount,
                changeAmount: sale.changeAmount,
                userName: sale.user?.name || 'Staff',
            };

            await printService.printReceipt(receiptData);
        } catch (error) {
            console.error('Failed to print receipt:', error);
            alert('Failed to print receipt');
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
            case 'custom':
                const customDate = new Date(selectedDate);
                return { start: startOfDay(customDate), end: endOfDay(customDate) };
            case 'all':
            default:
                return null;
        }
    };

    const filteredSales = sales.filter((s) => {
        // 1. Search filter logic (AND search for comma-separated terms)
        const searchTerms = searchQuery.toLowerCase().split(',').map(term => term.trim()).filter(Boolean);
        const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => {
            const matchesBillNo = s.billNo.toString().includes(term);
            const matchesCustomer = s.customerName?.toLowerCase().includes(term) || s.customerPhone?.includes(term);
            const matchesItems = s.items.some((i: any) => i.productName.toLowerCase().includes(term));
            return matchesBillNo || matchesCustomer || matchesItems;
        });

        // 2. Time period filter
        const dateRange = getDateRange();
        const matchesTimePeriod = !dateRange || (
            new Date(s.createdAt) >= dateRange.start &&
            new Date(s.createdAt) <= dateRange.end
        );

        // 3. Payment method filter
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
                    <div className="flex items-center gap-2 flex-1 max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by Bill No, Customer, Items..."
                                className="pl-10"
                            />
                        </div>

                        {/* Custom Date Picker */}
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-3 py-1.5 shadow-sm">
                            <CalendarIcon className="w-5 h-5 text-primary-500" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    setTimePeriod('custom');
                                }}
                                className="bg-transparent border-none outline-none text-sm font-medium"
                            />
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="w-4 h-4" />
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
            <div className="flex gap-2">
                <button
                    onClick={() => setTimePeriod('today')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timePeriod === 'today' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
                >
                    Today
                </button>
                <button
                    onClick={() => setTimePeriod('week')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timePeriod === 'week' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
                >
                    This Week
                </button>
                <button
                    onClick={() => setTimePeriod('month')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timePeriod === 'month' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
                >
                    This Month
                </button>
                <button
                    onClick={() => setTimePeriod('year')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timePeriod === 'year' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
                >
                    This Year
                </button>
                <button
                    onClick={() => setTimePeriod('custom')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timePeriod === 'custom' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
                >
                    Selected Date
                </button>
                <button
                    onClick={() => setTimePeriod('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timePeriod === 'all' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'}`}
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
                            <th>Show</th>
                            <th>Bill No</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Staff</th>
                            <th className="text-right">Actions</th>
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
                            filteredSales.map((sale, index) => {
                                const prevSale = index > 0 ? filteredSales[index - 1] : null;
                                const currDate = new Date(sale.createdAt);
                                const prevDate = prevSale ? new Date(prevSale.createdAt) : null;

                                let showDivider = false;
                                let dividerLabel = "";
                                let dividerColor = "";

                                if (prevDate) {
                                    // Year Change
                                    if (currDate.getFullYear() !== prevDate.getFullYear()) {
                                        showDivider = true;
                                        dividerLabel = `Start of ${currDate.getFullYear()}`;
                                        dividerColor = "bg-rose-500";
                                    }
                                    // Month Change (same year)
                                    else if (currDate.getMonth() !== prevDate.getMonth()) {
                                        showDivider = true;
                                        dividerLabel = format(currDate, 'MMMM yyyy');
                                        dividerColor = "bg-amber-500";
                                    }
                                    // Week Change (same month)
                                    else if (!isSameWeek(currDate, prevDate, { weekStartsOn: 1 })) {
                                        showDivider = true;
                                        const startOfCurrWeek = startOfWeek(currDate, { weekStartsOn: 1 });
                                        const endOfCurrWeek = endOfWeek(currDate, { weekStartsOn: 1 });
                                        dividerLabel = `Week: ${format(startOfCurrWeek, 'dd MMM')} - ${format(endOfCurrWeek, 'dd MMM')}`;
                                        dividerColor = "bg-emerald-500";
                                    }
                                }

                                return (
                                    <React.Fragment key={sale.id}>
                                        {showDivider && (
                                            <tr>
                                                <td colSpan={7} className="p-0">
                                                    <div className="flex items-center gap-4 py-3 px-4 bg-gray-50/50 dark:bg-gray-800/50">
                                                        <div className={`h-1 w-12 rounded-full ${dividerColor}`}></div>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                                            Time Horizon: {dividerLabel}
                                                        </span>
                                                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr className={`group ${sale.status === 'VOIDED' ? 'bg-red-50 dark:bg-red-900/10' : ''} ${expandedSaleId === sale.id ? 'bg-primary-50/30' : ''}`}>
                                            <td>
                                                <button
                                                    onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                                                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    {expandedSaleId === sale.id ? (
                                                        <ChevronUp className="w-4 h-4 text-primary-600" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="font-bold whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-primary-600">#{sale.billNo}</span>
                                                    {sale.status === 'VOIDED' && (
                                                        <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200 font-black uppercase">
                                                            VOID
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`whitespace-nowrap text-xs ${sale.status === 'VOIDED' ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                                                {format(new Date(sale.createdAt), 'dd MMM yyyy, HH:mm')}
                                            </td>
                                            <td className={`font-medium ${sale.status === 'VOIDED' ? 'line-through text-gray-400' : ''}`}>
                                                {sale.customerName || <span className="text-gray-300 italic text-xs">Walk-in</span>}
                                            </td>
                                            <td>
                                                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-bold">
                                                    {sale.items.length}
                                                </span>
                                            </td>
                                            <td className={`font-black text-gray-900 dark:text-gray-100 ${sale.status === 'VOIDED' ? 'line-through text-gray-400' : ''}`}>
                                                {formatIndianCurrency(sale.grandTotal)}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => sale.status !== 'VOIDED' && (user?.role === 'ADMIN' || user?.permChangePayment) && handleUpdatePayment(sale.id, sale.paymentMethod)}
                                                    disabled={updatingPayment === sale.id || sale.status === 'VOIDED' || (user?.role !== 'ADMIN' && !user?.permChangePayment)}
                                                    className={`transition-all ${sale.status !== 'VOIDED' && (user?.role === 'ADMIN' || user?.permChangePayment) ? 'cursor-pointer hover:scale-110 active:scale-90' : 'cursor-not-allowed opacity-70'}`}
                                                >
                                                    <span className={`badge py-1 px-3 ${sale.status === 'VOIDED' ? 'bg-red-100 text-red-800' : 'badge-info shadow-sm'} ${updatingPayment === sale.id ? 'opacity-50' : ''}`}>
                                                        {updatingPayment === sale.id ? '...' : (sale.status === 'VOIDED' ? 'VOIDED' : sale.paymentMethod)}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="text-sm text-gray-500 whitespace-nowrap">{sale.user?.name || 'Staff'}</td>
                                            <td>
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="secondary" size="sm" onClick={() => handlePrintReceipt(sale)} className="shadow-sm">
                                                        <Printer className="w-4 h-4" />
                                                    </Button>

                                                    {(user?.role === 'ADMIN' || user?.permVoidSale || user?.permEditSales) && sale.status !== 'VOIDED' && (
                                                        <>
                                                            {(user?.role === 'ADMIN' || user?.permEditSales) && (
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    title="Exchange / Edit"
                                                                    onClick={() => handleExchange(sale)}
                                                                    className="shadow-sm"
                                                                >
                                                                    <RefreshCcw className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {(user?.role === 'ADMIN' || user?.permVoidSale) && (
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    title="Void Bill"
                                                                    onClick={() => handleVoidClick(sale.id)}
                                                                    className="shadow-sm"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded Detail Row */}
                                        {expandedSaleId === sale.id && (
                                            <tr className="bg-gray-50/50 dark:bg-gray-900/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <td colSpan={9} className="p-0 border-b border-gray-200 dark:border-gray-700">
                                                    <div className="px-14 py-4 bg-white dark:bg-gray-800/40 m-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-inner">
                                                        <h4 className="text-xs font-black uppercase text-gray-400 mb-3 tracking-widest flex items-center gap-2">
                                                            <Tag className="w-3 h-3" />
                                                            Items Purchased
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {sale.items.map((item: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <div className="min-w-0">
                                                                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                                                                            {item.productName}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 font-medium">
                                                                            {item.variantInfo}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0 ml-4">
                                                                        <div className="text-xs font-black text-primary-600">
                                                                            {item.quantity} × {formatIndianCurrency(item.sellingPrice)}
                                                                        </div>
                                                                        {item.discount > 0 && (
                                                                            <div className="text-[10px] text-orange-500 font-bold">
                                                                                - {formatIndianCurrency(item.discount)} off
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-end items-center gap-8">
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Subtotal</div>
                                                                <div className="text-sm font-bold">{formatIndianCurrency(sale.subtotal)}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Discount</div>
                                                                <div className="text-sm font-bold text-orange-600">{formatIndianCurrency(sale.discount)}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase text-primary-600">Total Paid</div>
                                                                <div className="text-lg font-black text-primary-600">{formatIndianCurrency(sale.grandTotal)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={9} className="text-center py-12 text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-8 h-8 opacity-20" />
                                        <span className="text-lg font-medium">No transactions match your filters</span>
                                        <span className="text-xs">Try selecting a different date or search term</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {(hasMore || loadingMore) && (
                <div className="flex justify-center mt-6 mb-8">
                    <Button
                        variant="secondary"
                        onClick={() => setLimit(prev => prev + 50)}
                        className="flex items-center gap-3 px-8 shadow-sm hover:shadow-md transition-all active:scale-95"
                        disabled={loadingMore}
                    >
                        <RefreshCcw className={`w-4 h-4 ${loadingMore ? 'animate-spin' : ''}`} />
                        {loadingMore ? 'Fetching more transactions...' : 'Load Older Transactions'}
                    </Button>
                </div>
            )}

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
        </div >
    );
};
