import { useState, useCallback } from 'react';
import AdCanvas from './AdCanvas';
import FeedPreview from './FeedPreview';
import ExportButton from './ExportButton';
import { getTemplateList, TEMPLATE_LABELS } from '../lib/canvasRenderer';
import { getAllFormats } from '../lib/formats';
import { HAMLIN_TEMPLATES, getDefaultLabelPosition } from '../brands/hamlin/shared';

export default function AdEditor({ brand }) {
  const [adData, setAdData] = useState({
    headline: '',
    subtext: '',
    cta_text: '',
    url: '',
    image_url: '',
    image_scale: 0.48,
    image_position_x: 0.5,
    image_position_y: 0.5,
    accent_color: '',
    template: 'bold-text',
    format: 'feed-square',
    primary_text: '',
    meta_headline: '',
  });
  const [canvas, setCanvas] = useState(null);
  const [customFilename, setCustomFilename] = useState('');
  const [previewMode, setPreviewMode] = useState('canvas');

  const handleChange = (field) => (e) => {
    setAdData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setAdData((prev) => {
      if (prev.image_url?.startsWith('blob:')) URL.revokeObjectURL(prev.image_url);
      return { ...prev, image_url: objectUrl };
    });
  };

  const handleCanvasReady = useCallback((c) => {
    setCanvas(c);
  }, []);

  const accentOptions = brand
    ? Object.keys(brand.colors).filter((k) => k.startsWith('accent'))
    : [];

  const templates = getTemplateList(brand);
  const formats = getAllFormats();
  const defaultLabelPosition = getDefaultLabelPosition(adData.template, adData.format);

  return (
    <div className="ad-editor">
      <div className="editor-form">
        <div className="form-group">
          <label>Template</label>
          <div className="template-selector">
            {templates.map((t) => (
              <button
                key={t}
                className={`template-btn ${adData.template === t ? 'active' : ''}`}
                onClick={() => setAdData((prev) => ({ ...prev, template: t }))}
              >
                <span className="template-name">{TEMPLATE_LABELS[t]?.name || t}</span>
                <span className="template-desc">{TEMPLATE_LABELS[t]?.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Formaat</label>
          <div className="format-selector">
            {formats.map((f) => (
              <button
                key={f.id}
                className={`format-btn ${adData.format === f.id ? 'active' : ''}`}
                onClick={() => setAdData((prev) => ({ ...prev, format: f.id }))}
              >
                <span className="format-ratio">{f.ratio}</span>
                <span className="format-name">{f.name}</span>
                <span className="format-desc">{f.width}×{f.height}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="headline">Headline *</label>
          <textarea
            id="headline"
            value={adData.headline}
            onChange={handleChange('headline')}
            placeholder="De hoofdtekst van je advertentie"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="subtext">Subtekst</label>
          <input
            id="subtext"
            type="text"
            value={adData.subtext}
            onChange={handleChange('subtext')}
            placeholder="Optionele subtekst"
          />
        </div>

        <div className="form-group">
          <label htmlFor="cta_text">CTA tekst *</label>
          <input
            id="cta_text"
            type="text"
            value={adData.cta_text}
            onChange={handleChange('cta_text')}
            placeholder="bv. Teken de petitie"
          />
        </div>

        <div className="form-group">
          <label htmlFor="url">URL</label>
          <input
            id="url"
            type="text"
            value={adData.url}
            onChange={handleChange('url')}
            placeholder="bv. steun.uaf.nl/roozeeta"
          />
        </div>

        <div className="form-group">
          <label htmlFor="image_upload">Afbeelding</label>
          <input
            id="image_upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />
          {adData.image_url && (
            <button
              className="btn-secondary"
              onClick={() =>
                setAdData((prev) => {
                  if (prev.image_url?.startsWith('blob:')) URL.revokeObjectURL(prev.image_url);
                  return { ...prev, image_url: '' };
                })
              }
              style={{ alignSelf: 'flex-start' }}
            >
              Verwijder foto
            </button>
          )}
        </div>

        {['foto-overlay', 'foto-split', ...HAMLIN_TEMPLATES].includes(adData.template) && adData.image_url && (
          <div className="form-group">
            <label htmlFor="image_position_x">Foto positie horizontaal</label>
            <input
              id="image_position_x"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={adData.image_position_x}
              onChange={(e) =>
                setAdData((prev) => ({ ...prev, image_position_x: parseFloat(e.target.value) }))
              }
            />
            <label htmlFor="image_position_y">Foto positie verticaal</label>
            <input
              id="image_position_y"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={adData.image_position_y}
              onChange={(e) =>
                setAdData((prev) => ({ ...prev, image_position_y: parseFloat(e.target.value) }))
              }
            />
          </div>
        )}

        {HAMLIN_TEMPLATES.includes(adData.template) && (
          <div className="form-group">
            <label htmlFor="label_position_x">Label positie horizontaal</label>
            <input
              id="label_position_x"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={adData.label_position_x ?? defaultLabelPosition.x}
              onChange={(e) =>
                setAdData((prev) => ({ ...prev, label_position_x: parseFloat(e.target.value) }))
              }
            />
            <label htmlFor="label_position_y">Label positie verticaal</label>
            <input
              id="label_position_y"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={adData.label_position_y ?? defaultLabelPosition.y}
              onChange={(e) =>
                setAdData((prev) => ({ ...prev, label_position_y: parseFloat(e.target.value) }))
              }
            />
          </div>
        )}

        {adData.template === 'statement' && (
          <div className="form-group">
            <label htmlFor="image_scale">
              Foto grootte ({Math.round(adData.image_scale * 100)}%)
            </label>
            <input
              id="image_scale"
              type="range"
              min="0.25"
              max="0.85"
              step="0.01"
              value={adData.image_scale}
              onChange={(e) =>
                setAdData((prev) => ({ ...prev, image_scale: parseFloat(e.target.value) }))
              }
            />
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="accent_color">Accent kleur</label>
            <select
              id="accent_color"
              value={adData.accent_color}
              onChange={handleChange('accent_color')}
            >
              <option value="">Geen (primary)</option>
              {accentOptions.map((key) => (
                <option key={key} value={key}>
                  {key} ({brand.colors[key]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="primary_text">Primary text (nep-post, boven de foto)</label>
          <textarea
            id="primary_text"
            value={adData.primary_text}
            onChange={handleChange('primary_text')}
            placeholder="De tekst die boven de advertentie in de feed staat"
            rows={2}
          />
        </div>

        <div className="form-group">
          <label htmlFor="meta_headline">Headline (nep-post, onder de foto)</label>
          <input
            id="meta_headline"
            type="text"
            value={adData.meta_headline}
            onChange={handleChange('meta_headline')}
            placeholder="Bold tekst in de link-balk, bv. de Meta headline"
          />
        </div>

        <div className="form-group">
          <label htmlFor="filename">Bestandsnaam</label>
          <input
            id="filename"
            type="text"
            value={customFilename}
            onChange={(e) => setCustomFilename(e.target.value)}
            placeholder={`meta-ad-${adData.format}`}
          />
        </div>

        <ExportButton
          canvas={canvas}
          filename={`${customFilename.trim() || `meta-ad-${adData.format}`}.png`}
        />
      </div>

      <div className="editor-preview">
        <div className="preview-tabs">
          <button
            className={previewMode === 'canvas' ? 'active' : ''}
            onClick={() => setPreviewMode('canvas')}
          >
            Creative
          </button>
          <button
            className={previewMode === 'feed' ? 'active' : ''}
            onClick={() => setPreviewMode('feed')}
          >
            Nep Facebook-post
          </button>
        </div>

        <div style={{ display: previewMode === 'canvas' ? 'block' : 'none' }}>
          <AdCanvas
            brand={brand}
            adData={adData}
            onCanvasReady={handleCanvasReady}
          />
        </div>

        {previewMode === 'feed' && (
          <FeedPreview brand={brand} adData={adData} canvas={canvas} />
        )}
      </div>
    </div>
  );
}
