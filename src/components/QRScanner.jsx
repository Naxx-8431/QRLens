import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";

function QRScanner({ onScan }) {
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const isRunningRef = useRef(false);
  const initializedRef = useRef(false);
  const regionId = "qr-scanner-region";

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner.start(
        { facingMode: "environment" },
        { 
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight);
            return Math.floor(size * 0.7);
          }
        },
        (decodedText) => {
          if (scannedRef.current) return;

          scannedRef.current = true;
          onScan(decodedText);

          if (isRunningRef.current) {
            scanner.stop().catch(() => {});
            isRunningRef.current = false;
          }
        }
      )
      .then(() => {
        isRunningRef.current = true;
      })
      .catch((err) => {
        console.warn("QR Scanner error:", err);
      });

    return () => {
      if (isRunningRef.current) {
        scanner.stop().catch(() => {});
        isRunningRef.current = false;
      }
    };
  }, []);

  return <div id={regionId} />;
}

export default QRScanner;
