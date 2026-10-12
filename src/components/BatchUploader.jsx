import { useState, useRef, useCallback } from 'react';
import { parseCSV, parseCSVFile, parseMetaCopy } from '../lib/csvParser';
import { exportAsZip } from '../lib/zipExport';
import { publishToShowcase, publishLive, showcaseSlug } from '../lib/showcaseExport';
import { getTemplateList, TEMPLATE_LABELS } from '../lib/canvasRenderer';
import { getAllFormats, getFormat } from '../lib/formats';
import { HAMLIN_TEMPLATES, getDefaultLabelPosition } from '../brands/hamlin/shared';
import AdCanvas from './AdCanvas';

// Button labels Meta offers, as shown on the Dutch Facebook feed.
const META_CTAS = ['Nu doneren', 'Meer informatie', 'Registreren', 'Aanmelden', 'Downloaden'];

function getDomain(url) {
  if (!/\./.test(url || '')) return '';
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
}

export default function BatchUploader({ brand }) {
  const [rows, setRows] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [batchTemplate, setBatchTemplate] = useState('bold-text');
  const [batchFormat, setBatchFormat] = useState('feed-square');
  const [batchAccentColor, setBatchAccentColor] = useState('');
  const [batchImageUrl, setBatchImageUrl] = useState('');
  const [batchImageScale, setBatchImageScale] = useState(0.48);
  const [batchImagePositionX, setBatchImagePositionX] = useState(0.5);
  const [batchImagePositionY, setBatchImagePositionY] = useState(0.5);
  // null = untouched, the template then uses its own default position.
  const [batchLabelPositionX, setBatchLabelPositionX] = useState(null);
  const [batchLabelPositionY, setBatchLabelPositionY] = useState(null);
  const [batchFilename, setBatchFilename] = useState('');
  const [notice, setNotice] = useState('');
  const [showcaseNotice, setShowcaseNotice] = useState(null); // { text, ok }
  const [publishNotice, setPublishNotice] = useState(null); // { text, ok }
  const [publishing, setPublishing] = useState(false);
  const [showcaseCampaign, setShowcaseCampaign] = useState('');
  const [metaCopyText, setMetaCopyText] = useState('');
  const [metaCta, setMetaCta] = useState(META_CTAS[0]);
  const canvasRefs = useRef({});

  const NO_ROWS_MSG = 'Geen geldige rijen gevonden — zorg dat er een "headline" kolom is.';

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseCSVFile(file);
      setRows(parsed);
      setNotice(parsed.length === 0 ? NO_ROWS_MSG : '');
    } catch {
      setRows([]);
      setNotice('Kon het bestand niet lezen.');
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const parsed = parseCSV(pasteText);
    setRows(parsed);
    setNotice(parsed.length === 0 ? NO_ROWS_MSG : '');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchImageUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleCanvasReady = useCallback((index, canvas) => {
    canvasRefs.current[index] = canvas;
  }, []);

  // One { canvas, filename, name } per rendered row, shared by the ZIP export
  // and the showcase publish so both use the same file names.
  const buildExportItems = () => {
    const baseName = batchFilename.trim() || `${brand.id}-meta-ads`;
    const usedNames = new Set();
    return rows
      .map((row, i) => {
        const canvas = canvasRefs.current[i];
        if (!canvas) return null;
        let name;
        if (row.ad_name) {
          name = row.ad_name.replace(/[^a-zA-Z0-9._-]/g, '-');
        } else {
          const slug = (row.headline || 'ad')
            .substring(0, 30)
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase();
          name = `${baseName}-${i + 1}-${slug}`;
        }
        // Guard against duplicate filenames silently overwriting each other in the ZIP.
        let filename = `${name}.png`;
        let suffix = 2;
        while (usedNames.has(filename)) {
          filename = `${name}-${suffix}.png`;
          suffix += 1;
        }
        usedNames.add(filename);
        return { canvas, filename, name: row.headline };
      })
      .filter(Boolean);
  };

  const handleExportAll = async () => {
    const baseName = batchFilename.trim() || `${brand.id}-meta-ads`;
    const items = buildExportItems();
    if (items.length > 0) {
      await exportAsZip(items, `${baseName}-${batchFormat}.zip`);
    }
  };

  const handlePublishToShowcase = async () => {
    const items = buildExportItems();
    if (items.length === 0) return;
    setShowcaseNotice({ text: 'Bezig met wegschrijven naar de showcase…', ok: true });
    try {
      const result = await publishToShowcase(brand, items, getFormat(batchFormat), {
        campaign: showcaseCampaign,
        copy: metaCopy,
      });
      setShowcaseNotice({
        ok: true,
        text: `${result.added} advertentie${result.added !== 1 ? 's' : ''} in de showcase gezet${metaCopy ? ' met de Meta-teksten' : ''} (map ${result.slug}, nu ${result.total} in totaal). Nog niet live: dat gebeurt pas na een push van meta-ad-showcase.`,
      });
    } catch (err) {
      setShowcaseNotice({ text: `Niet gelukt: ${err.message}`, ok: false });
    }
  };

  const handlePublishLive = async () => {
    setPublishing(true);
    setPublishNotice({ text: 'Bezig met committen en pushen…', ok: true });
    try {
      const result = await publishLive();
      setPublishNotice(
        result.pushed
          ? { ok: true, text: `Live gezet (${result.commit}): ${result.scopes.join(', ')}. De showcase bouwt en deployt nu automatisch, dat duurt nog ~1-2 minuten.` }
          : { ok: true, text: 'Niets te pushen, alles staat al live.' }
      );
    } catch (err) {
      setPublishNotice({ text: `Niet gelukt: ${err.message}`, ok: false });
    } finally {
      setPublishing(false);
    }
  };

  // The Meta copy that goes to the showcase with the ads; null when nothing is pasted.
  const parsedCopy = parseMetaCopy(metaCopyText);
  const metaCopy =
    parsedCopy.primaryTexts.length + parsedCopy.headlines.length > 0
      ? {
          pageName: brand.name,
          color: brand.colors?.primary,
          domain: getDomain(rows[0]?.url),
          cta: metaCta,
          ...parsedCopy,
        }
      : null;

  const rowsWithSettings = rows.map((row) => ({
    ...row,
    template: batchTemplate,
    format: batchFormat,
    accent_color: batchAccentColor,
    image_url: batchImageUrl,
    image_scale: batchImageScale,
    image_position_x: batchImagePositionX,
    image_position_y: batchImagePositionY,
    label_position_x: batchLabelPositionX ?? undefined,
    label_position_y: batchLabelPositionY ?? undefined,
  }));

  const defaultLabelPosition = getDefaultLabelPosition(batchTemplate, batchFormat);
  const formats = getAllFormats();
  const accentOptions = brand
    ? Object.keys(brand.colors).filter((k) => k.startsWith('accent'))
    : [];

  return (
    <div className="batch-uploader">
      <div className="batch-input">
        <div className="form-row">
          <div className="form-group">
            <label>Template</label>
            <div className="template-selector-inline">
              {getTemplateList(brand).map((t) => (
                <button
                  key={t}
                  className={`template-btn-sm ${batchTemplate === t ? 'active' : ''}`}
                  onClick={() => setBatchTemplate(t)}
                >
                  {TEMPLATE_LABELS[t]?.name || t}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Formaat</label>
            <div className="template-selector-inline">
              {formats.map((f) => (
                <button
                  key={f.id}
                  className={`template-btn-sm ${batchFormat === f.id ? 'active' : ''}`}
                  onClick={() => setBatchFormat(f.id)}
                >
                  {f.ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label htmlFor="batch-accent">Accent kleur</label>
            <select
              id="batch-accent"
              value={batchAccentColor}
              onChange={(e) => setBatchAccentColor(e.target.value)}
            >
              <option value="">Geen (primary)</option>
              {accentOptions.map((key) => (
                <option key={key} value={key}>
                  {key} ({brand.colors[key]})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="batch-image">Afbeelding</label>
            <input
              id="batch-image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
            />
            {batchImageUrl && (
              <button
                className="btn-secondary"
                onClick={() => setBatchImageUrl('')}
                style={{ alignSelf: 'flex-start' }}
              >
                Verwijder foto
              </button>
            )}
          </div>

          {batchTemplate === 'statement' && (
            <div className="form-group">
              <label htmlFor="batch-image-scale">
                Foto grootte ({Math.round(batchImageScale * 100)}%)
              </label>
              <input
                id="batch-image-scale"
                type="range"
                min="0.25"
                max="0.85"
                step="0.01"
                value={batchImageScale}
                onChange={(e) => setBatchImageScale(parseFloat(e.target.value))}
              />
            </div>
          )}

          {HAMLIN_TEMPLATES.includes(batchTemplate) && (
            <div className="form-group">
              <label htmlFor="batch-label-position-x">Label positie horizontaal</label>
              <input
                id="batch-label-position-x"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={batchLabelPositionX ?? defaultLabelPosition.x}
                onChange={(e) => setBatchLabelPositionX(parseFloat(e.target.value))}
              />
              <label htmlFor="batch-label-position-y">Label positie verticaal</label>
              <input
                id="batch-label-position-y"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={batchLabelPositionY ?? defaultLabelPosition.y}
                onChange={(e) => setBatchLabelPositionY(parseFloat(e.target.value))}
              />
            </div>
          )}

          {['foto-overlay', 'foto-split', ...HAMLIN_TEMPLATES].includes(batchTemplate) && batchImageUrl && (
            <div className="form-group">
              <label htmlFor="batch-image-position-x">Foto positie horizontaal</label>
              <input
                id="batch-image-position-x"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={batchImagePositionX}
                onChange={(e) => setBatchImagePositionX(parseFloat(e.target.value))}
              />
              <label htmlFor="batch-image-position-y">Foto positie verticaal</label>
              <input
                id="batch-image-position-y"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={batchImagePositionY}
                onChange={(e) => setBatchImagePositionY(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label htmlFor="batch-filename">Bestandsnaam</label>
            <input
              id="batch-filename"
              type="text"
              value={batchFilename}
              onChange={(e) => setBatchFilename(e.target.value)}
              placeholder={`${brand.id}-meta-ads`}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label htmlFor="csv-upload">Upload CSV</label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileUpload}
          />
        </div>

        <div className="divider">of</div>

        <div className="form-group">
          <label htmlFor="paste-area">Plak vanuit Google Sheets (TSV)</label>
          <textarea
            id="paste-area"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"ad_name\theadline\tsubtext\tcta_text\turl\nLS_meta_01_statistiek\tJe headline hier\tOptionele subtekst\tDoneer nu\texample.nl/doneer"}
            rows={6}
          />
          <button className="btn-secondary" onClick={handlePaste}>
            Verwerk plakdata
          </button>
        </div>

        {notice && <p className="batch-notice" role="alert">{notice}</p>}

        {import.meta.env.DEV && (
          <>
            <div className="divider">voor de showcase</div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="showcase-campaign">Campagne</label>
                <input
                  id="showcase-campaign"
                  type="text"
                  value={showcaseCampaign}
                  onChange={(e) => setShowcaseCampaign(e.target.value)}
                  placeholder="bijv. P2601CHFN"
                />
                <small>Link: …/meta-ad-showcase/{showcaseSlug(brand, showcaseCampaign)}/</small>
              </div>

              <div className="form-group">
                <label htmlFor="meta-cta">Knop in de advertentie</label>
                <select id="meta-cta" value={metaCta} onChange={(e) => setMetaCta(e.target.value)}>
                  {META_CTAS.map((cta) => (
                    <option key={cta} value={cta}>
                      {cta}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label htmlFor="meta-copy">Plak het tabblad &quot;Ad tekstvelden&quot;</label>
              <textarea
                id="meta-copy"
                value={metaCopyText}
                onChange={(e) => setMetaCopyText(e.target.value)}
                placeholder={"PRIMARY TEXT (max 125 tekens)\n#\tTekst\tTekens\n1\tJe primaire tekst hier\t23\nHEADLINES (max 40 tekens)\n1\tJe kop hier\t11"}
                rows={5}
              />
              {metaCopyText.trim() && (
                <small>
                  {parsedCopy.primaryTexts.length} primaire teksten, {parsedCopy.headlines.length} koppen,{' '}
                  {parsedCopy.descriptions.length} beschrijvingen herkend.
                </small>
              )}
            </div>
          </>
        )}
      </div>

      {rowsWithSettings.length > 0 && (
        <>
          <div className="batch-header">
            <h3>{rowsWithSettings.length} advertentie{rowsWithSettings.length !== 1 ? 's' : ''}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {import.meta.env.DEV && (
                <button className="btn-secondary" style={{ marginTop: 0 }} onClick={handlePublishToShowcase}>
                  Zet in showcase
                </button>
              )}
              {import.meta.env.DEV && (
                <button
                  className="btn-secondary"
                  style={{ marginTop: 0 }}
                  onClick={handlePublishLive}
                  disabled={publishing}
                  title="Commit + push alles wat in de showcase staat — ook batches van eerder"
                >
                  {publishing ? 'Bezig…' : 'Live zetten'}
                </button>
              )}
              <button className="export-btn" onClick={handleExportAll}>
                Download alles als ZIP
              </button>
            </div>
          </div>
          {showcaseNotice && (
            <p
              className="batch-notice"
              role="status"
              style={showcaseNotice.ok ? { background: '#eaf6ec', borderColor: '#b7dfbd', color: '#1e6b2c' } : undefined}
            >
              {showcaseNotice.text}
            </p>
          )}
          {publishNotice && (
            <p
              className="batch-notice"
              role="status"
              style={publishNotice.ok ? { background: '#eaf6ec', borderColor: '#b7dfbd', color: '#1e6b2c' } : undefined}
            >
              {publishNotice.text}
            </p>
          )}

          <div className="batch-grid">
            {rowsWithSettings.map((row, i) => (
              <div key={`${i}-${batchTemplate}-${batchFormat}-${batchAccentColor}-${batchImageUrl}-${batchImageScale}-${batchImagePositionX}-${batchImagePositionY}`} className="batch-item">
                <AdCanvas
                  brand={brand}
                  adData={row}
                  maxWidth={320}
                  onCanvasReady={(canvas) => handleCanvasReady(i, canvas)}
                />
                {row.ad_name && (
                  <p className="batch-item-filename">{row.ad_name}.png</p>
                )}
                <p className="batch-item-label">
                  {row.headline.substring(0, 50)}
                  {row.headline.length > 50 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
