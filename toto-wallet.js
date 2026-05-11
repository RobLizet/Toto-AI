// TOTO AI — Wallet & Backtest v11.73
// Automatisch gegenereerd — bewerk niet handmatig

// WALLET


// ═══════════════════════════════════════════════════════


function updateWalletUI() {


  const w = state.wallet;


  const fmt = v => '€' + v.toFixed(2).replace('.',',');


  const pnl = w.totalWon - w.totalStaked;


  const wins = w.bets.filter(b => b.status === 'win').length;


  const settled = w.bets.filter(b => b.status !== 'pending').length;


  const open = w.bets.filter(b => b.status === 'pending').length;


  // Toon sample size zodat 100% bij 1/1 niet misleidend is


  const hitRate = settled > 0


    ? Math.round(wins/settled*100) + '%' + (settled < 10 ? ` (${settled})` : '')


    : '—';





  document.getElementById('miniBalance').textContent = fmt(w.balance);


  document.getElementById('miniPnl').textContent = (pnl >= 0 ? '+' : '') + fmt(pnl);


  document.getElementById('miniPnl').style.color = pnl >= 0 ? 'var(--green)' : 'var(--red)';


  document.getElementById('miniBets').textContent = w.bets.length;


  document.getElementById('miniRate').textContent = hitRate;


  document.getElementById('bigBalance').textContent = fmt(w.balance);


  document.getElementById('totalStaked').textContent = fmt(w.totalStaked);


  document.getElementById('totalWon').textContent = fmt(w.totalWon);


  document.getElementById('hitRate').textContent = hitRate;





  // Gemiddelde Expected Value berekenen


  const settledBets = w.bets.filter(b => b.status !== 'pending' && b.odds);


  const avgEV = settledBets.length > 0


    ? (settledBets.reduce((sum, b) => {


        const impliedProb = 1 / parseFloat(b.odds);


        const actualOutcome = b.status === 'win' ? 1 : 0;


        return sum + (actualOutcome - impliedProb);


      }, 0) / settledBets.length * 100)


    : null;


  const evEl = document.getElementById('miniEV');


  if (evEl) {


    evEl.textContent = avgEV !== null ? (avgEV >= 0 ? '+' : '') + avgEV.toFixed(1) + '%' : '—';


    evEl.style.color = avgEV === null ? '#7c3aed' : avgEV >= 0 ? '#16a34a' : '#dc2626';


  }





  renderWalletChart();





  const list = document.getElementById('betHistoryList');


  if (w.bets.length === 0) { list.innerHTML = '<div class="empty-state">Nog geen inzetten</div>'; return; }


  list.innerHTML = w.bets.map(b => {


    if (b.type === 'combi') {


      const legsHtml = b.legs.map((l,i) => `


        <div class="combi-bet-leg leg-${l.legStatus||'pending'}">


          <span>${l.home} vs ${l.away} — ${l.pick} (${l.odds.toFixed(2)})${l.score?` <b>[${l.score}]</b>`:''}</span>


          <button class="combi-leg-status-btn" onclick="cycleCombiLegStatus(${b.id},${i})">${l.legStatus === 'win'?'✓':l.legStatus === 'lose'?'✗':'⏳'}</button>


        </div>`).join('');


      return `<div class="combi-bet-row">


        <div class="combi-bet-header">


          <span class="combi-bet-label">🎰 COMBI ${b.legs.length} LEGS · ${b.date}</span>


          <span class="combi-bet-odds">${b.totalOdds.toFixed(2)}</span>


        </div>


        <div class="combi-bet-legs">${legsHtml}</div>


        <div class="combi-bet-footer">


          <div style="display:flex;align-items:center;gap:.5rem;">


            <span class="combi-bet-amount">€${b.amount.toFixed(2)} → €${b.payout.toFixed(2)}</span>


            <button onclick="deleteBet(${b.id})" style="background:none;border:none;color:#94a3b8;font-size:.8rem;cursor:pointer;padding:0;" title="Verwijder deze weddenschap">✕</button>


          </div>


          <span class="combi-bet-result ${b.status}" onclick="cycleCombiBetStatus(${b.id})">${b.status === 'win'?'✓ +€'+(b.payout-b.amount).toFixed(2):b.status === 'lose'?'✗ VERLIES':'⏳ OPEN'}</span>


        </div></div>`;


    } else {


      return `<div class="bet-row swipeable" id="swipe-${b.id}">


        <div class="swipe-hint win-hint">✓ WIN</div>


        <div class="swipe-hint lose-hint">✗ VERLIES</div>


        <div class="swipe-inner">


        <div class="bet-info">


          <div class="bet-match-name">


            ${b.matchName}


            ${b.score ? `<span style="font-size:.6rem;font-weight:700;">[${b.score}]</span>` : ''}


            ${b.liveScore && b.status==='pending' ? `<span class="bet-live-score"><span class="bet-live-dot"></span>${b.liveScore}${b.liveMinute ? ' '+b.liveMinute+"'" : ''}</span>` : ''}


          </div>


          <div class="bet-meta">${b.pick} — ${b.pickLabel} @ ${b.odds} · ${b.date}</div>


        </div>


        <div style="text-align:right;">


          <div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem;margin-bottom:2px;">


            <div class="bet-amt">€${b.amount.toFixed(2)}</div>


            <button onclick="deleteBet(${b.id})" style="background:none;border:none;color:#94a3b8;font-size:.8rem;cursor:pointer;padding:0;" title="Verwijder">✕</button>


          </div>


          ${b.status === 'pending' ? `<button onclick="checkBetResult(${b.id})" style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:700;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);color:#2563eb;border-radius:6px;padding:2px 7px;cursor:pointer;display:block;width:100%;">🔍 CHECK</button>` : ''}


          <div class="bet-res ${b.status}" onclick="cycleBetStatus(${b.id})">${b.status === 'win'?'✓ +€'+(b.payout-b.amount).toFixed(2)+(b.score?' ['+b.score+']':''): b.status === 'lose'?'✗'+(b.score?' ['+b.score+']':''): '⏳ OPEN'}</div>


        </div>


        </div></div>`;


    }


  }).join('');


  setTimeout(initSwipeBets, 50);


}





async function checkBetResult(betId) {


  const bet = state.wallet.bets.find(b => b.id === betId);


  if (!bet) { alert('Inzet niet gevonden'); return; }


  const apiKey = null; // key op server


  const legs = bet.type === 'combi' ? bet.legs : [{home:bet.matchName?.split(' vs ')?.[0], away:bet.matchName?.split(' vs ')?.[1], pick:bet.pick, fixtureId:bet.fixtureId}];





  function parseBetDate(s) {


    if (!s) return null;


    const p = s.split('-');


    if (p.length === 3) {


      if (p[0].length === 4) return s;


      return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;


    }


    return null;


  }





  // Helper: fetch a single fixture by ID directly


  async function fetchFixtureById(fid) {


    try {


      const r = await apiFetch(`https://v3.football.api-sports.io/fixtures?id=${fid}`, null);


      const d = await r.json();


      return (d.response||[])[0] || null;


    } catch(e) { return null; }


  }





  // Helper: fetch fixtures by date (all leagues)


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





      // 1. Direct lookup by fixture ID (most reliable)


      if (fid) {


        fix = await fetchFixtureById(fid);


        console.log('[CheckBet] Direct ID lookup', fid, '→', fix ? fix.fixture.status.short : 'not found');


      }





      // 2. Fallback: search by date + team name


      if (!fix || !['FT','AET','PEN'].includes(fix?.fixture?.status?.short)) {


        const betDate = parseBetDate(bet.date);


        if (betDate && leg.home && leg.away) {


          const pool = await fetchFixturesByDate(betDate);


          const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();


          const words = s => norm(s).split(' ').filter(w => w.length > 2);


          const hwds = words(leg.home), awds = words(leg.away);


          console.log('[CheckBet] Date fallback pool size:', pool.length, 'for', leg.home, 'vs', leg.away);


          fix = pool.find(f => {


            if (!['FT','AET','PEN'].includes(f.fixture.status.short)) return false;


            const fh = norm(f.teams.home.name), fa = norm(f.teams.away.name);


            const homeMatch = hwds.some(w => fh.includes(w));


            const awayMatch = awds.some(w => fa.includes(w));


            return homeMatch && awayMatch;


          });


          if (!fix) console.warn('[CheckBet] Still not found:', leg.home, 'vs', leg.away);


        }


      }





      if (!fix || !['FT','AET','PEN'].includes(fix?.fixture?.status?.short)) continue;


      const hg = fix.goals.home ?? 0, ag = fix.goals.away ?? 0;


      leg.score = `${hg}-${ag}`;


      let won = false;


      const p = leg.pick;


      if (p === '1') won = hg > ag;


      else if (p === '2') won = ag > hg;


      else if (p === 'X') won = hg === ag;


      else if (p === '1X') won = hg >= ag;


      else if (p === 'X2') won = ag >= hg;


      else if (p === 'O2.5') won = (hg+ag) > 2.5;


      else if (p === 'U2.5') won = (hg+ag) < 2.5;


      else if (p === 'O1.5') won = (hg+ag) > 1.5;


      else if (p === 'O3.5') won = (hg+ag) > 3.5;


      else if (p === 'BTTS-J') won = hg > 0 && ag > 0;


      else if (p === 'BTTS-N') won = hg === 0 || ag === 0;


      leg.legStatus = won ? 'win' : 'lose';


    } catch(e) {}


  }





  if (bet.type === 'combi') {


    const anyLose = legs.some(l => l.legStatus === 'lose');


    const allWin = legs.every(l => l.legStatus === 'win');


    if (anyLose && bet.status === 'pending') bet.status = 'lose';


    else if (allWin && bet.status === 'pending') {


      bet.status = 'win';


      state.wallet.balance += bet.payout;


      state.wallet.totalWon += bet.payout;


    }


  } else {


    const leg = legs[0];


    bet.score = leg.score;


    if (leg.legStatus === 'win' && bet.status === 'pending') {


      bet.status = 'win';


      state.wallet.balance += bet.payout;


      state.wallet.totalWon += bet.payout;


    } else if (leg.legStatus === 'lose' && bet.status === 'pending') {


      bet.status = 'lose';


    }


  }


  saveState(); updateWalletUI();


}





function cycleCombiBetStatus(id) {


  const b = state.wallet.bets.find(x => x.id === id);


  if (!b || b.type !== 'combi') return;


  if (b.status === 'pending') { b.status = 'win'; b.legs.forEach(l => l.legStatus = 'win'); state.wallet.balance += b.payout; state.wallet.totalWon += b.payout; }


  else if (b.status === 'win') { b.status = 'pending'; b.legs.forEach(l => { l.legStatus = 'pending'; l.score = null; }); state.wallet.balance -= b.payout; state.wallet.totalWon -= b.payout; }


  else { b.status = 'pending'; b.legs.forEach(l => { l.legStatus = 'pending'; l.score = null; }); }


  saveState(); updateWalletUI();


}





function deleteBet(id) {


  const bet = state.wallet.bets.find(b => b.id === id);


  if (!bet) return;


  const label = bet.type === 'combi'


    ? `Combi (${bet.legs?.length||0} legs) €${bet.amount?.toFixed(2)}`


    : `${bet.matchName} — ${bet.pick}`;


  if (!confirm(`Verwijderen: ${label}?`)) return;





  // Herstel saldo als bet nog open staat (geld was al afgeschreven)


  if (bet.status === 'pending') {


    state.wallet.balance += bet.amount;


    state.wallet.totalStaked -= bet.amount;


  }


  // Als bet gewonnen was en wordt verwijderd: undo winst


  if (bet.status === 'win') {


    state.wallet.balance -= bet.payout;


    state.wallet.totalWon -= bet.payout;


    // Staked was al verrekend bij plaatsen, dus die laten we staan


  }





  state.wallet.bets = state.wallet.bets.filter(b => b.id !== id);


  saveState();


  updateWalletUI();


}





function cycleBetStatus(id) {


  const b = state.wallet.bets.find(x => x.id === id);


  if (!b) return;


  // pending → win → lose → pending


  if (b.status === 'pending') {


    b.status = 'win'; state.wallet.balance += b.payout; state.wallet.totalWon += b.payout;


  } else if (b.status === 'win') {


    // undo win, set to lose


    state.wallet.balance -= b.payout; state.wallet.totalWon -= b.payout;


    b.status = 'lose'; b.score = null;


  } else {


    // lose → pending


    b.status = 'pending'; b.score = null;


  }


  saveState(); updateWalletUI();


}





function openDepositModal() { document.getElementById('depositModal').classList.add('show'); }


function openWithdrawModal() {


  const amt = parseFloat(prompt('Opnemen (€):','50'));


  if (amt && amt > 0 && amt <= state.wallet.balance) {


    state.wallet.balance -= amt; saveState(); updateWalletUI();


  }


}


function confirmDeposit() {


  const amt = parseFloat(document.getElementById('depositInput').value);


  if (amt && amt > 0) { state.wallet.balance += amt; saveState(); updateWalletUI(); }


  closeModal('depositModal');


}


function closeModal(id) { document.getElementById(id).classList.remove('show'); }


function clearWallet() {


  if (!confirm('Weet je het zeker? Dit wist ALLE inzetten.')) return;


  const nb = parseInt(document.getElementById('settStartBalance')?.value)||state.settings.startBalance||500;


  state.wallet.balance=nb;state.wallet.totalStaked=0;state.wallet.totalWon=0;state.wallet.bets=[];state.settings.startBalance=nb;


  saveState();updateWalletUI();applySettings();


  showAutoCheckStatus('🗑 Wallet gewist','#dc2626');


}





function resetWallet(mode) {


  const newBal = parseInt(document.getElementById('settStartBalance')?.value) || state.settings.startBalance || 500;


  if (mode === 'zero') {


    if (!confirm('Wallet naar €0 resetten en ALLE trades wissen?')) return;


    state.wallet = { balance:0, totalStaked:0, totalWon:0, bets:[] };


    state.settings.startBalance = 0;


    saveState(); updateWalletUI(); applySettings();


    showAutoCheckStatus('🗑 Wallet gewist naar €0', '#dc2626');


  } else if (mode === 'full') {


    if (!confirm('Wallet resetten naar €' + newBal + ' en ALLE trades wissen?')) return;


    state.wallet = { balance:newBal, totalStaked:0, totalWon:0, bets:[] };


    state.settings.startBalance = newBal;


    saveState(); updateWalletUI(); applySettings();


    showAutoCheckStatus('🗑 Wallet gewist naar €' + newBal, '#dc2626');


  } else {


    if (!confirm('Saldo resetten naar €' + newBal + '? Trades blijven bewaard.')) return;


    state.wallet.balance = newBal;


    state.settings.startBalance = newBal;


    saveState(); updateWalletUI(); applySettings();


  }


}





function showResetOptions() {


  const newBal = state.settings.startBalance || 500;


  const wis = confirm('Wallet resetten?\n\nOK = saldo naar €' + newBal + ' + alle trades WISSEN\nAnnuleren = terug');


  if (!wis) return;


  const toZero = confirm('Naar €' + newBal + ' of naar €0?\n\nOK = naar €0\nAnnuleren = naar €' + newBal);


  resetWallet(toZero ? 'zero' : 'full');


}





async function autoCheckAllBets() {


  const open = state.wallet.bets.filter(b => b.status === 'pending');


  if (!open.length) { showAutoCheckStatus('Geen open weddenschappen', '#475569'); return; }


  showAutoCheckStatus(`⟳ ${open.length} checken...`, '#d97706');


  let checked = 0, upd = 0;


  for (const bet of open) {


    try {


      const prevStatus = bet.status;


      await checkBetResult(bet.id);


      checked++;


      if (bet.status !== prevStatus) {


        upd++;


        const emoji = bet.status === 'win' ? '✅' : '❌';


        const result = bet.status === 'win' ? '+€' + (bet.payout - bet.amount).toFixed(2) : '-€' + bet.amount.toFixed(2);


        sendPickNotification(


          emoji + ' Bet ' + (bet.status === 'win' ? 'GEWONNEN' : 'VERLOREN'),


          (bet.matchName || 'Weddenschap') + ' — ' + result,


          'bet-' + bet.id


        );


      }


    } catch(e) {}


  }


  showAutoCheckStatus(`✓ ${checked} gecheckt · ${upd} bijgewerkt`, '#16a34a');


  updateWalletUI();


}


function showAutoCheckStatus(msg, color) {


  const el = document.getElementById('autoCheckStatus');


  if (!el) return;


  el.style.display = 'block';


  el.style.color = color;


  el.style.background = color === '#16a34a' ? 'rgba(22,163,74,.08)' : 'rgba(15,23,42,.05)';


  el.style.border = `1px solid ${color}33`;


  el.textContent = msg;


  setTimeout(() => el.style.display = 'none', 5000);


}





// ═══════════════════════════════════════════════════════


// TRACKER


// ═══════════════════════════════════════════════════════





// ═══════════════════════════════════════════════════════


// TRACKER COMBI


// ═══════════════════════════════════════════════════════


let trackerType = 'single';


let trackerLegs = [];





function setTrackerType(type) {


  trackerType = type;


  const isSingle = type === 'single';


  // Toggle buttons


  document.getElementById('trTypeSingle').style.background = isSingle ? 'rgba(219,39,119,.1)' : 'transparent';


  document.getElementById('trTypeSingle').style.borderWidth = isSingle ? '2px' : '1.5px';


  document.getElementById('trTypeSingle').style.color = isSingle ? '#be185d' : '#475569';


  document.getElementById('trTypeCombi').style.background = !isSingle ? 'rgba(219,39,119,.1)' : 'transparent';


  document.getElementById('trTypeCombi').style.borderWidth = !isSingle ? '2px' : '1.5px';


  document.getElementById('trTypeCombi').style.color = !isSingle ? '#be185d' : '#475569';


  // Show/hide sections


  document.getElementById('trSingleSection').style.display = isSingle ? 'block' : 'none';


  document.getElementById('trPickSection').style.display = isSingle ? 'grid' : 'none';


  document.getElementById('trOddsSection').style.display = isSingle ? 'block' : 'none';


  document.getElementById('trCombiSection').style.display = !isSingle ? 'block' : 'none';


  if (!isSingle && trackerLegs.length === 0) { addTrackerLeg(); addTrackerLeg(); }


}





function addTrackerLeg() {


  const id = Date.now();


  trackerLegs.push({ id, match:'', pick:'', odds:'' });


  renderTrackerLegs();


}





function removeTrackerLeg(id) {


  if (trackerLegs.length <= 2) return;


  trackerLegs = trackerLegs.filter(l => l.id !== id);


  renderTrackerLegs();


}





