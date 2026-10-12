/**
 * Follow This — "Statement" template (June 2026 brandbook).
 *
 * Full-bleed brand color, bold-caps headline top-left, body copy positioned
 * independently instead of stacked under the headline, a diagonal arrow as
 * a fixed graphic element, an optional cutout photo bottom-right, and an
 * optional CTA rendered as plain text next to the arrow (no button, no logo).
 *
 * Follow-This-specific — not shared with other brands, so it owns its own
 * layout math rather than reusing the stacking helpers in canvasRenderer.js.
 */

import { fitText, wrapText } from '../../../lib/textFitter';
import { s } from '../../../lib/constants';

const SAFE_TOP_PCT = 0.08;
const SAFE_BOTTOM_PCT = 0.08;

function resolveAccentColor(brand, accentKey) {
  if (!accentKey) return null;
  if (accentKey.startsWith('#')) return accentKey;
  return brand.colors[accentKey] || null;
}

function getLuminance(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Relative luminance → black or white copy, so text stays readable on any
// brand color (black on green/white/blue-bell, white on black/amethyst).
function getContrastColor(hex) {
  return getLuminance(hex) > 0.5 ? '#000000' : '#FFFFFF';
}

// Contain-fits an image (no cropping) anchored to a bottom-right point —
// a cutout PNG must never be cropped the way a full-bleed photo is.
function drawImageContain(ctx, img, anchorRight, anchorBottom, maxW, maxH) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = maxW / maxH;
  const drawW = imgRatio > boxRatio ? maxW : maxH * imgRatio;
  const drawH = imgRatio > boxRatio ? maxW / imgRatio : maxH;
  ctx.drawImage(img, anchorRight - drawW, anchorBottom - drawH, drawW, drawH);
}

// Fallback only — used if the real brand-arrow asset (see drawBrandArrow) fails
// to load. Generic line + wedge head, not the brandbook's actual arrow shape.
function drawArrowFallback(ctx, fromX, fromY, toX, toY, thickness, color) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = thickness * 2.8;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'butt';

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX - Math.cos(angle) * headLen * 0.55, toY - Math.sin(angle) * headLen * 0.55);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 7), toY - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(toX - headLen * 0.55 * Math.cos(angle), toY - headLen * 0.55 * Math.sin(angle));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 7), toY - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

