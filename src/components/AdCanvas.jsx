import { useEffect, useRef } from 'react';
import { renderAd, tryLoadImage } from '../lib/canvasRenderer';
import { getFormat } from '../lib/formats';

export default function AdCanvas({ brand, adData, onCanvasReady, maxWidth = 540 }) {
  const canvasRef = useRef(null);

  const format = getFormat(adData?.format || 'feed-square');
  const aspectRatio = format.width / format.height;
  const displayWidth = Math.min(maxWidth, 540);
  const displayHeight = displayWidth / aspectRatio;

  useEffect(() => {
    if (!brand || !adData?.headline) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    async function draw() {
      await document.fonts.ready;
      // fonts.ready dekt geen fonts die nog geen DOM-element gebruikt: merkfonts expliciet laden.
      const t = brand.typography || {};
      await Promise.all([
        [t.headingWeight, t.headingFallback],
        [t.bodyWeight, t.bodyFallback],
        [t.ctaWeight, t.ctaFallback],
      ].filter(([, f]) => f).map(([w, f]) => document.fonts.load(`${w || 400} 40px ${f}`).catch(() => null)));

      // Logo wordt bewust nooit meegerenderd: die staat al op het Meta-account zelf.
      const logoImage = null;
      const logoWhiteImage = null;
      const adImage = await tryLoadImage(adData.image_url);
      const arrowImage = await tryLoadImage(brand.arrow?.url);

      if (cancelled) return;

      await renderAd(canvas, brand, adData, { logoImage, logoWhiteImage, adImage, arrowImage });

      if (onCanvasReady) {
        onCanvasReady(canvas);
      }
    }

    draw();

    return () => {
      cancelled = true;
    };
  }, [brand, adData, onCanvasReady]);

  return (
    <canvas
      ref={canvasRef}
      className="ad-canvas"
      style={{ width: displayWidth, height: displayHeight }}
    />
  );
}
