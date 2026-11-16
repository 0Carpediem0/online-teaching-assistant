export const tokens = `--ink:#20342d;--muted:#65746c;--green:#246a51;--soft:#eaf3ed;--line:#e1e7e1;--paper:#fff;--bg:#f6f8f4;--warn:#865b19;font:13px/1.5 'Segoe UI',system-ui,sans-serif;color:var(--ink)`;
export const styles = `
:host,body{${tokens}}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg)}button,input{font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #8db79e;outline-offset:3px}
#panel{width:640px;max-width:100%;max-height:480px;overflow:hidden;border-radius:28px;background:var(--bg);padding:20px}
#panel .panel-body{display:flex;gap:16px;align-items:stretch;min-height:340px}
#panel .col-left{flex:0 0 240px;display:flex;flex-direction:column;gap:12px}
#panel .col-right{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.session{background:var(--paper);border:1px solid var(--line);border-radius:24px;padding:16px}.session-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.platform{font-size:11px;color:var(--muted)}.badge{font-size:10px;color:var(--green);background:var(--soft);padding:4px 8px;border-radius:20px;white-space:nowrap}.badge[data-tone=warning]{color:var(--warn);background:#faf0da}.badge[data-tone=neutral]{color:var(--muted);background:var(--bg)}h1{font-size:22px;line-height:1.2;letter-spacing:-.7px;margin:14px 0 7px;font-weight:600}p{margin:0}#hint{color:var(--muted);font-size:12px;min-height:36px}.primary{width:100%;border:0;border-radius:20px;background:var(--green);color:white;padding:11px 12px;margin-top:14px;font-weight:600}.primary:hover{background:#19553f}.primary.finish{background:#fff;color:var(--ink);border:1px solid var(--line)}.primary.finish:hover{background:var(--bg)}
.toggles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tile{display:grid;place-items:center;gap:6px;aspect-ratio:1;padding:10px 8px;border:1px solid var(--line);border-radius:18px;background:var(--paper);color:var(--ink);text-align:center;transition:background .15s,border-color .15s}
.tile:hover:not(:disabled){background:var(--soft)}
.tile[aria-pressed=true]{background:var(--soft);border-color:var(--green);color:var(--green)}
.tile[aria-pressed=true] .tile-icon{background:var(--green);color:#fff}
.tile[aria-disabled=true]{cursor:default}
.tile-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:var(--bg);color:var(--muted);font-size:16px;line-height:1}
.tile-label{font-size:11px;font-weight:600;line-height:1.25}
.tile-note{font-size:10px;color:var(--muted);line-height:1.2}
.ai-feed{flex:1;min-height:0;overflow-y:auto;background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:10px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin}
.feed-item{border:1px solid var(--line);border-radius:14px;padding:10px 12px;background:var(--bg)}
.feed-item[data-tone=warning]{background:#fff5e4;border-color:#f0dfb9}
.feed-item[data-tone=danger]{background:#f9eeea;border-color:#efd9d2}
.feed-item[data-tone=info]{background:var(--bg)}
.feed-head{display:flex;align-items:center;gap:8px}
.feed-icon{display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:var(--green);color:#fff;font-size:12px;font-weight:600}
.feed-item[data-tone=warning] .feed-icon{background:var(--warn)}
.feed-item[data-tone=danger] .feed-icon{background:#8a4737}
.feed-title{margin:0;font-size:12px;font-weight:600;line-height:1.35}
.feed-message{margin:6px 0 0;font-size:11.5px;color:var(--muted);line-height:1.45}
.open-chat{flex:none;width:100%;border:0;border-radius:16px;background:var(--green);color:#fff;padding:12px;font-weight:600;font-size:13px}
.open-chat:hover{background:#19553f}
#launcher{border:1px solid var(--line);background:white;color:var(--ink);padding:7px 10px;border-radius:8px}
.connection-preview{box-sizing:border-box;min-height:360px;padding:24px;background:var(--bg);color:var(--ink);font:13px/1.5 system-ui;border-radius:28px}
.connection-preview h1{font-size:22px;margin:0 0 7px;font-weight:600}
.connection-preview p{color:var(--muted);font-size:12px;margin:0}
@media(max-width:680px){#panel{width:100%;padding:14px}#panel .col-left{flex:0 0 200px}}
`;