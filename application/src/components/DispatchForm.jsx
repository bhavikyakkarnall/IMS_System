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

  // Each row includes cs, serial, type, qty, phone and the "isManual" flag.
  const initialRows = Array.from({ length: 5 }, () => ({
    cs: '',
    serial: '',
    type: '',
    qty: '',
    phone: '',
    isManual: false
  }));
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
    setItemRows(prevRows => {
      const newRows = [...prevRows];
      
      if (field === 'type') {
        // Mark the row as manually edited if user changes type.
        newRows[index][field] = value;
        newRows[index].isManual = true;
      } else {
        newRows[index][field] = value;
      }

      // For CS# changes, trigger auto-population only if:
      //  - Value is non-empty,
      //  - Value length is at least 6 characters,
      //  - And the row is not flagged as manual.
      if (field === 'cs' && value.trim() !== '' && value.length >= 7 && !newRows[index].isManual) {
        axios.get('/api/inventory/search', { params: { barcode: value } })
          .then(res => {
            if (res.data.success && res.data.item) {
              // Only update the row if the type was not manually set.
              setItemRows(prevRows2 => {
                const updatedRows = [...prevRows2];
                if (!updatedRows[index].isManual) {
                  const itemData = res.data.item;
                  updatedRows[index] = {
                    ...updatedRows[index],
                    cs: itemData.cs,
                    serial: itemData.serial,
                    phone: itemData.phone,
                    qty: itemData.qty || updatedRows[index].qty,
                    type: itemData.type
                  };
                }
                return updatedRows;
              });
            } else {
              alert('Item not found. Please re-enter the CS# or enter Type manually.');
              setItemRows(prevRows2 => {
                const updatedRows = [...prevRows2];
                updatedRows[index].cs = '';
                return updatedRows;
              });
            }
          })
          .catch(err => console.error(err));
      }

      // If user enters into CS or Type in the last row, add a new empty row.
      if ((field === 'cs' || field === 'type') && index === newRows.length - 1 && value.trim() !== '') {
        newRows.push({ cs: '', serial: '', type: '', qty: '', phone: '', isManual: false });
      }
      return newRows;
    });
  };

  const addRow = () => {
    setItemRows([...itemRows, { cs: '', serial: '', type: '', qty: '', phone: '', isManual: false }]);
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
    // Build two arrays: one for database updates and one for PDF generation.
    // For the database, we send only rows that are auto-populated (not manual).
    const itemsForDb = itemRows.filter(row => (row.cs || row.type) && !row.isManual);
    
    // For the PDF, include all rows that have either CS or type.
    const itemsForPdf = itemRows.filter(row => row.cs || row.type);

    const dispatchData = {
      techId: selectedTech.id,
      form_number: formData.form_number,
      tracking_number: formData.tracking_number,
      date: formData.date,
      comment: formData.comment,
      items: itemsForDb
    };

    try {
      const res = await axios.post('/api/dispatch', dispatchData);
      if (res.data.success) {
        // Generate PDF using all rows (manual and auto)
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

        // Table columns order: Qty, Type, CS, Serial, Phone.
        const tableColumn = ["Qty", "Type", "CS#", "Serial", "Phone"];
        const tableRows = itemsForPdf.map(item => [
          item.qty, item.type, item.cs, item.serial, item.phone
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

        // Save the PDF.
        doc.save(`${formData.form_number || 'dispatch_form'}.pdf`);

        // Clear the form.
        clearForm();
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
            <th>Qty</th>
            <th>Type</th>
            <th>CS#</th>
            <th>Serial</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {itemRows.map((row, index) => (
            <tr key={index}>
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
                  value={row.type}
                  onChange={e => handleRowChange(index, 'type', e.target.value)}
                />
              </td>
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
