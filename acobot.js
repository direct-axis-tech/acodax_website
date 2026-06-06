/**
 * AcoBot — AI Floating Chat Widget
 * Session persistence via localStorage (history + open/closed state)
 */
(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────
  const ENDPOINT         = 'chatbot.php';
  const SESSION_KEY      = 'acb_session';   // history + collected data
  const OPEN_KEY         = 'acb_open';      // window open/closed state
  const INACTIVITY_MS    = 2 * 60 * 1000;  // 2 min → ask "still there?"
  const AUTO_END_MS      = 60 * 1000;       // 1 min → auto-end
  const GREET_MSG        = "Hello! 👋 I'm AcoBot, your Acodax ERP support assistant. I'm here to help with any questions about our platform or to set up a free demo. How can I help you today?";
  const INDUSTRY_OPTIONS = ['Trading','Retail','Service','Manufacturing','Real Estate','Construction','Healthcare','Others'];

  // ── Runtime state ─────────────────────────────────────────────
  let chatHistory    = [];
  let collected      = { company_name:'', industry:'', email:'', software:'' };
  let isOpen         = false;
  let isTyping       = false;
  let started        = false;
  let isEnded        = false;
  let isCompleted    = false;
  let inactivityTmr  = null;
  let autoEndTmr     = null;
  let awaitingEndAck = false;

  // ══════════════════════════════════════════════════════════════
  // 1. SESSION PERSISTENCE
  // ══════════════════════════════════════════════════════════════

  /** Save session to window.name (persists across same-tab navigation) + localStorage backup */
  function saveSession() {
    const payload = JSON.stringify({
      _acb: true,
      history:     chatHistory,
      collected:   collected,
      isEnded:     isEnded,
      isCompleted: isCompleted
    });
    // Primary: window.name — 100% reliable for same-tab cross-page persistence
    try { window.name = payload; } catch(e) {}
    // Backup: localStorage
    try { localStorage.setItem(SESSION_KEY, payload); } catch(e) {}
  }

  /** Save window open/closed state */
  function saveOpenState(open) {
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch(e) {}
  }

  /** Clear session from all stores (call when chat truly ends) */
  function clearSession() {
    try { window.name = ''; } catch(e) {}
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(OPEN_KEY); } catch(e) {}
  }

  /** Read session from window.name first, localStorage as fallback */
  function readSession() {
    // Try window.name first
    try {
      if (window.name && window.name.length > 10) {
        const d = JSON.parse(window.name);
        if (d && d._acb && Array.isArray(d.history) && d.history.length > 0) return d;
      }
    } catch(e) {}
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.history) && d.history.length > 0) return d;
      }
    } catch(e) {}
    return null;
  }

  // ══════════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════════
  const css = `
    #acb-launcher,#acb-pulse,#acb-badge,#acb-window {
      position:fixed !important; z-index:2147483647 !important;
    }
    #acb-launcher {
      bottom:24px !important; left:24px !important;
      width:58px; height:58px; border-radius:50%;
      background:linear-gradient(135deg,#1a5fa8,#2979b8);
      box-shadow:0 4px 24px rgba(41,121,184,.6);
      border:none; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:transform .25s, box-shadow .25s;
    }
    #acb-launcher:hover { transform:scale(1.1); box-shadow:0 8px 32px rgba(41,121,184,.7); }
    #acb-launcher .ico-close  { display:none; }
    #acb-launcher.open .ico-robot { display:none; }
    #acb-launcher.open .ico-close { display:flex !important; }

    #acb-badge {
      bottom:68px !important; left:50px !important;
      background:#ef4444; color:#fff; font-size:.6rem; font-weight:800;
      width:18px; height:18px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      animation:acbBadge .4s cubic-bezier(.34,1.56,.64,1) both;
      pointer-events:none;
    }
    @keyframes acbBadge { from{transform:scale(0)} to{transform:scale(1)} }

    #acb-pulse {
      bottom:24px !important; left:24px !important;
      width:58px; height:58px; border-radius:50%;
      background:rgba(79,168,232,.22);
      animation:acbRing 2.5s ease-out infinite; pointer-events:none;
    }
    @keyframes acbRing {
      0%  { transform:scale(.94); opacity:.7; }
      70% { transform:scale(1.55); opacity:0; }
      100%{ transform:scale(.94); opacity:0; }
    }

    #acb-window {
      bottom:94px !important; left:24px !important;
      width:360px; max-height:560px;
      background:#071e38; border:1px solid rgba(79,168,232,.2);
      border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.6);
      display:flex; flex-direction:column; overflow:hidden;
      transform:translateY(16px) scale(.96); opacity:0; pointer-events:none;
      transition:transform .3s cubic-bezier(.34,1.56,.64,1), opacity .22s;
      font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #acb-window.open {
      transform:none !important; opacity:1 !important; pointer-events:all !important;
    }

    /* Header */
    #acb-head {
      background:linear-gradient(135deg,#0c2945,#1a3a5c);
      padding:13px 16px; display:flex; align-items:center; gap:10px;
      border-bottom:1px solid rgba(79,168,232,.14); flex-shrink:0;
    }
    .acb-hav {
      width:36px; height:36px; border-radius:50%;
      background:linear-gradient(135deg,#3a8fc7,#2979b8);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .acb-hname { color:#fff; font-weight:700; font-size:.9rem; letter-spacing:-.01em; }
    .acb-hsub  { color:rgba(255,255,255,.5); font-size:.7rem; display:flex; align-items:center; gap:4px; margin-top:2px; }
    .acb-dot   { width:7px; height:7px; border-radius:50%; background:#34d399; animation:acbDotPulse 2s ease-in-out infinite; }
    @keyframes acbDotPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    /* Progress chips */
    #acb-chips {
      padding:7px 14px; display:flex; flex-wrap:wrap; gap:5px;
      border-bottom:1px solid rgba(79,168,232,.08); flex-shrink:0;
      background:rgba(255,255,255,.02);
    }
    .acb-chip {
      font-size:.62rem; font-weight:600; padding:2px 8px; border-radius:20px;
      border:1px solid rgba(79,168,232,.18); color:rgba(255,255,255,.35);
      letter-spacing:.02em; transition:all .3s;
    }
    .acb-chip.done { background:rgba(52,211,153,.1); border-color:rgba(52,211,153,.4); color:#34d399; }

    /* Messages */
    #acb-msgs {
      flex:1; overflow-y:auto; padding:14px;
      display:flex; flex-direction:column; gap:10px;
      scroll-behavior:smooth; min-height:0;
    }
    #acb-msgs::-webkit-scrollbar { width:3px; }
    #acb-msgs::-webkit-scrollbar-thumb { background:rgba(79,168,232,.2); border-radius:2px; }

    .acb-row { display:flex; align-items:flex-end; gap:7px; }
    .acb-row.animated { animation:acbIn .3s cubic-bezier(.34,1.5,.64,1) both; }
    .acb-row.u { flex-direction:row-reverse; }
    @keyframes acbIn { from{opacity:0;transform:translateY(8px) scale(.93)} to{opacity:1;transform:none} }

    .acb-sav {
      width:26px; height:26px; border-radius:50%;
      background:linear-gradient(135deg,#3a8fc7,#2979b8);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .acb-bub {
      max-width:76%; padding:9px 13px; border-radius:16px;
      font-size:.83rem; line-height:1.58; word-break:break-word;
    }
    .acb-bub.b {
      background:rgba(255,255,255,.055); border:1px solid rgba(79,168,232,.15);
      color:rgba(255,255,255,.9); border-radius:4px 16px 16px 16px;
    }
    .acb-bub.u {
      background:linear-gradient(135deg,#1a5fa8,#2979b8);
      color:#fff; border-radius:16px 16px 4px 16px;
    }

    /* Quick-reply options */
    .acb-options { display:flex; flex-wrap:wrap; gap:5px; padding-left:33px; margin-top:2px; }
    .acb-opt {
      font-size:.75rem; font-weight:600; padding:4px 10px; border-radius:20px;
      cursor:pointer; border:1px solid rgba(79,168,232,.35);
      color:#4fa8e8; background:rgba(79,168,232,.06); transition:all .2s;
    }
    .acb-opt:hover { background:rgba(79,168,232,.18); color:#fff; }
    .acb-opt.yes { border-color:rgba(52,211,153,.5); color:#34d399; background:rgba(52,211,153,.06); }
    .acb-opt.yes:hover { background:rgba(52,211,153,.2); }
    .acb-opt.no  { border-color:rgba(239,68,68,.4); color:#f87171; background:rgba(239,68,68,.05); }
    .acb-opt.no:hover { background:rgba(239,68,68,.15); }

    /* Typing indicator */
    .acb-typing-row { display:flex; align-items:flex-end; gap:7px; }
    .acb-typing {
      background:rgba(255,255,255,.055); border:1px solid rgba(79,168,232,.15);
      border-radius:4px 16px 16px 16px; padding:10px 14px;
      display:flex; gap:4px; align-items:center;
    }
    .acb-d { width:6px; height:6px; border-radius:50%; background:rgba(79,168,232,.65); animation:acbD 1.2s ease-in-out infinite; }
    .acb-d:nth-child(2){animation-delay:.2s} .acb-d:nth-child(3){animation-delay:.4s}
    @keyframes acbD { 0%,60%,100%{transform:scale(1);opacity:.35} 30%{transform:scale(1.3);opacity:1} }

    /* Banners */
    #acb-done, #acb-ended {
      display:none; padding:11px 16px; font-size:.78rem;
      font-weight:600; text-align:center; flex-shrink:0;
    }
    #acb-done  { color:#34d399; background:rgba(52,211,153,.08); border-top:1px solid rgba(52,211,153,.2); }
    #acb-ended { color:rgba(255,255,255,.5); background:rgba(255,255,255,.03); border-top:1px solid rgba(255,255,255,.08); }

    /* Input bar */
    #acb-bar {
      padding:11px 13px; border-top:1px solid rgba(79,168,232,.1);
      display:flex; align-items:center; gap:8px;
      background:rgba(0,0,0,.15); flex-shrink:0;
    }
    #acb-inp {
      flex:1; background:rgba(255,255,255,.07); border:1px solid rgba(79,168,232,.22);
      border-radius:12px; padding:9px 13px; color:#fff; font-size:.84rem;
      outline:none; font-family:inherit; transition:border-color .2s;
    }
    #acb-inp::placeholder { color:rgba(255,255,255,.28); }
    #acb-inp:focus { border-color:rgba(79,168,232,.55); }
    #acb-btn {
      width:38px; height:38px; border-radius:11px; flex-shrink:0;
      background:linear-gradient(135deg,#1a5fa8,#2979b8);
      border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:opacity .2s, transform .15s;
    }
    #acb-btn:hover:not(:disabled) { opacity:.85; transform:scale(1.07); }
    #acb-btn:disabled { opacity:.3; cursor:not-allowed; transform:none; }

    @media(max-width:420px){
      #acb-window { width:calc(100vw - 20px) !important; left:10px !important; bottom:84px !important; }
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ══════════════════════════════════════════════════════════════
  // DOM
  // ══════════════════════════════════════════════════════════════
  function mk(tag, id) { const e = document.createElement(tag); if (id) e.id = id; return e; }

  const pulse    = mk('div',    'acb-pulse');
  const badge    = mk('div',    'acb-badge'); badge.textContent = '1';
  const launcher = mk('button', 'acb-launcher');
  launcher.setAttribute('aria-label', 'Chat with AcoBot');
  launcher.innerHTML = `
    <span class="ico-robot" style="display:flex;align-items:center;justify-content:center">${rSvg(26)}</span>
    <span class="ico-close"  style="display:none;align-items:center;justify-content:center">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 4l10 10M14 4L4 14" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    </span>`;

  const win = mk('div', 'acb-window');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'AcoBot AI Assistant');
  win.innerHTML = `
    <div id="acb-head">
      <div class="acb-hav">${rSvg(18)}</div>
      <div style="flex:1">
        <div class="acb-hname">AcoBot</div>
        <div class="acb-hsub"><span class="acb-dot"></span>Online &nbsp;·&nbsp; Acodax Support</div>
      </div>
    </div>
    <div id="acb-chips">
      <span class="acb-chip" data-f="company_name">Company</span>
      <span class="acb-chip" data-f="industry">Industry</span>
      <span class="acb-chip" data-f="email">Email</span>
      <span class="acb-chip" data-f="software">Software</span>
    </div>
    <div id="acb-msgs"></div>
    <div id="acb-done">✓ All set! Our team will reach out to you shortly.</div>
    <div id="acb-ended">Chat ended. Thank you for contacting Acodax!</div>
    <div id="acb-bar">
      <input id="acb-inp" placeholder="Type your message…" maxlength="500" autocomplete="off" disabled/>
      <button id="acb-btn" disabled aria-label="Send">${sendSvg()}</button>
    </div>`;

  document.body.appendChild(pulse);
  document.body.appendChild(badge);
  document.body.appendChild(launcher);
  document.body.appendChild(win);

  const msgsEl  = document.getElementById('acb-msgs');
  const inp     = document.getElementById('acb-inp');
  const btn     = document.getElementById('acb-btn');

  // ── Events ────────────────────────────────────────────────────
  launcher.addEventListener('click', toggle);
  inp.addEventListener('input',   () => { btn.disabled = !inp.value.trim() || isTyping; });
  inp.addEventListener('keydown', e  => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  btn.addEventListener('click', send);

  // ══════════════════════════════════════════════════════════════
  // 2. TOGGLE — save open/closed state to localStorage
  // ══════════════════════════════════════════════════════════════
  function toggle() {
    isOpen = !isOpen;
    launcher.classList.toggle('open', isOpen);
    win.classList.toggle('open', isOpen);
    pulse.style.display = isOpen ? 'none' : '';
    badge.style.display = 'none';
    saveOpenState(isOpen);

    if (!isOpen) return;

    // If previous chat ended/completed, reset and start a new one
    if (isEnded || isCompleted) {
      resetChat();
      return;
    }

    if (!started) {
      started = true;
      greet();
    }

    setTimeout(function() { if (!inp.disabled) inp.focus(); }, 340);
  }

  function resetChat() {
    chatHistory  = [];
    collected    = { company_name:'', industry:'', email:'', software:'' };
    isEnded      = false;
    isCompleted  = false;
    started      = true;
    awaitingEndAck = false;
    clearTimeout(inactivityTmr);
    clearTimeout(autoEndTmr);

    msgsEl.innerHTML = '';
    document.getElementById('acb-done').style.display   = 'none';
    document.getElementById('acb-ended').style.display  = 'none';
    win.querySelectorAll('.acb-chip').forEach(function(c) { c.classList.remove('done'); });
    inp.disabled = false;
    btn.disabled = true;

    clearSession();
    greet();
  }

  // ── Greeting ──────────────────────────────────────────────────
  async function greet() {
    showTyping();
    await wait(900);
    hideTyping();
    renderMsg('b', GREET_MSG, false);
    // Save greeting into history so session persists from the first message
    chatHistory.push({ role: 'assistant', content: JSON.stringify({ reply: GREET_MSG, collected_data: collected, completed: false }) });
    saveSession();
    inp.disabled = false;
    resetInactivity();
  }

  // ══════════════════════════════════════════════════════════════
  // SEND MESSAGE — save session on every send/receive
  // ══════════════════════════════════════════════════════════════
  async function send() {
    const text = inp.value.trim();
    if (!text || isTyping) return;
    inp.value = '';
    btn.disabled = true;
    inp.disabled = true;

    // Handle end-chat acknowledgment
    if (awaitingEndAck) {
      clearTimeout(autoEndTmr);
      awaitingEndAck = false;
      renderMsg('u', esc(text), false);
      if (/^y(es)?$/i.test(text.trim())) {
        endChat('User requested to end chat');
      } else {
        renderMsg('b', "No problem! 😊 I'm here whenever you need me.", false);
        inp.disabled = false;
        resetInactivity();
      }
      return;
    }

    clearTimeout(inactivityTmr);
    clearTimeout(autoEndTmr);

    renderMsg('u', esc(text), false);
    chatHistory.push({ role: 'user', content: text });

    // 1. Save history every time a new message is sent
    saveSession();

    showTyping();
    isTyping = true;

    try {
      const res  = await fetch(ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: chatHistory })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      hideTyping();
      isTyping = false;

      const reply = (data.reply || '').replace(/\n/g, '<br>');
      const bubbleEl = renderMsg('b', reply, false);

      if (data.show_industry_options) showOptions(INDUSTRY_OPTIONS, bubbleEl);

      chatHistory.push({ role: 'assistant', content: JSON.stringify(data) });

      if (data.collected_data) {
        Object.entries(data.collected_data).forEach(([k, v]) => { if (v) collected[k] = v; });
        refreshChips();
      }

      if (data.completed) {
        isCompleted = true;
        document.getElementById('acb-done').style.display = 'block';
        inp.disabled = btn.disabled = true;
        sendChatByEmail('Lead collected — chat completed');
        // Clear session so the next page visit starts a fresh chat
        setTimeout(clearSession, 2000);
        return;
      }

      // 1. Save history every time a new message is received
      saveSession();

      inp.disabled = false;
      btn.disabled = !inp.value.trim();
      inp.focus();
      resetInactivity();

    } catch(e) {
      hideTyping();
      isTyping = false;
      renderMsg('b', "Sorry, I'm having a connection issue. Please try again!", false);
      inp.disabled = false;
      saveSession();
    }
  }

  // ── Industry quick-reply options ──────────────────────────────
  function showOptions(options, afterEl) {
    const wrap = document.createElement('div');
    wrap.className = 'acb-options';
    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'acb-opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        wrap.remove();
        inp.value = opt;
        send();
      });
      wrap.appendChild(b);
    });
    if (afterEl && afterEl.parentElement) afterEl.parentElement.after(wrap);
    else msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // ── Inactivity ────────────────────────────────────────────────
  function resetInactivity() {
    clearTimeout(inactivityTmr);
    clearTimeout(autoEndTmr);
    inactivityTmr = setTimeout(askStillThere, INACTIVITY_MS);
  }

  function askStillThere() {
    awaitingEndAck = true;
    inp.disabled = btn.disabled = true;

    const bubble = renderMsg('b', "Are you still there? Would you like to end the chat?", false);
    const wrap   = document.createElement('div');
    wrap.className = 'acb-options';

    const yBtn = document.createElement('button');
    yBtn.className = 'acb-opt yes'; yBtn.textContent = '✓ Yes, end chat';
    yBtn.addEventListener('click', () => { clearTimeout(autoEndTmr); awaitingEndAck = false; wrap.remove(); endChat('User clicked "End chat"'); });

    const nBtn = document.createElement('button');
    nBtn.className = 'acb-opt no'; nBtn.textContent = '✗ No, continue';
    nBtn.addEventListener('click', () => {
      clearTimeout(autoEndTmr); awaitingEndAck = false; wrap.remove();
      renderMsg('b', "Great! 😊 Feel free to continue whenever you're ready.", false);
      inp.disabled = false; resetInactivity();
    });

    wrap.appendChild(yBtn); wrap.appendChild(nBtn);
    if (bubble && bubble.parentElement) bubble.parentElement.after(wrap);
    else msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    autoEndTmr = setTimeout(() => {
      if (!awaitingEndAck) return;
      awaitingEndAck = false; wrap.remove();
      endChat('Auto-ended due to inactivity');
    }, AUTO_END_MS);
  }

  // ── End chat ──────────────────────────────────────────────────
  function endChat(reason) {
    clearTimeout(inactivityTmr); clearTimeout(autoEndTmr);
    isEnded = true;
    inp.disabled = btn.disabled = true;
    renderMsg('b', "Thank you for chatting with us! 🙏 Our team will review your details and get back to you soon. Have a great day!", false);
    setTimeout(() => {
      document.getElementById('acb-ended').style.display = 'block';
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }, 600);
    sendChatByEmail(reason);
    // Clear session so the next page visit starts a fresh chat
    setTimeout(clearSession, 2000);
  }

  function sendChatByEmail(reason) {
    fetch(ENDPOINT + '?action=send_email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: chatHistory, collected, reason })
    }).catch(() => {});
  }

  // ── Render a message bubble ───────────────────────────────────
  function renderMsg(role, html, restore) {
    const row = document.createElement('div');
    row.className = 'acb-row' + (role === 'u' ? ' u' : '') + (restore ? '' : ' animated');
    if (role === 'b') {
      row.innerHTML = `<div class="acb-sav">${rSvg(12)}</div><div class="acb-bub b">${html}</div>`;
    } else {
      row.innerHTML = `<div class="acb-bub u">${html}</div>`;
    }
    msgsEl.appendChild(row);
    if (!restore) msgsEl.scrollTop = msgsEl.scrollHeight;
    return role === 'b' ? row.querySelector('.acb-bub') : null;
  }

  function showTyping() {
    if (msgsEl.querySelector('.acb-typing-row')) return;
    const t = document.createElement('div');
    t.className = 'acb-typing-row';
    t.innerHTML = `<div class="acb-sav">${rSvg(12)}</div>
      <div class="acb-typing"><div class="acb-d"></div><div class="acb-d"></div><div class="acb-d"></div></div>`;
    msgsEl.appendChild(t);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function hideTyping() { msgsEl.querySelector('.acb-typing-row')?.remove(); }

  function refreshChips() {
    win.querySelectorAll('.acb-chip').forEach(c => {
      if (collected[c.dataset.f]) c.classList.add('done');
    });
  }

  // ── Utilities ────────────────────────────────────────────────
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function esc(s)   { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function rSvg(sz) {
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="8" width="18" height="13" rx="3" fill="white" opacity=".92"/>
      <rect x="7" y="12" width="3" height="3" rx="1" fill="#1a5fa8"/>
      <rect x="14" y="12" width="3" height="3" rx="1" fill="#1a5fa8"/>
      <path d="M9 18h6" stroke="#1a5fa8" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 5v3" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
      <circle cx="12" cy="4.5" r="1.5" fill="white" opacity=".85"/>
    </svg>`;
  }

  function sendSvg() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 2L7 9M14 2L10 14L7 9L2 6L14 2Z" stroke="white" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  // ══════════════════════════════════════════════════════════════
  // SESSION INIT — inline, runs here after every variable exists
  // ══════════════════════════════════════════════════════════════
  (function restoreSession() {
    const d = readSession();
    if (!d) return;

    // Restore state
    chatHistory = d.history;
    collected   = Object.assign({ company_name:'', industry:'', email:'', software:'' }, d.collected || {});
    isEnded     = !!d.isEnded;
    isCompleted = !!d.isCompleted;
    started     = true;

    // Rebuild messages (no animation)
    msgsEl.innerHTML = '';
    chatHistory.forEach(function(m) {
      if (m.role === 'user') {
        renderMsg('u', m.content, true);
      } else {
        var text = m.content;
        try { var p = JSON.parse(text); if (p && p.reply) text = p.reply; } catch(ex) {}
        renderMsg('b', text.replace(/\n/g, '<br>'), true);
      }
    });

    refreshChips();

    if (isCompleted) {
      document.getElementById('acb-done').style.display = 'block';
      inp.disabled = btn.disabled = true;
    } else if (isEnded) {
      document.getElementById('acb-ended').style.display = 'block';
      inp.disabled = btn.disabled = true;
    } else {
      inp.disabled = false;
    }

    // Scroll to bottom after restoring
    requestAnimationFrame(function() { msgsEl.scrollTop = msgsEl.scrollHeight; });

    // Always keep window open across page navigations
    isOpen = true;
    launcher.classList.add('open');
    win.classList.add('open');
    pulse.style.display = 'none';
    badge.style.display = 'none';
    saveOpenState(true);
    if (!isEnded && !isCompleted) {
      resetInactivity();
      setTimeout(function() { inp.focus(); }, 300);
    }

    console.log('[AcoBot] restore complete. Window forced open.');
  })();

})();
