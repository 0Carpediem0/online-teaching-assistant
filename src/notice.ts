import { tokens } from './styles';

export type Notice = {
  key: string;
  title: string;
  message: string;
  tone: 'warning' | 'danger' | 'info';
};

/** A persistent, dismissible notification. Polling the same condition cannot reopen it. */
export function createNotice(root: HTMLElement | ShadowRoot, id = 'notice') {
  const doc = root.ownerDocument;
  const style = doc.createElement('style');
  style.textContent = `
    .notice{${tokens};box-sizing:border-box;position:fixed;z-index:10000;left:16px;right:16px;bottom:16px;max-width:554px;margin-left:auto;padding:20px;border-radius:24px;background:#fff5e4;box-shadow:0 10px 35px #20342d24;overflow-wrap:anywhere}
    .notice[hidden]{display:none!important}.notice[data-tone=danger]{background:#f9eeea}.notice[data-tone=info]{background:#f6f8f4;border:1px solid #e1e7e1}
    .notice__head{display:flex;gap:12px;align-items:center}.notice__icon{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;background:#855916;color:#fff;font-size:17px;font-weight:600}
    .notice[data-tone=danger] .notice__icon{background:#8a4737}.notice[data-tone=info] .notice__icon{background:#246a51}
    .notice__title{flex:1;min-width:0;margin:0;font-size:15px;font-weight:600;line-height:1.45}.notice__close{flex:none;display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;color:#65746c;background:transparent;font:21px/1 system-ui;cursor:pointer}
    .notice__close:hover{background:#20342d0d}.notice__close:focus-visible{outline:3px solid #246a51;outline-offset:2px}.notice__message{margin:12px 0 0;color:#536259;font-size:13px;line-height:1.5}
    @media(max-width:340px){.notice{left:12px;right:12px;padding:16px}.notice__head{gap:9px}.notice__title{font-size:14px}}
  `;
  const element = doc.createElement('aside');
  element.id = id; element.className = 'notice'; element.hidden = true;
  element.setAttribute('role', 'alert');
  element.setAttribute('aria-atomic', 'true');
  element.innerHTML = `<div class="notice__head"><span class="notice__icon" aria-hidden="true">!</span><p class="notice__title"></p><button class="notice__close" type="button" aria-label="Закрыть уведомление">×</button></div><p class="notice__message"></p>`;
  root.append(style, element);
  const title = element.querySelector<HTMLElement>('.notice__title')!;
  const message = element.querySelector<HTMLElement>('.notice__message')!;
  let currentKey: string | undefined;
  let dismissed = false;
  element.querySelector<HTMLButtonElement>('button')!.onclick = () => { dismissed = true; element.hidden = true; };
  return { render(notice?: Notice) {
    if (notice?.key !== currentKey) { currentKey = notice?.key; dismissed = false; }
    element.hidden = !notice || dismissed;
    if (!notice) return;
    if (title.textContent !== notice.title) title.textContent = notice.title;
    if (message.textContent !== notice.message) message.textContent = notice.message;
    element.dataset.tone = notice.tone;
  } };
}
