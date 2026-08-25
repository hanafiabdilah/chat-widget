// Shape contracts shared by all chat-widget templates and adapters.
// Documented via JSDoc so consumers get IntelliSense without needing TS.

/**
 * @typedef {Object} Agent
 * @property {'bot'|'human'} type
 * @property {string} name
 * @property {string} [role]
 * @property {string} [initials]
 * @property {string} [avatarColor]   Hex used by templates that render initials.
 */

/**
 * @typedef {Object} Message
 * @property {string|number} id
 * @property {'bot'|'human'|'client'} from
 * @property {string} text
 * @property {string} time             Pre-formatted "HH:mm" — templates don't reparse.
 * @property {boolean} [seen]          Only meaningful for `from: 'client'`.
 * @property {'pending'|'sent'|'failed'} [deliveryStatus]
 *           Visitor messages only. `pending` = drawn optimistically, still in
 *           flight; `failed` = the send errored and `retryMessage(id)` will
 *           re-send it; `sent` = the server has echoed it back. Undefined on
 *           agent/bot messages, which are only ever rendered once received.
 * @property {string|number} [replacesId]
 *           Set by the adapter on a server message that supersedes an
 *           optimistic one, so the hook swaps it in place rather than
 *           appending a duplicate. Never present on stored state.
 * @property {number|null} [editedAt]
 * @property {number|null} [unsendAt]  Delete tombstone (Unix seconds).
 * @property {string|null} [attachmentUrl]
 * @property {Agent|null} [agent]      Per-message sender (overrides currentAgent).
 * @property {*} [_raw]                Original MessageResource from backend.
 */

/**
 * Host-supplied chips shown above the input until the visitor has sent
 * their first message. Clicking one fires a normal POST through the
 * widget API — there's no special endpoint, the label (or `message`
 * override) is what the agent receives.
 *
 * @typedef {Object} InitialChatOption
 * @property {string} id              Stable key — used for React reconciliation.
 * @property {string} label           Text shown on the chip, also the
 *                                    default text sent when clicked.
 * @property {string} [message]       Override the sent message text. Useful
 *                                    when you want a short chip label but a
 *                                    fuller message goes to the agent
 *                                    (e.g. "Pricing" → "I'd like to know
 *                                    more about your pricing plans").
 * @property {string} [color]         Hex color used for the chip's accent
 *                                    (border + text; templates compose the
 *                                    fill from this).
 */

/**
 * @typedef {Object} QuickReply
 * @property {string} id
 * @property {string} label
 * @property {string} [color]          Hex override.
 * @property {string} [colorKey]       Theme key (`accent`, `warning`, etc.).
 * @property {*}      [icon]           Component (lucide icon) — templates may
 *                                     opt out of rendering it.
 * @property {boolean} [escalates]     `true` → adapter should transition to
 *                                     a human agent when selected.
 */

/**
 * Brand + presentation overrides surfaced by an adapter after fetching its
 * remote config (e.g. omnichannel widget config endpoint). Templates take
 * priority over host-provided props since the owner of the connection
 * decides UI in the dashboard, not the embedding site.
 *
 * @typedef {Object} ConversationConfig
 * @property {'global'|'proxybr'} [template]
 * @property {Object} [brand]
 * @property {string} [brand.title]
 * @property {string} [brand.statusLine]
 * @property {string|null} [brand.accentColor]
 * @property {string|null} [brand.acceptMessage]
 * @property {number|null} [brand.connectionId]
 * @property {*} [raw]
 */

/**
 * Subscription callbacks the adapter pushes events to. Each is optional; the
 * adapter must guard against undefined.
 *
 * Lifecycle status the adapter reports so the host can hide / block the
 * UI when the connection isn't usable:
 *   - `loading`     Initial state — adapter is fetching config / session.
 *   - `ready`       Config loaded; chat is live.
 *   - `unavailable` Config rejected (`422` invalid `app_id` per API.md §9).
 *                   Host should show "Chat tidak tersedia".
 *   - `inactive`    Connection disabled by owner (`403`). Host should hide
 *                   the widget entirely and NOT retry.
 *   - `error`       Recoverable transport error (network / 5xx). UI stays
 *                   visible; host may show a toast.
 *
 * @typedef {'loading'|'ready'|'unavailable'|'inactive'|'error'} AdapterStatus
 *
 * @typedef {Object} AdapterHandlers
 * @property {(msg: Message) => void}                 [onMessage]
 * @property {(messageId: string|number) => void}     [onMessageSeen]
 * @property {(isTyping: boolean) => void}            [onTyping]
 * @property {(agent: Agent) => void}                 [onAgent]
 * @property {(replies: QuickReply[]) => void}        [onQuickReplies]
 * @property {(config: ConversationConfig) => void}   [onConfig]
 * @property {(status: AdapterStatus, err?: Error) => void} [onStatus]
 * @property {(error: Error) => void}                 [onError]
 */

/**
 * Adapters expose conversation state + transport. Templates never reach the
 * network directly — they call adapter methods, and the adapter pushes
 * updates back via handlers registered in `start`.
 *
 * @typedef {Object} ChatAdapter
 * @property {(handlers: AdapterHandlers) => (() => void)} start
 *           Returns a cleanup function the hook calls on unmount.
 * @property {(text: string) => void}              send
 * @property {(reply: QuickReply) => void}         selectQuickReply
 */
export {};
