/*
 * Design preview — the widget with a fake adapter, so it can be looked at
 * without a backend, an app id, or a conversation to be in the middle of.
 *
 * `playground.jsx` is the other harness and talks to the real API; this one
 * exists because the things worth checking in the UI (dark mode, a brand
 * colour nobody has chosen yet, the home screen of a first-time visitor) are
 * exactly the states a live account cannot be put into on demand.
 *
 *   npm run dev  →  http://localhost:5174/preview.html
 *
 * Query params: ?scheme=dark|light|auto  &accent=%23ff0000  &history=0|1
 *               &status=pending|active|resolved  &unread=2  &home=0
 */
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './src/index.jsx';

const params = new URLSearchParams(window.location.search);
const param = (name, fallback) => params.get(name) ?? fallback;

const scheme = param('scheme', 'light');

// The host page's own theme, expressed the way most sites express it: a class
// on <html>. `scheme=auto` is the interesting case — the widget is told
// nothing and has to follow this class, which is what a visitor flipping a
// site's own theme switch actually does.
if (scheme === 'dark') document.documentElement.classList.add('dark');
const accent = param('accent', '');
const locale = param('locale', 'pt-BR');
const withHistory = param('history', '1') !== '0';
const status = param('status', 'active');
const unread = Number(param('unread', '0')) || 0;
const home = param('home', '1') !== '0';

const now = Math.floor(Date.now() / 1000);

const THREAD = [
  {
    id: 1,
    from: 'bot',
    text: 'Olá! Sou o assistente da Loja Aurora. Em que posso ajudar hoje?',
    time: '14:02',
    sentAt: now - 90000,
    messageType: 'text',
    agent: { type: 'bot', name: 'Atendente Virtual' },
  },
  {
    id: 2,
    from: 'client',
    text: 'Oi! Meu pedido #48213 ainda não chegou.',
    time: '14:03',
    sentAt: now - 89000,
    messageType: 'text',
    deliveryStatus: 'sent',
  },
  {
    id: 3,
    from: 'human',
    text: 'Bom dia! Já localizei o pedido aqui — saiu para entrega hoje de manhã e deve chegar até as 18h.',
    time: '14:05',
    sentAt: now - 7400,
    messageType: 'text',
    agent: { type: 'human', name: 'Ana Souza', initials: 'AS' },
  },
];

/*
 * Three conversations, so the home list has something to be a list of. The
 * real adapter assembles these from one `GET /session/{token}` per remembered
 * token; here they are literals.
 */
const CONVERSATIONS = [
  {
    token: 'tok-active', id: 31, status, unreadCount: unread,
    agent: { type: 'human', name: 'Ana Souza' },
    lastMessage: { from: 'bot', text: 'Bom dia! Já localizei o pedido aqui — saiu para entrega hoje.', messageType: 'text', sentAt: now - 7400 },
  },
  {
    token: 'tok-old-1', id: 22, status: 'resolved', unreadCount: 0,
    agent: { type: 'human', name: 'Bruno Lima' },
    lastMessage: { from: 'client', text: 'Perfeito, obrigado pela ajuda!', messageType: 'text', sentAt: now - 260000 },
  },
  {
    token: 'tok-old-2', id: 14, status: 'resolved', unreadCount: 0,
    agent: null,
    lastMessage: { from: 'bot', text: 'Sua nota fiscal foi emitida.', messageType: 'document', sentAt: now - 1400000 },
  },
];

const makeAdapter = () => ({
  listConversations: () => Promise.resolve(withHistory ? CONVERSATIONS : []),
  openConversation: () => Promise.resolve(),
  start(handlers) {
    handlers.onConfig?.({
      template: 'global',
      brand: { title: 'Loja Aurora', accentColor: accent || '#2563eb', connectionId: 1 },
    });
    handlers.onStatus?.('ready');
    if (withHistory) {
      handlers.onAgent?.({ type: 'human', name: 'Ana Souza', initials: 'AS' });
      THREAD.forEach((message) => handlers.onMessage?.(message));
    }
    handlers.onSession?.({ status, unreadCount: unread });
    return () => {};
  },
  send() {},
  retryMessage() {},
  selectQuickReply() {},
  uploadAttachment: () => Promise.reject(new Error('preview')),
  markSeen() {},
  reset() {},
  refreshStatus() {},
});

const Page = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [siteDark, setSiteDark] = useState(() => document.documentElement.classList.contains('dark'));
  const adapter = useMemo(makeAdapter, []);

  const toggleSiteTheme = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    setSiteDark(next);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 48,
        background: siteDark ? '#0a0a0c' : '#f4f5f7',
        color: siteDark ? '#e5e7eb' : '#111827',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 30, margin: '0 0 8px', fontWeight: 700 }}>Loja Aurora</h1>
      <p style={{ margin: 0, opacity: 0.6, fontSize: 15 }}>
        Preview · {scheme} · accent {accent || 'from config'} · {withHistory ? 'returning visitor' : 'first visit'}
      </p>
      <p style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        {[
          { label: 'Toggle panel', onClick: () => setIsOpen((v) => !v) },
          { label: `Site theme: ${siteDark ? 'dark' : 'light'}`, onClick: toggleSiteTheme, id: 'site-theme' },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            id={action.id}
            onClick={action.onClick}
            style={{
              background: siteDark ? '#1f2937' : '#e5e7eb',
              color: 'inherit',
              border: 0,
              padding: '10px 18px',
              borderRadius: 10,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {action.label}
          </button>
        ))}
      </p>

      <ChatWidget
        adapter={adapter}
        appId="preview"
        template="global"
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        accent={accent || undefined}
        appearance={scheme}
        locale={locale}
        home={home}
        agents={[
          { name: 'Ana Souza' },
          { name: 'Bruno Lima' },
          { name: 'Júlia Reis' },
        ]}
        initialChatOptions={[
          { id: 'order', label: '📦 Meu pedido' },
          { id: 'pricing', label: '💰 Preços' },
        ]}
      />
    </div>
  );
};

createRoot(document.getElementById('root')).render(<Page />);
