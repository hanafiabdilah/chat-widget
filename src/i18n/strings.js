/*
 * Every word the global template can say.
 *
 * It used to say half of them in English and half in Portuguese — the send
 * placeholder read "Write a message..." and the failure under it read "Não
 * enviado". That was survivable while the template was three sentences; the
 * home screen is mostly words, so they are collected here instead.
 *
 * Four dictionaries, because the site that sells this product ships in four
 * languages and a widget speaking a fifth on one of them is worse than no
 * widget at all. `locale` picks one, a host may override any individual
 * line, and an unknown locale falls back to pt-BR rather than to a
 * missing-key crash:
 * the platform's first market is Brazil and a widget that renders the wrong
 * language still works, while one that renders `undefined` does not.
 */

const ptBR = {
  // Home
  greetingTitle: 'Olá 👋',
  greetingSubtitle: 'Como podemos ajudar?',
  recentMessage: 'Mensagem recente',
  sendMessage: 'Envie uma mensagem',
  sendMessageHint: 'Normalmente respondemos em alguns minutos',
  you: 'Você',

  // Chat
  writeMessage: 'Escreva uma mensagem…',
  addCaption: 'Adicione uma legenda…',
  online: 'Online',
  connecting: 'Conectando…',
  settingUp: 'Preparando seu chat',
  typing: 'digitando…',

  // Conversation status
  statusPending: 'Aguardando',
  statusActive: 'Em atendimento',
  statusResolved: 'Resolvido',
  conversationEnded: 'Esta conversa foi encerrada',
  startNewConversation: 'Iniciar nova conversa',

  // Composer / delivery
  notSent: 'Não enviado · tentar novamente',
  attachFile: 'Anexar arquivo',
  emoji: 'Emoji',
  send: 'Enviar',
  cancelAttachment: 'Cancelar anexo',
  dropFile: 'Solte o arquivo aqui',
  uploading: 'Enviando…',
  attachmentReady: 'pronto',
  uploadFailed: 'Falha no envio — cancele e tente de novo',

  // Media labels used in previews, where there is no text to show
  photo: 'Foto',
  video: 'Vídeo',
  audio: 'Áudio',
  file: 'Arquivo',

  // Controls (screen-reader labels and tooltips)
  openChat: 'Abrir o chat de suporte',
  closeChat: 'Fechar o chat',
  back: 'Voltar',
  unreadMessages: 'mensagens não lidas',

  // Relative time — suffixes, kept short because they sit in a 40px column
  timeNow: 'agora',
  timeMinute: 'min',
  timeHour: 'h',
  timeDay: 'd',
  timeWeek: 'sem',
};

const en = {
  greetingTitle: 'Hi there 👋',
  greetingSubtitle: 'How can we help?',
  recentMessage: 'Recent message',
  sendMessage: 'Send us a message',
  sendMessageHint: 'We typically reply in a few minutes',
  you: 'You',

  writeMessage: 'Write a message…',
  addCaption: 'Add a caption…',
  online: 'Online',
  connecting: 'Connecting…',
  settingUp: 'Setting up your chat',
  typing: 'typing…',

  statusPending: 'Waiting',
  statusActive: 'In progress',
  statusResolved: 'Resolved',
  conversationEnded: 'This conversation has ended',
  startNewConversation: 'Start a new conversation',

  notSent: 'Not sent · try again',
  attachFile: 'Attach file',
  emoji: 'Emoji',
  send: 'Send',
  cancelAttachment: 'Cancel attachment',
  dropFile: 'Drop the file here',
  uploading: 'Uploading…',
  attachmentReady: 'ready',
  uploadFailed: 'Upload failed — cancel and try again',

  photo: 'Photo',
  video: 'Video',
  audio: 'Audio',
  file: 'File',

  openChat: 'Open support chat',
  closeChat: 'Close chat',
  back: 'Back',
  unreadMessages: 'unread messages',

  timeNow: 'now',
  timeMinute: 'm',
  timeHour: 'h',
  timeDay: 'd',
  timeWeek: 'w',
};

