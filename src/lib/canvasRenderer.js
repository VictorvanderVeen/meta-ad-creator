/**
 * Core canvas renderer — draws Meta ads using HTML5 Canvas.
 * Renders at 2x for retina quality.
 * Supports multiple formats (1:1, 4:5, 1.91:1, 9:16).
 *
 * Templates:
 *  - bold-text:    Big bold headline, white bg, colored band at bottom
 *  - foto-overlay: Full photo background with dark overlay, white text
 *  - foto-split:   Photo bottom half, headline on white/colored top half
 */

import { fitText, measureTextHeight, wrapText } from './textFitter';
import { getFormat } from './formats';
import { SCALE, s } from './constants';
import { renderStatement } from '../brands/follow-this/templates/statement';
import { renderFlatStatement } from '../brands/takecarebnb/templates/flat-statement';
import { renderPhotoHighlight } from '../brands/takecarebnb/templates/photo-highlight';
import { renderHamlinLabel } from '../brands/hamlin/templates/label';
import { renderHamlinStempel } from '../brands/hamlin/templates/stempel';

// ─── Safe zone: keep all text/CTA within these bounds ───
const SAFE_TOP_PCT = 0.14;    // no content in top 14%
const SAFE_BOTTOM_PCT = 0.20; // no content in bottom 20%

// ─── Helpers ───

function resolveAccentColor(brand, accentKey) {
  if (!accentKey) return null;
  if (accentKey.startsWith('#')) return accentKey;
  return brand.colors[accentKey] || null;
}

// Cache decoded images by src so re-renders (e.g. on every keystroke) don't
// re-fetch and re-decode the same logos/photos.
const imageCache = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function tryLoadImage(src) {
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);
  try {
    const img = await loadImage(src);
    imageCache.set(src, img);
    return img;
  } catch {
    return null;
  }
}

