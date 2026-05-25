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
    </div>
  `;

  // Laad gecachte voorspelling of toon lege staat
  loadCachedWKPrediction();
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
    const WORKER = 'https://toto-proxy.zweetzakken.workers.dev';
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
