// WK2026.JS — v21.0
// WK 2026 Voorspelling — Claude analyseert alle 48 teams

const WK_CACHE_KEY = 'totoai_wk2026_prediction';
const WK_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 uur

// ── 48 WK teams met groepen ──────────────────────────────
const WK_GROUPS = {
  'A': ['Verenigde Staten', 'Panama', 'Honduras', 'Jamaica'],
  'B': ['Mexico', 'Canada', 'Guatemala', 'Suriname'],
  'C': ['Argentinië', 'Peru', 'Ecuador', 'Venezuela'],
  'D': ['Brazilië', 'Uruguay', 'Colombia', 'Bolivia'],
  'E': ['Spanje', 'Portugal', 'Ierland', 'Finland'],
  'F': ['Engeland', 'Nederland', 'Tsjechië', 'Slowakije'],
  'G': ['Duitsland', 'Oostenrijk', 'Zweden', 'Zwitserland'],
  'H': ['Frankrijk', 'België', 'Turkije', 'Noorwegen'],
  'I': ['Marokko', 'Senegal', 'Algerije', 'Mali'],
  'J': ['Nigeria', 'Ivoorkust', 'Zuid-Afrika', 'Tunesië'],
  'K': ['Japan', 'Zuid-Korea', 'Iran', 'Australië'],
  'L': ['Saoedi-Arabië', 'Qatar', 'Jordanië', 'Irak'],
};

const TEAM_FLAGS = {
  'Verenigde Staten':'🇺🇸','Panama':'🇵🇦','Honduras':'🇭🇳','Jamaica':'🇯🇲',
  'Mexico':'🇲🇽','Canada':'🇨🇦','Guatemala':'🇬🇹','Suriname':'🇸🇷',
  'Argentinië':'🇦🇷','Peru':'🇵🇪','Ecuador':'🇪🇨','Venezuela':'🇻🇪',
  'Brazilië':'🇧🇷','Uruguay':'🇺🇾','Colombia':'🇨🇴','Bolivia':'🇧🇴',
  'Spanje':'🇪🇸','Portugal':'🇵🇹','Ierland':'🇮🇪','Finland':'🇫🇮',
  'Engeland':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Nederland':'🇳🇱','Tsjechië':'🇨🇿','Slowakije':'🇸🇰',
  'Duitsland':'🇩🇪','Oostenrijk':'🇦🇹','Zweden':'🇸🇪','Zwitserland':'🇨🇭',
  'Frankrijk':'🇫🇷','België':'🇧🇪','Turkije':'🇹🇷','Noorwegen':'🇳🇴',
  'Marokko':'🇲🇦','Senegal':'🇸🇳','Algerije':'🇩🇿','Mali':'🇲🇱',
  'Nigeria':'🇳🇬','Ivoorkust':'🇨🇮','Zuid-Afrika':'🇿🇦','Tunesië':'🇹🇳',
  'Japan':'🇯🇵','Zuid-Korea':'🇰🇷','Iran':'🇮🇷','Australië':'🇦🇺',
  'Saoedi-Arabië':'🇸🇦','Qatar':'🇶🇦','Jordanië':'🇯🇴','Irak':'🇮🇶',
};