export function exportAsPng(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawCTA(ctx, brand, ctaText, x, y, whiteText = false) {
  if (!ctaText) return 0;
  const fontSize = s(34);
  ctx.font = `${brand.typography.ctaWeight} ${fontSize}px ${brand.typography.ctaFallback}`;
  const textWidth = ctx.measureText(ctaText).width;
  const btnPadX = s(38);
  const btnPadY = s(22);
  const btnW = textWidth + btnPadX * 2;
  const btnH = fontSize + btnPadY * 2;
  const btnR = s(6);

  ctx.fillStyle = brand.colors.cta;
  drawRoundedRect(ctx, x, y, btnW, btnH, btnR);

  ctx.fillStyle = whiteText ? '#FFFFFF' : brand.colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${brand.typography.ctaWeight} ${fontSize}px ${brand.typography.ctaFallback}`;
  ctx.fillText(ctaText, x + btnPadX, y + btnH / 2);

  return btnH;
}

function drawURL(ctx, brand, url, x, y, color) {
  if (!url) return 0;
  const fontSize = s(20);
  ctx.font = `${brand.typography.bodyWeight} ${fontSize}px ${brand.typography.bodyFallback}`;
  ctx.fillStyle = color || brand.colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(url, x, y);
  return fontSize + s(8);
}

function drawLogo(ctx, logoImg, brand, canvasW, x, y, maxH) {
  if (!logoImg) return 0;
  const mH = s(maxH || brand.logo?.maxHeight || 60);
  const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
  const h = Math.min(mH, logoImg.naturalHeight);
  const w = h * ratio;

  const logoX = brand.logo?.position === 'top-right' ? canvasW - x - w : x;
  ctx.drawImage(logoImg, logoX, y, w, h);
  return h;
}

function drawHeadlineLines(ctx, lines, fontSize, x, startY, lineHeight, primaryColor, accentColor) {
  let y = startY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    const isAccentLine = i === 1 && accentColor;
    ctx.fillStyle = isAccentLine ? accentColor : primaryColor;
    ctx.fillText(line, x, y);
    y += fontSize * lineHeight;
  });

  return y;
}

/**
 * Fits + draws a headline in one step. Returns the Y coordinate just below it.
 * Shared by the bold-text and foto-split templates (foto-overlay measures the
 * headline separately for bottom-up layout, so it calls fitText directly).
 */
function drawHeadline(ctx, brand, adData, { x, startY, contentWidth, sizeRange, primaryColor, accentColor }) {
  const headingFont = brand.typography.headingFallback;
  const result = fitText(
    ctx, adData.headline || '', contentWidth,
    brand.layout.headingMaxLines, sizeRange,
    headingFont, brand.typography.headingWeight
  );
  ctx.font = `${brand.typography.headingWeight} ${result.fontSize}px ${headingFont}`;
  return drawHeadlineLines(ctx, result.lines, result.fontSize, x, startY, 1.15, primaryColor, accentColor);
}

/**
 * Word-wraps + draws subtext. Returns the Y coordinate just below the last line.
 */
function drawSubtext(ctx, brand, text, x, startY, fontSize, color, contentWidth) {
  ctx.font = `${brand.typography.bodyWeight} ${fontSize}px ${brand.typography.bodyFallback}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  let y = startY;
  for (const line of wrapText(ctx, text, contentWidth)) {
    ctx.fillText(line, x, y);
    y += fontSize * 1.4;
  }
  return y;
}

/**
 * Cover-fill an image into a target area (like CSS object-fit: cover).
 * posX/posY (0-1, default 0.5 = centered) work like CSS object-position:
 * they only have visible effect on the axis that actually overflows —
 * 0 keeps the crop's left/top edge, 1 keeps its right/bottom edge.
 */
function drawImageCover(ctx, img, targetX, targetY, targetW, targetH, posX = 0.5, posY = 0.5) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const areaRatio = targetW / targetH;
  let drawW, drawH, drawX, drawY;

  if (imgRatio > areaRatio) {
    drawH = targetH;
    drawW = drawH * imgRatio;
    drawX = targetX + (targetW - drawW) * posX;
    drawY = targetY;
  } else {
    drawW = targetW;
    drawH = drawW / imgRatio;
    drawX = targetX;
    drawY = targetY + (targetH - drawH) * posY;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(targetX, targetY, targetW, targetH);
  ctx.clip();
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// ─── Template: Bold Text ───

async function renderBoldText(canvas, ctx, brand, adData, options, W, H) {
  const padding = s(brand.layout.padding);
  const contentWidth = W - padding * 2;
  const accentColor = resolveAccentColor(brand, adData.accent_color);
  const bandColor = accentColor || brand.colors.primary;

  // Safe zone boundaries
  const safeTop = Math.round(H * SAFE_TOP_PCT);
  const topStart = Math.max(padding, safeTop);

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Colored band at bottom (25% of height)
  const bandHeight = Math.round(H * 0.25);
  const bandY = H - bandHeight;
  ctx.fillStyle = bandColor;
  ctx.fillRect(0, bandY, W, bandHeight);

  // Logo — stays at top, not affected by text safe zone
  const logoH = drawLogo(ctx, options.logoImage, brand, W, padding, padding, 70);
  const logoBottomY = Math.max(padding + logoH + s(32), topStart);

  // Headline
  const headlineEndY = drawHeadline(ctx, brand, adData, {
    x: padding, startY: logoBottomY, contentWidth, sizeRange: [40, 80],
    primaryColor: brand.colors.headingColor, accentColor,
  });

  // Subtext
  let currentY = headlineEndY + s(16);
  if (adData.subtext) {
    currentY = drawSubtext(ctx, brand, adData.subtext, padding, currentY, s(36), brand.colors.text, contentWidth);
    currentY += s(8);
  }

  // CTA
  currentY += s(12);
  const ctaH = drawCTA(ctx, brand, adData.cta_text, padding, currentY);
  currentY += ctaH;

  // URL
  if (adData.url) {
    currentY += s(12);
    drawURL(ctx, brand, adData.url, padding, currentY, brand.colors.text);
  }

  // White logo in band (bottom-right)
  if (options.logoWhiteImage) {
    const mH = s(brand.logo?.maxHeight || 50);
    const logo = options.logoWhiteImage;
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const h = Math.min(mH, logo.naturalHeight);
    const w = h * ratio;
    ctx.drawImage(logo, W - padding - w, bandY + (bandHeight - h) / 2, w, h);
  }
}

// ─── Template: Foto Overlay ───

async function renderFotoOverlay(canvas, ctx, brand, adData, options, W, H) {
  const padding = s(brand.layout.padding);
  const contentWidth = W - padding * 2;
  const accentColor = resolveAccentColor(brand, adData.accent_color);
  const format = getFormat(adData.format || 'feed-square');
  const formatSafeTop = format.safeZone ? s(format.safeZone.top) : 0;
  const formatSafeBottom = format.safeZone ? s(format.safeZone.bottom) : 0;

  // Percentage-based safe zones (take the largest of format-specific and global)
  const safeTop = Math.max(formatSafeTop, Math.round(H * SAFE_TOP_PCT));
  const safeBottom = Math.max(formatSafeBottom, Math.round(H * SAFE_BOTTOM_PCT));
  const maxContentBottom = H - safeBottom;

  // Dark base
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  // Draw photo
  if (options.adImage) {
    drawImageCover(ctx, options.adImage, 0, 0, W, H, adData.image_position_x ?? 0.5, adData.image_position_y ?? 0.5);
  }

  // Dark overlay gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.3)');
  gradient.addColorStop(0.65, 'rgba(0, 0, 0, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Accent line at top
  ctx.fillStyle = accentColor || brand.colors.cta;
  ctx.fillRect(0, 0, W, s(6));

  // Logo (white) — stays in top-left corner, not affected by text safe zone
  const logoImg = options.logoWhiteImage || options.logoImage;
  drawLogo(ctx, logoImg, brand, W, padding, padding, 65);

  // ── Pre-measure all content to lay out bottom-up within safe zone ──
  const headingFont = brand.typography.headingFallback;
  const headingResult = fitText(
    ctx, adData.headline || '', contentWidth,
    brand.layout.headingMaxLines, [36, 72],
    headingFont, brand.typography.headingWeight
  );
  const headingHeight = measureTextHeight(headingResult.fontSize, headingResult.lines.length, 1.15);

  // Measure subtext height
  let subtextHeight = 0;
  let subLines = [];
  const subSize = s(34);
  if (adData.subtext) {
    ctx.font = `${brand.typography.bodyWeight} ${subSize}px ${brand.typography.bodyFallback}`;
    subLines = wrapText(ctx, adData.subtext, contentWidth);
    subtextHeight = subLines.length * subSize * 1.4 + s(8);
  }

  // Measure CTA height (must match drawCTA's own fontSize/padding, see above)
  let ctaHeight = 0;
  if (adData.cta_text) {
    const ctaFontSize = s(34);
    const ctaBtnPadY = s(22);
    ctaHeight = ctaFontSize + ctaBtnPadY * 2;
  }

  // Measure URL height
  let urlHeight = 0;
  if (adData.url) {
    urlHeight = s(20) + s(8);
  }

  // Total content height: headline + gaps + subtext + gap + cta + gap + url
  const gapHeadlineSub = adData.subtext ? s(8) : 0;
  const gapSubCta = adData.cta_text ? s(8) : 0;
  const gapCtaUrl = adData.url ? s(10) : 0;
  const totalContentH = headingHeight + gapHeadlineSub + subtextHeight + gapSubCta + ctaHeight + gapCtaUrl + urlHeight;

  // Position headline so entire block ends at maxContentBottom
  const headlineStartY = Math.max(safeTop + padding, maxContentBottom - totalContentH);

  // Text scrim: the whole-image gradient above has a lighter band around the
  // vertical middle (see the gradient stops), so longer subtext (more lines →
  // taller block → headlineStartY pushed further up) can drift into that
  // lighter zone and become unreadable. This second, content-height-aware
  // gradient darkens exactly the area the text block occupies, regardless of
  // how long the copy is.
  const scrimTop = Math.max(0, headlineStartY - s(24));
  if (scrimTop < H) {
    const scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    scrim.addColorStop(0.3, 'rgba(0, 0, 0, 0.55)');
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, scrimTop, W, H - scrimTop);
  }

  // ── Draw headline ──
  ctx.font = `${brand.typography.headingWeight} ${headingResult.fontSize}px ${headingFont}`;
  const y = drawHeadlineLines(
    ctx, headingResult.lines, headingResult.fontSize,
    padding, headlineStartY, 1.15,
    '#FFFFFF', accentColor
  );

  // Subtext
  let currentY = y + gapHeadlineSub;
  if (adData.subtext) {
    currentY = drawSubtext(ctx, brand, adData.subtext, padding, currentY, subSize, '#FFFFFF', contentWidth);
    currentY += s(8);
  }

  // CTA
  if (adData.cta_text) {
    currentY += s(8);
    const ctaH = drawCTA(ctx, brand, adData.cta_text, padding, currentY, true);
    currentY += ctaH;
  }

  // URL
  if (adData.url) {
    currentY += s(10);
    drawURL(ctx, brand, adData.url, padding, currentY, 'rgba(255,255,255,0.7)');
  }
}

// ─── Template: Foto Split ───

async function renderFotoSplit(canvas, ctx, brand, adData, options, W, H) {
  const padding = s(brand.layout.padding);
  const contentWidth = W - padding * 2;
  const accentColor = resolveAccentColor(brand, adData.accent_color);

  // For landscape: photo on right side. For portrait/square: photo on bottom.
  const isLandscape = W > H;

  // Safe zone boundaries
  const safeTop = Math.round(H * SAFE_TOP_PCT);
  const topStart = Math.max(padding, safeTop);

  if (isLandscape) {
    // ── Landscape: text left, photo right ──
    const splitX = Math.round(W * 0.50);
    const photoWidth = W - splitX;

    // Left — white bg
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, splitX, H);

    // Right — photo or color
    if (options.adImage) {
      drawImageCover(ctx, options.adImage, splitX, 0, photoWidth, H, adData.image_position_x ?? 0.5, adData.image_position_y ?? 0.5);
      ctx.fillStyle = accentColor || brand.colors.primary;
      ctx.fillRect(splitX, 0, s(5), H);
    } else {
      ctx.fillStyle = accentColor || brand.colors.accent3;
      ctx.fillRect(splitX, 0, photoWidth, H);
    }

    // Logo — stays at top, not affected by text safe zone
    const textContentWidth = splitX - padding * 2;
    const logoH = drawLogo(ctx, options.logoImage, brand, splitX, padding, padding, 60);
    const logoBottomY = Math.max(padding + logoH + s(24), topStart);

    // Headline
    const headlineEndY = drawHeadline(ctx, brand, adData, {
      x: padding, startY: logoBottomY, contentWidth: textContentWidth, sizeRange: [28, 52],
      primaryColor: brand.colors.headingColor, accentColor,
    });

    let currentY = headlineEndY + s(12);
    if (adData.subtext) {
      currentY = drawSubtext(ctx, brand, adData.subtext, padding, currentY, s(28), brand.colors.text, textContentWidth);
      currentY += s(4);
    }

    currentY += s(12);
    const ctaH = drawCTA(ctx, brand, adData.cta_text, padding, currentY);
    currentY += ctaH;

    if (adData.url) {
      currentY += s(10);
      drawURL(ctx, brand, adData.url, padding, currentY, brand.colors.text);
    }
  } else {
    // ── Portrait / Square: text top, photo bottom ──
    const splitY = Math.round(H * 0.55);
    const photoHeight = H - splitY;

    // Top — white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, splitY);

    // Bottom — photo or color
    if (options.adImage) {
      drawImageCover(ctx, options.adImage, 0, splitY, W, photoHeight, adData.image_position_x ?? 0.5, adData.image_position_y ?? 0.5);
      ctx.fillStyle = accentColor || brand.colors.primary;
      ctx.fillRect(0, splitY, W, s(5));
    } else {
      ctx.fillStyle = accentColor || brand.colors.accent3;
      ctx.fillRect(0, splitY, W, photoHeight);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, splitY, W * 0.6, photoHeight);
    }

    // Logo — stays at top, not affected by text safe zone
    const logoH = drawLogo(ctx, options.logoImage, brand, W, padding, padding, 70);
    const logoBottomY = Math.max(padding + logoH + s(28), topStart);

    // Headline
    const headlineEndY = drawHeadline(ctx, brand, adData, {
      x: padding, startY: logoBottomY, contentWidth, sizeRange: [36, 68],
      primaryColor: brand.colors.headingColor, accentColor,
    });

    let currentY = headlineEndY + s(12);
    if (adData.subtext) {
      currentY = drawSubtext(ctx, brand, adData.subtext, padding, currentY, s(34), brand.colors.text, contentWidth);
      currentY += s(4);
    }

    currentY += s(12);
    const ctaH = drawCTA(ctx, brand, adData.cta_text, padding, currentY);
    currentY += ctaH;

    if (adData.url) {
      currentY += s(10);
      drawURL(ctx, brand, adData.url, padding, currentY, brand.colors.text);
    }
  }
}

