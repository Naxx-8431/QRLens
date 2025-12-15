import { useState, useRef, useEffect } from "react";
import TextInput from "./components/TextInput";
import QRCanvas from "./components/QRCanvas";
import QRActions from "./components/QRActions";
import ProgressBar from "./components/ProgressBar";
import QRScanner from "./components/QRScanner";
import QRImageScanner from "./components/QRImageScanner";
import './App.css'

function App() {
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const [appBusy, setAppBusy] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const [scannedText, setScannedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [inputText, setInputText] = useState("");
  const [generatedText, setGeneratedText] = useState(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showScanPopup, setShowScanPopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const imageScannerRef = useRef(null);
  const imageInputRef = useRef(null);
  const popupRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const onTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0) {
      popupRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const onTouchEnd = () => {
    const diff = currentYRef.current - startYRef.current;

    if (diff > 120) {
      closeScanPopup();
    } else {
      popupRef.current.style.transform = `translateY(0)`;
    }

    startYRef.current = 0;
    currentYRef.current = 0;
  };
  
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

    setAppBusy("generating");
    setIsGenerating(true);
    setProgress(0);
    setGeneratedText(null);
  };

  const closeScanPopup = () => {
    setShowScanPopup(false);
    setScannedText("");
    setAppBusy(null);   
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
    
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

  useEffect(() => {
    if (!isScanning && !isGenerating) {
      setAppBusy(null);
    }
  }, [isScanning, isGenerating]);

  return (

    <>
      <header className="app-header">
        <div className="app-title">QRLens</div>

        <div className="header-right">
          <button
            className="theme-btn"
            disabled={appBusy !== null} // ✅ KEY FIX
            onClick={() =>
              setTheme((prev) => (prev === "dark" ? "light" : "dark"))
            }
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
      </header>

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

            <div className="scan-overlay">
              <div className="scan-box"></div>
              <p className="scan-hint">Align QR within the frame</p>
            </div>
          </div>

          <div className="scanner-type-btn">
            <button
              className="scanner-btn"
              disabled={appBusy === "generating"} // only block during generation
              onClick={() => {
                if (isScanning) {
                  // STOP scan
                  setIsScanning(false);
                  setAppBusy(null);
                } else {
                  // START scan
                  setScannedText("");
                  setIsScanning(true);
                  setAppBusy("scanning");
                }
              }}
            >
              {isScanning ? "Stop Scan" : "Start Scan"}
            </button>


              <button
                className="scanner-btn"
                disabled={appBusy !== null}
                onClick={() => imageInputRef.current.click()}
              >
                Scan Image
              </button>
            </div>
          <QRImageScanner
            ref={imageScannerRef}
            onScan={(text) => {
              setScannedText(text);
              setShowScanPopup(true);
              setAppBusy(null);
            }}
          />

          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            ref={imageInputRef}
            style={{ display: "none" }}
            onChange={(e) =>
              imageScannerRef.current?.scanImage(e.target.files[0])
            }
          />
        </div>



        {showScanPopup && (
          <div className="scan-popup-overlay">
            <div
              className="scan-popup"
              ref={popupRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
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
                      closeScanPopup(); // ✅
                    }, 1000);
                  }}
                >
                  Copy
                </button>

                <button
                  onClick={() => {
                    if (isValidUrl(scannedText)) {
                      window.open(scannedText, "_blank", "noopener,noreferrer");
                      closeScanPopup(); // ✅
                    } else {
                      alert("Not a valid link");
                    }
                  }}
                >
                  Open
                </button>

                <button onClick={closeScanPopup}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        
        <div className="container">
          <div className="left">
            <TextInput value={inputText} onChange={setInputText} onGenerate={handleGenerate} disabled={appBusy !== null} />
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
  </>
  );
}

export default App;