// ── Render WK scherm ─────────────────────────────────────
function renderWK2026Screen() {
  const el = document.getElementById('screen-wk2026');
  if (!el) return;

  el.innerHTML = `
    <div style="padding:.75rem .9rem 5rem;max-width:420px;margin:0 auto;">

      <!-- Header -->
      <div style="margin-bottom:1rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;
          background:linear-gradient(135deg,#dc2626,#be185d,#7c3aed);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          letter-spacing:.03em;">🏆 WK 2026</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);margin-top:.1rem;">
          AI VOORSPELLING · 48 TEAMS · 104 WEDSTRIJDEN
        </div>
      </div>

      <!-- Tabs rij 1 -->
      <div style="display:flex;gap:.4rem;margin-bottom:.4rem;">
        <button onclick="switchWKTab('picks')" id="wk-tab-picks"
          style="flex:1;padding:.4rem;border-radius:10px;border:1px solid rgba(220,38,38,.3);
          background:rgba(220,38,38,.12);font-family:'IBM Plex Mono',monospace;font-size:.46rem;
          font-weight:700;color:#dc2626;cursor:pointer;">⚡ PICKS</button>
        <button onclick="switchWKTab('schema')" id="wk-tab-schema"
          style="flex:1;padding:.4rem;border-radius:10px;border:1px solid var(--stroke);
          background:var(--card);font-family:'IBM Plex Mono',monospace;font-size:.46rem;
          font-weight:700;color:var(--sub);cursor:pointer;">📅 SCHEMA</button>
        <button onclick="switchWKTab('standen')" id="wk-tab-standen"
          style="flex:1;padding:.4rem;border-radius:10px;border:1px solid var(--stroke);
          background:var(--card);font-family:'IBM Plex Mono',monospace;font-size:.46rem;
          font-weight:700;color:var(--sub);cursor:pointer;">📊 STAND</button>
      </div>
      <!-- Tabs rij 2 -->
      <div style="display:flex;gap:.4rem;margin-bottom:.75rem;">
        <button onclick="switchWKTab('topscorers')" id="wk-tab-topscorers"
          style="flex:1;padding:.4rem;border-radius:10px;border:1px solid var(--stroke);
          background:var(--card);font-family:'IBM Plex Mono',monospace;font-size:.46rem;
          font-weight:700;color:var(--sub);cursor:pointer;">⚽ TOP</button>
        <button onclick="switchWKTab('voorspelling')" id="wk-tab-voorspelling"
          style="flex:1;padding:.4rem;border-radius:10px;border:1px solid var(--stroke);
          background:var(--card);font-family:'IBM Plex Mono',monospace;font-size:.46rem;
          font-weight:700;color:var(--sub);cursor:pointer;">🏆 AI</button>
        <button onclick="switchWKTab('oranje')" id="wk-tab-oranje"
          style="flex:1;padding:.4rem;border-radius:10px;border:1px solid var(--stroke);
          background:var(--card);font-family:'IBM Plex Mono',monospace;font-size:.46rem;
          font-weight:700;color:var(--sub);cursor:pointer;">🇳🇱 ORANJE</button>
      </div>

      <!-- Picks tab -->
      <div id="wk-tab-content-picks">
        <div id="wk-picks-list" style="margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);
            text-align:center;padding:1.5rem;">⟳ WK picks laden...</div>
        </div>
      </div>

      <!-- Schema tab -->
      <div id="wk-tab-content-schema" style="display:none;">
        <div id="wk-schema-list">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);
            text-align:center;padding:1.5rem;">⟳ Schema laden...</div>
        </div>
      </div>

      <!-- Standen tab -->
      <div id="wk-tab-content-standen" style="display:none;">
        <div id="wk-standen-list">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);
            text-align:center;padding:1.5rem;">⟳ Standen laden...</div>
        </div>
      </div>

      <!-- Topscorers tab -->
      <div id="wk-tab-content-topscorers" style="display:none;">
        <div id="wk-topscorers-list">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);
            text-align:center;padding:1.5rem;">⟳ Topscorers laden...</div>
        </div>
      </div>

      <!-- Voorspelling tab -->
      <div id="wk-tab-content-voorspelling" style="display:none;">

      <!-- Genereer knop -->
      <button id="wk-generate-btn" onclick="generateWKPrediction()"
        style="width:100%;background:linear-gradient(135deg,#dc2626,#be185d);
        border:none;border-radius:14px;padding:.85rem;margin-bottom:1rem;cursor:pointer;
        font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:white;letter-spacing:.05em;">
        ⚡ GENEREER AI VOORSPELLING
      </button>

      <!-- Loading -->
      <div id="wk-loading" style="display:none;text-align:center;padding:2rem 0;">
        <div style="font-size:2rem;animation:spin 1s linear infinite;">⚽</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);margin-top:.5rem;">
          Claude analyseert 48 teams...
        </div>
        <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
      </div>

      <!-- Content -->
      <div id="wk-content" style="display:none;">

        <!-- Kampioen -->
        <div id="wk-champion" style="background:linear-gradient(135deg,rgba(220,38,38,.1),rgba(190,24,93,.08));
          border:2px solid rgba(220,38,38,.3);border-radius:16px;padding:1rem;margin-bottom:.75rem;text-align:center;">
        </div>

        <!-- Top 4 -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;
          padding:.75rem .85rem;margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
            color:var(--sub);margin-bottom:.6rem;">🏅 VERWACHTE TOP 4</div>
          <div id="wk-top4" style="display:flex;flex-direction:column;gap:.4rem;"></div>
        </div>

        <!-- Analyse -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;
          padding:.75rem .85rem;margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
            color:var(--sub);margin-bottom:.5rem;">🧠 AI ANALYSE</div>
          <div id="wk-analyse" style="font-family:'DM Sans',sans-serif;font-size:.72rem;
            color:var(--ink);line-height:1.5;"></div>
        </div>

        <!-- Dark horses -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;
          padding:.75rem .85rem;margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
            color:var(--sub);margin-bottom:.5rem;">🐴 DARK HORSES</div>
          <div id="wk-darkhorses" style="font-family:'DM Sans',sans-serif;font-size:.72rem;
            color:var(--ink);line-height:1.5;"></div>
        </div>

        <!-- Groepsfase voorspellingen -->
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;
          padding:.75rem .85rem;margin-bottom:.75rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
            color:var(--sub);margin-bottom:.6rem;">📋 GROEPSFASE WINNAARS</div>
          <div id="wk-groups" style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;"></div>
        </div>

        <!-- Meta -->
        <div style="text-align:center;padding:.5rem 0 1rem;">
          <div id="wk-meta" style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);"></div>
          <button onclick="generateWKPrediction(true)"
            style="margin-top:.5rem;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);
            border-radius:999px;padding:.3rem .9rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;
            color:#dc2626;cursor:pointer;font-weight:700;">↻ NIEUWE VOORSPELLING</button>
        </div>
      </div>
      </div> <!-- einde wk-tab-content-voorspelling -->

      <!-- Oranje tab -->
      <div id="wk-tab-content-oranje" style="display:none;">
        <div id="oranje-content">
          <div style="text-align:center;padding:2rem;font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:var(--sub);">
            ⟳ Laden...
          </div>
        </div>
      </div>
    </div>
  `;

  // Laad gecachte voorspelling of toon lege staat
  loadCachedWKPrediction();
  // Laad WK picks
  loadWKPicks();
  loadWKSchema();
  if (tab === 'oranje') loadOranjeTab();
}

// ── Cache laden ──────────────────────────────────────────
function loadCachedWKPrediction() {
  try {
    const cached = localStorage.getItem(WK_CACHE_KEY);
    if (!cached) return;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < WK_CACHE_TTL) {
      renderWKData(data);
    }
  } catch(e) {}
}

// ── Voorspelling genereren via Claude ────────────────────
async function generateWKPrediction(force = false) {
  // Check cache tenzij force
  if (!force) {
    try {
      const cached = localStorage.getItem(WK_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < WK_CACHE_TTL) {
          renderWKData(data);
          return;
        }
      }
    } catch(e) {}
  }

  const btn = document.getElementById('wk-generate-btn');
  const loading = document.getElementById('wk-loading');
  const content = document.getElementById('wk-content');

  if (btn) btn.style.display = 'none';
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';

  const teamsPerGroep = Object.entries(WK_GROUPS)
    .map(([g, teams]) => `Groep ${g}: ${teams.join(', ')}`)
    .join('\n');

  const prompt = `Je bent een voetbalexpert. Analyseer het WK 2026 (11 juni – 19 juli, USA/Mexico/Canada) met 48 teams.

Groepsindeling:
${teamsPerGroep}

Geef een complete voorspelling in JSON:
{
  "kampioen": "landnaam",
  "kampioenKans": 18,
  "finalist": "landnaam",
  "derde": "landnaam",
  "vierde": "landnaam",
  "top4": [
    {"positie": 1, "land": "naam", "kans": 18, "reden": "korte reden"},
    {"positie": 2, "land": "naam", "kans": 14, "reden": "korte reden"},
    {"positie": 3, "land": "naam", "kans": 12, "reden": "korte reden"},
    {"positie": 4, "land": "naam", "kans": 10, "reden": "korte reden"}
  ],
  "groepWinnaars": {
    "A": "land", "B": "land", "C": "land", "D": "land",
    "E": "land", "F": "land", "G": "land", "H": "land",
    "I": "land", "J": "land", "K": "land", "L": "land"
  },
  "darkHorses": ["land1", "land2", "land3"],
  "analyse": "3-4 zinnen over de favorieten, speelstijl, thuisvoordeel USA/Mexico/Canada en opvallende factoren",
  "darkHorseAnalyse": "2 zinnen over de dark horses en waarom zij verrassen kunnen"
}

Respond ALLEEN met valid JSON, geen tekst buiten de JSON.`;

  try {
    const WORKER = 'https://api.promatchxi.app';
    const res = await fetch(`${WORKER}/anthropic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const api = await res.json();
    const raw = api?.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    // Cache opslaan
    localStorage.setItem(WK_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));

    renderWKData(data);
  } catch(e) {
    console.error('[WK2026] Fout:', e);
    if (loading) loading.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:#dc2626;">
        ⚠️ Laden mislukt — probeer opnieuw
      </div>
      <button onclick="generateWKPrediction(true)" style="margin-top:.5rem;
        background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);
        border-radius:999px;padding:.3rem .9rem;font-family:'IBM Plex Mono',monospace;
        font-size:.44rem;color:#dc2626;cursor:pointer;font-weight:700;">↻ Opnieuw</button>`;
  } finally {
    if (btn) btn.style.display = 'block';
  }
}

