import Papa from 'papaparse';

/**
 * Parses CSV text or TSV (pasted from Google Sheets) into ad data rows.
 * Returns an array of { ad_name, headline, subtext, cta_text, url }.
 */
export function parseCSV(text) {
  const result = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  return result.data
    .filter((row) => row.headline && row.headline.trim())
    .map((row) => ({
      ad_name: (row.ad_name || '').trim(),
      headline: (row.headline || '').trim(),
      subtext: (row.subtext || '').trim(),
      cta_text: (row.cta_text || '').trim(),
      url: (row.url || '').trim(),
    }));
}

const META_COPY_SECTIONS = [
  { field: 'primaryTexts', start: 'primary' },
  { field: 'headlines', start: 'headline' },
  { field: 'descriptions', start: 'description' },
];

/**
 * Parses the pasted "Ad tekstvelden" tab (the Meta platform fields) into
 * { primaryTexts, headlines, descriptions }. The tab is a list of sections:
 * a title row ("PRIMARY TEXT (max 125 tekens)"), then numbered rows with the
 * text in the second column.
 */
export function parseMetaCopy(text) {
  const copy = { primaryTexts: [], headlines: [], descriptions: [] };
  const { data } = Papa.parse(text.trim(), { delimiter: '\t', skipEmptyLines: true });

  let field = null;
  for (const row of data) {
    const first = (row[0] || '').trim();
    const section = META_COPY_SECTIONS.find((s) => first.toLowerCase().startsWith(s.start));
    if (section) field = section.field;
    else if (field && /^\d+$/.test(first) && (row[1] || '').trim()) copy[field].push(row[1].trim());
  }
  return copy;
}

/**
 * Reads a File as text, decoding as UTF-8 when the bytes are valid UTF-8 and
 * falling back to Mac OS Roman otherwise — Excel/Numbers on macOS can export
 * CSVs in that legacy single-byte encoding instead of UTF-8, where
 * accented/currency bytes like ü, €, – are invalid UTF-8 sequences. Decoding
 * those as UTF-8 silently turns them into the U+FFFD replacement glyph (in
 * every font); decoding as the wrong single-byte fallback (e.g. Windows-1252)
 * turns them into different, still-wrong letters (confirmed against a real
 * file: byte 0x9F for ü disappears, 0xDB for € becomes "Û", 0xD0 for – becomes
 * "Ð" under Windows-1252/Latin-1 — all three decode correctly as Mac Roman).
 */
async function readFileAsText(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('macintosh').decode(buffer);
  }
}

/**
 * Parses a File object (CSV upload).
 */
export async function parseCSVFile(file) {
  const text = await readFileAsText(file);
  return parseCSV(text);
}
