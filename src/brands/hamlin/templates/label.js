/**
 * Hamlin Fistula — "Label" template.
 * Matches the "1 levensveranderend verzorgingspakket: €40" reference ad:
 * full-bleed photo (no dark overlay), woven colour band on top, and one
 * orange rounded label with centred white text.
 *
 * Field mapping inside the label:
 *  - headline  → the bold line(s) at the top
 *  - cta_text  → the big line (the amount in the reference, e.g. "€40")
 * Subtext is deliberately not drawn: with it the label grows too tall and
 * covers the photo. No logo and no URL on the image either (brand rule).
 */
import { fitText } from '../../../lib/textFitter';
import {
  makeUnit, resolveAccentColor, loadFonts, drawPhoto, drawBand, getPlacementArea, placeBox,
} from '../shared';

export async function renderHamlinLabel(canvas, ctx, brand, adData, options, W, H) {
  const { typography } = brand;
  await loadFonts([
    `${typography.headingWeight} 40px "${typography.headingFont}"`,
    `${typography.ctaWeight} 40px "${typography.ctaFont}"`,
  ]);

  const u = makeUnit(W, H);
  drawPhoto(ctx, brand, options.adImage, W, H, adData.image_position_x ?? 0.5, adData.image_position_y ?? 0.5);
  const bandH = drawBand(ctx, brand, W, u);
  const area = getPlacementArea(adData, W, H, bandH, u);

  const padX = u(30);
  const padY = u(26);
  const maxTextW = Math.min(area.right - area.left - padX * 2, u(360));

  // ── Measure the two blocks ──
  const blocks = [];

  const headline = fitText(
    ctx, adData.headline || '', maxTextW, 3, [26 * u.k, 34 * u.k],
    typography.headingFallback, typography.headingWeight
  );
  blocks.push({
    lines: headline.lines, size: headline.fontSize, lineHeight: 1.22, gapBefore: 0,
    font: `${typography.headingWeight} ${headline.fontSize}px ${typography.headingFallback}`,
  });

  if (adData.cta_text) {
    const big = fitText(
      ctx, adData.cta_text, maxTextW, 1, [44 * u.k, 96 * u.k],
      typography.ctaFallback, typography.ctaWeight
    );
    blocks.push({
      lines: big.lines, size: big.fontSize, lineHeight: 1.08, gapBefore: u(8),
      font: `${typography.ctaWeight} ${big.fontSize}px ${typography.ctaFallback}`,
    });
  }

  let textW = 0;
  let textH = 0;
  for (const block of blocks) {
    ctx.font = block.font;
    for (const line of block.lines) textW = Math.max(textW, ctx.measureText(line).width);
    textH += block.gapBefore + block.lines.length * block.size * block.lineHeight;
  }

  // ── Label box ──
  const boxW = textW + padX * 2;
  const boxH = textH + padY * 2;
  const { x: boxX, y: boxY } = placeBox(adData, 'hamlin-label', area, boxW, boxH);

  ctx.fillStyle = resolveAccentColor(brand, adData.accent_color) || brand.colors.cta;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, u(22));
  ctx.fill();

  // ── Text, centred in the box ──
  ctx.fillStyle = brand.colors.textLight;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const centerX = boxX + boxW / 2;
  let y = boxY + padY;
  for (const block of blocks) {
    y += block.gapBefore;
    ctx.font = block.font;
    const lineH = block.size * block.lineHeight;
    for (const line of block.lines) {
      ctx.fillText(line, centerX, y + lineH / 2);
      y += lineH;
    }
  }
  ctx.textAlign = 'left';
}
