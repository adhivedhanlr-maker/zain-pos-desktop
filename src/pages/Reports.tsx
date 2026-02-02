import React, { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { reportsService } from '../services/reports.service';

export const Reports: React.FC = () => {
    const [reportData, setReportData] = useState<any>(null);

    const generateDailyReport = async () => {
        try {
            const report = await reportsService.getDailySalesReport(new Date());
            setReportData(report);
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    };

    const generateMonthlyReport = async () => {
        try {
            const report = await reportsService.getMonthlySalesReport(new Date());
            setReportData(report);
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    };

    const handleExport = () => {
        if (!reportData) {
            alert('Please generate a report first to export.');
            return;
        }

        // Simple JSON export for now
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "report.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-hover cursor-pointer" onClick={generateDailyReport}>
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500 p-3 rounded-lg">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Daily Sales Report</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Today's sales summary
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card-hover cursor-pointer" onClick={generateMonthlyReport}>
                    <div className="flex items-center gap-4">
                        <div className="bg-green-500 p-3 rounded-lg">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Monthly Sales Report</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                This month's summary
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card-hover cursor-pointer" onClick={handleExport}>
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-500 p-3 rounded-lg">
                            <Download className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Export Data</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Download as JSON
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {reportData && (
                <div className="card">
                    <h3 className="text-xl font-bold mb-4">Report Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
                            <p className="text-2xl font-bold">₹{reportData.totalSales?.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Tax</p>
                            <p className="text-2xl font-bold">₹{reportData.totalTax?.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Bills</p>
                            <p className="text-2xl font-bold">{reportData.numberOfBills}</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Discount</p>
                            <p className="text-2xl font-bold">₹{reportData.totalDiscount?.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
