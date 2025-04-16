import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import DoctorLogin from './pages/DoctorLogin';
import DoctorRegister from './pages/DoctorRegister';
import Home from './pages/Home';
import Report from './pages/Report';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    console.log('ProtectedRoute: Loading state');
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </Container>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user found, redirecting to login');
    return <Navigate to="/doctor-login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    console.log('ProtectedRoute: User role mismatch', { userRole: user.role, requiredRole });
    return <Navigate to="/home" replace />;
  }

  console.log('ProtectedRoute: Access granted', { userRole: user.role, requiredRole });
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/doctor-login" element={<DoctorLogin />} />
            <Route path="/doctor-register" element={<DoctorRegister />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report"
              element={
                <ProtectedRoute>
                  <Report />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/doctor-login" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