// ── Data renderen ────────────────────────────────────────
function renderWKData(data) {
  const loading = document.getElementById('wk-loading');
  const content = document.getElementById('wk-content');
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = 'block';

  // Kampioen
  const champEl = document.getElementById('wk-champion');
  if (champEl && data.kampioen) {
    const flag = TEAM_FLAGS[data.kampioen] || '🏳';
    champEl.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;
        color:#dc2626;margin-bottom:.3rem;">🏆 AI VOORSPELT WERELDKAMPIOEN</div>
      <div style="font-size:2.5rem;">${flag}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:var(--ink);
        margin-top:.2rem;">${data.kampioen.toUpperCase()}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:#dc2626;
        font-weight:700;margin-top:.2rem;">${data.kampioenKans}% kans</div>`;
  }

  // Top 4
  const top4El = document.getElementById('wk-top4');
  if (top4El && data.top4) {
    const medals = ['🥇','🥈','🥉','4️⃣'];
    top4El.innerHTML = data.top4.map((t, i) => {
      const flag = TEAM_FLAGS[t.land] || '🏳';
      const barW = Math.min(100, t.kans * 4);
      return `
        <div style="padding:.35rem 0;border-bottom:1px solid var(--stroke);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem;">
            <div style="display:flex;align-items:center;gap:.4rem;">
              <span style="font-size:.9rem;">${medals[i]}</span>
              <span style="font-size:1rem;">${flag}</span>
              <span style="font-family:'DM Sans',sans-serif;font-size:.72rem;font-weight:700;
                color:var(--ink);">${t.land}</span>
            </div>
            <span style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:#dc2626;">${t.kans}%</span>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);
            margin-bottom:.2rem;">${t.reden}</div>
          <div style="height:3px;background:var(--stroke);border-radius:2px;">
            <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,#dc2626,#be185d);
              border-radius:2px;transition:width .5s;"></div>
          </div>
        </div>`;
    }).join('');
  }

  // Analyse
  const analyseEl = document.getElementById('wk-analyse');
  if (analyseEl && data.analyse) analyseEl.textContent = data.analyse;

  // Dark horses
  const dhEl = document.getElementById('wk-darkhorses');
  if (dhEl) {
    const dhFlags = (data.darkHorses || []).map(t => `${TEAM_FLAGS[t] || '🏳'} ${t}`).join(' · ');
    dhEl.innerHTML = `<div style="font-size:.8rem;margin-bottom:.3rem;">${dhFlags}</div>
      <div style="color:var(--sub);">${data.darkHorseAnalyse || ''}</div>`;
  }

  // Groepwinnaars
  const groupsEl = document.getElementById('wk-groups');
  if (groupsEl && data.groepWinnaars) {
    groupsEl.innerHTML = Object.entries(data.groepWinnaars).map(([g, land]) => {
      const flag = TEAM_FLAGS[land] || '🏳';
      return `
        <div style="background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.1);
          border-radius:10px;padding:.4rem .5rem;display:flex;align-items:center;gap:.3rem;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;font-weight:700;
            color:#dc2626;min-width:.7rem;">G${g}</span>
          <span style="font-size:.85rem;">${flag}</span>
          <span style="font-family:'DM Sans',sans-serif;font-size:.58rem;font-weight:600;
            color:var(--ink);">${land}</span>
        </div>`;
    }).join('');
  }

  // Meta
  const metaEl = document.getElementById('wk-meta');
  if (metaEl) {
    metaEl.textContent = `Gegenereerd: ${new Date().toLocaleDateString('nl-NL')} · Gecached 24u · claude-sonnet-4`;
  }
}

// ── Dashboard widget ─────────────────────────────────────
async function renderWKDashboardWidget() {
  const el = document.getElementById('wk-dashboard-widget');
  if (!el) return;

  // Check cache
  try {
    const cached = localStorage.getItem(WK_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < WK_CACHE_TTL) {
        showWKWidget(el, data);
        return;
      }
    }
  } catch(e) {}

  // Geen cache — toon knop
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
          color:#dc2626;">🏆 WK 2026 VOORSPELLING</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);
          margin-top:.1rem;">Nog niet gegenereerd</div>
      </div>
      <button onclick="quickGenerateWKWidget()"
        style="background:linear-gradient(135deg,#dc2626,#be185d);border:none;border-radius:10px;
        padding:.4rem .7rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;
        color:white;cursor:pointer;font-weight:700;white-space:nowrap;">⚡ Genereer</button>
    </div>`;
}

function showWKWidget(el, data) {
  if (!el || !data) return;
  const flag = TEAM_FLAGS[data.kampioen] || '🏳';
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;"
      onclick="switchScreen('wk2026')">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;
          color:#dc2626;">🏆 AI VOORSPELT WK 2026</div>
        <div style="display:flex;align-items:center;gap:.3rem;margin-top:.25rem;">
          <span style="font-size:1.2rem;">${flag}</span>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--ink);">
            ${data.kampioen}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:#dc2626;
            font-weight:700;">${data.kampioenKans}%</span>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);
          margin-top:.1rem;">
          Top 4: ${(data.top4||[]).slice(0,4).map(t=>`${TEAM_FLAGS[t.land]||''}${t.land}`).join(' · ')}
        </div>
      </div>
      <div style="font-size:.7rem;color:var(--sub);">›</div>
    </div>`;
}

async function quickGenerateWKWidget() {
  const el = document.getElementById('wk-dashboard-widget');
  if (el) el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;
    color:var(--sub);">⟳ Claude analyseert...</div>`;

  // Genereer in achtergrond
  await generateWKPrediction(true);

  // Herlaad widget
  try {
    const cached = localStorage.getItem(WK_CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      showWKWidget(el, data);
    }
  } catch(e) {}
}