// The real brandbook arrow glyph (extracted from the logo's "↗", see
// public/brands/follow-this/arrow.png) — the source file is solid white and
// points up-right. Rotating 180° around its own box center points it
// down-left and lands the tip exactly at (x, y), same anchor
// drawArrowFallback used.
//
// Recoloring (for the white-background variant) happens on an OFFSCREEN
// buffer, not directly on the main canvas: 'source-atop' only paints where
// the destination already has opaque pixels, and by the time the arrow is
// drawn the main canvas is already fully opaque everywhere (the full-bleed
// background fill) — so filling directly on it recolors the whole bounding
// box, not just the arrow shape. A buffer that starts fully transparent
// doesn't have that problem.
function drawBrandArrow(ctx, img, x, y, size, color) {
  const buffer = document.createElement('canvas');
  buffer.width = size;
  buffer.height = size;
  const bctx = buffer.getContext('2d');
  bctx.translate(size / 2, size / 2);
  bctx.rotate(Math.PI);
  bctx.drawImage(img, -size / 2, -size / 2, size, size);
  if (color && color !== '#FFFFFF') {
    bctx.globalCompositeOperation = 'source-atop';
    bctx.fillStyle = color;
    bctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.drawImage(buffer, x, y - size, size, size);
}

export async function renderStatement(canvas, ctx, brand, adData, options, W, H) {
  const padding = s(brand.layout.padding);
  const contentWidth = W - padding * 2;

  const bgColor = resolveAccentColor(brand, adData.accent_color) || brand.colors.primary;
  const textColor = getContrastColor(bgColor);

  // Full-bleed background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  const safeTop = Math.max(padding, Math.round(H * SAFE_TOP_PCT));
  const safeBottomY = H - Math.max(padding, Math.round(H * SAFE_BOTTOM_PCT));

  // Headline — top-left, bold caps (brandbook: primary statement is always capitals).
  // Hardcoded to weight 800 (heaviest Open Sans cut we load) rather than
  // brand.typography.headingWeight (700) — just for this headline, so the other
  // 3 shared Follow-This templates keep their existing weight.
  const headingFont = brand.typography.headingFallback;
  const headingWeight = '800';
  const headingResult = fitText(
    ctx, (adData.headline || '').toUpperCase(), contentWidth,
    brand.layout.headingMaxLines, [40, 88],
    headingFont, headingWeight
  );
  ctx.font = `${headingWeight} ${headingResult.fontSize}px ${headingFont}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let headlineY = safeTop;
  const headlineLineHeight = headingResult.fontSize * 1.05;
  headingResult.lines.forEach((line) => {
    ctx.fillText(line, padding, headlineY);
    headlineY += headlineLineHeight;
  });

  // Body copy — its own block, deliberately NOT stacked under the headline.
  // Bold (not brand.typography.bodyWeight/400) — this template's reference ads
  // treat the subtext as a second, heavier statement, not regular paragraph copy.
  // Sized as a ratio of the actual rendered headline size (Canva reference: 70pt
  // headline / 40pt subtext+cta) rather than a fixed number, so the proportion
  // holds even when the headline auto-shrinks for a longer text.
  if (adData.subtext) {
    const subSize = headingResult.fontSize * (40 / 70);
    const subColumnWidth = contentWidth * 0.55;
    const subX = W - padding - subColumnWidth;
    let subY = Math.round(H * 0.4);

    ctx.font = `800 ${subSize}px ${brand.typography.bodyFallback}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const line of wrapText(ctx, adData.subtext, subColumnWidth)) {
      ctx.fillText(line, subX, subY);
      subY += subSize * 1.35;
    }
  }

  // Photo — optional cutout, contain-fit, anchored bottom-right (bleeds off the edge).
  // adData.image_scale (0-1, share of canvas) lets the user size it themselves
  // instead of us guessing a fixed box; 0.48 matches the original reference ads.
  if (options.adImage) {
    const imageScale = adData.image_scale || 0.48;
    drawImageContain(ctx, options.adImage, W, H, W * imageScale, H * imageScale);
  }

  // Arrow — fixed bottom-left, diagonal, pointing toward the corner. White by
  // default: every reference ad uses a white arrow regardless of background
  // (green/black/amethyst/blue-bell all give it enough contrast). Only flips to
  // black when the background itself is white/near-white (e.g. accent4), where a
  // white arrow would otherwise disappear.
  const arrowColor = getLuminance(bgColor) > 0.92 ? '#000000' : '#FFFFFF';
  const arrowSize = Math.min(W, H) * 0.09;
  const arrowFromX = padding + arrowSize;
  const arrowFromY = safeBottomY - arrowSize;
  if (options.arrowImage) {
    drawBrandArrow(ctx, options.arrowImage, padding, safeBottomY, arrowSize, arrowColor);
  } else {
    drawArrowFallback(ctx, arrowFromX, arrowFromY, padding, safeBottomY, arrowSize * 0.22, arrowColor);
  }

  // CTA — plain text stacked above the arrow (not beside it), no button. Empty =
  // arrow stands alone.
  if (adData.cta_text) {
    const ctaSize = headingResult.fontSize * (40 / 70);
    ctx.font = `${brand.typography.ctaWeight} ${ctaSize}px ${brand.typography.ctaFallback}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(adData.cta_text, padding, arrowFromY - s(16));
  }

  // URL — optional, small, top-right (this template has no logo).
  if (adData.url) {
    const urlSize = s(20);
    ctx.font = `${brand.typography.bodyWeight} ${urlSize}px ${brand.typography.bodyFallback}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(adData.url, W - padding, padding);
  }
}
