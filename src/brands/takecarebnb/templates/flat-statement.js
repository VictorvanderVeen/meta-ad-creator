/**
 * Take Care BNB — "Flat Statement" template.
 * Matches the plain lime-background ad ("Benieuwd hoe het werkt?"): full-bleed
 * brand color, sentence-case bold headline top-left, a short regular-weight
 * link line right under it, wordmark bottom-left. No photo, no button.
 */
import { fitText, wrapText } from '../../../lib/textFitter';
import { s } from '../../../lib/constants';
import { drawWordmark } from '../wordmark';

function resolveAccentColor(brand, accentKey) {
  if (!accentKey) return null;
  if (accentKey.startsWith('#')) return accentKey;
  return brand.colors[accentKey] || null;
}

export async function renderFlatStatement(canvas, ctx, brand, adData, options, W, H) {
  const padding = s(brand.layout.padding);
  const contentWidth = W - padding * 2;
  const bgColor = resolveAccentColor(brand, adData.accent_color) || brand.colors.primary;
  const textColor = brand.colors.headingColor;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  const topStart = Math.max(padding, Math.round(H * 0.1));

  const headingFont = brand.typography.headingFallback;
  const headingResult = fitText(
    ctx, adData.headline || '', contentWidth,
    brand.layout.headingMaxLines, [36, 72],
    headingFont, brand.typography.headingWeight
  );
  ctx.font = `${brand.typography.headingWeight} ${headingResult.fontSize}px ${headingFont}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = topStart;
  const lineHeight = headingResult.fontSize * 1.15;
  headingResult.lines.forEach((line) => {
    ctx.fillText(line, padding, y);
    y += lineHeight;
  });

  if (adData.subtext) {
    y += s(10);
    const subSize = s(26);
    ctx.font = `${brand.typography.bodyWeight} ${subSize}px ${brand.typography.bodyFallback}`;
    ctx.fillStyle = textColor;
    for (const line of wrapText(ctx, adData.subtext, contentWidth)) {
      ctx.fillText(line, padding, y);
      y += subSize * 1.4;
    }
  }

  // CTA/link — plain text, no button (brand rule). E.g. "Ga naar takecarebnb.org".
  if (adData.cta_text) {
    y += s(14);
    const ctaSize = s(28);
    ctx.font = `${brand.typography.ctaWeight} ${ctaSize}px ${brand.typography.ctaFallback}`;
    ctx.fillStyle = textColor;
    ctx.fillText(adData.cta_text, padding, y);
    y += ctaSize * 1.3;
  }

  if (adData.url) {
    y += s(6);
    const urlSize = s(22);
    ctx.font = `${brand.typography.bodyWeight} ${urlSize}px ${brand.typography.bodyFallback}`;
    ctx.fillStyle = textColor;
    ctx.fillText(adData.url, padding, y);
  }

  drawWordmark(ctx, brand, padding, H - padding, textColor, s(30));
}
