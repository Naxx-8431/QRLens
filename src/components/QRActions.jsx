function QRActions({ canvasRef, text }) {
  
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "qr-code.png";
    link.click();
  };

  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], "qr-code.png", {
        type: "image/png",
      });

      if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        alert("Image sharing not supported on this device");
        return;
      }

      try {
        await navigator.share({
          files: [file],
          title: "QR Code",
          text: "Scan this QR code",
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    });
  };


  return (
    <div className="qr-actions">
      <button className="action-button" onClick={handleDownload}>Download</button>

      <button className="action-button" onClick={handleShare}>Share</button>
    </div>
  );
}

export default QRActions;