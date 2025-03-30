import React, { useState } from 'react';
import axios from 'axios';

function PasswordReset() {
  const [formData, setFormData] = useState({ email: '', new_password: '', confirm_password: '' });
  const [message, setMessage] = useState('');

  const handleChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleReset = async (e) => {
    e.preventDefault();
    if (formData.new_password !== formData.confirm_password) {
      setMessage("Passwords do not match.");
      return;
    }
    try {
      const { confirm_password, ...dataToSend } = formData;
      const res = await axios.post('/api/password-reset', dataToSend);
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data.message || 'Reset failed');
    }
  };

  return (
    <div className="card p-3">
      <h2>Password Reset</h2>
      {message && <div className="alert alert-info">{message}</div>}
      <form onSubmit={handleReset}>
        <div className="mb-3">
          <label>Email:</label>
          <input type="email" name="email" className="form-control" onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>New Password:</label>
          <input type="password" name="new_password" className="form-control" onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Confirm Password:</label>
          <input type="password" name="confirm_password" className="form-control" onChange={handleChange} required />
        </div>
        <button type="submit" className="btn btn-primary">Reset Password</button>
      </form>
    </div>
  );
}

export default PasswordReset;
