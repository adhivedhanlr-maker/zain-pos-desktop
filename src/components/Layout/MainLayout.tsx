import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    FileText,
    Settings,
    LogOut,
    Moon,
    Sun,
    Menu,
    X,
    Activity,
    UserCog,
    Shield,
    BrainCircuit,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const MainLayout: React.FC = () => {
    const [darkMode, setDarkMode] = React.useState(false);
    const [sidebarOpen, setSidebarOpen] = React.useState(true);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, login, logout } = useAuthStore();

    // Real-time Permission Sync
    // Real-time Permission Sync - Disabled to prevent UI flickering/disappearing items
    // React.useEffect(() => {
    //     if (!user?.id) return;

    //     const interval = setInterval(async () => {
    //         try {
    //             // Direct DB query to get latest permissions
    //             const res = await window.electronAPI.db.query({
    //                 model: 'user',
    //                 method: 'findUnique',
    //                 args: {
    //                     where: { id: user.id },
    //                     select: {
    //                         id: true,
    //                         username: true,
    //                         password: true,
    //                         name: true,
    //                         role: true,
    //                         isActive: true,
    //                         permPrintSticker: true,
    //                         permAddItem: true,
    //                         permDeleteProduct: true,
    //                         permVoidSale: true,
    //                         permViewReports: true,
    //                         permViewSales: true,
    //                         permViewGstReports: true,
    //                         permManageProducts: true,
    //                         permEditSettings: true,
    //                         permEditSales: true,
    //                         permManageInventory: true,
    //                         permManageUsers: true,
    //                         permViewCostPrice: true,
    //                         permChangePayment: true,
    //                         permDeleteAudit: true,
    //                         permBulkUpdate: true,
    //                         permBackDateSale: true,
    //                         permViewInsights: true,
    //                         maxDiscount: true,
    //                     }
    //                 }
    //             });

    //             if (res.success && res.data) {
    //                 const freshUser = res.data;

    //                 // Sanitize (remove password)
    //                 const { password, ...safeUser } = freshUser;

    //                 login(safeUser);
    //             }
    //         } catch (error) {
    //             console.error('Permission sync failed:', error);
    //         }
    //     }, 2000); // Check every 2 seconds

    //     return () => clearInterval(interval);
    // }, [user?.id]);

    React.useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const menuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true, requiredPerm: 'permViewReports' },
        { path: '/pos', icon: ShoppingCart, label: 'Point of Sale' },
        { path: '/forecasting', icon: BrainCircuit, label: 'AI Forecaster', adminOnly: true, requiredPerm: 'permViewInsights' },
        { path: '/products', icon: Package, label: 'Products', adminOnly: true, requiredPerm: 'permManageProducts' },
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/sales', icon: FileText, label: 'Sales History', adminOnly: true, requiredPerm: 'permViewSales' },
        { path: '/reports', icon: FileText, label: 'GST Reports', adminOnly: true, requiredPerm: 'permViewGstReports' },
        { path: '/users', icon: UserCog, label: 'User Management', adminOnly: true },
        { path: '/permissions', icon: Shield, label: 'User Permissions', adminOnly: true },
        { path: '/activity', icon: Activity, label: 'Activity Log', adminOnly: true },
        { path: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
    ];

    const filteredMenuItems = menuItems.filter(
        (item) => !item.adminOnly ||
            user?.role === 'ADMIN' ||
            (item.requiredPerm && (user as any)?.[item.requiredPerm])
    );

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-bg">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-20'
                    } bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border transition-all duration-300 flex flex-col`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-dark-border">
                    {sidebarOpen && (
                        <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">
                            Zain POS
                        </h1>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {filteredMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
                                title={!sidebarOpen ? item.label : ''}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {sidebarOpen && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User info */}
                <div className="p-4 border-t border-gray-200 dark:border-dark-border">
                    {sidebarOpen && (
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {user?.name}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {user?.role}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="sidebar-link w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={!sidebarOpen ? 'Logout' : ''}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {menuItems.find((item) => item.path === location.pathname)?.label ||
                                'Dashboard'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title={darkMode ? 'Light mode' : 'Dark mode'}
                        >
                            {darkMode ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
