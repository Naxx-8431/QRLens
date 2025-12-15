import { useState, useRef, useEffect } from "react";
import TextInput from "./components/TextInput";
import QRCanvas from "./components/QRCanvas";
import QRActions from "./components/QRActions";
import ProgressBar from "./components/ProgressBar";
import QRScanner from "./components/QRScanner";
import './App.css'

function App() {
  const [scannedText, setScannedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [inputText, setInputText] = useState("");
  const [generatedText, setGeneratedText] = useState(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showScanPopup, setShowScanPopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const isValidUrl = (text) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };
  const handleGenerate = () => {
  if (!inputText.trim()) return;

    setIsGenerating(true);
    setProgress(0);
    setGeneratedText(null);
  };
    
  useEffect(() => {
  if (!isGenerating) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setGeneratedText(inputText.trim());
          setIsGenerating(false);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating, inputText]);

  return (

  <div className="app-layout">

    <div className="scanner-section">
      <div
        className={`scanner-container ${
          isScanning ? "" : "scanner-hidden"
        }`}
      >
        <QRScanner
          isScanning={isScanning}
          onScan={(text) => {
            setScannedText(text);
            setIsScanning(false);
            setShowScanPopup(true);
          }}
        />
      </div>

      <button
        className="scanner-btn"
        onClick={() => {
          setScannedText("");
          setIsScanning((prev) => !prev);
        }}
      >
        {isScanning ? "Stop Scan" : "Start Scan"}
      </button>
    </div>



    {showScanPopup && (
      <div className="scan-popup-overlay">
        <div className="scan-popup">
          <div className="sheet-handle" />
          <h3>Scanned Result</h3>

          <textarea
            readOnly
            value={scannedText}
            className="scan-popup-text"
          />

          {copySuccess && (
            <div className="copy-feedback">
              Copied!
            </div>
          )}

          <div className="scan-popup-actions">
            <button
              onClick={() => {
                navigator.clipboard.writeText(scannedText);
                setCopySuccess(true);

                setTimeout(() => {
                  setCopySuccess(false);
                  setShowScanPopup(false);   // ✅ auto-close
                }, 1000);
              }}
            >
              Copy
            </button>

            <button
              onClick={() => {
                if (/^https?:\/\//i.test(scannedText)) {
                  window.open(scannedText, "_blank", "noopener,noreferrer");
                  setShowScanPopup(false);
                } else {
                  alert("Not a valid link");
                }
              }}
            >
              Open
            </button>

            <button
              onClick={() => setShowScanPopup(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    
    <div className="container">
      <div className="left">
        <TextInput value={inputText} onChange={setInputText} onGenerate={handleGenerate} disabled={isGenerating || isScanning} />
      </div>

      <div className="right">

        {!generatedText && !isGenerating && (
          <div className="placeholder">
            Enter text and click Generate to see the QR code
          </div>
        )}

        {isGenerating && <ProgressBar progress={progress} />}

        {generatedText && (
          <div className="qr-block">
            <div className="qr-wrapper">
              <QRCanvas text={generatedText} canvasRef={canvasRef} />
            </div>

            <QRActions canvasRef={canvasRef} text={generatedText} />
          </div>
        )}

      </div>
    </div>
  </div>
  );
}

export default App;