function renderTrackerLegs() {


  const container = document.getElementById('trLegsContainer');


  if (!container) return;


  container.innerHTML = trackerLegs.map((leg, i) => `


    <div class="tr-combi-leg">


      <div style="display:flex;justify-content:space-between;align-items:center;">


        <div class="tr-combi-leg-num">LEG ${i+1}</div>


        ${trackerLegs.length > 2 ? `<button onclick="removeTrackerLeg(${leg.id})" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.85rem;">✕</button>` : ''}


      </div>


      <input class="modal-input" style="margin-bottom:.3rem;" placeholder="Wedstrijd (bijv. Ajax vs PSV)"


        value="${leg.match}" oninput="trackerLegs[${i}].match=this.value">


      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">


        <input class="modal-input" placeholder="Pick (bijv. 1, O2.5)"


          value="${leg.pick}" oninput="trackerLegs[${i}].pick=this.value">


        <input class="modal-input" type="number" step="0.01" placeholder="Quote"


          value="${leg.odds}" oninput="trackerLegs[${i}].odds=this.value;updateCombiTotal()">


      </div>


    </div>


  `).join('');


  updateCombiTotal();


}





function updateCombiTotal() {


  const el = document.getElementById('trCombiTotal');


  if (!el) return;


  const odds = trackerLegs.map(l => parseFloat(l.odds)).filter(o => o > 1);


  if (odds.length < 2) { el.textContent = 'Gecombineerde quote: —'; return; }


  const total = odds.reduce((a,b) => a*b, 1);


  el.textContent = `Gecombineerde quote: ${total.toFixed(2)} (${odds.length} legs)`;


}





let trackerSource = 'eigen';


let trackerFilter = 'all';





function openTrackerModal() {


  trackerType = 'single';


  trackerLegs = [];


  setTrackerType('single');


  document.getElementById('trDate').value = new Date().toISOString().split('T')[0];


  document.getElementById('trMatch').value = state.selectedMatch ? `${state.selectedMatch.home} vs ${state.selectedMatch.away}` : '';


  document.getElementById('trBookmaker').value = '';


  document.getElementById('trPick').value = '';


  document.getElementById('trOdds').value = '';


  document.getElementById('trStakeInput').value = state.settings.defaultBet || 10;


  document.getElementById('trNote').value = '';


  selectTrackerSource('eigen');


  document.getElementById('trackerModal').classList.add('show');


}





function selectTrackerSource(src) {


  trackerSource = src;


  ['analyse','combi','value','eigen'].forEach(s => {


    const btn = document.getElementById('trs-' + s);


    if (btn) { btn.style.opacity = s === src ? '1' : '0.45'; btn.style.fontWeight = s === src ? '900' : '700'; }


  });


}





function confirmTracker() {


  const stake = parseFloat(document.getElementById('trStakeInput').value);


  const date = document.getElementById('trDate').value;


  const bookmaker = document.getElementById('trBookmaker').value.trim();


  const note = document.getElementById('trNote').value.trim();


  if (!stake) { alert('Vul een inzet in'); return; }





  let bet;





  if (trackerType === 'combi') {


    // Validate legs


    const validLegs = trackerLegs.filter(l => l.match && l.pick && parseFloat(l.odds) > 1);


    if (validLegs.length < 2) { alert('Vul minimaal 2 complete legs in (wedstrijd + pick + quote)'); return; }


    const combiOdds = validLegs.reduce((a,l) => a * parseFloat(l.odds), 1);


    const matchLabel = validLegs.map(l => l.match.split(' vs ')[0]).join(' + ');


    bet = {


      id: Date.now(),


      match: `Combi: ${matchLabel}`,


      type: 'combi',


      legs: validLegs.map(l => ({


        match: l.match,


        pick: l.pick,


        odds: parseFloat(l.odds),


        status: 'pending'


      })),


      date, bookmaker,


      pick: validLegs.map(l => l.pick).join(' + '),


      markt: 'Combi',


      odds: parseFloat(combiOdds.toFixed(2)),


      stake, payout: parseFloat((stake * combiOdds).toFixed(2)),


      source: trackerSource,


      note, status: 'pending', score: null


    };


  } else {


    const match = document.getElementById('trMatch').value.trim();


    const pick = document.getElementById('trPick').value.trim();


    const odds = parseFloat(document.getElementById('trOdds').value);


    if (!match || !pick || !odds) { alert('Vul alle velden in'); return; }


    bet = {


      id: Date.now(), match,


      date, bookmaker,


      pick, markt: document.getElementById('trMarkt').value,


      odds, stake, payout: parseFloat((stake*odds).toFixed(2)),


      source: trackerSource,


      note, status: 'pending', score: null


    };


  }





  state.tracker.bets.unshift(bet);


  saveState();


  closeModal('trackerModal');


  renderTracker(); updateTrackerStats();


}





function setTrackerFilter(f) {


  trackerFilter = f;


  document.querySelectorAll('.tracker-filter').forEach(b => b.classList.remove('active'));


  document.getElementById('tf-' + f)?.classList.add('active');


  renderTracker();


}





function cycleTrackerStatus(id) {


  const b = state.tracker.bets.find(x => x.id === id);


  if (!b) return;


  b.status = b.status === 'pending' ? 'win' : b.status === 'win' ? 'lose' : 'pending';


  saveState(); renderTracker(); updateTrackerStats();


}





function deleteTrackerBet(id) {


  if (!confirm('Verwijderen?')) return;


  state.tracker.bets = state.tracker.bets.filter(b => b.id !== id);


  saveState(); renderTracker(); updateTrackerStats();


}





const sourceLabel = { analyse:'🤖 Analyse', combi:'⚡ Combi', value:'⚡ Value', eigen:'✏️ Eigen' };


const sourceClass = { analyse:'src-analyse', combi:'src-combi', value:'src-value', eigen:'src-eigen' };





function renderTracker() {


  const list = document.getElementById('trackerList');


  let bets = state.tracker.bets || [];


  if (trackerFilter === 'open')    bets = bets.filter(b => b.status === 'pending');


  else if (trackerFilter === 'win')  bets = bets.filter(b => b.status === 'win');


  else if (trackerFilter === 'lose') bets = bets.filter(b => b.status === 'lose');


  else if (trackerFilter === 'analyse' || trackerFilter === 'combi' || trackerFilter === 'value' || trackerFilter === 'eigen')


    bets = bets.filter(b => (b.source || 'eigen') === trackerFilter);


  // 'all' = geen filter


  if (!bets.length) { list.innerHTML = '<div class="empty-state">Geen weddenschappen</div>'; return; }


  list.innerHTML = bets.map(b => {


    const scoreBadge = b.score ? ` [${b.score}]` : '';


    const statusTxt = b.status === 'win' ? `✓ +€${(b.payout-b.stake).toFixed(2)}${scoreBadge}` : b.status === 'lose' ? `✗ -€${b.stake.toFixed(2)}${scoreBadge}` : '⏳ OPEN';


    const border = b.status === 'win' ? 'border-left:3px solid #16a34a;' : b.status === 'lose' ? 'border-left:3px solid #dc2626;' : '';


    const combiLegsHtml = b.type === 'combi' && b.legs ? b.legs.map(l => `


      <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);


        padding:.25rem .4rem;background:rgba(15,23,42,.04);border-radius:6px;margin-bottom:.2rem;">


        <span style="color:var(--ink);font-weight:700;">${l.match}</span>


        · ${l.pick} · <span style="color:#be185d;">@ ${l.odds}</span>


      </div>`).join('') : '';


    return `<div class="tracker-row" style="${border}">


      <div style="display:flex;justify-content:space-between;align-items:flex-start;">


        <div class="tracker-match">${b.match}${b.score ? '<span class="tr-score-badge">' + b.score + '</span>' : ''}${b.type==='combi'?'<span style="font-family:monospace;font-size:.48rem;font-weight:800;color:#be185d;margin-left:4px;">COMBI</span>':''}</div>


        <button onclick="deleteTrackerBet(${b.id})" style="background:none;border:none;color:#94a3b8;font-size:.9rem;cursor:pointer;">✕</button>


      </div>


      ${combiLegsHtml}


      <div class="tracker-meta">


        <span>📅 ${b.date}</span>


        ${b.bookmaker ? `<span>🏦 ${b.bookmaker}</span>` : ''}


        <span class="tracker-source ${sourceClass[b.source]||'src-eigen'}">${sourceLabel[b.source]||b.source}</span>


      </div>


      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;flex-wrap:wrap;">


        <span style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:700;background:rgba(15,23,42,.06);padding:2px 8px;border-radius:4px;">${b.pick}</span>


        <span style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:#475569;">${b.markt}</span>


        <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#16a34a;">${b.odds}</span>


      </div>


      ${b.note ? `<div style="font-size:.72rem;color:#64748b;font-style:italic;margin-bottom:.4rem;">"${b.note}"</div>` : ''}


      <div class="tracker-footer">


        <div style="display:flex;align-items:center;gap:.4rem;">


          <span style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:#475569;">€${b.stake.toFixed(2)} → €${b.payout.toFixed(2)}</span>


          ${b.status === 'pending' && b.fixtureId ? `<button onclick="event.stopPropagation();checkTrackerBetResult(${b.id})" style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);color:#2563eb;border-radius:6px;padding:1px 5px;cursor:pointer;">🔍</button>` : ''}


        </div>


        <span class="tracker-result ${b.status}" onclick="cycleTrackerStatus(${b.id})">${statusTxt}</span>


      </div></div></div>`;


  }).join('');


}





function updateTrackerStats() {


  const bets = state.tracker.bets || [];


  const staked = bets.reduce((s,b) => s + (b.stake||0), 0);


  const won = bets.filter(b => b.status === 'win').reduce((s,b) => s + (b.payout - b.stake), 0);


  const lost = bets.filter(b => b.status === 'lose').reduce((s,b) => s + b.stake, 0);


  const pnl = won - lost;


  const roi = staked > 0 ? ((pnl/staked)*100).toFixed(1) : '—';


  const set = (id,v) => { const e = document.getElementById(id); if (e) e.textContent = v; };


  set('trStaked', `€${staked.toFixed(0)}`);


  set('trPnl', `${pnl>=0?'+':''}€${pnl.toFixed(2)}`);


  set('trBets', bets.length);


  set('trRoi', roi !== '—' ? roi + '%' : '—');


  const el = document.getElementById('trPnl');


  if (el) el.style.color = pnl >= 0 ? '#16a34a' : '#dc2626';


  renderSmartStats();


}





// ═══════════════════════════════════════════════════════


// ⚡ VALUE BACKTEST — render, stats, check, grafiek


// ═══════════════════════════════════════════════════════





// ═══════════════════════════════════════════════════════


// BACKTEST COMPETITIE BREAKDOWN + FILTER


// ═══════════════════════════════════════════════════════





// ═══════════════════════════════════════════════════════


// BACKTEST SUB-TABS


// ═══════════════════════════════════════════════════════


let btSubTab = 'picks';





function setBtSubTab(tab) {


  btSubTab = tab;


  document.querySelectorAll('.bt-subtab').forEach(b => b.classList.remove('active'));


  const el = document.getElementById('bts-' + tab);


  if (el) el.classList.add('active');


  renderBacktest();


}





function renderBtScoreboard(picks) {


  const el = document.getElementById('btCompBreakdown');


  if (!el) return;





  const settled = picks.filter(p => p.status === 'win' || p.status === 'lose');


  if (!settled.length) {


    el.style.display = 'block';


    el.innerHTML = '<div class="bt-empty" style="padding:.8rem 0;">Nog geen afgeronde picks om per competitie te tonen.</div>';


    return;


  }





  // Group by comp


  const compMap = {};


  for (const p of settled) {


    const key = p.comp || 'Overig';


    if (!compMap[key]) compMap[key] = { wins:0, total:0, name:key };


    compMap[key].total++;


    if (p.status === 'win') compMap[key].wins++;


  }





  // Also include pending counts


  for (const p of picks) {


    if (p.status !== 'win' && p.status !== 'lose') {


      const key = p.comp || 'Overig';


      if (!compMap[key]) compMap[key] = { wins:0, total:0, name:key, pending:0 };


      if (!compMap[key].pending) compMap[key].pending = 0;


      compMap[key].pending++;


    }


  }





  const sorted = Object.values(compMap).sort((a,b) => b.total - a.total);





  const compNames = {


    eredivisie:'🇳🇱 Eredivisie', kkd:'🇳🇱 Keuken Kampioen',


    premier:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', bundesliga:'🇩🇪 Bundesliga',


    ligue1:'🇫🇷 Ligue 1', seriea:'🇮🇹 Serie A',


    champions:'⭐ Champions League', nations:'🌍 Nations League',


    beker:'🏆 KNVB Beker', wk2026:'🏆 WK 2026',


    jupiler:'🇧🇪 Jupiler Pro', laliga:'🇪🇸 La Liga',


    superlig:'🇹🇷 Süper Lig'


  };





  const rows = sorted.map(d => {


    const pct = d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0;


    const cls = pct >= 55 ? 'pos' : pct < 40 ? 'neg' : 'neu';


    const barColor = pct >= 55 ? '#16a34a' : pct < 40 ? '#dc2626' : '#d97706';


    const label = compNames[d.name] || d.name;


    const pendingTxt = d.pending ? ` · ${d.pending} open` : '';


    return `<div class="bt-score-row">


      <div class="bt-score-comp">${label}</div>


      <div class="bt-score-fraction ${cls}">${d.wins}/${d.total}</div>


      <div class="bt-score-bar-wrap">


        <div class="bt-score-bar" style="width:${pct}%;background:${barColor};"></div>


      </div>


      <div class="bt-score-pct" style="color:${barColor};">${pct}%${pendingTxt}</div>


    </div>`;


  }).join('');





  el.style.display = 'block';


  el.innerHTML = `


    <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:var(--sub);


      margin-bottom:.5rem;">Wins / afgeronde picks · hitrate%</div>


    <div class="bt-scoreboard">${rows}</div>


  `;


}





let btFilter = 'all';





function setBtFilter(f) {


  btFilter = f;


  document.querySelectorAll('.bt-filter-btn').forEach(b => b.classList.remove('active'));


  const el = document.getElementById('btf-' + f);


  if (el) el.classList.add('active');


  renderBacktest();


}





function renderBtCompBreakdown(picks) {


  const el = document.getElementById('btCompBreakdown');


  if (!el) return;


  const settled = picks.filter(p => p.status === 'win' || p.status === 'lose');


  if (settled.length < 2) { el.style.display = 'none'; return; }





  // Group by competition


  const compMap = {};


  for (const p of settled) {


    const key = p.comp || p.league || 'Overig';


    if (!compMap[key]) compMap[key] = { wins: 0, losses: 0, profit: 0, picks: 0 };


    compMap[key].picks++;


    if (p.status === 'win') { compMap[key].wins++; compMap[key].profit += (p.odds - 1); }


    else { compMap[key].losses++; compMap[key].profit -= 1; }


  }





  // Sort by number of picks desc


  const sorted = Object.entries(compMap).sort((a,b) => b[1].picks - a[1].picks);


  if (sorted.length < 2) { el.style.display = 'none'; return; }





  const cards = sorted.map(([comp, d]) => {


    const roi = ((d.profit / d.picks) * 100).toFixed(1);


    const roiClass = parseFloat(roi) > 0 ? 'pos' : parseFloat(roi) < 0 ? 'neg' : 'neu';


    const cardClass = parseFloat(roi) > 0 ? 'bt-comp-win' : parseFloat(roi) < 0 ? 'bt-comp-lose' : 'bt-comp-neu';


    const hitrate = Math.round((d.wins / d.picks) * 100);


    return `<div class="bt-comp-card ${cardClass}">


      <div class="bt-comp-name">${comp}</div>


      <div class="bt-comp-roi ${roiClass}">${parseFloat(roi) >= 0 ? '+' : ''}${roi}%</div>


      <div class="bt-comp-detail">${d.wins}W · ${d.losses}V · ${hitrate}% hit · ${d.picks} picks</div>


    </div>`;


  }).join('');





  el.style.display = 'block';


  el.innerHTML = `


    <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:800;


      color:var(--sub);letter-spacing:.1em;margin-bottom:.4rem;">


      📊 ROI PER COMPETITIE


    </div>


    <div class="bt-comp-grid">${cards}</div>


  `;


}


function renderBacktest() {


  if (!state.valueBacktest) state.valueBacktest = { picks: [] };


  const allPicks = state.valueBacktest.picks || [];


  const list = document.getElementById('btList');


  if (!list) return;





  updateBacktestStats();


  renderTripleLockHitrate();





  // Sub-tab: competitie scorebord


  if (btSubTab === 'comps') {


    renderBtScoreboard(allPicks);


    const filterRow = document.getElementById('btFilterRow');


    if (filterRow) filterRow.style.display = 'none';


    list.style.display = 'none';


    const chartWrap = document.getElementById('btChartWrap');


    if (chartWrap) chartWrap.style.display = 'none';


    return;


  }





  // Sub-tab: picks


  list.style.display = 'block';


  const breakdown = document.getElementById('btCompBreakdown');


  if (breakdown) breakdown.style.display = 'none';


  renderBtCompBreakdown(allPicks); // still update internally





  // Show filter row if there are picks


  const filterRow = document.getElementById('btFilterRow');


  if (filterRow) filterRow.style.display = allPicks.length > 1 ? 'flex' : 'none';





  // Apply filter


  let picks = allPicks;


  if (btFilter === 'win')     picks = allPicks.filter(p => p.status === 'win');


  else if (btFilter === 'lose')    picks = allPicks.filter(p => p.status === 'lose');


  else if (btFilter === 'pending') picks = allPicks.filter(p => !p.status || p.status === 'pending');





  if (!picks.length) {


    list.innerHTML = allPicks.length


      ? '<div class="bt-empty">Geen picks voor dit filter</div>'


      : `<div class="bt-empty">Nog geen value-picks bijgehouden.<br>Draai een ⚡ Value Scan — picks met ≥5% value worden automatisch hier opgeslagen.</div>`;


    return;


  }





  list.innerHTML = picks.map(p => {


    const statusTxt = p.status === 'win'


      ? `✓ WIN (+€${((p.odds - 1) * 1).toFixed(2)} per €1)`


      : p.status === 'lose' ? '✗ VERLIES' : '⏳ OPEN';


    const confColor = p.confidence >= 7 ? '#15803d' : p.confidence >= 5 ? '#b45309' : '#dc2626';


    const valColor = p.value >= 15 ? '#15803d' : p.value >= 5 ? '#b45309' : '#64748b';





    return `


    <div class="bt-row bt-${p.status||'pending'}">


      <div class="bt-match">${p.matchName}</div>


      <div class="bt-meta">


        <span>📅 ${p.date}</span>


        <span style="font-weight:700;color:${valColor}">⚡ +${p.value}%</span>


        <span>🎯 ${p.pickLabel} @ ${p.odds}</span>


        <span style="color:${confColor}">🎲 ${p.confidence}/10</span>


        <span style="color:var(--sub);">📊 ${p.bookmaker||'?'}</span>


      </div>


      <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);


        margin-bottom:.35rem;line-height:1.5;">


        AI ${p.aiKans}% kans · ½ Kelly ${p.kelly}% · ${p.reason||''}


        ${p.score ? `<b style="color:var(--ink);"> [${p.score}]</b>` : ''}


      </div>


      <div class="bt-footer">


        <div style="display:flex;gap:.4rem;align-items:center;">


          ${p.status === 'pending' ? `


            <button onclick="checkBacktestPick('${p.id}')" style="font-family:'IBM Plex Mono',monospace;


              font-size:.48rem;font-weight:700;background:rgba(37,99,235,.1);


              border:1px solid rgba(37,99,235,.3);color:#2563eb;border-radius:6px;


              padding:2px 7px;cursor:pointer;">🔍 CHECK</button>` : ''}


          <button onclick="deleteBacktestPick('${p.id}')" style="background:none;border:none;


            color:#94a3b8;font-size:.8rem;cursor:pointer;padding:0;">✕</button>


        </div>


        <div class="bt-result ${p.status||'pending'}" onclick="cycleBacktestStatus('${p.id}')">${statusTxt}</div>


      </div>


    </div>`;


  }).join('');


}





function updateBacktestStats() {


  if (!state.valueBacktest) return;


  const picks = state.valueBacktest.picks || [];


  const settled = picks.filter(p => p.status === 'win' || p.status === 'lose');


  const wins = picks.filter(p => p.status === 'win').length;


  const hitrate = settled.length > 0 ? Math.round(wins / settled.length * 100) + '%' : '—';





  // ROI berekend op flat €1 inzet per pick (eerlijkste maatstaf)


  let profit = 0;


  settled.forEach(p => {


    if (p.status === 'win') profit += (p.odds - 1);


    else profit -= 1;


  });


  const roi = settled.length > 0 ? ((profit / settled.length) * 100).toFixed(1) + '%' : '—';





  const avgVal = picks.length > 0


    ? (picks.reduce((s,p) => s + (p.value||0), 0) / picks.length).toFixed(1) + '%'


    : '—';





  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };


  set('btTotal', picks.length);


  set('btHitrate', hitrate);


  set('btRoi', roi !== '—' ? (parseFloat(roi) >= 0 ? '+' : '') + roi : '—');


  set('btAvgVal', avgVal !== '—' ? '+' + avgVal : '—');





  const roiEl = document.getElementById('btRoi');


  if (roiEl && roi !== '—') roiEl.style.color = parseFloat(roi) >= 0 ? '#15803d' : '#dc2626';





  // Toon/verberg grafiek


  renderBacktestChart(settled);


}





function renderBacktestChart(settled) {

  const wrap = document.getElementById('btChartWrap');
  const canvas = document.getElementById('btChart');
  if (!wrap || !canvas) return;
  if (settled.length < 2) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 32;
  const H = 160;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // Cumulatief resultaat per pick (flat €1 inzet)
  const points = [0];
  settled.forEach(p => {
    const last = points[points.length - 1];
    points.push(last + (p.status === 'win' ? (p.odds - 1) : -1));
  });

  // Moving average (window 5)
  const MA_WINDOW = 5;
  const maPoints = points.map((_, i) => {
    if (i < MA_WINDOW) return null;
    const slice = points.slice(i - MA_WINDOW, i);
    return slice.reduce((a, b) => a + b, 0) / MA_WINDOW;
  });

  const allVals = [...points, ...maPoints.filter(v => v !== null)];
  const minV = Math.min(...allVals, -0.5);
  const maxV = Math.max(...allVals, 0.5);
  const range = maxV - minV || 1;
  const pad = { top: 18, bottom: 20, left: 44, right: 8 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const xP = i => pad.left + (i / Math.max(points.length - 1, 1)) * cw;
  const yP = v => pad.top + ch - ((v - minV) / range) * ch;

  // ── Rasterlijnen ──
  ctx.strokeStyle = 'rgba(148,163,184,.15)';
  ctx.lineWidth = 1;
  const gridVals = [minV, 0, maxV];
  gridVals.forEach(v => {
    const y = yP(v);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
  });

  // ── Break-even lijn ──
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(148,163,184,.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, yP(0)); ctx.lineTo(pad.left + cw, yP(0)); ctx.stroke();
  ctx.setLineDash([]);

  // ── Gradient fill onder/boven break-even ──
  const lastVal = points[points.length - 1];
  const isPos = lastVal >= 0;
  const lineColor = isPos ? '#16a34a' : '#dc2626';
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, isPos ? 'rgba(22,163,74,.18)' : 'rgba(220,38,38,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(xP(0), yP(points[0]));
  points.forEach((v, i) => { if (i > 0) ctx.lineTo(xP(i), yP(v)); });
  ctx.lineTo(xP(points.length - 1), yP(0));
  ctx.lineTo(xP(0), yP(0));
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  // ── Hoofdlijn (cumulatief) ──
  ctx.beginPath();
  ctx.moveTo(xP(0), yP(points[0]));
  points.forEach((v, i) => { if (i > 0) ctx.lineTo(xP(i), yP(v)); });
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  // ── Moving average lijn ──
  if (settled.length >= MA_WINDOW + 1) {
    ctx.beginPath();
    let started = false;
    maPoints.forEach((v, i) => {
      if (v === null) return;
      if (!started) { ctx.moveTo(xP(i), yP(v)); started = true; }
      else ctx.lineTo(xP(i), yP(v));
    });
    ctx.strokeStyle = 'rgba(139,92,246,.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Win/verlies punten ──
  settled.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(xP(i + 1), yP(points[i + 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = p.status === 'win' ? '#16a34a' : '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  });

  // ── ROI label huidig ──
  const roiNow = settled.length > 0 ? ((lastVal / settled.length) * 100).toFixed(1) : '0';
  ctx.fillStyle = isPos ? '#16a34a' : '#dc2626';
  ctx.font = 'bold 10px IBM Plex Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ROI ' + (lastVal >= 0 ? '+' : '') + roiNow + '%', pad.left + 4, pad.top + 11);

  // ── MA legenda ──
  if (settled.length >= MA_WINDOW + 1) {
    ctx.fillStyle = 'rgba(139,92,246,.8)';
    ctx.font = '9px IBM Plex Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MA5', pad.left + 4, pad.top + 22);
  }

  // ── Y-as labels ──
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.textAlign = 'right';
  [minV, 0, maxV].forEach(v => {
    ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(1), pad.left - 4, yP(v) + 3);
  });

  // ── X-as: begin/midden/eind ──
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.textAlign = 'center';
  const labelIdxs = [0, Math.floor(settled.length / 2), settled.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  labelIdxs.forEach(i => {
    const p = settled[i];
    if (p?.date) ctx.fillText(p.date.slice(5), xP(i + 1), H - pad.bottom + 12);
  });

}


function cycleBacktestStatus(pickId) {


  if (!state.valueBacktest) return;


  const p = state.valueBacktest.picks.find(x => String(x.id) === String(pickId));


  if (!p) return;


  p.status = p.status === 'pending' ? 'win' : p.status === 'win' ? 'lose' : 'pending';


  if (p.status === 'pending') p.score = null;


  saveState();


  renderBacktest();


}





function deleteBacktestPick(pickId) {


  if (!state.valueBacktest) return;


  state.valueBacktest.picks = state.valueBacktest.picks.filter(p => String(p.id) !== String(pickId));


  saveState();


  renderBacktest();


}





function clearBacktest() {


  if (!confirm('Alle backtest picks verwijderen?')) return;


  state.valueBacktest = { picks: [] };


  saveState();


  renderBacktest();


}





// ═══════════════════════════════════════════════════════


// SETTINGS + FIREBASE + BACKUP


// ═══════════════════════════════════════════════════════


function saveApiKey() {


  const key = document.getElementById('apiKeyInput').value.trim();


  if (key.startsWith('sk-ant')) {


    state.settings.anthropicKey = key;


    saveState();


    document.getElementById('apiStatus').textContent = '✓ Opgeslagen';


    document.getElementById('apiStatus').className = 'api-status ok';


  } else {


    document.getElementById('apiStatus').textContent = '⚠ Moet beginnen met sk-ant-';


    document.getElementById('apiStatus').className = 'api-status err';


  }


}





function saveSettings() {


  state.settings.anthropicKey = document.getElementById('settAnthropicKey').value.trim();


  state.settings.footballKey = document.getElementById('settFootballKey').value.trim();


  state.settings.fdKey = document.getElementById('settFdKey').value.trim();


  if (state.settings.anthropicKey) localStorage.setItem('totoai_key_anthropic', state.settings.anthropicKey);


  if (state.settings.footballKey)  localStorage.setItem('totoai_key_football',  state.settings.footballKey);


  state.settings.defaultComp = document.getElementById('settDefaultComp').value;


  state.settings.startBalance = parseInt(document.getElementById('settStartBalance').value) || 500;


  state.settings.defaultBet = parseInt(document.getElementById('settDefaultBet').value) || 10;


  state.settings.defaultBookmaker = document.getElementById('settDefaultBookmaker')?.value || 'Jacks';


  state.settings.notifThreshold = parseInt(document.getElementById('notifThreshold')?.value) || 20;


  state.settings.tripleMinOdds = parseFloat(document.getElementById('tripleMinOdds')?.value) || 1.6;


  state.settings.vapidPublicKey = document.getElementById('vapidPublicKey')?.value?.trim() || '';


  state.settings.tripleMinValue = parseFloat(document.getElementById('tripleMinValue')?.value) || 8;


  state.settings.tripleMinConf  = parseInt(document.getElementById('tripleMinConf')?.value)  || 7;


  saveState();


  updateNotifUI();


  showFirebaseStatus('✅ Opgeslagen!', '#16a34a');


  const btn = document.querySelector('.save-settings-btn');


  if (btn) {


    const orig = btn.textContent;


    btn.textContent = '✅ OPGESLAGEN!';


    btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';


    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);


  }


  saveToFirebase().then(() => showFirebaseStatus('🔥 Gesynchroniseerd','#16a34a')).catch(() => {});


}





function applySettings() {


  document.getElementById('apiKeyInput').value = state.settings.anthropicKey || '';


  document.getElementById('settAnthropicKey').value = state.settings.anthropicKey || '';


  document.getElementById('settFootballKey').value = state.settings.footballKey || '';


  document.getElementById('settFdKey').value = state.settings.fdKey || '';


  document.getElementById('settDefaultComp').value = state.settings.defaultComp || 'eredivisie';


  document.getElementById('settStartBalance').value = state.settings.startBalance || 500;


  document.getElementById('settDefaultBet').value = state.settings.defaultBet || 10;


  document.getElementById('betAmount').value = state.settings.defaultBet || 10;


  const bm = document.getElementById('settDefaultBookmaker');


  if (bm) bm.value = state.settings.defaultBookmaker || 'Jacks';


  const bal = document.getElementById('currentBalanceDisplay');


  if (bal) bal.textContent = '€' + (state.wallet.balance||0).toFixed(2).replace('.',',');


  const nt = document.getElementById('notifThreshold');


  if (nt) nt.value = state.settings.notifThreshold || 20;


  const tmo = document.getElementById('tripleMinOdds');


  const vpk = document.getElementById('vapidPublicKey');


  if (vpk) vpk.value = state.settings.vapidPublicKey || '';


  if (tmo) tmo.value = state.settings.tripleMinOdds || 1.6;


  const tmv = document.getElementById('tripleMinValue');


  if (tmv) tmv.value = state.settings.tripleMinValue || 8;


  const tmc = document.getElementById('tripleMinConf');


  if (tmc) tmc.value = state.settings.tripleMinConf || 7;


  if (state.settings.anthropicKey) {


    document.getElementById('apiStatus').textContent = '✓ Key geladen';


    document.getElementById('apiStatus').className = 'api-status ok';


  }


  // Toon API keys status in instellingen


  const statusEl = document.getElementById('apiKeysStatus');


  if (statusEl) {


    const hasF = true; // footballKey op server


    const hasA = !!state.settings.anthropicKey;


    if (hasF && hasA) {


      statusEl.innerHTML = '✅ Alle keys ingesteld — je kunt de app volledig gebruiken';


      statusEl.style.color = '#16a34a';


    } else if (!hasF && !hasA) {


      statusEl.innerHTML = '⚠️ Nog geen keys ingesteld — vul hierboven je keys in om te beginnen';


      statusEl.style.color = '#d97706';


    } else {


      statusEl.innerHTML = (hasF ? '✅ API-Football' : '❌ API-Football') + ' · ' + (hasA ? '✅ Anthropic' : '❌ Anthropic');


      statusEl.style.color = '#475569';


    }


  }


}





const FB_DB = 'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app';


const FB_KEY = 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M';





function showFirebaseStatus(msg, color) {


  const el = document.getElementById('firebaseStatus');


  if (!el) return;


  el.style.display = 'block';


  el.style.color = color || 'var(--muted)';


  el.textContent = msg;


  setTimeout(() => el.style.display = 'none', 4000);


}





async function saveToFirebase() {


  const payload = {


    anthropicKey: state.settings.anthropicKey || '',


    footballKey: state.settings.footballKey || '',


    fdKey: state.settings.fdKey || '',


    defaultComp: state.settings.defaultComp || 'eredivisie',


    defaultBet: state.settings.defaultBet || 10,


    startBalance: state.settings.startBalance || 500,


    notifEnabled: state.settings.notifEnabled || false,


    notifThreshold: state.settings.notifThreshold || 20,


    tripleMinOdds: state.settings.tripleMinOdds || 1.6,


    autoDark: state.settings.autoDark || false,


    updatedAt: new Date().toISOString()


  };


  const resp = await fetch(`${FB_DB}/settings.json?auth=${FB_KEY}`, {


    method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)


  });


  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);





  // Altijd wallet + tracker opslaan, ook als er al data is


  const backupPayload = {


    wallet: state.wallet,


    tracker: state.tracker,


    valueBacktest: state.valueBacktest,


    version: '3.5',


    backupDate: new Date().toISOString(),


    walletBetCount: state.wallet.bets.length,


    trackerBetCount: state.tracker.bets.length


  };


  const bresp = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`, {


    method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(backupPayload)


  });


  if (!bresp.ok) throw new Error(`Backup HTTP ${bresp.status}`);


  return resp.json();


}








