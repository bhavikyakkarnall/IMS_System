import React, { useState } from 'react';
import axios from 'axios';

function Register() {
  const initialState = {
    first_name: '',
    last_name: '',
    company: '',
    address: '',
    suburb: '',
    city: '',
    postal_code: '',
    contact_number: '',
    email: '',
    password: '',
    confirm_password: ''
  };

  const [formData, setFormData] = useState(initialState);
  const [message, setMessage] = useState('');

  const handleChange = e =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleClear = () => setFormData(initialState);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      setMessage("Passwords do not match.");
      return;
    }
    try {
      const { confirm_password, ...dataToSend } = formData;
      const res = await axios.post('/api/register', dataToSend);
      setMessage(res.data.message);
      handleClear();
    } catch (err) {
      setMessage(err.response?.data.message || 'Registration failed');
    }
  };

  return (
    <div className="card p-3">
      <h2>Register</h2>
      {message && <div className="alert alert-info">{message}</div>}
      <form onSubmit={handleRegister}>
        <div className="row">
          <div className="mb-3 col-md-6">
            <label>First Name:</label>
            <input type="text" name="first_name" className="form-control" onChange={handleChange} required />
          </div>
          <div className="mb-3 col-md-6">
            <label>Last Name:</label>
            <input type="text" name="last_name" className="form-control" onChange={handleChange} required />
          </div>
        </div>
        <div className="mb-3">
          <label>Company:</label>
          <input type="text" name="company" className="form-control" onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label>Address:</label>
          <input type="text" name="address" className="form-control" onChange={handleChange} required />
        </div>
        <div className="row">
          <div className="mb-3 col-md-4">
            <label>Suburb:</label>
            <input type="text" name="suburb" className="form-control" onChange={handleChange} />
          </div>
          <div className="mb-3 col-md-4">
            <label>City:</label>
            <input type="text" name="city" className="form-control" onChange={handleChange} required />
          </div>
          <div className="mb-3 col-md-4">
            <label>Postal Code:</label>
            <input type="text" name="postal_code" className="form-control" onChange={handleChange} required />
          </div>
        </div>
        <div className="mb-3">
          <label>Contact Number:</label>
          <input type="text" name="contact_number" className="form-control" onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label>Email:</label>
          <input type="email" name="email" className="form-control" onChange={handleChange} required />
        </div>
        <div className="row">
          <div className="mb-3 col-md-6">
            <label>Password:</label>
            <input type="password" name="password" className="form-control" onChange={handleChange} required />
          </div>
          <div className="mb-3 col-md-6">
            <label>Confirm Password:</label>
            <input type="password" name="confirm_password" className="form-control" onChange={handleChange} required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary me-2">Register</button>
        <button type="button" className="btn btn-secondary" onClick={handleClear}>Clear</button>
      </form>
    </div>
  );
}

export default Register;
