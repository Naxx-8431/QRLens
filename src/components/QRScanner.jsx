import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";

function QRScanner({ isScanning, onScan }) {
  const scannerRef = useRef(null);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef(null);
  const regionId = "qr-scanner-region";

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(regionId);
    }

    const scanner = scannerRef.current;

    if (isScanning && !isRunningRef.current) {
      scanner
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.7);
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            if (decodedText === lastScanRef.current) return;
            lastScanRef.current = decodedText;
            onScan(decodedText);
          }
        )
        .then(() => {
          isRunningRef.current = true;
        })
        .catch(() => {});
    }

    if (!isScanning && isRunningRef.current) {
      scanner.stop().catch(() => {});
      isRunningRef.current = false;
    }

    return () => {
      if (isRunningRef.current) {
        scanner.stop().catch(() => {});
        isRunningRef.current = false;
      }
    };
  }, [isScanning, onScan]);

  return <div id={regionId} />;
}

export default QRScanner;
