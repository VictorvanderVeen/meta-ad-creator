import { useState } from 'react';

function Avatar({ brand }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = brand?.logo?.url;

  if (logoUrl && !failed) {
    return (
      <img
        className="feed-avatar"
        src={logoUrl}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="feed-avatar feed-avatar-fallback"
      style={{ background: brand?.colors?.primary || '#666' }}
    >
      {(brand?.name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

function getDomain(url) {
  if (!url) return '';
  const stripped = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return stripped.split('/')[0].toUpperCase();
}

export default function FeedPreview({ brand, adData, canvas }) {
  const imageSrc = canvas ? canvas.toDataURL('image/png') : null;
  const domain = getDomain(adData.url);

  return (
    <div className="feed-preview">
      <div className="feed-header">
        <Avatar brand={brand} />
        <div className="feed-header-text">
          <span className="feed-page-name">{brand?.name || 'Paginanaam'}</span>
          <span className="feed-sponsored">
            Sponsored
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM2.5 8a5.5 5.5 0 019.6-3.65c-.7.1-1.5.5-2.2 1.15-.5-.35-1.15-.6-1.9-.6-1.9 0-3.2 1.4-3.2 3.1 0 1.75 1.3 3.1 3.2 3.1.9 0 1.65-.3 2.2-.75.6.6 1.35.95 2.05 1.05A5.5 5.5 0 012.5 8z" />
            </svg>
          </span>
        </div>
        <div className="feed-header-icons">
          <span className="feed-icon-dots">•••</span>
          <span className="feed-icon-close">✕</span>
        </div>
      </div>

      {adData.primary_text && (
        <p className="feed-primary-text">{adData.primary_text}</p>
      )}

      <div className="feed-image-wrap">
        {imageSrc ? (
          <img className="feed-image" src={imageSrc} alt="" />
        ) : (
          <div className="feed-image-empty">Vul headline + foto in voor een preview</div>
        )}
      </div>

      <div className="feed-link-row">
        <div className="feed-link-text">
          {domain && <span className="feed-link-domain">{domain}</span>}
          <span className="feed-link-headline">
            {adData.meta_headline || adData.headline || 'Headline'}
          </span>
        </div>
        <button className="feed-cta-btn" type="button" tabIndex={-1}>
          {adData.cta_text || 'Learn more'}
        </button>
      </div>

      <div className="feed-actions">
        <span className="feed-action">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 22V11M2 13v7a2 2 0 002 2h13.4a2 2 0 002-1.7l1.4-8A2 2 0 0018.8 10H14V5a2 2 0 00-2-2h-1l-4 8v9" />
          </svg>
          Like
        </span>
        <span className="feed-action">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          Comment
        </span>
        <span className="feed-action">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          Share
        </span>
      </div>
    </div>
  );
}
