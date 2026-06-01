import { ProxybrTemplate } from './proxybr/ProxybrTemplate.jsx';
import { GlobalTemplate } from './global/GlobalTemplate.jsx';

// Registry maps a string id to its React component, so callers can swap
// templates at runtime via a single prop. Extend this object to add a new
// template — no other file needs to know about it.
export const templates = {
  proxybr: ProxybrTemplate,
  global: GlobalTemplate,
};

export { ProxybrTemplate, GlobalTemplate };