const es = {
  greetingTitle: 'Hola 👋',
  greetingSubtitle: '¿En qué podemos ayudarte?',
  recentMessage: 'Mensaje reciente',
  sendMessage: 'Envíanos un mensaje',
  sendMessageHint: 'Normalmente respondemos en pocos minutos',
  you: 'Tú',

  writeMessage: 'Escribe un mensaje…',
  addCaption: 'Añade un comentario…',
  online: 'En línea',
  connecting: 'Conectando…',
  settingUp: 'Preparando tu chat',
  typing: 'escribiendo…',

  statusPending: 'En espera',
  statusActive: 'En curso',
  statusResolved: 'Resuelto',
  conversationEnded: 'Esta conversación ha terminado',
  startNewConversation: 'Iniciar una conversación nueva',

  notSent: 'No enviado · reintentar',
  attachFile: 'Adjuntar archivo',
  emoji: 'Emoji',
  send: 'Enviar',
  cancelAttachment: 'Cancelar adjunto',
  dropFile: 'Suelta el archivo aquí',
  uploading: 'Subiendo…',
  attachmentReady: 'listo',
  uploadFailed: 'Error al subir — cancela e inténtalo de nuevo',

  photo: 'Foto',
  video: 'Vídeo',
  audio: 'Audio',
  file: 'Archivo',

  openChat: 'Abrir el chat de soporte',
  closeChat: 'Cerrar el chat',
  back: 'Volver',
  unreadMessages: 'mensajes sin leer',

  timeNow: 'ahora',
  timeMinute: 'min',
  timeHour: 'h',
  timeDay: 'd',
  timeWeek: 'sem',
};

const id = {
  greetingTitle: 'Halo 👋',
  greetingSubtitle: 'Ada yang bisa kami bantu?',
  recentMessage: 'Pesan terakhir',
  sendMessage: 'Kirim pesan',
  sendMessageHint: 'Biasanya kami membalas dalam beberapa menit',
  you: 'Anda',

  writeMessage: 'Tulis pesan…',
  addCaption: 'Tambahkan keterangan…',
  online: 'Online',
  connecting: 'Menghubungkan…',
  settingUp: 'Menyiapkan obrolan Anda',
  typing: 'sedang mengetik…',

  statusPending: 'Menunggu',
  statusActive: 'Sedang ditangani',
  statusResolved: 'Selesai',
  conversationEnded: 'Percakapan ini sudah ditutup',
  startNewConversation: 'Mulai percakapan baru',

  notSent: 'Gagal terkirim · coba lagi',
  attachFile: 'Lampirkan berkas',
  emoji: 'Emoji',
  send: 'Kirim',
  cancelAttachment: 'Batalkan lampiran',
  dropFile: 'Lepaskan berkas di sini',
  uploading: 'Mengunggah…',
  attachmentReady: 'siap',
  uploadFailed: 'Unggahan gagal — batalkan lalu coba lagi',

  photo: 'Foto',
  video: 'Video',
  audio: 'Audio',
  file: 'Berkas',

  openChat: 'Buka obrolan dukungan',
  closeChat: 'Tutup obrolan',
  back: 'Kembali',
  unreadMessages: 'pesan belum dibaca',

  timeNow: 'baru saja',
  timeMinute: 'mnt',
  timeHour: 'jam',
  timeDay: 'hr',
  timeWeek: 'mgg',
};

export const DICTIONARIES = { 'pt-br': ptBR, pt: ptBR, en, es, id, in: id };

export const DEFAULT_LOCALE = 'pt-BR';

/**
 * Resolves `pt-BR`, `pt`, `PT_br` and `pt-PT` to the Portuguese dictionary,
 * and anything unknown to it as well. Matching the full tag first means a
 * future `pt-PT` dictionary starts being used the moment it is added, with
 * no call site to change.
 */
export const resolveStrings = (locale, overrides) => {
  const tag = typeof locale === 'string' ? locale.toLowerCase().replace('_', '-') : '';
  const base = DICTIONARIES[tag] || DICTIONARIES[tag.split('-')[0]] || ptBR;
  if (!overrides || typeof overrides !== 'object') return base;
  return { ...base, ...overrides };
};

/**
 * "now", "5min", "3h", "2d", "4sem" — the column on the right of the recent
 * conversation card. Absolute dates are deliberately absent: the card answers
 * "is this still the thing I was talking about", not "when exactly".
 */
export const relativeTime = (unixSeconds, strings) => {
  if (!unixSeconds) return '';
  const seconds = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (!Number.isFinite(seconds)) return '';
  // Clock skew between the visitor's machine and the server can put a message
  // a few seconds in the future; "now" is the honest reading of that.
  if (seconds < 60) return strings.timeNow;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${strings.timeMinute}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}${strings.timeHour}`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}${strings.timeDay}`;
  return `${Math.floor(seconds / 604800)}${strings.timeWeek}`;
};

export default resolveStrings;
