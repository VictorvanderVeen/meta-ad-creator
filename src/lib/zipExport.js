import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { exportAsPng } from './canvasRenderer';

/**
 * Exports multiple canvases as a ZIP file of PNGs.
 *
 * @param {Array<{ canvas: HTMLCanvasElement, filename: string }>} items
 * @param {string} zipFilename
 */
export async function exportAsZip(items, zipFilename = 'meta-ads.zip') {
  const zip = new JSZip();

  for (const { canvas, filename } of items) {
    const blob = await exportAsPng(canvas);
    zip.file(filename, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipFilename);
}
