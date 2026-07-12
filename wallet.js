// ═══════════════════════════════════════════════════════
// WALLET SCREEN v15
// v15: Speeldatum + tijd toegevoegd aan pick kaarten en popup

// ── Claude analyse popup renderer ────────────────────────
function renderAnalysePopup(text, onImport) {
  const sectionColors = { '⚽': '#00BEC4', '🔍': '#7c3aed', '✅': '#16a34a', '🎯': '#00BEC4', '💡': '#7c3aed', '🏹': '#f59e0b' };
  const lines = text.split('\n');
  let html = '';
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) { html += '<div style="height:.4rem;"></div>'; return; }
    const secMatch = Object.keys(sectionColors).find(e => trimmed.startsWith(e));
    if (secMatch) {
      const color = sectionColors[secMatch];
      html += `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;
        color:${color};margin:1rem 0 .4rem;padding:.4rem .7rem;
        background:${color}18;border-left:3px solid ${color};border-radius:0 8px 8px 0;">
        ${trimmed}</div>`;
    } else {
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;color:rgba(255,255,255,.88);line-height:1.85;margin:.1rem 0;">${trimmed}</div>`;
    }
  });

  // Verwijder bestaande popup
  const existing = document.getElementById('analyse-popup-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'analyse-popup-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s;';
  overlay.innerHTML = `
    <div style="background:#0f1923;border-radius:20px 20px 0 0;width:100%;max-height:88vh;
      overflow-y:auto;padding:1.2rem 1.1rem 2rem;border-top:2px solid rgba(0,190,196,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#00BEC4;letter-spacing:.05em;">${t('wal.claudeanalyse','🤖 CLAUDE ANALYSE')}</div>
        <button onclick="document.getElementById('analyse-popup-overlay').remove()"
          style="background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.6);
          font-size:1.1rem;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>
      </div>
      <div>${html}</div>
      ${onImport ? `<button onclick="${onImport};document.getElementById('analyse-popup-overlay').remove()"
        style="width:100%;margin-top:1.2rem;padding:.85rem;border-radius:12px;
        background:linear-gradient(135deg,#00BEC4,#0099a8);color:#fff;border:none;
        font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.05em;cursor:pointer;">
        📥 IMPORTEREN NAAR TRACKER</button>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}


// v14: Killer resultatenpagina — ROI 7 dagen, win streak, beste league, elite hitrate, CLV
// v13: "Waarom deze pick?" signalen in backtest cards

let trackerType = 'single';
let trackerLegs = [];
let trackerSource = 'eigen';
let trackerFilter = 'all';
let btSubTab = 'picks';
let btFilter = 'all';
let _liveScoreInterval = null;

// ── LOCK DETECTIE ─────────────────────────────────────────
// Detecteert of een pick door meerdere onafhankelijke scan-sessies bevestigd is
// Tijdsdrempel: minimaal 2 uur tussen sessies om spam te voorkomen
function detectLockLevel(fixtureId, pick) {
  const log = state.scanLog || [];
  const fidStr = String(fixtureId);

  // Verzamel tijdstippen van unieke scan-sessies die deze pick bevestigden
  const scanTimes = [];
  log.forEach(scan => {
    const hasPick = scan.picks.some(p =>
      String(p.fixtureId) === fidStr && p.pick === pick
    );
    if (!hasPick) return;

    // Haal tijdstip op uit scan
    const scanTime = scan.timestamp || (scan.date && scan.time
      ? new Date(scan.date.split('-').reverse().join('-') + 'T' + (scan.time || '00:00')).getTime()
      : 0);
    scanTimes.push(scanTime);
  });

  if (scanTimes.length < 2) return scanTimes.length === 1 ? 'single' : 'none';

  // Sorteer op tijd
  scanTimes.sort((a, b) => a - b);

  // Tel onafhankelijke bevestigingen (minimaal 2 uur apart)
  const MIN_GAP_MS = 2 * 60 * 60 * 1000; // 2 uur
  let independentCount = 1;
  let lastCounted = scanTimes[0];

  for (let i = 1; i < scanTimes.length; i++) {
    if (scanTimes[i] - lastCounted >= MIN_GAP_MS) {
      independentCount++;
      lastCounted = scanTimes[i];
    }
  }

  if (independentCount >= 3) return 'triple';
  if (independentCount >= 2) return 'double';
  return 'single';
}

function lockBadge(level) {
  if (level === 'triple') return '<span style="font-family:monospace;font-size:.48rem;font-weight:900;color:#00BEC4;background:rgba(0,190,196,.12);border:1px solid rgba(0,190,196,.3);padding:2px 7px;border-radius:999px;">🏆 TRIPLE LOCK</span>';
  if (level === 'double') return '<span style="font-family:monospace;font-size:.48rem;font-weight:900;color:#b45309;background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.25);padding:2px 7px;border-radius:999px;">🔒 DOUBLE LOCK</span>';
  return '';
}

// ── RENDER WALLET SCREEN ──────────────────────────────────

function renderWalletScreen() {
  const el = document.getElementById('screen-wallet');
  if (!el) return;
  try {
  el.innerHTML = `
    <div class="app">
      <!-- WALLET TAB -->
      <div id="wsub-content-wallet" style="display:none;">
        <div style="background:linear-gradient(135deg,#061518,#04383F);border:1px solid rgba(0,190,196,.2);border-radius:18px;padding:1.1rem 1.2rem;margin-bottom:.75rem;box-shadow:0 4px 18px rgba(0,0,0,.35);">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:rgba(255,255,255,.55);letter-spacing:.08em;margin-bottom:.3rem;">${t('wal.currentbalance','HUIDIG SALDO')}</div>
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:2.4rem;color:#fff;letter-spacing:.03em;line-height:1;" id="bigBalance">€0,00</div>
          <div class="wallet-actions">
            <button style="background:rgba(0,190,196,.12);border:1px solid rgba(0,190,196,.3);border-radius:10px;padding:.4rem .75rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:#00BEC4;cursor:pointer;" onclick="openDepositModal()">${t('wal.deposit','+ Storten')}</button>
            <button style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.4rem .75rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:rgba(255,255,255,.7);cursor:pointer;" onclick="openWithdrawModal()">${t('wal.withdraw','- Opnemen')}</button>
            <button style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:.4rem .75rem;font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:#ef4444;cursor:pointer;" onclick="clearWallet()">${t('wal.clear','Wissen')}</button>
          </div>
        </div>
        <div class="wallet-strip">
          <div class="w-item bal"><div class="w-label">${t('wal.balance','Saldo')}</div><div class="val" id="miniBalance">€0,00</div></div>
          <div class="w-item"><div class="w-label">W/V</div><div class="val" id="miniPnl">+€0,00</div></div>
          <div class="w-item"><div class="w-label">Bets</div><div class="val" id="miniBets">0</div></div>
          <div class="w-item"><div class="w-label">Hitrate</div><div class="val" id="miniRate">—</div></div>
          <div class="w-item"><div class="w-label">Avg EV</div><div class="val" id="miniEV" style="color:#00a8ad;">—</div></div>
        </div>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;">
          <div class="stat-mini-card"><div class="stat-mini-label">${t('wal.staked','Ingezet')}</div><div class="stat-mini-val" id="totalStaked">€0,00</div></div>
          <div class="stat-mini-card"><div class="stat-mini-label">${t('wal.received','Ontvangen')}</div><div class="stat-mini-val" id="totalWon">€0,00</div></div>
          <div class="stat-mini-card"><div class="stat-mini-label">Hitrate</div><div class="stat-mini-val" id="hitRate">—</div></div>
        </div>
        <div class="wallet-chart-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
            <div style="display:flex;gap:.3rem;">
              <button id="cv-saldo" class="chart-view-btn active" onclick="setChartView('saldo')">${t('wal.balance','Saldo')}</button>
              <button id="cv-pnl" class="chart-view-btn" onclick="setChartView('pnl')">W/V</button>
            </div>
            <div style="display:flex;gap:.3rem;">
              <button id="cs-all"     class="chart-src-btn active" onclick="setChartSource('all')">${t('wal.all','Alles')}</button>
              <button id="cs-analyse" class="chart-src-btn" onclick="setChartSource('analyse')">AI</button>
              <button id="cs-value"   class="chart-src-btn" onclick="setChartSource('value')">Value</button>
              <button id="cs-eigen"   class="chart-src-btn" onclick="setChartSource('eigen')">${t('wal.own','Eigen')}</button>
            </div>
          </div>
          <canvas id="walletChart" height="100"></canvas>
          <div id="chartEmpty" style="display:none;font-family:monospace;font-size:.6rem;color:rgba(255,255,255,.95);text-align:center;padding:1.5rem 0;"></div>
        </div>
        <button class="export-btn" onclick="exportWalletCSV()">${t('wal.exportcsv','📥 Exporteer als CSV')}</button>
        <div class="section-header"><span>${t('wal.mybets','MIJN INZETTEN')}</span></div>
        <div id="betHistoryList"></div>
      </div>

      <!-- TRACKER TAB -->
      <div id="wsub-content-tracker" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
          <div class="section-header" style="margin-bottom:0;">📒 TRACKER</div>
          <button class="add-tracker-btn" onclick="openTrackerModal()">${t('wal.addbet','+ Bet toevoegen')}</button>
        </div>
        <div class="wallet-strip" style="margin-bottom:.6rem;flex-direction:column;align-items:stretch;gap:.45rem;padding:.85rem;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="min-width:0;">
              <div class="w-label" style="margin-bottom:.15rem;">HUIDIGE BANKROLL</div>
              <div id="trSaldo" style="font-size:1.5rem;font-weight:800;font-family:'IBM Plex Mono',monospace;color:#00BEC4;line-height:1;">€100,00</div>
              <div id="trGroei" style="font-size:.55rem;font-family:monospace;margin-top:.3rem;color:rgba(255,255,255,.6);">—</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end;flex-shrink:0;">
              <button id="trUnitsBtn" class="small-action-btn" style="padding:.25rem .55rem;font-size:.55rem;" onclick="toggleTrackerUnits()">€ / units</button>
              <button class="small-action-btn" style="padding:.25rem .55rem;font-size:.55rem;" onclick="setTrackerBankroll()">✏️ instellen</button>
            </div>
          </div>
          <div id="trBankInfo" style="font-size:.48rem;font-family:monospace;color:rgba(255,255,255,.45);">Start €100 · 1 unit = €2,00 (2%)</div>
        </div>
        <div class="wallet-strip" style="margin-bottom:.75rem;">
          <div class="w-item"><div class="w-label">${t('wal.staked','Ingezet')}</div><div class="val" id="trStaked">€0</div></div>
          <div class="w-item"><div class="w-label">W/V</div><div class="val" id="trPnl">€0,00</div></div>
          <div class="w-item"><div class="w-label">Bets</div><div class="val" id="trBets">0</div></div>
          <div class="w-item"><div class="w-label">ROI</div><div class="val" id="trRoi">—</div></div>
        </div>
        <div id="smartStatsWrap" style="margin-bottom:.75rem;"></div>
        <div id="trackerChartWrap" style="margin-bottom:.75rem;display:none;">
          <canvas id="trackerChart" height="90"></canvas>
        </div>
        <div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;">
          <button class="small-action-btn" style="background:rgba(255,140,0,.1);border-color:rgba(255,140,0,.3);color:#e67e00;font-weight:800;"
            onclick="openJacksPhotoImport()">${t('wal.importjacks','📸 Importeer van bookmaker')}</button>
          <button class="small-action-btn" style="background:rgba(0,190,196,.1);border-color:rgba(0,190,196,.3);color:#00BEC4;font-weight:800;"
            onclick="checkAllTrackerBets()">🔍 Alles checken</button>
        </div>
        <div class="tracker-filter-row">
          <button id="tf-all"     class="tracker-filter active" onclick="setTrackerFilter('all')">${t('wal.all','Alles')}</button>
          <button id="tf-open"    class="tracker-filter" onclick="setTrackerFilter('open')">Open</button>
          <button id="tf-win"     class="tracker-filter" onclick="setTrackerFilter('win')">Win</button>
          <button id="tf-lose"    class="tracker-filter" onclick="setTrackerFilter('lose')">${t('wal.loss','Verlies')}</button>
          <button id="tf-analyse" class="tracker-filter" onclick="setTrackerFilter('analyse')">AI</button>
          <button id="tf-value"   class="tracker-filter" onclick="setTrackerFilter('value')">Value</button>
        </div>
        <div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;">
          <button class="export-btn" onclick="exportTrackerCSV()">📥 Export CSV</button>
          <button class="small-action-btn" style="background:rgba(255,140,0,.1);border-color:rgba(255,140,0,.3);color:#e67e00;font-weight:800;"
            onclick="openJacksImport()">${t('wal.importjacks2','🎰 Importeer van bookmaker')}</button>
        </div>
        <div id="trackerList"></div>
      </div>

      <!-- RESULTATEN TAB (was: Backtest + Picks samengevoegd) -->
      <div id="wsub-content-backtest" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
          <div class="section-header" style="margin-bottom:0;">${t('wal.valueresults','📊 VALUE RESULTATEN')}</div>
          <div style="display:flex;gap:.4rem;">
            <button class="small-action-btn" onclick="checkAllBacktestPicks()">${t('wal.checkall','🔍 Alles checken')}</button>
            <button class="small-action-btn danger" onclick="clearBacktest()">${t('wal.clear','Wissen')}</button>
          </div>
        </div>

        <!-- Lock hitrate card -->
        <div id="tlHitrateCard" style="display:none;" class="tl-hitrate-card"></div>

        <!-- Sub-tabs -->
        <div class="bt-subtabs">
          <button id="bts-picks" class="bt-subtab active" onclick="setBtSubTab('picks')">Picks</button>
          <button id="bts-comps" class="bt-subtab" onclick="setBtSubTab('comps')">${t('wal.percomp','Per Competitie')}</button>
        </div>

        <!-- Stats strip -->
        <div class="wallet-strip" style="margin-bottom:.75rem;">
          <div class="w-item"><div class="w-label">Picks</div><div class="val" id="btTotal">0</div></div>
          <div class="w-item"><div class="w-label">Hitrate</div><div class="val" id="btHitrate">—</div></div>
          <div class="w-item"><div class="w-label">ROI</div><div class="val" id="btRoi">—</div></div>
          <div class="w-item"><div class="w-label">${t('wal.profiteuro','Winst/€')}</div><div class="val" id="btProfit">—</div></div>
        </div>

        <!-- Killer stats — ROI 7d, win streak, beste league, elite, CLV -->
        <div id="btKillerStats" style="display:none;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.8rem 1rem;margin-bottom:.75rem;"></div>

        <!-- Voortgangsbalk naar 100 picks -->
        <div id="btProgressWrap" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.7rem 1rem;margin-bottom:.75rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
            <div style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);">${t('wal.progresstrackrecord','VOORTGANG TRACKRECORD')}</div>
            <div id="btProgressLabel" style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;letter-spacing:.04em;">0/100</div>
          </div>
          <div style="background:rgba(0,0,0,.08);border-radius:999px;height:7px;overflow:hidden;">
            <div id="btProgressBar" style="height:100%;border-radius:999px;background:linear-gradient(90deg,#00BEC4,#00a8ad);width:0%;transition:width .4s;"></div>
          </div>
        </div>

        <!-- Grafiek -->
        <div id="btChartWrap" style="margin-bottom:.75rem;display:none;">
          <canvas id="btChart" height="90"></canvas>
        </div>

        <!-- Comp breakdown -->
        <div id="btCompBreakdown" style="display:none;margin-bottom:.75rem;"></div>

        <!-- Filter rij -->
        <div id="btFilterRow" class="tracker-filter-row" style="display:none;margin-bottom:.5rem;">
          <button id="btf-all"     class="bt-filter-btn active" onclick="setBtFilter('all')">${t('wal.all','Alles')}</button>
          <button id="btf-win"     class="bt-filter-btn" onclick="setBtFilter('win')">Win</button>
          <button id="btf-lose"    class="bt-filter-btn" onclick="setBtFilter('lose')">${t('wal.loss','Verlies')}</button>
          <button id="btf-pending" class="bt-filter-btn" onclick="setBtFilter('pending')">Open</button>
          <button id="btf-lock"    class="bt-filter-btn" onclick="setBtFilter('lock')">🔒 Locks</button>
        </div>

        <div id="btList"></div>
      </div>

      <!-- Modals staan in index.html en worden dynamisch toegevoegd -->
    </div>
  `;
  setWalletSubTab('tracker'); // v26.238: saldo-wallet + resultaten verborgen, alleen tracker
  } catch(e) {
    el.innerHTML = '<div style="padding:1rem;font-family:monospace;font-size:.6rem;color:#dc2626;">⚠ Wallet fout: ' + e.message + '<br><small>' + e.stack?.split('\n')[1] + '</small></div>';
    console.error('renderWalletScreen fout:', e);
  }
}

// ── SET SUB-TAB ───────────────────────────────────────────

function setWalletSubTab(tab) {
  ['wallet','tracker','backtest'].forEach(t => {
    const el  = document.getElementById('wsub-content-' + t);
    const btn = document.getElementById('wsub-' + t);
    if (el)  el.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      if (t === tab) {
        btn.style.background = 'rgba(0,190,196,.15)';
        btn.style.color      = '#00BEC4';
        btn.style.boxShadow  = '0 1px 4px rgba(0,0,0,.2)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color      = 'rgba(255,255,255,.4)';
        btn.style.boxShadow  = 'none';
      }
    }
  });
  if (tab === 'wallet')   { 
    if (!state.wallet) state.wallet = {balance:500,startBalance:500,totalStaked:0,totalWon:0,bets:[]};
    updateWalletUI(); startLiveScorePolling(); 
  }
  if (tab === 'tracker')  { 
    if (!state.tracker) state.tracker = {bets:[]};
    renderTracker(); updateTrackerStats(); 
    autoSettleTracker(); // v26.243: stil afrekenen op de achtergrond (max 1x/15min, niet-blokkerend)
  }
  if (tab === 'backtest') { renderBacktest(); }
}

// ── UPDATE WALLET UI ──────────────────────────────────────

