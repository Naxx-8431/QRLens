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


    {scannedText && (
      <div className="scan-result">
        Scanned: {scannedText}
      </div>
    )}
    <div className="container">
      <div className="left">
        <TextInput value={inputText} onChange={setInputText} onGenerate={handleGenerate} disabled={isGenerating || isScanning} />
      </div>

      <div className="right">
        <div className="qr-wrapper">

          {!generatedText && !isGenerating && (
            <div className="placeholder">
              Enter text and click Generate to see the QR code
            </div>
          )}

          {isGenerating && (
            <ProgressBar progress={progress} />
          )}

          {generatedText && (
            <QRCanvas text={generatedText} canvasRef={canvasRef} />
          )}

        </div>

        {generatedText && (
          <QRActions canvasRef={canvasRef} text={generatedText} />
        )}

      </div>
    </div>
  </div>
  );
}

export default App;