// ── WK Tab switcher ──────────────────────────────────────
function loadOranjeTab() {
  const el = document.getElementById('oranje-content');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:.5rem;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:.8rem;background:linear-gradient(135deg,rgba(255,102,0,.15),rgba(255,140,0,.08));border:1.5px solid rgba(255,102,0,.3);border-radius:16px;padding:1rem;margin-bottom:.8rem;">
        <div style="font-size:2.5rem;">🇳🇱</div>
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#ff6600;letter-spacing:.05em;line-height:1;">NEDERLAND</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.55rem;color:rgba(255,255,255,.6);">WK 2026 · Groep G</div>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.8rem;">
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:.7rem .3rem;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#ff6600;">3e</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:rgba(255,255,255,.5);">WK 2022</div>
        </div>
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:.7rem .3rem;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#00BEC4;">G</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:rgba(255,255,255,.5);">GROEP</div>
        </div>
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:.7rem .3rem;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#fff;">26</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:rgba(255,255,255,.5);">SPELERS</div>
        </div>
      </div>

      <!-- Groepswedstrijden -->
      <div style="background:rgba(255,255,255,.05);border-radius:14px;padding:.9rem;margin-bottom:.8rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#ff6600;margin-bottom:.6rem;">📅 WK PROGRAMMA</div>
        ${[
          {date:'12 jun', opp:'🇺🇸 USA', loc:'Dallas', time:'21:00'},
          {date:'17 jun', opp:'🇸🇳 Senegal', loc:'New York', time:'18:00'},
          {date:'21 jun', opp:'🇦🇹 Oostenrijk', loc:'Boston', time:'21:00'},
        ].map(g => `
          <div style="display:flex;align-items:center;gap:.6rem;padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.06);">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:rgba(255,255,255,.4);width:3rem;">${g.date}</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.62rem;font-weight:700;color:#fff;flex:1;">NL vs ${g.opp}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:rgba(255,255,255,.5);">${g.time}</div>
          </div>
        `).join('')}
      </div>

      <!-- Selectie -->
      <div style="background:rgba(255,255,255,.05);border-radius:14px;padding:.9rem;margin-bottom:.8rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#ff6600;margin-bottom:.6rem;">👥 SELECTIE</div>
        ${[
          {pos:'GK', name:'Bart Verbruggen', club:'Brighton'},
          {pos:'GK', name:'Mark Flekken', club:'Brentford'},
          {pos:'DEF', name:'Virgil van Dijk', club:'Liverpool'},
          {pos:'DEF', name:'Matthijs de Ligt', club:'Man United'},
          {pos:'DEF', name:'Denzel Dumfries', club:'Inter'},
          {pos:'DEF', name:'Nathan Aké', club:'Man City'},
          {pos:'DEF', name:'Jurriën Timber', club:'Arsenal'},
          {pos:'MID', name:'Frenkie de Jong', club:'Barcelona'},
          {pos:'MID', name:'Tijjani Reijnders', club:'AC Milan'},
          {pos:'MID', name:'Teun Koopmeiners', club:'Juventus'},
          {pos:'MID', name:'Jerdy Schouten', club:'PSV'},
          {pos:'FWD', name:'Cody Gakpo', club:'Liverpool'},
          {pos:'FWD', name:'Memphis Depay', club:'Corinthians'},
          {pos:'FWD', name:'Donyell Malen', club:'Dortmund'},
          {pos:'FWD', name:'Brian Brobbey', club:'Ajax'},
          {pos:'FWD', name:'Xavi Simons', club:'PSG'},
        ].map(p => `
          <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.04);">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;
              color:${p.pos==='FWD'?'#ff6600':p.pos==='MID'?'#00BEC4':p.pos==='DEF'?'#3b82f6':'#a855f7'};
              width:2.2rem;">${p.pos}</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.6rem;font-weight:700;color:#fff;flex:1;">${p.name}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.48rem;color:rgba(255,255,255,.4);">${p.club}</div>
          </div>
        `).join('')}
      </div>

      <!-- Nieuws knop -->
      <button onclick="loadOranjeNieuws()" id="oranje-nieuws-btn"
        style="width:100%;padding:.8rem;font-family:'Bebas Neue',sans-serif;font-size:1.1rem;
        letter-spacing:.05em;background:linear-gradient(135deg,rgba(255,102,0,.8),rgba(255,140,0,.7));
        color:#fff;border:none;border-radius:12px;cursor:pointer;margin-bottom:.6rem;">
        📰 LAAD LAATSTE NIEUWS
      </button>
      <div id="oranje-nieuws-content"></div>
    </div>
  `;
}

async function loadOranjeNieuws() {
  const btn = document.getElementById('oranje-nieuws-btn');
  const el = document.getElementById('oranje-nieuws-content');
  if (!el) return;
  btn.textContent = '⟳ Nieuws laden...';
  btn.disabled = true;
  try {
    const resp = await fetch('https://api.promatchxi.app/oranje-nieuws');
    const data = await resp.json();
    if (data.nieuws && data.nieuws.length) {
      el.innerHTML = data.nieuws.map(n => `
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:.8rem;margin-bottom:.5rem;border-left:3px solid #ff6600;">
          <div style="font-family:'DM Sans',sans-serif;font-size:.65rem;font-weight:700;color:#fff;margin-bottom:.25rem;">${n.titel}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.52rem;color:rgba(255,255,255,.6);line-height:1.6;">${n.samenvatting}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:rgba(255,255,255,.3);margin-top:.3rem;">${n.bron} · ${n.datum}</div>
        </div>
      `).join('');
    } else {
      el.innerHTML = '<div style="text-align:center;padding:1rem;font-family:monospace;font-size:.55rem;color:rgba(255,255,255,.4);">Geen nieuws gevonden</div>';
    }
  } catch(e) {
    el.innerHTML = '<div style="color:#dc2626;font-family:monospace;font-size:.5rem;padding:.5rem;">Fout: ' + e.message + '</div>';
  }
  btn.textContent = '🔄 Vernieuwen';
  btn.disabled = false;
}

function switchWKTab(tab) {
  ['picks','schema','standen','topscorers','voorspelling','oranje'].forEach(t => {
    const content = document.getElementById('wk-tab-content-' + t);
    const btn = document.getElementById('wk-tab-' + t);
    if (content) content.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      btn.style.background = t === tab ? 'rgba(220,38,38,.12)' : 'var(--card)';
      btn.style.borderColor = t === tab ? 'rgba(220,38,38,.3)' : 'var(--stroke)';
      btn.style.color = t === tab ? '#dc2626' : 'var(--sub)';
    }
  });
  if (tab === 'oranje') loadOranjeTab();
  if (tab === 'schema') loadWKSchema();
  if (tab === 'standen') loadWKStanden();
  if (tab === 'topscorers') loadWKTopscorers();
}

// ── WK Picks laden (uit Supabase via worker) ─────────────
async function loadWKPicks() {
  const el = document.getElementById('wk-picks-list');
  if (!el) return;

  try {
    const res = await fetch('https://api.promatchxi.app/picks');
    const data = await res.json();
    const allPicks = Object.values(data || {});

    // Filter WK picks (league id 1)
    const wkPicks = allPicks.filter(p =>
      p.leagueId === 1 || p.leagueId === '1' ||
      (p.comp || '').toLowerCase().includes('world cup') ||
      (p.comp || '').toLowerCase().includes('wk') ||
      (p.comp || '').toLowerCase().includes('fifa')
    );

    if (!wkPicks.length) {
      el.innerHTML = `
        <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;
          padding:1.2rem;text-align:center;">
          <div style="font-size:1.5rem;margin-bottom:.5rem;">⏳</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
            color:var(--ink);margin-bottom:.25rem;">WK PICKS KOMEN ERAAN</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);">
            Start 11 juni · De scanner analyseert elke WK wedstrijd automatisch
          </div>
        </div>`;
      return;
    }

    const byStatus = {
      pending: wkPicks.filter(p => p.status === 'pending'),
      win:     wkPicks.filter(p => p.status === 'win'),
      lose:    wkPicks.filter(p => p.status === 'lose'),
    };

    let html = '';

    // Stats bar
    const total = wkPicks.filter(p => p.status !== 'pending').length;
    const wins  = byStatus.win.length;
    const roi   = total ? ((byStatus.win.reduce((s,p) => s + (p.odds - 1), 0) - byStatus.lose.length) / total * 100) : 0;
    html += `
      <div style="display:flex;gap:.4rem;margin-bottom:.6rem;">
        <div style="flex:1;background:var(--card);border:1px solid var(--stroke);border-radius:10px;
          padding:.5rem;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#dc2626;">${wkPicks.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">PICKS</div>
        </div>
        <div style="flex:1;background:var(--card);border:1px solid var(--stroke);border-radius:10px;
          padding:.5rem;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${wins/total>=.4?'#00BEC4':'#dc2626'};">
            ${total ? Math.round(wins/total*100) : '—'}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">HITRATE</div>
        </div>
        <div style="flex:1;background:var(--card);border:1px solid var(--stroke);border-radius:10px;
          padding:.5rem;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${roi>=0?'#00BEC4':'#dc2626'};">
            ${roi>=0?'+':''}${roi.toFixed(1)}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">ROI</div>
        </div>
      </div>`;

    // Pending picks
    if (byStatus.pending.length) {
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;
        color:var(--sub);margin-bottom:.4rem;">⏳ OPEN PICKS</div>`;
      byStatus.pending.forEach(p => { html += renderWKPickCard(p); });
    }

    // Settled picks
    const settled = [...byStatus.win, ...byStatus.lose].sort((a,b) =>
      new Date(b.matchDate||0) - new Date(a.matchDate||0));
    if (settled.length) {
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;font-weight:700;
        color:var(--sub);margin:.6rem 0 .4rem;">✅ AFGEROND</div>`;
      settled.forEach(p => { html += renderWKPickCard(p); });
    }

    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;
      color:#dc2626;text-align:center;padding:1rem;">Fout bij laden: ${e.message}</div>`;
  }
}