async function restoreFromFirebase() {


  if (!confirm('Wallet + Tracker herstellen vanuit de cloud?\nLokale data wordt overschreven als de cloud meer bets heeft.')) return;


  showFirebaseStatus('🔄 Ophalen...', '#2563eb');


  try {


    const br = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`);


    if (!br.ok) throw new Error('Geen backup gevonden');


    const b = await br.json();


    if (!b) throw new Error('Backup leeg');


    const fbWallet  = b.wallet?.bets?.length  || 0;


    const fbTracker = b.tracker?.bets?.length || 0;


    const fbBacktest = b.valueBacktest?.picks?.length || 0;


    if (fbWallet === 0 && fbTracker === 0 && fbBacktest === 0) {


      showFirebaseStatus('⚠ Cloud backup is leeg', '#f59e0b'); return;


    }


    if (b.wallet)  state.wallet  = b.wallet;


    if (b.tracker) state.tracker = b.tracker;


    if (b.valueBacktest) state.valueBacktest = b.valueBacktest;


    saveState();


    updateWalletUI();


    renderTracker();


    updateTrackerStats();


    showFirebaseStatus('✅ Hersteld: ' + fbWallet + ' wallet bets, ' + fbTracker + ' tracker bets', '#16a34a');


    loadFbBackupInfo();


  } catch(e) {


    showFirebaseStatus('⚠ ' + e.message, '#e74c3c');


  }


}





async function loadFbBackupInfo() {


  // Show auto-sync indicator if Firebase is configured


  const autoEl = document.getElementById('fbAutoSyncStatus');


  if (autoEl) autoEl.style.display = (FB_KEY && FB_KEY !== 'YOUR_FIREBASE_KEY') ? 'block' : 'none';


  const el = document.getElementById('fbBackupInfo');


  if (!el) return;


  try {


    const br = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`);


    if (!br.ok) { el.textContent = 'Nog geen cloud backup'; return; }


    const b = await br.json();


    if (!b) { el.textContent = 'Nog geen cloud backup'; return; }


    const date = b.backupDate ? new Date(b.backupDate).toLocaleString('nl-NL') : '?';


    const wc   = b.walletBetCount  ?? b.wallet?.bets?.length  ?? '?';


    const tc   = b.trackerBetCount ?? b.tracker?.bets?.length ?? '?';


    el.textContent = '☁️ Laatste backup: ' + date + ' · ' + wc + ' wallet · ' + tc + ' tracker';


  } catch(e) { el.textContent = 'Cloud info niet beschikbaar'; }


}


async function loadFromFirebase() {


  try {


    const resp = await fetch(`${FB_DB}/settings.json?auth=${FB_KEY}`);


    if (!resp.ok) return false;


    const d = await resp.json();


    if (!d) return false;


    if (d.anthropicKey) state.settings.anthropicKey = d.anthropicKey;


    if (d.footballKey) state.settings.footballKey = d.footballKey;


    if (d.fdKey) state.settings.fdKey = d.fdKey;


    if (d.defaultComp) state.settings.defaultComp = d.defaultComp;


    if (d.defaultBet) state.settings.defaultBet = d.defaultBet;


    if (d.startBalance) state.settings.startBalance = d.startBalance;


    if (d.notifEnabled !== undefined) state.settings.notifEnabled = d.notifEnabled;


    if (d.notifThreshold) state.settings.notifThreshold = d.notifThreshold;


    if (d.tripleMinOdds) state.settings.tripleMinOdds = d.tripleMinOdds;


    if (d.autoDark !== undefined) state.settings.autoDark = d.autoDark;


    if (d._preAutoDarkTheme) state.settings._preAutoDarkTheme = d._preAutoDarkTheme;


    try {


      const br = await fetch(`${FB_DB}/backup.json?auth=${FB_KEY}`);


      if (br.ok) {


        const b = await br.json();


        if (b?.wallet) {


          const localCount = state.wallet.bets.length;


          const fbCount = b.wallet.bets?.length || 0;


          if (fbCount > localCount || (fbCount > 0 && localCount === 0)) {


            state.wallet = b.wallet;


            showFirebaseStatus('☁️ Wallet gesynchroniseerd (' + fbCount + ' bets)', '#16a34a');


          }


        }


        if (b?.tracker) {


          const localT = state.tracker?.bets?.length || 0;


          const fbT = b.tracker.bets?.length || 0;


          if (fbT > localT) state.tracker = b.tracker;


        }


        if (b?.valueBacktest) {


          const localBt = state.valueBacktest?.picks?.length || 0;


          const fbBt = b.valueBacktest.picks?.length || 0;


          // Laad Firebase als: Firebase meer picks heeft, OF lokaal leeg is maar Firebase niet


          if (fbBt > localBt || (localBt === 0 && fbBt > 0)) {


            state.valueBacktest = b.valueBacktest;


            // UI direct verversen als backtest-tab zichtbaar is


            try { renderBacktest(); } catch(e) {}


          }


        }


      }


    } catch(e) {}


    saveState();


    applySettings();


    showFirebaseStatus('🔥 Keys geladen','#2ecc71');


    return true;


  } catch(e) { return false; }


}








// ═══════════════════════════════════════════════════════


// AUTO-CHECK: elke 15 min tussen 15:00 en 23:00


// ═══════════════════════════════════════════════════════


function startAutoCheckScheduler() {


  if (autoCheckInterval) clearInterval(autoCheckInterval);


  autoCheckInterval = setInterval(async () => {


    const now = new Date();


    const h = now.getHours();


    if (h < 13 || h >= 23) return; // alleen 13:00-23:00


    const open = (state.wallet.bets || []).filter(b => b.status === 'pending');


    if (!open.length) return;


    // Key zit op server via worker — geen lokale key nodig


    showAutoCheckBar('?? Auto-check bets...');


    let upd = 0;


    for (const bet of open) {


      try {


        const prev = bet.status;


        await checkBetResult(bet.id);


        if (bet.status !== prev) upd++;


      } catch(e) {}


    }


    if (upd > 0) {


      showAutoCheckBar(`✅ ${upd} bet${upd>1?'s':''} bijgewerkt!`, 4000);


    } else {


      showAutoCheckBar('✓ Geen updates', 2000);


    }


  }, 60 * 60 * 1000); // 60 minuten


}





function showAutoCheckBar(msg, duration=3000) {


  const el = document.getElementById('autoCheckBar');


  if (!el) return;


  el.textContent = msg;


  el.style.display = 'block';


  el.style.opacity = '1';


  clearTimeout(el._hideTimer);


  el._hideTimer = setTimeout(() => {


    el.style.opacity = '0';


    setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 350);


  }, duration);


}





// ═══════════════════════════════════════════════════════


// STREAK TRACKER + ROI PER COMPETITIE


// ═══════════════════════════════════════════════════════


function calcStreakAndRoi() {


  const bets = [...(state.tracker.bets || [])].reverse(); // oudste eerst


  const settled = bets.filter(b => b.status === 'win' || b.status === 'lose');





  // Huidige streak (meest recente bets)


  let streak = 0, streakType = 'neu';


  const recent = [...settled].reverse();


  if (recent.length) {


    streakType = recent[0].status;


    for (const b of recent) {


      if (b.status === streakType) streak++;


      else break;


    }


  }





  // ROI per competitie (via bookmaker als proxy, of markt)


  // We groeperen op b.markt als competitie-proxy


  const compMap = {};


  for (const b of settled) {


    const key = b.markt || 'Anders';


    if (!compMap[key]) compMap[key] = { staked:0, pnl:0, wins:0, losses:0 };


    compMap[key].staked += b.stake || 0;


    if (b.status === 'win') {


      compMap[key].pnl += (b.payout - b.stake);


      compMap[key].wins++;


    } else {


      compMap[key].pnl -= b.stake;


      compMap[key].losses++;


    }


  }





  // Per source ROI (analyse / combi / eigen / widget)


  const srcMap = {};


  for (const b of settled) {


    const key = b.source || 'eigen';


    if (!srcMap[key]) srcMap[key] = { staked:0, pnl:0, wins:0, count:0, streak:0, streakType:'neu' };


    srcMap[key].staked += b.stake || 0;


    srcMap[key].count++;


    if (b.status === 'win') {


      srcMap[key].pnl += (b.payout - b.stake);


      srcMap[key].wins++;


    } else {


      srcMap[key].pnl -= b.stake;


    }


  }


  // Streak per source


  for (const key of Object.keys(srcMap)) {


    const srcBets = [...settled].reverse().filter(b => (b.source||'eigen') === key);


    let s = 0, st = 'neu';


    if (srcBets.length) {


      st = srcBets[0].status;


      for (const b of srcBets) { if (b.status === st) s++; else break; }


    }


    srcMap[key].streak = s;


    srcMap[key].streakType = st;


  }





  return { streak, streakType, compMap, srcMap, totalSettled: settled.length };


}





