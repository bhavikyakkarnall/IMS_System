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
import Logout from './components/Logout';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on app load.
  useEffect(() => {
    axios.get('/api/home')
      .then(res => {
        if (res.data.success && res.data.user) {
          setLoggedIn(true);
          setUserRole(res.data.user.role);
          // For inventory filtering, assume user's location is stored in "location"
          setUserLocation(res.data.user.location);
        }
      })
      .catch(err => setLoggedIn(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container mt-3">Loading...</div>;

  return (
    <div className="container mt-3">
      {loggedIn && (
        <nav className="mb-3">
          <Link className="btn btn-primary me-2" to="/">Home</Link>
          <Link className="btn btn-primary me-2" to="/inventory">Inventory</Link>
          <Link className="btn btn-primary me-2" to="/dispatch">Dispatch</Link>
          {userRole === 'admin' && (
            <Link className="btn btn-primary me-2" to="/admin">Admin Dashboard</Link>
          )}
          <Link className="btn btn-danger me-2" to="/logout">Logout</Link>
        </nav>
      )}
      <Routes>
        {loggedIn ? (
          <>
            <Route path="/" element={<Home setLoggedIn={setLoggedIn} />} />
            <Route path="/inventory" element={<Inventory userRole={userRole} userLocation={userLocation} />} />
            <Route path="/dispatch" element={<DispatchForm />} />
            {userRole === 'admin' && <Route path="/admin" element={<AdminDashboard />} />}
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
  );
}

export default App;
