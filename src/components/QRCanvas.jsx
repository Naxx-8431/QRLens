import { useEffect } from "react";
import QRCode from "qrcode";

function QRCanvas({ text, canvasRef }) {
  const size = 300;

  useEffect(() => {
    if (!canvasRef.current || !text) return;

    QRCode.toCanvas(canvasRef.current, text, {
      width: size,
      margin: 1,
    });
  }, [text]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}

export default QRCanvas;