function renderWKPickCard(p) {
  const icon = p.status === 'win' ? '✅' : p.status === 'lose' ? '❌' : '⏳';
  const valColor = (p.value||0) >= 15 ? '#dc2626' : (p.value||0) >= 8 ? '#d97706' : '#64748b';
  const flag1 = WK_TEAM_FLAG(p.home || '');
  const flag2 = WK_TEAM_FLAG(p.away || '');
  return `
    <div style="background:var(--card);border:1px solid var(--stroke);border-radius:12px;
      padding:.6rem .75rem;margin-bottom:.4rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.2rem;">
        <div style="font-family:'DM Sans',sans-serif;font-size:.65rem;font-weight:700;color:var(--ink);">
          ${icon} ${flag1}${p.home||'?'} vs ${flag2}${p.away||'?'}
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;color:${valColor};">
          +${Math.round(p.value||0)}%
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);">
        ${p.pickLabel||p.pick} @ ${p.odds} · conf ${p.confidence}/10
        ${p.sharp ? '<span style="color:#ef4444;margin-left:.3rem;">🔥 SHARP</span>' : ''}
      </div>
    </div>`;
}

// Engelse teamnamen → vlag (API-Football gebruikt Engelse namen)
const EN_FLAGS = {
  'Mexico':'🇲🇽','South Africa':'🇿🇦','Canada':'🇨🇦','Bosnia & Herzegovina':'🇧🇦',
  'USA':'🇺🇸','United States':'🇺🇸','Paraguay':'🇵🇾','Qatar':'🇶🇦','Switzerland':'🇨🇭',
  'Brazil':'🇧🇷','Morocco':'🇲🇦','Haiti':'🇭🇹','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Australia':'🇦🇺',
  'Turkiye':'🇹🇷','Turkey':'🇹🇷','Germany':'🇩🇪','Curacao':'🇨🇼','Netherlands':'🇳🇱',
  'Japan':'🇯🇵','South Korea':'🇰🇷','Czech Republic':'🇨🇿','Argentina':'🇦🇷',
  'Spain':'🇪🇸','Portugal':'🇵🇹','France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Belgium':'🇧🇪',
  'Italy':'🇮🇹','Croatia':'🇭🇷','Serbia':'🇷🇸','Poland':'🇵🇱','Denmark':'🇩🇰',
  'Uruguay':'🇺🇾','Colombia':'🇨🇴','Ecuador':'🇪🇨','Peru':'🇵🇪','Chile':'🇨🇱',
  'Venezuela':'🇻🇪','Bolivia':'🇧🇴','Senegal':'🇸🇳','Nigeria':'🇳🇬','Cameroon':'🇨🇲',
  'Ghana':'🇬🇭','Tunisia':'🇹🇳','Algeria':'🇩🇿','Mali':'🇲🇱','Egypt':'🇪🇬',
  'Iran':'🇮🇷','Saudi Arabia':'🇸🇦','Iraq':'🇮🇶','Jordan':'🇯🇴','United Arab Emirates':'🇦🇪',
  'Honduras':'🇭🇳','Panama':'🇵🇦','Jamaica':'🇯🇲','Costa Rica':'🇨🇷','El Salvador':'🇸🇻',
  'Guatemala':'🇬🇹','Suriname':'🇸🇷','Austria':'🇦🇹','Sweden':'🇸🇪','Norway':'🇳🇴',
  'Finland':'🇫🇮','Ireland':'🇮🇪','Slovakia':'🇸🇰','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Ukraine':'🇺🇦',
  'New Zealand':'🇳🇿','Indonesia':'🇮🇩','Philippines':'🇵🇭','Thailand':'🇹🇭',
  'China':'🇨🇳','Uzbekistan':'🇺🇿','Kenya':'🇰🇪','DR Congo':'🇨🇩','Zambia':'🇿🇲',
};

