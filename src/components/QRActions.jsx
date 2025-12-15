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

  const handleShare = async () => {
    if (!canvasRef?.current) return;

    const canvas = canvasRef.current;

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );

    const file = new File([blob], "qr-code.png", {
      type: "image/png",
    });

    const shareData = {
      title: "QR Code",
      text: text,
      files: [file],
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.warn("Share cancelled", err);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Sharing not supported. Text copied instead.");
    }
  };


  return (
    <div className="qr-actions">
      <button className="action-button" onClick={handleDownload}>Download</button>

      <button className="action-button" onClick={handleShare}>Share</button>
    </div>
  );
}

export default QRActions;