/* script.js - unified client logic for index / public / private pages */
let username = localStorage.getItem("username");

(() => {
  // common state
  const state = {
    username: null,
    publicWS: null,
    privateWS: null,
    previewSocket: null
  };

  // helpers
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const api = path => `/api${path}`;

  function maskPassword(p) {
    if (!p) return '***';
    const arr = p.split('');
    if (arr.length >= 2) arr[1] = '*';   // hide 2nd
    if (arr.length >= 3) arr[2] = '*';   // hide 3rd
    return arr.join('');
  }

  // ------------------ Session Management ------------------ //
  function initUserSession() {
    let data = JSON.parse(localStorage.getItem("chat_user") || "null");

    if (!data) {
      // First-time user
      let u = prompt("Enter username:");
      while (!u) u = prompt("Username required:");

      let pass = prompt("Set a password (min 4 characters):");
      while (!pass || pass.length < 4) pass = prompt("Password must be at least 4 characters:");

      data = { username: u.trim(), password: pass.trim(), lastActive: Date.now() };
      localStorage.setItem("chat_user", JSON.stringify(data));
      alert(`Welcome ${data.username}! Your account has been created.`);
    } else {
      // Returning user, check 30 mins expiry
      const THIRTY_MIN = 30 * 60 * 1000;
      if (Date.now() - data.lastActive > THIRTY_MIN) {
        showSessionPopup(data);
        return;
      }
    }

    // Always update last active
    data.lastActive = Date.now();
    localStorage.setItem("chat_user", JSON.stringify(data));
    username = data.username;
    renderUsername();
  }

  function showSessionPopup(data) {
    const choice = confirm(
      `Your current username is "${data.username}".\n\nClick OK to continue (enter password).\nClick Cancel for new username & reload.`
    );
    if (choice) {
      const pass = prompt("Enter your password:");
      if (pass === data.password) {
        alert("Welcome back " + data.username);
        data.lastActive = Date.now();
        localStorage.setItem("chat_user", JSON.stringify(data));
        username = data.username;
        renderUsername();
      } else {
        alert("Wrong password. Starting new session.");
        localStorage.removeItem("chat_user");
        location.reload();
      }
    } else {
      // New user flow
      localStorage.removeItem("chat_user");
      alert("Session cleared. Please reload.");
      location.reload(true); // full reload (clear cached CSS/JS updates)
    }
  }


  function ensureUsername() {
    if (!state.username) {
      let u = localStorage.getItem('chat_username') || prompt("Enter username:");
      while (!u) u = prompt("Username required:");
      state.username = u.trim();
      localStorage.setItem('chat_username', state.username);
    }
    return state.username;
  }

  /* ------------------ TOKENS: server-side sync ------------------ */
  async function fetchTokens() {
    try {
      const res = await fetch(api('/tokens'));
      const data = await res.json();
      return data.tokens || [];
    } catch (e) {
      console.error("Failed to fetch tokens", e);
      return [];
    }
  }

  async function createToken() {
    const res = await fetch(api('/create_token'), { method: 'POST' });
    const data = await res.json();
    return data.token;
  }

  async function deleteToken(token) {
    const res = await fetch(`/api/tokens/${encodeURIComponent(token)}`, { method: 'DELETE' });
    if (res.ok) return true;
    console.warn("Delete failed", await res.text());
    return false;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text);
    const tmp = document.createElement('textarea'); tmp.value = text; document.body.appendChild(tmp); tmp.select();
    document.execCommand('copy'); tmp.remove();
  }

  /* ------------------ RENDER token modal contents ------------------ */
  async function renderTokenModal() {
    const listEl = $('#tokenList');
    if (!listEl) return;
    listEl.innerHTML = '';
    const tokens = await fetchTokens();
    if (!tokens.length) {
      const p = document.createElement('div'); p.className = 'muted'; p.textContent = 'No tokens yet.';
      listEl.appendChild(p);
      return;
    }
    tokens.forEach((t, i) => {
      const row = document.createElement('div'); row.className = 'token-row';
      const idx = document.createElement('div'); idx.className = 'token-index'; idx.textContent = String(i + 1);
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = t;

      // stable color assignment based on token hash
      const CLASSIC_COLORS = [
        '#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#8E9AAF',
        '#FF9F1C', '#2EC4B6', '#1B9AAA', '#C77DFF', '#64F3AC'
      ];

      // simple hash function: sum char codes
      let hash = 0;
      for (let i = 0; i < t.length; i++) {
        hash = (hash + t.charCodeAt(i)) % CLASSIC_COLORS.length;
      }

      const color = CLASSIC_COLORS[hash];
      chip.style.setProperty('--token-color', color);

      const btnCopy = document.createElement('button'); btnCopy.className = 'icon-btn'; btnCopy.textContent = 'Copy';
      const btnJoin = document.createElement('button'); btnJoin.className = 'icon-btn'; btnJoin.textContent = 'Join';
      // const btnDel = document.createElement('button'); btnDel.className = 'icon-btn'; btnDel.textContent = '✕';
      const btnDel = document.createElement('button');
      btnDel.className = 'icon-btn close';
      btnDel.textContent = '✕';

      // assign a random red/pink shade
      const DELETE_COLORS = [
        '#FF4C4C', // bright red
        '#E63946', // crimson
        '#FF5E78', // reddish pink
        '#D72638', // dark scarlet
        '#C9184A', // dark pink-red
        '#B00020'  // material dark red
      ];
      const delColor = DELETE_COLORS[Math.floor(Math.random() * DELETE_COLORS.length)];
      btnDel.style.color = delColor;


      btnCopy.onclick = () => { copyToClipboard(t); alert('Copied: ' + t); };
      btnJoin.onclick = () => { closeTokenModal(); joinPrivateByToken(t); };
      btnDel.onclick = async () => {
        if (!confirm(`Delete token ${t}? This will remove it for all devices.`)) return;
        const ok = await deleteToken(t);
        if (ok) { alert('Deleted'); renderTokenModal(); } else alert('Delete failed');
      };

      row.append(idx, chip, btnCopy, btnJoin, btnDel);
      listEl.appendChild(row);
    });
  }

  function openTokenModal() {
    const bg = $('#tokenModalBg'); if (!bg) return;
    bg.classList.add('show');
    renderTokenModal();
  }
  function closeTokenModal() {
    const bg = $('#tokenModalBg'); if (!bg) return;
    bg.classList.remove('show');
  }

  // wire token modal controls (exists on pages)
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t && t.id === 'btnGenerate') {
      createToken().then(tok => {
        alert('Created token: ' + tok);
        renderTokenModal();
      }).catch(console.error);
    }
    if (t && t.id === 'btnRefreshTokens') { renderTokenModal(); }
  });

  /* ------------------ Landing page behavior ------------------ */
  if (document.getElementById('btnCreate')) {
    // buttons present on index.html
    $('#btnCreate').addEventListener('click', (e) => { openTokenModal(); });
    $('#btnOpenTokens')?.addEventListener('click', (e) => { openTokenModal(); });
    $('#btnJoin').addEventListener('click', (e) => { openTokenModal(); /* allow join via modal "Join" buttons or via input */ });
    $('#btnPublic').addEventListener('click', () => { location.href = 'public.html'; });
    $('#btnJoinPublic').addEventListener('click', () => { location.href = 'public.html'; });
    $('#btnJoinByToken').addEventListener('click', () => {
      const tok = $('#joinToken').value.trim();
      if (!tok) { alert('Enter token'); return; }
      joinPrivateByToken(tok);
    });

    // preview websocket for landing page
    (function previewSocket() {
      const anon = 'preview-' + Math.random().toString(16).slice(2, 6);
      const socket = new WebSocket(`ws://${location.host}/ws/public/${anon}`);
      state.previewSocket = socket;
      socket.onmessage = (ev) => {
        try {
          const p = JSON.parse(ev.data);
          if (p.type === 'chat') {
            pushPreview(p);
          }
        } catch (e) { /* ignore */ }
      };
      window.addEventListener('beforeunload', () => socket.close());
    })();

    // preview storage and render
    const previewBuffer = [];
    function pushPreview(p) {
      previewBuffer.push(`[${p.ts}] ${p.from}: ${p.text}`);
      if (previewBuffer.length > 2) previewBuffer.shift();
      const box = $('#preview');
      box.innerHTML = '';
      previewBuffer.forEach(line => {
        const d = document.createElement('div'); d.className = 'preview-msg'; d.textContent = line;
        box.appendChild(d);
      });
    }
  }

  /* ------------------ Public chat page ------------------ */
  if (document.getElementById('messages')) {
    ensureUsername();
    setupPublic();
  }

  function askUsername() {
    let data = JSON.parse(localStorage.getItem("chat_user") || "null");

    if (!data) {
      // If somehow missing, fallback to normal init
      initUserSession();
      return;
    }

    // Mask password: show only first & last char
    let masked = maskPassword(data.password);

    const choice = confirm(
      `Your current username is: ${data.username}\nYour current password is: ${masked}\n\nClick OK to set another username, or Cancel to keep using current.`
    );

    if (choice) {
      // User wants a new username/password
      let u = prompt("Enter new username:");
      if (!u) return; // if cancel, just return without changes

      let pass = prompt("Set a new password (min 4 characters):");
      if (!pass || pass.length < 4) {
        alert("Password must be at least 4 characters. Keeping old account.");
        return;
      }

      const newData = { username: u.trim(), password: pass.trim(), lastActive: Date.now() };
      localStorage.setItem("chat_user", JSON.stringify(newData));
      username = newData.username;
      renderUsername();
      alert(`Account updated! New username: ${newData.username}`);
    }
    // If Cancel → do nothing
  }


  function renderUsername() {
    document.getElementById("username-display").innerText = username;
  }

  document.addEventListener("DOMContentLoaded", () => {
    initUserSession();   // NEW session logic

    // allow click to change
    document.getElementById("username-display").onclick = askUsername;
  });

  function setupPublic() {
    // token modal wiring
    $('#btnGenerate')?.addEventListener('click', async () => {
      const tok = await createToken();
      alert('Created token: ' + tok);
      renderTokenModal();
    });
    $('#closeModal')?.addEventListener('click', closeTokenModal);
    $('#btnRefreshTokens')?.addEventListener('click', renderTokenModal);
    $('#openJoinPrivate')?.addEventListener('click', () => openTokenModal());

    // join private via request button
    $('#btnRequestPrivate')?.addEventListener('click', async () => {
      const user = prompt(`Request private chat with which username?\nOnline: (click a name on the list)`);
      if (!user) return;
      const tok = prompt('Enter token to use for private chat (leave blank to auto generate):') || undefined;
      state.publicWS.send(JSON.stringify({ type: 'private_request', to: user, token: tok }));
      alert('Request sent to ' + user);
    });

    // public websocket
    state.publicWS = new WebSocket(`ws://${location.host}/ws/public/${encodeURIComponent(ensureUsername())}`);
    state.publicWS.onopen = () => { state.publicWS.send(JSON.stringify({ type: 'who' })); };
    state.publicWS.onmessage = (ev) => {
      const payload = JSON.parse(ev.data);
      handlePublicPayload(payload);
    };
    state.publicWS.onclose = () => {
      const el = document.getElementById('messages');
      if (el) { el.appendChild(renderSystemNode('Disconnected from public.')); }
    };

    // send handlers
    $('#sendBtn').addEventListener('click', sendPublicMsg);
    $('#msgInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPublicMsg(); });

    // online users click handler (delegation)
    document.getElementById('onlineUsers')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-user]');
      if (!btn) return;
      const user = btn.dataset.user;
      if (!confirm(`Send private chat request to ${user}?`)) return;
      const tok = prompt('Enter token to use (blank = server auto-generate):') || undefined;
      state.publicWS.send(JSON.stringify({ type: 'private_request', to: user, token: tok }));
      alert('Request sent to ' + user);
    });

    // token modal close wiring
    $('#closeModal')?.addEventListener('click', closeTokenModal);
    $('#btnGenerate')?.addEventListener('click', async () => {
      const t = await createToken();
      alert('Created token: ' + t);
      renderTokenModal();
    });
    renderTokenModal();
  }

  function sendPublicMsg() {
    const v = $('#msgInput').value.trim();
    if (!v || !state.publicWS) return;
    state.publicWS.send(JSON.stringify({ type: 'chat', text: v }));
    $('#msgInput').value = '';
  }

  function handlePublicPayload(p) {
    if (p.type === 'chat') {
      appendMessage('messages', p);
      // also update preview if on index
      const previewBox = $('#preview');
      if (previewBox) {
        // reuse same preview rendering by pushing to preview socket (not stored here)
        const ev = new Event('newPreview'); previewBox.dispatchEvent(ev);
      }
    } else if (p.type === 'system') {
      document.getElementById('messages')?.appendChild(renderSystemNode(p.message));
    } else if (p.type === 'users') {
      renderOnlineUsers(p.users);
    } else if (p.type === 'private_invite') {
      // prompt accept / deny
      const ok = confirm(`${p.from} invites you to a private chat.\nToken: ${p.token}\nAccept?`);
      if (ok) {
        // open private page with token
        location.href = `private.html?token=${p.token}`;
        // notify back
        state.publicWS.send(JSON.stringify({ type: 'private_accept', to: p.from, token: p.token }));
      } else {
        state.publicWS.send(JSON.stringify({ type: 'private_deny', to: p.from, token: p.token }));
      }
    } else if (p.type === 'private_accept') {
      alert(`${p.from} accepted your private request. Opening private chat.`);
      location.href = `private.html?token=${p.token}`;
    } else if (p.type === 'private_deny') {
      alert(`${p.from} denied your private request.`);
    }
  }

  function renderOnlineUsers(users) {
    const wrap = document.getElementById('onlineUsers');
    if (!wrap) return;
    wrap.innerHTML = '';
    users.forEach(u => {
      const row = document.createElement('div'); row.className = 'user-pill';
      const name = document.createElement('div'); name.textContent = u;
      const btn = document.createElement('button'); btn.className = 'glass-btn small'; btn.textContent = 'Request';
      btn.setAttribute('data-user', u);
      row.appendChild(name); row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  function renderSystemNode(text) {
    const d = document.createElement('div'); d.className = 'muted'; d.textContent = text;
    return d;
  }

  function appendMessage(containerId, p) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const node = document.createElement('div');
    node.className = 'msg-bubble ' + (p.from === state.username ? 'msg-self' : 'msg-other');
    node.innerHTML = `<div>${escapeHtml(p.text)}</div><div class="msg-meta">${escapeHtml(p.from)} • ${p.ts}</div>`;
    container.appendChild(node);
    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  /* ------------------ Private page logic ------------------ */
  if (location.pathname.endsWith('private.html')) {
    ensureUsername();
    // read token param
    const url = new URL(location.href);
    const token = url.searchParams.get('token');
    // tabs container
    const tabs = $('#tabs');
    const active = token ? token : null;

    // connect private socket
    function openPrivate(tokenToOpen) {
      // if token present, open WS to that room
      if (!tokenToOpen) return;
      // close existing
      if (state.privateWS) state.privateWS.close();
      state.privateWS = new WebSocket(`ws://${location.host}/ws/${encodeURIComponent(tokenToOpen)}/${encodeURIComponent(state.username)}`);
      state.privateWS.onmessage = (ev) => {
        const p = JSON.parse(ev.data);
        if (p.type === 'chat') appendMessage('privateMessages', p);
        else if (p.type === 'system') document.getElementById('privateMessages')?.appendChild(renderSystemNode(p.message));
      };
      state.privateWS.onopen = () => {
        // create tab if not exists
        createTab(tokenToOpen);
      };
    }

    // create tab UI
    function createTab(tkn) {
      // add button if not exists
      if (document.querySelector(`button[data-tab='${tkn}']`)) return;
      const b = document.createElement('button'); b.className = 'tab-btn'; b.textContent = tkn; b.dataset.tab = tkn;
      b.onclick = () => {
        // switch private connection to tab token
        openPrivate(b.dataset.tab);
        // set active styling
        $$('.tab-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      };
      $('#tabs').appendChild(b);
      // activate it
      b.click();
    }

    // if token passed in URL, open that token
    if (token) createTab(token);

    // send messages
    $('#privateSend').addEventListener('click', () => {
      const val = $('#privateInput').value.trim(); if (!val || !state.privateWS) return;
      state.privateWS.send(JSON.stringify({ type: 'chat', text: val }));
      $('#privateInput').value = '';
    });
    $('#privateInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#privateSend').click(); });

    // allow token modal here too
    $('#btnGenerate')?.addEventListener('click', async () => {
      const t = await createToken(); alert('Created: ' + t); renderTokenModal();
    });
    $('#closeModal')?.addEventListener('click', closeTokenModal);
    renderTokenModal();
  }

  /* ------------------ Helper: join private from anywhere ------------------ */
  function joinPrivateByToken(tok) {
    // go to private view, open specified token
    location.href = `private.html?token=${encodeURIComponent(tok)}`;
  }

  // expose some functions to html inline actions
  window.joinPrivateByToken = joinPrivateByToken;
  window.openTokenModal = openTokenModal;
  window.closeTokenModal = closeTokenModal;

})();
