import { create } from 'zustand';

interface User {
    id: string;
    username: string;
    name: string;
    role: string;
    permPrintSticker: boolean;
    permAddItem: boolean;
    permDeleteProduct: boolean;
    permVoidSale: boolean;
    permViewReports: boolean;
    permViewSales: boolean;
    permViewGstReports: boolean;
    permManageProducts: boolean;
    permEditSettings: boolean;
    permEditSales: boolean;
    permManageInventory: boolean;
    permManageUsers: boolean;
    permViewCostPrice: boolean;
    permChangePayment: boolean;
    permDeleteAudit: boolean;
    permBulkUpdate: boolean;
    permBackDateSale: boolean;
    permViewInsights: boolean;
    maxDiscount: number;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
}

const defaultAdmin: User = {
    id: 'local-admin',
    username: 'admin',
    name: 'Admin',
    role: 'ADMIN',
    permPrintSticker: true,
    permAddItem: true,
    permDeleteProduct: true,
    permVoidSale: true,
    permViewReports: true,
    permViewSales: true,
    permViewGstReports: true,
    permManageProducts: true,
    permEditSettings: true,
    permEditSales: true,
    permManageInventory: true,
    permManageUsers: true,
    permViewCostPrice: true,
    permChangePayment: true,
    permDeleteAudit: true,
    permBulkUpdate: true,
    permBackDateSale: true,
    permViewInsights: true,
    maxDiscount: 100,
};

export const useAuthStore = create<AuthState>((set) => ({
    user: defaultAdmin,
    isAuthenticated: true,
    login: (user) => set({ user, isAuthenticated: true }),
    logout: () => set({ user: defaultAdmin, isAuthenticated: true }),
}));
