// ═══════════════════════════════════════════════════════
// AUTH — Firebase authenticatie (optioneel — app werkt zonder login)
// ═══════════════════════════════════════════════════════

let _firebaseAuth  = null;
let _currentUser   = null;

function initFirebaseAuth() {
  try {
    let app;
    try { app = firebase.app(); } catch(e) {
      app = firebase.initializeApp({
        apiKey:           'AIzaSyB7K4SXPdxHSPIvFyXOfY2bpehcNnjRM-M',
        authDomain:       'toto-ai-397cb.firebaseapp.com',
        projectId:        'toto-ai-397cb',
        messagingSenderId:'426083019907',
        appId:            '1:426083019907:web:8f32f8037628d63cbbbfb6',
        databaseURL:      'https://toto-ai-397cb-default-rtdb.europe-west1.firebasedatabase.app'
      });
    }
    _firebaseAuth = firebase.auth();

    // Verwerk redirect resultaat na Google login
    _firebaseAuth.getRedirectResult().then(result => {
      if (result?.user) {
        console.log('[Auth] Redirect login gelukt:', result.user.email);
      }
    }).catch(e => console.warn('[Auth] Redirect result:', e.message));

    // Auth state listener
    _firebaseAuth.onAuthStateChanged(user => {
      _currentUser = user;
      if (user) {
        console.log('[Auth] Ingelogd:', user.email);
        localStorage.removeItem('totoai_skip_login');
        hideLoginScreen();
        // Toon in instellingen
        const userEl = document.getElementById('authUserInfo');
        if (userEl) {
          userEl.innerHTML = `✅ <b>${user.displayName||user.email}</b>
            <button onclick="logoutUser()" style="margin-left:.4rem;font-family:monospace;font-size:.45rem;padding:2px 7px;border-radius:7px;border:1px solid rgba(220,38,38,.3);background:rgba(220,38,38,.08);color:#dc2626;cursor:pointer;">Uitloggen</button>`;
        }
        const authSection = document.getElementById('authAccountSection');
        if (authSection) {
          authSection.innerHTML = `<div style="font-family:monospace;font-size:.55rem;line-height:1.7;">
            ✅ Ingelogd als <b>${user.displayName||user.email}</b><br>
            <button onclick="logoutUser()" style="font-family:monospace;font-size:.5rem;padding:3px 10px;border-radius:8px;border:1px solid rgba(220,38,38,.3);background:rgba(220,38,38,.08);color:#dc2626;cursor:pointer;margin-top:.3rem;">Uitloggen</button>
          </div>`;
        }
        sessionStorage.setItem('totoai_was_logged_in','1');
        // Toon gebruiker in topbar
        const topbarUser = document.getElementById('topbar-user');
        if (topbarUser) {
          topbarUser.textContent = user.displayName || user.email?.split('@')[0] || '👤';
          topbarUser.style.display = 'block';
        }
        // Laad keys en data automatisch vanuit Firebase
        if (typeof loadFromFirebase === 'function') {
          loadFromFirebase().then(() => {
            saveState();
            // App tonen na laden
            const app = document.getElementById('app');
            const nav = document.getElementById('bottom-nav');
            const topbar = document.getElementById('topbar');
            if (app) app.style.display = 'block';
            if (nav) nav.style.display = 'flex';
            if (topbar) topbar.style.display = 'flex';
            if (typeof switchScreen === 'function') switchScreen('dashboard');
            if (typeof applySettings === 'function') applySettings();
            showToast('✅ Keys geladen vanuit Firebase');
          }).catch(() => {
            const app = document.getElementById('app');
            const nav = document.getElementById('bottom-nav');
            const topbar = document.getElementById('topbar');
            if (app) app.style.display = 'block';
            if (nav) nav.style.display = 'flex';
            if (topbar) topbar.style.display = 'flex';
            if (typeof switchScreen === 'function') switchScreen('dashboard');
          });
        } else {
          const app = document.getElementById('app');
          const nav = document.getElementById('bottom-nav');
          const topbar = document.getElementById('topbar');
          if (app) app.style.display = 'block';
          if (nav) nav.style.display = 'flex';
          if (topbar) topbar.style.display = 'flex';
          if (typeof switchScreen === 'function') switchScreen('dashboard');
        }
      } else {
        console.log('[Auth] Niet ingelogd — app werkt zonder auth');
        sessionStorage.removeItem('totoai_was_logged_in');
        hideLoginScreen();
        // Start app zonder login
        const app = document.getElementById('app');
        const nav = document.getElementById('bottom-nav');
        const topbar = document.getElementById('topbar');
        if (app) app.style.display = 'block';
        if (nav) nav.style.display = 'flex';
        if (topbar) topbar.style.display = 'flex';
        if (typeof switchScreen === 'function') switchScreen('dashboard');
      }
    });
  } catch(e) {
    console.error('[Auth] Init mislukt:', e.message);
    hideLoginScreen();
  }
}

