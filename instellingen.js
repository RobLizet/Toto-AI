// ═══════════════════════════════════════════════════════
// INSTELLINGEN SCREEN
// ═══════════════════════════════════════════════════════

function renderInstellingen() {
  const el = document.getElementById('screen-instellingen');
  if (!el) return;

  el.innerHTML = `
    <div class="app">
      <div class="topbar">
        <div>
          <div class="topbar-logo">TOTO AI</div>
          <div class="made-by">Instellingen</div>
        </div>
        <div id="authUserInfo" style="margin-left:auto;font-family:monospace;font-size:.52rem;color:var(--sub);text-align:right;max-width:200px;"></div>
      </div>

      <div id="firebaseStatus" style="display:none;font-family:monospace;font-size:.52rem;padding:.35rem .75rem;border-radius:10px;margin-bottom:.75rem;background:rgba(22,163,74,.08);color:#16a34a;"></div>

      <!-- API KEYS -->
      <div class="settings-section">
        <div class="settings-section-title">🔑 API KEYS</div>
        <div id="apiKeysStatus" style="font-family:monospace;font-size:.55rem;margin-bottom:.75rem;line-height:1.6;"></div>

        <div class="settings-field">
          <label class="settings-label">Anthropic API Key</label>
          <div style="display:flex;gap:.4rem;">
            <input class="settings-input" id="settAnthropicKey" type="password" placeholder="sk-ant-...">
            <button class="key-vis-btn" onclick="toggleKeyVisibility('settAnthropicKey',this)">👁</button>
          </div>
          <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">Voor AI-analyse · console.anthropic.com</div>
        </div>

        <div class="settings-field">
          <label class="settings-label">API-Football Key</label>
          <div style="display:flex;gap:.4rem;">
            <input class="settings-input" id="settFootballKey" type="password" placeholder="Optioneel (server heeft eigen key)">
            <button class="key-vis-btn" onclick="toggleKeyVisibility('settFootballKey',this)">👁</button>
          </div>
          <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">Jouw eigen Football API key (rapidapi.com)</div>
        </div>

        <div class="settings-field">
          <label class="settings-label">FootballData API Key (FD)</label>
          <div style="display:flex;gap:.4rem;">
            <input class="settings-input" id="settFdKey" type="password" placeholder="Optioneel">
            <button class="key-vis-btn" onclick="toggleKeyVisibility('settFdKey',this)">👁</button>
          </div>
          <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">football-data.org voor gratis quotes</div>
        </div>
      </div>

      <!-- STANDAARD INSTELLINGEN -->
      <div class="settings-section">
        <div class="settings-section-title">⚙️ STANDAARD INSTELLINGEN</div>

        <div class="settings-field">
          <label class="settings-label">Startbalans (€)</label>
          <input class="settings-input" id="settStartBalance" type="number" min="0" step="50">
          <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">Huidig saldo: <span id="currentBalanceDisplay">—</span></div>
        </div>

        <div class="settings-field">
          <label class="settings-label">Standaard inzet (€)</label>
          <input class="settings-input" id="settDefaultBet" type="number" min="1" step="5">
        </div>

        <div class="settings-field">
          <label class="settings-label">Standaard bookmaker</label>
          <select class="settings-input" id="settDefaultBookmaker">
            <option>Jacks</option>
            <option>Unibet</option>
            <option>BetCity</option>
            <option>Bet365</option>
            <option>Toto</option>
            <option>Napoleon Sports</option>
            <option>Andere</option>
          </select>
        </div>

        <div class="settings-field">
          <label class="settings-label">Standaard competitie</label>
          <select class="settings-input" id="settDefaultComp">
            <option value="eredivisie">🇳🇱 Eredivisie</option>
            <option value="premier">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</option>
            <option value="bundesliga">🇩🇪 Bundesliga</option>
            <option value="laliga">🇪🇸 La Liga</option>
            <option value="seriea">🇮🇹 Serie A</option>
            <option value="ligue1">🇫🇷 Ligue 1</option>
            <option value="champions">⭐ Champions League</option>
            <option value="kkd">🇳🇱 Keuken Kampioen</option>
            <option value="jupiler">🇧🇪 Jupiler Pro</option>
          </select>
        </div>
      </div>

      <!-- TRIPLE LOCK INSTELLINGEN -->
      <div class="settings-section">
        <div class="settings-section-title">🏆 TRIPLE LOCK CRITERIA</div>
        <div style="font-family:monospace;font-size:.52rem;color:var(--sub);margin-bottom:.75rem;line-height:1.5;">
          Picks die aan alle criteria voldoen worden als Triple Lock gemarkeerd.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
          <div class="settings-field">
            <label class="settings-label">Min. quote</label>
            <input class="settings-input" id="tripleMinOdds" type="number" step="0.1" min="1.2">
          </div>
          <div class="settings-field">
            <label class="settings-label">Min. value %</label>
            <input class="settings-input" id="tripleMinValue" type="number" step="1" min="1">
          </div>
          <div class="settings-field">
            <label class="settings-label">Min. conf</label>
            <input class="settings-input" id="tripleMinConf" type="number" min="1" max="10">
          </div>
        </div>
      </div>

      <!-- NOTIFICATIES -->
      <div class="settings-section">
        <div class="settings-section-title">🔔 PUSH NOTIFICATIES</div>

        <div class="settings-row">
          <div>
            <div class="settings-label">Notificaties</div>
            <div style="font-family:monospace;font-size:.47rem;color:var(--sub);">Value alerts en wedstrijd herinneringen</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;">
            <button id="notifToggleBtn" class="toggle-btn" onclick="toggleNotifications()">Inschakelen</button>
            <div id="notifStatusBadge" style="font-family:monospace;font-size:.45rem;padding:2px 6px;border-radius:6px;"></div>
          </div>
        </div>

        <div id="notifEnabledSection">
          <div class="settings-field" style="margin-top:.5rem;">
            <label class="settings-label">Value drempel (%)</label>
            <input class="settings-input" id="notifThreshold" type="number" min="5" max="50" step="5">
            <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">Minimale value % voor push alert</div>
          </div>

          <div class="settings-field">
            <label class="settings-label">VAPID Public Key (optioneel)</label>
            <input class="settings-input" id="vapidPublicKey" type="text" placeholder="BG...">
          </div>

          <div style="display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap;">
            <button class="small-action-btn" onclick="testNotification()">🔔 Test</button>
            <button class="small-action-btn" onclick="debugPush()">🐛 Debug</button>
            <button class="small-action-btn" onclick="toggleAutoValueAlerts()">⚡ Auto alerts</button>
          </div>
        </div>
      </div>


      <!-- AUTOMATISCHE SCAN -->
      <div class="settings-section">
        <div class="settings-section-title">⏱️ AUTOMATISCHE SCAN</div>

        <div class="settings-row">
          <div>
            <div class="settings-label">Auto scan</div>
            <div style="font-family:monospace;font-size:.47rem;color:var(--sub);">Scant dagelijks op value tussen ingestelde tijden</div>
          </div>
          <button id="autoScanToggleBtn" class="toggle-btn"
            onclick="toggleAutoScan()">
            ${state.settings.autoScan ? 'Uitzetten' : 'Inschakelen'}
          </button>
        </div>

        <div class="settings-field" style="margin-top:.5rem;">
          <label class="settings-label">Scanvenster van</label>
          <input class="settings-input" id="scanWindowFrom" type="number"
            min="0" max="23" step="1"
            value="${state.settings.scanWindowFrom ?? 14}"
            onchange="state.settings.scanWindowFrom=parseInt(this.value);saveState()">
          <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">Uur (0–23)</div>
        </div>

        <div class="settings-field">
          <label class="settings-label">Scanvenster tot</label>
          <input class="settings-input" id="scanWindowTo" type="number"
            min="0" max="23" step="1"
            value="${state.settings.scanWindowTo ?? 18}"
            onchange="state.settings.scanWindowTo=parseInt(this.value);saveState()">
          <div style="font-family:monospace;font-size:.47rem;color:var(--sub);margin-top:2px;">Uur (0–23)</div>
        </div>

        <div class="settings-field">
          <label class="settings-label">Vandaag overslaan</label>
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.2rem;">
            <button class="small-action-btn" onclick="skipScanToday()">⏭ Sla vandaag over</button>
            <span id="skipScanStatus" style="font-family:monospace;font-size:.45rem;color:var(--muted);">
              ${state.settings.scanSkipDate === new Date().toDateString() ? '✓ Overgeslagen vandaag' : ''}
            </span>
          </div>
        </div>

        <div style="margin-top:.4rem;display:flex;gap:.4rem;flex-wrap:wrap;">
  <button class="small-action-btn" onclick="startAutoCheckScheduler();showToast('▶ Scheduler gestart')">▶ Start scheduler</button>
  <button class="small-action-btn" style="background:linear-gradient(135deg,rgba(22,163,74,.15),rgba(5,150,105,.1));border-color:rgba(22,163,74,.4);color:#15803d;font-weight:800;" onclick="runManualScan()">⚡ Nu scannen</button>
</div>

      <!-- THEMA -->
      <div class="settings-section">
        <div class="settings-section-title">🎨 THEMA</div>

        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.75rem;">
          <button class="theme-btn" onclick="setTheme('')">🌸 Default</button>
          <button class="theme-btn" onclick="setTheme('dark')">🌑 Dark</button>
          <button class="theme-btn" onclick="setTheme('mint')">🌿 Mint</button>
          <button class="theme-btn" onclick="setTheme('cream')">🍦 Crème</button>
        </div>

        <div class="settings-row">
          <div>
            <div class="settings-label">Auto-dark</div>
            <div style="font-family:monospace;font-size:.47rem;color:var(--sub);">Schakel automatisch naar dark bij nacht</div>
          </div>
          <button id="autoDarkBtn" class="toggle-btn" onclick="toggleAutoDark()">Uit</button>
        </div>
      </div>

      <!-- WALLET BEHEER -->
      <div class="settings-section">
        <div class="settings-section-title">💰 WALLET BEHEER</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          <button class="small-action-btn danger" onclick="confirmResetWallet()">🗑 Wallet wissen</button>
          <button class="small-action-btn" onclick="switchScreen('wallet');setTimeout(()=>setWalletSubTab('tracker'),100)">📒 Naar Tracker</button>
          <button class="small-action-btn" onclick="switchScreen('wallet');setTimeout(()=>setWalletSubTab('backtest'),100)">📊 Naar Backtest</button>
        </div>
      </div>

      <!-- OPSLAAN KNOP -->
      <button class="save-settings-btn" onclick="saveSettings()">💾 OPSLAAN</button>

      <!-- CLOUD BACKUP (Firebase) -->
      <div class="settings-section">
        <div class="settings-section-title">☁️ CLOUD BACKUP</div>
        <div id="fbAutoSyncStatus" style="display:none;font-family:monospace;font-size:.5rem;color:#16a34a;margin-bottom:.5rem;">✅ Auto-sync actief</div>
        <div id="fbBackupInfo" style="font-family:monospace;font-size:.52rem;color:var(--sub);margin-bottom:.75rem;line-height:1.5;">Laden...</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          <button class="small-action-btn" onclick="saveToFirebase().then(()=>showFirebaseStatus('✅ Opgeslagen!','#16a34a')).catch(e=>showFirebaseStatus('⚠ '+e.message,'#dc2626'))">☁️ Opslaan</button>
          <button class="small-action-btn" onclick="restoreFromFirebase()">🔄 Herstellen</button>
        </div>
        <div id="backupStatus" style="display:none;font-family:monospace;font-size:.55rem;padding:.5rem .75rem;border-radius:10px;margin-top:.5rem;"></div>
      </div>

      <!-- LOKALE BACKUP -->
      <div class="settings-section">
        <div class="settings-section-title">📦 LOKALE BACKUP</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          <button class="small-action-btn" onclick="exportBackup()">📥 Exporteer JSON</button>
          <label class="small-action-btn" style="cursor:pointer;">
            📤 Importeer
            <input type="file" accept=".json" onchange="importBackup(event)" style="display:none;">
          </label>
        </div>
      </div>

      <!-- KOSTEN TRACKER -->
      <div class="settings-section">
        <div class="settings-section-title">💸 KOSTEN TRACKER</div>
        <div class="wallet-strip" style="margin-bottom:.75rem;">
          <div class="w-item">
            <div class="w-label">Tokens in</div>
            <div class="val" id="costTokensIn">0</div>
          </div>
          <div class="w-item">
            <div class="w-label">Tokens uit</div>
            <div class="val" id="costTokensOut">0</div>
          </div>
          <div class="w-item">
            <div class="w-label">Kosten</div>
            <div class="val" id="costTotal">$0.000</div>
          </div>
          <div class="w-item">
            <div class="w-label">Calls</div>
            <div class="val" id="costCalls">0</div>
          </div>
        </div>
        <button class="small-action-btn danger" onclick="resetCostCounter()">Reset teller</button>
      </div>

      <!-- ACCOUNT / AUTH -->
      <div class="settings-section">
        <div class="settings-section-title">👤 ACCOUNT</div>
        <div id="authAccountSection">
          <div style="font-family:monospace;font-size:.55rem;color:var(--sub);margin-bottom:.6rem;line-height:1.6;">
            Log in om data te synchroniseren tussen apparaten.
          </div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
            <button class="small-action-btn" onclick="showLoginScreen()">🔐 Inloggen / Registreren</button>
          </div>
        </div>
      </div>

      <!-- APP INFO -->
      <div class="settings-section">
        <div class="settings-section-title">ℹ️ APP INFO</div>
        <div style="font-family:monospace;font-size:.52rem;color:var(--sub);line-height:1.8;">
          <div>TOTO AI <span id='appVersionLabel'></span> · AppsMadeByRobB</div>
          <div>🌐 toto-ai.app</div>
          <div>📧 zweetzakken@gmail.com</div>
          <div style="margin-top:.4rem;font-size:.47rem;color:var(--sub);">
            ⚠️ Uitsluitend voor entertainment en educatie. Geen echt gokadvies.
            Speel verantwoord · 18+ · Verslavingslijn: 0900-1090
          </div>
        </div>
      </div>

    </div>
  `;

  applySettings();
  loadFbBackupInfo();
  updateNotifUI();
  updateCostUI();
}

