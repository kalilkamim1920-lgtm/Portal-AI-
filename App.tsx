/**
 * App root — route table.
 *
 * Routing rules:
 *  - Public pages          : /, /pricing, /terms, /privacy, 404
 *  - Public-only (auth out): /login, /register, /forgot-password, /reset-password
 *  - Protected (auth in)   : /dashboard, /chat, /tools, /image-generator,
 *                            /subscription, /notifications, /profile, /settings
 *  - Admin                 : /admin (server-verified claim)
 *
 * All redirect decisions live in the guards (src/routes/guards.tsx) —
 * pages never self-redirect. This is what keeps /login and /dashboard
 * from fighting each other.
 */
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// When built with --base=/portal/ (sandbox preview), keep router paths aligned
const ROUTER_BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from './routes/guards';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import AIChat from './pages/AIChat';
import AITools from './pages/AITools';
import ImageGenerator from './pages/ImageGenerator';
import Pricing from './pages/Pricing';
import Subscription from './pages/Subscription';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import AdminDashboard from './pages/AdminDashboard';
import Terms from './pages/Legal';
import NotFound from './pages/NotFound';

/** Resets scroll on navigation. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME || undefined}>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>
            <ScrollToTop />
            <Routes>
              {/* Public */}
              <Route path="/" element={<Home />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/terms" element={<Terms variant="terms" />} />
              <Route path="/privacy" element={<Terms variant="privacy" />} />

              {/* Public-only (signed-in users bounce to dashboard via guard) */}
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
              <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
              <Route path="/reset-password" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />

              {/* Protected */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
              <Route path="/tools" element={<ProtectedRoute><AITools /></ProtectedRoute>} />
              <Route path="/image-generator" element={<ProtectedRoute><ImageGenerator /></ProtectedRoute>} />
              <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* Admin (server-verified) */}
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