function renderSmartStats() {


  const el = document.getElementById('trackerSmartStats');


  if (!el) return;


  const bets = state.tracker.bets || [];


  const settled = bets.filter(b => b.status !== 'pending');


  if (settled.length < 2) { el.style.display = 'none'; return; }


  el.style.display = 'block';





  const { streak, streakType, srcMap, totalSettled } = calcStreakAndRoi();





  const streakEmoji = streakType === 'win' ? '🔥' : streakType === 'lose' ? '❄️' : '➖';


  const streakClass = streakType === 'win' ? 'hot' : streakType === 'lose' ? 'cold' : 'neu';


  const streakLabel = streakType === 'win' ? `${streak}x WIN op rij` : streakType === 'lose' ? `${streak}x VERLIES op rij` : 'Geen streak';





  const srcLabels = { analyse:'🤖 Analyse', combi:'⚡ Combi AI', value:'⚡ Value', eigen:'✏️ Eigen' };





  const srcCards = Object.entries(srcMap).map(([key, d]) => {


    const roi = d.staked > 0 ? ((d.pnl/d.staked)*100).toFixed(1) : null;


    const roiClass = roi === null ? 'neu' : parseFloat(roi) >= 0 ? 'pos' : 'neg';


    const hitRate = d.count > 0 ? Math.round((d.wins/d.count)*100) : 0;


    const sEmoji = d.streakType === 'win' ? '🔥' : d.streakType === 'lose' ? '❄️' : '➖';


    const sClass = d.streakType === 'win' ? 'hot' : d.streakType === 'lose' ? 'cold' : 'neu';


    return `<div class="stats-comp-card">


      <div class="stats-comp-name">${srcLabels[key]||key}</div>


      <div class="stats-comp-roi ${roiClass}">${roi !== null ? (parseFloat(roi)>=0?'+':'')+roi+'%' : '—'}</div>


      <div class="stats-comp-meta">${d.wins}W · ${d.count-d.wins}L · ${hitRate}% hit</div>


      <div class="streak-badge ${sClass}">${sEmoji} ${d.streak}x ${d.streakType === 'win' ? 'WIN' : d.streakType === 'lose' ? 'VER.' : '-'}</div>


    </div>`;


  }).join('');





  el.innerHTML = `


    <div class="overall-streak">


      <div>


        <div class="overall-streak-label">Huidige streak</div>


        <div class="overall-streak-val" style="color:${streakType==='win'?'#16a34a':streakType==='lose'?'#dc2626':'var(--muted)'}">


          ${streakEmoji} ${streakLabel}


        </div>


      </div>


      <div style="text-align:right;">


        <div class="overall-streak-label">Settled</div>


        <div class="overall-streak-val" style="color:var(--muted);font-size:1.2rem;">${totalSettled}</div>


      </div>


    </div>


    ${srcCards.length ? `


    <div style="font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:700;color:var(--sub);letter-spacing:.1em;margin-bottom:.4rem;">ROI PER BRON</div>


    <div class="stats-grid">${srcCards}</div>


    ` : ''}


  `;


}








// ═══════════════════════════════════════════════════════


// SWIPE GESTURES — wallet bet rows


// ═══════════════════════════════════════════════════════


function initSwipeBets() {


  document.querySelectorAll('.swipeable').forEach(row => {


    const inner = row.querySelector('.swipe-inner');


    const winHint  = row.querySelector('.win-hint');


    const loseHint = row.querySelector('.lose-hint');


    if (!inner || row._swipeInit) return;


    row._swipeInit = true;





    let startX = 0, startY = 0, dragging = false, dx = 0;


    const THRESHOLD = 80;





    row.addEventListener('touchstart', e => {


      startX = e.touches[0].clientX;


      startY = e.touches[0].clientY;


      dragging = true; dx = 0;


      inner.style.transition = 'none';


    }, {passive:true});





    row.addEventListener('touchmove', e => {


      if (!dragging) return;


      dx = e.touches[0].clientX - startX;


      const dy = e.touches[0].clientY - startY;


      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }


      inner.style.transform = 'translateX(' + dx + 'px)';


      if (dx > 20)  { winHint.style.opacity  = Math.min(1, (dx-20)/60); loseHint.style.opacity = 0; }


      if (dx < -20) { loseHint.style.opacity = Math.min(1, (-dx-20)/60); winHint.style.opacity  = 0; }


    }, {passive:true});





    row.addEventListener('touchend', () => {


      if (!dragging) return;


      dragging = false;


      inner.style.transition = 'transform .2s';


      inner.style.transform  = 'translateX(0)';


      winHint.style.opacity  = 0;


      loseHint.style.opacity = 0;


      // Extract bet id from row id (swipe-12345)


      const betId = parseInt(row.id.replace('swipe-',''));


      if (dx > THRESHOLD) {


        const b = state.wallet.bets.find(x => x.id === betId);


        if (b && b.status === 'pending') { b.status = 'win'; state.wallet.balance += b.payout; state.wallet.totalWon += b.payout; saveState(); updateWalletUI(); }


      } else if (dx < -THRESHOLD) {


        const b = state.wallet.bets.find(x => x.id === betId);


        if (b && b.status === 'pending') { b.status = 'lose'; saveState(); updateWalletUI(); }


      }


    });


  });


}





// ═══════════════════════════════════════════════════════


// AUTO DONKER THEMA — 20:00 donker, 08:00 terug


// ═══════════════════════════════════════════════════════


function toggleAutoDark() {


  state.settings.autoDark = !state.settings.autoDark;


  updateAutoDarkUI();


  saveState();


  if (state.settings.autoDark) checkAutoDarkNow();


}





function updateAutoDarkUI() {


  const pill = document.getElementById('autoDarkPill');


  if (!pill) return;


  pill.classList.toggle('on', !!state.settings.autoDark);


}





function checkAutoDarkNow() {


  // Systeem donker thema volgen als auto-dark aan staat


  if (state.settings.autoDark) {


    const h = new Date().getHours();


    const isDark = h >= 20 || h < 8;


    const current = localStorage.getItem('totoai_theme') || 'mint';


    if (isDark && current !== 'dark') {


      state.settings._preAutoDarkTheme = current;


      localStorage.setItem('totoai_theme', 'dark');


      applyTheme();


    } else if (!isDark && current === 'dark' && state.settings._preAutoDarkTheme) {


      localStorage.setItem('totoai_theme', state.settings._preAutoDarkTheme);


      state.settings._preAutoDarkTheme = null;


      applyTheme();


    }


    return;


  }


  // Volg ook systeem prefers-color-scheme als er geen handmatig thema is


  if (!localStorage.getItem('totoai_theme')) {


    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;


    if (prefersDark) { localStorage.setItem('totoai_theme', 'dark'); applyTheme(); }


  }


}





// Luister naar systeem thema wijzigingen


if (window.matchMedia) {


  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {


    if (!localStorage.getItem('totoai_theme') || !state.settings.autoDark) {


      localStorage.setItem('totoai_theme', e.matches ? 'dark' : 'mint');


      applyTheme();


    }


  });


}





// Check elke minuut of thema moet switchen


setInterval(checkAutoDarkNow, 60 * 1000);








// ═══════════════════════════════════════════════════════


// AUTO-SYNC naar Firebase — debounced, na wallet/tracker wijziging


// ═══════════════════════════════════════════════════════


let _fbSyncTimer = null;


function scheduleFirebaseSync() {


  clearTimeout(_fbSyncTimer);


  _fbSyncTimer = setTimeout(() => {


    saveToFirebase()


      .then(() => showAutoCheckBar('☁️ Opgeslagen', 1500))


      .catch(() => {}); // stil falen


  }, 3000); // 3 sec na laatste wijziging


}





// ═══════════════════════════════════════════════════════


// WK 2026 COUNTDOWN


// ═══════════════════════════════════════════════════════


function updateWKCountdown() {


  const el = document.getElementById('wkCountdown');


  if (!el) return;


  const wkStart = new Date('2026-06-11T00:00:00');


  const now = new Date();


  const diff = wkStart - now;


  if (diff <= 0) {


    el.textContent = '🔴 WK IS BEZIG!';


    return;


  }


  const days    = Math.floor(diff / (1000*60*60*24));


  const hours   = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));


  const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));


  el.textContent = days + 'd ' + hours + 'u ' + minutes + 'm · Start 11 juni';


}


updateWKCountdown();


setInterval(updateWKCountdown, 60000);





// ═══════════════════════════════════════════════════════


// HELP MODAL TAB SWITCHING


// ═══════════════════════════════════════════════════════


function showHelpTab(tab) {


  document.querySelectorAll('.help-section').forEach(s => s.style.display = 'none');


  document.querySelectorAll('.help-tab').forEach(b => b.classList.remove('active'));


  const sec = document.getElementById('help-' + tab);


  if (sec) sec.style.display = 'block';


  // Find and activate button


  document.querySelectorAll('.help-tab').forEach(b => {


    if (b.getAttribute('onclick')?.includes("'" + tab + "'")) b.classList.add('active');


  });


}





// ═══════════════════════════════════════════════════════


// SCAN RESULTATEN PANEL


// ═══════════════════════════════════════════════════════


function renderScanResults(scans, restored = false) {


  const panel = document.getElementById('scanResultsPanel');


  const list  = document.getElementById('scanResultsList');


  const title = document.getElementById('scanResultsTitle');


  if (!panel || !list) return;





  if (!scans.length) { panel.style.display = 'none'; return; }





  // Normalize: handle both full scan objects and saved lightweight objects


  const normalized = scans.map(s => ({


    matchId:   s.matchId  || s.match?.id,


    home:      s.home     || s.match?.home || '?',


    away:      s.away     || s.match?.away || '?',


    comp:      s.comp     || s.match?.comp || '',


    pickLabel: s.pickLabel || '?',


    value:     s.value    || 0,


    confidence:s.confidence || 0,


    odds:      s.odds     || null,


    scanTime:  s.scanTime || ''


  }));





  // Filter: alleen interessante picks (value >= 5%) tonen


  // Tenzij er geen zijn — dan toon alles


  const withValue = normalized.filter(s => s.value >= 5);


  const displayList = withValue.length > 0 ? withValue : normalized;





  // Sort based on selected sort mode


  const sortFn = {


    value:  (a,b) => b.value - a.value,


    conf:   (a,b) => b.confidence - a.confidence,


    odds:   (a,b) => b.odds - a.odds,


    kelly:  (a,b) => b.kelly - a.kelly


  };


  const sorted = [...displayList].sort(sortFn[scanSort] || sortFn.value);


  const valueCount = sorted.filter(s => s.value >= 5).length;


  const timeLabel = sorted[0]?.scanTime ? ` · ${sorted[0].scanTime}` : '';


  const restoredLabel = restored ? ' (vorige scan)' : '';


  const filterLabel = withValue.length > 0


    ? `${valueCount} value picks · ${normalized.length - valueCount} gefilterd`


    : `geen value picks · alle ${normalized.length} getoond`;





  title.textContent = `⚡ SCAN RESULTATEN · ${scans.length} gescand · ${filterLabel}${timeLabel}${restoredLabel}`;





  if (sorted.length === 0) {


    list.innerHTML = `<div style="padding:1rem;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:.58rem;color:var(--sub);">


      Geen value picks gevonden in deze scan.<br>


      <span style="opacity:.6;">Alle ${normalized.length} wedstrijden hebben negatieve value.</span>


    </div>`;


    panel.style.display = 'block';


    return;


  }


  list.innerHTML = sorted.map((s, i) => {


    const val     = s.value || 0;


    const valSign = val > 0 ? '+' : '';


    const valColor  = val >= 10 ? '#15803d' : val >= 5 ? '#16a34a' : val >= 0 ? '#d97706' : '#dc2626';


    const valBg     = val >= 10 ? 'rgba(22,163,74,.12)' : val >= 5 ? 'rgba(22,163,74,.08)' : val >= 0 ? 'rgba(217,119,6,.08)' : 'rgba(220,38,38,.07)';


    const valBorder = val >= 5  ? 'rgba(22,163,74,.25)' : val >= 0 ? 'rgba(217,119,6,.2)' : 'rgba(220,38,38,.2)';


    const conf      = s.confidence || 0;


    const confColor = conf >= 8 ? '#16a34a' : conf >= 6 ? '#d97706' : '#dc2626';


    const confBar   = Math.round((conf / 10) * 100);


    const confLabel = conf >= 8 ? 'HOOG' : conf >= 6 ? 'GEMIDDELD' : 'LAAG';


    const confIcon  = conf >= 8 ? '\u{1F525}' : conf >= 6 ? '\u2705' : '\u26A0\uFE0F';


    const odds    = s.odds?.toFixed(2) || '?';


    const mid     = s.matchId;


    const hasPoi  = s.poissonK1 != null;


    const reason  = s.reason || '';


    const factoren = Array.isArray(s.factoren) ? s.factoren : [];


    const risico   = s.risico || '';


    const bkKans   = s.odds > 1 ? Math.round(100 / s.odds) : null;


    const aiKans   = s.kans || null;


    const valueSrc = (hasPoi ? '\u{1F4D0} Poisson + ' : '') + 'AI';


    const esc = str => (str||'').replace(/'/g, "\\'");


    return `<div class="scan-result-row" onclick="openScanResult(${mid})" style="cursor:pointer;padding:.85rem .9rem;">


      <div style="display:flex;align-items:flex-start;gap:.6rem;margin-bottom:.55rem;">


        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--sub);min-width:1.6rem;padding-top:1px;">#${i+1}</div>


        <div style="flex:1;min-width:0;">


          <div style="font-size:.88rem;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.home} vs ${s.away}</div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);margin-top:1px;">${s.comp||''} &middot; @ ${odds}</div>


        </div>


        <div style="background:${valBg};border:1.5px solid ${valBorder};border-radius:10px;padding:.3rem .6rem;text-align:center;flex-shrink:0;">


          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;line-height:1;color:${valColor};">${valSign}${val.toFixed(1)}%</div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:${valColor};font-weight:700;">VALUE</div>


        </div>


      </div>


      <div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.15);border-radius:9px;padding:.4rem .7rem;margin-bottom:.55rem;display:flex;justify-content:space-between;align-items:center;">


        <div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#7c3aed;font-weight:700;letter-spacing:.05em;">BESTE BET</div>


          <div style="font-size:.85rem;font-weight:800;color:var(--ink);margin-top:1px;">${s.pickLabel}</div>


        </div>


        ${bkKans && aiKans ? `<div style="text-align:right;">


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:var(--sub);">BK ${bkKans}% &rarr; AI <span style="color:${valColor};font-weight:700;">${aiKans}%</span></div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.45rem;color:var(--sub);margin-top:1px;">${valueSrc}</div>


        </div>` : ''}


      </div>


      <div style="margin-bottom:.55rem;">


        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem;">


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;color:var(--sub);">${confIcon} ZEKERHEID</div>


          <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;font-weight:800;color:${confColor};">${conf}/10 &middot; ${confLabel}</div>


        </div>


        <div style="background:rgba(0,0,0,.08);border-radius:999px;height:7px;overflow:hidden;">


          <div style="background:${confColor};width:${confBar}%;height:100%;border-radius:999px;"></div>


        </div>


      </div>


      ${reason ? `<div style="font-size:.76rem;line-height:1.65;color:var(--ink);margin-bottom:.5rem;padding:.5rem .65rem;background:rgba(255,255,255,.65);border-radius:8px;border-left:2.5px solid ${valColor};">${reason}</div>` : ''}


      ${factoren.length ? `<div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem;">${factoren.map(f => `<span style="font-family:'IBM Plex Mono',monospace;font-size:.47rem;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.18);color:#7c3aed;">${f}</span>`).join('')}</div>` : ''}


      <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;">


        ${risico ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:.47rem;padding:2px 8px;border-radius:999px;background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.18);color:#dc2626;">\u26A0 ${risico}</span>` : ''}


        ${hasPoi ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:.47rem;padding:2px 8px;border-radius:999px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);color:#2563eb;">\u{1F4D0} Poisson</span>` : ''}


        <a href="https://jacks.nl/sports#search/${((s.home||'')+'+' +(s.away||'')).replace(/ /g,'+')}"


          target="_blank" rel="noopener" class="jacks-btn" style="font-size:.44rem;padding:2px 7px;margin-left:auto;"


          onclick="event.stopPropagation()">&#127920; Jacks</a>


        <span onclick="event.stopPropagation();addScanPickToCombi(${mid},'${esc(s.pick)}','${esc(s.pickLabel)}',${s.odds||0},'${esc(s.home)}','${esc(s.away)}')"


          style="font-family:'IBM Plex Mono',monospace;font-size:.47rem;font-weight:800;padding:3px 10px;border-radius:999px;cursor:pointer;background:rgba(219,39,119,.1);border:1px solid rgba(219,39,119,.3);color:#be185d;">+ COMBI</span>


      </div>


    </div>`;


  }).join('');





  panel.style.display = 'block';


  const body = document.getElementById('scanResultsBody');


  if (body) body.style.display = 'block';


  if (!restored) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);


}





// ═══════════════════════════════════════════════════════


// BOTTOM NAVIGATION


// ═══════════════════════════════════════════════════════


const BNAV_TABS = ['dashboard','wedstrijden','wallet','tracker'];





function updateBottomNav(tab) {


  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));


  // Map tab to bnav button


  const bnavId = BNAV_TABS.includes(tab) ? 'bnav-' + tab : 'bnav-more';


  const btn = document.getElementById(bnavId);


  if (btn) btn.classList.add('active');





  // Notification dots


  const openBets = (state.wallet?.bets || []).filter(b => b.status === 'pending').length;


  const openTracker = (state.tracker?.bets || []).filter(b => b.status === 'pending').length;


  const walletDot = document.getElementById('bnav-wallet-dot');


  const trackerDot = document.getElementById('bnav-tracker-dot');


  if (walletDot) walletDot.style.display = openBets > 0 ? 'block' : 'none';


  if (trackerDot) trackerDot.style.display = openTracker > 0 ? 'block' : 'none';


}





function toggleMoreMenu() {


  const menu = document.getElementById('moreMenu');


  if (!menu) return;


  menu.classList.toggle('open');


  // Close on outside tap


  if (menu.classList.contains('open')) {


    setTimeout(() => {


      document.addEventListener('click', function closeMenu(e) {


        if (!menu.contains(e.target) && e.target.id !== 'bnav-more') {


          menu.classList.remove('open');


          document.removeEventListener('click', closeMenu);


        }


      });


    }, 10);


  }


}





// ═══════════════════════════════════════════════════════


// DASHBOARD


// ═══════════════════════════════════════════════════════


function renderDashboard() {


  const el = document.getElementById('dashContent');


  if (!el) return;





  const w = state.wallet || {};


  const bets = w.bets || [];


  const openBets = bets.filter(b => b.status === 'pending');


  const settledBets = bets.filter(b => b.status !== 'pending');


  const wins = settledBets.filter(b => b.status === 'win').length;


  const hitRate = settledBets.length ? Math.round(wins / settledBets.length * 100) : null;


  const pnl = w.totalWon ? (w.balance - (w.startBalance || 500)) : 0;


  const pnlColor = pnl >= 0 ? '#16a34a' : '#dc2626';


  const pnlSign = pnl >= 0 ? '+' : '';





  // Tracker open bets


  const trackerOpen = (state.tracker?.bets || []).filter(b => b.status === 'pending');





  // Recent value scan results


  const scanResults = (state.lastScanResults || []).slice(0, 3);





  // Best Triple Lock if any


  const tripleMatches = (state.matches || []).filter(m =>


    m.valueData?.pct >= 5 && m.valueData?.confidence >= 7 && m.valueData?.poissonUsed


  );





  el.innerHTML = `


    <!-- Stats grid -->


    <div class="dash-grid">


      <div class="dash-card" onclick="switchTab('wallet')">


        <div class="dash-card-label">💶 Saldo</div>


        <div class="dash-card-value" style="color:#be185d;">€${(w.balance||500).toFixed(0)}</div>


        <div class="dash-card-sub" style="color:${pnlColor};">${pnlSign}€${Math.abs(pnl).toFixed(2)} totaal</div>


      </div>


      <div class="dash-card" onclick="switchTab('wallet')">


        <div class="dash-card-label">🎯 Hitrate</div>


        <div class="dash-card-value" style="color:#7c3aed;">${hitRate !== null ? hitRate + '%' : '—'}</div>


        <div class="dash-card-sub">${wins}W · ${settledBets.length - wins}V · ${settledBets.length} bets</div>


      </div>


      <div class="dash-card" onclick="switchTab('wallet')">


        <div class="dash-card-label">⏳ Open bets</div>


        <div class="dash-card-value">${openBets.length}</div>


        <div class="dash-card-sub">${openBets.length ? 'Wachten op resultaat' : 'Geen open bets'}</div>


      </div>


      <div class="dash-card" onclick="switchTab('tracker')">


        <div class="dash-card-label">📒 Tracker</div>


        <div class="dash-card-value">${trackerOpen.length}</div>


        <div class="dash-card-sub">Open echte bets</div>


      </div>


    </div>





    ${tripleMatches.length > 0 ? `


    <div class="dash-section-title">🏆 Triple Lock vandaag</div>


    ${tripleMatches.slice(0, 2).map(m => `


      <div class="dash-bet-row" onclick="switchTab('wedstrijden');setTimeout(()=>selectMatch(state.matches.find(x=>x.id===${m.id})),200)">


        <div style="font-size:1.1rem;">🏆</div>


        <div style="flex:1;">


          <div class="dash-bet-match">${m.home} vs ${m.away}</div>


          <div class="dash-bet-sub">${m.valueData.pickLabel} · ${m.comp}</div>


        </div>


        <span class="dash-pick-badge" style="background:rgba(22,163,74,.12);color:#15803d;">


          +${Math.round(m.valueData.pct)}% VALUE


        </span>


      </div>


    `).join('')}


    ` : ''}





    ${openBets.length > 0 ? `


    <div class="dash-section-title">⏳ Open wallet bets</div>


    ${openBets.slice(0, 3).map(b => {


      const isCombi = b.type === 'combi' && b.legs?.length;


      const matchName = b.matchName ||


        (isCombi ? b.legs.map(l => (l.home || l.match?.split(' vs ')?.[0] || '?').substring(0,12)).join(' + ') : b.match || '?');


      const pick = b.pickLabel || b.pick ||


        (isCombi ? b.legs.map(l => l.pick || '?').join(' + ') : '?');


      const stake = b.amount || b.stake || 0;


      const odds = b.odds || (isCombi ? b.legs.reduce((a,l) => a * (parseFloat(l.odds)||1), 1).toFixed(2) : '?');


      const payout = b.payout || (stake * parseFloat(odds) || 0);


      // Extra info voor combi


      const combiInfo = isCombi ? `${b.legs.length} legs · ` : '';


      return `<div class="dash-bet-row" onclick="switchTab('wallet')">


        <div style="font-size:1rem;">⏳</div>


        <div style="flex:1;">


          <div class="dash-bet-match">${matchName}</div>


          <div class="dash-bet-sub">${combiInfo}${pick} · €${stake} @ ${odds}</div>


        </div>


        <span class="dash-pick-badge" style="background:rgba(219,39,119,.1);color:#be185d;">


          →€${payout.toFixed(2)}


        </span>


      </div>`;


    }).join('')}


    ${openBets.length > 3 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:var(--sub);text-align:center;padding:.3rem;">+${openBets.length-3} meer in Wallet</div>` : ''}


    ` : ''}





    ${scanResults.length > 0 ? `


    <div class="dash-section-title">


      ⚡ Laatste scan


      ${scanResults[0]?.scanTime ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;font-weight:400;color:var(--sub);margin-left:.4rem;">· ${scanResults[0].scanTime}</span>` : ''}


    </div>


    ${scanResults.map(s => `


      <div class="dash-bet-row" onclick="openScanResult(${s.matchId})">


        <div style="font-size:.9rem;">⚡</div>


        <div style="flex:1;">


          <div class="dash-bet-match">${s.home} vs ${s.away}</div>


          <div class="dash-bet-sub">${s.pickLabel} · ${s.comp || ''}</div>


          ${s.matchDate ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:#7c3aed;margin-top:1px;font-weight:700;">⏰ ${s.matchDate}</div>` : ''}


        </div>


        <span class="dash-pick-badge" style="background:${s.value>=5?'rgba(22,163,74,.12)':'rgba(100,116,139,.1)'};color:${s.value>=5?'#15803d':'#64748b'};">


          ${s.value>=0?'+':''}${s.value.toFixed(1)}%


        </span>


      </div>


    `).join('')}


    ` : `


    <div style="text-align:center;padding:2rem 1rem;">


      <div style="font-size:2rem;margin-bottom:.5rem;">⚽</div>


      <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--sub);">


        Laad wedstrijden en doe een scan<br>om picks te zien


      </div>


      <button onclick="switchTab('wedstrijden')" style="margin-top:.8rem;


        font-family:'IBM Plex Mono',monospace;font-size:.58rem;font-weight:800;


        padding:.45rem 1.2rem;border-radius:999px;cursor:pointer;


        background:rgba(219,39,119,.1);border:1px solid rgba(219,39,119,.3);color:#be185d;">


        🌍 Naar Wedstrijden


      </button>


    </div>


    `}


  `;


}





// ═══════════════════════════════════════════════════════


// SKELETON LOADING


// ═══════════════════════════════════════════════════════


function showSkeletonCards(count = 4) {


  const list = document.getElementById('matchList');


  if (!list) return;


  list.innerHTML = Array(count).fill(0).map((_, i) => `


    <div class="skeleton-card" style="animation-delay:${i * .06}s;">


      <div class="skeleton-top skeleton-line"></div>


      <div class="skeleton-body">


        <div class="skeleton-team skeleton-line" style="flex:1;"></div>


        <div class="skeleton-vs skeleton-line"></div>


        <div class="skeleton-team skeleton-line" style="flex:1;"></div>


      </div>


      <div class="skeleton-bottom">


        <div class="skeleton-odds skeleton-line"></div>


        <div class="skeleton-odds skeleton-line"></div>


        <div class="skeleton-odds skeleton-line"></div>


      </div>


    </div>


  `).join('');


}





// ═══════════════════════════════════════════════════════


// CHECK TRACKER BET RESULTAAT


// ═══════════════════════════════════════════════════════


async function checkTrackerBetResult(betId) {


  const bet = state.tracker.bets.find(b => b.id === betId);


  if (!bet || bet.status !== 'pending') return;


  // apiKey op server


  try {


    // Direct fixture lookup


    const fixtureId = bet.fixtureId;


    if (!fixtureId) return;





    const r = await apiFetch(


      `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,


      null, 6000


    );


    const d = await r.json();


    const fix = d.response?.[0];


    if (!fix) return;





    const status = fix.fixture?.status?.short;


    if (!['FT','AET','PEN'].includes(status)) return;





    const hg = fix.goals?.home ?? 0;


    const ag = fix.goals?.away ?? 0;


    bet.score = `${hg}-${ag}`;





    // Determine result


    const pick = bet.pick;


    let won = false;


    if (pick === '1' || pick?.toLowerCase().includes('thuis')) won = hg > ag;


    else if (pick === 'X' || pick?.toLowerCase().includes('gelijk')) won = hg === ag;


    else if (pick === '2' || pick?.toLowerCase().includes('uit')) won = ag > hg;


    else won = false; // Can't auto-determine for special markets





    bet.status = won ? 'win' : 'lose';


    saveState();


    renderTracker();


    updateTrackerStats();


  } catch(e) {}


}





async function autoCheckTrackerBets() {


  // apiKey op server


  const open = state.tracker.bets.filter(b => b.status === 'pending' && b.fixtureId);


  for (const bet of open) {


    await checkTrackerBetResult(bet.id);


  }


}





// ═══════════════════════════════════════════════════════


// SCAN VERBETERINGEN — sort + comp filter


// ═══════════════════════════════════════════════════════


let scanSort = 'value';


let scanCompFilter = new Set(); // empty = all





function setScanSort(sort) {


  scanSort = sort;


  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));


  document.getElementById('sort-' + sort)?.classList.add('active');


  // Re-render with new sort


  if (state.lastScanResults?.length) renderScanResults(state.lastScanResults);


}





