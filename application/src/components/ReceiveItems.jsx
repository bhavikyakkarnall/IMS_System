import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';


function ReceiveItems() {
  const [scannedItems, setScannedItems] = useState([]);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    axios.get('/api/home')
      .then(res => {
        if (res.data.user?.role !== 'admin') {
          navigate('/');
        }
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  // Autofocus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Barcode Scanner Setup
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'scanner',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false
    );

    scanner.render(
      handleScan,
      () => {} // optional scan failure handler
    );

    return () => {
      scanner.clear().catch(err => console.error('Scanner cleanup error:', err));
    };
  }, []);

  const handleScan = async (code) => {
    if (!code) return;
    await handleBarcodeLookup(code);
  };

  const handleManualScan = async () => {
    if (!input.trim()) return;
    await handleBarcodeLookup(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const handleBarcodeLookup = async (code) => {
    try {
      const exists = scannedItems.find(i => i.cs === code || i.serial === code);
      if (exists) return;

      const res = await axios.get('/api/inventory/search', { params: { barcode: code } });
      if (res.data.success && res.data.item) {
        setScannedItems(prev => [...prev, res.data.item]);
      } else {
        alert(`Item not found for code: ${code}`);
      }
    } catch (err) {
      console.error('Lookup error:', err);
    }
  };

  const handleRemove = (cs) => {
    setScannedItems(prev => prev.filter(item => item.cs !== cs));
  };

  const handleReceiveAll = async () => {
    try {
      const csList = scannedItems.map(item => item.cs);
      const res = await axios.post('/api/inventory/receive', { csList });

      if (res.data.success) {
        alert('Items successfully received and moved to Warehouse');
        setScannedItems([]);
      } else {
        alert('Failed to receive items');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating items');
    }
  };

  return (
    <div className="card p-4">
      <h2>Receive Items</h2>

      {/* Scanner Section */}
      <div className="mb-4">
        <h5>Scan using Camera:</h5>
        <div id="scanner" style={{ width: '100%' }}></div>
      </div>

      {/* Manual Entry Section */}
      <div className="d-flex gap-2 mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Enter CS/Serial manually"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
          ref={inputRef}
        />
        <button className="btn btn-primary" onClick={handleManualScan}>Add</button>
      </div>

      {/* Display Scanned Items */}
      {scannedItems.length > 0 && (
        <>
          <h5>Scanned Items</h5>
          <ul className="list-group mb-3">
            {scannedItems.map((item, idx) => (
              <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                <span>
                  <strong>CS:</strong> {item.cs} | <strong>Serial:</strong> {item.serial} | <strong>Phone:</strong> {item.phone}
                </span>
                <button className="btn btn-sm btn-danger" onClick={() => handleRemove(item.cs)}>Remove</button>
              </li>
            ))}
          </ul>

          <button className="btn btn-success" onClick={handleReceiveAll}>Mark All as Received</button>
        </>
      )}
    </div>
  );
}

export default ReceiveItems;
