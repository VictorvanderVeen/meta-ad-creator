/**
 * Hamlin Fistula — "Stempel" template.
 * Matches the "URGENT" reference ads: full-bleed portrait photo, woven colour
 * band on top, and one worn orange stamp with a cream stencil word.
 *
 * Only the headline is drawn (uppercased); subtext, CTA and URL are ignored —
 * the stamp is a single word or a very short line.
 */
import { fitText } from '../../../lib/textFitter';
import {
  makeUnit, resolveAccentColor, loadFonts, drawPhoto, drawBand, getPlacementArea, placeBox,
} from '../shared';

// Small seeded PRNG so the wear pattern is identical on every re-render and
// export of the same text (Math.random would make the stamp flicker while typing).
function seededRandom(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Punches speckles and a few scratches out of the stamp so the photo shows
// through, like worn ink.
function wearStamp(sctx, w, h, u, random) {
  sctx.globalCompositeOperation = 'destination-out';

  const speckles = Math.round((w * h) / (u(1) * u(1) * 55));
  for (let i = 0; i < speckles; i++) {
    sctx.globalAlpha = 0.35 + random() * 0.65;
    sctx.beginPath();
    sctx.arc(random() * w, random() * h, u(0.5 + random() * 1.6), 0, Math.PI * 2);
    sctx.fill();
  }

  sctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = random() * w;
    const y = random() * h;
    const len = u(14 + random() * 34);
    const angle = -0.9 + random() * 0.5;
    sctx.globalAlpha = 0.5 + random() * 0.4;
    sctx.lineWidth = u(1 + random() * 1.4);
    sctx.beginPath();
    sctx.moveTo(x, y);
    sctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    sctx.stroke();
  }

  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-over';
}

export async function renderHamlinStempel(canvas, ctx, brand, adData, options, W, H) {
  const { typography } = brand;
  await loadFonts([`${typography.stampWeight} 40px "${typography.stampFont}"`]);

  const u = makeUnit(W, H);
  drawPhoto(ctx, brand, options.adImage, W, H, adData.image_position_x ?? 0.5, adData.image_position_y ?? 0.5);
  const bandH = drawBand(ctx, brand, W, u);
  const area = getPlacementArea(adData, W, H, bandH, u);

  const text = (adData.headline || '').toUpperCase();
  const padX = u(34);
  const padY = u(18);
  const maxTextW = Math.min(area.right - area.left - padX * 2, u(560));

  const fitted = fitText(
    ctx, text, maxTextW, 3, [40 * u.k, 96 * u.k],
    typography.stampFallback, typography.stampWeight
  );
  const font = `${typography.stampWeight} ${fitted.fontSize}px ${typography.stampFallback}`;
  ctx.font = font;
  const lineH = fitted.fontSize * 1.02;
  const textW = Math.max(...fitted.lines.map((line) => ctx.measureText(line).width));

  const boxW = Math.ceil(textW + padX * 2);
  const boxH = Math.ceil(fitted.lines.length * lineH + padY * 2);
  const { x: boxX, y: boxY } = placeBox(adData, 'hamlin-stempel', area, boxW, boxH);

  // The stamp is drawn on its own canvas so the wear only erases the stamp,
  // not the photo underneath.
  const stamp = document.createElement('canvas');
  stamp.width = boxW;
  stamp.height = boxH;
  const sctx = stamp.getContext('2d');

  sctx.fillStyle = resolveAccentColor(brand, adData.accent_color) || brand.colors.cta;
  sctx.beginPath();
  sctx.roundRect(0, 0, boxW, boxH, u(12));
  sctx.fill();

  sctx.fillStyle = brand.colors.stampText || brand.colors.textLight;
  sctx.font = font;
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  fitted.lines.forEach((line, i) => {
    sctx.fillText(line, boxW / 2, padY + lineH * (i + 0.5) + fitted.fontSize * 0.04);
  });

  wearStamp(sctx, boxW, boxH, u, seededRandom(text));

  ctx.drawImage(stamp, Math.round(boxX), Math.round(boxY));
}