function toggleScanResults() {


  const body = document.getElementById('scanResultsBody');


  const chev = document.getElementById('scanResultsChevron');


  if (!body) return;


  const hidden = body.style.display === 'none';


  body.style.display = hidden ? 'block' : 'none';


  if (chev) chev.textContent = hidden ? '▼' : '▶';


}





function buildScanCompFilter(matches) {


  const wrap = document.getElementById('scanCompFilterWrap');


  const container = document.getElementById('scanCompFilter');


  if (!wrap || !container) return;





  // Alleen bekende competities tonen


  const knownNames = {


    eredivisie: '🇳🇱 Eredivisie', kkd: '🇳🇱 Keuken Kampioen',


    premier: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', bundesliga: '🇩🇪 Bundesliga',


    ligue1: '🇫🇷 Ligue 1', seriea: '🇮🇹 Serie A',


    champions: '⭐ Champions League', nations: '🌍 Nations League',


    beker: '🏆 KNVB Beker', wk2026: '🏆 WK 2026',


    jupiler: '🇧🇪 Jupiler Pro', laliga: '🇪🇸 La Liga',


    superlig: '🇹🇷 Süper Lig',


    eredivisie_playoff_eur: '🇳🇱 Ered. Playoff EUR',


    eredivisie_playoff_rel: '🇳🇱 Ered. Playoff DEG',


    kkd_playoff_prom: '🇳🇱 KKD Playoff PROM'


  };





  // Welke bekende comps zitten in de geladen matches?


  const loadedComps = new Set(matches.map(m => m.comp).filter(Boolean));


  const knownLoaded = Object.entries(knownNames)


    .filter(([key, name]) => {


      // Check if any loaded match comp matches this known comp


      return [...loadedComps].some(c =>


        c.toLowerCase().includes(key) ||


        name.toLowerCase().includes(c.toLowerCase()) ||


        c === name


      );


    });





  // Alle geladen comps die niet bekend zijn, niet tonen


  if (!knownLoaded.length && !loadedComps.size) { wrap.style.display = 'none'; return; }





  // Toon alleen bekende comps die geladen zijn


  const displayComps = knownLoaded.length > 0


    ? knownLoaded.map(([k, label]) => ({ key: k, label }))


    : [...loadedComps].slice(0, 10).map(c => ({ key: c, label: c }));





  if (!displayComps.length) { wrap.style.display = 'none'; return; }





  wrap.style.display = 'block';


  container.innerHTML = displayComps.map(({ key, label }) => `


    <button class="scan-comp-chip ${scanCompFilter.size === 0 || scanCompFilter.has(key) ? 'on' : ''}"


      onclick="toggleScanComp('${key}')" id="scc-${key}">


      ${label}


    </button>


  `).join('');


}





function toggleScanComp(comp) {


  if (scanCompFilter.size === 0) {


    // First toggle: enable all then disable this one


    const allComps = [...new Set(state.matches.map(m => m.comp).filter(Boolean))];


    allComps.forEach(c => scanCompFilter.add(c));


    scanCompFilter.delete(comp);


  } else if (scanCompFilter.has(comp)) {


    scanCompFilter.delete(comp);


    if (scanCompFilter.size === 0) scanCompFilter = new Set(); // all = empty


  } else {


    scanCompFilter.add(comp);


  }


  // Update chips


  document.querySelectorAll('.scan-comp-chip').forEach(b => b.classList.remove('on'));


  const allComps = [...new Set(state.matches.map(m => m.comp).filter(Boolean))];


  allComps.forEach(c => {


    const el = document.getElementById('scc-' + c.replace(/[^a-z0-9]/gi,''));


    if (el && (scanCompFilter.size === 0 || scanCompFilter.has(c))) el.classList.add('on');


  });


}





// Sort matchlist by value after scan


function sortMatchListByValue() {


  const list = document.getElementById('matchList');


  if (!list) return;


  const cards = [...list.querySelectorAll('.match-card')];


  const withValue = cards.filter(c => {


    const mid = c.id?.replace('match-','');


    const m = state.matches.find(x => String(x.id) === mid);


    return m?.valueData?.pct != null;


  });


  const withoutValue = cards.filter(c => !withValue.includes(c));


  // Sort by value desc


  withValue.sort((a, b) => {


    const ma = state.matches.find(x => String(x.id) === a.id?.replace('match-',''));


    const mb = state.matches.find(x => String(x.id) === b.id?.replace('match-',''));


    return (mb?.valueData?.pct || 0) - (ma?.valueData?.pct || 0);


  });


  // Add rank numbers


  withValue.forEach((c, i) => {


    let rank = c.querySelector('.match-value-rank');


    if (!rank) { rank = document.createElement('div'); rank.className = 'match-value-rank'; c.style.position = 'relative'; c.appendChild(rank); }


    rank.textContent = `#${i+1}`;


  });


  // Reorder DOM


  [...withValue, ...withoutValue].forEach(c => list.appendChild(c));


}





// ═══════════════════════════════════════════════════════


// TRIPLE LOCK HITRATE


// ═══════════════════════════════════════════════════════


function calcTripleLockHitrate() {


  const picks = state.valueBacktest?.picks || [];


  // Triple lock picks hebben hoge confidence + Poisson


  // We schatten dit op basis van confidence >= 8 in backtest


  const tlPicks = picks.filter(p => p.confidence >= 8 && (p.status === 'win' || p.status === 'lose'));


  const dlPicks = picks.filter(p => p.confidence >= 7 && p.confidence < 8 && (p.status === 'win' || p.status === 'lose'));


  const tlWins  = tlPicks.filter(p => p.status === 'win').length;


  const dlWins  = dlPicks.filter(p => p.status === 'win').length;


  return {


    tl: { total: tlPicks.length, wins: tlWins, rate: tlPicks.length ? Math.round(tlWins/tlPicks.length*100) : null },


    dl: { total: dlPicks.length, wins: dlWins, rate: dlPicks.length ? Math.round(dlWins/dlPicks.length*100) : null }


  };


}





function renderTripleLockHitrate() {


  const el = document.getElementById('tlHitrateCard');


  if (!el) return;


  const { tl, dl } = calcTripleLockHitrate();


  if (!tl.total && !dl.total) { el.style.display = 'none'; return; }


  el.style.display = 'flex';





  const tlColor = tl.rate >= 60 ? '#16a34a' : tl.rate >= 45 ? '#d97706' : '#dc2626';


  const dlColor = dl.rate >= 55 ? '#16a34a' : dl.rate >= 40 ? '#d97706' : '#dc2626';





  el.innerHTML = `


    <div class="tl-hitrate-icon">🏆</div>


    <div style="flex:1;">


      <div class="tl-hitrate-label">Triple Lock Hitrate</div>


      <div style="display:flex;gap:1.2rem;margin-top:.3rem;">


        ${tl.total ? `<div>


          <div class="tl-hitrate-val" style="color:${tlColor};">${tl.rate !== null ? tl.rate+'%' : '—'}</div>


          <div class="tl-hitrate-sub">🏆 Triple · ${tl.wins}W/${tl.total}</div>


        </div>` : ''}


        ${dl.total ? `<div>


          <div class="tl-hitrate-val" style="color:${dlColor};font-size:1.5rem;">${dl.rate !== null ? dl.rate+'%' : '—'}</div>


          <div class="tl-hitrate-sub">🔑 Double · ${dl.wins}W/${dl.total}</div>


        </div>` : ''}


      </div>


    </div>


  `;


}





// ═══════════════════════════════════════════════════════


// WEDSTRIJD HERINNERING — 30 min voor aftrap


// ═══════════════════════════════════════════════════════


let _reminderInterval = null;





function startReminderScheduler() {


  if (_reminderInterval) clearInterval(_reminderInterval);


  _reminderInterval = setInterval(checkMatchReminders, 60 * 1000); // elke minuut


  checkMatchReminders(); // direct checken


}





function checkMatchReminders() {


  if (!state.settings.notifEnabled || Notification.permission !== 'granted') return;


  const openBets = (state.wallet?.bets || []).filter(b => b.status === 'pending');


  if (!openBets.length) return;





  const now = Date.now();


  const thirtyMin = 30 * 60 * 1000;





  openBets.forEach(bet => {


    const matchTime = bet.matchTime || bet.kickoff;


    if (!matchTime) return;





    const kickoff = new Date(matchTime).getTime();


    const diff = kickoff - now;





    // Tussen 28 en 32 minuten voor aftrap — stuur herinnering


    if (diff > 28 * 60000 && diff < 32 * 60000) {


      const remKey = 'remind_' + bet.id;


      if (localStorage.getItem(remKey)) return; // al verstuurd


      localStorage.setItem(remKey, '1');





      const name = bet.matchName || bet.match || 'Wedstrijd';


      const pick = bet.pickLabel || bet.pick || '';


      sendPickNotification(


        '⏰ Aftrap over 30 min!',


        `${name} — Jouw bet: ${pick} @ ${bet.odds}`,


        'reminder-' + bet.id,


        null, null


      );


    }


    // Verwijder reminder key na wedstrijd


    if (diff < -120 * 60000) localStorage.removeItem('remind_' + bet.id);


  });


}





// ═══════════════════════════════════════════════════════


// LIVE SCORE IN WALLET BETS


// ═══════════════════════════════════════════════════════


async function fetchLiveScoresForBets() {


  // apiKey op server


  const openBets = (state.wallet?.bets || []).filter(b => b.status === 'pending' && b.fixtureId);


  if (!openBets.length) return;





  try {


    // Haal live fixtures op


    const r = await apiFetch('https://v3.football.api-sports.io/fixtures?live=all', apiKey, 8000);


    const data = await r.json();


    const liveFixtures = data.response || [];





    let updated = false;


    for (const bet of openBets) {


      const fix = liveFixtures.find(f => String(f.fixture.id) === String(bet.fixtureId));


      if (!fix) {


        // Clear live score if not live anymore


        if (bet.liveScore) { delete bet.liveScore; delete bet.liveMinute; updated = true; }


        continue;


      }


      const score = `${fix.goals.home ?? 0}-${fix.goals.away ?? 0}`;


      const minute = fix.fixture.status.elapsed || '';


      if (bet.liveScore !== score || bet.liveMinute !== minute) {


        bet.liveScore = score;


        bet.liveMinute = minute;


        updated = true;


      }


    }


    if (updated) { updateWalletUI(); saveState(); }


  } catch(e) {}


}





// Start live score polling every 60s when wallet tab is active


let _liveScoreInterval = null;


function startLiveScorePolling() {


  if (_liveScoreInterval) return;


  fetchLiveScoresForBets();


  _liveScoreInterval = setInterval(fetchLiveScoresForBets, 60000);


}


function stopLiveScorePolling() {


  if (_liveScoreInterval) { clearInterval(_liveScoreInterval); _liveScoreInterval = null; }


}





// ═══════════════════════════════════════════════════════


// EXPORTEER NAAR CSV


// ═══════════════════════════════════════════════════════


function exportWalletCSV() {


  const bets = state.wallet?.bets || [];


  if (!bets.length) { alert('Geen bets om te exporteren'); return; }





  const headers = ['Datum','Wedstrijd','Pick','Quote','Inzet','Uitbetaling','W/V','Status','Score','Bron'];


  const rows = bets.map(b => {


    const pnl = b.status === 'win' ? (b.payout - (b.amount||b.stake)).toFixed(2)


              : b.status === 'lose' ? (-( b.amount||b.stake)).toFixed(2)


              : '0';


    return [


      b.date || '',


      (b.matchName || b.match || '').replace(/,/g,' '),


      (b.pickLabel || b.pick || '').replace(/,/g,' '),


      b.odds || '',


      b.amount || b.stake || '',


      b.payout?.toFixed(2) || '',


      pnl,


      b.status === 'win' ? 'Gewonnen' : b.status === 'lose' ? 'Verloren' : 'Open',


      b.score || '',


      b.source || 'eigen'


    ].join(',');


  });





  const csv = [headers.join(','), ...rows].join('\n');


  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });


  const url = URL.createObjectURL(blob);


  const a = document.createElement('a');


  a.href = url;


  a.download = `TOTO-AI-wallet-${new Date().toISOString().split('T')[0]}.csv`;


  a.click();


  URL.revokeObjectURL(url);


  showAutoCheckBar('📥 CSV gedownload!', 2000);


}





function exportTrackerCSV() {


  const bets = state.tracker?.bets || [];


  if (!bets.length) { alert('Geen tracker bets om te exporteren'); return; }





  const headers = ['Datum','Wedstrijd','Pick','Markt','Quote','Inzet','Uitbetaling','Status','Score','Bookmaker','Bron'];


  const rows = bets.map(b => [


    b.date || '',


    (b.match || '').replace(/,/g,' '),


    (b.pick || '').replace(/,/g,' '),


    b.markt || '',


    b.odds || '',


    b.stake || '',


    b.payout?.toFixed(2) || '',


    b.status === 'win' ? 'Gewonnen' : b.status === 'lose' ? 'Verloren' : 'Open',


    b.score || '',


    b.bookmaker || '',


    b.source || 'eigen'


  ].join(',')).join('\n');





  const csv = [headers.join(','), rows].join('\n');


  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });


  const url = URL.createObjectURL(blob);


  const a = document.createElement('a');


  a.href = url;


  a.download = `TOTO-AI-tracker-${new Date().toISOString().split('T')[0]}.csv`;


  a.click();


  URL.revokeObjectURL(url);


  showAutoCheckBar('📥 Tracker CSV gedownload!', 2000);


}





// ═══════════════════════════════════════════════════════


// RUST FACTOR — dagen sinds laatste wedstrijd


// ═══════════════════════════════════════════════════════


