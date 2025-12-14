function TextInput({ value, onChange, onGenerate, disabled }) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter Text or URL here.."
      />

      <button
        className="gen-button"
        onClick={onGenerate}
        disabled={disabled}
      >
        {disabled ? "Generating..." : "Generate"}
      </button>
    </>
  );
}

export default TextInput;
