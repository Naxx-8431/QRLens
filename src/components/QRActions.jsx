import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function QRActions({ canvasRef, text, appBusy }) {

  const downloadQR = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64 = canvas
      .toDataURL("image/png")
      .replace("data:image/png;base64,", "");

    const fileName = `QR_${Date.now()}.png`;

    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Documents,
    });

    alert("Saved to Documents folder");
  };

  const shareQR = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64 = canvas
      .toDataURL("image/png")
      .replace("data:image/png;base64,", "");

    const fileName = `QR_${Date.now()}.png`;

    const file = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "QR Code",
      text: "Shared from QRLens",
      files: [file.uri],
    });
  };

  return (
    <div className="qr-actions">
      <button
        className="action-button"
        onClick={downloadQR}
      >
        <span className="material-symbols-outlined">download</span>
      </button>

      <button
        className="action-button"
        onClick={shareQR}
      >
        <span className="material-symbols-outlined">share</span>
      </button>
    </div>
  );
}

export default QRActions;