function updateWalletUI() {
  // Zorg dat wallet altijd geïnitialiseerd is
  if (!state.wallet) state.wallet = {balance:500,startBalance:500,totalStaked:0,totalWon:0,bets:[]};
  if (!state.wallet.bets) state.wallet.bets = [];
  const w = state.wallet;
  const fmt = v => '€' + v.toFixed(2).replace('.', ',');
  const pnl = (w.totalWon||0) - (w.totalStaked||0);
  const wins = w.bets.filter(b => b.status === 'win').length;
  const settled = w.bets.filter(pmxCountsForHit).length;  // v26.276: pushes tellen niet mee
  const hitRate = settled > 0
    ? Math.round(wins/settled*100) + '%' + (settled < 10 ? ` (${settled})` : '')
    : '—';
  const _t = (id,val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const _c = (id,val) => { const el = document.getElementById(id); if (el) el.style.color = val; };
  _t('miniBalance', fmt(w.balance));
  _t('miniPnl',     (pnl >= 0 ? '+' : '') + fmt(pnl));
  _c('miniPnl',     pnl >= 0 ? 'var(--green)' : 'var(--red)');
  _t('miniBets',    w.bets.length);
  _t('miniRate',    hitRate);
  _t('bigBalance',  fmt(w.balance));
  _t('totalStaked', fmt(w.totalStaked));
  _t('totalWon',    fmt(w.totalWon));
  _t('hitRate',     hitRate);
  const settledBets = w.bets.filter(b => b.status !== 'pending' && b.odds);
  const avgEV = settledBets.length > 0
    ? (settledBets.reduce((sum, b) => {
        const impliedProb = 1 / parseFloat(b.odds);
        const actualOutcome = b.status === 'win' ? 1 : 0;
        return sum + (actualOutcome - impliedProb);
      }, 0) / settledBets.length * 100)
    : null;
  _t('miniEV', avgEV !== null ? (avgEV >= 0 ? '+' : '') + avgEV.toFixed(1) + '%' : '—');
  _c('miniEV', avgEV === null ? '#94a3b8' : avgEV >= 5 ? '#00BEC4' : avgEV >= 0 ? '#d97706' : '#dc2626');
  renderBetHistory();
  renderWalletChart();
}

function renderBetHistory() {
  const list = document.getElementById('betHistoryList');
  if (!list) return;
  const bets = [...(state.wallet.bets||[])].reverse();
  if (!bets.length) { list.innerHTML = '<div class="empty-state">'+t('wal.nobets','Nog geen weddenschappen')+'</div>'; return; }
  list.innerHTML = bets.map(b => {
    const isCombi = b.type === 'combi';
    // v26.276: één berekening voor alle uitkomsten (half verlies gaf voorheen "+€-5.00")
    const _p = pmxProfit(b);
    const pnlText = b.status === 'pending' ? '⏳'
                  : pmxIsPush(b)           ? 'push €0,00'
                  : `${_p >= 0 ? '+' : '-'}€${Math.abs(_p).toFixed(2)}`;
    const pnlColor = b.status === 'pending' ? '#475569'
                   : pmxIsPush(b)          ? '#b45309'
                   : _p > 0 ? '#00BEC4' : _p < 0 ? '#dc2626' : '#94a3b8';
    const scoreTag = b.score ? ` [${b.score}]` : (b.liveScore ? ` ⚽${b.liveScore}${b.liveMinute?` ${b.liveMinute}'`:''}` : '');
    const srcBadge = b.source === 'value' ? '<span style="font-family:monospace;font-size:.44rem;background:rgba(0,190,196,.1);color:#00BEC4;padding:1px 6px;border-radius:4px;font-weight:700;">⚡ Value</span> ' : b.source === 'analyse' ? '<span style="font-family:monospace;font-size:.44rem;background:rgba(0,190,196,.1);color:#00a8ad;padding:1px 6px;border-radius:4px;font-weight:700;">🤖 AI</span> ' : '';
    const legsHtml = isCombi && b.legs ? b.legs.map((l,i) => `
      <div style="display:flex;justify-content:space-between;padding:.25rem 0;border-top:1px solid var(--bet-border,rgba(255,255,255,0.09));font-family:monospace;font-size:.5rem;">
        <span style="color:var(--bet-text,#ffffff);">${l.match||''} — ${l.pick} @ ${l.odds}</span>
        <span style="color:${l.legStatus==='win'?'#00BEC4':l.legStatus==='lose'?'#dc2626':'#94a3b8'};">${l.legStatus==='win'?'✓':l.legStatus==='lose'?'✗':'⏳'}</span>
      </div>`).join('') : '';
    return `
    <div class="bet-row bet-${b.status||'pending'}" style="cursor:pointer;" data-bet="${JSON.stringify({id:b.id,match:b.matchName||b.match||'',pick:b.pick,pickLabel:b.pickLabel||b.pick,odds:b.odds,stake:b.amount||b.stake,status:b.status,date:b.date,markt:b.markt,note:b.note,payout:b.payout}).replace(/"/g,'&quot;')}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.3rem;">
        <div style="flex:1;">
          <div style="font-size:.85rem;font-weight:700;color:var(--bet-text,#ffffff);">${srcBadge}${b.matchName||b.match||''}${scoreTag}</div>
          <div style="font-family:monospace;font-size:.6rem;color:var(--bet-muted,rgba(255,255,255,.5));margin-top:.15rem;">
            ${isCombi ? `Combi ${b.legs?.length||0} legs` : b.pick} @ ${b.odds} · €${b.amount||b.stake||0} → €${b.payout||0} · ${b.date||''}
          </div>
          ${isCombi ? `<div style="margin-top:.3rem;">${legsHtml}</div>` : ''}
        </div>
        <button onclick="deleteBet(${b.id})" class="del-btn" style="margin-left:.5rem;">✕</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        ${isCombi
          ? `<button class="small-action-btn" onclick="checkBetResult(${b.id})">🔍</button>`
          : `<button class="small-action-btn" onclick="checkBetResult(${b.id})">${t('wal.check','🔍 Check')}</button>`}
        <div class="bet-status ${b.status||'pending'}" onclick="${isCombi?`cycleCombiBetStatus(${b.id})`:`cycleBetStatus(${b.id})`}"
          style="color:${pnlColor};font-family:monospace;font-size:.6rem;font-weight:700;cursor:pointer;">${pnlText}</div>
      </div>
    </div>`;
  }).join('');

  // Event delegation voor pop-up op bet cards
  list.onclick = function(e) {
    const card = e.target.closest('.bet-row');
    if (!card || e.target.closest('button') || e.target.closest('.bet-status')) return;
    if (typeof openCardPopup !== 'function') return;
    try {
      const d = JSON.parse(card.dataset.bet.replace(/&quot;/g, '"'));
      openCardPopup('bet', d);
    } catch(err) {}
  };
}

// ── BET ACTIES ────────────────────────────────────────────

// ── v26.276: één plek die bepaalt wat een bet heeft opgeleverd ────────────────
// settleAsianPick() zette status op `payout > 0 ? 'win' : 'lose'`. Bij een kwartlijn is een
// HALF VERLIES (payout = halve inzet) dus als 'win' geboekt, en een PUSH (payout = inzet) ook.
// De P&L werd daarna berekend als `-amount` bij lose en `payout-amount` bij win -> een half
// verlies van 5 euro verscheen als "+EUR -5.00" en telde in de hitrate als overwinning mee.
function pmxStake(b) { const v = parseFloat(b.amount != null ? b.amount : b.stake); return isNaN(v) ? 0 : v; }
function pmxProfit(b) {                       // netto resultaat, geldig voor elke uitkomst
  if (!b || b.status === 'pending') return 0;
  const p = parseFloat(b.payout);
  return (isNaN(p) ? 0 : p) - pmxStake(b);
}
function pmxIsSettled(b)    { return !!(b && b.status && b.status !== 'pending'); }
function pmxIsPush(b)       { return !!(b && b.status === 'push'); }
function pmxCountsForHit(b) { return pmxIsSettled(b) && !pmxIsPush(b); } // push telt niet mee in hitrate
function pmxBookmaker(b)    { return (b && b.bookmaker && b.bookmaker !== 'Jacks') ? b.bookmaker : 'bookmaker'; }

// v26.228: Asian Handicap / Asian totalen / "meer-minder dan" / BTTS afrekenen (incl. kwart-lijnen: halve winst/verlies/push)
// v26.231: NL->EN landennamen + fuzzy team-match (lost "Noorwegen" vs "Norway", "Brazilie" vs "Brazil" op)
const NL_EN_LAND = {
  'noorwegen':'norway','frankrijk':'france','brazilie':'brazil','duitsland':'germany','spanje':'spain',
  'italie':'italy','engeland':'england','belgie':'belgium','zwitserland':'switzerland','kroatie':'croatia',
  'denemarken':'denmark','zweden':'sweden','polen':'poland','tsjechie':'czech','griekenland':'greece',
  'turkije':'turkey','oostenrijk':'austria','ierland':'ireland','schotland':'scotland','nederland':'netherlands',
  'marokko':'morocco','egypte':'egypt','kaapverdie':'cape verde','ivoorkust':'ivory coast','zuidafrika':'south africa',
  'verenigdestaten':'usa','argentinie':'argentina','japan':'japan','zuidkorea':'south korea','australie':'australia',
  'saoediarabie':'saudi arabia','senegal':'senegal','ghana':'ghana','nigeria':'nigeria','kameroen':'cameroon',
  'tunesie':'tunisia','paraguay':'paraguay','uruguay':'uruguay','chili':'chile','ecuador':'ecuador','servie':'serbia',
  'hongarije':'hungary','roemenie':'romania','slowakije':'slovakia','oekraine':'ukraine','costarica':'costa rica'
};
function teamsMatch(nlName, apiName) {
  const norm = x => String(x||'').toLowerCase().replace(/[^a-z]/g,'');
  let a = norm(nlName); const b = norm(apiName);
  if (NL_EN_LAND[a]) a = norm(NL_EN_LAND[a]);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (a.length>=4 && b.length>=4 && a.slice(0,4)===b.slice(0,4)) return true;
  return false;
}

function settleAsianPick(pick, hg, ag, homeName, awayName, stake, odds) {
  try {
    if (!pick) return null;
    const s = String(pick).toLowerCase().trim();
    const total = (hg||0) + (ag||0);
    stake = parseFloat(stake)||0; odds = parseFloat(odds)||0;
    if (stake<=0 || odds<=1) return null;
    const norm = x => String(x||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
    const words = x => norm(x).split(' ').filter(w => w.length>2);
    const toReturn = o => o>0 ? stake + o*stake*(odds-1) : o<0 ? stake*(1+o) : stake; // o: 1,.5,0,-.5,-1
    const lbl = o => o>=1?'gewonnen':o>=0.5?'½ gewonnen':o>0?'':o===0?'push (inzet terug)':o<=-1?'verloren':'½ verloren';
    // v26.276: status vergelijkt payout met de INZET, niet met nul.
    //   R > inzet  -> win  (ook halve winst)
    //   R = inzet  -> push (inzet terug; telt niet mee in de hitrate)
    //   R < inzet  -> lose (ook half verlies; P&L komt uit payout - inzet)
    const mk = o => {
      const R = Math.round(toReturn(o)*100)/100;
      const st = R > stake + 0.005 ? 'win' : (Math.abs(R - stake) <= 0.005 ? 'push' : 'lose');
      return { status: st, payout: R, label: lbl(o), partial: (o > -1 && o < 1) };
    };
    const single = (margin, line) => { const d=margin+line; return d>0?1:d<0?-1:0; };
    const ahLine = (margin, line) => {
      const frac = Math.round((Math.abs(line)%1)*100)/100;
      if (Math.abs(frac-0.25)<0.001 || Math.abs(frac-0.75)<0.001) return (single(margin,line-0.25)+single(margin,line+0.25))/2;
      return single(margin, line);
    };

    // ── Asian Handicap: "[team] +2.0 asian handicap" / "team 0.0 (asian handicap)" ──
    // v26.242: teken optioneel (0.0 = level/DNB) + punctuatie/haakjes tussen lijn en "asian" toegestaan
    let m = s.match(/([+\-]?\s*\d+(?:[.,]\d+)?)\s*[^a-z0-9]*asian\s*handicap/);
    if (m) {
      const line = parseFloat(m[1].replace(/\s/g,'').replace(',','.'));
      const teamTxt = s.slice(0, m.index);
      const matchHome = teamsMatch(teamTxt, homeName);
      const matchAway = teamsMatch(teamTxt, awayName);
      let margin = null;
      if (matchHome && !matchAway) margin = (hg-ag);
      else if (matchAway && !matchHome) margin = (ag-hg);
      if (margin===null) return null; // ploeg niet zeker -> laat handmatig
      return mk(ahLine(margin, line));
    }

    // ── (Asian) totaal / "meer-minder dan X.X": doelpunten O/U, ook zonder 'asian'-woord ──
    // v26.242: 'asian|doelpunt'-eis vervangen door uitsluiting van kaarten/corners/schoten,
    // zodat een kale "Meer dan 2.5" ook afrekent (goals). Kwart-/kommalijnen blijven werken.
    m = s.match(/(minder|meer)\s*dan\s*([\d.,\s]+)/);
    if (m && !/kaart|corner|hoekschop|card|schot|shot/.test(s)) {
      const isOver = m[1]==='meer';
      const lines = m[2].split(',').map(x=>parseFloat(String(x).trim().replace(',','.'))).filter(Number.isFinite);
      if (!lines.length) return null;
      const outc = lines.map(ln => { const d = isOver ? total-ln : ln-total; return d>0?1:d<0?-1:0; });
      return mk(outc.reduce((a,b)=>a+b,0)/outc.length);
    }

    // ── BTTS / beide teams scoren ──
    if (/beide\s*(teams?\s*)?scoren|both\s*teams|btts/.test(s)) {
      const isNo = /\bnee\b|\bno\b|niet/.test(s);
      const bttsYes = (hg>0 && ag>0);
      return mk((isNo ? !bttsYes : bttsYes) ? 1 : -1);
    }

    return null; // geen Asian/BTTS-variant herkend
  } catch(e) { return null; }
}

async function checkBetResult(betId) {
  const bet = state.wallet.bets.find(b => b.id === betId);
  if (!bet) return;
  const legs = bet.type === 'combi' ? bet.legs : [{home: bet.matchName?.split(' vs ')?.[0], away: bet.matchName?.split(' vs ')?.[1], pick: bet.pick, fixtureId: bet.fixtureId}];

  function parseBetDate(s) {
    if (!s) return null;
    const p = s.split('-');
    if (p.length === 3) {
      if (p[0].length === 4) return s;
      return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    }
    return null;
  }

  async function fetchFixtureById(fid) {
    try {
      const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?id=${fid}`, null);
      const d = await r.json();
      return (d.response||[])[0] || null;
    } catch(e) { return null; }
  }

  async function fetchFixturesByDate(date) {
    try {
      const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, null);
      const d = await r.json();
      return d.response || [];
    } catch(e) { return []; }
  }

  for (const leg of legs) {
    try {
      let fix = null;
      const fid = leg.fixtureId || bet.fixtureId;
      if (fid) fix = await fetchFixtureById(fid);
      if (!fix || !['FT','AET','PEN'].includes(fix?.fixture?.status?.short)) {
        const betDate = parseBetDate(bet.date);
        if (betDate && leg.home && leg.away) {
          const pool = await fetchFixturesByDate(betDate);
          const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
          const words = s => norm(s).split(' ').filter(w => w.length > 2);
          const hwds = words(leg.home), awds = words(leg.away);
          fix = pool.find(f => {
            if (!['FT','AET','PEN'].includes(f.fixture.status.short)) return false;
            const fh = norm(f.teams.home.name), fa = norm(f.teams.away.name);
            return hwds.some(w => fh.includes(w)) && awds.some(w => fa.includes(w));
          });
        }
      }
      if (!fix || !['FT','AET','PEN'].includes(fix?.fixture?.status?.short)) continue;
      const hg = fix.goals.home ?? 0, ag = fix.goals.away ?? 0;
      leg.score = `${hg}-${ag}`;
      // v26.228: Asian Handicap / Asian totalen / BTTS eerst proberen
      if (bet.type !== 'combi') {
        const _asian = settleAsianPick(leg.pick, hg, ag, fix.teams.home.name, fix.teams.away.name, bet.amount||bet.stake, bet.odds);
        if (_asian) { leg.asian = _asian; leg.legStatus = _asian.status; continue; }
      }
      let won = false;
      const p = leg.pick;
      const _g = (typeof settleGoalPick === 'function') ? settleGoalPick(p, hg, ag) : null;
      if (_g != null) won = (_g === 'win');
      else if (p==='1') won=hg>ag; else if(p==='2') won=ag>hg; else if(p==='X') won=hg===ag;
      else if(p==='1X') won=hg>=ag; else if(p==='X2') won=ag>=hg;
      leg.legStatus = won ? 'win' : 'lose';
    } catch(e) {}
  }

  if (bet.type === 'combi') {
    const anyLose = legs.some(l => l.legStatus==='lose');
    const allWin  = legs.every(l => l.legStatus==='win');
    if (anyLose && bet.status==='pending') bet.status='lose';
    else if (allWin && bet.status==='pending') { bet.status='win'; state.wallet.balance+=bet.payout; state.wallet.totalWon+=bet.payout; }
  } else {
    const leg = legs[0];
    bet.score = leg.score;
    if (leg.asian && bet.status==='pending') {
      bet.resultLabel = leg.asian.label;
      if (leg.asian.status==='win') { bet.status='win'; bet.payout=leg.asian.payout; state.wallet.balance+=leg.asian.payout; state.wallet.totalWon+=leg.asian.payout; }
      else { bet.status='lose'; }
    }
    else if (leg.legStatus==='win' && bet.status==='pending') { bet.status='win'; state.wallet.balance+=bet.payout; state.wallet.totalWon+=bet.payout; }
    else if (leg.legStatus==='lose' && bet.status==='pending') { bet.status='lose'; }
  }
  saveState(); updateWalletUI();
}

function cycleCombiBetStatus(id) {
  const b = state.wallet.bets.find(x => x.id===id);
  if (!b || b.type!=='combi') return;
  if (b.status==='pending') { b.status='win'; b.legs.forEach(l=>l.legStatus='win'); state.wallet.balance+=b.payout; state.wallet.totalWon+=b.payout; }
  else if (b.status==='win') { b.status='pending'; b.legs.forEach(l=>{l.legStatus='pending';l.score=null;}); state.wallet.balance-=b.payout; state.wallet.totalWon-=b.payout; }
  else { b.status='pending'; b.legs.forEach(l=>{l.legStatus='pending';l.score=null;}); }
  saveState(); updateWalletUI();
}

function deleteBet(id) {
  const bet = state.wallet.bets.find(b => b.id===id);
  if (!bet) return;
  const label = bet.type==='combi' ? `Combi €${bet.amount?.toFixed(2)}` : `${bet.matchName} — ${bet.pick}`;
  if (!confirm(`${t('wal.deletelabel','Verwijderen')}: ${label}?`)) return;
  if (bet.status==='pending') { state.wallet.balance+=bet.amount; state.wallet.totalStaked-=bet.amount; }
  if (bet.status==='win')     { state.wallet.balance-=bet.payout; state.wallet.totalWon-=bet.payout; }
  state.wallet.bets = state.wallet.bets.filter(b => b.id!==id);
  saveState(); updateWalletUI();
}

function cycleBetStatus(id) {
  const b = state.wallet.bets.find(x => x.id===id);
  if (!b) return;
  if (b.status==='pending') { b.status='win'; state.wallet.balance+=b.payout; state.wallet.totalWon+=b.payout; }
  else if (b.status==='win') { state.wallet.balance-=b.payout; state.wallet.totalWon-=b.payout; b.status='lose'; b.score=null; }
  else { b.status='pending'; b.score=null; }
  saveState(); updateWalletUI();
}

function openDepositModal() { const m = document.getElementById('deposit-modal'); if(m) m.style.display='flex'; }
function openWithdrawModal() {
  const amt = parseFloat(prompt('Opnemen (€):', '50'));
  if (amt && amt>0 && amt<=state.wallet.balance) { state.wallet.balance-=amt; saveState(); updateWalletUI(); }
}
function confirmDeposit() {
  const amt = parseFloat(document.getElementById('deposit-amount')?.value || document.getElementById('depositInput')?.value);
  if (amt && amt>0) { state.wallet.balance+=amt; state.wallet.totalStaked = state.wallet.totalStaked||0; saveState(); updateWalletUI(); }
  const m = document.getElementById('deposit-modal'); if(m) m.style.display='none';
}
function closeModal(id) { const el=document.getElementById(id); if(el) { el.classList.remove('show'); el.style.display='none'; } }
// v26.9: ontbrekende sluit-functies — knoppen (✕/Annuleren/backdrop) riepen niet-bestaande functies aan
function closeDepositModal()  { closeModal('deposit-modal'); }
function closeWithdrawModal() { closeModal('withdraw-modal'); }
function closeTrackerModal()  { closeModal('tracker-modal'); }
function clearWallet() {
  if (!confirm(t('wal.confirmclearall','Weet je het zeker? Dit wist ALLE inzetten.'))) return;
  const nb = parseInt(document.getElementById('settStartBalance')?.value)||state.settings.startBalance||500;
  state.wallet.balance=nb; state.wallet.totalStaked=0; state.wallet.totalWon=0; state.wallet.bets=[];
  state.settings.startBalance=nb;
  saveState(); updateWalletUI(); applySettings();
  showAutoCheckBar('🗑 Wallet gewist','#dc2626');
}

// ── WALLET CHART ──────────────────────────────────────────

let chartView   = 'saldo';
let chartSource = 'all';

function setChartSource(src) {
  chartSource = src;
  document.querySelectorAll('[id^="cs-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('cs-'+src)?.classList.add('active');
  renderWalletChart();
}
function setChartView(v) {
  chartView = v;
  ['saldo','pnl'].forEach(x => {
    const b = document.getElementById('cv-'+x);
    if (!b) return;
    if (x===v) { b.style.background='rgba(0,190,196,.1)'; b.style.borderColor='rgba(0,190,196,.4)'; b.style.color='#00BEC4'; }
    else { b.style.background='transparent'; b.style.borderColor='rgba(15,23,42,.12)'; b.style.color='#475569'; }
  });
  renderWalletChart();
}

function renderWalletChart() {
  const canvas = document.getElementById('walletChart');
  const emptyEl = document.getElementById('chartEmpty');
  if (!canvas) return;
  const sb = state.settings.startBalance || 500;
  const allSettled = [...state.wallet.bets].reverse().filter(b => b.status!=='pending');
  const settled = chartSource==='all' ? allSettled : allSettled.filter(b => (b.source||'eigen')===chartSource);
  if (!settled.length) {
    canvas.style.display='none';
    if (emptyEl) { emptyEl.style.display='block'; emptyEl.textContent=chartSource==='all'?t('wal.nofinished','Nog geen afgeronde weddenschappen'):t('wal.nobetssource','Geen bets voor deze bron'); }
    return;
  }
  canvas.style.display='block';
  if (emptyEl) emptyEl.style.display='none';
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth||360, H = canvas.height||100;
  canvas.width = W;
  ctx.clearRect(0,0,W,H);
  let points = [];
  if (chartView==='saldo') {
    let bal = sb; points = [bal];
    settled.forEach(b => { bal += pmxProfit(b); points.push(bal); });   // v26.276
  } else {
    let pnl = 0; points = [pnl];
    settled.forEach(b => { pnl += pmxProfit(b); points.push(pnl); });   // v26.276
  }
  const minV=Math.min(...points,chartView==='pnl'?-1:sb*0.5);
  const maxV=Math.max(...points,chartView==='pnl'?1:sb*1.1);
  const range=Math.max(maxV-minV,0.01);
  const pad={top:12,bottom:14,left:38,right:8};
  const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;
  const xP=i=>pad.left+(i/Math.max(points.length-1,1))*cw;
  const yP=v=>pad.top+ch-((v-minV)/range)*ch;
  const zeroVal = chartView==='pnl' ? 0 : sb;
  const zeroY = yP(zeroVal);
  ctx.setLineDash([3,3]); ctx.strokeStyle=document.body.classList.contains('creme')?'rgba(139,90,43,.30)':'rgba(148,163,184,.5)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad.left,zeroY); ctx.lineTo(pad.left+cw,zeroY); ctx.stroke();
  ctx.setLineDash([]);
  const lastVal=points[points.length-1];
  const isPos = chartView==='pnl' ? lastVal>=0 : lastVal>=(sb||500);
  const lineColor = isPos ? '#00BEC4' : '#dc2626';
  const grad = ctx.createLinearGradient(0,pad.top,0,pad.top+ch);
  grad.addColorStop(0, isPos ? 'rgba(21,128,61,.2)' : 'rgba(220,38,38,.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.moveTo(xP(0), yP(points[0]));
  points.forEach((v,i) => { if (i>0) ctx.lineTo(xP(i),yP(v)); });
  ctx.lineTo(xP(points.length-1), H-pad.bottom); ctx.lineTo(xP(0), H-pad.bottom);
  ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
  ctx.beginPath(); ctx.moveTo(xP(0), yP(points[0]));
  points.forEach((v,i) => { if (i>0) ctx.lineTo(xP(i),yP(v)); });
  ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  settled.forEach((b,i) => {
    ctx.beginPath(); ctx.arc(xP(i+1), yP(points[i+1]), 3, 0, Math.PI*2);
    ctx.fillStyle = b.status==='win' ? '#00BEC4' : '#dc2626';
    ctx.fill(); ctx.strokeStyle=document.body.classList.contains('creme')?'#fffaf2':'#fff'; ctx.lineWidth=1.5; ctx.stroke();
  });
  ctx.fillStyle=document.body.classList.contains('creme')?'#6a4a2c':'#94a3b8'; ctx.font='9px IBM Plex Mono, monospace'; ctx.textAlign='right';
  const labelVal = chartView==='pnl' ? (lastVal>=0?'+':'')+lastVal.toFixed(0)+' €' : '€'+lastVal.toFixed(0);
  ctx.fillText(labelVal, pad.left-3, yP(lastVal)+3);
  ctx.fillText(chartView==='pnl' ? '0' : '€'+sb.toFixed(0), pad.left-3, zeroY+3);
}

// v26.240: Tracker equity-curve — cumulatief W/V van afgerekende tracker-bets op #trackerChart.
// Zelfde canvas-stijl als de wallet-chart. Toont het (voorheen verborgen) chart-blok zodra er data is.
function renderTrackerChart() {
  const canvas = document.getElementById('trackerChart');
  const wrap = document.getElementById('trackerChartWrap');
  if (!canvas) return;
  const settled = [...(state.tracker?.bets || [])].reverse().filter(b => b.status === 'win' || b.status === 'lose');
  if (settled.length < 2) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 360, H = canvas.height || 90;
  canvas.width = W;
  ctx.clearRect(0, 0, W, H);
  const creme = document.body.classList.contains('creme');
  // v26.283: saldo-gebaseerd (start op de bankroll i.p.v. 0) -> curve toont bankroll-ontwikkeling
  const _start = trBankroll();
  let bal = _start; const points = [_start];
  settled.forEach(b => { bal += pmxProfit(b); points.push(bal); });
  const minV = Math.min(...points, _start), maxV = Math.max(...points, _start);
  const range = Math.max(maxV - minV, 0.01);
  const pad = { top: 12, bottom: 14, left: 40, right: 8 };
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const xP = i => pad.left + (i / Math.max(points.length - 1, 1)) * cw;
  const yP = v => pad.top + ch - ((v - minV) / range) * ch;
  const zeroY = yP(_start);
  // nul-lijn
  ctx.setLineDash([3, 3]); ctx.strokeStyle = creme ? 'rgba(139,90,43,.30)' : 'rgba(148,163,184,.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + cw, zeroY); ctx.stroke();
  ctx.setLineDash([]);
  const lastVal = points[points.length - 1];
  const isPos = lastVal >= _start;
  const lineColor = isPos ? '#00BEC4' : '#dc2626';
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, isPos ? 'rgba(21,128,61,.2)' : 'rgba(220,38,38,.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  // vlak onder de lijn
  ctx.beginPath(); ctx.moveTo(xP(0), yP(points[0]));
  points.forEach((v, i) => { if (i > 0) ctx.lineTo(xP(i), yP(v)); });
  ctx.lineTo(xP(points.length - 1), H - pad.bottom); ctx.lineTo(xP(0), H - pad.bottom);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  // lijn
  ctx.beginPath(); ctx.moveTo(xP(0), yP(points[0]));
  points.forEach((v, i) => { if (i > 0) ctx.lineTo(xP(i), yP(v)); });
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  // punten per bet (kleur = win/verlies)
  settled.forEach((b, i) => {
    ctx.beginPath(); ctx.arc(xP(i + 1), yP(points[i + 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = b.status === 'win' ? '#00BEC4' : '#dc2626';
    ctx.fill(); ctx.strokeStyle = creme ? '#fffaf2' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  // labels
  ctx.fillStyle = creme ? '#6a4a2c' : '#94a3b8'; ctx.font = '9px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
  ctx.fillText((lastVal >= 0 ? '+' : '') + lastVal.toFixed(0) + ' \u20ac', pad.left - 3, yP(lastVal) + 3);
  ctx.fillText('0', pad.left - 3, zeroY + 3);
}

// ── LIVE SCORE POLLING ────────────────────────────────────

function startLiveScorePolling() {
  if (_liveScoreInterval) return;
  fetchLiveScoresForBets();
  _liveScoreInterval = setInterval(fetchLiveScoresForBets, 60000);
}
function stopLiveScorePolling() {
  if (_liveScoreInterval) { clearInterval(_liveScoreInterval); _liveScoreInterval=null; }
}
async function fetchLiveScoresForBets() {
  const openBets = (state.wallet?.bets||[]).filter(b => b.status==='pending'&&b.fixtureId);
  if (!openBets.length) return;
  try {
    const r = await apiFetch('https://v3.football.api-sports.io/fixtures?live=all', null, 8000);
    const data = await r.json();
    const liveFixtures = data.response||[];
    let updated = false;
    for (const bet of openBets) {
      const fix = liveFixtures.find(f => String(f.fixture.id)===String(bet.fixtureId));
      if (!fix) { if (bet.liveScore) { delete bet.liveScore; delete bet.liveMinute; updated=true; } continue; }
      const score = `${fix.goals.home??0}-${fix.goals.away??0}`;
      const minute = fix.fixture.status.elapsed||'';
      if (bet.liveScore!==score||bet.liveMinute!==minute) { bet.liveScore=score; bet.liveMinute=minute; updated=true; }
    }
    if (updated) { updateWalletUI(); saveState(); }
  } catch(e) {}
}

// ── CSV EXPORTS ───────────────────────────────────────────

function exportWalletCSV() {
  const bets = state.wallet?.bets||[];
  if (!bets.length) { alert(t('wal.noexport','Geen bets om te exporteren')); return; }
  const headers = ['Datum','Wedstrijd','Pick','Quote','Inzet','Uitbetaling','W/V','Status','Score','Bron'];
  const rows = bets.map(b => {
    const pnl = b.status==='win' ? (b.payout-(b.amount||b.stake)).toFixed(2)
              : b.status==='lose' ? (-(b.amount||b.stake)).toFixed(2) : '0';
    return [b.date,b.matchName||b.match||'',b.pick,b.odds,b.amount||b.stake||0,b.payout||0,pnl,b.status,b.score||'',(b.source||'eigen')].join(',');
  });
  downloadFile([headers.join(','),...rows].join('\n'), 'totoai-wallet-'+new Date().toLocaleDateString('nl-NL').replace(/\//g,'-')+'.csv', 'text/csv');
}

function exportTrackerCSV() {
  const bets = state.tracker?.bets||[];
  if (!bets.length) { alert(t('wal.notrackerbets','Geen tracker bets')); return; }
  const headers = ['Datum','Wedstrijd','Pick','Quote','Inzet','Uitbetaling','Status','Score','Bron','Bookmaker','Note'];
  const rows = bets.map(b => [b.date,b.match||'',b.pick,b.odds,b.stake,b.payout,b.status,b.score||'',(b.source||'eigen'),b.bookmaker||'',(b.note||'').replace(/,/g,' ')].join(','));
  downloadFile([headers.join(','),...rows].join('\n'), 'totoai-tracker-'+new Date().toLocaleDateString('nl-NL').replace(/\//g,'-')+'.csv', 'text/csv');
}

// ── BET MODAL ─────────────────────────────────────────────

// pendingBet gedeclareerd in ui.js

function updateBetReturn() {
  const stake = parseFloat(document.getElementById('bet-stake')?.value) || 0;
  const odds  = parseFloat(document.getElementById('bet-odds')?.value)  || 0;
  const ret   = document.getElementById('bet-return-value');
  if (ret) {
    const winst = stake * odds;
    ret.textContent = winst > 0 ? '€' + winst.toFixed(2) : '€0.00';
  }
}

function openBetModal(event, matchId, pick, pickLabel, odds) {
  const match = (state.matches||[]).find(m => String(m.id) === String(matchId));
  pendingBet = {
    match: match || { id: matchId, home: '?', away: '?' },
    pick, pickLabel, odds: parseFloat(odds), markt: '1X2',
    _origPick: pick, _origPickLabel: pickLabel, _origOdds: parseFloat(odds)
  };

  const home = match?.home || '?';
  const away = match?.away || '?';

  // v18.9: nieuwe card modal velden vullen
  const title = document.getElementById('bet-modal-title');
  if (title) title.textContent = home + ' vs ' + away;

  const pickDisplay = document.getElementById('bet-pick-display');
  if (pickDisplay) pickDisplay.textContent = pick + ' — ' + pickLabel;

  const oddsDisplay = document.getElementById('bet-odds-display');
  if (oddsDisplay) oddsDisplay.textContent = parseFloat(odds).toFixed(2);

  const matchInput = document.getElementById('bet-match');
  if (matchInput) matchInput.value = match ? home + ' vs ' + away : '';

  const stakeInput = document.getElementById('bet-stake');
  if (stakeInput) stakeInput.value = state.settings.defaultBet || 10;

  const oddsInput = document.getElementById('bet-odds');
  if (oddsInput) oddsInput.value = odds;

  const noteInput = document.getElementById('bet-note');
  if (noteInput) noteInput.value = pickLabel || pick;

  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'flex';

  // Bereken initiële return
  setTimeout(updateBetReturn, 50);
}

function closeBetModal() {
  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'none';
  pendingBet = null;
}

function confirmBet() {
  const stake = parseFloat(document.getElementById('bet-stake')?.value) || 0;
  const odds  = parseFloat(document.getElementById('bet-odds')?.value)  || 0;
  const note  = document.getElementById('bet-note')?.value?.trim() || '';

  if (!stake || stake <= 0) { alert(t('wal.fillstake','Vul een geldige inzet in')); return; }
  if (!odds  || odds  <= 1) { alert(t('wal.fillodds','Vul een geldige quote in'));  return; }
  if (stake > state.wallet.balance) { alert('Onvoldoende saldo!'); return; }

  const pb    = pendingBet || {};
  const match = pb.match   || {};
  const pick  = pb.pick    || '?';
  const pl    = pb.pickLabel || pick;

  const bet = {
    id:        Date.now(),
    matchName: match.home && match.away ? `${match.home} vs ${match.away}` : (document.getElementById('bet-match')?.value || '?'),
    fixtureId: match.id || null,
    pick, pickLabel: pl,
    markt:     document.getElementById('bet-type')?.value || '1X2',
    odds:      parseFloat(odds.toFixed(2)),
    amount:    stake,
    payout:    parseFloat((stake * odds).toFixed(2)),
    status:    'pending',
    date:      new Date().toLocaleDateString('nl-NL'),
    note,
    source:    'analyse'
  };

  state.wallet.balance    -= stake;
  state.wallet.totalStaked += stake;
  state.wallet.bets.unshift(bet);
  saveState();
  closeBetModal();
  showToast(`✅ Bet geplaatst: ${pl} @ ${odds} · €${stake}`);
  updateWalletUI();
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

// ── TRACKER FUNCTIES ──────────────────────────────────────

function setTrackerType(type) {
  trackerType = type;
  const setStyle = (id, active) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background  = active ? 'rgba(0,190,196,.1)' : 'transparent';
    el.style.borderWidth = active ? '2px' : '1.5px';
    el.style.color       = active ? '#00BEC4' : '#475569';
  };
  setStyle('trTypeSingle', type==='single');
  setStyle('trTypeCombi',  type==='combi');
  document.getElementById('trSingleSection').style.display = type==='single' ? 'block' : 'none';
  document.getElementById('trPickSection').style.display   = type==='single' ? 'grid'  : 'none';
  document.getElementById('trOddsSection').style.display   = type==='single' ? 'grid'  : 'none';
  document.getElementById('trCombiSection').style.display  = type==='combi'  ? 'block' : 'none';
  if (type==='combi' && trackerLegs.length===0) { addTrackerLeg(); addTrackerLeg(); }
}

function addTrackerLeg() {
  trackerLegs.push({ id: Date.now()+Math.random(), match:'', pick:'', odds:'' });
  renderTrackerLegs();
}
function removeTrackerLeg(id) {
  if (trackerLegs.length<=2) return;
  trackerLegs = trackerLegs.filter(l => l.id!==id);
  renderTrackerLegs();
}
function renderTrackerLegs() {
  const container = document.getElementById('trLegsContainer');
  if (!container) return;
  container.innerHTML = trackerLegs.map((leg, i) => `
    <div class="tr-combi-leg">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="tr-combi-leg-num">LEG ${i+1}</div>
        ${trackerLegs.length>2 ? `<button onclick="removeTrackerLeg(${leg.id})" class="del-btn">✕</button>` : ''}
      </div>
      <input class="modal-input" placeholder="Wedstrijd" value="${leg.match}" oninput="trackerLegs[${i}].match=this.value">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">
        <input class="modal-input" placeholder="Pick" value="${leg.pick}" oninput="trackerLegs[${i}].pick=this.value">
        <input class="modal-input" type="number" step="0.01" placeholder="Quote" value="${leg.odds}" oninput="trackerLegs[${i}].odds=this.value;updateCombiTotal()">
      </div>
    </div>
  `).join('');
  updateCombiTotal();
}
function updateCombiTotal() {
  const el = document.getElementById('trCombiTotal');
  if (!el) return;
  const odds = trackerLegs.map(l => parseFloat(l.odds)).filter(o => o>1);
  if (odds.length<2) { el.textContent='Gecombineerde quote: —'; return; }
  el.textContent = `Gecombineerde quote: ${odds.reduce((a,b)=>a*b,1).toFixed(2)} (${odds.length} legs)`;
}

function openTrackerModal() {
  trackerType='single'; trackerLegs=[];
  setTrackerType('single');
  const trDate = document.getElementById('trDate');
  const trMatch = document.getElementById('trMatch');
  const trStake = document.getElementById('trStakeInput');
  if (trDate)  trDate.value  = new Date().toISOString().split('T')[0];
  if (trMatch) trMatch.value = state.selectedMatch ? `${state.selectedMatch.home} vs ${state.selectedMatch.away}` : '';
  if (trStake) trStake.value = state.settings.defaultBet||10;
  ['trBookmaker','trPick','trOdds','trNote'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  selectTrackerSource('eigen');
  const tm = document.getElementById('tracker-modal') || document.getElementById('trackerModal'); if(tm) { tm.style.display='flex'; }
}
function selectTrackerSource(src) {
  trackerSource=src;
  ['analyse','combi','value','eigen'].forEach(s => {
    const btn = document.getElementById('trs-'+s);
    if (btn) { btn.style.opacity=s===src?'1':'0.45'; btn.style.fontWeight=s===src?'900':'700'; }
  });
}
function confirmTracker() {
  const stake    = parseFloat(document.getElementById('trStakeInput').value);
  const date     = document.getElementById('trDate').value;
  const bookmaker= document.getElementById('trBookmaker').value.trim();
  const note     = document.getElementById('trNote').value.trim();
  if (!stake) { alert(t('wal.fillstake2','Vul een inzet in')); return; }
  let bet;
  if (trackerType==='combi') {
    const validLegs = trackerLegs.filter(l => l.match&&l.pick&&parseFloat(l.odds)>1);
    if (validLegs.length<2) { alert(t('wal.fill2legs','Vul minimaal 2 complete legs in')); return; }
    const combiOdds = validLegs.reduce((a,l)=>a*parseFloat(l.odds),1);
    bet = {
      id: Date.now(), match:`Combi: ${validLegs.map(l=>l.match.split(' vs ')[0]).join(' + ')}`,
      type:'combi', legs:validLegs.map(l=>({match:l.match,pick:l.pick,odds:parseFloat(l.odds),status:'pending'})),
      date, bookmaker, pick:validLegs.map(l=>l.pick).join(' + '), markt:'Combi',
      odds:parseFloat(combiOdds.toFixed(2)), stake, payout:parseFloat((stake*combiOdds).toFixed(2)),
      source:trackerSource, note, status:'pending', score:null
    };
  } else {
    const match = document.getElementById('trMatch').value.trim();
    const pick  = document.getElementById('trPick').value.trim();
    const odds  = parseFloat(document.getElementById('trOdds').value);
    if (!match||!pick||!odds) { alert(t('wal.fillall','Vul alle velden in')); return; }
    bet = {
      id:Date.now(), match, date, bookmaker, pick, markt:document.getElementById('trMarkt').value,
      odds, stake, payout:parseFloat((stake*odds).toFixed(2)), source:trackerSource, note, status:'pending', score:null
    };
  }
  state.tracker.bets.unshift(bet);
  saveState(); closeModal('tracker-modal'); renderTracker(); updateTrackerStats();
}

function setTrackerFilter(f) {
  trackerFilter=f;
  document.querySelectorAll('.tracker-filter').forEach(b => b.classList.remove('active'));
  document.getElementById('tf-'+f)?.classList.add('active');
  renderTracker();
}
function cycleTrackerStatus(id) {
  const b = state.tracker.bets.find(x => x.id===id);
  if (!b) return;
  b.status = b.status==='pending'?'win':b.status==='win'?'lose':'pending';
  saveState(); renderTracker(); updateTrackerStats();
}

// v26.229: auto-check voor tracker-bets (geïmporteerde Jacks-weddenschappen) — Asian Handicap/totalen/BTTS/1X2
// v26.277: pure settle-kern (geen API, geen DOM) — één bron voor checkTrackerBet én de migratie,
// zodat de payout-berekening niet op twee plekken kan wegdriften. Payout = WERKELIJKE terugbetaling
// (0 bij verlies, halve inzet bij half verlies, inzet bij push, bruto bij winst) — herberekend uit
// inzet+quote, nooit uit een mogelijk-vervuild opgeslagen payout-veld.
function pmxSettleFromScore(b, hg, ag, homeName, awayName) {
  const stake = pmxStake(b), odds = parseFloat(b.odds)||0;
  let res = settleAsianPick(b.pick, hg, ag, homeName, awayName, stake, odds);
  if (!res) {
    const p = String(b.pick||''); let won = null;
    const _g = (typeof settleGoalPick === 'function') ? settleGoalPick(p, hg, ag) : null;
    if (_g != null) won = (_g === 'win');
    else if (/^1$|thuis/i.test(p)) won = hg > ag;
    else if (/^2$|\buit\b/i.test(p)) won = ag > hg;
    else if (/^x$|gelijk/i.test(p)) won = hg === ag;
    if (won !== null) res = { status: won?'win':'lose', payout: won ? Math.round(stake*odds*100)/100 : 0, label: won?'gewonnen':'verloren' };
  }
  return res;
}

// v26.277: eenmalige correctie van reeds afgerekende tracker-bets. Onder oude code werd de payout bij
// een verlies/half verlies/push NIET weggeschreven (alleen bij winst) -> b.payout bleef de BRUTO-winst
// staan. Dat maakte de nieuwe pmxProfit-weergave fout (een verloren bet leek winst). Herberekent lokaal
// op de opgeslagen eindstand — geen API-call. Draait 1x per apparaat.
function pmxFixTrackerPayouts() {
  try {
    if (!state.tracker || state.tracker._payoutFixV277) return;
    let changed = 0;
    for (const b of (state.tracker.bets||[])) {
      if (!pmxIsSettled(b) || !b.score) continue;
      const sc = String(b.score).split('-');
      const hg = parseInt(sc[0],10), ag = parseInt(sc[1],10);
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      const parts = String(b.match||'').split(/\s+(?:vs?\.?|[-–—])\s+/i);
      const res = pmxSettleFromScore(b, hg, ag, (parts[0]||'').trim(), (parts[1]||'').trim());
      if (res && res.payout != null) {
        const newP = Math.round(res.payout*100)/100;
        if (b.status !== res.status || Math.abs((parseFloat(b.payout)||0) - newP) > 0.005) {
          b.status = res.status; b.payout = newP; if (res.label) b.resultLabel = res.label; changed++;
        }
      }
    }
    state.tracker._payoutFixV277 = true;
    if (changed > 0) { saveState(); }
  } catch(e) {}
}

async function checkTrackerBet(id, silent) {
  const b = (state.tracker.bets||[]).find(x => x.id===id);
  if (!b || b.status!=='pending') return;
  if(!silent){ try { showToast('🔍 Uitslag ophalen...'); } catch(e){} }
  try {
    // v26.242: robuuste scheiding — " v ", " vs ", "vs.", " - " en dash-varianten (screenshot-import wisselt)
    const parts = String(b.match||'').split(/\s+(?:vs?\.?|[-–—])\s+/i);
    const homeName = (parts[0]||'').trim(), awayName = (parts[1]||'').trim();
    if (!homeName || !awayName) { if(!silent) showToast('⚠ Kan teams niet lezen — vink handmatig af'); return; }
    const parseDate = x => { if(!x) return null; const p=String(x).split('-'); if(p.length===3){ return p[0].length===4 ? x : `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`; } return null; };
    const date = parseDate(b.date);
    const okStatus = f => ['FT','AET','PEN'].includes(f?.fixture?.status?.short);
    const matchesTeams = f => teamsMatch(homeName, f.teams.home.name) && teamsMatch(awayName, f.teams.away.name);
    let fix = null;
    if (b.fixtureId) { try { const r=await apiFetch(`https://v3.football.api-sports.io/fixtures?id=${b.fixtureId}`,null); const d=await r.json(); fix=(d.response||[])[0]||null; } catch(e){} }
    if ((!fix || !okStatus(fix)) && date) {
      // v26.242: exacte datum + venster ±2 dagen — vangt een verkeerd geïmporteerde/OCR-datum op.
      // teamsMatch eist beide teams, dus een vals-positieve match op een naburige dag is voor een
      // vast duo (bv. twee landen) praktisch uitgesloten. Datum-calls zijn edge-gecachet in de proxy.
      const shift = (iso, days) => { const d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); };
      const tryDates = [date, shift(date,1), shift(date,-1), shift(date,2), shift(date,-2)];
      // v26.277: screenshot-import gokt soms het JAAR verkeerd (bv. 2025 i.p.v. 2026); een dag-venster
      // van ±2 vangt dat niet. Voeg de zelfde dag/maand in het huidige en vorige jaar toe (±1 dag).
      // teamsMatch eist BEIDE teams, dus een vals-positief op een ander jaar is praktisch uitgesloten.
      const _yr = new Date().getUTCFullYear();
      for (const _y of [_yr, _yr - 1]) {
        const _yd = `${_y}${date.slice(4)}`;
        for (const _c of [_yd, shift(_yd,1), shift(_yd,-1)]) if (!tryDates.includes(_c)) tryDates.push(_c);
      }
      for (const dd of tryDates) {
        try {
          const r=await apiFetch(`https://v3.football.api-sports.io/fixtures?date=${dd}`,null); const d=await r.json(); const pool=d.response||[];
          const found=pool.find(f => okStatus(f) && matchesTeams(f));
          if (found) { fix=found; break; }
        } catch(e){}
      }
    }
    if (!fix || !okStatus(fix)) { if(!silent) showToast('⏳ Nog geen eindstand — probeer later of vink handmatig'); return; }
    const hg=fix.goals.home??0, ag=fix.goals.away??0; b.score=`${hg}-${ag}`;
    const res = pmxSettleFromScore(b, hg, ag, fix.teams.home.name, fix.teams.away.name);
    if (!res) { if(!silent) showToast('⚠ Markt niet auto-herkend — vink handmatig af'); return; }
    // v26.277: payout = werkelijke terugbetaling, ALTIJD wegschrijven (was: alleen bij winst -> half
    // verlies/push behield de bruto-payout en werd verkeerd weergegeven).
    b.status=res.status; if (res.payout != null) b.payout=res.payout; b.resultLabel=res.label;
    saveState(); renderTracker(); updateTrackerStats();
    if(!silent) showToast(`✅ ${res.label} (${b.score})`);
  } catch(e) { if(!silent) showToast('⚠ Fout bij ophalen — vink handmatig af'); }
}

// v26.243: automatische tracker-settlement — draait stil bij openen van de Tracker.
// Max 1x/15 min (throttle in state.tracker._lastAutoCheck), alleen bets waarvan de aftrap
// voorbij is, API-vriendelijk gespreid (1,2s), niet-blokkerend (fire-and-forget vanuit setWalletSubTab).
// Vervangt de handmatige-alleen-flow zonder de "🔍 Check alle"-knop te verwijderen.
let _trackerAutoBusy = false;
async function autoSettleTracker() {
  try {
    if (_trackerAutoBusy) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // offline: niets proberen
    if (!state.tracker) return;
    const pending = (state.tracker.bets || []).filter(b => b.status === 'pending');
    if (!pending.length) return;
    const now = Date.now();
    const last = state.tracker._lastAutoCheck || 0;
    if (now - last < 15 * 60 * 1000) return; // throttle: hooguit 1x per 15 min
    state.tracker._lastAutoCheck = now; saveState();
    // alleen duels waarvan de bet-datum (aftrap) vandaag of eerder is — bespaart API-calls op toekomstige bets
    const parseD = x => { if (!x) return null; const p = String(x).split('-'); if (p.length === 3) { return p[0].length === 4 ? x : `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`; } return null; };
    const todayISO = new Date().toISOString().slice(0, 10);
    const due = pending.filter(b => { const d = parseD(b.date); return !d || d <= todayISO; });
    if (!due.length) return;
    _trackerAutoBusy = true;
    let settled = 0;
    for (const b of due) {
      if (b.status !== 'pending') continue;
      try { await checkTrackerBet(b.id, true); } catch (e) {}
      if (b.status !== 'pending') settled++;
      await new Promise(r => setTimeout(r, 1200)); // spreiding tegen de API-minuutlimiet
    }
    if (settled > 0) {
      try { showAutoCheckBar(`\u2705 ${settled} bet(s) automatisch afgerekend`); } catch (e) {}
      try { renderTracker(); updateTrackerStats(); if (typeof renderTrackerChart === 'function') renderTrackerChart(); } catch (e) {}
    }
  } catch (e) { /* stil — auto-settle mag nooit de UI breken */ }
  finally { _trackerAutoBusy = false; }
}

// v26.230: alle open tracker-weddenschappen in één keer afrekenen (met spreiding tegen de API-minuutlimiet)
async function checkAllTrackerBets() {
  const pending = (state.tracker.bets||[]).filter(b => b.status==='pending');
  if (!pending.length) { try{ showToast('Geen open weddenschappen'); }catch(e){} return; }
  try{ showToast(`🔍 ${pending.length} open weddenschappen checken...`); }catch(e){}
  let settled = 0;
  for (const b of pending) {
    try { await checkTrackerBet(b.id, true); } catch(e) {}
    if (b.status !== 'pending') settled++;
    await new Promise(r => setTimeout(r, 1200)); // spreiding; edge-cache vangt herhaalde datum-calls op
  }
  try{ showToast(`✅ ${settled}/${pending.length} afgerekend`); }catch(e){}
}
function deleteTrackerBet(id) {
  if (!confirm(t('wal.deleteconfirm','Verwijderen?'))) return;
  state.tracker.bets = state.tracker.bets.filter(b => b.id!==id);
  saveState(); renderTracker(); updateTrackerStats();
}

const sourceLabel = {analyse:'🤖 Analyse', combi:'⚡ Combi', value:'⚡ Value', eigen:'✏️ Eigen'};
const sourceClass = {analyse:'src-analyse', combi:'src-combi', value:'src-value', eigen:'src-eigen'};

function renderTracker() {
  const list = document.getElementById('trackerList');
  if (!list) return;
  pmxFixTrackerPayouts(); // v26.277: eenmalig oude bruto-payouts corrigeren voor een correcte weergave
  let bets = state.tracker.bets||[];
  if (trackerFilter==='open')    bets = bets.filter(b => b.status==='pending');
  else if (trackerFilter==='win')  bets = bets.filter(b => b.status==='win');
  else if (trackerFilter==='lose') bets = bets.filter(b => b.status==='lose');
  else if (['analyse','combi','value','eigen'].includes(trackerFilter))
    bets = bets.filter(b => (b.source||'eigen')===trackerFilter);
  if (typeof passesEliteFilter === 'function') bets = bets.filter(b => (b.source!=='value' && b.source!=='analyse') || passesEliteFilter(b)); // Elite/A+ alleen op scan-picks; eigen bets blijven
  if (!bets.length) { list.innerHTML='<div class="empty-state">Geen weddenschappen</div>'; return; }
  list.innerHTML = bets.map(b => {
    // v26.277: half verlies/half winst/push correct via pmxProfit — zelfde bron als de wallet-lijst (v26.276)
    const _pnl     = pmxProfit(b);
    const pnlText  = b.status==='pending' ? '⏳ Open' : pmxIsPush(b) ? 'push €0,00' : `${_pnl>=0?'+':'-'}€${Math.abs(_pnl).toFixed(2)}`;
    const pnlColor = b.status==='pending' ? '#475569' : pmxIsPush(b) ? '#b45309' : _pnl>0 ? '#00BEC4' : _pnl<0 ? '#dc2626' : '#94a3b8';
    const srcLbl   = sourceLabel[b.source||'eigen']||'✏️ Eigen';
    const srcCls   = sourceClass[b.source||'eigen']||'src-eigen';
    const isCombi  = b.type==='combi';
    const legsHtml = isCombi && b.legs ? b.legs.map(l => `
      <div class="tracker-leg-row">
        <span>${l.match||''} — ${l.pick} @ ${l.odds}</span>
        <span class="tracker-leg-status ${l.status||'pending'}">${l.status==='win'?'✓':l.status==='lose'?'✗':'⏳'}</span>
      </div>`).join('') : '';
    const _trackerIdx = (state.tracker.bets||[]).indexOf(b);
    return `<div class="tracker-row" style="cursor:pointer;" data-trackeridx="${_trackerIdx}">
      <div class="tracker-row-top">
        <div>
          <div class="tracker-match">${b.match||''}${b.score ? ` [${b.score}]`:''}</div>
          <div class="tracker-meta">${b.pick} @ ${b.odds} · ${b.date} · ${pmxBookmaker(b)}</div>
          ${isCombi ? `<div class="tracker-legs">${legsHtml}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <span class="tracker-src-badge ${srcCls}">${srcLbl}</span><br>
          <button class="del-btn" onclick="deleteTrackerBet(${b.id})" style="margin-top:.3rem;">✕</button>
        </div>
      </div>
      <div class="tracker-row-bottom">
        <span style="font-family:monospace;font-size:.58rem;color:rgba(255,255,255,.95);">€${b.stake} → €${b.payout}</span>
        ${b.note ? `<span style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);font-style:italic;">${b.note}</span>` : ''}
        <div class="tracker-result ${b.status}" onclick="cycleTrackerStatus(${b.id})" style="color:${pnlColor};">${pnlText}</div>
      </div>
    </div>`;
  }).join('');

  // Event delegation voor popup
  if (!list._popupBound) {
    list._popupBound = true;
    list.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.closest('.tracker-result')) return;
      const row = e.target.closest('[data-trackeridx]');
      if (!row) return;
      const idx = parseInt(row.dataset.trackeridx);
      const bet = (state.tracker.bets||[])[idx];
      if (bet) showWalletPopup('tracker', bet);
    });
  }
}

// v26.283: bankroll-helpers — instelbare startbankroll + unit-grootte + €/units-weergave
function trBankroll() { return (state.tracker && +state.tracker.startBankroll) || 100; }
function trUnitPct()  { return (state.tracker && +state.tracker.unitPct)  || 2; }
function trUnitSize() { return trBankroll() * trUnitPct() / 100; }
function trFmt(v) {
  v = Number(v) || 0;
  if (state.trackerUnits) { const u = trUnitSize() || 1; return (v/u).toFixed(2).replace('.', ',') + ' u'; }
  return '€' + v.toFixed(2).replace('.', ',');
}
function toggleTrackerUnits() { state.trackerUnits = !state.trackerUnits; if (typeof saveState==='function') saveState(); updateTrackerStats(); }
function setTrackerBankroll() {
  if (!state.tracker) state.tracker = { bets: [] };
  const v = prompt('Startbankroll in euro:', trBankroll());
  if (v !== null) { const n = parseFloat(String(v).replace(',', '.')); if (!isNaN(n) && n > 0) state.tracker.startBankroll = n; }
  const up = prompt('Unit-grootte in % van je bankroll (bijv. 2):', trUnitPct());
  if (up !== null) { const u = parseFloat(String(up).replace(',', '.')); if (!isNaN(u) && u > 0 && u <= 100) state.tracker.unitPct = u; }
  if (typeof saveState==='function') saveState();
  updateTrackerStats();
}

function updateTrackerStats() {
  const bets   = state.tracker.bets||[];
  const staked = bets.reduce((s,b) => s+(b.stake||0),0);
  // v26.277: netto via pmxProfit -> half verlies/push/half winst tellen correct mee (was: volle inzet bij elke 'lose')
  const pnl    = bets.filter(pmxIsSettled).reduce((s,b)=>s+pmxProfit(b),0);
  const roi    = staked>0 ? ((pnl/staked)*100).toFixed(1) : '—';
  // v26.283: bankroll-ontwikkeling — saldo, groei% en max drawdown over de saldo-curve
  const start  = trBankroll();
  const saldo  = start + pnl;
  const groei  = start>0 ? (pnl/start*100) : 0;
  const chrono = [...bets].reverse().filter(pmxIsSettled); // oudste eerst (bets staan nieuwste-eerst)
  let bal=start, peak=start, maxDD=0;
  chrono.forEach(b => { bal += pmxProfit(b); if (bal>peak) peak=bal; const dd = peak>0 ? (peak-bal)/peak : 0; if (dd>maxDD) maxDD=dd; });
  const set = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  const setc= (id,c) => { const e=document.getElementById(id); if(e) e.style.color=c; };
  set('trSaldo',  trFmt(saldo));
  setc('trSaldo', saldo>=start ? '#00BEC4' : '#dc2626');
  set('trGroei',  `${groei>=0?'+':''}${groei.toFixed(1)}%  ·  max drawdown ${(maxDD*100).toFixed(0)}%`);
  set('trBankInfo', `Start €${start.toFixed(0)} · 1 unit = €${trUnitSize().toFixed(2).replace('.', ',')} (${trUnitPct()}%)`);
  const ub = document.getElementById('trUnitsBtn'); if (ub) ub.textContent = state.trackerUnits ? 'units ✓' : '€ / units';
  set('trStaked', trFmt(staked));
  set('trPnl',    `${pnl>=0?'+':''}${trFmt(pnl)}`);
  set('trBets',   bets.length);
  set('trRoi',    roi!=='—'?roi+'%':'—');
  const el = document.getElementById('trPnl');
  if (el) el.style.color = pnl>=0?'#00BEC4':'#dc2626';
  renderSmartStats();
  // v26.239: renderTrackerChart bestond nooit (dode aanroep, chart-wrap is display:none) — veilig afvangen zodat de Tracker niet crasht
  if (typeof renderTrackerChart === 'function') renderTrackerChart();
}

function renderSmartStats() {
  const wrap = document.getElementById('smartStatsWrap');
  if (!wrap) return;
  const bets    = state.tracker.bets||[];
  const settled = bets.filter(b => b.status!=='pending');
  if (settled.length < 5) { wrap.innerHTML=''; return; }
  const bySource = {};
  for (const b of settled) {
    const src = b.source||'eigen';
    if (!bySource[src]) bySource[src]={wins:0,total:0};
    bySource[src].total++;
    if (b.status==='win') bySource[src].wins++;
  }
  const srcRows = Object.entries(bySource).map(([src,d]) => {
    const pct = Math.round(d.wins/d.total*100);
    const col = pct>=55?'#00BEC4':pct>=40?'#d97706':'#dc2626';
    return `<div class="smart-stat-row"><span>${sourceLabel[src]||src}</span><span style="color:${col};font-weight:700;">${pct}% (${d.wins}/${d.total})</span></div>`;
  }).join('');
  wrap.innerHTML = `<div class="smart-stats-card"><div class="smart-stats-title">📊 Hitrate per bron</div>${srcRows}</div>`;
}

// ── BACKTEST / RESULTATEN FUNCTIES ───────────────────────

function setBtSubTab(tab) {
  btSubTab=tab;
  document.querySelectorAll('.bt-subtab').forEach(b => b.classList.remove('active'));
  document.getElementById('bts-'+tab)?.classList.add('active');
  renderBacktest();
}
function setBtFilter(f) {
  btFilter=f;
  document.querySelectorAll('.bt-filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btf-'+f)?.classList.add('active');
  renderBacktest();
}

function renderBacktest() {
  if (!state.valueBacktest) state.valueBacktest={picks:[]};
  const allPicks = state.valueBacktest.picks||[];
  const list = document.getElementById('btList');
  if (!list) return;
  updateBacktestStats();
  renderTripleLockHitrate();

  if (btSubTab==='comps') {
    renderBtScoreboard(allPicks);
    const filterRow = document.getElementById('btFilterRow');
    if (filterRow) filterRow.style.display='none';
    list.style.display='none';
    const chartWrap = document.getElementById('btChartWrap');
    if (chartWrap) chartWrap.style.display='none';
    return;
  }

  list.style.display='block';
  const breakdown = document.getElementById('btCompBreakdown');
  if (breakdown) breakdown.style.display='none';
  const filterRow = document.getElementById('btFilterRow');
  if (filterRow) filterRow.style.display=allPicks.length>1?'flex':'none';

  let picks = allPicks;
  if (btFilter==='win')     picks = allPicks.filter(p=>p.status==='win');
  else if (btFilter==='lose')    picks = allPicks.filter(p=>p.status==='lose');
  else if (btFilter==='pending') picks = allPicks.filter(p=>!p.status||p.status==='pending');
  else if (btFilter==='lock')    picks = allPicks.filter(p=>{
    const lv = detectLockLevel(p.fixtureId||p.matchId, p.pick);
    return lv==='double'||lv==='triple';
  });

  if (!picks.length) {
    list.innerHTML = allPicks.length
      ? '<div class="bt-empty">Geen picks voor dit filter</div>'
      : `<div class="bt-empty">Nog geen value-picks bijgehouden.<br>Draai een ⚡ Value Scan — picks met ≥5% value en confidence ≥7 worden automatisch hier opgeslagen.</div>`;
    return;
  }

  list.innerHTML = picks.map(p => {
    const lockLv    = detectLockLevel(p.fixtureId||p.matchId, p.pick);
    const badge     = lockBadge(lockLv);
    const statusTxt = p.status==='win'  ? `✓ WIN (+€${((p.odds-1)*1).toFixed(2)} per €1)`
                    : p.status==='lose' ? '✗ VERLIES' : '⏳ OPEN';
    const confColor = p.confidence>=7?'#00BEC4':p.confidence>=5?'#b45309':'#dc2626';
    const valColor  = p.value>=15?'#00BEC4':p.value>=5?'#b45309':'#64748b';
    const borderLeft = lockLv==='triple'?'4px solid #00BEC4':lockLv==='double'?'4px solid #b45309':'4px solid transparent';
    return `
    <div class="bt-row bt-${p.status||'pending'}" style="border-left:${borderLeft};cursor:pointer;" data-btidx="${(state.valueBacktest?.picks||[]).indexOf(p)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.25rem;">
        <div class="bt-match">${p.matchName}</div>
        ${badge ? `<div style="flex-shrink:0;margin-left:.5rem;">${badge}</div>` : ''}
      </div>
      <div class="bt-meta">
        <span>📅 ${p.date}${p.matchTime||p.time ? ' ' + (p.matchTime||p.time) : ''}</span>
        <span style="font-weight:700;color:${valColor}">⚡ +${p.value}%</span>
        <span>🎯 ${p.pickLabel} @ ${p.odds}</span>
        <span style="color:${confColor}">🎲 ${p.confidence}/10</span>
        <span style="color:rgba(255,255,255,.95);">📊 ${p.bookmaker||'?'}</span>
        ${p.poissonUsed ? '<span style="color:#00a8ad;">P+AI</span>' : ''}
      </div>
      <div style="font-family:monospace;font-size:.52rem;color:rgba(255,255,255,.95);margin-bottom:.25rem;line-height:1.5;">
        AI ${p.aiKans}% kans · ½ Kelly ${p.kelly}% · ${p.reason||''}
        ${p.score ? `<b style="color:#ffffff;"> [${p.score}]</b>` : ''}
      </div>
      ${typeof buildPickReasons === 'function' ? (() => {
        const signals = buildPickReasons(p);
        if (!signals.length) return '';
        return `<div style="display:flex;flex-wrap:wrap;gap:.2rem;margin-bottom:.35rem;">
          ${signals.map(s => `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;background:${s.color}18;color:${s.color};border:1px solid ${s.color}33;border-radius:5px;padding:.08rem .3rem;white-space:nowrap;">${s.icon} ${s.text}</span>`).join('')}
        </div>`;
      })() : ''}
      <div class="bt-footer">
        <div style="display:flex;gap:.4rem;align-items:center;">
          ${p.status==='pending' ? `<button onclick="checkBacktestPick('${p.id}')" class="check-btn">🔍 CHECK</button>` : ''}
          <button onclick="deleteBacktestPick('${p.id}')" class="del-btn">✕</button>
          <button onclick="quickBetFromBacktest('${p.id}')" class="small-action-btn" style="font-size:.45rem;">💰 Bet</button>
        </div>
        <div class="bt-result ${p.status||'pending'}" onclick="cycleBacktestStatus('${p.id}')">${statusTxt}</div>
      </div>
    </div>`;
  }).join('');

  // Event delegation voor popup
  list.onclick = function(e) {
    if (e.target.closest('button')) return;
    const row = e.target.closest('[data-btidx]');
    if (!row) return;
    const idx = parseInt(row.dataset.btidx);
    const pick = (state.valueBacktest?.picks||[])[idx];
    if (pick) showWalletPopup('backtest', pick);
  };
}

function updateBacktestStats() {
  if (!state.valueBacktest) return;
  const picks   = state.valueBacktest.picks||[];
  const settled = picks.filter(p => p.status==='win'||p.status==='lose');
  const wins    = settled.filter(p => p.status==='win');
  const hitrate = settled.length>0 ? Math.round(wins.length/settled.length*100)+'%' : '—';
  let profit=0;
  settled.forEach(p => { profit += p.status==='win' ? (p.odds-1) : -1; });
  const roi = settled.length>0 ? ((profit/settled.length)*100).toFixed(1) : '—';
  const set = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  set('btTotal',   picks.length);
  set('btHitrate', hitrate);
  set('btRoi',     roi!=='—'?roi+'%':'—');
  set('btProfit',  settled.length>0?(profit>=0?'+':'')+profit.toFixed(2)+'€':'—');

  // Voortgangsbalk
  const pct = Math.min(Math.round((settled.length/100)*100), 100);
  const bar  = document.getElementById('btProgressBar');
  const lbl  = document.getElementById('btProgressLabel');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = `${settled.length}/100`;

  const chartWrap = document.getElementById('btChartWrap');
  if (chartWrap) chartWrap.style.display = settled.length>1?'block':'none';
  renderBacktestChart(settled);

  // ── Killer stats sectie ──────────────────────────────
  renderKillerStats(picks, settled);
}

function renderKillerStats(picks, settled) {
  const el = document.getElementById('btKillerStats');
  if (!el) return;
  if (!settled.length) { el.style.display='none'; return; }
  el.style.display='block';

  // ROI laatste 7 dagen
  const now7  = new Date(); now7.setDate(now7.getDate() - 7);
  const last7  = settled.filter(p => p.date && new Date(p.date.split('-').reverse().join('-')) >= now7);
  let profit7  = 0;
  last7.forEach(p => { profit7 += p.status==='win' ? (p.odds-1) : -1; });
  const roi7   = last7.length ? ((profit7/last7.length)*100).toFixed(1) : null;
  const roi7Color = !roi7 ? '#94a3b8' : parseFloat(roi7)>=0 ? '#00BEC4' : '#dc2626';

  // Win streak
  const sortedSettled = [...settled].sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  let streak=0, maxStreak=0, cur=0;
  sortedSettled.forEach(p => {
    if (p.status==='win') { cur++; if(cur>maxStreak) maxStreak=cur; }
    else cur=0;
  });
  // Huidige streak (meest recente)
  for (const p of sortedSettled) {
    if (p.status==='win') streak++;
    else break;
  }

  // Beste league
  const byLeague = {};
  settled.forEach(p => {
    const l = p.comp || p.leagueName || p.competitie || '?';
    if (!byLeague[l]) byLeague[l] = { wins:0, total:0, profit:0 };
    byLeague[l].total++;
    if (p.status==='win') { byLeague[l].wins++; byLeague[l].profit += (p.odds-1); }
    else byLeague[l].profit -= 1;
  });
  const bestLeague = Object.entries(byLeague)
    .filter(([,v]) => v.total >= 3)
    .sort((a,b) => (b[1].profit/b[1].total) - (a[1].profit/a[1].total))[0];

  // Elite picks resultaten
  const elitePicks = settled.filter(p => p.elite || (p.confidence>=8 && p.value>=15));
  const eliteWins  = elitePicks.filter(p => p.status==='win');
  const eliteHr    = elitePicks.length ? Math.round(eliteWins.length/elitePicks.length*100) : null;

  // CLV score (als closing odds beschikbaar)
  const clvPicks = settled.filter(p => p.closingOdds && p.odds);
  let clvAvg = null;
  if (clvPicks.length >= 3) {
    const clvSum = clvPicks.reduce((s,p) => s + ((p.odds / p.closingOdds - 1) * 100), 0);
    clvAvg = (clvSum / clvPicks.length).toFixed(1);
  }

  // Renderen
  el.innerHTML = `
    <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;font-weight:700;color:var(--text);margin-bottom:.6rem;">⚡ STATS OVERZICHT</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">

      <!-- ROI laatste 7 dagen -->
      <div style="background:var(--card-bg,rgba(0,0,0,.04));border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.5rem .6rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:${roi7Color};">${roi7 !== null ? (parseFloat(roi7)>=0?'+':'')+roi7+'%' : '—'}</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">ROI LAATSTE 7 DAGEN</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);">${last7.length} picks gesetteld</div>
      </div>

      <!-- Win streak -->
      <div style="background:var(--card-bg,rgba(0,0,0,.04));border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.5rem .6rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:${streak>=3?'#00BEC4':streak>=1?'#b45309':'#94a3b8'};">${streak}🔥</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">HUIDIGE WIN STREAK</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);">Max: ${maxStreak} op rij</div>
      </div>

      <!-- Beste league -->
      <div style="background:var(--card-bg,rgba(0,0,0,.04));border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.5rem .6rem;">
        ${bestLeague ? `
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.75rem;color:#00BEC4;line-height:1.1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${bestLeague[0]}</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">BESTE LEAGUE</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);">${Math.round(bestLeague[1].wins/bestLeague[1].total*100)}% hitrate · ${bestLeague[1].total}x</div>
        ` : `
          <div style="font-family:\'Bebas Neue\',sans-serif;font-size:.75rem;color:#94a3b8;">—</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">BESTE LEAGUE</div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);">Min 3 picks nodig</div>
        `}
      </div>

      <!-- Elite picks -->
      <div style="background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.5rem .6rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00a8ad;">${eliteHr !== null ? eliteHr+'%' : '—'}</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">⭐ ELITE HITRATE</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);">${eliteWins.length}/${elitePicks.length} gewonnen</div>
      </div>

      ${clvAvg !== null ? `
      <!-- CLV score -->
      <div style="background:var(--card-bg,rgba(0,0,0,.04));border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:.5rem .6rem;grid-column:1/-1;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:${parseFloat(clvAvg)>=0?'#00BEC4':'#dc2626'};">${parseFloat(clvAvg)>=0?'+':''}${clvAvg}% CLV</div>
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:var(--muted);">CLOSING LINE VALUE</div>
          </div>
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.36rem;color:rgba(255,255,255,.95);text-align:right;">Gebaseerd op ${clvPicks.length} picks<br>+ CLV = betere odds dan markt</div>
        </div>
      </div>` : ''}

    </div>`;
}

function renderTripleLockHitrate() {
  const card = document.getElementById('tlHitrateCard');
  if (!card) return;
  const picks = state.valueBacktest?.picks||[];

  // Tel lock levels
  const doubles = picks.filter(p => detectLockLevel(p.fixtureId||p.matchId, p.pick)==='double');
  const triples = picks.filter(p => detectLockLevel(p.fixtureId||p.matchId, p.pick)==='triple');

  const calcHitrate = arr => {
    const s = arr.filter(p => p.status==='win'||p.status==='lose');
    if (!s.length) return null;
    return Math.round(arr.filter(p=>p.status==='win').length/s.length*100);
  };

  const trHr = calcHitrate(triples);
  const dHr  = calcHitrate(doubles);

  if (!doubles.length && !triples.length) { card.style.display='none'; return; }
  card.style.display='block';

  const trRow = triples.length ? `
    <div style="font-family:monospace;font-size:.75rem;font-weight:900;color:${trHr===null?'#94a3b8':trHr>=55?'#00BEC4':trHr>=40?'#d97706':'#dc2626'};">
      ${trHr !== null ? trHr+'%' : '—'}
    </div>
    <div style="font-family:monospace;font-size:.48rem;color:rgba(255,255,255,.95);">Triple · ${triples.filter(p=>p.status==='win').length}W/${triples.filter(p=>p.status==='lose').length}V (${triples.length} picks)</div>
  ` : '';

  const dRow = doubles.length ? `
    <div style="font-family:monospace;font-size:.55rem;color:rgba(255,255,255,.95);margin-top:.4rem;">
      🔒 Double · ${dHr !== null ? dHr+'%' : '—'} hitrate · ${doubles.filter(p=>p.status==='win').length}W/${doubles.filter(p=>p.status==='lose').length}V (${doubles.length} picks)
    </div>
  ` : '';

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;">
      <div style="font-size:1.5rem;">🏆</div>
      <div>
        <div style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);margin-bottom:.15rem;">TRIPLE LOCK HITRATE</div>
        ${trRow}
        ${dRow}
      </div>
    </div>`;
}

function renderBtScoreboard(picks) {
  const el = document.getElementById('btCompBreakdown');
  if (!el) return;
  const settled = picks.filter(p => p.status==='win'||p.status==='lose');
  if (!settled.length) {
    el.style.display='block';
    el.innerHTML='<div class="bt-empty" style="padding:.8rem 0;">Nog geen afgeronde picks om per competitie te tonen.</div>';
    return;
  }
  const compMap={};
  for (const p of picks) {
    const key=p.comp||'Overig';
    if (!compMap[key]) compMap[key]={wins:0,total:0,pending:0,name:key};
    if (p.status==='win') { compMap[key].wins++; compMap[key].total++; }
    else if (p.status==='lose') compMap[key].total++;
    else compMap[key].pending++;
  }
  const COMP_NAMES={
    eredivisie:'🇳🇱 Eredivisie',kkd:'🇳🇱 Keuken Kampioen',premier:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
    bundesliga:'🇩🇪 Bundesliga',ligue1:'🇫🇷 Ligue 1',seriea:'🇮🇹 Serie A',
    champions:'⭐ Champions League',nations:'🌍 Nations League',beker:'🏆 KNVB Beker',
    wk2026:'🏆 WK 2026',jupiler:'🇧🇪 Jupiler Pro',laliga:'🇪🇸 La Liga',superlig:'🇹🇷 Süper Lig',
    championship:'🏴 Championship',bundesliga2:'🇩🇪 2. Bundesliga'
  };
  const sorted=Object.values(compMap).sort((a,b)=>b.total-a.total);
  const rows=sorted.map(d => {
    const pct=d.total>0?Math.round((d.wins/d.total)*100):0;
    const barColor=pct>=55?'#00BEC4':pct<40&&d.total>2?'#dc2626':'#d97706';
    const label=COMP_NAMES[d.name]||d.name;
    const pendingTxt=d.pending?` · ${d.pending} open`:'';
    return `<div class="bt-score-row">
      <div class="bt-score-comp">${label}</div>
      <div class="bt-score-fraction">${d.wins}/${d.total}</div>
      <div class="bt-score-bar-wrap"><div class="bt-score-bar" style="width:${pct}%;background:${barColor};"></div></div>
      <div class="bt-score-pct" style="color:${barColor};">${pct}%${pendingTxt}</div>
    </div>`;
  }).join('');
  el.style.display='block';
  el.innerHTML=`<div style="font-family:monospace;font-size:.55rem;color:rgba(255,255,255,.95);margin-bottom:.5rem;">Wins / afgeronde picks · hitrate%</div><div class="bt-scoreboard">${rows}</div>`;
}

function renderBtCompBreakdown(picks) { /* intern — via setBtSubTab('comps') */ }

function renderBacktestChart(settled) {
  const canvas = document.getElementById('btChart');
  if (!canvas||settled.length<2) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||360, H=90;
  canvas.width=W; canvas.height=H;
  ctx.clearRect(0,0,W,H);
  const points=[0];
  // v26.276: units via profit/inzet -> push levert 0, half verlies -0.5 (was: altijd -1)
  settled.forEach(p => { const last=points[points.length-1]; const _s=pmxStake(p);
    points.push(last + (_s>0 ? pmxProfit(p)/_s : (p.status==='win'?(p.odds-1):-1))); });
  const minV=Math.min(...points,-0.5), maxV=Math.max(...points,0.5);
  const range=maxV-minV;
  const pad={top:12,bottom:14,left:36,right:8};
  const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;
  const xP=i=>pad.left+(i/Math.max(points.length-1,1))*cw;
  const yP=v=>pad.top+ch-((v-minV)/range)*ch;
  ctx.setLineDash([3,3]); ctx.strokeStyle=document.body.classList.contains('creme')?'rgba(139,90,43,.30)':'rgba(148,163,184,.5)'; ctx.lineWidth=1;
  const zeroY=yP(0); ctx.beginPath(); ctx.moveTo(pad.left,zeroY); ctx.lineTo(pad.left+cw,zeroY); ctx.stroke();
  ctx.setLineDash([]);
  const lastVal=points[points.length-1];
  const isPos=lastVal>=0, lineColor=isPos?'#00BEC4':'#dc2626';
  const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);
  grad.addColorStop(0,isPos?'rgba(21,128,61,.2)':'rgba(220,38,38,.15)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.moveTo(xP(0),yP(0));
  points.forEach((v,i)=>{ if(i>0) ctx.lineTo(xP(i),yP(v)); });
  ctx.lineTo(xP(points.length-1),H-pad.bottom); ctx.lineTo(xP(0),H-pad.bottom);
  ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
  ctx.beginPath(); ctx.moveTo(xP(0),yP(0));
  points.forEach((v,i)=>{ if(i>0) ctx.lineTo(xP(i),yP(v)); });
  ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  settled.forEach((p,i) => {
    ctx.beginPath(); ctx.arc(xP(i+1),yP(points[i+1]),3,0,Math.PI*2);
    ctx.fillStyle=p.status==='win'?'#00BEC4':'#dc2626';
    ctx.fill(); ctx.strokeStyle=document.body.classList.contains('creme')?'#fffaf2':'#fff'; ctx.lineWidth=1.5; ctx.stroke();
  });
  ctx.fillStyle=document.body.classList.contains('creme')?'#6a4a2c':'#94a3b8'; ctx.font='9px IBM Plex Mono, monospace'; ctx.textAlign='right';
  ctx.fillText((lastVal>=0?'+':'')+lastVal.toFixed(2)+' €/pick', pad.left-3, yP(lastVal)+3);
}

async function checkBacktestPick(pickId) {
  if (!state.valueBacktest) return;
  const p = state.valueBacktest.picks.find(x => String(x.id)===String(pickId));
  if (!p) return;
  const btn = document.querySelector(`button[onclick*="${pickId}"]`);
  if (btn) btn.textContent='⟳';
  try {
    let fix=null;
    if (p.fixtureId) {
      const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?id=${p.fixtureId}`,null,8000);
      const d = await r.json(); fix=d.response?.[0]||null;
    }
    if (!fix && p.date) {
      const parts=p.date.split('-');
      const isoDate=parts.length===3&&parts[0].length===2?`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`:p.date;
      const r2=await apiFetch(`https://v3.football.api-sports.io/fixtures?date=${isoDate}`,null,8000);
      const d2=await r2.json();
      const pool=d2.response||[];
      const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
      const [home,away]=(p.matchName||'').split(' vs ');
      if (home&&away) {
        const hw=norm(home).split(' ').filter(w=>w.length>2);
        const aw=norm(away).split(' ').filter(w=>w.length>2);
        fix=pool.find(f=>{
          if(!['FT','AET','PEN'].includes(f.fixture.status.short)) return false;
          const fh=norm(f.teams.home.name),fa=norm(f.teams.away.name);
          return hw.some(w=>fh.includes(w))&&aw.some(w=>fa.includes(w));
        });
      }
    }
    if (!fix||!['FT','AET','PEN'].includes(fix?.fixture?.status?.short)) {
      showToast('Wedstrijd nog niet gespeeld of niet gevonden'); renderBacktest(); return;
    }
    const hg=fix.goals.home??0, ag=fix.goals.away??0;
    p.score=`${hg}-${ag}`;
    let won=false;
    if (p.pick==='1') won=hg>ag; else if(p.pick==='2') won=ag>hg; else if(p.pick==='X') won=hg===ag;
    else if(p.pick==='O2.5') won=(hg+ag)>2.5; else if(p.pick==='U2.5') won=(hg+ag)<2.5;
    else if(p.pick==='BTTS-J') won=hg>0&&ag>0; else if(p.pick==='BTTS-N') won=hg===0||ag===0;
    p.status = won ? 'win' : 'lose';
    p.verifiedAt = new Date().toLocaleString('nl-NL');
    saveState();
    showToast(won ? `✓ WIN: ${p.matchName} [${p.score}]` : `✗ VERLIES: ${p.matchName} [${p.score}]`);
  } catch(e) {
    showToast('Fout bij ophalen resultaat'); console.error(e);
  }
  renderBacktest();
}

async function checkAllBacktestPicks() {
  const picks = (state.valueBacktest?.picks||[]).filter(p=>p.status==='pending');
  if (!picks.length) { showToast(t('wal.noopenpickscheck','Geen open picks om te checken')); return; }
  showToast(`⟳ Checken ${picks.length} picks...`);
  for (const p of picks) { await checkBacktestPick(p.id); }
  showToast('✓ Klaar met checken');
}

function cycleBacktestStatus(id) {
  const p = state.valueBacktest?.picks?.find(x=>String(x.id)===String(id));
  if (!p) return;
  p.status = p.status==='pending'?'win':p.status==='win'?'lose':'pending';
  if (p.status!=='pending') p.verifiedAt = new Date().toLocaleString('nl-NL');
  saveState(); renderBacktest();
}

function deleteBacktestPick(id) {
  if (!confirm(t('wal.deletepick','Pick verwijderen?'))) return;
  state.valueBacktest.picks = state.valueBacktest.picks.filter(p=>String(p.id)!==String(id));
  saveState(); renderBacktest();
}

function clearBacktest() {
  if (!confirm(t('wal.clearallresults','Alle resultaten wissen?'))) return;
  state.valueBacktest={picks:[]};
  saveState(); renderBacktest();
  showToast('🗑 Resultaten gewist');
}

function quickBetFromBacktest(pickId) {
  const p = state.valueBacktest?.picks?.find(x=>String(x.id)===String(pickId));
  if (!p) return;
  const matchId = p.fixtureId || p.matchId;
  openBetModal(null, matchId, p.pick, p.pickLabel, p.odds);
  switchScreen('wallet');
  setWalletSubTab('tracker'); // v26.238: saldo-wallet + resultaten verborgen, alleen tracker
}

// ── VALUE PICKS TAB ───────────────────────────────────────

function renderValuePicks() {
  const el = document.getElementById('value-picks-content');
  if (!el) return;
  const scanPicks = state.valueScans || [];
  const btPicks   = (state.valueBacktest?.picks || []).filter(p => p.status === 'pending');
  const seen = new Set();
  const allPicks = [];
  [...scanPicks, ...btPicks].forEach(p => {
    const key = String(p.id || p.matchId || p.fixtureId);
    if (!seen.has(key)) { seen.add(key); allPicks.push(p); }
  });
  allPicks.sort((a, b) => (b.value||0) - (a.value||0));

  if (!allPicks.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;">
        <div style="font-size:2rem;margin-bottom:.75rem;">⚡</div>
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;color:rgba(255,255,255,.95);">
          Geen value picks beschikbaar.<br>Voer eerst een Value Scan uit via de Analyse tab.
        </div>
      </div>`;
    return;
  }

  const valueClass = v => v >= 20 ? '#00BEC4' : v >= 10 ? '#b45309' : '#64748b';
  const valueBg    = v => v >= 20 ? 'rgba(0,190,196,.1)' : v >= 10 ? 'rgba(217,119,6,.08)' : 'rgba(100,116,139,.06)';
  const valueLbl   = v => v >= 20 ? '🏆 HOGE VALUE' : v >= 10 ? '⚡ VALUE' : '📊 LAGE VALUE';

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
      <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.3rem;">VALUE PICKS</div>
      <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">${allPicks.length} picks</div>
    </div>`;

  allPicks.forEach(p => {
    const matchName = p.match ? `${p.match.home} vs ${p.match.away}` : (p.matchName || '');
    const pick      = p.pick || '1';
    const pickLabel = p.pickLabel || (pick==='1'?'Thuis wint':pick==='X'?'Gelijkspel':'Uit wint');
    const odds      = parseFloat(p.odds || 2).toFixed(2);
    const value     = parseFloat(p.value || 0);
    const conf      = p.confidence || 5;
    const matchId   = p.id || p.matchId || p.fixtureId;
    const comp      = p.comp || p.compName || (p.match?.comp) || '';
    const reason    = p.reason || p.reden || '';
    const lockLv    = detectLockLevel(matchId, pick);
    const badge     = lockBadge(lockLv);

    html += `
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:16px;
        padding:.9rem 1rem;margin-bottom:.6rem;
        border-left:${lockLv==='triple'?'4px solid #00BEC4':lockLv==='double'?'4px solid #b45309':'1px solid rgba(255,255,255,0.09)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.45rem;color:rgba(255,255,255,.95);">${comp}</div>
          <div style="display:flex;gap:.3rem;align-items:center;">
            ${badge}
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.48rem;font-weight:800;
              color:${valueClass(value)};background:${valueBg(value)};padding:2px 8px;border-radius:6px;">
              ${valueLbl(value)} +${value.toFixed(1)}%
            </div>
          </div>
        </div>
        <div style="font-family:\'DM Sans\',sans-serif;font-size:.95rem;font-weight:700;color:#ffffff;margin-bottom:.4rem;">${matchName}</div>
        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;">
          <span style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#ffffff;">${pick}</span>
          <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">${pickLabel}</span>
          <span style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;margin-left:auto;">${odds}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
          <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.45rem;color:rgba(255,255,255,.95);">
            Conf: ${'★'.repeat(Math.min(conf,10))}${'☆'.repeat(Math.max(0,10-conf))} ${conf}/10
          </div>
          ${reason ? `<div style="font-family:\'IBM Plex Mono\',monospace;font-size:.44rem;color:rgba(255,255,255,.95);max-width:55%;text-align:right;">${reason}</div>` : ''}
        </div>
        <div style="display:flex;gap:.4rem;">
          <button onclick="quickBetFromValue('${matchId}','${pick}','${pickLabel}',${odds})"
            style="flex:2;padding:.5rem;border-radius:10px;
            background:linear-gradient(135deg,rgba(0,190,196,.9),rgba(0,190,196,.8));
            border:none;font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;
            font-weight:800;color:#fff;cursor:pointer;">
            💰 INZETTEN
          </button>
          <button onclick="addValueToCombiBuilder('${matchId}','${pick}','${pickLabel}',${odds})"
            style="flex:1;padding:.5rem;border-radius:10px;
            background:rgba(0,190,196,.08);border:1px solid rgba(0,190,196,.2);
            font-family:\'IBM Plex Mono\',monospace;font-size:.55rem;font-weight:700;color:#00a8ad;cursor:pointer;">
            + COMBI
          </button>
        </div>
      </div>`;
  });
  el.innerHTML = html;
}

function quickBetFromValue(matchId, pick, pickLabel, odds) {
  const match = (state.matches||[]).find(m => String(m.id) === String(matchId));

  // v18.9: uitgebreide matchnaam lookup
  let matchName = '';
  if (match) {
    matchName = match.home + ' vs ' + match.away;
  } else {
    const scan = (state.valueScans||[]).find(s =>
      String(s.id) === String(matchId) ||
      String(s.match?.id) === String(matchId) ||
      String(s.fixtureId) === String(matchId)
    );
    if (scan) matchName = (scan.match?.home||scan.home||'?') + ' vs ' + (scan.match?.away||scan.away||'?');
    if (!matchName || matchName === '? vs ?') {
      const bt = (state.valueBacktest?.picks||[]).find(p =>
        String(p.fixtureId) === String(matchId) ||
        String(p.matchId) === String(matchId)
      );
      if (bt?.matchName) matchName = bt.matchName;
    }
  }

  pendingBet = {
    match: match || { id: matchId, home: matchName.split(' vs ')[0]||'?', away: matchName.split(' vs ')[1]||'?' },
    pick, pickLabel, odds: parseFloat(odds), markt: '1X2',
    _origPick: pick, _origPickLabel: pickLabel, _origOdds: parseFloat(odds)
  };

  const title = document.getElementById('bet-modal-title');
  if (title) title.textContent = matchName + ' — ' + pickLabel + ' @ ' + odds;
  const matchInput = document.getElementById('bet-match');
  if (matchInput) matchInput.value = matchName;
  const stakeInput = document.getElementById('bet-stake');
  if (stakeInput) stakeInput.value = state.settings.defaultBet || 10;
  const oddsInput = document.getElementById('bet-odds');
  if (oddsInput) oddsInput.value = odds;
  const noteInput = document.getElementById('bet-note');
  if (noteInput) noteInput.value = pickLabel || pick;

  const modal = document.getElementById('bet-modal');
  if (modal) modal.style.display = 'flex';
}

function addValueToCombiBuilder(matchId, pick, pickLabel, odds) {
  if (!state.combiBuilder) state.combiBuilder = [];
  const exists = state.combiBuilder.some(l => String(l.matchId) === String(matchId));
  if (exists) { showToast('Al in combi'); return; }

  // v18.9: uitgebreide match lookup via matches, valueScans en valueBacktest
  const match = (state.matches||[]).find(m => String(m.id) === String(matchId));
  let home = match?.home || '?';
  let away = match?.away || '?';
  if (!match) {
    // Zoek in valueScans — matchId kan s.id of s.match.id zijn
    const scan = (state.valueScans||[]).find(s =>
      String(s.id) === String(matchId) ||
      String(s.match?.id) === String(matchId) ||
      String(s.fixtureId) === String(matchId)
    );
    if (scan) {
      home = scan.match?.home || scan.home || '?';
      away = scan.match?.away || scan.away || '?';
    }
    if (home === '?' || away === '?') {
      // Zoek in valueBacktest picks
      const bt = (state.valueBacktest?.picks||[]).find(p =>
        String(p.fixtureId) === String(matchId) ||
        String(p.matchId) === String(matchId)
      );
      if (bt?.matchName) {
        const parts = bt.matchName.split(' vs ');
        home = parts[0]?.trim() || '?';
        away = parts[1]?.trim() || '?';
      }
    }
  }

  state.combiBuilder.push({ matchId, pick, pickLabel, odds: parseFloat(odds), home, away });
  saveState();

  // v18.8: toon combi slip direct als floating overlay in wallet
  showCombiSlipOverlay();
  showToast('➕ Toegevoegd aan combi (' + state.combiBuilder.length + ')');
}

function showCombiSlipOverlay() {
  let overlay = document.getElementById('combi-slip-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'combi-slip-overlay';
    overlay.style.cssText = 'position:fixed;bottom:70px;left:0;right:0;z-index:8000;padding:0 .75rem;pointer-events:none;';
    document.body.appendChild(overlay);
  }

  const legs = state.combiBuilder || [];
  if (!legs.length) { overlay.innerHTML = ''; return; }

  const totalOdds = legs.reduce((a, l) => a * parseFloat(l.odds||1), 1);
  const defaultBet = state.settings.defaultBet || 10;
  const payout = (defaultBet * totalOdds).toFixed(2);

  overlay.style.pointerEvents = 'all';
  overlay.innerHTML = `
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(0,190,196,.25);border-radius:16px;
      box-shadow:0 -4px 24px rgba(15,23,42,.15);padding:.75rem 1rem;
      animation:slideUp .2s ease;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">⚡ COMBI SLIP · ${legs.length} legs</div>
        <button onclick="document.getElementById('combi-slip-overlay').innerHTML='';document.getElementById('combi-slip-overlay').style.pointerEvents='none';"
          style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;font-size:1rem;">✕</button>
      </div>
      ${legs.map((l, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;
          background:rgba(255,255,255,.05);border:1px solid rgba(28,35,48,.07);
          border-radius:10px;padding:.5rem .7rem;margin-bottom:.3rem;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.75rem;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.home||'?'} vs ${l.away||'?'}</div>
            <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;color:#00BEC4;font-weight:700;">${l.pickLabel||l.pick}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0;">
            <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;color:#00BEC4;">${parseFloat(l.odds).toFixed(2)}</div>
            <button onclick="state.combiBuilder=state.combiBuilder.filter(x=>x.matchId!=='${l.matchId}');saveState();showCombiSlipOverlay();"
              style="background:none;border:none;color:rgba(255,255,255,.95);cursor:pointer;font-size:.7rem;">✕</button>
          </div>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;
        background:rgba(0,190,196,.06);border-radius:8px;padding:.4rem .7rem;margin-top:.3rem;margin-bottom:.5rem;">
        <div style="font-family:\'IBM Plex Mono\',monospace;font-size:.5rem;color:rgba(255,255,255,.95);">€${defaultBet} × ${totalOdds.toFixed(2)}</div>
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;color:#00BEC4;">€${payout}</div>
      </div>
      <div style="display:flex;gap:.4rem;">
        <button onclick="switchScreen('wedstrijden');setTimeout(()=>{document.getElementById('combiBuilder')?.scrollIntoView({behavior:'smooth'});if(typeof updateCombiBuilder==='function')updateCombiBuilder();},300);"
          style="flex:1;padding:.5rem;border-radius:10px;background:rgba(0,190,196,.08);
          border:1px solid rgba(0,190,196,.2);font-family:\'IBM Plex Mono\',monospace;
          font-size:.55rem;font-weight:700;color:#00a8ad;cursor:pointer;">✏ Bewerken</button>
        <button onclick="placeCombiFromOverlay()"
          style="flex:2;padding:.5rem;border-radius:10px;
          background:linear-gradient(135deg,rgba(0,190,196,.9),rgba(0,190,196,.8));
          color:#fff;border:none;font-family:\'IBM Plex Mono\',monospace;
          font-size:.55rem;font-weight:800;cursor:pointer;">💶 PLAATSEN</button>
      </div>
    </div>`;
}

function placeCombiFromOverlay() {
  // Gebruik bestaande placeCombi functie
  if (typeof placeCombi === 'function') {
    placeCombi();
  } else {
    switchScreen('wedstrijden');
    setTimeout(() => {
      document.getElementById('combiBuilder')?.scrollIntoView({behavior:'smooth'});
    }, 300);
  }
  const overlay = document.getElementById('combi-slip-overlay');
  if (overlay) { overlay.innerHTML = ''; overlay.style.pointerEvents = 'none'; }
}

// ── PICK TRACKER (ptSaveFromScan) ─────────────────────────
// Bewaard voor backward compat — slaat op in valueBacktest

// ── JACKS IMPORT ─────────────────────────────────────────

function openJacksImport() {
  const modal = document.getElementById('jacksImportModal');
  if (modal) modal.style.display = 'flex';
  const ta = document.getElementById('jacksImportText');
  if (ta) { ta.value = ''; }
  const preview = document.getElementById('jacksImportPreview');
  if (preview) preview.innerHTML = '';
}

function closeJacksImport() {
  const modal = document.getElementById('jacksImportModal');
  if (modal) modal.style.display = 'none';
}

function parseJacksImport() {
  const text = document.getElementById('jacksImportText')?.value?.trim();
  if (!text) { showToast('Plak eerst je betgeschiedenis'); return; }

  const bets = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Jacks betgeschiedenis formaat:
  // Datum | Wedstrijd | Pick | Quote | Inzet | Uitbetaling | Status
  // Voorbeeld: "16-05-2026  Ajax vs PSV  1  2.10  €10,00  €21,00  Gewonnen"
  // Of tab-gescheiden: "16-05-2026	Ajax vs PSV	1	2.10	€10,00	€21,00	Gewonnen"

  const parseAmount = s => parseFloat((s||'').replace(/[€,]/g, '').replace(',', '.')) || 0;
  const parseDate   = s => {
    if (!s) return new Date().toLocaleDateString('nl-NL');
    // dd-mm-yyyy of dd/mm/yyyy
    const m = s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (m) return `${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}-${m[3].length===2?'20'+m[3]:m[3]}`;
    return s;
  };

  for (const line of lines) {
    // Probeer tab-gescheiden
    const parts = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
    if (parts.length < 4) continue;

    // Zoek datum patroon
    const dateMatch = parts.find(p => /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(p));
    if (!dateMatch) continue;

    const date    = parseDate(dateMatch);
    const dateIdx = parts.indexOf(dateMatch);

    // Wedstrijd staat na datum
    const match   = (parts[dateIdx + 1] || '').trim();
    if (!match || !match.includes(' ')) continue;

    const pick    = (parts[dateIdx + 2] || '1').trim();
    const odds    = parseFloat((parts[dateIdx + 3] || '').replace(',', '.')) || 0;
    const stake   = parseAmount(parts[dateIdx + 4]);
    const payout  = parseAmount(parts[dateIdx + 5]);
    const statusRaw = (parts[dateIdx + 6] || '').toLowerCase();

    if (!odds || odds <= 1 || !stake) continue;

    let status = 'pending';
    if (statusRaw.includes('gewon') || statusRaw.includes('win'))   status = 'win';
    if (statusRaw.includes('verlor') || statusRaw.includes('lose') || statusRaw.includes('verlies')) status = 'lose';
    if (statusRaw.includes('open') || statusRaw.includes('actief')) status = 'pending';

    bets.push({ date, match, pick, odds, stake, payout: payout || parseFloat((stake * odds).toFixed(2)), status });
  }

  // Preview tonen
  const preview = document.getElementById('jacksImportPreview');
  if (!bets.length) {
    if (preview) preview.innerHTML = '<div style="font-family:monospace;font-size:.55rem;color:#dc2626;">⚠ Geen bets herkend. Probeer de tekst te kopieren via lang indrukken → Alles selecteren op de betgeschiedenis-pagina van je bookmaker.</div>';
    return;
  }

  // Sla bets tijdelijk op voor gebruik door analyse/import
  window._jacksPendingBets = bets;

  if (preview) {
    preview.innerHTML = `
      <div style="font-family:monospace;font-size:.55rem;color:#00BEC4;margin-bottom:.4rem;">
        ✅ ${bets.length} bet${bets.length > 1 ? 's' : ''} herkend:
      </div>
      ${bets.slice(0, 5).map(b => `
        <div style="font-family:monospace;font-size:.5rem;color:rgba(255,255,255,.95);padding:.2rem 0;border-bottom:1px solid rgba(255,255,255,0.09);">
          ${b.date} · ${b.match} · ${b.pick} @ ${b.odds} · €${b.stake} · ${b.status}
        </div>`).join('')}
      ${bets.length > 5 ? `<div style="font-family:monospace;font-size:.48rem;color:rgba(255,255,255,.95);">...en ${bets.length - 5} meer</div>` : ''}
      <div style="display:flex;gap:.5rem;margin-top:.65rem;">
        <button onclick="analyseJacksBets()" style="flex:1;padding:.5rem .4rem;border-radius:10px;
          background:linear-gradient(135deg,rgba(0,190,196,.15),rgba(0,190,196,.08));
          border:1px solid rgba(0,190,196,.35);color:#00BEC4;font-family:monospace;
          font-size:.56rem;font-weight:800;cursor:pointer;">
          🤖 Laat Claude analyseren
        </button>
        <button onclick="confirmJacksTextImport()" style="flex:1;padding:.5rem .4rem;border-radius:10px;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
          color:rgba(255,255,255,.7);font-family:monospace;font-size:.56rem;cursor:pointer;">
          📥 Direct importeren
        </button>
      </div>
      <div id="jacksAIAnalyse" style="margin-top:.65rem;"></div>
    `;
  }

  return; // Importeren gebeurt via knoppen hierboven
  // (onderstaande code wordt alleen nog aangeroepen via confirmJacksTextImport)

  let imported = 0;
  bets.forEach(b => {
    const exists = state.tracker.bets.some(t =>
      t.match === b.match && t.date === b.date && String(t.odds) === String(b.odds)
    );
    if (exists) return;
    state.tracker.bets.unshift({
      id: Date.now() + Math.random(),
      match: b.match,
      date: b.date,
      pick: b.pick,
      odds: b.odds,
      stake: b.stake,
      payout: b.payout,
      status: b.status,
      source: 'jacks',
      bookmaker: 'bookmaker',
      note: 'Geïmporteerd van bookmaker',
      markt: '1X2',
      score: null
    });
    imported++;
  });

  saveState();
  closeJacksImport();
  renderTracker();
  updateTrackerStats();
  showToast(`✅ ${imported} bets ${t('wal.importedfromjacks','geïmporteerd van bookmaker')}`);
}

// Directe import zonder analyse (via knop)
function confirmJacksTextImport() {
  const bets = window._jacksPendingBets || [];
  if (!bets.length) return;
  let imported = 0;
  bets.forEach(b => {
    const exists = state.tracker.bets.some(t =>
      t.match === b.match && t.date === b.date && String(t.odds) === String(b.odds)
    );
    if (exists) return;
    state.tracker.bets.unshift({
      id: Date.now() + Math.random(),
      match: b.match, date: b.date, pick: b.pick, odds: b.odds,
      stake: b.stake, payout: b.payout, status: b.status,
      source: 'jacks', bookmaker: 'bookmaker',
      note: 'Geïmporteerd van bookmaker', markt: '1X2', score: null
    });
    imported++;
  });
  window._jacksPendingBets = [];
  saveState();
  closeJacksImport();
  renderTracker();
  updateTrackerStats();
  showToast(`✅ ${imported} bets geïmporteerd van bookmaker`);
}

// ── AI ANALYSE VAN GEÏMPORTEERDE JACKS BETS ──────────────
async function analyseJacksBets() {
  const bets = window._jacksPendingBets || [];
  if (!bets.length) return;

  const el = document.getElementById('jacksAIAnalyse');
  if (!el) return;

  el.innerHTML = `
    <div style="text-align:center;padding:.75rem 0;">
      <div style="font-family:monospace;font-size:.52rem;color:rgba(255,255,255,.88);">⏳ Claude analyseert je bets...</div>
    </div>`;

  // Bouw context op per bet
  const betsCtx = bets.map((b, i) => {
    const pickLabel = b.pick === '1' ? 'Thuis wint' : b.pick === 'X' ? 'Gelijkspel' : 'Uit wint';
    const status = b.status === 'win' ? '✅ Gewonnen' : b.status === 'lose' ? '❌ Verloren' : '⏳ Open';
    // Zoek wedstrijd data in scanlog voor extra context
    let extra = '';
    const scanPick = (state.scanLog||[]).flatMap(s=>s.picks||[]).find(p => p.matchName === b.match || p.match === b.match);
    if (scanPick) {
      if (scanPick.redenering) extra += `\n   Analyse: ${scanPick.redenering.substring(0,200)}`;
      if (scanPick.value) extra += `\n   Value: +${Math.round(scanPick.value)}% | Confidence: ${scanPick.confidence}/10`;
    }
    return `${i+1}. ${b.match}\n   Pick: ${pickLabel} @ ${b.odds} | Inzet: €${b.stake} | ${status}${extra}`;
  }).join('\n\n');

  // Stats berekenen
  const settled = bets.filter(b => b.status === 'win' || b.status === 'lose');
  const wins = bets.filter(b => b.status === 'win');
  const hitrate = settled.length ? Math.round(wins.length / settled.length * 100) : null;
  const roi = settled.length
    ? parseFloat((settled.reduce((s,b) => s + (b.status==='win' ? (b.odds-1)*b.stake : -b.stake), 0) / settled.reduce((s,b) => s + b.stake, 0) * 100).toFixed(1))
    : null;
  const avgOdds = bets.length
    ? parseFloat((bets.reduce((s,b) => s + b.odds, 0) / bets.length).toFixed(2))
    : null;

  try {
    const res = await fetch('https://api.promatchxi.app/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: `Je bent een professionele voetbalanalist. Geef een technische voetbalanalyse — geen betting advies, nooit praten over geld of inzetten.

STRUCTUUR — gebruik altijd precies deze 4 koppen:
⚽ PER WEDSTRIJD — Analyseer elke wedstrijd technisch. Benoem beide teams, wie favoriet is, recente vorm, aanvalskracht vs defensie, sleutelspelers. Geef een kans-inschatting per wedstrijd (bijv: "~70% kans Nederland wint").
🔍 KWALITEIT PICKS — Welke pick heeft de meeste voetbal-logica? Welke is het meest onzeker en waarom?
🏹 ALTERNATIEVEN — Betere opties per wedstrijd: Over/Under doelpunten (verwacht je veel of weinig goals?), Asian Handicap (welk team verdient een voorsprong?). Specifiek: "Over 2.5 goals want beide ploegen scoren gemiddeld 2+ per duel" of "AH -1 voor sterkere ploeg".
✅ CONCLUSIE — Goede combinatie? Kort ja/nee + reden.

REGELS:
- Schrijf als voetbalanalist — NOOIT over geld of inzetten
- Altijd beide teamnamen met concrete voetbalfeitjes
- Max 300 woorden`,
        messages: [{
          role: 'user',
          content: `Mijn geïmporteerde bets van de bookmaker:\n\n${betsCtx}\n\n${hitrate !== null ? `Statistieken: ${hitrate}% hitrate, ROI ${roi >= 0 ? '+' : ''}${roi}%, gem. odds ${avgOdds}` : `${bets.filter(b=>b.status==='pending').length} open bet(s), nog geen resultaten`}\n\nGeef een korte analyse in het Nederlands.`
        }]
      })
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || 'Geen analyse beschikbaar.';

    // Render analyse
    const sectionColors = { '🎯': '#00BEC4', '💡': '#7c3aed', '✅': '#16a34a' };
    const lines = text.split('\n');
    let html = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { html += '<div style="height:.35rem;"></div>'; return; }
      const secMatch = Object.keys(sectionColors).find(e => trimmed.startsWith(e));
      if (secMatch) {
        const color = sectionColors[secMatch];
        html += `<div style="font-family:monospace;font-size:.52rem;font-weight:800;
          color:\${color};margin:.6rem 0 .25rem;padding:.35rem .5rem;
          background:\${color}15;border-left:3px solid \${color};border-radius:0 6px 6px 0;">
          \${trimmed}</div>`;
      } else {
        html += `<div style="font-family:monospace;font-size:.48rem;color:rgba(255,255,255,.8);line-height:1.75;margin:.08rem 0;">\${trimmed}</div>`;
      }
    });

    el.innerHTML = '<div style="font-family:monospace;font-size:.55rem;color:rgba(255,255,255,.95);text-align:center;padding:.5rem;">✅ Analyse gereed</div>';
    renderAnalysePopup(text, 'confirmJacksTextImport()');

  } catch(e) {
    el.innerHTML = `<div style="font-family:monospace;font-size:.5rem;color:#ef4444;padding:.5rem;">
      Fout bij analyse: \${e.message}</div>`;
  }
}


// ── JACKS FOTO IMPORT ─────────────────────────────────────

let _jacksParsedBets = [];

function openJacksPhotoImport() {
  _jacksParsedBets = [];
  // Maak modal dynamisch aan als die nog niet bestaat
  let modal = document.getElementById('jacksPhotoModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'jacksPhotoModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);align-items:center;justify-content:center;padding:1rem;';
    modal.onclick = (e) => { if(e.target===modal) closeJacksPhotoImport(); };
    modal.innerHTML = `
      <div class="modal-box" style="max-height:88vh;overflow-y:auto;width:100%;max-width:420px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;">
          <h3 style="margin:0;font-size:1rem;">📸 Bookmaker Import</h3>
          <button onclick="closeJacksPhotoImport()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;">✕</button>
        </div>
        <div style="font-family:monospace;font-size:.52rem;color:rgba(255,255,255,.95);margin-bottom:.75rem;line-height:1.7;">
          Screenshot van je bookmaker-betgeschiedenis uploaden — AI leest de bets automatisch uit.
        </div>
        <label style="display:block;width:100%;padding:.65rem;border-radius:12px;text-align:center;
          background:linear-gradient(135deg,rgba(255,140,0,.12),rgba(255,100,0,.08));
          border:2px dashed rgba(255,140,0,.4);cursor:pointer;margin-bottom:.6rem;">
          <div style="font-family:monospace;font-size:.65rem;font-weight:800;color:#e67e00;">📷 Kies screenshot(s)</div>
          <div style="font-family:monospace;font-size:.48rem;color:rgba(255,255,255,.95);margin-top:.2rem;">JPG of PNG</div>
          <input type="file" accept="image/*" multiple onchange="handleJacksPhotoUpload(event)" style="display:none;">
        </label>
        <div id="jacksPhotoPreview" style="display:none;margin-bottom:.6rem;">
          <img id="jacksPhotoImg" style="width:100%;border-radius:10px;max-height:200px;object-fit:contain;background:rgba(255,255,255,.04);">
        </div>
        <div id="jacksPhotoStatus" style="font-family:monospace;font-size:.55rem;text-align:center;padding:.5rem;display:none;"></div>
        <div id="jacksPhotoBets" style="margin-bottom:.6rem;"></div>
        <div id="jacksPhotoActionBtns" style="display:none;gap:.5rem;margin-top:.5rem;">
          <button onclick="analyseJacksPhotoBets()" style="flex:1;padding:.5rem .4rem;border-radius:10px;
            background:linear-gradient(135deg,rgba(0,190,196,.15),rgba(0,190,196,.08));
            border:1px solid rgba(0,190,196,.35);color:#00BEC4;font-family:monospace;
            font-size:.56rem;font-weight:800;cursor:pointer;">🤖 Laat Claude analyseren</button>
          <button onclick="confirmJacksPhotoImport()" style="flex:1;padding:.5rem .4rem;border-radius:10px;
            background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
            color:rgba(255,255,255,.7);font-family:monospace;font-size:.56rem;cursor:pointer;">📥 Direct importeren</button>
        </div>
        <div id="jacksPhotoAIAnalyse" style="width:100%;"></div>
        <div style="margin-top:.5rem;">
          <button onclick="closeJacksPhotoImport()" style="width:100%;padding:.5rem;border-radius:8px;background:rgba(0,0,0,.06);border:1px solid rgba(255,255,255,0.09);cursor:pointer;font-family:monospace;font-size:.6rem;">Annuleer</button>
          <button id="jacksPhotoImportBtn" style="display:none;"></button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  // Reset
  const preview = document.getElementById('jacksPhotoPreview');
  const status  = document.getElementById('jacksPhotoStatus');
  const bets    = document.getElementById('jacksPhotoBets');
  const btn     = document.getElementById('jacksPhotoImportBtn');
  if (preview) preview.style.display = 'none';
  if (status)  { status.style.display = 'none'; status.textContent = ''; }
  if (bets)    bets.innerHTML = '';
  if (btn)     btn.style.display = 'none';
  const actionBtnsReset = document.getElementById('jacksPhotoActionBtns');
  if (actionBtnsReset) actionBtnsReset.style.display = 'none';
  const analyseReset = document.getElementById('jacksPhotoAIAnalyse');
  if (analyseReset) analyseReset.innerHTML = '';
}

function closeJacksPhotoImport() {
  const modal = document.getElementById('jacksPhotoModal');
  if (modal) modal.style.display = 'none';
  _jacksParsedBets = [];
}

async function handleJacksPhotoUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const preview = document.getElementById('jacksPhotoPreview');
  const img     = document.getElementById('jacksPhotoImg');
  const status  = document.getElementById('jacksPhotoStatus');
  const betsEl  = document.getElementById('jacksPhotoBets');
  const btn     = document.getElementById('jacksPhotoImportBtn');

  if (preview && img) {
    img.src = URL.createObjectURL(files[0]);
    preview.style.display = 'block';
  }
  if (status) {
    status.style.display = 'block';
    status.style.color = '#d97706';
    status.textContent = files.length > 1
      ? `\u27f3 AI leest ${files.length} screenshots uit...`
      : '\u27f3 AI leest je betgeschiedenis uit...';
  }
  if (betsEl) betsEl.innerHTML = '';
  if (btn)    btn.style.display = 'none';

  try {
    // alle gekozen afbeeldingen naar base64
    const images = await Promise.all(files.map(f => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res({ data: reader.result.split(',')[1], type: f.type || 'image/jpeg' });
      reader.onerror = () => rej(new Error('Lezen mislukt'));
      reader.readAsDataURL(f);
    })));

    const content = images.map(im => ({
      type: 'image',
      source: { type: 'base64', media_type: im.type, data: im.data }
    }));
    content.push({
      type: 'text',
      text: files.length > 1
        ? `Dit zijn ${files.length} screenshots van dezelfde betgeschiedenis (gescrold/overlappend). Combineer tot \u00e9\u00e9n lijst. ONTDUBBEL: dezelfde weddenschap die op meerdere screenshots staat tel je maar \u00e9\u00e9n keer. Als de legs van een combi over screenshots doorlopen, voeg ze samen tot \u00e9\u00e9n bet. Geef alleen JSON terug.`
        : `Extraheer alle weddenschappen uit deze betgeschiedenis screenshot. Geef alleen JSON terug.`
    });

    const response = await fetch('https://api.promatchxi.app/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: `Je bent een assistent die betgeschiedenissen uit screenshots van een bookmaker-app (bijv. Bet365, Jacks) uittrekt.
Geef ALLEEN geldige JSON terug, geen tekst daaromheen.

BELANGRIJK: Als meerdere wedstrijden samen 1 coupon vormen (combi/meervoudig/N-voud), geef ze dan als 1 bet met legs.
ONTDUBBELEN: bij meerdere screenshots die deels dezelfde inhoud tonen, lijst elke weddenschap maar \u00c9\u00c9N keer (zelfde inzet + uitbetaling + teams = zelfde bet).
Formaat voor combi: {"bets":[{"type":"combi","date":"21-06-2026","stake":10.00,"payout":522.31,"totalOdds":52.23,"status":"open","legs":[{"match":"Newcastle vs West Ham","pick":"Newcastle","odds":0}]}]}
Formaat voor single: {"bets":[{"type":"single","match":"Ajax vs PSV","date":"21-06-2026","pick":"1","odds":2.10,"stake":10.00,"payout":21.00,"status":"open"}]}
Status opties: "gewonnen", "verloren", "open"
Als je geen bets kunt vinden: {"bets":[]}
Datum formaat: dd-mm-yyyy`,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();
    if (data.usage) trackTokenUsage('claude-sonnet-4-6', data.usage.input_tokens||0, data.usage.output_tokens||0);

    const raw = data.content?.[0]?.text?.trim() || '';
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js < 0) throw new Error('Geen bets herkend in de screenshot');

    const parsed = JSON.parse(raw.substring(js, je + 1));
    _jacksParsedBets = parsed.bets || [];

    if (!_jacksParsedBets.length) {
      if (status) { status.textContent = '⚠ Geen bets gevonden. Probeer een duidelijkere screenshot.'; status.style.color = '#dc2626'; }
      return;
    }

    // Toon preview van gevonden bets
    if (status) { status.textContent = `✅ ${_jacksParsedBets.length} bet${_jacksParsedBets.length>1?'s':''} herkend`; status.style.color = '#00BEC4'; }

    if (betsEl) {
      betsEl.innerHTML = _jacksParsedBets.map((b, i) => {
        const statusIcon = b.status === 'gewonnen' ? '✅' : b.status === 'verloren' ? '❌' : '⏳';
        const statusColor = b.status === 'gewonnen' ? '#00BEC4' : b.status === 'verloren' ? '#dc2626' : '#d97706';
        const isCombi = b.type === 'combi' && b.legs?.length;
        const title = isCombi
          ? `Combi (${b.legs.length} legs) @ ${b.totalOdds||'?'}`
          : (b.match || '?');
        const sub = isCombi
          ? b.legs.map(l => l.match).join(' · ')
          : `${b.pick||'?'} @ ${b.odds||'?'}`;
        return `<div style="padding:.4rem .6rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;margin-bottom:.3rem;">
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div style="font-size:.9rem;">${statusIcon}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:monospace;font-size:.58rem;font-weight:700;color:#ffffff;">${title}</div>
              <div style="font-family:monospace;font-size:.46rem;color:rgba(255,255,255,.95);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${sub} · €${b.stake||'?'} · ${b.date||'?'}</div>
            </div>
            <div style="font-family:monospace;font-size:.55rem;font-weight:800;color:${statusColor};">
              ${b.status === 'gewonnen' ? `+€${((b.payout||0)-(b.stake||0)).toFixed(2)}` :
                b.status === 'verloren' ? `-€${(b.stake||0).toFixed(2)}` : `→€${b.payout||'?'}`}
            </div>
          </div>
        </div>`;
      }).join('');
    }

    // Toon de analyse + import knoppen (staan al in de HTML)
    if (btn) btn.style.display = 'none';
    const actionBtns = document.getElementById('jacksPhotoActionBtns');
    if (actionBtns) actionBtns.style.display = 'flex';
    const analyseEl = document.getElementById('jacksPhotoAIAnalyse');
    if (analyseEl) analyseEl.innerHTML = '';

  } catch(e) {
    if (status) { status.textContent = '⚠ Fout: ' + e.message; status.style.color = '#dc2626'; }
  }

  // Reset file input zodat je dezelfde foto nogmaals kan kiezen
  event.target.value = '';
}

function confirmJacksPhotoImport() {
  if (!_jacksParsedBets.length) return;

  let imported = 0;
  _jacksParsedBets.forEach(b => {
    const date  = b.date || new Date().toLocaleDateString('nl-NL');
    const stake = parseFloat(b.stake) || 0;
    if (!stake) return;

    let status = 'pending';
    if (b.status === 'gewonnen') status = 'win';
    else if (b.status === 'verloren') status = 'lose';

    if (b.type === 'combi' && b.legs?.length) {
      // Combi bet
      const totalOdds = parseFloat(b.totalOdds) || b.legs.reduce((a,l) => a * (parseFloat(l.odds)||1), 1);
      const payout = parseFloat(b.payout) || parseFloat((stake * totalOdds).toFixed(2));
      const legs = b.legs.map(l => ({
        match: l.match || '?',
        pick: l.pick || '?',
        odds: parseFloat(l.odds) || 0,
        status: 'pending'
      }));
      const matchName = 'Combi: ' + legs.map(l => l.match.split(' vs ')[0] || l.match.split(' - ')[0]).join(' + ');

      // Check duplicaat
      const exists = state.tracker.bets.some(t =>
        t.type === 'combi' && t.date === date && Math.abs((t.odds||0) - totalOdds) < 0.1
      );
      if (exists) return;

      state.tracker.bets.unshift({
        id: Date.now() + Math.random(),
        match: matchName,
        type: 'combi',
        legs,
        date,
        pick: legs.map(l => l.pick).join(' / '),
        odds: parseFloat(totalOdds.toFixed(2)),
        stake,
        payout,
        status,
        source: 'jacks',
        bookmaker: 'bookmaker',
        note: 'Geïmporteerd via screenshot',
        markt: 'Combi',
        score: null
      });
      imported++;
    } else {
      // Enkele bet
      const match  = b.match || '?';
      const odds   = parseFloat(b.odds) || 0;
      const payout = parseFloat(b.payout) || parseFloat((stake * odds).toFixed(2));
      if (!odds) return;

      const exists = state.tracker.bets.some(t =>
        t.match === match && t.date === date && String(t.odds) === String(odds)
      );
      if (exists) return;

      state.tracker.bets.unshift({
        id: Date.now() + Math.random(),
        match,
        date,
        pick:      b.pick || '?',
        odds,
        stake,
        payout,
        status,
        source:    'jacks',
        bookmaker: 'bookmaker',
        note:      'Geïmporteerd via screenshot',
        markt:     '1X2',
        score:     null
      });
      imported++;
    }
  });

  saveState();
  closeJacksPhotoImport();
  renderTracker();
  updateTrackerStats();
  showToast(`✅ ${imported} bet${imported>1?'s':''} geïmporteerd van bookmaker`);
  _jacksParsedBets = [];
}

// ── AI analyse van foto-geïmporteerde bets ────────────────
async function analyseJacksPhotoBets() {
  const bets = _jacksParsedBets || [];
  if (!bets.length) return;

  const el = document.getElementById('jacksPhotoAIAnalyse');
  if (!el) return;

  el.innerHTML = `<div style="text-align:center;padding:.75rem 0;">
    <div style="font-family:monospace;font-size:.52rem;color:rgba(255,255,255,.88);">⏳ Claude analyseert je bets...</div>
  </div>`;

  // Bouw context op — ondersteun zowel combis als enkelvoudige bets
  const betsCtx = bets.map((b, i) => {
    if (b.type === 'combi' && b.legs?.length) {
      const legs = b.legs.map(l => `${l.match} (${l.pick || '?'} @ ${l.odds || '?'})`).join(', ');
      return `${i+1}. COMBI @ ${b.totalOdds} — ${legs} | Inzet: €${b.stake||'?'} | Status: ${b.status||'open'}`;
    }
    const pickLabel = b.pick === '1' ? 'Thuis wint' : b.pick === 'X' ? 'Gelijkspel' : b.pick === '2' ? 'Uit wint' : (b.pick || '?');
    return `${i+1}. ${b.match||'?'} — ${pickLabel} @ ${b.odds||'?'} | Inzet: €${b.stake||'?'} | Status: ${b.status||'open'}`;
  }).join('\n');

  // Basis stats
  const settled = bets.filter(b => b.status === 'gewonnen' || b.status === 'verloren');
  const wins = bets.filter(b => b.status === 'gewonnen');
  const hitrate = settled.length ? Math.round(wins.length / settled.length * 100) : null;
  const openBets = bets.filter(b => !b.status || b.status === 'open' || b.status === 'actief');

  try {
    const res = await fetch('https://api.promatchxi.app/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: `Je bent een professionele voetbalanalist. Geef een technische voetbalanalyse per wedstrijd.

STRUCTUUR — gebruik altijd precies deze 4 koppen:
⚽ PER WEDSTRIJD — Analyseer elke wedstrijd technisch. Benoem beide teams, wie favoriet is, recente vorm, aanvalskracht vs defensie, sleutelspelers. Geef een kans-inschatting (bijv: "~70% kans Nederland wint").
🔍 KWALITEIT PICKS — Welke pick heeft de meeste voetbal-logica? Welke is het meest onzeker en waarom?
🏹 ALTERNATIEVEN — Betere opties per wedstrijd: Over/Under doelpunten (verwacht je veel of weinig goals op basis van de teams?), Asian Handicap (welk team verdient een voorsprong?). Specifiek: "Over 2.5 goals want beide ploegen scoren gemiddeld 2+ per duel" of "AH -1 voor sterkere ploeg".
✅ CONCLUSIE — Goede combinatie? Kort ja/nee + reden.

REGELS:
- Schrijf als voetbalanalist — NOOIT over geld of inzetten
- Altijd beide teamnamen met concrete voetbalfeitjes
- Max 300 woorden`,
        messages: [{
          role: 'user',
          content: `Voetbalanalyse voor deze picks:\n\n${betsCtx}\n\nGeef een technische voetbalanalyse in het Nederlands.`
        }]
      })
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || 'Geen analyse beschikbaar.';

    const sectionColors = { '🎯': '#00BEC4', '💡': '#7c3aed', '✅': '#16a34a' };
    const lines = text.split('\n');
    let html = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { html += '<div style="height:.3rem;"></div>'; return; }
      const secMatch = Object.keys(sectionColors).find(e => trimmed.startsWith(e));
      if (secMatch) {
        const color = sectionColors[secMatch];
        html += `<div style="font-family:monospace;font-size:.52rem;font-weight:800;color:${color};
          margin:.6rem 0 .25rem;padding:.35rem .5rem;background:${color}15;
          border-left:3px solid ${color};border-radius:0 6px 6px 0;">${trimmed}</div>`;
      } else {
        html += `<div style="font-family:monospace;font-size:.48rem;color:rgba(255,255,255,.8);line-height:1.75;">${trimmed}</div>`;
      }
    });

    el.innerHTML = '<div style="font-family:monospace;font-size:.55rem;color:rgba(255,255,255,.95);text-align:center;padding:.5rem;">✅ Analyse gereed</div>';
    renderAnalysePopup(text, 'confirmJacksPhotoImport()');

  } catch(e) {
    el.innerHTML = `<div style="font-family:monospace;font-size:.5rem;color:#ef4444;padding:.5rem;">
      Fout bij analyse: ${e.message}</div>`;
  }
}

