import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function BarcodeScanner({ onScanSuccess }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "scanner",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanner.SCAN_TYPE_CAMERA]
      },
      false
    );

    scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText); // callback to parent
        scanner.clear().catch(err => console.error('Clear error:', err));
      },
      (error) => {
        // Optionally log scan errors
        // console.warn("Scan error", error);
      }
    );

    return () => {
      scanner.clear().catch(err => console.error('Clear error:', err));
    };
  }, [onScanSuccess]);

  return <div id="scanner" ref={scannerRef} />;
}

export default BarcodeScanner;
