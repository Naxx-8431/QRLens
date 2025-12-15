import { forwardRef, useImperativeHandle, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QRImageScanner = forwardRef(({ onScan }, ref) => {
  const qrRef = useRef(null);
  const containerId = "qr-image-reader";

  useImperativeHandle(ref, () => ({
    async scanImage(file) {
      if (!file) return;

      try {
        if (!qrRef.current) {
          qrRef.current = new Html5Qrcode(containerId);
        }

        const decodedText = await qrRef.current.scanFile(file, true);
        onScan(decodedText);
      } catch (err) {
        alert("No QR code found in the selected image");
      }
    },
  }));

  return <div id={containerId} style={{ display: "none" }} />;
});

export default QRImageScanner;
