import React, { useState } from 'react';
import axios from 'axios';

function UploadInventory() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert('Please select a CSV file.');

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await axios.post('/api/inventory/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(res.data.message);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = 'cs,serial,phone,type,status,location,po\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card p-4 mt-4">
      <h3 className="mb-3">Upload Inventory CSV</h3>
      <div className="mb-3">
        <input type="file" accept=".csv" onChange={handleFileChange} className="form-control" />
      </div>
      <button className="btn btn-secondary me-2" onClick={handleDownloadTemplate}>
        Download Sample Template
      </button>
      <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
}

export default UploadInventory;