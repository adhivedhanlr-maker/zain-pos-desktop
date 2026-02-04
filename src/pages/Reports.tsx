import React, { useState } from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { formatIndianCurrency } from '../lib/format';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { db } from '../lib/db';
import { useAuthStore } from '../store/authStore';
import { ShieldAlert } from 'lucide-react';

export const Reports: React.FC = () => {
    const { user } = useAuthStore();
    const [reportData, setReportData] = useState<any>(null);
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(false);

    if (user?.role !== 'ADMIN' && !user?.permViewGstReports) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
                    <ShieldAlert className="w-12 h-12" />
                </div>
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-gray-500 max-w-md">
                    You do not have permission to view GST Reports.
                    Please contact your administrator to request access.
                </p>
            </div>
        );
    }

    const generateReport = async () => {
        try {
            setLoading(true);

            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            // Get all sales in date range
            const sales = await db.sales.findMany({
                where: {
                    createdAt: {
                        gte: start.toISOString(),
                        lte: end.toISOString(),
                    },
                },
                include: {
                    items: true,
                },
                orderBy: { createdAt: 'asc' },
            });

            // Separate tax invoices (non-historical) and all sales
            const taxInvoices = sales.filter((s: any) => !s.isHistorical);
            const allSales = sales;

            // Calculate totals
            const calculateTotals = (salesList: any[]) => {
                const fivePercentSales = salesList.reduce((sum, s) => sum + s.subtotal, 0);
                const fivePercentGST = salesList.reduce((sum, s) => sum + s.taxAmount, 0);
                const salesTotal = fivePercentSales;
                const gstTotal = fivePercentGST;
                const total = salesList.reduce((sum, s) => sum + s.grandTotal, 0);
                const freight = 0;
                const discount = salesList.reduce((sum, s) => sum + s.discount, 0);
                const rounding = 0;
                const netTotal = total;
                const cgst = salesList.reduce((sum, s) => sum + (s.cgst || 0), 0);
                const sgst = salesList.reduce((sum, s) => sum + (s.sgst || 0), 0);

                return {
                    fivePercentSales,
                    fivePercentGST,
                    salesTotal,
                    gstTotal,
                    total,
                    freight,
                    discount,
                    rounding,
                    netTotal,
                    cgst,
                    sgst,
                    count: salesList.length,
                    cashTotal: salesList.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.grandTotal, 0),
                    upiTotal: salesList.filter(s => s.paymentMethod === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0),
                    cardTotal: salesList.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.grandTotal, 0),
                };
            };

            const taxInvoiceTotals = calculateTotals(taxInvoices);
            const allSalesTotals = calculateTotals(allSales);

            setReportData({
                startDate: start,
                endDate: end,
                taxInvoices,
                allSales,
                taxInvoiceTotals,
                allSalesTotals,
            });
        } catch (error) {
            console.error('Failed to generate report:', error);
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const exportToPDF = () => {
        if (!reportData) {
            alert('Please generate a report first');
            return;
        }

        const doc = new jsPDF('landscape');

        // Header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ZAIN GENTS PALACE', 14, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`From ${format(reportData.startDate, 'dd/MM/yyyy')} To ${format(reportData.endDate, 'dd/MM/yyyy')}`, 14, 22);

        let currentY = 30;

        // Tax Invoice Section
        if (reportData.taxInvoices.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Tax Invoice', 14, currentY);
            currentY += 5;

            const taxInvoiceData = reportData.taxInvoices.map((sale: any) => [
                format(new Date(sale.createdAt), 'dd/MMM/yy'),
                sale.billNo.toString(),
                (sale.billNo + (sale.items.length - 1)).toString(),
                sale.subtotal.toFixed(2),
                sale.taxAmount.toFixed(2),
                sale.subtotal.toFixed(2),
                sale.taxAmount.toFixed(2),
                sale.grandTotal.toFixed(2),
                '0.00',
                sale.discount.toFixed(2),
                '0.00',
                sale.grandTotal.toFixed(2),
            ]);

            autoTable(doc, {
                startY: currentY,
                head: [['DATE', 'BILL FROM', 'BILL TO', '5% SALES', '5% GST', 'SALES TOTAL', 'GST TOTAL', 'TOTAL', 'FREIGHT', 'DISCOUNT', 'ROUNDING', 'NET TOTAL']],
                body: taxInvoiceData,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1 },
                headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 18 },
                },
            });

            currentY = (doc as any).lastAutoTable.finalY + 2;

            // Tax Invoice Totals
            const taxTotals = reportData.taxInvoiceTotals;
            autoTable(doc, {
                startY: currentY,
                body: [[
                    'Total of Tax Invoice',
                    '',
                    '',
                    taxTotals.fivePercentSales.toFixed(2),
                    taxTotals.fivePercentGST.toFixed(2),
                    taxTotals.salesTotal.toFixed(2),
                    taxTotals.gstTotal.toFixed(2),
                    taxTotals.total.toFixed(2),
                    taxTotals.freight.toFixed(2),
                    taxTotals.discount.toFixed(2),
                    taxTotals.rounding.toFixed(2),
                    taxTotals.netTotal.toFixed(2),
                ]],
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1, fontStyle: 'bold', fillColor: [200, 255, 200] },
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        }

        // All Sales Summary
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('ALL SALES SUMMARY', 14, currentY);
        currentY += 5;

        const allSalesData = reportData.allSales.map((sale: any) => [
            format(new Date(sale.createdAt), 'dd/MMM/yy'),
            sale.billNo.toString(),
            (sale.billNo + (sale.items.length - 1)).toString(),
            sale.subtotal.toFixed(2),
            sale.taxAmount.toFixed(2),
            sale.subtotal.toFixed(2),
            sale.taxAmount.toFixed(2),
            sale.grandTotal.toFixed(2),
            '0.00',
            sale.discount.toFixed(2),
            '0.00',
            sale.grandTotal.toFixed(2),
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['DATE', 'BILL FROM', 'BILL TO', '5% SALES', '5% GST', 'SALES TOTAL', 'GST TOTAL', 'TOTAL', 'FREIGHT', 'DISCOUNT', 'ROUNDING', 'NET TOTAL']],
            body: allSalesData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
        });

        currentY = (doc as any).lastAutoTable.finalY + 2;

        // Grand Total
        const allTotals = reportData.allSalesTotals;
        autoTable(doc, {
            startY: currentY,
            body: [[
                'Grand Total',
                '',
                '',
                allTotals.fivePercentSales.toFixed(2),
                allTotals.fivePercentGST.toFixed(2),
                allTotals.salesTotal.toFixed(2),
                allTotals.gstTotal.toFixed(2),
                allTotals.total.toFixed(2),
                allTotals.freight.toFixed(2),
                allTotals.discount.toFixed(2),
                allTotals.rounding.toFixed(2),
                allTotals.netTotal.toFixed(2),
            ]],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1, fontStyle: 'bold', fillColor: [220, 220, 220] },
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;

        // CGST/SGST Breakdown
        autoTable(doc, {
            startY: currentY,
            body: [
                ['CGST', allTotals.cgst.toFixed(2), '', allTotals.cgst.toFixed(2)],
                ['SGST', allTotals.sgst.toFixed(2), '', allTotals.sgst.toFixed(2)],
            ],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;

        // Payment Mode Breakdown
        autoTable(doc, {
            startY: currentY,
            body: [
                ['Payment Mode Breakdown', '', '', ''],
                ['CASH', allTotals.cashTotal.toFixed(2), '', ''],
                ['UPI', allTotals.upiTotal.toFixed(2), '', ''],
                ['CARD', allTotals.cardTotal.toFixed(2), '', ''],
            ],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1, fontStyle: 'bold' },
        });

        doc.save(`GST-Report-${format(reportData.startDate, 'dd-MM-yyyy')}-to-${format(reportData.endDate, 'dd-MM-yyyy')}.pdf`);
    };

    const exportToExcel = () => {
        if (!reportData) {
            alert('Please generate a report first');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Tax Invoice Sheet
        if (reportData.taxInvoices.length > 0) {
            const taxInvoiceData = [
                ['ZAIN GENTS PALACE'],
                [`From ${format(reportData.startDate, 'dd/MM/yyyy')} To ${format(reportData.endDate, 'dd/MM/yyyy')}`],
                [],
                ['Tax Invoice'],
                ['DATE', 'BILL FROM', 'BILL TO', '5% SALES', '5% GST', 'SALES TOTAL', 'GST TOTAL', 'TOTAL', 'FREIGHT', 'DISCOUNT', 'ROUNDING', 'NET TOTAL'],
                ...reportData.taxInvoices.map((sale: any) => [
                    format(new Date(sale.createdAt), 'dd/MMM/yy'),
                    sale.billNo,
                    sale.billNo + (sale.items.length - 1),
                    sale.subtotal,
                    sale.taxAmount,
                    sale.subtotal,
                    sale.taxAmount,
                    sale.grandTotal,
                    0,
                    sale.discount,
                    0,
                    sale.grandTotal,
                ]),
                ['Total of Tax Invoice', '', '', reportData.taxInvoiceTotals.fivePercentSales, reportData.taxInvoiceTotals.fivePercentGST, reportData.taxInvoiceTotals.salesTotal, reportData.taxInvoiceTotals.gstTotal, reportData.taxInvoiceTotals.total, reportData.taxInvoiceTotals.freight, reportData.taxInvoiceTotals.discount, reportData.taxInvoiceTotals.rounding, reportData.taxInvoiceTotals.netTotal],
            ];

            const wsTaxInvoice = XLSX.utils.aoa_to_sheet(taxInvoiceData);
            XLSX.utils.book_append_sheet(wb, wsTaxInvoice, 'Tax Invoice');
        }

        // All Sales Summary Sheet
        const allSalesData = [
            ['ZAIN GENTS PALACE'],
            [`From ${format(reportData.startDate, 'dd/MM/yyyy')} To ${format(reportData.endDate, 'dd/MM/yyyy')}`],
            [],
            ['ALL SALES SUMMARY'],
            ['DATE', 'BILL FROM', 'BILL TO', '5% SALES', '5% GST', 'SALES TOTAL', 'GST TOTAL', 'TOTAL', 'FREIGHT', 'DISCOUNT', 'ROUNDING', 'NET TOTAL'],
            ...reportData.allSales.map((sale: any) => [
                format(new Date(sale.createdAt), 'dd/MMM/yy'),
                sale.billNo,
                sale.billNo + (sale.items.length - 1),
                sale.subtotal,
                sale.taxAmount,
                sale.subtotal,
                sale.taxAmount,
                sale.grandTotal,
                0,
                sale.discount,
                0,
                sale.grandTotal,
            ]),
            ['Grand Total', '', '', reportData.allSalesTotals.fivePercentSales, reportData.allSalesTotals.fivePercentGST, reportData.allSalesTotals.salesTotal, reportData.allSalesTotals.gstTotal, reportData.allSalesTotals.total, reportData.allSalesTotals.freight, reportData.allSalesTotals.discount, reportData.allSalesTotals.rounding, reportData.allSalesTotals.netTotal],
            [],
            ['CGST', reportData.allSalesTotals.cgst, '', reportData.allSalesTotals.cgst],
            ['SGST', reportData.allSalesTotals.sgst, '', reportData.allSalesTotals.sgst],
            [],
            ['Payment Method Breakdown'],
            ['CASH', reportData.allSalesTotals.cashTotal],
            ['UPI', reportData.allSalesTotals.upiTotal],
            ['CARD', reportData.allSalesTotals.cardTotal],
        ];

        const wsAllSales = XLSX.utils.aoa_to_sheet(allSalesData);
        XLSX.utils.book_append_sheet(wb, wsAllSales, 'All Sales Summary');

        XLSX.writeFile(wb, `GST-Report-${format(reportData.startDate, 'dd-MM-yyyy')}-to-${format(reportData.endDate, 'dd-MM-yyyy')}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <h2 className="text-2xl font-bold mb-2">GST Sales Report</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Generate detailed GST-compliant sales reports with Tax Invoice and All Sales Summary
                </p>
            </div>

            {/* Date Range Selection */}
            <div className="card">
                <h3 className="text-lg font-semibold mb-4">Select Date Range</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={generateReport}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {loading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={exportToPDF}
                            disabled={!reportData}
                            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={exportToExcel}
                            disabled={!reportData}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                    </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={() => {
                            const today = new Date();
                            setStartDate(format(today, 'yyyy-MM-dd'));
                            setEndDate(format(today, 'yyyy-MM-dd'));
                        }}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => {
                            setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                            setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                        }}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        This Month
                    </button>
                </div>
            </div>

            {/* Report Preview */}
            {reportData && (
                <div className="card overflow-x-auto">
                    <h3 className="text-xl font-bold mb-4">Report Preview</h3>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Total Bills</p>
                            <p className="text-xl font-bold">{reportData.allSalesTotals.count}</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">5% Sales</p>
                            <p className="text-xl font-bold">{formatIndianCurrency(reportData.allSalesTotals.fivePercentSales)}</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">5% GST</p>
                            <p className="text-xl font-bold">{formatIndianCurrency(reportData.allSalesTotals.fivePercentGST)}</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Net Total</p>
                            <p className="text-xl font-bold">{formatIndianCurrency(reportData.allSalesTotals.netTotal)}</p>
                        </div>
                    </div>

                    {/* Payment Breakdown */}
                    <h4 className="font-bold mb-2">Payment Methods</h4>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded border border-green-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Cash</p>
                            <p className="text-lg font-bold">{formatIndianCurrency(reportData.allSalesTotals.cashTotal)}</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded border border-purple-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">UPI</p>
                            <p className="text-lg font-bold">{formatIndianCurrency(reportData.allSalesTotals.upiTotal)}</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded border border-blue-200">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Card</p>
                            <p className="text-lg font-bold">{formatIndianCurrency(reportData.allSalesTotals.cardTotal)}</p>
                        </div>
                    </div>

                    {/* CGST/SGST */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <p className="text-sm text-gray-600 dark:text-gray-400">CGST (2.5%)</p>
                            <p className="text-lg font-bold">{formatIndianCurrency(reportData.allSalesTotals.cgst)}</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <p className="text-sm text-gray-600 dark:text-gray-400">SGST (2.5%)</p>
                            <p className="text-lg font-bold">{formatIndianCurrency(reportData.allSalesTotals.sgst)}</p>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                        Click PDF or Excel button above to download the detailed report
                    </p>
                </div>
            )}
        </div>
    );
};
