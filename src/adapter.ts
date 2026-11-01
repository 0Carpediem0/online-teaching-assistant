export type ChatState = 'available' | 'unavailable' | 'opening';

// Future parser output. Optional platform metadata must come from evidence.
export interface ObservedMessage {
  eventId: string;
  text: string;
  observedAt: string;
  platformTime?: string;
  author?: string;
  own: boolean;
  authorEvidence: 'explicit' | 'inferred' | 'unknown';
  origin: 'initial' | 'observed' | 'recovered';
}

export interface PlatformAdapter {
  observeChat(listener: (state: ChatState) => void, onMessage?: (message: ObservedMessage) => void): () => void;
}

function visible(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  for (let el: HTMLElement | null = node; el; el = el.parentElement) {
    const style = el.ownerDocument.defaultView!.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  }
  return true;
}
function panel(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.yamb-aside .yamb-chat')].find(visible);
}

export function tryOpenChat(): boolean {
  if (panel()) return false;
  const candidates: HTMLElement[] = [];
  // Cross-origin documents are deliberately inaccessible here. Their origins
  // must be established before adding an extension messaging/injection route.
  const visit = (doc: Document, depth: number) => {
    for (const button of doc.querySelectorAll<HTMLElement>('button[data-testid="chat-alt-button"][title="Открыть чат"]')) {
      if (visible(button) && !button.closest('.yamb-aside, #teacher-assistant-root') && !button.matches(':disabled, [aria-disabled="true"]')) candidates.push(button);
    }
    if (depth >= 8) return;
    for (const frame of doc.querySelectorAll<HTMLIFrameElement>('iframe')) {
      if (!visible(frame)) continue;
      try { if (frame.contentDocument) visit(frame.contentDocument, depth + 1); } catch { /* different origin */ }
    }
  };
  visit(document, 0);
  if (candidates.length !== 1) return false;
  candidates[0].click();
  return true;
}

export class TelemostAdapter implements PlatformAdapter {
  observeChat(listener: (state: ChatState) => void, onMessage?: (message: ObservedMessage) => void): () => void {
    let previous: ChatState | undefined;
    let previousPanel: HTMLElement | undefined;
    let openings = 0, openingUntil = 0;
    let pending = new WeakMap<Element, { signature: string; since: number; origin: ObservedMessage['origin'] }>();
    const emitted = new WeakMap<Element, string>();
    const counts = new Map<string, number>();
    let waitingUntil = 0;
    const inspect = () => {
      const chat = panel(), now = Date.now();
      if (chat && chat !== previousPanel) { openings++; openingUntil = now + 2500; pending = new WeakMap(); }
      previousPanel = chat;
      if (chat) waitingUntil = 0;
      const state: ChatState = chat ? 'available' : now < waitingUntil ? 'opening' : 'unavailable';
      if (state !== previous) { previous = state; listener(state); }
      if (!chat) return;
      const occurrences = new Map<string, number>();
      for (const row of chat.querySelectorAll<HTMLElement>('.yamb-message-row')) {
        if (!visible(row) || row.closest('[contenteditable="true"], [role="textbox"]') || row.querySelector('input, textarea, [contenteditable="true"]')) continue;
        const text = row.querySelector('.yamb-message-text > .text')?.textContent?.trim();
        if (!text) continue;
        const platformTime = row.querySelector('.yamb-message-info__time')?.textContent?.trim() || undefined;
        const own = row.classList.contains('yamb-message-row_own');
        const signature = JSON.stringify([text, platformTime, own]);
        const occurrence = (occurrences.get(signature) ?? 0) + 1;
        occurrences.set(signature, occurrence);
        let candidate = pending.get(row);
        if (!candidate || candidate.signature !== signature) {
          candidate = { signature, since: now, origin: now <= openingUntil ? openings === 1 ? 'initial' : 'recovered' : 'observed' };
          pending.set(row, candidate);
        }
        if (now - candidate.since < 700 || emitted.get(row) === signature) continue;
        emitted.set(row, signature);
        // Conservative occurrence matching across remounts; identical replacements remain ambiguous.
        if (occurrence <= (counts.get(signature) ?? 0)) continue;
        counts.set(signature, occurrence);
        const author = row.querySelector('.yamb-message-user__name')?.textContent?.trim() || undefined;
        onMessage?.({ eventId: crypto.randomUUID(), text, platformTime, author, own,
          authorEvidence: author ? 'explicit' : 'unknown', observedAt: new Date(candidate.since).toISOString(), origin: candidate.origin });
      }
    };
    if (tryOpenChat()) waitingUntil = Date.now() + 4000;
    inspect();
    // Small periodic check also catches layout changes without DOM mutations.
    const timer = window.setInterval(inspect, 800);
    document.addEventListener('visibilitychange', inspect);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', inspect);
    };
  }
}
