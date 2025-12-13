import { useState } from "react";
import TextInput from "./TextInput";
import QRCanvas from "./QRCanvas";
import './App.css'

function App() {
  const [inputText, setInputText] = useState("");
  const [generatedText, setGeneratedText] = useState(null);
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
            <QRCanvas text={generatedText} />
          )}
          
        </div>
      </div>
    </div>
  );
}

export default App;