// ── SETTINGS OPSLAAN / LADEN ─────────────────────────

function saveSettings() {
  state.settings.anthropicKey    = document.getElementById('settAnthropicKey')?.value.trim()||'';
  state.settings.footballKey     = document.getElementById('settFootballKey')?.value.trim()||'';
  state.settings.fdKey           = document.getElementById('settFdKey')?.value.trim()||'';
  state.settings.defaultComp     = document.getElementById('settDefaultComp')?.value||'eredivisie';
  state.settings.startBalance    = parseInt(document.getElementById('settStartBalance')?.value)||500;
  state.settings.defaultBet      = parseInt(document.getElementById('settDefaultBet')?.value)||10;
  state.settings.defaultBookmaker= document.getElementById('settDefaultBookmaker')?.value||'Jacks';
  state.settings.notifThreshold  = parseInt(document.getElementById('notifThreshold')?.value)||20;
  state.settings.tripleMinOdds   = parseFloat(document.getElementById('tripleMinOdds')?.value)||1.6;
  state.settings.tripleMinValue  = parseFloat(document.getElementById('tripleMinValue')?.value)||8;
  state.settings.tripleMinConf   = parseInt(document.getElementById('tripleMinConf')?.value)||7;
  state.settings.vapidPublicKey  = document.getElementById('vapidPublicKey')?.value.trim()||'';

  if (state.settings.anthropicKey) localStorage.setItem('totoai_key_anthropic', state.settings.anthropicKey);
  if (state.settings.footballKey)  localStorage.setItem('totoai_key_football',  state.settings.footballKey);

  saveState(); updateNotifUI();
  showFirebaseStatus('✅ Opgeslagen!','#16a34a');

  const btn = document.querySelector('.save-settings-btn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent='✅ OPGESLAGEN!'; btn.style.background='linear-gradient(135deg,#16a34a,#15803d)';
    setTimeout(()=>{ btn.textContent=orig; btn.style.background=''; },2000);
  }
  saveToFirebase().then(()=>showFirebaseStatus('🔥 Gesynchroniseerd','#16a34a')).catch(()=>{});
}

function applySettings() {
  const _s = (id,val) => { const el=document.getElementById(id); if(el) el.value=val; };
  _s('settAnthropicKey', state.settings.anthropicKey||'');
  _s('settFootballKey',  state.settings.footballKey||'');
  _s('settFdKey',        state.settings.fdKey||'');
  _s('settDefaultComp',  state.settings.defaultComp||'eredivisie');
  _s('settStartBalance', state.settings.startBalance||500);
  _s('settDefaultBet',   state.settings.defaultBet||10);
  _s('betAmount',        state.settings.defaultBet||10);

  const bm = document.getElementById('settDefaultBookmaker');
  if (bm) bm.value = state.settings.defaultBookmaker||'Jacks';

  const bal = document.getElementById('currentBalanceDisplay');
  if (bal) bal.textContent = '€'+(state.wallet.balance||0).toFixed(2).replace('.',',');

  const nt = document.getElementById('notifThreshold');
  if (nt) nt.value = state.settings.notifThreshold||20;

  const vpk = document.getElementById('vapidPublicKey');
  if (vpk) vpk.value = state.settings.vapidPublicKey||'';

  const tmo = document.getElementById('tripleMinOdds');
  if (tmo) tmo.value = state.settings.tripleMinOdds||1.6;
  const tmv = document.getElementById('tripleMinValue');
  if (tmv) tmv.value = state.settings.tripleMinValue||8;
  const tmc = document.getElementById('tripleMinConf');
  if (tmc) tmc.value = state.settings.tripleMinConf||7;

  // API keys status
  const statusEl = document.getElementById('apiKeysStatus');
  if (statusEl) {
    const hasA = !!state.settings.anthropicKey;
    if (hasA) {
      statusEl.innerHTML = '✅ Anthropic key aanwezig — volledige AI analyse beschikbaar';
      statusEl.style.color = '#16a34a';
    } else {
      statusEl.innerHTML = '⚠️ Geen Anthropic key — alleen Poisson analyse · Worker heeft API-Football key';
      statusEl.style.color = '#d97706';
    }
  }

  // Auto-dark knop
  const adb = document.getElementById('autoDarkBtn');
  if (adb) adb.textContent = state.settings.autoDark ? 'Aan' : 'Uit';
}

// ── THEMA ────────────────────────────────────────────

function setTheme(theme) {
  document.body.className = theme || '';
  state.settings.theme = theme;
  localStorage.setItem('totoai_theme', theme);
  saveState();
}

function applyStoredTheme() {
  const t = localStorage.getItem('totoai_theme') || state.settings.theme || '';
  document.body.className = t;
}

function confirmResetWallet() {
  if (!confirm('Wallet volledig wissen? Dit kan niet ongedaan worden.')) return;
  const nb = parseInt(document.getElementById('settStartBalance')?.value)||state.settings.startBalance||500;
  state.wallet = {balance:nb,startBalance:nb,totalStaked:0,totalWon:0,bets:[]};
  state.settings.startBalance = nb;
  saveState(); applySettings();
  showFirebaseStatus('🗑 Wallet gewist','#dc2626');
}

// ── FIREBASE BACKUP ──────────────────────────────────

const FB_DB  = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';
const FB_KEY = 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M';

function showFirebaseStatus(msg, color) {
  const el = document.getElementById('firebaseStatus');
  if (!el) return;
  el.style.display='block'; el.style.color=color||'var(--muted)'; el.textContent=msg;
  setTimeout(()=>el.style.display='none',4000);
}

async function saveToFirebase() {
  const payload = {
    anthropicKey:state.settings.anthropicKey||'',
    footballKey:state.settings.footballKey||'',
    fdKey:state.settings.fdKey||'',
    defaultComp:state.settings.defaultComp||'eredivisie',
    defaultBet:state.settings.defaultBet||10,
    startBalance:state.settings.startBalance||500,
    notifEnabled:state.settings.notifEnabled||false,
    notifThreshold:state.settings.notifThreshold||20,
    tripleMinOdds:state.settings.tripleMinOdds||1.6,
    autoDark:state.settings.autoDark||false,
    vapidPublicKey:state.settings.vapidPublicKey||'',
    updatedAt:new Date().toISOString()
  };
  const resp = await fetch(`${FB_DB}/settings.json?auth=${FB_KEY}`,{
    method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const backupPayload = {
    wallet:state.wallet, tracker:state.tracker, valueBacktest:state.valueBacktest,
    version:APP_VERSION, backupDate:new Date().toISOString(),
    walletBetCount:state.wallet.bets.length, trackerBetCount:state.tracker.bets.length
  };
  const bresp = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`,{
    method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(backupPayload)
  });
  if (!bresp.ok) throw new Error(`Backup HTTP ${bresp.status}`);
  return resp.json();
}

async function restoreFromFirebase() {
  if (!confirm('Wallet + Tracker herstellen vanuit de cloud?\nLokale data wordt overschreven als de cloud meer bets heeft.')) return;
  showFirebaseStatus('🔄 Ophalen...','#2563eb');
  try {
    const br = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`);
    if (!br.ok) throw new Error('Geen backup gevonden');
    const b = await br.json();
    if (!b) throw new Error('Backup leeg');
    const fbW=b.wallet?.bets?.length||0, fbT=b.tracker?.bets?.length||0, fbB=b.valueBacktest?.picks?.length||0;
    if (fbW===0&&fbT===0&&fbB===0) { showFirebaseStatus('⚠ Cloud backup is leeg','#f59e0b'); return; }
    if (b.wallet)  state.wallet  = b.wallet;
    if (b.tracker) state.tracker = b.tracker;
    if (b.valueBacktest) state.valueBacktest = b.valueBacktest;
    saveState(); updateWalletUI();
    try { renderTracker(); updateTrackerStats(); } catch(e) {}
    showFirebaseStatus(`✅ Hersteld: ${fbW} wallet bets, ${fbT} tracker bets`,'#16a34a');
    loadFbBackupInfo();
  } catch(e) { showFirebaseStatus('⚠ '+e.message,'#e74c3c'); }
}

async function loadFromFirebase() {
  try {
    const resp = await fetch(`${FB_DB}/settings.json?auth=${FB_KEY}`);
    if (!resp.ok) return false;
    const d = await resp.json();
    if (!d) return false;
    if (d.anthropicKey) state.settings.anthropicKey = d.anthropicKey;
    if (d.footballKey)  state.settings.footballKey  = d.footballKey;
    if (d.fdKey)        state.settings.fdKey        = d.fdKey;
    if (d.defaultComp)  state.settings.defaultComp  = d.defaultComp;
    if (d.defaultBet)   state.settings.defaultBet   = d.defaultBet;
    if (d.startBalance) state.settings.startBalance = d.startBalance;
    if (d.notifEnabled!==undefined) state.settings.notifEnabled=d.notifEnabled;
    if (d.notifThreshold) state.settings.notifThreshold=d.notifThreshold;
    if (d.tripleMinOdds)  state.settings.tripleMinOdds=d.tripleMinOdds;
    if (d.autoDark!==undefined) state.settings.autoDark=d.autoDark;
    if (state.settings.anthropicKey) localStorage.setItem('totoai_key_anthropic', state.settings.anthropicKey);
    if (state.settings.footballKey)  localStorage.setItem('totoai_key_football',  state.settings.footballKey);
    if (d.vapidPublicKey) state.settings.vapidPublicKey=d.vapidPublicKey;

    try {
      const br = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`);
      if (br.ok) {
        const b = await br.json();
        if (b?.wallet) {
          const localC=state.wallet.bets.length, fbC=b.wallet.bets?.length||0;
          if (fbC>localC||(fbC>0&&localC===0)) {
            state.wallet=b.wallet;
            showFirebaseStatus(`☁️ Wallet gesynchroniseerd (${fbC} bets)`,'#16a34a');
          }
        }
        if (b?.tracker) {
          const localT=state.tracker?.bets?.length||0, fbT=b.tracker.bets?.length||0;
          if (fbT>localT) state.tracker=b.tracker;
        }
        if (b?.valueBacktest) {
          const localBt=state.valueBacktest?.picks?.length||0, fbBt=b.valueBacktest.picks?.length||0;
          if (fbBt>localBt||(localBt===0&&fbBt>0)) {
            state.valueBacktest=b.valueBacktest;
            try { renderBacktest(); } catch(e) {}
          }
        }
      }
    } catch(e) {}
    saveState(); applySettings();
    showFirebaseStatus('🔥 Keys geladen','#2ecc71');
    return true;
  } catch(e) { return false; }
}

async function loadFbBackupInfo() {
  const autoEl=document.getElementById('fbAutoSyncStatus');
  if (autoEl) autoEl.style.display=(FB_KEY&&FB_KEY!=='YOUR_FIREBASE_KEY')?'block':'none';
  const el=document.getElementById('fbBackupInfo');
  if (!el) return;
  try {
    const br=await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`);
    if (!br.ok) { el.textContent='Nog geen cloud backup'; return; }
    const b=await br.json();
    if (!b) { el.textContent='Nog geen cloud backup'; return; }
    const date=b.backupDate?new Date(b.backupDate).toLocaleString('nl-NL'):'?';
    const wc=b.walletBetCount??b.wallet?.bets?.length??'?';
    const tc=b.trackerBetCount??b.tracker?.bets?.length??'?';
    el.textContent=`☁️ Laatste backup: ${date} · ${wc} wallet · ${tc} tracker`;
  } catch(e) { el.textContent='Cloud info niet beschikbaar'; }
}

// ── BACKUP / IMPORT ──────────────────────────────────

function exportBackup() {
  const backup = {
    version:APP_VERSION, exportDate:new Date().toISOString(),
    wallet:state.wallet, tracker:state.tracker, valueBacktest:state.valueBacktest,
    settings:{
      defaultComp:state.settings.defaultComp, startBalance:state.settings.startBalance,
      defaultBet:state.settings.defaultBet, notifThreshold:state.settings.notifThreshold,
      tripleMinOdds:state.settings.tripleMinOdds, autoDark:state.settings.autoDark
    }
  };
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const datum=new Date().toLocaleDateString('nl-NL').replace(/\//g,'-');
  a.href=url; a.download=`totoai-backup-${datum}.json`; a.click();
  URL.revokeObjectURL(url);
  showBackupStatus('✅ Gedownload!','#16a34a');
}

function importBackup(event) {
  const file=event.target.files[0]; if (!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const b=JSON.parse(e.target.result);
      if (!b.version||!b.wallet) { showBackupStatus('⚠ Ongeldig bestand','#dc2626'); return; }
      if (!confirm(`Back-up van ${new Date(b.exportDate).toLocaleDateString('nl-NL')} importeren?`)) return;
      if (b.wallet)  state.wallet  = b.wallet;
      if (b.tracker) state.tracker = b.tracker;
      if (b.valueBacktest) state.valueBacktest = b.valueBacktest;
      if (b.settings) Object.assign(state.settings,b.settings);
      saveState(); applySettings();
      try { updateWalletUI(); } catch(e) {}
      showBackupStatus(`✅ Hersteld! ${b.wallet.bets?.length||0} weddenschappen`,'#16a34a');
    } catch(err) { showBackupStatus('⚠ Fout: '+err.message,'#dc2626'); }
    event.target.value='';
  };
  reader.readAsText(file);
}

function showBackupStatus(msg, color) {
  const el=document.getElementById('backupStatus');
  if (!el) return;
  el.style.display='block'; el.style.color=color;
  el.style.background=color==='#16a34a'?'rgba(22,163,74,.08)':'rgba(220,38,38,.08)';
  el.style.border=`1px solid ${color}33`; el.textContent=msg;
  setTimeout(()=>el.style.display='none',5000);
}

// ── KEY VISIBILITEIT ─────────────────────────────────

function toggleKeyVisibility(inputId, btn) {
  const input=document.getElementById(inputId); if (!input) return;
  if (input.type==='password') { input.type='text'; btn.textContent='🙈'; }
  else { input.type='password'; btn.textContent='👁'; }
}

// ── KOSTEN TRACKER ───────────────────────────────────

const ANTHROPIC_PRICES = {
  'claude-haiku-4-5-20251001': { input: 0.00000025, output: 0.00000125 },
  'claude-sonnet-4-20250514':  { input: 0.000003,   output: 0.000015   },
  'claude-sonnet-4-6':         { input: 0.000003,   output: 0.000015   },
  'default':                   { input: 0.000003,   output: 0.000015   }
};

function trackTokenUsage(model, inputTokens, outputTokens) {
  if (!state.costs) state.costs = {calls:0, tokensIn:0, tokensOut:0, totalUSD:0};
  const prices = ANTHROPIC_PRICES[model] || ANTHROPIC_PRICES['default'];
  const cost = (inputTokens * prices.input) + (outputTokens * prices.output);
  state.costs.calls++;
  state.costs.tokensIn  += inputTokens||0;
  state.costs.tokensOut += outputTokens||0;
  state.costs.totalUSD  += cost;
  updateCostUI();
}

function updateCostUI() {
  const costs = state.costs || {calls:0,tokensIn:0,tokensOut:0,totalUSD:0};
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const tokIn  = parseInt(costs.tokensIn)  || 0;
  const tokOut = parseInt(costs.tokensOut) || 0;
  const total  = parseFloat(costs.totalUSD) || 0;
  const calls  = parseInt(costs.calls) || 0;
  set('costTokensIn',  tokIn.toLocaleString());
  set('costTokensOut', tokOut.toLocaleString());
  set('costTotal',     '$'+total.toFixed(4));
  set('costCalls',     calls);
}

function resetCostCounter() {
  if (!confirm('Kostenteller resetten?')) return;
  state.costs={calls:0,tokensIn:0,tokensOut:0,totalUSD:0};
  saveState(); updateCostUI();
}

// ── NOTIFICATIES UI ──────────────────────────────────

function updateNotifUI() {
  const btn=document.getElementById('notifToggleBtn');
  const badge=document.getElementById('notifStatusBadge');
  const section=document.getElementById('notifEnabledSection');
  const enabled=state.settings.notifEnabled&&Notification.permission==='granted';
  if (btn) {
    btn.textContent=enabled?'Uitschakelen':'Inschakelen';
    btn.style.background=enabled?'rgba(220,38,38,.08)':'rgba(22,163,74,.08)';
    btn.style.color=enabled?'#dc2626':'#16a34a';
    btn.style.borderColor=enabled?'rgba(220,38,38,.3)':'rgba(22,163,74,.3)';
  }
  if (badge) {
    if (Notification.permission==='granted') {
      badge.textContent='✅ Toegestaan'; badge.style.background='rgba(22,163,74,.1)'; badge.style.color='#16a34a';
    } else if (Notification.permission==='denied') {
      badge.textContent='❌ Geweigerd'; badge.style.background='rgba(220,38,38,.1)'; badge.style.color='#dc2626';
    } else {
      badge.textContent='⏳ Niet gevraagd'; badge.style.background='rgba(217,119,6,.1)'; badge.style.color='#d97706';
    }
  }
  if (section) section.style.display=state.settings.notifEnabled?'block':'none';
  // Auto-dark status
  const adb=document.getElementById('autoDarkBtn');
  if (adb) adb.textContent=state.settings.autoDark?'Aan':'Uit';
}

// ── SCHEDULED FIREBASE SYNC ──────────────────────────

let _fbSyncTimer = null;
function scheduleFirebaseSync() {
  clearTimeout(_fbSyncTimer);
  _fbSyncTimer = setTimeout(() => {
    saveToFirebase().catch(()=>{});
  }, 5000);
}

// ── AUTO SCAN ──────────────────────────────────────────
function toggleAutoScan() {
  state.settings.autoScan = !state.settings.autoScan;
  saveState();
  const btn = document.getElementById('autoScanToggleBtn');
  if (btn) btn.textContent = state.settings.autoScan ? 'Uitzetten' : 'Inschakelen';
  showToast(state.settings.autoScan ? '⏱ Auto scan ingeschakeld' : '⏱ Auto scan uitgeschakeld');
  if (state.settings.autoScan) startAutoCheckScheduler();
}

function skipScanToday() {
  state.settings.scanSkipDate = new Date().toDateString();
  saveState();
  const el = document.getElementById('skipScanStatus');
  if (el) el.textContent = '✓ Overgeslagen vandaag';
  showToast('⏭ Scan overgeslagen voor vandaag');
}


// ── 
// ── Handmatige scan vanuit instellingen ───────────────
async function runManualScan() {
  const btn = document.querySelector('[onclick="runManualScan()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Scannen...'; }

  showToast('⚡ Wedstrijden laden...');

  try {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Stap 1: laad fixtures via per-league odds endpoint (zelfde als wedstrijden tab)
    showToast('⟳ Odds ophalen per competitie...');
    const knownLeagueIds = Object.values(COMP_IDS);
    const allMatches = [];

    await Promise.all(knownLeagueIds.map(async leagueId => {
      try {
        const r = await apiFetch(
          `https://v3.football.api-sports.io/odds?league=${leagueId}&season=2025&date=${today}&bookmaker=8`,
          null, 8000
        );
        const d = await r.json();
        (d.response || []).forEach(item => {
          const fix = item.fixture;
          if (!fix) return;
          const statusShort = fix.status?.short || '';
          if (['FT','AET','PEN'].includes(statusShort)) return;

          // Parse odds
          let homeOdds = '—', drawOdds = '—', awayOdds = '—';
          const bk = (item.bookmakers || [])[0];
          if (bk) {
            const mkt = (bk.bets || []).find(b => b.name === 'Match Winner');
            if (mkt?.values) {
              const h = mkt.values.find(v => v.value === 'Home');
              const dr = mkt.values.find(v => v.value === 'Draw');
              const a = mkt.values.find(v => v.value === 'Away');
              if (h) homeOdds = parseFloat(h.odd).toFixed(2);
              if (dr) drawOdds = parseFloat(dr.odd).toFixed(2);
              if (a) awayOdds = parseFloat(a.odd).toFixed(2);
            }
          }
          if (homeOdds === '—') return; // geen odds = overslaan

          const dateObj = fix.date ? new Date(fix.date) : null;
          allMatches.push({
            id: String(fix.id),
            source: 'apif',
            comp: item.league?.name || '',
            leagueId: item.league?.id || leagueId,
            time: dateObj ? dateObj.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : '--:--',
            date: dateObj ? dateObj.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}) : '',
            dateISO: fix.date ? fix.date.split('T')[0] : '',
            home: fix.teams?.home?.name || '?',
            away: fix.teams?.away?.name || '?',
            homeId: fix.teams?.home?.id,
            awayId: fix.teams?.away?.id,
            homeLogo: '', awayLogo: '',
            homeOdds, drawOdds, awayOdds,
            isLive: false, isDone: false,
            fixture: { neutral: false }
          });
        });
      } catch(e) {}
    }));

    // Dedup op fixture ID
    const seen = new Set();
    const matches = allMatches.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id); return true;
    });

    if (!matches.length) {
      // Fallback: probeer morgen
      showToast('Geen odds vandaag — morgen proberen...');
      await Promise.all(knownLeagueIds.map(async leagueId => {
        try {
          const r = await apiFetch(
            `https://v3.football.api-sports.io/odds?league=${leagueId}&season=2025&date=${tomorrow}&bookmaker=8`,
            null, 8000
          );
          const d = await r.json();
          (d.response || []).forEach(item => {
            const fix = item.fixture;
            if (!fix) return;
            let homeOdds = '—', drawOdds = '—', awayOdds = '—';
            const bk = (item.bookmakers || [])[0];
            if (bk) {
              const mkt = (bk.bets || []).find(b => b.name === 'Match Winner');
              if (mkt?.values) {
                const h = mkt.values.find(v => v.value === 'Home');
                const dr = mkt.values.find(v => v.value === 'Draw');
                const a = mkt.values.find(v => v.value === 'Away');
                if (h) homeOdds = parseFloat(h.odd).toFixed(2);
                if (dr) drawOdds = parseFloat(dr.odd).toFixed(2);
                if (a) awayOdds = parseFloat(a.odd).toFixed(2);
              }
            }
            if (homeOdds === '—') return;
            const dateObj = fix.date ? new Date(fix.date) : null;
            if (!seen.has(String(fix.id))) {
              seen.add(String(fix.id));
              matches.push({
                id: String(fix.id), source: 'apif',
                comp: item.league?.name || '', leagueId: item.league?.id || leagueId,
                time: dateObj ? dateObj.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : '--:--',
                date: dateObj ? dateObj.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}) : '',
                dateISO: fix.date ? fix.date.split('T')[0] : '',
                home: fix.teams?.home?.name || '?', away: fix.teams?.away?.name || '?',
                homeId: fix.teams?.home?.id, awayId: fix.teams?.away?.id,
                homeLogo: '', awayLogo: '',
                homeOdds, drawOdds, awayOdds,
                isLive: false, isDone: false, fixture: { neutral: false }
              });
            }
          });
        } catch(e) {}
      }));
    }

    if (!matches.length) {
      showToast('Geen wedstrijden met odds gevonden');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Nu scannen'; }
      return;
    }

    showToast(`⟳ AI scan van ${matches.length} wedstrijden met odds...`);
    state.matches = matches;

    // Voer value scan uit
    await scanValueAll();

    const results = state.valueScans || [];
    const highValue = results.filter(s => s.value >= 10);
    showToast(`✅ Scan klaar — ${highValue.length} picks ≥10% value`);

    setTimeout(() => switchScreen('analyse'), 1500);

  } catch(e) {
    showToast('⚠ Scan fout: ' + e.message);
    console.error(e);
  }

  if (btn) { btn.disabled = false; btn.textContent = '⚡ Nu scannen'; }
}

}