async function fetchLastFixture(teamId, apiKey) {


  if (!teamId || !apiKey) return null;


  try {


    const r = await apiFetch(


      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=1&status=FT`,


      null, 5000


    );


    const d = await r.json();


    return d.response?.[0] || null;


  } catch(e) { return null; }


}





function calcRestDays(lastFixture, matchDate) {


  if (!lastFixture?.fixture?.date) return null;


  const last = new Date(lastFixture.fixture.date);


  const next = matchDate ? new Date(matchDate) : new Date();


  const diff = Math.round((next - last) / (1000*60*60*24));


  return diff;


}





function restLabel(days) {


  if (days === null) return '?';


  if (days <= 2) return `⚠️ ${days}d rust (kort!)`;


  if (days <= 4) return `${days}d rust`;


  return `✅ ${days}d rust`;


}





// ═══════════════════════════════════════════════════════


// THUIS/UIT RATIO — hoe sterk thuis vs uit


// ═══════════════════════════════════════════════════════


function calcHomeAwayStrength(stats) {


  if (!stats?.fixtures) return null;


  const homeW = stats.fixtures.wins?.home || 0;


  const homeP = stats.fixtures.played?.home || 1;


  const awayW = stats.fixtures.wins?.away || 0;


  const awayP = stats.fixtures.played?.away || 1;


  const homeRate = Math.round(homeW / homeP * 100);


  const awayRate = Math.round(awayW / awayP * 100);


  const diff = homeRate - awayRate;


  return {


    homeWinRate: homeRate,


    awayWinRate: awayRate,


    homeBias: diff > 15 ? `sterk thuis (+${diff}%)` : diff < -10 ? `beter uit` : `neutraal`,


    diff


  };


}





// ═══════════════════════════════════════════════════════


// SEIZOENSFASE CONTEXT


// ═══════════════════════════════════════════════════════


function calcSeasonPhase(standings, homeTeam, awayTeam) {


  if (!standings?.length) return '';


  const total = standings.length;


  const home = standings.find(t => t.team.name.toLowerCase().includes(homeTeam.toLowerCase().substring(0,5)));


  const away = standings.find(t => t.team.name.toLowerCase().includes(awayTeam.toLowerCase().substring(0,5)));


  if (!home || !away) return '';





  const lines = [];





  // Kampioensdrang


  if (home.rank <= 2) lines.push(`${homeTeam} vecht om titel (#${home.rank})`);


  if (away.rank <= 2) lines.push(`${awayTeam} vecht om titel (#${away.rank})`);





  // Degradatiedruk (laatste 3)


  if (home.rank >= total - 2) lines.push(`${homeTeam} degradatiezone (#${home.rank}/${total}) → hoge druk`);


  if (away.rank >= total - 2) lines.push(`${awayTeam} degradatiezone (#${away.rank}/${total}) → hoge druk`);





  // Niks te winnen/verliezen (midden)


  const played = home.all?.played || 0;


  const totalGames = (total - 1) * 2;


  const pct = played / totalGames;


  if (pct > 0.85 && home.rank > 3 && home.rank < total - 2) {


    lines.push(`${homeTeam} speelt zonder druk (midden stand, seizoen bijna klaar)`);


  }


  if (pct > 0.85 && away.rank > 3 && away.rank < total - 2) {


    lines.push(`${awayTeam} speelt zonder druk`);


  }





  // Rangverschil


  const rankDiff = Math.abs(home.rank - away.rank);


  if (rankDiff >= 8) {


    const stronger = home.rank < away.rank ? homeTeam : awayTeam;


    lines.push(`Groot rangverschil (${rankDiff} plaatsen) — ${stronger} duidelijk favoriet`);


  }





  return lines.length ? lines.join('. ') : '';


}





// ═══════════════════════════════════════════════════════


// TEAM MOTIVATIE ANALYSE


// ═══════════════════════════════════════════════════════


function analyzeTeamMotivation(standings, teamName, fixtures, isHome) {


  if (!standings?.length) return '';


  const total = standings.length;


  const team = standings.find(t =>


    t.team.name.toLowerCase().includes(teamName.toLowerCase().substring(0,5))


  );


  if (!team) return '';





  const motivations = [];


  const rank = team.rank;


  const points = team.points;


  const played = team.all?.played || 0;





  // Titel race


  if (rank === 1) motivations.push('🥇 Koploper — maximale inzet');


  else if (rank === 2 && team.all?.played > 20) {


    const gap = standings[0].points - points;


    if (gap <= 3) motivations.push(`🔥 Titelrace: ${gap}pt achter op kop`);


  }





  // Europees voetbal


  if (rank <= 4 && played > 15) motivations.push(`🇪🇺 Europees gevecht (#${rank})`);





  // Degradatie


  if (rank >= total - 2) {


    const safePoints = standings[total-3]?.points || 0;


    const gap = safePoints - points;


    if (gap > 0) motivations.push(`🆘 Degradatiegevaar: ${gap}pt van veiligheid`);


    else motivations.push('⚠️ In degradatiezone — alles op alles');


  }





  // Recente vorm (laatste 5)


  const form = team.form || '';


  const recentForm = form.slice(-5);


  const wins = (recentForm.match(/W/g)||[]).length;


  const losses = (recentForm.match(/L/g)||[]).length;


  if (wins >= 4) motivations.push(`💪 Uitstekende vorm: ${recentForm}`);


  else if (losses >= 3) motivations.push(`📉 Slechte serie: ${recentForm} — druk om te winnen`);





  // Thuis vs uit motivatie


  const homeW = team.home?.win || 0;


  const homeP = team.home?.played || 1;


  const awayW = team.away?.win || 0;


  const awayP = team.away?.played || 1;


  if (isHome && homeW/homeP > 0.7) motivations.push(`🏟️ Thuisfestung: ${Math.round(homeW/homeP*100)}% thuis gewonnen`);


  if (!isHome && awayW/awayP > 0.5) motivations.push(`✈️ Sterk op pad: ${Math.round(awayW/awayP*100)}% uitwedstrijden gewonnen`);





  return motivations.length ? motivations.join(' | ') : 'Reguliere motivatie';


}





function formatMotivationContext(standings, homeName, awayName, homeForm, awayForm) {


  if (!standings?.length) return '';


  const homeMot = analyzeTeamMotivation(standings, homeName, homeForm, true);


  const awayMot = analyzeTeamMotivation(standings, awayName, awayForm, false);


  if (!homeMot && !awayMot) return '';


  return `\nMOTIVATIE:\n${homeName}: ${homeMot}\n${awayName}: ${awayMot}`;


}





// ═══════════════════════════════════════════════════════


// FORMATIE MATCHUP ANALYSE


// ═══════════════════════════════════════════════════════


function analyzeFormationMatchup(lineups, homeName, awayName) {


  if (!lineups?.length) return '';





  const homeTeam = lineups.find(t => t.team.name.toLowerCase().includes(homeName.toLowerCase().substring(0,5)));


  const awayTeam = lineups.find(t => t.team.name.toLowerCase().includes(awayName.toLowerCase().substring(0,5)));





  if (!homeTeam?.formation || !awayTeam?.formation) return '';





  const homF = homeTeam.formation; // bijv "4-3-3"


  const awayF = awayTeam.formation;





  const homeAttackers = parseInt(homF.split('-').pop()) || 1;


  const awayAttackers = parseInt(awayF.split('-').pop()) || 1;


  const homeDefenders = parseInt(homF.split('-')[0]) || 4;


  const awayDefenders = parseInt(awayF.split('-')[0]) || 4;





  const insights = [`Formaties: ${homeName} ${homF} vs ${awayName} ${awayF}`];





  // Aanval vs verdediging matchup


  if (homeAttackers >= 3 && awayDefenders <= 3) {


    insights.push(`⚔️ ${homeName} aanval (${homeAttackers} voorin) vs zwakke ${awayName} defensie — kansen voor thuis`);


  }


  if (awayAttackers >= 3 && homeDefenders <= 3) {


    insights.push(`⚔️ ${awayName} aanval (${awayAttackers} voorin) vs kwetsbare ${homeName} defensie — uitkansen verwacht`);


  }





  // 5-back = defensief


  if (homF.startsWith('5') || homF.startsWith('3-5')) {


    insights.push(`🛡️ ${homeName} speelt defensief (${homF}) — laag scorende wedstrijd verwacht`);


  }


  if (awayF.startsWith('5') || awayF.startsWith('3-5')) {


    insights.push(`🛡️ ${awayName} speelt op counter (${awayF}) — uitgespeeld, enkele kansen`);


  }





  // Gelijke formaties = neutraal


  if (homF === awayF) {


    insights.push(`⚖️ Spiegelformatie — tactisch gevecht`);


  }





  return '\nFORMATIE ANALYSE:\n' + insights.join('\n');


}





// ═══════════════════════════════════════════════════════


// MARKTEFFICIËNTIE PER COMPETITIE


// Grote competities = efficiëntere markt = meer betrouwbaar


// ═══════════════════════════════════════════════════════


const MARKET_EFFICIENCY = {


  39: 0.95,  // Premier League — zeer efficiënt


  78: 0.93,  // Bundesliga


  135: 0.92, // Serie A


  61: 0.91,  // Ligue 1


  2: 0.90,   // Champions League


  88: 0.82,  // Eredivisie


  144: 0.78, // Jupiler Pro


  140: 0.92,  // La Liga


  40: 0.82,   // Championship


  79: 0.84,   // 2. Bundesliga


  203: 0.75, // Süper Lig


  89: 0.70,  // Keuken Kampioen


  90: 0.68,  // KNVB Beker


  5: 0.72,   // Nations League


};





function getMarketEfficiency(leagueId) {


  return MARKET_EFFICIENCY[leagueId] || 0.65;


}





function marketEfficiencyLabel(leagueId) {


  const eff = getMarketEfficiency(leagueId);


  if (eff >= 0.90) return `✅ Hoog efficiënte markt (${Math.round(eff*100)}%) — bookmakerquotes betrouwbaar`;


  if (eff >= 0.78) return `⚠️ Gemiddelde marktefficiëntie (${Math.round(eff*100)}%) — meer value kansen mogelijk`;


  return `🟡 Lage marktefficiëntie (${Math.round(eff*100)}%) — grotere foutmarge bookmakers`;


}





// ═══════════════════════════════════════════════════════


// OPEN SCAN RESULTAAT — navigeer naar wedstrijd


// ═══════════════════════════════════════════════════════


function openScanResult(matchId) {


  // Zoek in state.matches


  let m = state.matches.find(x => String(x.id) === String(matchId));





  if (m) {


    switchTab('wedstrijden');


    setTimeout(() => {


      selectMatch(m);


      // Scroll naar de match card


      const card = document.getElementById('match-' + m.id);


      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });


    }, 150);


  } else {


    // Match niet geladen — zoek in lastScanResults voor info


    const scan = (state.lastScanResults || []).find(s => String(s.matchId) === String(matchId));


    if (scan) {


      showAutoCheckBar(`📍 Laad ${scan.comp || 'competitie'} eerst om deze wedstrijd te zien`, 3000);


    }


    switchTab('wedstrijden');


  }


}





// ═══════════════════════════════════════════════════════


// VOEG SCAN PICK TOE AAN COMBI BUILDER


// ═══════════════════════════════════════════════════════


function addScanPickToCombi(matchId, pick, pickLabel, odds, home, away) {


  addValuePickToCombi(matchId, pick, pickLabel, odds, home, away);


  updateCombiBuilder();





  // Update button in scan results


  const btn = document.getElementById('sr-combi-' + matchId);


  const inCombi = state.combiBuilder.some(l => String(l.matchId) === String(matchId));


  if (btn) {


    btn.textContent = inCombi ? '✓ COMBI' : '+ COMBI';


    btn.style.background = inCombi ? 'rgba(22,163,74,.12)' : 'rgba(219,39,119,.1)';


    btn.style.borderColor = inCombi ? 'rgba(22,163,74,.4)' : 'rgba(219,39,119,.3)';


    btn.style.color = inCombi ? '#15803d' : '#be185d';


  }





  // Scroll naar combi builder


  switchTab('wedstrijden');


  setTimeout(() => {


    const builder = document.getElementById('combiBuilder');


    if (builder) builder.scrollIntoView({ behavior: 'smooth', block: 'start' });


  }, 300);





  showAutoCheckBar(`⚡ ${pickLabel} toegevoegd aan combi`, 2000);


}





// ═══════════════════════════════════════════════════════


// ECHTE VAPID PUSH SUBSCRIPTIE


// ═══════════════════════════════════════════════════════


let _pushSubscription = null;





function urlBase64ToUint8Array(base64String) {


  const padding = '='.repeat((4 - base64String.length % 4) % 4);


  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');


  const rawData = atob(base64);


  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));


}





async function subscribeToPush() {


  try {


    console.log('[Push] OneSignal subscribe...');





    // Wacht tot OneSignal klaar is


    const getOS = () => new Promise((resolve, reject) => {


      if (window.OneSignal?.User) { resolve(window.OneSignal); return; }


      const timeout = setTimeout(() => reject(new Error('OneSignal timeout na 8s')), 8000);


      window.OneSignalDeferred = window.OneSignalDeferred || [];


      window.OneSignalDeferred.push((OS) => { clearTimeout(timeout); resolve(OS); });


    });





    const OS = await getOS();


    console.log('[Push] OneSignal klaar');





    // Vraag toestemming


    const permission = await Notification.requestPermission();


    console.log('[Push] Toestemming:', permission);


    if (permission !== 'granted') throw new Error('Toestemming geweigerd: ' + permission);





    // Opt-in via OneSignal


    await OS.Notifications.requestPermission();





    // Wacht even zodat OneSignal de registratie afrondt


    await new Promise(r => setTimeout(r, 2000));





    // Haal Player ID op — meerdere pogingen


    let playerId = null;


    for (let i = 0; i < 5; i++) {


      playerId = OS.User?.pushSubscription?.id


               || OS.User?.onesignalId


               || OS.User?.externalId


               || null;


      if (playerId) break;


      console.log('[Push] Wacht op Player ID, poging', i+1);


      await new Promise(r => setTimeout(r, 1000));


    }





    if (playerId) {


      localStorage.setItem('totoai_onesignal_id', playerId);


      localStorage.setItem('totoai_push_sub', JSON.stringify({ type: 'onesignal', playerId }));


      console.log('[Push] Player ID opgeslagen:', playerId.substring(0,20)+'...');


    } else {


      // Fallback: gebruik VAPID subscription als OneSignal ID niet beschikbaar


      console.warn('[Push] Geen Player ID via OneSignal.User, probeer pushSubscription token...');


      const token = OS.User?.pushSubscription?.token;


      if (token) {


        localStorage.setItem('totoai_onesignal_id', token);


        localStorage.setItem('totoai_push_sub', JSON.stringify({ type: 'onesignal', playerId: token }));


        playerId = token;


        console.log('[Push] Token als fallback opgeslagen');


      }


    }





    return true;


  } catch(e) {


    console.error('[Push] OneSignal mislukt:', e.name, e.message);


    throw e;


  }


}





async function sendRealPush(title, message, data = {}) {


  try {


    // Stuur via OneSignal REST API (via worker)


    const playerId = localStorage.getItem('totoai_onesignal_id');


    if (!playerId) return false;





    const resp = await fetch('https://toto-proxy.zweetzakken.workers.dev/push/send', {


      method: 'POST',


      headers: { 'Content-Type': 'application/json' },


      body: JSON.stringify({


        type: 'onesignal',


        playerId,


        title,


        message,


        data


      })


    });


    const result = await resp.json();


    console.log('[Push] OneSignal verstuurd:', result);


    return resp.ok;


  } catch(e) {


    console.warn('[Push] Mislukt:', e.message);


    return false;


  }


}





// Upgrade sendPickNotification om ook echte push te proberen


const _origSendPickNotif = sendPickNotification;


async function sendPickNotificationEnhanced(title, body, tag, matchId, comp) {


  // Probeer altijd lokale notificatie (werkt als app open is)


  _origSendPickNotif(title, body, tag, matchId, comp);





  // Extra: stuur ook echte push (werkt als app gesloten is)


  if (localStorage.getItem('totoai_push_sub')) {


    await sendRealPush(title, body, {


      tag, matchId, comp,


      requireInteraction: true


    });


  }


}





// ═══════════════════════════════════════════════════════


// DEBUG PUSH — toont status in app


// ═══════════════════════════════════════════════════════


async function debugPush() {


  const lines = [];


  lines.push('=== PUSH DEBUG ===');





  // 1. OneSignal status


  const osId = localStorage.getItem('totoai_onesignal_id');


  const osSub = localStorage.getItem('totoai_push_sub');


  lines.push('OneSignal ID: ' + (osId ? osId.substring(0,20)+'... ✅' : 'GEEN'));


  lines.push('Push sub: ' + (osSub ? 'aanwezig ✅' : 'GEEN'));





  // 2. VAPID key (nog aanwezig voor info)


  const vapid = state.settings.vapidPublicKey;


  lines.push('VAPID key: ' + (vapid ? vapid.substring(0,20)+'...' : 'LEEG'));





  // 3. Notificaties permission


  lines.push('Notif toestemming: ' + Notification.permission);





  // 4. OneSignal SDK geladen?


  const osLoaded = typeof window.OneSignal !== 'undefined' || typeof window.OneSignalDeferred !== 'undefined';


  lines.push('OneSignal SDK: ' + (osLoaded ? 'geladen ✅' : 'NIET geladen ❌'));





  // 5. Service Worker


  try {


    const reg = await navigator.serviceWorker.ready;


    lines.push('SW: actief ✅');


    lines.push('SW scope: ' + reg.scope);


    const sub = await reg.pushManager.getSubscription();


    lines.push('Push sub SW: ' + (sub ? 'aanwezig ✅' : 'GEEN ❌'));


    if (sub) lines.push('Endpoint: ' + sub.endpoint.substring(0,50)+'...');


  } catch(e) {


    lines.push('SW: FOUT - ' + e.message);


  }





  // 6. Subscribe poging


  lines.push('--- Subscribe poging ---');


  try {


    const ok = await subscribeToPush();


    lines.push('Subscribe: ' + (ok ? 'OK ✅' : 'MISLUKT ❌'));


    const newId = localStorage.getItem('totoai_onesignal_id');


    lines.push('OneSignal ID opgeslagen: ' + (newId ? 'JA ✅' : 'NEE ❌'));


  } catch(e) {


    lines.push('Subscribe fout: ' + e.name + ': ' + e.message);


  }





  // 7. Test push via worker


  lines.push('--- Push test via worker ---');


  try {


    const playerId = localStorage.getItem('totoai_onesignal_id');


    lines.push('Player ID: ' + (playerId ? playerId.substring(0,20)+'... ✅' : 'GEEN ❌'));


    if (playerId) {


      const resp = await fetch('https://toto-proxy.zweetzakken.workers.dev/push/send', {


        method: 'POST',


        headers: {'Content-Type': 'application/json'},


        body: JSON.stringify({


          type: 'onesignal',


          playerId,


          title: '🔔 DEBUG TEST',


          message: 'OneSignal push test — ook bij gesloten app!',


          data: { tag: 'debug' }


        })


      });


      const result = await resp.json();


      lines.push('Worker status: ' + resp.status);


      lines.push('Worker result: ' + JSON.stringify(result).substring(0, 100));


    } else {


      lines.push('Geen Player ID voor push test');


    }


  } catch(e) {


    lines.push('Push test fout: ' + e.message);


  }





  const msg = lines.join('\n');


  alert(msg);


}





function toggleKeyVisibility(inputId, btn) {


  const input = document.getElementById(inputId);


  if (!input) return;


  if (input.type === 'password') {


    input.type = 'text';


    btn.textContent = '🙈';


  } else {


    input.type = 'password';


    btn.textContent = '👁';


  }


}





// ═══════════════════════════════════════════════════════


// FIREBASE AUTHENTICATIE


// ═══════════════════════════════════════════════════════


let _firebaseAuth = null;


let _currentUser = null;





function initFirebaseAuth() {


  try {


    let app;


    try { app = firebase.app(); } catch(e) {


      app = firebase.initializeApp({


        apiKey: 'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',


        authDomain: 'toto-ai-397cb.firebaseapp.com',


        projectId: 'toto-ai-397cb',


        messagingSenderId: '426083019907',


        appId: '1:426083019907:web:8f32f8037628d63cbbbfb6'


      });


    }


    _firebaseAuth = firebase.auth();





    // Luister naar auth state changes


    _firebaseAuth.onAuthStateChanged(user => {


      _currentUser = user;


      if (user) {


        console.log('[Auth] Ingelogd:', user.email);


        hideLoginScreen();


        // Toon gebruiker in instellingen


        const userEl = document.getElementById('authUserInfo');


        if (userEl) {


          userEl.innerHTML = `✅ Ingelogd als <b>${user.displayName || user.email}</b>


            <button onclick="logoutUser()" style="margin-left:.5rem;font-family:'IBM Plex Mono',monospace;font-size:.5rem;padding:2px 8px;border-radius:8px;border:1px solid rgba(220,38,38,.3);background:rgba(220,38,38,.08);color:#dc2626;cursor:pointer;">Uitloggen</button>`;


        }


      } else {


        console.log('[Auth] Niet ingelogd');


        showLoginScreen();


      }


    });


  } catch(e) {


    console.error('[Auth] Init mislukt:', e.message);


    // Geen auth beschikbaar — toon app gewoon


    hideLoginScreen();


  }


}





