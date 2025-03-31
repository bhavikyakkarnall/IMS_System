import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png'; // Adjust the path as needed

function Login({ setLoggedIn, setUserRole }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/login', formData);
      if (res.data.success) {
        setMessage('Login successful!');
        setLoggedIn(true);
        if (res.data.user) setUserRole(res.data.user.role);
        navigate('/');
      }
    } catch (err) {
      setMessage(err.response?.data.message || 'Login failed');
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-4">
          <img
            src={logo}
            alt="Logo"
            style={{ maxWidth: '150px', height: 'auto' }}
          />
        </div>
        <h3 className="text-center mb-3">Login</h3>
        {message && <div className="alert alert-info">{message}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label>Email:</label>
            <input
              type="email"
              name="email"
              className="form-control"
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label>Password:</label>
            <input
              type="password"
              name="password"
              className="form-control"
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">Login</button>
          <div className="d-flex justify-content-between mt-3">
            <Link to="/register" className="btn btn-link">Register</Link>
            <Link to="/password-reset" className="btn btn-link">Forgot Password</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
