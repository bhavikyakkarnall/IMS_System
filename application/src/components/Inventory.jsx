import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comments from './Comments';

function Inventory({ userRole, userLocation }) {
  // One search bar to match CS, serial, phone.
  const [searchTerm, setSearchTerm] = useState('');
  // Drop-down filters for status, location, type, po.
  const [filters, setFilters] = useState({
    status: '',
    location: '',
    type: '',
    po: ''
  });
  // Unique filter options from database.
  const [filterOptions, setFilterOptions] = useState({
    status: [],
    location: [],
    type: [],
    po: []
  });
  const [items, setItems] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);

  // Load unique filter values.
  useEffect(() => {
    axios.get('/api/inventory/filters')
      .then(res => setFilterOptions(res.data))
      .catch(err => console.error(err));
  }, []);

  // Fetch items whenever search term or filters change.
  useEffect(() => {
    const params = { search: searchTerm, ...filters };
    axios.get('/api/inventory', { params })
      .then(res => {
        let fetchedItems = res.data.items || [];
        if (userRole !== 'admin' && userLocation) {
          fetchedItems = fetchedItems.filter(item => item.location === userLocation);
        }
        setItems(fetchedItems);
      })
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
      {/* Filter Drop-downs */}
      <div className="row mb-3">
        {['status', 'location', 'type', 'po'].map((key) => (
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

      {/* Display items as cards */}
      <div className="row">
        {items.map(item => (
          <div key={item.id} className="col-md-4 mb-3">
            <div className="card h-100">
              <div className="card-body">
                <h5 className="card-title">{item.cs}</h5>
                <p className="card-text">
                  <strong>Status:</strong> {item.status}<br />
                  <strong>Serial:</strong> {item.serial}<br />
                  <strong>Phone:</strong> {item.phone}<br />
                  <strong>Type:</strong> {item.type}<br />
                  <strong>PO:</strong> {item.po}<br />
                  <strong>Location:</strong> {item.location}<br />
                  <strong>Updated:</strong> {item.updated_date}<br />
                  <strong>Received:</strong> {item.received_date}
                </p>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleComments(item.id)}>
                  {expandedCard === item.id ? 'Hide Comments ▲' : 'Show Comments ▼'}
                </button>
                {expandedCard === item.id && (
                  <div className="mt-3">
                    <Comments itemId={item.id} userRole={userRole} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Inventory;