function showLoginScreen() {


  const ls = document.getElementById('loginScreen');


  const app = document.getElementById('app');


  if (ls) ls.style.display = 'flex';


  if (app) app.style.display = 'none';


}





function hideLoginScreen() {


  const ls = document.getElementById('loginScreen');


  const app = document.getElementById('app');


  if (ls) ls.style.display = 'none';





  // Toon onboarding voor nieuwe gebruikers zonder API keys


  const hasFootballKey = true; // op server


  const hasAnthropicKey = state.settings.anthropicKey;


  const onboardingDone = localStorage.getItem('totoai_onboarding_done');





  if (!onboardingDone && !hasFootballKey && !hasAnthropicKey) {


    const ob = document.getElementById('onboardingScreen');


    if (ob) { ob.style.display = 'block'; return; }


  }


  if (app) app.style.display = 'block';


}





function finishOnboarding() {


  const footballKey = document.getElementById('ob_footballKey')?.value.trim();


  const anthropicKey = document.getElementById('ob_anthropicKey')?.value.trim();





  if (footballKey) {


    state.settings.footballKey = footballKey;


    const el = document.getElementById('settFootballKey');


    if (el) el.value = footballKey;


  }


  if (anthropicKey) {


    state.settings.anthropicKey = anthropicKey;


    const el = document.getElementById('settAnthropicKey');


    if (el) el.value = anthropicKey;


  }





  localStorage.setItem('totoai_onboarding_done', '1');


  saveState();





  const ob = document.getElementById('onboardingScreen');


  if (ob) ob.style.display = 'none';


  const app = document.getElementById('app');


  if (app) app.style.display = 'block';





  if (footballKey || anthropicKey) {


    showAutoCheckBar('✅ Keys opgeslagen! Je kunt nu wedstrijden laden.', 4000);


    setTimeout(() => switchTab('wedstrijden'), 500);


  }


}





function skipOnboarding() {


  localStorage.setItem('totoai_onboarding_done', '1');


  const ob = document.getElementById('onboardingScreen');


  if (ob) ob.style.display = 'none';


  const app = document.getElementById('app');


  if (app) app.style.display = 'block';


  // Stuur door naar instellingen


  setTimeout(() => switchTab('instellingen'), 300);


}





function switchLoginTab(tab) {


  const loginForm = document.getElementById('loginForm');


  const registerForm = document.getElementById('registerForm');


  const loginTab = document.getElementById('loginTabBtn');


  const registerTab = document.getElementById('registerTabBtn');


  if (tab === 'login') {


    loginForm.style.display = 'block';


    registerForm.style.display = 'none';


    loginTab.classList.add('active');


    registerTab.classList.remove('active');


  } else {


    loginForm.style.display = 'none';


    registerForm.style.display = 'block';


    loginTab.classList.remove('active');


    registerTab.classList.add('active');


  }


  document.getElementById('loginError').textContent = '';


}





async function loginWithEmail() {


  const email = document.getElementById('loginEmail').value.trim();


  const password = document.getElementById('loginPassword').value;


  const errEl = document.getElementById('loginError');


  if (!email || !password) { errEl.textContent = 'Vul email en wachtwoord in'; return; }


  try {


    await _firebaseAuth.signInWithEmailAndPassword(email, password);


  } catch(e) {


    const msgs = {


      'auth/user-not-found': 'Geen account gevonden met dit email',


      'auth/wrong-password': 'Verkeerd wachtwoord',


      'auth/invalid-email': 'Ongeldig email adres',


      'auth/too-many-requests': 'Te veel pogingen, probeer later'


    };


    errEl.textContent = msgs[e.code] || e.message;


  }


}





async function registerWithEmail() {


  const name = document.getElementById('registerName').value.trim();


  const email = document.getElementById('registerEmail').value.trim();


  const password = document.getElementById('registerPassword').value;


  const errEl = document.getElementById('loginError');


  if (!email || !password) { errEl.textContent = 'Vul alle velden in'; return; }


  if (password.length < 6) { errEl.textContent = 'Wachtwoord min. 6 tekens'; return; }


  try {


    const cred = await _firebaseAuth.createUserWithEmailAndPassword(email, password);


    if (name) await cred.user.updateProfile({ displayName: name });


  } catch(e) {


    const msgs = {


      'auth/email-already-in-use': 'Email al in gebruik — probeer in te loggen',


      'auth/invalid-email': 'Ongeldig email adres',


      'auth/weak-password': 'Wachtwoord te zwak'


    };


    errEl.textContent = msgs[e.code] || e.message;


  }


}





async function loginWithGoogle() {


  const errEl = document.getElementById('loginError');


  try {


    const provider = new firebase.auth.GoogleAuthProvider();


    await _firebaseAuth.signInWithPopup(provider);


  } catch(e) {


    if (e.code !== 'auth/popup-closed-by-user') {


      errEl.textContent = 'Google login mislukt: ' + e.message;


    }


  }


}





async function logoutUser() {


  try {


    await _firebaseAuth.signOut();


    showAutoCheckBar('👋 Uitgelogd', 2000);


  } catch(e) {}


}


function saveState() {


  localStorage.setItem('totoai_state', JSON.stringify({


    wallet:state.wallet, tracker:state.tracker,


    valueBacktest:state.valueBacktest,


    favoriteComps:state.favoriteComps || [],


    settings:state.settings,


    lastScanResults:state.lastScanResults || []


  }));


  // Auto-sync naar Firebase na elke wijziging (debounced) — altijd, niet alleen met API keys


  scheduleFirebaseSync();


}


function loadState() {


  try {


    const s = JSON.parse(localStorage.getItem('totoai_state') || '{}');


    if (s.wallet) state.wallet = s.wallet;


    if (s.tracker) state.tracker = s.tracker;


    if (s.valueBacktest) state.valueBacktest = s.valueBacktest;


    if (s.favoriteComps) state.favoriteComps = s.favoriteComps;


    if (s.settings) state.settings = { ...state.settings, ...s.settings };


    if (s.lastScanResults) state.lastScanResults = s.lastScanResults;


    if (!state.settings.anthropicKey) { const k = localStorage.getItem('totoai_key_anthropic'); if (k) state.settings.anthropicKey = k; }


    if (!state.settings.footballKey)  { const k = localStorage.getItem('totoai_key_football');  if (k) state.settings.footballKey  = k; }


  } catch(e) {}


}





function exportBackup() {


  const backup = {


    version:'2.3', exportDate:new Date().toISOString(),


    wallet:state.wallet, tracker:state.tracker,


    valueBacktest:state.valueBacktest,


    settings: {


      defaultComp:state.settings.defaultComp,


      startBalance:state.settings.startBalance,


      defaultBet:state.settings.defaultBet,


      notifThreshold:state.settings.notifThreshold,


    tripleMinOdds:state.settings.tripleMinOdds,


    autoDark:state.settings.autoDark,


    _preAutoDarkTheme:state.settings._preAutoDarkTheme


    }


  };


  const blob = new Blob([JSON.stringify(backup,null,2)], {type:'application/json'});


  const url = URL.createObjectURL(blob);


  const a = document.createElement('a');


  const datum = new Date().toLocaleDateString('nl-NL').replace(/\//g,'-');


  a.href = url; a.download = `totoai-backup-${datum}.json`; a.click();


  URL.revokeObjectURL(url);


  showBackupStatus('✅ Gedownload!', '#16a34a');


}





function importBackup(event) {


  const file = event.target.files[0];


  if (!file) return;


  const reader = new FileReader();


  reader.onload = (e) => {


    try {


      const b = JSON.parse(e.target.result);


      if (!b.version || !b.wallet) { showBackupStatus('⚠ Ongeldig bestand', '#dc2626'); return; }


      if (!confirm(`Back-up van ${new Date(b.exportDate).toLocaleDateString('nl-NL')} importeren?`)) return;


      if (b.wallet) state.wallet = b.wallet;


      if (b.tracker) state.tracker = b.tracker;


      if (b.valueBacktest) state.valueBacktest = b.valueBacktest;


      if (b.settings) Object.assign(state.settings, b.settings);


      saveState(); applySettings(); updateWalletUI();


      showBackupStatus(`✅ Hersteld! ${b.wallet.bets?.length||0} weddenschappen`, '#16a34a');


    } catch(err) { showBackupStatus('⚠ Fout: '+err.message,'#dc2626'); }


    event.target.value = '';


  };


  reader.readAsText(file);


}





function showBackupStatus(msg, color) {


  const el = document.getElementById('backupStatus');


  if (!el) return;


  el.style.display = 'block';


  el.style.color = color;


  el.style.background = color === '#16a34a' ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.08)';


  el.style.border = `1px solid ${color}33`;


  el.textContent = msg;


  setTimeout(() => el.style.display = 'none', 5000);


}





// ═══════════════════════════════════════════════════════


// WALLET CHART


// ═══════════════════════════════════════════════════════


let chartView = 'saldo';


let chartSource = 'all';





function setChartSource(src) {


  chartSource = src;


  document.querySelectorAll('[id^="cs-"]').forEach(b => b.classList.remove('active'));


  const el = document.getElementById('cs-' + src);


  if (el) el.classList.add('active');


  renderWalletChart();


}


function setChartView(v) {


  chartView = v;


  ['saldo','pnl'].forEach(x => {


    const b = document.getElementById('cv-' + x);


    if (!b) return;


    if (x === v) { b.style.background = 'rgba(219,39,119,.1)'; b.style.borderColor = 'rgba(219,39,119,.4)'; b.style.color = '#be185d'; }


    else { b.style.background = 'transparent'; b.style.borderColor = 'rgba(15,23,42,.12)'; b.style.color = '#475569'; }


  });


  renderWalletChart();


}





function renderWalletChart() {


  const canvas = document.getElementById('walletChart');


  const emptyEl = document.getElementById('chartEmpty');


  if (!canvas) return;


  const sb = state.settings.startBalance || 500;


  const allSettled = [...state.wallet.bets].reverse().filter(b => b.status !== 'pending');


  const settled = chartSource === 'all' ? allSettled : allSettled.filter(b => (b.source||'eigen') === chartSource);


  if (!settled.length) {


    canvas.style.display = 'none';


    if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = chartSource === 'all' ? 'Nog geen afgeronde weddenschappen' : 'Geen bets voor deze bron'; }


    return;


  }


  canvas.style.display = 'block';


  if (emptyEl) emptyEl.style.display = 'none';





  let running = sb;


  const points = [{value: chartView === 'saldo' ? sb : 0, result:'start'}];


  settled.forEach(b => {


    if (b.status === 'win') running += (b.payout - b.amount);


    else running -= b.amount;


    points.push({value: chartView === 'saldo' ? running : running - sb, result:b.status});


  });





  const dpr = window.devicePixelRatio || 1;


  const W = canvas.parentElement.clientWidth - 32;


  const H = 140;


  canvas.width = W * dpr; canvas.height = H * dpr;


  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';


  const ctx = canvas.getContext('2d');


  ctx.scale(dpr, dpr);


  ctx.clearRect(0, 0, W, H);





  const vals = points.map(p => p.value);


  const minV = Math.min(...vals), maxV = Math.max(...vals);


  const range = maxV - minV || 1;


  const pad = {top:16, bottom:20, left:44, right:10};


  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;


  const xP = i => pad.left + (i / Math.max(points.length-1,1)) * cw;


  const yP = v => pad.top + ch - ((v - minV) / range) * ch;





  const baseY = yP(chartView === 'pnl' ? 0 : sb);


  ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(15,23,42,.1)'; ctx.lineWidth = 1;


  ctx.beginPath(); ctx.moveTo(pad.left, baseY); ctx.lineTo(pad.left + cw, baseY); ctx.stroke();


  ctx.setLineDash([]);





  const lastVal = points[points.length-1].value;


  const isPos = chartView === 'pnl' ? lastVal >= 0 : lastVal >= sb;


  const color = isPos ? '#16a34a' : '#dc2626';





  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);


  grad.addColorStop(0, isPos ? 'rgba(22,163,74,.22)' : 'rgba(220,38,38,.18)');


  grad.addColorStop(1, 'rgba(255,255,255,0)');


  ctx.beginPath();


  ctx.moveTo(xP(0), yP(points[0].value));


  points.forEach((p,i) => { if (i>0) ctx.lineTo(xP(i), yP(p.value)); });


  ctx.lineTo(xP(points.length-1), H - pad.bottom);


  ctx.lineTo(xP(0), H - pad.bottom);


  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();





  ctx.beginPath();


  ctx.moveTo(xP(0), yP(points[0].value));


  points.forEach((p,i) => { if (i>0) ctx.lineTo(xP(i), yP(p.value)); });


  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();





  points.forEach((p,i) => {


    ctx.beginPath(); ctx.arc(xP(i), yP(p.value), 4, 0, Math.PI*2);


    ctx.fillStyle = p.result === 'win' ? '#16a34a' : p.result === 'lose' ? '#dc2626' : '#7c3aed';


    ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();


  });





  ctx.fillStyle = '#94a3b8'; ctx.font = '9px IBM Plex Mono, monospace'; ctx.textAlign = 'right';


  [minV, maxV].forEach(v => ctx.fillText('€' + Math.round(v), pad.left - 4, yP(v) + 3));





  ctx.fillStyle = color; ctx.font = 'bold 10px IBM Plex Mono, monospace';


  ctx.fillText((lastVal>=0?'+':'') + '€' + Math.round(lastVal), xP(points.length-1), yP(lastVal) - 8);


}





// ═══════════════════════════════════════════════════════


// COMPETITIE DETAIL MODAL — JavaScript


// Plak dit in het script-blok van index.html


// ═══════════════════════════════════════════════════════





let _cdComp = null;


let _cdTab = 'stand';


let _cdData = {};


let _cdScanResults = [];





const COMP_FLAGS = {


  eredivisie:'🇳🇱', kkd:'🇳🇱', beker:'🏆', premier:'🏴',


  bundesliga:'🇩🇪', ligue1:'🇫🇷', seriea:'🇮🇹',


  champions:'⭐', nations:'🌍', jupiler:'🇧🇪',


  laliga:'🇪🇸', superlig:'🇹🇷', wk2026:'🏆'


};


const COMP_FULL_NAMES = {


  eredivisie:'Eredivisie', kkd:'Keuken Kampioen Divisie',


  beker:'KNVB Beker', premier:'Premier League',


  bundesliga:'Bundesliga', ligue1:'Ligue 1',


  seriea:'Serie A', champions:'Champions League',


  nations:'Nations League', jupiler:'Jupiler Pro League',


  laliga:'La Liga', superlig:'Süper Lig', wk2026:'WK 2026'


};





async function openCompDetail(comp) {


  _cdComp = comp;


  _cdTab = 'stand';


  _cdScanResults = [];


  const modal = document.getElementById('compDetailModal');


  modal.classList.add('open');


  document.body.style.overflow = 'hidden';


  document.getElementById('cd-flag').textContent = COMP_FLAGS[comp] || '🏆';


  document.getElementById('cd-title').textContent = COMP_FULL_NAMES[comp] || comp;


  document.getElementById('cd-subtitle').textContent = 'Seizoen 2025/26';


  // Reset tab buttons


  document.querySelectorAll('.cd-tab').forEach(b => b.classList.remove('active'));


  document.getElementById('cdt-stand')?.classList.add('active');


  setCDTab('stand');


}





function closeCompDetail() {


  document.getElementById('compDetailModal').classList.remove('open');


  document.body.style.overflow = '';


}





function setCDTab(tab) {


  _cdTab = tab;


  document.querySelectorAll('.cd-tab').forEach(b => b.classList.remove('active'));


  document.getElementById('cdt-' + tab)?.classList.add('active');


  renderCDTab(tab);


}





async function renderCDTab(tab) {


  const body = document.getElementById('cd-body');


  body.innerHTML = '<div class="cd-loading"><div class="cd-spinner"></div><br>Laden...</div>';


  if (tab === 'stand')            await renderCDStand();


  else if (tab === 'wedstrijden') await renderCDWedstrijden();


  else if (tab === 'scan')        await renderCDScan();


  else if (tab === 'topscorers')  await renderCDTopscorers();


}





// ── STAND ─────────────────────────────────────────────


async function renderCDStand() {


  const body = document.getElementById('cd-body');


  const apiKey = null; // key op server


  const leagueId = COMP_IDS[_cdComp];


  if (!apiKey || !leagueId) {


    // key op server — doorgaan


  }





  const cacheKey = 'stand_' + _cdComp;


  if (!_cdData[cacheKey]) {


    try {


      const r = await apiFetch(


        'https://v3.football.api-sports.io/standings?league=' + leagueId + '&season=2025',


        apiKey, 8000


      );


      const d = await r.json();


      _cdData[cacheKey] = d.response?.[0]?.league?.standings?.[0] || [];


    } catch(e) {


      body.innerHTML = '<div class="cd-loading">⚠ ' + e.message + '</div>'; return;


    }


  }





  const standings = _cdData[cacheKey];


  if (!standings.length) {


    body.innerHTML = '<div class="cd-loading">Geen standgegevens beschikbaar voor dit seizoen</div>'; return;


  }





  const total = standings.length;


  const rankClass = (rank) => {


    if (rank === 1) return 'champion';


    if (rank <= 4) return 'cl';


    if (rank <= 6) return 'uel';


    if (rank > total - 3) return 'rel';


    return '';


  };


  const rankBorder = (rc) => {


    if (rc === 'champion') return 'border-left:3px solid #d97706;';


    if (rc === 'cl')       return 'border-left:3px solid #2563eb;';


    if (rc === 'uel')      return 'border-left:3px solid #ea580c;';


    if (rc === 'rel')      return 'border-left:3px solid #dc2626;';


    return '';


  };





  const rows = standings.map(t => {


    const rc = rankClass(t.rank);


    const form = (t.form || '').slice(-5);


    const formDots = form.split('').map(f =>


      '<div class="st-form-dot ' + f + '"></div>'


    ).join('');


    return `


      <div class="cd-standings-row" style="${rankBorder(rc)}" onclick="filterMatchesByTeam('${t.team.name.replace(/'/g,"\\'")}')">


        <div class="st-rank ${rc}">${t.rank}</div>


        <div class="st-team">


          ${t.team.logo ? `<img src="${t.team.logo}" class="st-team-logo" onerror="this.style.display='none'">` : ''}


          <span class="st-team-name">${t.team.name}</span>


        </div>


        <div class="st-num">${t.all.played}</div>


        <div class="st-num" style="color:#16a34a;">${t.all.win}</div>


        <div class="st-num" style="color:#d97706;">${t.all.draw}</div>


        <div class="st-num" style="color:#dc2626;">${t.all.lose}</div>


        <div class="st-pts">${t.points}</div>


      </div>`;


  }).join('');





  body.innerHTML = `


    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem;padding:.5rem .75rem;


      background:rgba(255,255,255,.7);border-radius:10px;border:1px solid var(--stroke);">


      <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;display:flex;align-items:center;gap:.3rem;">


        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#d97706;"></span>Kampioen


      </span>


      <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;display:flex;align-items:center;gap:.3rem;">


        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#2563eb;"></span>CL


      </span>


      <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;display:flex;align-items:center;gap:.3rem;">


        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ea580c;"></span>EL/ECL


      </span>


      <span style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;display:flex;align-items:center;gap:.3rem;">


        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#dc2626;"></span>Degradatie


      </span>


    </div>


    <div class="cd-standings">


      <div class="cd-standings-header">


        <div>#</div><div>Team</div>


        <div title="Gespeeld">G</div>


        <div title="Winst" style="color:#16a34a;">W</div>


        <div title="Gelijk" style="color:#d97706;">G</div>


        <div title="Verlies" style="color:#dc2626;">V</div>


        <div title="Punten">Pts</div>


      </div>


      ${rows}


    </div>


    <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;margin-top:.4rem;">


      Tik op een team → filter wedstrijden


    </div>


  `;


}





// ── WEDSTRIJDEN ────────────────────────────────────────


