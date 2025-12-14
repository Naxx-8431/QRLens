import { useState, useRef } from "react";
import TextInput from "./components/TextInput";
import QRCanvas from "./components/QRCanvas";
import QRActions from "./components/QRActions";
import './App.css'

function App() {
  const [inputText, setInputText] = useState("");
  const [generatedText, setGeneratedText] = useState(null);
  const canvasRef = useRef(null);
  const handleGenerate = () => {
    console.log(JSON.stringify(inputText));
    setGeneratedText(inputText);
  };
  

  return (
    <div className="container">
      <div className="left">
        <TextInput value={inputText} onChange={setInputText} onGenerate={handleGenerate} />
      </div>

      <div className="right">
        <div className="qr-wrapper">
          {!generatedText && (
            <div className="placeholder">
              Enter text and click Generate to see the QR code
            </div>
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