function WK_TEAM_FLAG(team) {
  return EN_FLAGS[team] || TEAM_FLAGS[team] || '🏳';
}

// ── WK Schema laden ───────────────────────────────────────
let _wkFixtures = [];
let _wkOdds = {};
let _wkActiveGroep = 'all';

async function loadWKSchema() {
  const el = document.getElementById('wk-schema-list');
  if (!el) return;

  el.innerHTML = `<div style="text-align:center;padding:1.5rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">⟳ Wedstrijden laden...</div>`;

  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `https://api.promatchxi.app/apif/fixtures?league=1&season=2026&from=${today}&to=2026-07-20&timezone=Europe/Amsterdam`
    );
    const raw = await res.json();
    _wkFixtures = Array.isArray(raw) ? raw : (raw?.response || []);

    if (!_wkFixtures.length) {
      el.innerHTML = `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:1.2rem;text-align:center;"><div style="font-size:1.5rem;margin-bottom:.5rem;">🗓️</div><div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--ink);">Geen wedstrijden gevonden</div></div>`;
      return;
    }

    // Haal odds op voor eerste wedstrijd als sample (goedkoop)
    _loadWKOdds(_wkFixtures.slice(0, 8).map(f => f.fixture?.id).filter(Boolean));

    _renderWKSchema();
  } catch(e) {
    el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);text-align:center;padding:1rem;">Fout bij laden: ${e.message}</div>`;
  }
}