async function renderCDWedstrijden() {


  const body = document.getElementById('cd-body');


  const apiKey = null; // key op server


  const leagueId = COMP_IDS[_cdComp];


  if (!apiKey || !leagueId) {


    // key op server — doorgaan


  }





  const cacheKey = 'matches_' + _cdComp;


  if (!_cdData[cacheKey]) {


    try {


      const today = new Date().toISOString().split('T')[0];


      const nextWeek = new Date(Date.now() + 14*86400000).toISOString().split('T')[0];


      const r = await apiFetch(


        'https://v3.football.api-sports.io/fixtures?league=' + leagueId + '&season=2025&from=' + today + '&to=' + nextWeek,


        apiKey, 8000


      );


      const d = await r.json();


      _cdData[cacheKey] = (d.response || []).slice(0, 20);


    } catch(e) {


      body.innerHTML = '<div class="cd-loading">⚠ ' + e.message + '</div>'; return;


    }


  }





  const fixtures = _cdData[cacheKey];


  if (!fixtures.length) {


    body.innerHTML = '<div class="cd-loading">Geen aankomende wedstrijden</div>'; return;


  }





  // Quotes ophalen


  const oddsMap = {};


  try {


    await Promise.all(fixtures.slice(0,8).map(async f => {


      try {


        const r = await apiFetch('https://v3.football.api-sports.io/odds?fixture=' + f.fixture.id, apiKey, 4000);


        const d = await r.json();


        if (!d.response?.[0]) return;


        for (const bm of (d.response[0].bookmakers || [])) {


          const mw = bm.bets?.find(b => b.name === 'Match Winner');


          if (!mw?.values?.length) continue;


          const h  = parseFloat(mw.values.find(v => v.value === 'Home')?.odd  || mw.values[0]?.odd);


          const dr = parseFloat(mw.values.find(v => v.value === 'Draw')?.odd  || mw.values[1]?.odd);


          const a  = parseFloat(mw.values.find(v => v.value === 'Away')?.odd  || mw.values[2]?.odd);


          if (h > 1 && dr > 1 && a > 1) {


            oddsMap[f.fixture.id] = { h, dr, a, bm: bm.name };


            break;


          }


        }


      } catch(e) {}


    }));


  } catch(e) {}





  const cards = fixtures.map(f => {


    const o = oddsMap[f.fixture.id];


    const dt = new Date(f.fixture.date);


    const dateStr = dt.toLocaleDateString('nl-NL', {weekday:'short', day:'numeric', month:'short'});


    const timeStr = dt.toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Amsterdam'});


    const isLive = ['1H','HT','2H','ET'].includes(f.fixture.status.short);


    const isDone = ['FT','AET','PEN'].includes(f.fixture.status.short);


    const statusHtml = isLive


      ? `<span class="cd-match-status" style="background:rgba(220,38,38,.1);color:#dc2626;border:1px solid rgba(220,38,38,.25);">🔴 LIVE${f.fixture.status.elapsed ? ' '+f.fixture.status.elapsed+"'" : ''}</span>`


      : isDone


        ? `<span class="cd-match-status" style="background:rgba(71,85,105,.07);color:var(--sub);border:1px solid var(--stroke);">GESPEELD</span>`


        : `<span class="cd-match-status" style="background:rgba(124,58,237,.1);color:#7c3aed;border:1px solid rgba(124,58,237,.25);">📅 GEPLAND</span>`;


    const scoreHtml = (isLive || isDone) && f.goals.home != null


      ? `${f.goals.home}-${f.goals.away}` : 'VS';


    const fid = f.fixture.id;


    const hn = f.teams.home.name.replace(/'/g,"\\'");


    const an = f.teams.away.name.replace(/'/g,"\\'");


    const oddsHtml = o ? `


      <div class="cd-odds-row">


        <div class="cd-odds-btn" onclick="handleCDOddsBet(${fid},'1','${hn} wint',${o.h})">


          <span class="cd-odds-lbl">1 THUIS</span>


          <span class="cd-odds-val">${o.h.toFixed(2)}</span>


        </div>


        <div class="cd-odds-btn" onclick="handleCDOddsBet(${fid},'X','Gelijkspel',${o.dr})">


          <span class="cd-odds-lbl">X GELIJK</span>


          <span class="cd-odds-val">${o.dr.toFixed(2)}</span>


        </div>


        <div class="cd-odds-btn" onclick="handleCDOddsBet(${fid},'2','${an} wint',${o.a})">


          <span class="cd-odds-lbl">2 UIT</span>


          <span class="cd-odds-val">${o.a.toFixed(2)}</span>


        </div>


      </div>` : `<div style="padding:.35rem .75rem .5rem;font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);">Geen quotes beschikbaar</div>`;


    return `


      <div class="cd-match-card">


        <div class="cd-match-top">


          <span class="cd-match-date">${dateStr} · ${timeStr}</span>


          ${statusHtml}


        </div>


        <div class="cd-match-teams">


          <div class="cd-team">


            ${f.teams.home.logo ? `<img src="${f.teams.home.logo}" style="width:24px;height:24px;object-fit:contain;display:block;margin-bottom:3px;" onerror="this.style.display='none'">` : ''}


            <div class="cd-team-name">${f.teams.home.name}</div>


          </div>


          <div class="cd-score">${scoreHtml}</div>


          <div class="cd-team away">


            ${f.teams.away.logo ? `<img src="${f.teams.away.logo}" style="width:24px;height:24px;object-fit:contain;display:block;margin-bottom:3px;margin-left:auto;" onerror="this.style.display='none'">` : ''}


            <div class="cd-team-name">${f.teams.away.name}</div>


          </div>


        </div>


        ${oddsHtml}


      </div>`;


  }).join('');





  body.innerHTML = `<div class="cd-section">Aankomende wedstrijden</div>${cards}`;


}





// ── SCAN ───────────────────────────────────────────────


async function renderCDScan() {


  const body = document.getElementById('cd-body');


  if (_cdScanResults.length) { renderCDScanResults(); return; }


  body.innerHTML = `


    <div class="cd-section">Value Scan</div>


    <div style="background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.2);border-radius:12px;


      padding:.8rem 1rem;margin-bottom:.8rem;font-family:'IBM Plex Mono',monospace;


      font-size:.58rem;color:#15803d;line-height:1.7;">


      Scan alle aankomende wedstrijden in <b>${COMP_FULL_NAMES[_cdComp]||_cdComp}</b> op value.<br>


      Picks met ≥5% worden opgeslagen in de Backtest.


    </div>


    <button class="cd-scan-btn" id="cdScanBtn" onclick="runCDScan()">


      ⚡ SCAN ALLE WEDSTRIJDEN


    </button>


    <div id="cdScanStatus" style="display:none;font-family:'IBM Plex Mono',monospace;font-size:.6rem;


      color:var(--sub);text-align:center;padding:.5rem;"></div>


    <div id="cdScanList"></div>


  `;


}





async function runCDScan() {


  const btn = document.getElementById('cdScanBtn');


  const status = document.getElementById('cdScanStatus');


  if (!state.settings.anthropicKey) {


    if (status) { status.style.display = 'block'; status.textContent = '⚠ Anthropic key nodig in ⚙️ Instellingen'; } return;


  }


  if (btn) { btn.disabled = true; btn.textContent = '⟳ Data ophalen...'; }


  if (status) status.style.display = 'block';





  // Laad wedstrijden als nog niet gecached


  const cacheKey = 'matches_' + _cdComp;


  if (!_cdData[cacheKey]) {


    if (status) status.textContent = '⟳ Wedstrijden laden...';


    try {


      const leagueId = COMP_IDS[_cdComp];


      const today = new Date().toISOString().split('T')[0];


      const nextWeek = new Date(Date.now() + 14*86400000).toISOString().split('T')[0];


      const r = await apiFetch(


        'https://v3.football.api-sports.io/fixtures?league=' + leagueId + '&season=2025&from=' + today + '&to=' + nextWeek,


        null, 8000


      );


      const d = await r.json();


      _cdData[cacheKey] = (d.response || []).slice(0, 20);


    } catch(e) {


      if (status) status.textContent = '⚠ ' + e.message;


      if (btn) { btn.disabled = false; btn.textContent = '⚡ OPNIEUW PROBEREN'; }


      return;


    }


  }





  const fixtures = _cdData[cacheKey].filter(f => !['FT','AET','PEN'].includes(f.fixture.status.short));


  if (!fixtures.length) {


    if (status) status.textContent = '⚠ Geen aankomende wedstrijden';


    if (btn) { btn.disabled = false; btn.textContent = '⚡ SCAN ALLE WEDSTRIJDEN'; }


    return;


  }





  // Sla huidige state op, vervang tijdelijk met detail matches


  const prevMatches = state.matches;


  const prevComp = state.activeComp;


  state.matches = fixtures.map(f => parseAPIMatch(f));


  state.activeComp = _cdComp;





  // Quotes ophalen


  if (status) status.textContent = '⟳ Quotes ophalen (' + state.matches.length + ' wedstrijden)...';


  try { await fetchOddsForMatches(COMP_IDS[_cdComp], null); } catch(e) {}





  const withOdds = state.matches.filter(m => m.homeOdds !== '—' && parseFloat(m.homeOdds) > 1);


  if (!withOdds.length) {


    if (status) status.textContent = '⚠ Geen quotes beschikbaar — gratis API plan heeft beperkte odds';


    if (btn) { btn.disabled = false; btn.textContent = '⚡ OPNIEUW PROBEREN'; }


    state.matches = prevMatches; state.activeComp = prevComp;


    return;


  }





  if (status) status.textContent = '⟳ AI scant ' + withOdds.length + ' wedstrijden...';


  try {


    await scanValueAll();


    _cdScanResults = state.valueScans || [];


  } catch(e) {


    if (status) status.textContent = '⚠ Scan fout: ' + e.message;


  }





  state.matches = prevMatches;


  state.activeComp = prevComp;


  renderCDScanResults();


}





function renderCDScanResults() {


  const body = document.getElementById('cd-body');


  const results = _cdScanResults;


  if (!results.length) {


    body.innerHTML = '<div class="cd-loading">Geen value picks gevonden in deze scan</div>'; return;


  }


  const sorted = [...results].sort((a,b) => (b.value||0) - (a.value||0));


  const valueCount = sorted.filter(s => (s.value||0) >= 5).length;


  const html = sorted.map(s => {


    const val = s.value || 0;


    const cls = val >= 15 ? 'pos' : val >= 5 ? 'med' : 'neg';


    const sign = val > 0 ? '+' : '';


    return `


      <div class="cd-scan-result" onclick="openValueAnalysis('${s.match?.id||s.id}');closeCompDetail()">


        <div class="cd-scan-result-info">


          <div class="cd-scan-result-match">${s.match?.home||'?'} vs ${s.match?.away||'?'}</div>


          <div class="cd-scan-result-pick">${s.pickLabel||'?'} @ ${(s.odds||0).toFixed(2)} · 🎲 ${s.confidence||'?'}/10 · ½K ${(s.kelly||0).toFixed(1)}%</div>


        </div>


        <div class="cd-scan-result-value ${cls}">${sign}${Math.round(val)}%</div>


      </div>`;


  }).join('');





  body.innerHTML = `


    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">


      <div class="cd-section" style="margin:0;">${results.length} gescand · ${valueCount} value picks</div>


      <button onclick="_cdScanResults=[];renderCDScan()" style="font-family:'IBM Plex Mono',monospace;


        font-size:.5rem;padding:3px 10px;border-radius:999px;cursor:pointer;


        border:1px solid var(--stroke);background:transparent;color:var(--sub);">


        🔄 Opnieuw


      </button>


    </div>


    ${html}


    <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;margin-top:.5rem;">


      Tik op een pick voor volledige analyse


    </div>


  `;


}





// ── TOPSCORERS ─────────────────────────────────────────


async function renderCDTopscorers() {


  const body = document.getElementById('cd-body');


  const apiKey = null; // key op server


  const leagueId = COMP_IDS[_cdComp];


  if (!apiKey || !leagueId) {


    // key op server — doorgaan


  }





  const cacheKey = 'scorers_' + _cdComp;


  if (!_cdData[cacheKey]) {


    try {


      const r = await apiFetch(


        'https://v3.football.api-sports.io/players/topscorers?league=' + leagueId + '&season=2025',


        apiKey, 8000


      );


      const d = await r.json();


      _cdData[cacheKey] = (d.response || []).slice(0, 20);


    } catch(e) {


      body.innerHTML = '<div class="cd-loading">⚠ ' + e.message + '</div>'; return;


    }


  }





  const scorers = _cdData[cacheKey];


  if (!scorers.length) {


    body.innerHTML = '<div class="cd-loading">Geen topscorers beschikbaar</div>'; return;


  }





  const rankColors = ['gold','silver','bronze'];


  const rows = scorers.map((s, i) => {


    const st = s.statistics[0];


    const goals = st.goals?.total || 0;


    const assists = st.goals?.assists || 0;


    const rating = parseFloat(st.games?.rating || 0).toFixed(1);


    return `


      <div class="cd-scorer-row">


        <div class="cd-scorer-rank ${rankColors[i]||''}">${i+1}</div>


        ${s.player.photo ? `<img src="${s.player.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ''}


        <div class="cd-scorer-info">


          <div class="cd-scorer-name">${s.player.name}${s.player.injured ? ' 🤕' : ''}</div>


          <div class="cd-scorer-club">${st.team?.name||''} · ⭐ ${rating}</div>


        </div>


        <div style="text-align:right;">


          <div class="cd-scorer-goals">${goals}</div>


          <div class="cd-scorer-assists">${assists} assist</div>


        </div>


      </div>`;


  }).join('');





  // Top assists


  const topAssists = [...scorers]


    .sort((a,b) => (b.statistics[0].goals?.assists||0) - (a.statistics[0].goals?.assists||0))


    .slice(0,5);


  const assistRows = topAssists.map((s,i) => {


    const st = s.statistics[0];


    return `


      <div class="cd-scorer-row">


        <div class="cd-scorer-rank ${rankColors[i]||''}">${i+1}</div>


        ${s.player.photo ? `<img src="${s.player.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ''}


        <div class="cd-scorer-info">


          <div class="cd-scorer-name">${s.player.name}</div>


          <div class="cd-scorer-club">${st.team?.name||''}</div>


        </div>


        <div style="text-align:right;">


          <div class="cd-scorer-goals" style="color:#2563eb;">${st.goals?.assists||0}</div>


          <div class="cd-scorer-assists">assists</div>


        </div>


      </div>`;


  }).join('');





  body.innerHTML = `


    <div class="cd-section">Topscorers</div>


    ${rows}


    <div class="cd-section">Top Assists</div>


    ${assistRows}


  `;


}





// ── ACTIES ─────────────────────────────────────────────


function handleCDOddsBet(fixtureId, pick, pickLabel, odds) {


  let match = state.matches.find(m => String(m.id) === String(fixtureId));


  if (!match) {


    const cached = (_cdData['matches_' + _cdComp] || []).find(f => String(f.fixture.id) === String(fixtureId));


    if (cached) match = parseAPIMatch(cached);


  }


  if (!match) { alert('Wedstrijd niet gevonden — laad eerst de competitie'); return; }


  closeCompDetail();


  setTimeout(() => {


    pendingBet = { match, pick, pickLabel, odds: parseFloat(odds), markt: '1X2',


      _origPick: pick, _origPickLabel: pickLabel, _origOdds: parseFloat(odds) };


    document.getElementById('modalMatchName').textContent = match.home + ' vs ' + match.away;


    document.getElementById('modalPickInfo').textContent = 'Keuze: ' + pick + ' — ' + pickLabel + ' @ ' + odds;


    document.getElementById('modalBetInput').value = state.settings.defaultBet || 10;


    document.getElementById('marketPickRow').style.display = 'none';


    document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));


    document.getElementById('mb-1X2')?.classList.add('active');


    updatePayoutPreview();


    document.getElementById('betModal').classList.add('show');


  }, 300);


}





function filterMatchesByTeam(teamName) {


  closeCompDetail();


  switchTab('wedstrijden');


  setTimeout(() => {


    const norm = teamName.toLowerCase().substring(0,5);


    const found = state.matches.find(m =>


      m.home.toLowerCase().includes(norm) || m.away.toLowerCase().includes(norm)


    );


    if (found) {


      const el = document.getElementById('match-' + found.id);


      if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });


    } else {


      // Team niet in huidige lijst — selecteer comp en laad


      selectComp(_cdComp);


    }


  }, 400);


}








// ═══════════════════════════════════════════════════════


// SERVICE WORKER + DARK MODE


// ═══════════════════════════════════════════════════════


function registerSW() {


  if (!('serviceWorker' in navigator)) return;


  const APP_VERSION = 'v11.73';


  const storedVersion = localStorage.getItem('totoai_version');





  // Versie gewijzigd: verwijder alle oude SW caches en herregistreer


  if (storedVersion && storedVersion !== APP_VERSION) {


    navigator.serviceWorker.getRegistrations().then(regs => {


      regs.forEach(r => r.unregister());


    });


    if ('caches' in window) {


      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));


    }


    localStorage.setItem('totoai_version', APP_VERSION);


    console.log('[App] Versie gewijzigd — SW en cache gewist, herlaad...');


    setTimeout(() => location.reload(), 800);


    return;


  }


  localStorage.setItem('totoai_version', APP_VERSION);





   navigator.serviceWorker.register('/worker.js?v=71', {scope:'/', updateViaCache:'none'})


    .then(reg => {


      reg.update();


      console.log('[App] SW geregistreerd v' + APP_VERSION);


    }).catch(() => {});


}





// ═══════════════════════════════════════════════════════


// THEMA SYSTEEM — 4 thema's: licht / mint / crème / donker


// ═══════════════════════════════════════════════════════


const THEMES = ['light', 'mint', 'cream', 'dark'];


const THEME_ICONS = { light: '🌙', mint: '🌿', cream: '🍶', dark: '☀️' };


const THEME_NAMES = { light: 'Licht', mint: 'Mint', cream: 'Crème', dark: 'Donker' };





function cycleTheme() {


  const current = localStorage.getItem('totoai_theme') || 'mint';


  const idx = THEMES.indexOf(current);


  const next = THEMES[(idx + 1) % THEMES.length];


  localStorage.setItem('totoai_theme', next);


  applyTheme();


  // Kort popup-label zodat je weet welk thema nu actief is


  showThemeHint(next);


}





function applyTheme() {


  let theme = localStorage.getItem('totoai_theme') || migrateOldDarkPref();


  // Eerste keer: detecteer systeem voorkeur


  if (!localStorage.getItem('totoai_theme')) {


    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {


      theme = 'dark';


      localStorage.setItem('totoai_theme', 'dark');


    }


  }


  document.body.classList.remove('dark', 'mint', 'cream');


  if (theme === 'dark') document.body.classList.add('dark');


  else if (theme === 'mint') document.body.classList.add('mint');


  else if (theme === 'cream') document.body.classList.add('cream');


  // light = standaard (geen class)





  // Update icoon — toont het VOLGENDE thema als hint van wat je krijgt bij klik


  const btn = document.getElementById('themeToggle');


  if (btn) {


    const idx = THEMES.indexOf(theme);


    const next = THEMES[(idx + 1) % THEMES.length];


    btn.textContent = THEME_ICONS[next];


    btn.title = `Huidig: ${THEME_NAMES[theme]} — tik voor ${THEME_NAMES[next]}`;


  }


}





/** Migreer oude dark-only setting naar nieuwe 4-themas systeem */


function migrateOldDarkPref() {


  const oldDark = localStorage.getItem('totoai_dark');


  if (oldDark === '1') {


    localStorage.setItem('totoai_theme', 'dark');


    localStorage.removeItem('totoai_dark');


    return 'dark';


  }


  // Migratie: bestaande gebruikers met 'light' upgraden naar 'mint'


  // Eenmalig — als 'totoai_migrated_mint' nog niet gezet is


  const current = localStorage.getItem('totoai_theme');


  if (current === 'light' && !localStorage.getItem('totoai_migrated_mint')) {


    localStorage.setItem('totoai_theme', 'mint');


    localStorage.setItem('totoai_migrated_mint', '1');


    return 'mint';


  }


  return 'mint';


}





function showThemeHint(theme) {


  let hint = document.getElementById('themeHint');


  if (!hint) {


    hint = document.createElement('div');


    hint.id = 'themeHint';


    hint.style.cssText = `


      position:fixed;top:70px;right:12px;


      background:var(--card);border:1px solid var(--stroke);


      border-radius:10px;padding:.5rem .9rem;


      font-family:'IBM Plex Mono',monospace;font-size:.65rem;font-weight:700;


      color:var(--ink);box-shadow:var(--shadow2);backdrop-filter:blur(10px);


      z-index:10000;opacity:0;transition:opacity .2s;pointer-events:none;


      letter-spacing:.04em;white-space:nowrap;


    `;


    document.body.appendChild(hint);


  }


  hint.textContent = `${THEME_ICONS[theme]} ${THEME_NAMES[theme]}`;


  requestAnimationFrame(() => { hint.style.opacity = '1'; });


  clearTimeout(window._themeHintTimer);


  window._themeHintTimer = setTimeout(() => { hint.style.opacity = '0'; }, 1400);


}