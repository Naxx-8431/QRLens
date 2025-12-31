import logo from "../assets/icon.png";
import { useState, useRef, useEffect } from "react";
import { Camera } from "@capacitor/camera";
import TextInput from "./components/TextInput";
import QRCanvas from "./components/QRCanvas";
import QRActions from "./components/QRActions";
import ProgressBar from "./components/ProgressBar";
import QRScanner from "./components/QRScanner";
import QRImageScanner from "./components/QRImageScanner";
import "./App.css";

/* =======================
   App Modes (Single Source of Truth)
======================= */
const APP_MODES = {
  IDLE: "idle",
  TYPING: "typing",
  GENERATING: "generating",
  SCANNING: "scanning",
  RESULT: "result",
  SCAN_RESULT: "scan_result",
};

function App() {
  /* =======================
     Theme
  ======================= */
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const [theme, setTheme] = useState(getInitialTheme);

  /* =======================
     App State
  ======================= */
  const [appMode, setAppMode] = useState(APP_MODES.IDLE);

  const [inputText, setInputText] = useState("");
  const [generatedText, setGeneratedText] = useState(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const [showScanPopup, setShowScanPopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  /* =======================
     Refs
  ======================= */
  const canvasRef = useRef(null);
  const imageScannerRef = useRef(null);
  const imageInputRef = useRef(null);
  const popupRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  /* =======================
     Utils
  ======================= */
  const requestCameraPermission = async () => {
    const perm = await Camera.requestPermissions({ permissions: ["camera"] });
    return perm.camera === "granted";
  };

  const isValidUrl = (text) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  /* =======================
     Generate QR
  ======================= */
  const handleGenerate = () => {
    if (!inputText.trim()) return;

    setGeneratedText(null);
    setProgress(0);
    setIsGenerating(true);
    setAppMode(APP_MODES.GENERATING);
  };

  /* =======================
     Progress Simulation
  ======================= */
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setGeneratedText(inputText.trim());
          setIsGenerating(false);
          setAppMode(APP_MODES.RESULT);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating, inputText]);

  /* =======================
     Theme Effect
  ======================= */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* =======================
     Scan Popup Controls
  ======================= */
  const closeScanPopup = () => {
    setShowScanPopup(false);
    setScannedText("");
    setAppMode(APP_MODES.IDLE);
  };

  const onTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    if (diff > 0) popupRef.current.style.transform = `translateY(${diff}px)`;
  };

  const onTouchEnd = () => {
    const diff = currentYRef.current - startYRef.current;
    if (diff > 120) closeScanPopup();
    else popupRef.current.style.transform = `translateY(0)`;

    startYRef.current = 0;
    currentYRef.current = 0;
  };

  /* =======================
     Render
  ======================= */
  return (
    <>
      {/* ===== Header ===== */}
      <header className="app-header">
        <img src={logo} alt="logo" className="header-logo" />

        <button
          className="theme-btn"
          disabled={appMode === APP_MODES.GENERATING || appMode === APP_MODES.SCANNING}
          onClick={() =>
            setTheme((prev) => (prev === "dark" ? "light" : "dark"))
          }
        >
          <span className="material-symbols-outlined">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </header>

      <div className="app-layout">
        {/* ===== Scanner ===== */}
        <div className="scanner-section">
          <div
            className={`scanner-container ${
              isScanning ? "" : "scanner-hidden"
            }`}
          >
            <QRScanner
              isScanning={isScanning}
              onScan={(text) => {
                setGeneratedText(null);
                setScannedText(text);
                setIsScanning(false);
                setShowScanPopup(true);
                setAppMode(APP_MODES.SCAN_RESULT);
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
              disabled={appMode === APP_MODES.GENERATING}
              onClick={async () => {
                if (isScanning) {
                  setIsScanning(false);
                  setAppMode(APP_MODES.IDLE);
                  return;
                }

                const granted = await requestCameraPermission();
                if (!granted) return alert("Camera permission required");

                setGeneratedText(null);
                setIsScanning(true);
                setAppMode(APP_MODES.SCANNING);
              }}
            >
              <span className="material-symbols-outlined">
                {isScanning ? "videocam_off" : "photo_camera"}
              </span>
            </button>

            <button
              className="scanner-btn"
              disabled={appMode === APP_MODES.GENERATING || appMode === APP_MODES.SCANNING}
              onClick={() => {
                setGeneratedText(null);
                imageInputRef.current.click();
              }}
            >
              <span className="material-symbols-outlined">image</span>
            </button>
          </div>

          <QRImageScanner
            ref={imageScannerRef}
            onScan={(text) => {
              setGeneratedText(null);
              setScannedText(text);
              setShowScanPopup(true);
              setAppMode(APP_MODES.SCAN_RESULT);
            }}
          />

          <input
            type="file"
            accept="image/*"
            ref={imageInputRef}
            style={{ display: "none" }}
            onChange={(e) =>
              imageScannerRef.current?.scanImage(e.target.files[0])
            }
          />
        </div>

        {/* ===== Scan Result Popup ===== */}
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

              <textarea readOnly value={scannedText} />

              <div className="scan-popup-actions">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(scannedText);
                    setCopySuccess(true);
                    setTimeout(() => {
                      setCopySuccess(false);
                      closeScanPopup();
                    }, 800);
                  }}
                >
                  <span className="material-symbols-outlined">content_copy</span>
                </button>

                <button
                  onClick={() => {
                    if (isValidUrl(scannedText)) {
                      window.open(scannedText, "_blank");
                      closeScanPopup();
                    } else alert("Not a valid link");
                  }}
                >
                  <span className="material-symbols-outlined">open_in_new</span>
                </button>

                <button onClick={closeScanPopup}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Main Content ===== */}
        <div className="container">
          <div className="left">
            <TextInput
              value={inputText}
              onChange={(val) => {
                setInputText(val);
                setGeneratedText(null);
                setAppMode(APP_MODES.TYPING);
              }}
              onGenerate={handleGenerate}
              disabled={
                appMode === APP_MODES.SCANNING ||
                appMode === APP_MODES.GENERATING
              }
            />
          </div>

          <div className="right">
            {appMode === APP_MODES.GENERATING && (
              <ProgressBar progress={progress} />
            )}

            {appMode === APP_MODES.RESULT && generatedText && (
              <div className="qr-block">
                <QRCanvas text={generatedText} canvasRef={canvasRef} />
                <QRActions canvasRef={canvasRef} text={generatedText} />
              </div>
            )}

            {appMode !== APP_MODES.RESULT &&
              appMode !== APP_MODES.GENERATING && (
                <div className="placeholder">
                  Enter text and click Generate to see the QR code
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
