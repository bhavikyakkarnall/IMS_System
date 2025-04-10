import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import PasswordReset from './components/PasswordReset';
import Home from './components/Home';
import AdminDashboard from './components/AdminDashboard';
import Inventory from './components/Inventory';
import DispatchForm from './components/DispatchForm';
import ReceiveItems from './components/ReceiveItems';
import UploadInventory from './components/UploadInventory';
import TechnicianReturns from './components/TechnicianReturns';
import Logout from './components/Logout';
import logo from './assets/logo.png';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check login status and get user data
  useEffect(() => {
    axios.get('/api/home')
      .then(res => {
        if (res.data.success && res.data.user) {
          setLoggedIn(true);
          setUserRole(res.data.user.role);
          setUserLocation(res.data.user.location);
          setUserId(res.data.user.id);
        }
      })
      .catch(() => setLoggedIn(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container mt-3">Loading...</div>;

  // Helper functions to check access
  const canAccessTechReturn = () =>
    ['super-admin', 'company-admin', 'user'].includes(userRole);
  const canAccessAdminActions = () =>
    ['super-admin', 'admin'].includes(userRole);
  const canAccessAdminDashboard = () =>
    userRole === 'super-admin';
  const isStaffOnly = () => userRole === 'staff';

  return (
    <>
      {loggedIn && (
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary px-4 py-2 shadow-sm">
          <div className="d-flex align-items-center me-4">
            <img src={logo} alt="Logo" style={{ height: '40px', marginRight: '10px' }} />
            <span className="navbar-brand mb-0 h5">ADT Care</span>
          </div>

          <div className="d-flex align-items-center flex-grow-1">
            <Link to="/" className="nav-link text-white me-3">Home</Link>
            <Link to="/inventory" className="nav-link text-white me-3">Inventory</Link>
            
            {/* Only show Technician Return for roles that are allowed */}
            {canAccessTechReturn() && (
              <Link to="/technician-return" className="nav-link text-white me-3">Technician Return</Link>
            )}
            
            {/* Only show admin actions for super-admin and admin */}
            {canAccessAdminActions() && (
              <>
                <Link to="/dispatch" className="nav-link text-white me-3">Dispatch</Link>
                <Link to="/receive" className="nav-link text-white me-3">Receive Items</Link>
                <Link to="/upload-inventory" className="nav-link text-white me-3">Upload Inventory</Link>
              </>
            )}
            
            {/* Admin Dashboard available only to super-admin */}
            {canAccessAdminDashboard() && (
              <Link to="/admin" className="nav-link text-white me-3">Admin Dashboard</Link>
            )}
          </div>

          <div className="ms-auto">
            <Link to="/logout" className="btn btn-light btn-sm">Logout</Link>
          </div>
        </nav>
      )}

      <div className="container mt-4">
        <Routes>
          {loggedIn ? (
            <>
              <Route path="/" element={<Home setLoggedIn={setLoggedIn} />} />
              <Route path="/inventory" element={<Inventory userRole={userRole} userLocation={userLocation} />} />
              
              {canAccessTechReturn() && (
                <Route path="/technician-return" element={<TechnicianReturns />} />
              )}

              {canAccessAdminDashboard() && (
                <Route path="/admin" element={<AdminDashboard />} />
              )}

              {canAccessAdminActions() && (
                <>
                  <Route path="/dispatch" element={<DispatchForm />} />
                  <Route path="/receive" element={<ReceiveItems userId={userId} />} />
                  <Route path="/upload-inventory" element={<UploadInventory />} />
                </>
              )}

              <Route path="/logout" element={<Logout setLoggedIn={setLoggedIn} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login setLoggedIn={setLoggedIn} setUserRole={setUserRole} />} />
              <Route path="/register" element={<Register />} />
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </div>
    </>
  );
}

export default App;
