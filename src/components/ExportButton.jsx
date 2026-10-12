import { exportAsPng } from '../lib/canvasRenderer';
import { saveAs } from 'file-saver';

export default function ExportButton({ canvas, filename = 'meta-ad.png', label = 'Download PNG' }) {
  const handleExport = async () => {
    if (!canvas) return;
    const blob = await exportAsPng(canvas);
    saveAs(blob, filename);
  };

  return (
    <button
      className="export-btn"
      onClick={handleExport}
      disabled={!canvas}
    >
      {label}
    </button>
  );
}
