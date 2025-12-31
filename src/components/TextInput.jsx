function TextInput({ value, onChange, onGenerate, disabled }) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={
          disabled
            ? "Stop the scanner to enter text"
            : "Enter text or URL here..."
        }
      />

      <button
        className="gen-button"
        onClick={onGenerate}
        disabled={disabled}
      >
        <span className="material-symbols-outlined">qr_code_2</span>
        <span>Generate</span>
      </button>
    </>
  );
}

export default TextInput;
