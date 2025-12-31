import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";

const SCANNER_ID = "qr-scanner-region";

function QRScanner({ isScanning, onScan }) {
  const qrRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!qrRef.current) {
      qrRef.current = new Html5Qrcode(SCANNER_ID);
    }

    const scanner = qrRef.current;

    if (isScanning && !runningRef.current) {
      scanner
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h));
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            if (!runningRef.current) return;

            runningRef.current = false;

            scanner.stop().then(() => {
              onScan(decodedText);
            });
          }
        )
        .then(() => {
          runningRef.current = true;
          
          const videoElem = document.querySelector(`#${SCANNER_ID} video`);
          if (videoElem) {
            videoElem.setAttribute("playsinline", "true");
            videoElem.setAttribute("muted", "true");
            videoElem.style.opacity = "1"; 
          }
        })
        .catch(() => {});
    }

    if (!isScanning && runningRef.current) {
      scanner.stop().catch(() => {});
      runningRef.current = false;
    }

    return () => {
      if (runningRef.current) {
        scanner.stop().catch(() => {});
        runningRef.current = false;
      }
    };
  }, [isScanning, onScan]);

  return <div id={SCANNER_ID} />;
}

export default QRScanner;
