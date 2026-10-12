/**
 * Take Care BNB — "Photo Highlight" template.
 * Matches the two photo-based reference ads: full-bleed photo, light scrim
 * (these photos stay bright, unlike a heavy dark overlay), bold white
 * headline with one highlighted phrase in brand lime, wordmark bottom-left.
 * No button.
 *
 * Highlight a word/phrase by wrapping it in ** in the headline field, e.g.
 * "Neem een **wereldburger** in huis en word er zelf één".
 *
 * Text anchors top-left by default (matches the "wereldburger" ad). Set
 * adData.text_position = 'bottom' to anchor it low instead (matches the
 * "verhalen, gerechten en gewoontes" ad).
 */
import { fitText, wrapText } from '../../../lib/textFitter';
import { s } from '../../../lib/constants';
import { drawWordmark } from '../wordmark';

function drawImageCover(ctx, img, targetX, targetY, targetW, targetH) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const areaRatio = targetW / targetH;
  let drawW, drawH, drawX, drawY;

  if (imgRatio > areaRatio) {
    drawH = targetH;
    drawW = drawH * imgRatio;
    drawX = targetX + (targetW - drawW) / 2;
    drawY = targetY;
  } else {
    drawW = targetW;
    drawH = drawW / imgRatio;
    drawX = targetX;
    drawY = targetY + (targetH - drawH) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(targetX, targetY, targetW, targetH);
  ctx.clip();
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// "Neem een **wereldburger** in huis" -> ordered word tokens with a bold
// flag, plus the marker-free text that fitText/wrapText wraps against (the
// ** markers must never affect width measurement or line breaks).
function parseHighlightedHeadline(raw) {
  const tokens = [];
  const regex = /\*\*(.+?)\*\*|(\S+)/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    if (match[1] !== undefined) {
      match[1].split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ word: w, bold: true }));
    } else {
      tokens.push({ word: match[2], bold: false });
    }
  }
  return { tokens, plainText: tokens.map((t) => t.word).join(' ') };
}

// Draws already-wrapped plain-text lines, recoloring each word from the
// original bold/plain token list (wrapping never reorders or drops words,
// so consuming tokens in line order lines them back up).
function drawHighlightedLines(ctx, lines, tokens, x, startY, lineHeight, baseColor, highlightColor) {
  let y = startY;
  let tokenIndex = 0;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lines.forEach((line) => {
    const wordCount = line.split(' ').length;
    let cursorX = x;
    for (let i = 0; i < wordCount; i++) {
      const token = tokens[tokenIndex++] || { word: '', bold: false };
      ctx.fillStyle = token.bold ? highlightColor : baseColor;
      ctx.fillText(token.word, cursorX, y);
      cursorX += ctx.measureText(`${token.word} `).width;
    }
    y += lineHeight;
  });

  return y;
}

export async function renderPhotoHighlight(canvas, ctx, brand, adData, options, W, H) {
  const padding = s(brand.layout.padding);
  const contentWidth = W - padding * 2;
  const anchorBottom = adData.text_position === 'bottom';

  ctx.fillStyle = '#20201c';
  ctx.fillRect(0, 0, W, H);
  if (options.adImage) {
    drawImageCover(ctx, options.adImage, 0, 0, W, H);
  }

  const gradient = anchorBottom
    ? ctx.createLinearGradient(0, H * 0.4, 0, H)
    : ctx.createLinearGradient(0, 0, 0, H * 0.55);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const headingFont = brand.typography.headingFallback;
  const { tokens, plainText } = parseHighlightedHeadline(adData.headline || '');
  const headingResult = fitText(
    ctx, plainText, contentWidth,
    brand.layout.headingMaxLines, [34, 64],
    headingFont, brand.typography.headingWeight
  );
  ctx.font = `${brand.typography.headingWeight} ${headingResult.fontSize}px ${headingFont}`;
  const lineHeight = headingResult.fontSize * 1.2;
  const blockHeight = lineHeight * headingResult.lines.length;

  const startY = anchorBottom
    ? H - padding - blockHeight - s(70) // leaves room for the wordmark below
    : Math.max(padding, Math.round(H * 0.08));

  const endY = drawHighlightedLines(
    ctx, headingResult.lines, tokens,
    padding, startY, lineHeight, '#FFFFFF', brand.colors.accent1
  );

  let currentY = endY;

  if (adData.subtext) {
    currentY += s(8);
    const subSize = s(24);
    ctx.font = `${brand.typography.bodyWeight} ${subSize}px ${brand.typography.bodyFallback}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const line of wrapText(ctx, adData.subtext, contentWidth)) {
      ctx.fillText(line, padding, currentY);
      currentY += subSize * 1.4;
    }
  }

  // CTA — plain text, no button (brand rule). Drawn in lime so an ad still
  // carries a color accent even when the headline has no **highlight**.
  if (adData.cta_text) {
    currentY += s(16);
    const ctaSize = s(28);
    ctx.font = `${brand.typography.ctaWeight} ${ctaSize}px ${brand.typography.ctaFallback}`;
    ctx.fillStyle = brand.colors.accent1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(adData.cta_text, padding, currentY);
    currentY += ctaSize * 1.3;
  }

  if (adData.url) {
    currentY += s(6);
    const urlSize = s(20);
    ctx.font = `${brand.typography.bodyWeight} ${urlSize}px ${brand.typography.bodyFallback}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(adData.url, padding, currentY);
  }

  drawWordmark(ctx, brand, padding, H - padding, '#FFFFFF', s(28));
}