// ── LOGIN SCHERM ──────────────────────────────────────

function renderLoginScreen() {
  const existing = document.getElementById('loginScreen');
  if (existing) { existing.style.display='flex'; return; }

  const div = document.createElement('div');
  div.id = 'loginScreen';
  div.style.cssText = 'position:fixed;inset:0;z-index:9000;background:var(--bg1);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;';
  div.innerHTML = `
    <div style="width:100%;max-width:380px;">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:2.5rem;letter-spacing:.08em;
          background:linear-gradient(135deg,#ff9ac1,#a78bfa,#6bb6ff);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">TOTO AI</div>
        <div style="font-family:'Dancing Script',cursive;font-size:.9rem;color:var(--sub);">door AppsMadeByRobB</div>
      </div>

      <!-- Tab knoppen -->
      <div style="display:flex;gap:.3rem;margin-bottom:1rem;background:rgba(0,0,0,.05);border-radius:12px;padding:3px;">
        <button id="loginTabBtn" onclick="switchLoginTab('login')"
          style="flex:1;font-family:monospace;font-size:.6rem;font-weight:700;padding:.5rem;border-radius:9px;border:none;cursor:pointer;
          background:linear-gradient(135deg,rgba(219,39,119,.9),rgba(124,58,237,.8));color:#fff;">Inloggen</button>
        <button id="registerTabBtn" onclick="switchLoginTab('register')"
          style="flex:1;font-family:monospace;font-size:.6rem;font-weight:700;padding:.5rem;border-radius:9px;border:none;cursor:pointer;
          background:transparent;color:var(--sub);">Registreren</button>
      </div>

      <div id="loginError" style="font-family:monospace;font-size:.55rem;color:#dc2626;min-height:1.2em;margin-bottom:.5rem;"></div>

      <!-- Login form -->
      <div id="loginForm">
        <input id="loginEmail" type="email" placeholder="E-mailadres" class="modal-input" style="margin-bottom:.4rem;">
        <input id="loginPassword" type="password" placeholder="Wachtwoord" class="modal-input" style="margin-bottom:.75rem;">
        <button onclick="loginWithEmail()" class="save-settings-btn" style="margin-bottom:.5rem;">Inloggen</button>
        <button onclick="loginWithGoogle()" style="width:100%;font-family:monospace;font-size:.6rem;font-weight:700;
          padding:.7rem;border-radius:12px;border:1.5px solid var(--stroke);background:var(--card);color:var(--ink);cursor:pointer;margin-bottom:.75rem;">
          🌐 Inloggen met Google
        </button>
      </div>

      <!-- Register form -->
      <div id="registerForm" style="display:none;">
        <input id="registerName" type="text" placeholder="Naam (optioneel)" class="modal-input" style="margin-bottom:.4rem;">
        <input id="registerEmail" type="email" placeholder="E-mailadres" class="modal-input" style="margin-bottom:.4rem;">
        <input id="registerPassword" type="password" placeholder="Wachtwoord (min 6 tekens)" class="modal-input" style="margin-bottom:.75rem;">
        <button onclick="registerWithEmail()" class="save-settings-btn">Account aanmaken</button>
      </div>

      <button onclick="skipLoginAndEnter()"
        style="width:100%;font-family:monospace;font-size:.52rem;color:var(--sub);
        background:transparent;border:none;cursor:pointer;margin-top:.75rem;padding:.5rem;text-decoration:underline;">
        Overslaan — gratis zonder account gebruiken
      </button>
    </div>
  `;
  document.body.appendChild(div);
}

function showLoginScreen() {
  if (localStorage.getItem('totoai_skip_login')) { hideLoginScreen(); return; }
  // Gebruik het bestaande screen-login in de HTML
  const ls = document.getElementById('screen-login');
  if (ls) ls.classList.add('active');
}

function hideLoginScreen() {
  const ls = document.getElementById('screen-login');
  if (ls) ls.classList.remove('active');
}

function skipLoginAndEnter() {
  localStorage.setItem('totoai_skip_login','1');
  localStorage.setItem('totoai_onboarding_done','1');
  hideLoginScreen();
  switchScreen('dashboard');
}

function skipOnboarding() {
  localStorage.setItem('totoai_onboarding_done','1');
  const ob = document.getElementById('onboardingScreen');
  if (ob) ob.style.display='none';
  const app = document.getElementById('app');
  if (app) app.style.display='block';
  setTimeout(()=>switchScreen('wedstrijden'),300);
}

