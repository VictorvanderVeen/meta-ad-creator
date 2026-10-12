/**
 * Hamlin Fistula — helpers shared by the "label" and "stempel" templates.
 * Both reference ads are a full-bleed photo with the woven colour band along
 * the top and one orange box on top of the photo; only the box differs.
 */
import { SCALE } from '../../lib/constants';
import { getFormat } from '../../lib/formats';

export const HAMLIN_TEMPLATES = ['hamlin-label', 'hamlin-stempel'];

// Reference ads are square, so every size is defined against a 1080 short
// side and scaled down for landscape (628 high) instead of against the width.
export function makeUnit(W, H) {
  const k = Math.min(W, H) / (1080 * SCALE);
  const u = (val) => val * SCALE * k;
  u.k = k;
  return u;
}

export function resolveAccentColor(brand, accentKey) {
  if (!accentKey) return null;
  if (accentKey.startsWith('#')) return accentKey;
  return brand.colors[accentKey] || null;
}

// Canvas text only uses a web font once it has actually been loaded;
// document.fonts.ready does not cover fonts no DOM element uses yet.
export async function loadFonts(specs) {
  await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => null)));
}

export function drawPhoto(ctx, brand, img, W, H, posX = 0.5, posY = 0.5) {
  ctx.fillStyle = brand.colors.primary;
  ctx.fillRect(0, 0, W, H);
  if (!img) return;

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const areaRatio = W / H;
  let drawW, drawH, drawX, drawY;
  if (imgRatio > areaRatio) {
    drawH = H;
    drawW = drawH * imgRatio;
    drawX = (W - drawW) * posX;
    drawY = 0;
  } else {
    drawW = W;
    drawH = drawW / imgRatio;
    drawX = 0;
    drawY = (H - drawH) * posY;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

// Six equal colour blocks along the top edge (3.67% of the width in the
// reference ads). Faint horizontal lines hint at the woven texture.
export function drawBand(ctx, brand, W, u) {
  const colors = brand.band || [];
  if (colors.length === 0) return 0;
  const bandH = Math.round(u(40));
  const segW = W / colors.length;
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(i * segW), 0, Math.ceil(segW), bandH);
  });
  ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
  const rowH = Math.max(2, Math.round(u(3)));
  for (let y = rowH; y < bandH; y += rowH * 2) {
    ctx.fillRect(0, y, W, rowH);
  }
  return bandH;
}

// The rectangle a box may be placed in: inside the side margins, below the
// band and inside the Story/Reels safe zones.
export function getPlacementArea(adData, W, H, bandH, u) {
  const format = getFormat(adData.format || 'feed-square');
  const marginX = Math.round(W * 0.067);
  const safeTop = format.safeZone ? format.safeZone.top * SCALE : 0;
  const safeBottom = format.safeZone ? format.safeZone.bottom * SCALE : 0;
  return {
    left: marginX,
    right: W - marginX,
    top: Math.max(bandH + u(48), safeTop),
    bottom: H - Math.max(Math.round(H * 0.1), safeBottom + u(24)),
  };
}

// Where the box sits when the position sliders are untouched: the label
// bottom-left, the stamp right of the face (top-left on Story), as in the
// reference ads.
export function getDefaultLabelPosition(templateId, formatId) {
  if (templateId === 'hamlin-stempel') {
    return formatId === 'story' ? { x: 0, y: 0 } : { x: 1, y: 0.5 };
  }
  return { x: 0, y: 1 };
}

// Top-left corner of a boxW × boxH box for a 0–1 position inside the area.
export function placeBox(adData, templateId, area, boxW, boxH) {
  const fallback = getDefaultLabelPosition(templateId, adData.format || 'feed-square');
  const posX = adData.label_position_x ?? fallback.x;
  const posY = adData.label_position_y ?? fallback.y;
  return {
    x: area.left + Math.max(0, area.right - area.left - boxW) * posX,
    y: area.top + Math.max(0, area.bottom - area.top - boxH) * posY,
  };
}
