import React, { useEffect, useState } from 'react';
import { Printer, Search, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { db } from '../lib/db';
import { auditService } from '../services/audit.service';
import { format } from 'date-fns';

export const Sales: React.FC = () => {
    const [sales, setSales] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        try {
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
        }
    };

    const filteredSales = sales.filter((s) =>
        s.billNo.toString().includes(searchQuery) ||
        s.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
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
            </div>

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
                        {filteredSales.map((sale) => (
                            <tr key={sale.id}>
                                <td className="font-medium">
                                    #{sale.billNo}
                                    {sale.remarks?.includes('MaxSell') && (
                                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200">
                                            Old Data
                                        </span>
                                    )}
                                </td>
                                <td>{format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm')}</td>
                                <td>{sale.customerName || '-'}</td>
                                <td>{sale.items.length}</td>
                                <td className="font-semibold">₹{sale.grandTotal.toFixed(2)}</td>
                                <td>
                                    <span className="badge badge-info">{sale.paymentMethod}</span>
                                </td>
                                <td>{sale.user.name}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm">
                                            <Printer className="w-4 h-4" />
                                        </Button>

                                        {sale.status !== 'VOIDED' && (
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                title="Void Bill"
                                                onClick={async () => {
                                                    const reason = prompt('Enter reason for cancellation:');
                                                    if (!reason) return;

                                                    if (confirm(`Are you sure you want to cancel Bill #${sale.billNo}? This will restore stock.`)) {
                                                        try {
                                                            // Update stock for all items
                                                            for (const item of sale.items) {
                                                                await db.productVariants.update({
                                                                    where: { id: item.variantId },
                                                                    data: { stock: { increment: item.quantity } }
                                                                });
                                                            }

                                                            // Mark sale as void
                                                            await db.sales.update({
                                                                where: { id: sale.id },
                                                                data: {
                                                                    status: 'VOIDED',
                                                                    remarks: (sale.remarks || '') + ` [VOIDED: ${reason}]`
                                                                }
                                                            });

                                                            // Audit log
                                                            await auditService.log(
                                                                'SALE_VOID',
                                                                `Voided Bill #${sale.billNo}. Reason: ${reason}`
                                                            );

                                                            loadSales();
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert('Failed to void bill');
                                                        }
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
