import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false, superOnly = false }) => {
  const { user, loading, isAdmin, isSuper } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Determine required permissions
  const needsAdmin = adminOnly;
  const needsSuper = superOnly;
  const hasAdmin = typeof isAdmin === 'function' && isAdmin();
  const hasSuper = typeof isSuper === 'function' && isSuper();

  // Check access requirements
  if (needsAdmin && needsSuper) {
    // Both admin and super required - user needs at least one
    if (!hasAdmin && !hasSuper) {
      return <Navigate to="/dashboard" replace />;
    }
  } else if (needsAdmin) {
    // Only admin required
    if (!hasAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  } else if (needsSuper) {
    // Only super required
    if (!hasSuper) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;