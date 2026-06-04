/**
 * AcoBot — Floating AI Chat Widget
 * Drop <script src="acobot.js"></script> before </body> on any page.
 * Renders a collapsible chat widget at bottom-left.
 */
(function () {
  // ── Conversations ──────────────────────────────────────────
  const conversations = [
    [
      { type: 'bot',  text: 'Hello! 👋 How can I help you today?' },
      { type: 'user', text: 'What is my total receivable?' },
      { type: 'bot',  text: '<b>Total Receivables: AED 733,777</b><br/><span style="color:#34c759;font-size:.78rem">▲ 12% from last month</span>', metric: true },
    ],
    [
      { type: 'bot',  text: 'Hi there! 🤖 Ask me anything.' },
      { type: 'user', text: "Show me today's profit summary" },
      { type: 'bot',  text: '<b>Gross Profit: AED 7.7M</b><br/>Income: 8.2M &nbsp;|&nbsp; Cost: 0.5M', metric: true },
    ],
    [
      { type: 'bot',  text: "Hello! 👋 I'm AcoBot, your AI assistant." },
      { type: 'user', text: 'Any pending invoices?' },
      { type: 'bot',  text: '<b>93 Unpaid Invoices</b><br/>Outstanding: <span style="color:#ff3b30">AED 2,415</span>', metric: true },
    ],
    [
      { type: 'bot',  text: 'Good day! 🌟 How can I assist?' },
      { type: 'user', text: "What are this week's sales?" },
      { type: 'bot',  text: '<b>Weekly Sales: AED 124,165</b><br/>16 invoices · AED 9,240 received', metric: true },
    ],
    [
      { type: 'bot',  text: 'Hey! AcoBot here. What would you like to know?' },
      { type: 'user', text: 'How many active projects?' },
      { type: 'bot',  text: '<b>47 Active Projects</b><br/>12 on-track · 3 need attention ⚠️', metric: true },
    ],
  ];

  // ── Inject CSS ─────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #acobotFab {
      position: fixed;
      bottom: 28px;
      left: 28px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, Arial, sans-serif;
    }
    #acobotPanel {
      width: 300px;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1);
      display: none;
      flex-direction: column;
      transform-origin: bottom left;
      animation: acobotOpen .28s cubic-bezier(.34,1.4,.64,1) both;
    }
    #acobotPanel.visible { display: flex; }
    @keyframes acobotOpen {
      from { opacity: 0; transform: scale(.85) translateY(14px); }
      to   { opacity: 1; transform: scale(1)  translateY(0); }
    }
    .aco-header {
      background: linear-gradient(135deg, #3a8fc7, #2979b8);
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .aco-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,.2);
      border: 2px solid rgba(255,255,255,.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; flex-shrink: 0;
    }
    .aco-close {
      margin-left: auto;
      background: rgba(255,255,255,.15);
      border: none; cursor: pointer;
      width: 26px; height: 26px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: .75rem;
      transition: background .2s;
    }
    .aco-close:hover { background: rgba(255,255,255,.28); }
    .aco-body {
      background: #f0f0f5;
      padding: 12px;
      height: 290px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scroll-behavior: smooth;
    }
    .aco-body::-webkit-scrollbar { width: 3px; }
    .aco-body::-webkit-scrollbar-thumb { background: #c7c7cc; border-radius: 2px; }
    .aco-msg {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      animation: acoBubble .35s cubic-bezier(.34,1.5,.64,1) both;
    }
    @keyframes acoBubble {
      from { opacity: 0; transform: translateY(8px) scale(.93); }
      to   { opacity: 1; transform: none; }
    }
    .aco-msg.user { flex-direction: row-reverse; }
    .aco-bubble {
      max-width: 195px;
      padding: 8px 12px;
      border-radius: 18px;
      font-size: .8rem;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .aco-bubble.bot {
      background: #fff;
      color: #1c1c1e;
      border-radius: 4px 18px 18px 18px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .aco-bubble.user {
      background: linear-gradient(135deg, #3a8fc7, #2979b8);
      color: #fff;
      border-radius: 18px 18px 4px 18px;
    }
    .aco-bubble.metric {
      background: #fff;
      border-left: 3px solid #3a8fc7;
      border-radius: 4px 18px 18px 18px;
    }
    .aco-bot-av {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3a8fc7, #2979b8);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: .65rem; color: #fff;
    }
    .aco-typing {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }
    .aco-dots {
      background: #fff;
      border-radius: 4px 18px 18px 18px;
      padding: 10px 14px;
      display: flex;
      gap: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .aco-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #b0b8c4;
      animation: acoDot 1.2s ease-in-out infinite;
    }
    .aco-dot:nth-child(2) { animation-delay: .2s; }
    .aco-dot:nth-child(3) { animation-delay: .4s; }
    @keyframes acoDot {
      0%,60%,100% { transform: scale(1); opacity: .5; }
      30%          { transform: scale(1.35); opacity: 1; }
    }
    .aco-footer {
      background: linear-gradient(135deg, #3a8fc7, #2979b8);
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .aco-input-fake {
      flex: 1;
      background: rgba(255,255,255,.18);
      border-radius: 980px;
      padding: 7px 12px;
      font-size: .78rem;
      color: rgba(255,255,255,.65);
      font-style: italic;
      font-family: inherit;
      pointer-events: none;
      user-select: none;
    }
    .aco-mic {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0,0,0,.15);
    }
    /* Fab button */
    #acobotBtn {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3a8fc7, #2979b8);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 18px rgba(41,121,184,.45);
      transition: transform .25s, box-shadow .25s;
      position: relative;
    }
    #acobotBtn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(41,121,184,.55);
    }
    #acobotBtn .aco-ping {
      position: absolute;
      top: 0; right: 0;
      width: 14px; height: 14px;
      background: #34c759;
      border-radius: 50%;
      border: 2px solid #fff;
    }
  `;
  document.head.appendChild(style);

  // ── Build HTML ─────────────────────────────────────────────
  const fab = document.createElement('div');
  fab.id = 'acobotFab';
  fab.innerHTML = `
    <div id="acobotPanel">
      <div class="aco-header">
        <div class="aco-avatar">🤖</div>
        <div>
          <div style="color:#fff;font-weight:700;font-size:.9rem;letter-spacing:-.01em">AcoBot</div>
          <div style="color:rgba(255,255,255,.65);font-size:.7rem;display:flex;align-items:center;gap:4px">
            <span style="width:6px;height:6px;border-radius:50%;background:#34c759;display:inline-block"></span>Online
          </div>
        </div>
        <button class="aco-close" onclick="toggleAcobot()" title="Close">✕</button>
      </div>
      <div class="aco-body" id="acobotBody"></div>
      <div class="aco-footer">
        <div class="aco-input-fake">Type something…</div>
        <div class="aco-mic">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#3a8fc7"/>
            <path d="M5 11a7 7 0 0014 0" stroke="#3a8fc7" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="18" x2="12" y2="22" stroke="#3a8fc7" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    </div>
    <button id="acobotBtn" onclick="toggleAcobot()" title="Chat with AcoBot">
      <span class="aco-ping"></span>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="2" fill="#fff"/>
        <circle cx="15" cy="9" r="2" fill="#fff"/>
        <path d="M12 2C6.477 2 2 6.253 2 11.5c0 2.066.717 3.97 1.91 5.5L2.5 21l4.27-1.37A10.11 10.11 0 0012 21c5.523 0 10-4.253 10-9.5S17.523 2 12 2z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
  document.body.appendChild(fab);

  // ── State ──────────────────────────────────────────────────
  let isOpen = false;
  let convIdx = 0, timer = null;

  window.toggleAcobot = function () {
    isOpen = !isOpen;
    const panel = document.getElementById('acobotPanel');
    if (isOpen) {
      panel.classList.add('visible');
      panel.style.animation = 'none';
      requestAnimationFrame(() => {
        panel.style.animation = '';
        panel.classList.add('visible');
      });
      startConversation();
    } else {
      panel.classList.remove('visible');
      clearTimeout(timer);
    }
  };

  function startConversation() {
    const body = document.getElementById('acobotBody');
    body.innerHTML = '';
    const msgs = conversations[convIdx % conversations.length];
    convIdx++;
    let i = 0;
    function next() {
      if (i >= msgs.length) {
        timer = setTimeout(startConversation, 3200);
        return;
      }
      const m = msgs[i++];
      if (m.type === 'user') {
        appendMsg(body, m);
        timer = setTimeout(next, 900);
      } else {
        // Show typing first
        const typing = appendTyping(body);
        timer = setTimeout(() => {
          typing.remove();
          appendMsg(body, m);
          timer = setTimeout(next, 800);
        }, 1000);
      }
    }
    timer = setTimeout(next, 400);
  }

  function appendMsg(container, m) {
    const div = document.createElement('div');
    div.className = 'aco-msg' + (m.type === 'user' ? ' user' : '');
    if (m.type === 'bot') {
      div.innerHTML = `
        <div class="aco-bot-av">🤖</div>
        <div class="aco-bubble bot${m.metric ? ' metric' : ''}">${m.text}</div>`;
    } else {
      div.innerHTML = `<div class="aco-bubble user">${m.text}</div>`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function appendTyping(container) {
    const div = document.createElement('div');
    div.className = 'aco-typing';
    div.innerHTML = `
      <div class="aco-bot-av">🤖</div>
      <div class="aco-dots">
        <div class="aco-dot"></div>
        <div class="aco-dot"></div>
        <div class="aco-dot"></div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }
})();
