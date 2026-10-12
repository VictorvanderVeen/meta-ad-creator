/**
 * Shared rendering constants.
 */

// Canvas renders at 2x the export dimensions for retina-quality output.
export const SCALE = 2;

// Scales a design-space value (defined at 1x) up to the actual canvas resolution.
export function s(val) {
  return val * SCALE;
}
