function TextInput({ value, onChange, onGenerate }) {
  return (
    <>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter Text or URL here.."
    />

    <button className="gen-button" onClick={onGenerate}>
      Generate
    </button>

    </>
  );
}

export default TextInput;
