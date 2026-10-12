/**
 * Text fitting utilities for Canvas rendering.
 * Handles word-wrap and auto-sizing since Canvas has no native text wrapping.
 */

import { SCALE } from './constants';

/**
 * Wraps text into lines that fit within maxWidth.
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let currentLine = '';

  const addWord = (word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !currentLine) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  };

  for (const word of text.split(' ')) {
    // A single word wider than maxWidth (e.g. a long URL) would overflow the
    // canvas — hard-break it character by character instead.
    if (ctx.measureText(word).width > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      let chunk = '';
      for (const char of word) {
        if (ctx.measureText(chunk + char).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      currentLine = chunk;
    } else {
      addWord(word);
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Finds the optimal font size that fits text within given constraints.
 * Returns { fontSize, lines }.
 */
export function fitText(ctx, text, maxWidth, maxLines, fontSizeRange, fontFamily, fontWeight = 'bold') {
  const [minSize, maxSize] = fontSizeRange;

  for (let size = maxSize * SCALE; size >= minSize * SCALE; size -= 2) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);

    if (lines.length <= maxLines) {
      return { fontSize: size, lines };
    }
  }

  ctx.font = `${fontWeight} ${minSize * SCALE}px ${fontFamily}`;
  const lines = wrapText(ctx, text, maxWidth);
  return { fontSize: minSize * SCALE, lines };
}

/**
 * Measures the total height of wrapped text lines.
 */
export function measureTextHeight(fontSize, lineCount, lineHeight = 1.2) {
  return fontSize * lineHeight * lineCount;
}
