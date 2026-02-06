import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { Sales } from './pages/Sales';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { ActivityPage } from './pages/Activity';
import { Users } from './pages/Users';
import { Permissions } from './pages/Permissions';
import { Forecasting } from './pages/Forecasting';
import { MainLayout } from './components/Layout/MainLayout';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Temporary bypass: allow access without login
    return <>{children}</>;
};

function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/login" element={<Navigate to="/" />} />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <MainLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<Dashboard />} />
                    <Route path="pos" element={<POS />} />
                    <Route path="products" element={<Products />} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="sales" element={<Sales />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="users" element={<Users />} />
                    <Route path="permissions" element={<Permissions />} />
                    <Route path="activity" element={<ActivityPage />} />
                    <Route path="forecasting" element={<Forecasting />} />
                </Route>
            </Routes>
        </HashRouter>
    );
}

export default App;
