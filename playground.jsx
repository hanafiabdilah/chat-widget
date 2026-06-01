import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './src/index.jsx';

// Standalone playground — exercises both templates without needing the
// host (Proxybr) app to be running. `npm run dev` serves this on :5174.
//
// Two modes:
//   - Mock     → in-memory adapter, no network calls. Default.
//   - Live API → real Nuvemchat widget API. Set VITE_WIDGET_APP_ID and
//                VITE_WIDGET_BASE_URL in .env.local (or hardcode below).

const demoTheme = {
  bg: '#09090b',
  surface: '#18181b',
  surfaceAlt: '#1f1f23',
  border: '#27272a',
  borderSubtle: '#1f1f23',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
  accent: '#c5f825',
  accentText: '#0a0a0a',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const ENV_APP_ID = import.meta.env.VITE_WIDGET_APP_ID || '';
const ENV_BASE_URL = import.meta.env.VITE_WIDGET_BASE_URL || '';

const Playground = () => {
  const [template, setTemplate] = useState('proxybr');
  const [isOpen, setIsOpen] = useState(false);
  const [useLiveApi, setUseLiveApi] = useState(false);

  const liveAvailable = ENV_APP_ID && ENV_BASE_URL;
  const liveProps = useLiveApi && liveAvailable
    ? { appId: ENV_APP_ID, baseUrl: ENV_BASE_URL, debug: true }
    : {};

  return (
    <div style={{ maxWidth: 520, background: '#111827', border: '1px solid #1f2937', borderRadius: 14, padding: 28 }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 600 }}>Chat Widget · Dev Playground</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: '#9ca3af' }}>
        Switch templates and toggle the panel.
        {useLiveApi && liveAvailable && (
          <span style={{ display: 'block', marginTop: 6, color: '#22c55e', fontSize: 12 }}>
            Connected to live API · template + brand resolved from /widget-api/config
          </span>
        )}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setTemplate('proxybr')} style={{ background: template === 'proxybr' ? '#2563eb' : '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          ProxyBR
        </button>
        <button onClick={() => setTemplate('global')} style={{ background: template === 'global' ? '#2563eb' : '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Global
        </button>
        <button onClick={() => setIsOpen((v) => !v)} style={{ background: '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Toggle panel
        </button>
        {liveAvailable && (
          <button
            onClick={() => setUseLiveApi((v) => !v)}
            style={{ background: useLiveApi ? '#16a34a' : '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
            title="Toggle between mock adapter and the live widget API"
          >
            {useLiveApi ? 'Live API ✓' : 'Use Live API'}
          </button>
        )}
      </div>
      {!liveAvailable && (
        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#6b7280' }}>
          Set <code>VITE_WIDGET_APP_ID</code> + <code>VITE_WIDGET_BASE_URL</code> in <code>.env.local</code> to enable live-API mode.
        </p>
      )}

      <ChatWidget
        // Mock-mode template; ignored once live API responds with template_type.
        template={template}
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        user={{ name: 'Anderson', email: 'anderson@example.com' }}
        theme={demoTheme}
        {...liveProps}
      />
    </div>
  );
};

createRoot(document.getElementById('root')).render(<Playground />);
