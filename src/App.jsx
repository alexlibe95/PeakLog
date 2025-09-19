import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import TrainingManagement from './pages/TrainingManagement';
import Settings from './pages/Settings';
import AdminPage from './pages/AdminPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AthleteManagement from './pages/AthleteManagement';
import CategoryManagement from './pages/CategoryManagement';
import Testing from './pages/Testing';
import MyProgress from './pages/MyProgress';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth-callback" element={<AuthCallback />} />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/training"
            element={
              <ProtectedRoute>
                <Training />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-progress"
            element={
              <ProtectedRoute>
                <MyProgress />
              </ProtectedRoute>
            }
          />
                    <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-management"
            element={
              <ProtectedRoute adminOnly>
                <TrainingManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/athlete-management"
            element={
              <ProtectedRoute adminOnly>
                <AthleteManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/category-management"
            element={
              <ProtectedRoute adminOnly>
                <CategoryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/testing"
            element={
              <ProtectedRoute adminOnly>
                <Testing />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/superadmin" 
            element={
              <ProtectedRoute superOnly>
                <SuperAdminPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Default redirect to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App