async function _loadWKOdds(ids) {
  for (const id of ids.slice(0, 5)) {
    try {
      const res = await fetch(`https://api.promatchxi.app/apif/odds?league=1&season=2026&fixture=${id}`);
      const raw = await res.json();
      const resp = Array.isArray(raw) ? raw : (raw?.response || []);
      if (resp[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
        const vals = resp[0].bookmakers[0].bets[0].values;
        _wkOdds[id] = { home: parseFloat(vals[0]?.odd), draw: parseFloat(vals[1]?.odd), away: parseFloat(vals[2]?.odd) };
      }
    } catch(e) {}
  }
  _renderWKSchema();
}

function _renderWKSchema() {
  const el = document.getElementById('wk-schema-list');
  if (!el || !_wkFixtures.length) return;

  // Groepletter uit round string (Group A t/m L)
  const getGroep = f => {
    const r = f.league?.round || '';
    const m = r.match(/Group (\w+)/);
    return m ? m[1] : null;  // A, B, C ... L
  };

  const groepen = [...new Set(_wkFixtures.map(getGroep).filter(Boolean))].sort();

  // Filter tabs
  let filterHtml = `<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem;padding:.1rem 0;">
    <button onclick="_wkFilterGroep('all')"
      style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;padding:.3rem .7rem;border-radius:999px;border:1.5px solid ${_wkActiveGroep==='all'?'#00BEC4':'var(--stroke)'};background:${_wkActiveGroep==='all'?'rgba(0,190,196,.15)':'var(--card)'};color:${_wkActiveGroep==='all'?'#00BEC4':'var(--sub)'};cursor:pointer;">
      ALLE</button>`;
  groepen.forEach(g => {
    const active = _wkActiveGroep === g;
    filterHtml += `<button onclick="_wkFilterGroep('${g}')"
      style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;padding:.3rem .7rem;border-radius:999px;border:1.5px solid ${active?'#00BEC4':'var(--stroke)'};background:${active?'rgba(0,190,196,.15)':'var(--card)'};color:${active?'#00BEC4':'var(--sub)'};cursor:pointer;">
      ${g}</button>`;
  });
  filterHtml += `</div>`;

  // Filter wedstrijden
  const filtered = _wkFixtures.filter(f =>
    _wkActiveGroep === 'all' || getGroep(f) === _wkActiveGroep
  );

  // Groepeer per dag
  const byDay = {};
  filtered.forEach(f => {
    const day = f.fixture?.date?.split('T')[0] || 'x';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(f);
  });

  let html = filterHtml;

  Object.entries(byDay).sort().forEach(([day, matches]) => {
    const d = new Date(day + 'T12:00:00');
    const dagLabel = d.toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' });

    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;
      color:var(--sub);letter-spacing:.06em;margin:1.1rem 0 .5rem;text-transform:uppercase;">
      ${dagLabel}</div>`;

    matches.forEach(f => {
      const fid = f.fixture?.id;
      const home = f.teams?.home?.name || '?';
      const away = f.teams?.away?.name || '?';
      const hFlag = WK_TEAM_FLAG(home);
      const aFlag = WK_TEAM_FLAG(away);
      const status = f.fixture?.status?.short;
      const isLive = ['1H','2H','HT','ET','PEN'].includes(status);
      const isDone = ['FT','AET','PEN'].includes(status);
      const ghome = f.goals?.home ?? '';
      const gaway = f.goals?.away ?? '';
      const time = f.fixture?.date ? new Date(f.fixture.date).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : '--:--';
      const groepLetter = getGroep(f) || '';
      const odds = _wkOdds[fid];

      // Score/tijd blok
      let midHtml = '';
      if (isLive) {
        midHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:.15rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#dc2626;line-height:1;">${ghome} – ${gaway}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:#dc2626;font-weight:700;animation:blink 1s infinite;">● LIVE</div>
        </div>`;
      } else if (isDone) {
        midHtml = `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--ink);line-height:1;">${ghome} – ${gaway}</div>`;
      } else {
        midHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:.1rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--ink);line-height:1;">vs</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:#00BEC4;font-weight:700;">${time}</div>
        </div>`;
      }

      // Odds blok
      let oddsHtml = '';
      if (odds && !isDone) {
        oddsHtml = `<div style="display:flex;gap:.4rem;margin-top:.6rem;padding-top:.6rem;border-top:1px solid var(--stroke);">
          <div style="flex:1;text-align:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.15);border-radius:8px;padding:.3rem .2rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);margin-bottom:.1rem;">1</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--ink);">${odds.home?.toFixed(2)}</div>
          </div>
          <div style="flex:1;text-align:center;background:var(--card2,rgba(255,255,255,.03));border:1px solid var(--stroke);border-radius:8px;padding:.3rem .2rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);margin-bottom:.1rem;">X</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--ink);">${odds.draw?.toFixed(2)}</div>
          </div>
          <div style="flex:1;text-align:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.15);border-radius:8px;padding:.3rem .2rem;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);margin-bottom:.1rem;">2</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:var(--ink);">${odds.away?.toFixed(2)}</div>
          </div>
        </div>`;
      }

      html += `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.85rem 1rem;margin-bottom:.5rem;">
        <!-- Groep label -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);font-weight:700;">${groepLetter ? 'GROEP ' + groepLetter : ''}</div>
          ${isDone ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.4rem;color:var(--sub);">AFGELOPEN</div>` : ''}
        </div>
        <!-- Teams + Score -->
        <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:.5rem;">
          <!-- Thuis -->
          <div style="text-align:left;">
            <div style="font-size:1.6rem;line-height:1;margin-bottom:.2rem;">${hFlag}</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.68rem;font-weight:700;color:var(--ink);line-height:1.2;">${home}</div>
          </div>
          <!-- Midden: score of tijd -->
          <div style="text-align:center;min-width:60px;">
            ${midHtml}
          </div>
          <!-- Uit -->
          <div style="text-align:right;">
            <div style="font-size:1.6rem;line-height:1;margin-bottom:.2rem;">${aFlag}</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:.68rem;font-weight:700;color:var(--ink);line-height:1.2;">${away}</div>
          </div>
        </div>
        ${oddsHtml}
        ${!isDone ? `
        <div style="margin-top:.6rem;padding-top:.6rem;border-top:1px solid var(--stroke);">
          <button onclick="analyseWKMatch(${fid},'${home.replace(/'/g,"\'")}','${away.replace(/'/g,"\'")}',${JSON.stringify(odds)||null})"
            style="width:100%;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);border-radius:10px;
            padding:.45rem;font-family:'IBM Plex Mono',monospace;font-size:.46rem;font-weight:700;
            color:#dc2626;cursor:pointer;letter-spacing:.04em;">
            ⚡ AI ANALYSE
          </button>
        </div>` : ''}
      </div>`;
    });
  });

  html += `<style>@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}</style>`;
  el.innerHTML = html;
}

function _wkFilterGroep(groep) {
  _wkActiveGroep = groep;
  _renderWKSchema();
}

// ── WK Standen laden ──────────────────────────────────────
async function loadWKStanden() {
  const el = document.getElementById('wk-standen-list');
  if (!el) return;
  el.innerHTML = `<div style="text-align:center;padding:1.5rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">⟳ Standen laden...</div>`;

  try {
    const res = await fetch('https://api.promatchxi.app/apif/standings?league=1&season=2026');
    const raw = await res.json();
    const resp = Array.isArray(raw) ? raw : (raw?.response || []);
    const standings = resp[0]?.league?.standings || [];

    if (!standings.length) {
      el.innerHTML = `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:1.5rem;text-align:center;">
        <div style="font-size:1.5rem;margin-bottom:.5rem;">📊</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">Standen beschikbaar na eerste speelronde</div>
      </div>`;
      return;
    }

    let html = '';
    standings.forEach(groep => {
      if (!groep.length) return;
      const groepNaam = groep[0].group || 'Groep';
      const letter = groepNaam.replace('Group ', '');

      html += `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.6rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;color:#00BEC4;margin-bottom:.6rem;letter-spacing:.05em;">
          GROEP ${letter}
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr repeat(5,auto);gap:.25rem .4rem;align-items:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">#</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">TEAM</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;">GS</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;">W</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;">D</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;">V</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;font-weight:700;color:var(--ink);text-align:center;">PT</div>`;

      groep.forEach((team, i) => {
        const t = team.team?.name || '?';
        const flag = WK_TEAM_FLAG(t);
        const pts = team.points ?? 0;
        const gs = team.all?.played ?? 0;
        const w = team.all?.win ?? 0;
        const d = team.all?.draw ?? 0;
        const l = team.all?.lose ?? 0;
        const through = i < 2;
        const rowBg = through ? 'rgba(0,190,196,.04)' : 'transparent';

        html += `
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:${through?'#00BEC4':'var(--sub)'};font-weight:700;background:${rowBg};border-radius:4px;padding:.15rem .2rem;">${i+1}</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.6rem;font-weight:600;color:var(--ink);background:${rowBg};border-radius:4px;padding:.15rem .2rem;">${flag} ${t}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;background:${rowBg};border-radius:4px;padding:.15rem;">${gs}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;background:${rowBg};border-radius:4px;padding:.15rem;">${w}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;background:${rowBg};border-radius:4px;padding:.15rem;">${d}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;background:${rowBg};border-radius:4px;padding:.15rem;">${l}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.6rem;font-weight:700;color:${through?'#00BEC4':'var(--ink)'};text-align:center;background:${rowBg};border-radius:4px;padding:.15rem;">${pts}</div>`;
      });

      html += `</div></div>`;
    });

    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);text-align:center;padding:1rem;">Fout: ${e.message}</div>`;
  }
}

// ── WK Topscorers laden ────────────────────────────────────
async function loadWKTopscorers() {
  const el = document.getElementById('wk-topscorers-list');
  if (!el) return;
  el.innerHTML = `<div style="text-align:center;padding:1.5rem;font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);">⟳ Topscorers laden...</div>`;

  try {
    const res = await fetch('https://api.promatchxi.app/apif/topscorers?league=1&season=2026');
    const raw = await res.json();
    const scorers = Array.isArray(raw) ? raw : (raw?.response || []);

    if (!scorers.length) {
      el.innerHTML = `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:1.5rem;text-align:center;">
        <div style="font-size:1.5rem;margin-bottom:.5rem;">⚽</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);">Topscorers beschikbaar na eerste speelronde</div>
      </div>`;
      return;
    }

    let html = `<div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.75rem .85rem;margin-bottom:.6rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;font-weight:700;color:#00BEC4;margin-bottom:.6rem;letter-spacing:.05em;">⚽ TOPSCORERS</div>
      <div style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:.3rem .5rem;align-items:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">#</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">SPELER</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;">GS</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;">ASS</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;font-weight:700;color:var(--ink);text-align:center;">⚽</div>`;

    scorers.slice(0, 20).forEach((s, i) => {
      const naam = s.player?.name || '?';
      const land = s.statistics?.[0]?.team?.name || '';
      const flag = WK_TEAM_FLAG(land);
      const goals = s.statistics?.[0]?.goals?.total ?? 0;
      const assists = s.statistics?.[0]?.goals?.assists ?? 0;
      const games = s.statistics?.[0]?.games?.appearences ?? 0;
      const isTop = i === 0;

      html += `
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:${isTop?'#f59e0b':'var(--sub)'};font-weight:700;">${i+1}</div>
        <div>
          <div style="font-family:'DM Sans',sans-serif;font-size:.62rem;font-weight:700;color:var(--ink);">${naam}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);">${flag} ${land}</div>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;">${games}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.5rem;color:var(--sub);text-align:center;">${assists}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:700;color:${isTop?'#f59e0b':'var(--ink)'};text-align:center;">${goals}</div>`;
    });

    html += `</div></div>`;
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.44rem;color:var(--sub);text-align:center;padding:1rem;">Fout: ${e.message}</div>`;
  }
}

