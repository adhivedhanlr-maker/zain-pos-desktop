import React, { useEffect, useState } from 'react';
import { auditService, AuditAction } from '../services/audit.service';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { Activity, Search, RefreshCw, User, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';

// Audit Log Interface based on Prisma model
interface AuditLog {
    id: string;
    action: string;
    details: string;
    userId: string | null;
    user?: {
        name: string;
        role: string;
    };
    createdAt: string;
}

export const ActivityPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { user } = useAuthStore();

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await auditService.getLogs(100); // Create getLogs in service if needed or use existing
            setLogs(data);
        } catch (error) {
            console.error('Failed to load logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const actionColors: Record<string, string> = {
        'SALE_CREATE': 'text-green-600 bg-green-50 border-green-200',
        'SALE_UPDATE': 'text-blue-600 bg-blue-50 border-blue-200',
        'SALE_VOID': 'text-red-600 bg-red-50 border-red-200',
        'STOCK_ADD': 'text-purple-600 bg-purple-50 border-purple-200',
        'STOCK_ADJUST': 'text-orange-600 bg-orange-50 border-orange-200',
        'PRODUCT_DELETE': 'text-red-600 bg-red-50 border-red-200',
        'USER_LOGIN': 'text-gray-600 bg-gray-50 border-gray-200',
    };

    const filteredLogs = logs.filter(log =>
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (user?.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ShieldAlert className="w-16 h-16 mb-4 text-red-400" />
                <h2 className="text-xl font-bold text-gray-700">Access Denied</h2>
                <p>You do not have permission to view activity logs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Activity Log
                </h1>
                <Button variant="secondary" onClick={loadLogs} title="Refresh Logs">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Search */}
            <div className="max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search logs..."
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Logs List */}
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="card p-4 flex items-center gap-4">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))
                ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                        <div key={log.id} className="card p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4">
                                <div className={`p-2 rounded-lg border ${actionColors[log.action] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                                            {log.action.replace(/_/g, ' ')}
                                        </h3>
                                        <span className="text-xs text-gray-500 font-medium">
                                            {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {log.details}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                        <User className="w-3 h-3" />
                                        <span>{log.user?.name || 'System'}</span>
                                        {log.user?.role && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 border border-gray-200">
                                                {log.user.role}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        No activity logs found.
                    </div>
                )}
            </div>
        </div>
    );
};
