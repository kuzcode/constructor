import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminThemeProvider } from './context/AdminThemeContext';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewAppPage } from './pages/NewAppPage';
import { AppManagePage } from './pages/AppManagePage';
import { EditShopPage } from './pages/EditShopPage';
import { EditFreePage } from './pages/EditFreePage';
import { PublicMiniAppPage } from './pages/PublicMiniAppPage';
import { ShopOrderSuccessPage } from './pages/ShopOrderSuccessPage';
import './App.css';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50 text-sm bg-[#0a0a0f]">
        Загрузка…
      </div>
    );
  }
  return <Navigate to={user ? '/admin' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <AdminThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/new"
            element={
              <RequireAuth>
                <NewAppPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/apps/:id"
            element={
              <RequireAuth>
                <AppManagePage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/apps/:id/shop"
            element={
              <RequireAuth>
                <EditShopPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/apps/:id/free"
            element={
              <RequireAuth>
                <EditFreePage />
              </RequireAuth>
            }
          />
          <Route path="/:slug/ordered" element={<ShopOrderSuccessPage />} />
          <Route path="/:slug" element={<PublicMiniAppPage />} />
        </Routes>
      </BrowserRouter>
      </AdminThemeProvider>
    </AuthProvider>
  );
}
