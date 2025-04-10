import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comments from './Comments';

function Inventory({ userRole, userName, userLocation }) {
  // Here, userName is assumed to be the full name of the logged-in user.
  // (Adjust as needed; in our login we store it as user.name)
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters includes an extra "company" filter
  const [filters, setFilters] = useState({
    status: '',
    location: '',
    type: '',
    po: '',
    company: '' // used by super-admin/admin/staff
  });
  
  // Filter options as returned from the server
  const [filterOptions, setFilterOptions] = useState({
    status: [],
    location: [],
    type: [],
    po: [],
    company: []
  });
  
  // Local state for location options (different per user role)
  const [locationOptions, setLocationOptions] = useState([]);
  
  const [items, setItems] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editItem, setEditItem] = useState({});

  // Modal state for CSV export.
  const [showExportModal, setShowExportModal] = useState(false);

  // Allowed roles for editing restricted fields.
  const allowedRoles = ['super-admin', 'admin', 'staff'];
  const canEditAll = userRole === 'super-admin' || userRole === 'admin';

  const availableFields = [
    { key: 'cs', label: 'CS' },
    { key: 'serial', label: 'Serial Number' },
    { key: 'phone', label: 'Phone' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'location', label: 'Location' },
    { key: 'po', label: 'PO Number' },
    { key: 'updated_date', label: 'Updated Date', restricted: true },
    { key: 'received_date', label: 'Received Date', restricted: true }
  ];

  const [selectedFields, setSelectedFields] = useState(
    availableFields.reduce((acc, field) => ({ ...acc, [field.key]: true }), {})
  );

  // Fetch filter options from the server.
  useEffect(() => {
    axios.get('/api/inventory/filters')
      .then(res => setFilterOptions(res.data))
      .catch(err => console.error(err));
  }, []);

  // Set locationOptions based on user role.
  useEffect(() => {
    // For super-admin, admin and staff: show all non-blank locations from filterOptions.
    if (allowedRoles.includes(userRole)) {
      const allLocations = filterOptions.location.filter(loc => loc && loc.trim() !== '');
      // Add an "All" option
      setLocationOptions(["All", ...allLocations]);
    } else if (userRole === 'company-admin') {
      // For company-admin, fetch company users.
      axios.get('/api/users/company')
        .then(res => {
          // Expecting res.data.users to be an array of objects with first_name and last_name.
          const companyNames = res.data.users.map(
            u => `${u.first_name} ${u.last_name}`
          );
          // You might optionally add an "All" option for company-admin as well.
          setLocationOptions(["All", ...companyNames]);
        })
        .catch(err => console.error(err));
    } else {
      // For regular users, only show their own name.
      setLocationOptions([userName]);
    }
  }, [filterOptions, userRole, userName]);

  // When fetching inventory, remove the location filter if "All" is selected.
  useEffect(() => {
    const activeFilters = { ...filters };
    if (activeFilters.location === "All" || !activeFilters.location) {
      delete activeFilters.location;
    }
    const params = { search: searchTerm, ...activeFilters };
    axios.get('/api/inventory', { params })
      .then(res => setItems(res.data.items || []))
      .catch(err => console.error(err));
  }, [searchTerm, filters, userRole, userLocation]);

  const toggleComments = (itemId) => {
    setExpandedCard(expandedCard === itemId ? null : itemId);
  };

  const handleFieldChange = (key) => {
    setSelectedFields({
      ...selectedFields,
      [key]: !selectedFields[key]
    });
  };

  const exportToCSV = () => {
    const headers = availableFields
      .filter(field =>
        selectedFields[field.key] && (!field.restricted || allowedRoles.includes(userRole))
      )
      .map(field => field.label);

    const rows = items.map(item => {
      return availableFields
        .filter(field =>
          selectedFields[field.key] && (!field.restricted || allowedRoles.includes(userRole))
        )
        .map(field => {
          let cell = item[field.key];
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
            cell = `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        });
    });

    const csvContent = headers.join(',') + '\n' + rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditItem(canEditAll ? { ...item } : { status: item.status });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditItem({});
  };

  const handleChange = (field, value) => {
    setEditItem({
      ...editItem,
      [field]: value
    });
  };

  const handleSave = (id) => {
    const payload = canEditAll ? editItem : { status: editItem.status };
    axios.put(`/api/inventory/${id}`, payload)
      .then(res => {
        const newItems = items.map(item => (item.id === id ? { ...item, ...payload } : item));
        setItems(newItems);
        setEditingId(null);
        setEditItem({});
      })
      .catch(err => console.error(err));
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
        {['status', 'type', 'po'].map(key => (
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

        {/* Location Filter depends on role */}
        <div className="col-md-3">
          <select
            className="form-select"
            value={filters.location}
            onChange={e => setFilters({ ...filters, location: e.target.value })}
          >
            <option value="">LOCATION</option>
            {locationOptions.map((loc, idx) => (
              <option key={idx} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* For super-admin, admin, and staff, also include Company filter */}
        {allowedRoles.includes(userRole) && (
          <div className="col-md-3">
            <select
              className="form-select"
              value={filters.company}
              onChange={e => setFilters({ ...filters, company: e.target.value })}
            >
              <option value="">COMPANY</option>
              {filterOptions.company.map((comp, idx) => (
                <option key={idx} value={comp}>{comp}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Export Button */}
      <div className="mb-4">
        <button className="btn btn-success" onClick={() => setShowExportModal(true)}>
          Export
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Select Fields to Export</h5>
                <button type="button" className="btn-close" onClick={() => setShowExportModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  {availableFields.map(field => (
                    <div className="col-md-6 mb-2" key={field.key}>
                      {(!field.restricted || allowedRoles.includes(userRole)) && (
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedFields[field.key]}
                            onChange={() => handleFieldChange(field.key)}
                            id={`check-${field.key}`}
                          />
                          <label className="form-check-label" htmlFor={`check-${field.key}`}>
                            {field.label}
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={exportToCSV}>
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Items */}
      <div>
        {items.map(item => (
          <div key={item.id} className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">CS: {item.cs}</h5>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <strong>Status:</strong> {editingId === item.id ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editItem.status}
                      onChange={e => handleChange('status', e.target.value)}
                    />
                  ) : (
                    item.status
                  )}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Serial Number:</strong>{' '}
                  {editingId === item.id && canEditAll ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editItem.serial}
                      onChange={e => handleChange('serial', e.target.value)}
                    />
                  ) : (
                    item.serial
                  )}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Phone:</strong>{' '}
                  {editingId === item.id && canEditAll ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editItem.phone}
                      onChange={e => handleChange('phone', e.target.value)}
                    />
                  ) : (
                    item.phone
                  )}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Type:</strong>{' '}
                  {editingId === item.id && canEditAll ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editItem.type}
                      onChange={e => handleChange('type', e.target.value)}
                    />
                  ) : (
                    item.type
                  )}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>PO Number:</strong>{' '}
                  {editingId === item.id && canEditAll ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editItem.po}
                      onChange={e => handleChange('po', e.target.value)}
                    />
                  ) : (
                    item.po
                  )}
                </div>
                <div className="col-md-6 mb-2">
                  <strong>Location:</strong>{' '}
                  {editingId === item.id && canEditAll ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editItem.location}
                      onChange={e => handleChange('location', e.target.value)}
                    />
                  ) : (
                    item.location
                  )}
                </div>
                {allowedRoles.includes(userRole) && (
                  <>
                    <div className="col-md-6 mb-2">
                      <strong>Updated Date:</strong>{' '}
                      {editingId === item.id && canEditAll ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editItem.updated_date}
                          onChange={e => handleChange('updated_date', e.target.value)}
                        />
                      ) : (
                        item.updated_date
                      )}
                    </div>
                    <div className="col-md-6 mb-2">
                      <strong>Received Date:</strong>{' '}
                      {editingId === item.id && canEditAll ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editItem.received_date}
                          onChange={e => handleChange('received_date', e.target.value)}
                        />
                      ) : (
                        item.received_date
                      )}
                    </div>
                  </>
                )}
              </div>
              {editingId === item.id ? (
                <div className="mt-3">
                  <button className="btn btn-primary me-2" onClick={() => handleSave(item.id)}>Save</button>
                  <button className="btn btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                </div>
              ) : (
                <button className="btn btn-warning btn-sm mt-3" onClick={() => handleEditClick(item)}>
                  Edit
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm mt-3 ms-2"
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