// ─── Main Entry Point ───

const TEMPLATES = {
  'bold-text': renderBoldText,
  'foto-overlay': renderFotoOverlay,
  'foto-split': renderFotoSplit,
  'statement': renderStatement,
  'flat-statement': renderFlatStatement,
  'photo-highlight': renderPhotoHighlight,
  'hamlin-label': renderHamlinLabel,
  'hamlin-stempel': renderHamlinStempel,
};

export const TEMPLATE_LABELS = {
  'bold-text': { name: 'Bold Text', description: 'Grote headline, witte achtergrond, kleurband onderaan' },
  'foto-overlay': { name: 'Foto Overlay', description: 'Foto als achtergrond, donkere overlay, witte tekst' },
  'foto-split': { name: 'Foto Split', description: 'Headline boven, foto onderaan' },
  'statement': { name: 'Statement', description: 'Vol vlak merkkleur, losse tekstblokken, pijl, geen knop of logo' },
  'flat-statement': { name: 'Flat Statement', description: 'Vol vlak merkkleur, kop + linkregel, wordmark, geen knop' },
  'photo-highlight': { name: 'Photo Highlight', description: 'Foto als achtergrond, kop met 1 gemarkeerd woord, wordmark' },
  'hamlin-label': { name: 'Label', description: 'Foto beeldvullend, kleurenband boven, oranje label: kop + grote regel (CTA-veld, bv. €40), subtekst wordt niet getoond' },
  'hamlin-stempel': { name: 'Stempel', description: 'Foto beeldvullend, kleurenband boven, oranje stempel met alleen de kop (bv. URGENT)' },
};

// Returns the templates available in the UI. When a brand is passed, the
// list is filtered to brand.templates (set in the brand's JSON config) so
// brand-specific templates like "statement" only show up for that brand.
export function getTemplateList(brand) {
  const allIds = Object.keys(TEMPLATES);
  if (!brand?.templates) return allIds;
  return allIds.filter((id) => brand.templates.includes(id));
}

export async function renderAd(canvas, brand, adData, options = {}) {
  const ctx = canvas.getContext('2d');
  const format = getFormat(adData.format || 'feed-square');

  const W = format.width * SCALE;
  const H = format.height * SCALE;

  canvas.width = W;
  canvas.height = H;

  const templateId = adData.template || 'bold-text';
  const renderFn = TEMPLATES[templateId] || renderBoldText;

  await renderFn(canvas, ctx, brand, adData, options, W, H);

  return canvas;
}
