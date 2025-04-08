import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

function TechnicianReturns() {
  const [scannedItems, setScannedItems] = useState([]);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/home')
      .then(res => {
        // Optionally, you can log or use the user info, but don't redirect based on role.
        // console.log("Logged in user:", res.data.user);
      })
      .catch(() => navigate('/'));
  }, [navigate]);
  

  // Autofocus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Set up the barcode scanner (mobile use)
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'tech-scanner',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false
    );

    scanner.render(handleScan, (error) => {
      console.error("Scan failure:", error);
    });

    return () => {
      scanner.clear().catch(err => console.error('Scanner cleanup error:', err));
    };
  }, [scannedItems]);

  // Handler for scanning via camera
  const handleScan = async (code) => {
    if (!code) return;

    // Avoid scanning the same item multiple times
    if (scannedItems.find(item => item.cs === code || item.serial === code)) return;

    try {
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

  // Handler for manual entry scan
  const handleManualScan = async () => {
    const code = input.trim();
    if (!code) return;

    // Check if item already exists
    if (scannedItems.find(item => item.cs === code || item.serial === code)) {
      setInput('');
      return;
    }

    try {
      const res = await axios.get('/api/inventory/search', { params: { barcode: code } });
      if (res.data.success && res.data.item) {
        setScannedItems(prev => [...prev, res.data.item]);
      } else {
        alert(`Item not found for code: ${code}`);
      }
    } catch (err) {
      console.error('Lookup error:', err);
    }
    setInput('');
    inputRef.current?.focus();
  };

  // Remove a scanned item from the list
  const handleRemove = (cs) => {
    setScannedItems(prev => prev.filter(item => item.cs !== cs));
  };

  // Batch update all scanned items
  const handleTransitAll = async () => {
    if (scannedItems.length === 0) return;
    try {
      const csList = scannedItems.map(item => item.cs);
      const res = await axios.post('/api/inventory/transitBatch', { csList });
      if (res.data.success) {
        alert('Items updated to Transit to Office.');
        setScannedItems([]);
      } else {
        alert(`Update failed: ${res.data.message}`);
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('Error updating items');
    }
  };

  return (
    <div className="card p-4">
      <h2>Technician – Transit Items to Office</h2>

      {/* Scanner Section */}
      <div className="mb-4">
        <h5>Scan using Camera:</h5>
        <div id="tech-scanner" style={{ width: '100%' }}></div>
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
                  <strong>CS:</strong> {item.cs} | <strong>Serial:</strong> {item.serial}
                </span>
                <button className="btn btn-sm btn-danger" onClick={() => handleRemove(item.cs)}>Remove</button>
              </li>
            ))}
          </ul>
          <button className="btn btn-success" onClick={handleTransitAll}>
            Mark All as Transit to Office
          </button>
        </>
      )}
    </div>
  );
}

export default TechnicianReturns;
