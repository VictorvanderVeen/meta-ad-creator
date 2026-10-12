import { useState } from 'react';
import BrandSelector from './components/BrandSelector';
import AdEditor from './components/AdEditor';
import BatchUploader from './components/BatchUploader';
import './App.css';

export default function App() {
  const [brand, setBrand] = useState(null);
  const [mode, setMode] = useState('single');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meta Ad Creator</h1>
        <BrandSelector selectedBrand={brand} onSelect={setBrand} />
      </header>

      {brand && (
        <>
          <nav className="mode-tabs">
            <button
              className={mode === 'single' ? 'active' : ''}
              onClick={() => setMode('single')}
            >
              Single
            </button>
            <button
              className={mode === 'batch' ? 'active' : ''}
              onClick={() => setMode('batch')}
            >
              Batch
            </button>
          </nav>

          <main className="app-main">
            {mode === 'single' ? (
              <AdEditor brand={brand} />
            ) : (
              <BatchUploader brand={brand} />
            )}
          </main>

          <aside className="brand-rules">
            <h4>Brand regels — {brand.name}</h4>
            <ul>
              {brand.rules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </aside>
        </>
      )}

      {!brand && (
        <div className="empty-state">
          <p>Selecteer een klant om te beginnen.</p>
        </div>
      )}
    </div>
  );
}
