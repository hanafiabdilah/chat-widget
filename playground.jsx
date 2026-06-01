import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './src/index.jsx';

// Standalone playground — `npm run dev` serves this on :5174.
//
// The widget is fully API-driven and the API base URL is baked into the
// bundle (see `src/core/config.js`). To point it at a different backend
// during dev, set `VITE_WIDGET_BASE_URL` in `.env.local`.
//
// Required:
//   .env.local:
//     VITE_WIDGET_APP_ID=<uuid>

const APP_ID = import.meta.env.VITE_WIDGET_APP_ID || '';

const Missing = () => (
  <div style={{ maxWidth: 520, background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: 14, padding: 28, color: '#fee2e2' }}>
    <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>App ID missing</h1>
    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>
      Set <code>VITE_WIDGET_APP_ID</code> in <code>.env.local</code>:
    </p>
    <pre style={{ background: '#1f2937', padding: 12, borderRadius: 8, fontSize: 12, margin: 0, color: '#e5e7eb' }}>
{`VITE_WIDGET_APP_ID=<your-app-id>
# optional override; defaults to baked-in URL
VITE_WIDGET_BASE_URL=https://back-chat.adslogin.com.br`}
    </pre>
  </div>
);

const Playground = () => {
  const [isOpen, setIsOpen] = useState(false);

  if (!APP_ID) return <Missing />;

  return (
    <div style={{ maxWidth: 520, background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 28 }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 600 }}>Chat Widget · Dev Playground</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: '#9ca3af' }}>
        Template &amp; brand resolved from <code>/widget-api/config/{APP_ID.slice(0, 8)}…</code>
      </p>
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{ background: '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
      >
        Toggle panel
      </button>

      <ChatWidget
        appId={APP_ID}
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        user={{ name: 'Anderson', email: 'anderson@example.com' }}
        initialChatOptions={[
          { id: 'pricing', label: '💰 Tanya harga', color: '#22c55e' },
          { id: 'support', label: '⚠️ Bantuan teknis', color: '#f59e0b' },
          { id: 'demo', label: '🎥 Minta demo', color: '#06b6d4', message: 'Halo, saya ingin minta demo produk.' },
          { id: 'human', label: '🎧 Bicara dengan agent', color: '#a855f7' },
        ]}
        debug
      />
    </div>
  );
};

createRoot(document.getElementById('root')).render(<Playground />);
