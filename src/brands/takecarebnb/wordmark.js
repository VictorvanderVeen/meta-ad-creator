/**
 * Take Care BNB has no separate logo asset yet (see brand rules) — every
 * reference ad just shows the brand name set in lowercase bold. Draw that
 * directly instead of loading an image, so ads work before a real logo file
 * exists.
 */
export function drawWordmark(ctx, brand, x, bottomY, color, fontSize) {
  const label = brand.logo?.text || brand.name;
  ctx.font = `700 ${fontSize}px ${brand.typography.headingFallback}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label.toLowerCase(), x, bottomY);
}
