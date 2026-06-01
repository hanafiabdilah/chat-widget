import {
  AlertCircle,
  Headphones,
  Server,
  Wallet,
} from 'lucide-react';

// Mock conversation script — used until a real backend adapter (e.g.
// omnichannel) is wired. Lives in the chat-widget package so templates
// don't need to know about it. The data shape matches `types.js`.

const BOT = {
  type: 'bot',
  name: 'Atendente Virtual',
};

const HUMAN = {
  type: 'human',
  name: 'Marina',
  role: 'Suporte técnico',
  initials: 'MA',
  avatarColor: '#a855f7',
};

const QUICK_REPLIES = [
  { id: 'renew', icon: Wallet, label: '💰 Renovar plano', colorKey: 'accent' },
  { id: 'tech', icon: Server, label: '⚠️ Problema técnico', colorKey: 'warning' },
  { id: 'api', icon: AlertCircle, label: '📡 Dúvida sobre API', color: '#06b6d4' },
  { id: 'human', icon: Headphones, label: '🎧 Falar com humano', color: '#a855f7', escalates: true },
];

const now = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const firstNameFromUser = (user) => {
  const name = user?.firstName || user?.first_name || user?.name || user?.full_name || user?.email || '';
  return String(name).split(/[ @]/).filter(Boolean)[0] || 'cliente';
};

// Factory so callers can configure user context per instance — and so the
// internal `timers` array is per-conversation (cleaned up on unmount).
export const createMockAdapter = ({ user } = {}) => {
  const timers = [];
  const schedule = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timers.push(id);
    return id;
  };

  let handlers = {};
  let messageCounter = 1;
  const nextId = () => {
    messageCounter += 1;
    return `mock-${Date.now()}-${messageCounter}`;
  };

  const firstName = firstNameFromUser(user);

  const emitBotReply = () => {
    schedule(() => {
      handlers.onTyping?.(true);
      schedule(() => {
        handlers.onTyping?.(false);
        handlers.onMessage?.({
          id: nextId(),
          from: 'bot',
          text: 'Entendi. Vou te conectar com um especialista. Enquanto isso, pode adiantar mais detalhes do que está acontecendo?',
          time: now(),
        });
      }, 1500);
    }, 650);
  };

  const emitHumanEscalation = () => {
    schedule(() => {
      handlers.onMessage?.({
        id: nextId(),
        from: 'bot',
        text: 'Perfeito, vou chamar a Marina pra você. Ela já te responde em instantes 🤝',
        time: now(),
      });

      schedule(() => {
        handlers.onTyping?.(true);
        schedule(() => {
          handlers.onTyping?.(false);
          handlers.onAgent?.(HUMAN);
          handlers.onMessage?.({
            id: nextId(),
            from: 'human',
            text: `Oi, ${firstName}! Marina aqui do suporte técnico. Em que posso ajudar?`,
            time: now(),
          });
        }, 2200);
      }, 900);
    }, 750);
  };

  return {
    start(nextHandlers) {
      handlers = nextHandlers || {};
      // Greeting is async so templates see the typing transition naturally
      // instead of a hard-coded initial bubble appearing pre-mount.
      schedule(() => {
        handlers.onAgent?.(BOT);
        handlers.onQuickReplies?.(QUICK_REPLIES);
        handlers.onMessage?.({
          id: nextId(),
          from: 'bot',
          text: `Oi, ${firstName}! 👋\n\nSou o atendente virtual. Como posso te ajudar hoje?`,
          time: now(),
        });
      }, 350);

      return () => {
        timers.forEach(clearTimeout);
        timers.length = 0;
        handlers = {};
      };
    },

    send(text) {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      const id = nextId();
      handlers.onMessage?.({
        id, from: 'client', text: trimmed, time: now(), seen: false,
      });
      // Mock "delivered → seen" — real adapters get this from the server.
      schedule(() => handlers.onMessageSeen?.(id), 600);
      emitBotReply();
    },

    selectQuickReply(reply) {
      if (!reply?.label) return;
      const id = nextId();
      handlers.onMessage?.({
        id, from: 'client', text: reply.label, time: now(), seen: false,
      });
      schedule(() => handlers.onMessageSeen?.(id), 600);
      // Suppress further quick replies once the user has picked one.
      handlers.onQuickReplies?.([]);
      if (reply.escalates) emitHumanEscalation();
      else emitBotReply();
    },
  };
};

export default createMockAdapter;