function switchLoginTab(tab) {
  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBtn     = document.getElementById('loginTabBtn');
  const registerBtn  = document.getElementById('registerTabBtn');
  if (!loginForm||!registerForm) return;

  const active='linear-gradient(135deg,rgba(219,39,119,.9),rgba(124,58,237,.8))';
  const inactive='transparent';

  if (tab==='login') {
    loginForm.style.display='block'; registerForm.style.display='none';
    if (loginBtn)    { loginBtn.style.background=active; loginBtn.style.color='#fff'; }
    if (registerBtn) { registerBtn.style.background=inactive; registerBtn.style.color='var(--sub)'; }
  } else {
    loginForm.style.display='none'; registerForm.style.display='block';
    if (loginBtn)    { loginBtn.style.background=inactive; loginBtn.style.color='var(--sub)'; }
    if (registerBtn) { registerBtn.style.background=active; registerBtn.style.color='#fff'; }
  }
  const errEl=document.getElementById('loginError');
  if (errEl) errEl.textContent='';
}

// ── LOGIN ACTIES ─────────────────────────────────────

async function loginWithEmail() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn      = document.querySelector('#login-form-in .login-submit-btn');
  if (!email||!password) { showToast('Vul email en wachtwoord in'); return; }
  if (btn) { btn.textContent = '⟳ Inloggen...'; btn.disabled = true; }
  try {
    if (!_firebaseAuth) throw new Error('Firebase niet beschikbaar');
    await _firebaseAuth.signInWithEmailAndPassword(email, password);
  } catch(e) {
    const msgs = {
      'auth/user-not-found':    'Geen account gevonden',
      'auth/wrong-password':    'Verkeerd wachtwoord',
      'auth/invalid-email':     'Ongeldig email adres',
      'auth/invalid-credential':'Email of wachtwoord onjuist',
      'auth/too-many-requests': 'Te veel pogingen, probeer later'
    };
    showToast('❌ ' + (msgs[e.code] || e.message));
    if (btn) { btn.textContent = 'Inloggen'; btn.disabled = false; }
  }
}

async function registerWithEmail() {
  const email    = document.getElementById('reg-email')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const password2= document.getElementById('reg-password2')?.value;
  const btn      = document.querySelector('#login-form-reg .login-submit-btn');
  if (!email||!password) { showToast('Vul email en wachtwoord in'); return; }
  if (password.length<6) { showToast('Wachtwoord min. 6 tekens'); return; }
  if (password !== password2) { showToast('Wachtwoorden komen niet overeen'); return; }
  if (btn) { btn.textContent = '⟳ Account aanmaken...'; btn.disabled = true; }
  try {
    if (!_firebaseAuth) throw new Error('Firebase niet beschikbaar');
    await _firebaseAuth.createUserWithEmailAndPassword(email, password);
    showToast('✅ Account aangemaakt!');
  } catch(e) {
    const msgs = {
      'auth/email-already-in-use':'Email al in gebruik',
      'auth/invalid-email':       'Ongeldig email adres',
      'auth/weak-password':       'Wachtwoord te zwak'
    };
    showToast('❌ ' + (msgs[e.code] || e.message));
    if (btn) { btn.textContent = 'Account aanmaken'; btn.disabled = false; }
  }
}

async function loginWithGoogle() {
  try {
    if (!_firebaseAuth) throw new Error('Firebase niet beschikbaar');
    const provider = new firebase.auth.GoogleAuthProvider();
    showToast('⟳ Google inloggen...');
    // Probeer popup eerst, fallback naar redirect
    try {
      await _firebaseAuth.signInWithPopup(provider);
    } catch(popupErr) {
      if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
        await _firebaseAuth.signInWithRedirect(provider);
      } else throw popupErr;
    }
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showToast('❌ Google login mislukt: ' + (e.message||e.code));
    }
  }
}

async function logoutUser() {
  try {
    if (_firebaseAuth) await _firebaseAuth.signOut();
    showAutoCheckBar('👋 Uitgelogd',2000);
    // Update auth sectie in instellingen
    const authSection = document.getElementById('authAccountSection');
    if (authSection) {
      authSection.innerHTML = `<div style="font-family:monospace;font-size:.55rem;color:var(--sub);margin-bottom:.6rem;line-height:1.6;">
        Log in om data te synchroniseren tussen apparaten.
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
        <button class="small-action-btn" onclick="showLoginScreen()">🔐 Inloggen / Registreren</button>
      </div>`;
    }
    const userEl = document.getElementById('authUserInfo');
    if (userEl) userEl.innerHTML='';
  } catch(e) {}
}