function ptSaveFromScan(home, away, pick, pickLabel, odds, value, confidence, poissonUsed, reason, poissonK1, poissonKX, poissonK2, aiKans) {
  if ((confidence||0) < 7) return; // v14.9: confidence filter
  if (!state.valueBacktest) state.valueBacktest={picks:[]};
  const existing = state.valueBacktest.picks.find(p =>
    p.matchName===`${home} vs ${away}` && p.pick===pick && p.date===new Date().toLocaleDateString('nl-NL')
  );
  if (existing) { showToast(t('wal.alreadysaved','Al opgeslagen')); return; }
  const pt = {
    id: Date.now()+'_pt',
    matchName:`${home} vs ${away}`,
    pick, pickLabel, odds,
    value:parseFloat(value)||0, confidence:parseInt(confidence)||7,
    poissonUsed:!!poissonUsed, reason,
    poissonK1:parseFloat(poissonK1)||0, poissonKX:parseFloat(poissonKX)||0, poissonK2:parseFloat(poissonK2)||0,
    aiKans:parseInt(aiKans)||0, kelly:parseFloat(((value/100)/(odds-1)*0.5*100).toFixed(1)),
    bookmaker:state.settings.defaultBookmaker||'?',
    date:new Date().toLocaleDateString('nl-NL'),
    status:'pending', score:null
  };
  state.valueBacktest.picks.unshift(pt);
  if (state.valueBacktest.picks.length>200) state.valueBacktest.picks=state.valueBacktest.picks.slice(0,200);
  saveState();
  showToast(`🎯 Opgeslagen: ${home} vs ${away}`);
}

