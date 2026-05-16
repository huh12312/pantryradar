import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import { useAuth } from "./lib/auth";
import { registerUnauthorizedCallback } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import JoinHouseholdPage from "./pages/JoinHouseholdPage";
import InventoryPage from "./pages/InventoryPage";
import SettingsPage from "./pages/SettingsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function App() {
  const { clearAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    registerUnauthorizedCallback(() => {
      clearAuth();
      navigate("/login", { replace: true });
    });
  }, [clearAuth, navigate]);

  return (
    <ThemeProvider defaultTheme="system">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join" element={<JoinHouseholdPage />} />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/inventory" />} />
        <Route path="*" element={<Navigate to="/inventory" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
