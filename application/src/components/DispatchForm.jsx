import React, { useEffect, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function DispatchForm() {
  const [users, setUsers] = useState([]);
  const [selectedTech, setSelectedTech] = useState({});
  const [formData, setFormData] = useState({
    form_number: '',
    tracking_number: '',
    date: new Date().toISOString().substr(0, 10),
    comment: ''
  });
  // Initialize with 5 empty rows for items.
  const initialRows = Array.from({ length: 5 }, () => ({ cs: '', serial: '', qty: '', phone: '' }));
  const [itemRows, setItemRows] = useState(initialRows);

  useEffect(() => {
    axios.get('/api/users/list')
      .then(res => setUsers(res.data.users || []))
      .catch(err => console.error("Error fetching users", err));
  }, []);

  const handleTechSelect = (e) => {
    const techId = e.target.value;
    const tech = users.find(u => u.id === parseInt(techId));
    setSelectedTech(tech || {});
  };

  const handleRowChange = (index, field, value) => {
    // Update the itemRows state using a functional update.
    setItemRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index][field] = value;
      
      // Check if the changed field is "cs" or "serial" in the last row and non-empty.
      if ((field === 'cs' || field === 'serial') && index === newRows.length - 1 && value.trim() !== '') {
        newRows.push({ cs: '', serial: '', qty: '', phone: '' });
      }
      
      return newRows;
    });

    // For cs or serial, attempt auto-population from the inventory.
    if (field === 'cs' || field === 'serial') {
      axios.get('/api/inventory/search', { params: { barcode: value } })
        .then(res => {
          if (res.data.success && res.data.item) {
            setItemRows(prevRows => {
              const updatedRows = [...prevRows];
              updatedRows[index] = {
                cs: res.data.item.cs,
                serial: res.data.item.serial,
                qty: updatedRows[index].qty,
                phone: res.data.item.phone
              };
              return updatedRows;
            });
          } else {
            alert('Item not found. Please re-enter.');
            setItemRows(prevRows => {
              const updatedRows = [...prevRows];
              updatedRows[index][field] = '';
              return updatedRows;
            });
          }
        })
        .catch(err => console.error(err));
    }
  };

  const addRow = () => {
    setItemRows([...itemRows, { cs: '', serial: '', qty: '', phone: '' }]);
  };

  const clearForm = () => {
    setSelectedTech({});
    setFormData({
      form_number: '',
      tracking_number: '',
      date: new Date().toISOString().substr(0, 10),
      comment: ''
    });
    setItemRows(initialRows);
  };

  const handleDispatchSubmit = async () => {
    const dispatchData = {
      techId: selectedTech.id, // send tech id to back end
      form_number: formData.form_number,
      tracking_number: formData.tracking_number,
      date: formData.date,
      comment: formData.comment,
      items: itemRows.filter(row => row.cs || row.serial)
    };

    try {
      const res = await axios.post('/api/dispatch', dispatchData);
      if (res.data.success) {
        const doc = new jsPDF();
        let margin = 15;
        let verticalOffset = margin;

        doc.setFontSize(16);
        doc.text("Dispatch Form", margin, verticalOffset);
        verticalOffset += 10;
        doc.setFontSize(12);
        doc.text(`Tech: ${selectedTech.first_name || ''} ${selectedTech.last_name || ''}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Address: ${selectedTech.address || ''}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Company: ${selectedTech.company || ''}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Contact: ${selectedTech.contact || ''}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Email: ${selectedTech.email || ''}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Form Number: ${formData.form_number}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Tracking Number: ${formData.tracking_number}`, margin, verticalOffset);
        verticalOffset += 7;
        doc.text(`Date: ${formData.date}`, margin, verticalOffset);
        verticalOffset += 10;

        const tableColumn = ["CS#", "Serial", "Qty", "Phone"];
        const tableRows = dispatchData.items.map(item => [
          item.cs, item.serial, item.qty, item.phone
        ]);
        
        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: verticalOffset,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 3 },
          headStyles: { fillColor: [22, 160, 133] }
        });
        verticalOffset = doc.lastAutoTable.finalY + 10;
        doc.text("Comment:", margin, verticalOffset);
        verticalOffset += 7;
        doc.text(formData.comment || '', margin, verticalOffset, { maxWidth: 180 });
        doc.save(`${formData.form_number || 'dispatch_form'}.pdf`);
      } else {
        alert("Dispatch failed: " + res.data.message);
      }
    } catch (error) {
      console.error("Dispatch error", error);
      alert("An error occurred while processing dispatch.");
    }
  };

  return (
    <div className="card p-3">
      <h2>Dispatch Form</h2>
      <div className="d-flex justify-content-between flex-wrap gap-4">
        {/* Left side: Tech Info */}
        <div className="flex-grow-1" style={{ minWidth: '300px' }}>
          <div className="mb-3">
            <label>Select Tech:</label>
            <select className="form-select" onChange={handleTechSelect} value={selectedTech.id || ''}>
              <option value="">Select a tech</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
          </div>
          {selectedTech && (
            <div className="mb-3">
              <p><strong>Address:</strong> {selectedTech.address}</p>
              <p><strong>Company:</strong> {selectedTech.company}</p>
              <p><strong>Email:</strong> {selectedTech.email}</p>
            </div>
          )}
        </div>

        {/* Right side: Date, Form Number, Tracking Number */}
        <div className="flex-grow-1" style={{ minWidth: '300px' }}>
          <div className="mb-3">
            <label>Date:</label>
            <input
              type="date"
              className="form-control"
              value={formData.date}
              readOnly
            />
          </div>
          <div className="mb-3">
            <label>Form Number:</label>
            <input
              type="text"
              className="form-control"
              value={formData.form_number}
              onChange={e => setFormData({ ...formData, form_number: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <label>Tracking Number:</label>
            <input
              type="text"
              className="form-control"
              value={formData.tracking_number}
              onChange={e => setFormData({ ...formData, tracking_number: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <h4>Items</h4>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>CS#</th>
            <th>Serial</th>
            <th>Qty</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {itemRows.map((row, index) => (
            <tr key={index}>
              <td>
                <input 
                  type="text" 
                  className="form-control" 
                  value={row.cs}
                  onChange={e => handleRowChange(index, 'cs', e.target.value)}
                />
              </td>
              <td>
                <input 
                  type="text" 
                  className="form-control" 
                  value={row.serial}
                  onChange={e => handleRowChange(index, 'serial', e.target.value)}
                />
              </td>
              <td>
                <input 
                  type="number" 
                  className="form-control" 
                  value={row.qty}
                  onChange={e => handleRowChange(index, 'qty', e.target.value)}
                />
              </td>
              <td>
                <input 
                  type="text" 
                  className="form-control" 
                  value={row.phone}
                  onChange={e => handleRowChange(index, 'phone', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-secondary mb-3" onClick={addRow}>+ Add Row</button>

      <div className="mb-3">
        <label>Comment:</label>
        <textarea 
          className="form-control" 
          value={formData.comment}
          onChange={e => setFormData({ ...formData, comment: e.target.value })}
        ></textarea>
      </div>
      <div>
        <button className="btn btn-primary me-2" onClick={handleDispatchSubmit}>Save</button>
        <button className="btn btn-warning" onClick={clearForm}>Clear</button>
      </div>
    </div>
  );
}

export default DispatchForm;