// ── WK Match Analyse ──────────────────────────────────────
async function analyseWKMatch(fixtureId, home, away, odds) {
  // Toon modal
  let modal = document.getElementById('wk-analyse-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wk-analyse-modal';
    modal.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);
      display:flex;align-items:flex-end;justify-content:center;`;
    modal.innerHTML = `<div id="wk-analyse-modal-inner"
      style="background:var(--bg,#0d1b2a);border-radius:20px 20px 0 0;width:100%;max-width:600px;
      max-height:85vh;overflow-y:auto;padding:1.25rem 1.1rem 2rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <div id="wk-analyse-modal-title" style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:var(--ink);"></div>
        <button onclick="document.getElementById('wk-analyse-modal').remove()"
          style="background:rgba(255,255,255,.08);border:none;border-radius:8px;padding:.3rem .6rem;
          color:var(--sub);font-size:.9rem;cursor:pointer;">✕</button>
      </div>
      <div id="wk-analyse-modal-body"></div>
    </div>`;
    document.body.appendChild(modal);
  }

  const titleEl = document.getElementById('wk-analyse-modal-title');
  const bodyEl = document.getElementById('wk-analyse-modal-body');
  const hFlag = WK_TEAM_FLAG(home);
  const aFlag = WK_TEAM_FLAG(away);

  titleEl.textContent = `${hFlag} ${home} vs ${aFlag} ${away}`;
  bodyEl.innerHTML = `<div style="text-align:center;padding:2rem 0;">
    <div style="font-size:2rem;animation:spin 1s linear infinite;">⚽</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:var(--sub);margin-top:.75rem;">
      Claude analyseert wedstrijd...</div>
    <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
  </div>`;

  // Cache check
  const cacheKey = `wk_match_analyse_${fixtureId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { text, ts } = JSON.parse(cached);
      if (Date.now() - ts < 6 * 3600 * 1000) {
        _renderWKMatchAnalyse(bodyEl, text, home, away, odds, true);
        return;
      }
    }
  } catch(e) {}

  // Bouw odds tekst
  const oddsText = odds
    ? `Huidige odds: ${home} wint @${odds.home?.toFixed(2)}, gelijkspel @${odds.draw?.toFixed(2)}, ${away} wint @${odds.away?.toFixed(2)}.`
    : 'Odds nog niet beschikbaar.';

  const prompt = `Je bent een voetbalanalist gespecialiseerd in WK voorspellingen.

Analyseer deze WK 2026 wedstrijd:
${hFlag} ${home} vs ${aFlag} ${away}

${oddsText}

Geef een beknopte maar scherpe analyse in het Nederlands met:
1. **Sterktes/zwaktes** van beide teams (2-3 zinnen per team)
2. **Head-to-head** historisch (indien relevant)
3. **Verwachte speelstijl** en sleutelspelers
4. **Voorspelling** met kansverdeling (bv. 45% ${home} / 25% gelijkspel / 30% ${away})
5. **Value inschatting**: zijn de odds eerlijk, te hoog of te laag voor een team?
6. **Jouw tip**: meest waarschijnlijke uitkomst in 1 zin

Wees concreet en gebruik voetbalkennis. Maximaal 350 woorden.`;

  try {
    const res = await fetch('https://api.promatchxi.app/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const api = await res.json();
    const text = api?.content?.[0]?.text || '⚠️ Geen analyse ontvangen.';

    // Cache opslaan
    localStorage.setItem(cacheKey, JSON.stringify({ text, ts: Date.now() }));
    _renderWKMatchAnalyse(bodyEl, text, home, away, odds, false);
  } catch(e) {
    bodyEl.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:.46rem;color:#dc2626;text-align:center;padding:1rem;">
      ⚠️ Analyse mislukt — probeer opnieuw</div>`;
  }
}

function _renderWKMatchAnalyse(el, text, home, away, odds, fromCache) {
  const hFlag = WK_TEAM_FLAG(home);
  const aFlag = WK_TEAM_FLAG(away);

  // Converteer markdown bold naar HTML
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  let oddsHtml = '';
  if (odds) {
    oddsHtml = `<div style="display:flex;gap:.4rem;margin-bottom:1rem;">
      <div style="flex:1;text-align:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.5rem .3rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);margin-bottom:.2rem;">${hFlag} 1</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--ink);">${odds.home?.toFixed(2)}</div>
      </div>
      <div style="flex:1;text-align:center;background:rgba(255,255,255,.03);border:1px solid var(--stroke);border-radius:10px;padding:.5rem .3rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);margin-bottom:.2rem;">X</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--ink);">${odds.draw?.toFixed(2)}</div>
      </div>
      <div style="flex:1;text-align:center;background:rgba(0,190,196,.06);border:1px solid rgba(0,190,196,.2);border-radius:10px;padding:.5rem .3rem;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);margin-bottom:.2rem;">${aFlag} 2</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--ink);">${odds.away?.toFixed(2)}</div>
      </div>
    </div>`;
  }

  el.innerHTML = `
    ${oddsHtml}
    <div style="background:var(--card);border:1px solid var(--stroke);border-radius:14px;padding:.85rem 1rem;">
      <p style="font-family:'DM Sans',sans-serif;font-size:.7rem;color:var(--ink);line-height:1.65;margin:0;">${html}</p>
    </div>
    ${fromCache ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:.38rem;color:var(--sub);text-align:center;margin-top:.5rem;">📦 Gecached · verloopt na 6u</div>` : ''}
    <button onclick="localStorage.removeItem('wk_match_analyse_${home}_${away}'); analyseWKMatch(0,'${home}','${away}',${JSON.stringify(odds)})"
      style="width:100%;margin-top:.75rem;background:transparent;border:1px solid var(--stroke);border-radius:10px;
      padding:.4rem;font-family:'IBM Plex Mono',monospace;font-size:.42rem;color:var(--sub);cursor:pointer;">
      ↻ Nieuwe analyse
    </button>`;
}
