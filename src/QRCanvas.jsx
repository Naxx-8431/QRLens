import { useEffect, useRef } from "react";
import QRCode from "qrcode";

function QRCanvas({ text }) {
  const size = 300;
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, text || " ", { width: size, });
  }, [text]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}

export default QRCanvas;
