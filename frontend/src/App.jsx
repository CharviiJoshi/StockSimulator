import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import EditProfile from './pages/EditProfile';
import ForgotPassword from './pages/ForgotPassword';
import './index.css';

function RouteLogger() {
  const location = useLocation();
  React.useEffect(() => {
    console.log(`[APP] 🗺️ Route rendered: ${location.pathname}${location.search}${location.hash}`);
  }, [location]);
  return null;
}

function App() {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('stocksim-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    console.log('[APP] 🚀 App initialized | Theme:', savedTheme);
  }, []);

  return (
    <Router>
      <RouteLogger />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
