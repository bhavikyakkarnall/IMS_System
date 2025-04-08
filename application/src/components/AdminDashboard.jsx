import React, { useEffect, useState } from 'react';
import axios from 'axios';

function AdminDashboard() {
  const [data, setData] = useState({ users: [], requests: [] });
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  // State for Approval Modal
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState(null);
  const [selectedRole, setSelectedRole] = useState('user');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios.get('/api/users')
      .then(res => {
        if (res.data.success) {
          setData({ users: res.data.users, requests: res.data.requests });
        }
      })
      .catch(err => setMessage(err.response?.data.message || 'Error fetching data'));
  };

  // Open approval modal and set the current request ID.
  const openApprovalModal = (requestId) => {
    setApprovalModalOpen(true);
    setApprovalRequestId(requestId);
    setSelectedRole('user');  // default role on modal open
  };

  // Close approval modal and clear related state.
  const closeApprovalModal = () => {
    setApprovalModalOpen(false);
    setApprovalRequestId(null);
  };

  // Process the approval using the selected role.
  const handleApprovalSubmit = async () => {
    try {
      await axios.post('/api/users/approve', { request_id: approvalRequestId, role: selectedRole });
      fetchData();
      closeApprovalModal();
    } catch (err) {
      console.error('Approval failed', err);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await axios.post('/api/users/reject', { request_id: requestId });
      fetchData();
    } catch (err) {
      console.error('Rejection failed', err);
    }
  };

  const handleDelete = async (userId) => {
    try {
      await axios.delete(`/api/users/${userId}`);
      fetchData();
    } catch (err) {
      console.error('Deletion failed', err);
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditingUser({ ...editingUser, [name]: value });
  };

  const handleEditSave = async () => {
    try {
      const { id, ...updatedFields } = editingUser;
      await axios.put(`/api/users/${id}`, updatedFields);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      console.error('Update failed', err);
    }
  };

  const handleEditCancel = () => {
    setEditingUser(null);
  };

  return (
    <div className="card p-3">
      <h2>Admin Dashboard</h2>
      {message && <div className="alert alert-danger">{message}</div>}
      
      <h4>Pending Registration Requests</h4>
      {data.requests.length === 0 ? (
        <p>No pending requests</p>
      ) : (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Contact Number</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.requests.map(req => (
              <tr key={req.id}>
                <td>{req.first_name} {req.last_name}</td>
                <td>{req.email}</td>
                <td>{req.company}</td>
                <td>{req.contact_number}</td>
                <td>
                  <button
                    className="btn btn-success btn-sm me-2"
                    onClick={() => openApprovalModal(req.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleReject(req.id)}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4>All Users</h4>
      {data.users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Company</th>
              <th>Address</th>
              <th>Suburb</th>
              <th>City</th>
              <th>Postal Code</th>
              <th>Contact Number</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map(user => (
              <tr key={user.id}>
                <td>{user.first_name}</td>
                <td>{user.last_name}</td>
                <td>{user.company}</td>
                <td>{user.address}</td>
                <td>{user.suburb}</td>
                <td>{user.city}</td>
                <td>{user.postal_code}</td>
                <td>{user.contact_number}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => handleEditClick(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(user.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Approval Modal */}
      {approvalModalOpen && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Approve User & Select Role</h5>
                <button type="button" className="btn-close" onClick={closeApprovalModal}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="roleSelect" className="form-label">Select Role:</label>
                  <select
                    id="roleSelect"
                    className="form-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                  >
                    <option value="super-admin">super-admin</option>
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                    <option value="company-admin">company-admin</option>
                    <option value="user">user</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeApprovalModal}>Cancel</button>
                <button className="btn btn-primary" onClick={handleApprovalSubmit}>Approve</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit User Details</h5>
                <button type="button" className="btn-close" onClick={handleEditCancel}></button>
              </div>
              <div className="modal-body">
                <form>
                  <div className="mb-3">
                    <label>First Name:</label>
                    <input
                      type="text"
                      name="first_name"
                      className="form-control"
                      value={editingUser.first_name}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Last Name:</label>
                    <input
                      type="text"
                      name="last_name"
                      className="form-control"
                      value={editingUser.last_name}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Company:</label>
                    <input
                      type="text"
                      name="company"
                      className="form-control"
                      value={editingUser.company}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Address:</label>
                    <input
                      type="text"
                      name="address"
                      className="form-control"
                      value={editingUser.address}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Suburb:</label>
                    <input
                      type="text"
                      name="suburb"
                      className="form-control"
                      value={editingUser.suburb}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>City:</label>
                    <input
                      type="text"
                      name="city"
                      className="form-control"
                      value={editingUser.city}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Postal Code:</label>
                    <input
                      type="text"
                      name="postal_code"
                      className="form-control"
                      value={editingUser.postal_code}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Contact Number:</label>
                    <input
                      type="text"
                      name="contact_number"
                      className="form-control"
                      value={editingUser.contact_number}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Email:</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={editingUser.email}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Role:</label>
                    <input
                      type="text"
                      name="role"
                      className="form-control"
                      value={editingUser.role}
                      onChange={handleEditChange}
                    />
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={handleEditCancel}>Cancel</button>
                <button className="btn btn-primary" onClick={handleEditSave}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
