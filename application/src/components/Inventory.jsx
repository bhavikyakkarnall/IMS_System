import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comments from './Comments';

function Inventory({ userRole, userLocation }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    location: '',
    type: '',
    po: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    status: [],
    location: [],
    type: [],
    po: []
  });
  const [items, setItems] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => {
    axios.get('/api/inventory/filters')
      .then(res => setFilterOptions(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const params = { search: searchTerm, ...filters };
    axios.get('/api/inventory', { params })
  .then(res => setItems(res.data.items || []))
  .catch(err => console.error(err));
  }, [searchTerm, filters, userRole, userLocation]);

  const toggleComments = (itemId) => {
    setExpandedCard(expandedCard === itemId ? null : itemId);
  };

  return (
    <div className="card p-3">
      <h2>Inventory</h2>

      {/* Search Bar */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search by CS, Serial or Phone"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="row mb-4">
        {['status', 'location', 'type', 'po'].map(key => (
          <div className="col-md-3" key={key}>
            <select
              className="form-select"
              value={filters[key]}
              onChange={e => setFilters({ ...filters, [key]: e.target.value })}
            >
              <option value="">{key.toUpperCase()}</option>
              {filterOptions[key].map((option, idx) => (
                <option key={idx} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Display items */}
      <div>
        {items.map(item => (
          <div key={item.id} className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">CS: {item.cs}</h5>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <strong>Status:</strong> {item.status}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Serial Number:</strong> {item.serial}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Phone:</strong> {item.phone}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Type:</strong> {item.type}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>PO Number:</strong> {item.po}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Location:</strong> {item.location}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Updated Date:</strong> {item.updated_date}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Received Date:</strong> {item.received_date}
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm mt-3"
                onClick={() => toggleComments(item.id)}
              >
                {expandedCard === item.id ? 'Hide Comments ▲' : 'Show Comments ▼'}
              </button>

              {expandedCard === item.id && (
                <div className="mt-3">
                  <Comments itemId={item.id} userRole={userRole} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Inventory;
