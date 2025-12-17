import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChildProvider } from './context/ChildContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { StoryReader } from './pages/StoryReader';
import { Library } from './pages/Library';
import { Profile } from './pages/Profile';
import { CustomIllustrations } from './pages/CustomIllustrations';

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <Landing />
          </PublicRoute>
        }
      />
      <Route
        path="/signin"
        element={
          <PublicRoute>
            <Auth mode="signin" />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Auth mode="signup" />
          </PublicRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/story/:id"
        element={
          <ProtectedRoute>
            <StoryReader />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <Library />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/illustrations"
        element={
          <ProtectedRoute>
            <CustomIllustrations />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChildProvider>
          <AppRoutes />
        </ChildProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
