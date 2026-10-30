/** App-wide commands that any button or shortcut can trigger without prop drilling. */
type Command = 'assistant' | 'shortcuts' | 'quick-add';

const target = new EventTarget();

export function runCommand(command: Command, detail?: string): void {
  target.dispatchEvent(new CustomEvent(command, { detail }));
}

export function onCommand(command: Command, handler: (detail?: string) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<string | undefined>).detail);
  target.addEventListener(command, listener);
  return () => target.removeEventListener(command, listener);
}

/** Opens the AI assistant, optionally with a command already typed in. */
export const openAssistant = (prompt?: string): void => runCommand('assistant', prompt);
export const openShortcuts = (): void => runCommand('shortcuts');

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

/** True when the person is typing, so single-key shortcuts should stay out of the way. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}
