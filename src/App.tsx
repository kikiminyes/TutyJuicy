import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context
import { CartProvider } from './context/CartContext';

// Components
import { ProtectedAdminRoute } from './components/features/ProtectedAdminRoute';

// Customer Pages
import { LandingPage } from './pages/customer/LandingPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { PaymentPage } from './pages/customer/PaymentPage';
import { OrderTrackingPage } from './pages/customer/OrderTrackingPage';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMenuPage } from './pages/admin/AdminMenuPage';
import { AdminBatchPage } from './pages/admin/AdminBatchPage';
import { AdminPaymentSettingsPage } from './pages/admin/AdminPaymentSettingsPage';
import { AdminOrderPage } from './pages/admin/AdminOrderPage';
import { AdminWaitlistPage } from './pages/admin/AdminWaitlistPage';
import { AdminContactPage } from './pages/admin/AdminContactPage';
import { NotFoundPage } from './pages/NotFoundPage';

const AppContent: React.FC = () => {
  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        {/* Customer Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/track" element={<OrderTrackingPage />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="orders" element={<AdminOrderPage />} />
            <Route path="menus" element={<AdminMenuPage />} />
            <Route path="batches" element={<AdminBatchPage />} />
            <Route path="waitlist" element={<AdminWaitlistPage />} />
            <Route path="settings" element={<AdminPaymentSettingsPage />} />
            <Route path="contact" element={<AdminContactPage />} />
          </Route>
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <CartProvider>
      <Router>
        <AppContent />
      </Router>
    </CartProvider>
  );
}

export default App;
