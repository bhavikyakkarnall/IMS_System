import React, { useState } from 'react';
import axios from 'axios';

function PasswordReset() {
  const [formData, setFormData] = useState({ email: '', new_password: '', confirm_password: '' });
  // Changed "message" state to "error" so that it only shows error messages in the banner.
  const [error, setError] = useState('');
  
  // Uncomment if using React Router for navigation
  // const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleReset = async (e) => {
    e.preventDefault();
    
    // Check if the new password and confirm password match
    if (formData.new_password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    
    try {
      // Exclude confirm_password from the data sent to the backend
      const { confirm_password, ...dataToSend } = formData;
      const res = await axios.post('/api/password-reset', dataToSend);
      
      // Successful response: show pop-up alert with message and redirect on acknowledgment
      window.alert(res.data.message);
      
      // Redirect to the login page using window.location:
      window.location.href = '/login';

      // If using React Router, you can use the following instead:
      // navigate('/login');
      
    } catch (err) {
      setError(err.response?.data.message || 'Reset failed');
    }
  };

  return (
    <div className="card p-3">
      <h2>Password Reset</h2>
      {error && <div className="alert alert-info">{error}</div>}
      <form onSubmit={handleReset}>
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
          <label>New Password:</label>
          <input 
            type="password" 
            name="new_password" 
            className="form-control" 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="mb-3">
          <label>Confirm Password:</label>
          <input 
            type="password" 
            name="confirm_password" 
            className="form-control" 
            onChange={handleChange} 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Reset Password
        </button>
      </form>
    </div>
  );
}

export default PasswordReset;