// ══════════════════════════════════════════════════════════
// WALLET POPUP — universele detail popup voor alle cards
// ══════════════════════════════════════════════════════════
function showWalletPopup(type, data) {
  const existing = document.getElementById('walletPopupOverlay');
  if (existing) existing.remove();

  const hrColor = n => n >= 55 ? '#00BEC4' : n >= 45 ? '#d97706' : '#dc2626';
  let headerHtml = '', bodyHtml = '';

  function makeRows(rows) {
    return rows.filter(([,v]) => v && v !== '—').map(([k, v, col]) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--card-bg,rgba(0,0,0,.06));">
        <div style="font-family:monospace;font-size:.48rem;color:var(--sub,#64748b);">${k}</div>
        <div style="font-family:monospace;font-size:.52rem;font-weight:700;color:${col||'var(--ink,#0f172a)'};">${v}</div>
      </div>`).join('');
  }

  if (type === 'backtest') {
    const p = data;
    const statusColor = p.status==='win'?'#00BEC4':p.status==='lose'?'#dc2626':'#d97706';
    const icon = p.status==='win'?'✅':p.status==='lose'?'❌':'⏳';
    headerHtml = `<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:var(--ink,#0f172a);">${icon} ${p.matchName||'Pick'}</div>
      <div style="font-family:monospace;font-size:.48rem;color:var(--sub,#64748b);margin-top:.1rem;">📅 ${p.date||''}${p.matchTime||p.time ? ' ' + (p.matchTime||p.time) : ''} · ${p.comp||''}</div>`;
    bodyHtml = makeRows([
      ['Pick', p.pickLabel||p.pick||'—', null],
      ['Quote', p.odds||'—', null],
      ['Value', p.value ? '+'+p.value+'%' : '—', p.value>=15?'#00BEC4':p.value>=5?'#b45309':null],
      ['Confidence', p.confidence ? p.confidence+'/10' : '—', p.confidence>=7?'#00BEC4':p.confidence>=5?'#b45309':'#dc2626'],
      ['AI kans', p.aiKans ? p.aiKans+'%' : '—', null],
      ['Kelly', p.kelly ? p.kelly+'%' : '—', null],
      ['Status', p.status==='win'?'WIN':p.status==='lose'?'VERLIES':'OPEN', statusColor],
      ['Score', p.score||'—', null],
      ['Bookmaker', p.bookmaker||'—', null],
    ]);
    if (p.reason) {
      bodyHtml += `<div style="background:rgba(0,190,196,.05);border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:.5rem .7rem;margin-top:.6rem;">
        <div style="font-family:monospace;font-size:.44rem;color:#1d4ed8;font-weight:700;margin-bottom:.2rem;">REDEN</div>
        <div style="font-family:\'DM Sans\',sans-serif;font-size:.65rem;color:var(--ink,#0f172a);line-height:1.6;">${p.reason}</div>
      </div>`;
    }
    // Signalen sectie
    if (typeof buildPickReasons === 'function') {
      const signals = buildPickReasons(p);
      if (signals.length) {
        bodyHtml += `<div style="margin-top:.6rem;">
          <div style="font-family:monospace;font-size:.44rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.3rem;">SIGNALEN</div>
          <div style="display:flex;flex-wrap:wrap;gap:.25rem;">
            ${signals.map(s => `<span style="font-family:\'IBM Plex Mono\',monospace;font-size:.46rem;background:${s.color}18;color:${s.color};border:1px solid ${s.color}33;border-radius:6px;padding:.1rem .35rem;white-space:nowrap;">${s.icon} ${s.text}</span>`).join('')}
          </div>
        </div>`;
      }
    }
    // Mini grafiekje in popup
    const allPicks = state.valueBacktest?.picks || [];
    const settled = allPicks.filter(x => x.status==='win'||x.status==='lose');
    if (settled.length >= 2) {
      bodyHtml += `<div style="margin-top:.8rem;"><div style="font-family:monospace;font-size:.46rem;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:.3rem;">ROI CURVE</div>
        <canvas id="popupBtChart" height="70" style="width:100%;border-radius:8px;"></canvas></div>`;
    }

  } else if (type === 'tracker') {
    const b = data;
    // v26.277: pmxProfit voor half verlies/push (consistent met de lijst)
    const pnlVal = pmxIsSettled(b) ? pmxProfit(b) : null;
    const pnlText = pnlVal !== null ? (pmxIsPush(b) ? 'push €0,00' : (pnlVal>=0?'+':'')+'€'+pnlVal.toFixed(2)) : '⏳ Open';
    const pnlColor = b.status==='pending' ? '#d97706' : pmxIsPush(b) ? '#b45309' : pnlVal>0 ? '#00BEC4' : pnlVal<0 ? '#dc2626' : '#94a3b8';
    const icon = b.status==='win'?'✅':b.status==='lose'?'❌':'⏳';
    headerHtml = `<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.2rem;color:var(--ink,#0f172a);">${icon} ${b.match||'Weddenschap'}</div>
      <div style="font-family:monospace;font-size:.48rem;color:var(--sub,#64748b);margin-top:.1rem;">${b.date||''} · ${b.bookmaker||''}</div>`;
    bodyHtml = makeRows([
      ['Pick', b.pick||'—', null],
      ['Quote', b.odds||'—', null],
      ['Inzet', b.stake ? '€'+b.stake.toFixed(2) : '—', null],
      ['Payout', b.payout ? '€'+b.payout.toFixed(2) : '—', null],
      ['P&L', pnlText, pnlColor],
      ['Bron', b.source||'eigen', null],
      ['Score', b.score||'—', null],
      ['Notitie', b.note||'—', null],
    ]);
    if (b.legs && b.legs.length) {
      bodyHtml += `<div style="font-family:monospace;font-size:.48rem;font-weight:700;color:rgba(255,255,255,.95);margin:.7rem 0 .3rem;">COMBI LEGS</div>`;
      b.legs.forEach((l,i) => {
        const lc = l.status==='win'?'#00BEC4':l.status==='lose'?'#dc2626':'#d97706';
        bodyHtml += `<div style="background:var(--card-bg,rgba(0,0,0,.03));border-radius:10px;padding:.5rem .7rem;margin-bottom:.3rem;">
          <div style="font-family:\'DM Sans\',sans-serif;font-size:.65rem;font-weight:600;">${l.match||'Leg '+(i+1)}</div>
          <div style="display:flex;justify-content:space-between;margin-top:.2rem;">
            <div style="font-family:monospace;font-size:.46rem;color:rgba(255,255,255,.95);">${l.pick} @ ${l.odds}</div>
            <div style="font-family:monospace;font-size:.46rem;font-weight:700;color:${lc};">${l.status==='win'?'WIN':l.status==='lose'?'VERLIES':'OPEN'}</div>
          </div></div>`;
      });
    }
  }

  const overlay = document.createElement('div');
  overlay.id = 'walletPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(2px);';
  overlay.innerHTML = `
    <div style="background:var(--bg,#f8fafc);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 32px rgba(15,23,42,.18);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:.85rem 1rem .7rem;border-bottom:1px solid var(--track-bg,rgba(0,0,0,.08));">
        <div>${headerHtml}</div>
        <button onclick="document.getElementById('walletPopupOverlay').remove()"
          style="background:var(--card-bg,rgba(0,0,0,.07));border:none;border-radius:50%;width:2rem;height:2rem;font-size:.9rem;cursor:pointer;flex-shrink:0;margin-left:.5rem;">✕</button>
      </div>
      <div style="overflow-y:auto;padding:.8rem 1rem 1.5rem;flex:1;">${bodyHtml}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  // Teken mini grafiek in popup na render
  if (type === 'backtest') {
    setTimeout(() => {
      const c = document.getElementById('popupBtChart');
      if (!c) return;
      const allPicks = state.valueBacktest?.picks || [];
      const settled = allPicks.filter(x => x.status==='win'||x.status==='lose');
      if (settled.length < 2) return;
      const ctx = c.getContext('2d');
      c.width = c.offsetWidth || 320; c.height = 70;
      const W = c.width, H = 70;
      ctx.clearRect(0,0,W,H);
      const points = [0];
      settled.forEach(p => { const last = points[points.length-1]; points.push(last + (p.status==='win'?(p.odds-1):-1)); });
      const minV=Math.min(...points,-0.5), maxV=Math.max(...points,0.5), range=maxV-minV;
      const pad={top:8,bottom:8,left:8,right:8};
      const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;
      const xP=i=>pad.left+(i/Math.max(points.length-1,1))*cw;
      const yP=v=>pad.top+ch-((v-minV)/range)*ch;
      const lastVal=points[points.length-1], isPos=lastVal>=0;
      const lineColor=isPos?'#00BEC4':'#dc2626';
      // Zero lijn
      ctx.setLineDash([2,2]); ctx.strokeStyle='rgba(148,163,184,.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pad.left,yP(0)); ctx.lineTo(pad.left+cw,yP(0)); ctx.stroke();
      ctx.setLineDash([]);
      // Gradient
      const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);
      grad.addColorStop(0,isPos?'rgba(21,128,61,.2)':'rgba(220,38,38,.15)');
      grad.addColorStop(1,'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.moveTo(xP(0),yP(0));
      points.forEach((v,i)=>{ if(i>0) ctx.lineTo(xP(i),yP(v)); });
      ctx.lineTo(xP(points.length-1),H-pad.bottom); ctx.lineTo(xP(0),H-pad.bottom);
      ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
      // Lijn
      ctx.beginPath(); ctx.moveTo(xP(0),yP(0));
      points.forEach((v,i)=>{ if(i>0) ctx.lineTo(xP(i),yP(v)); });
      ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
      // Highlight huidig pick
      const curIdx = settled.indexOf(data);
      if (curIdx >= 0) {
        ctx.beginPath(); ctx.arc(xP(curIdx+1),yP(points[curIdx+1]),5,0,Math.PI*2);
        ctx.fillStyle='#f59e0b'; ctx.fill();
        ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
      }
    }, 80);
  }
}

