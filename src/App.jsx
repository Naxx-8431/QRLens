import { useState, useRef, useEffect } from "react";
import TextInput from "./components/TextInput";
import QRCanvas from "./components/QRCanvas";
import QRActions from "./components/QRActions";
import ProgressBar from "./components/ProgressBar";
import './App.css'

function App() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [inputText, setInputText] = useState("");
  const [generatedText, setGeneratedText] = useState(null);
  const canvasRef = useRef(null);
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
    <div className="container">
      <div className="left">
        <TextInput value={inputText} onChange={setInputText} onGenerate={handleGenerate} disabled={isGenerating} />
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
  );
}

export default App;