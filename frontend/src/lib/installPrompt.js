/**
 * The browser's offer to install Skole as an app (Chrome, Edge and Android fire `beforeinstallprompt`
 * once the manifest qualifies; Safari never does, its users pick "Add to Home Screen" from the Share
 * menu). The event is kept so the account menu can show "Install app"; the browser's own install
 * buttons keep working too. Imported by main.jsx, so the listener exists before the event can fire.
 */
const listeners = new Set();
let offer = null;

const emit = () => listeners.forEach((listener) => listener());

window.addEventListener('beforeinstallprompt', (event) => {
  offer = event;
  emit();
});

window.addEventListener('appinstalled', () => {
  offer = null;
  emit();
});

export const installPrompt = {
  /** @returns {() => void} unsubscribe */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** True while the browser offers to install the app. */
  canInstall: () => offer !== null,
  /** Opens the browser's install dialog. An offer can be used once, so it is dropped whatever the answer. */
  async install() {
    const current = offer;
    if (!current) return;
    offer = null;
    emit();
    await current.prompt();
  },
};
