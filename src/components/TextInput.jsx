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
        Generate
      </button>
    </>
  );
}

export default TextInput;
