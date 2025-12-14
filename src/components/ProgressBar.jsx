function ProgressBar({ progress }) {
  return (
      <div className="progress">
      <div
        className="progress-fill"
        style={{ width: `${progress}%` }}
        />
      </div>
    
  );
}
export default ProgressBar;