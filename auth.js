// ═══════════════════════════════════════════════════════
// AUTH — Firebase authenticatie v15.0
// Fixes: switchLoginTab IDs, Google login popup fallback,
//        element ID sync met index.html
// ═══════════════════════════════════════════════════════

let _firebaseAuth = null;
let _currentUser  = null;

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
        showToast(t('auth.loggedinas','✅ Ingelogd als ') + (result.user.displayName || result.user.email));
      }
    }).catch(e => {
      if (e.code && e.code !== 'auth/no-current-user') {
        console.warn('[Auth] Redirect result fout:', e.code, e.message);
      }
    });

    // Auth state listener
    _firebaseAuth.onAuthStateChanged(user => {
      _currentUser = user;
      if (user && !user.isAnonymous) {
        console.log('[Auth] Ingelogd:', user.email);
        localStorage.removeItem('totoai_skip_login');
        hideLoginScreen();

        // Topbar bijwerken
        const topbarUser = document.getElementById('topbar-user');
        if (topbarUser) {
          topbarUser.textContent = user.displayName || user.email?.split('@')[0] || '👤';
          topbarUser.style.display = 'block';
        }
        const loginDot = document.getElementById('login-status-dot');
        if (loginDot) loginDot.style.background = '#16a34a';
        const loginBtn = document.getElementById('topbar-login-btn');
        if (loginBtn) loginBtn.style.display = 'flex';

        // Auth sectie in instellingen
        _updateAuthSection(user);

        sessionStorage.setItem('totoai_was_logged_in', '1');

        // Laad keys vanuit Firebase dan start app
        if (typeof loadFromFirebase === 'function') {
          loadFromFirebase().then(() => {
            saveState();
            _startApp();
            showToast(t('auth.keysloaded','✅ Keys geladen vanuit Firebase'));
          }).catch(() => _startApp());
        } else {
          _startApp();
        }
      } else if (user) {
        // anoniem ingelogd — app werkt + geauthenticeerd, UI toont 'niet ingelogd'
        console.log('[Auth] Anoniem ingelogd (uid ' + (user.uid||'').slice(0,6) + '…)');
        sessionStorage.removeItem('totoai_was_logged_in');
        hideLoginScreen();
        const topbarUser = document.getElementById('topbar-user');
        if (topbarUser) topbarUser.style.display = 'none';
        const loginDot = document.getElementById('login-status-dot');
        if (loginDot) loginDot.style.background = '#dc2626';
        const loginBtn = document.getElementById('topbar-login-btn');
        if (loginBtn) loginBtn.style.display = 'flex';
        _startApp();
      } else {
        // geen sessie → anoniem inloggen; valt veilig terug als provider uit staat
        console.log('[Auth] Geen sessie — anonieme sign-in proberen');
        sessionStorage.removeItem('totoai_was_logged_in');
        if (_firebaseAuth && _firebaseAuth.signInAnonymously) {
          _firebaseAuth.signInAnonymously().catch(e => {
            console.warn('[Auth] Anonieme sign-in niet beschikbaar:', e && (e.code || e.message));
            hideLoginScreen();
            const lb = document.getElementById('topbar-login-btn'); if (lb) lb.style.display = 'flex';
            const ld = document.getElementById('login-status-dot'); if (ld) ld.style.background = '#dc2626';
            _startApp();
          });
        } else {
          hideLoginScreen();
          _startApp();
        }
      }
    });
  } catch(e) {
    console.error('[Auth] Init mislukt:', e.message);
    hideLoginScreen();
    _startApp();
  }
}

function _startApp() {
  const app    = document.getElementById('app');
  const nav    = document.getElementById('bottom-nav');
  const topbar = document.getElementById('topbar');
  if (app)    app.style.display    = 'block';
  if (nav)    nav.style.display    = 'flex';
  if (topbar) topbar.style.display = 'flex';
  if (typeof switchScreen === 'function') switchScreen('dashboard');
  if (typeof applySettings === 'function') applySettings();
}

function _updateAuthSection(user) {
  const authSection = document.getElementById('authAccountSection');
  if (authSection) {
    authSection.innerHTML = `
      <div style="font-family:monospace;font-size:.55rem;line-height:1.7;">
        ✅ Ingelogd als <b>${user.displayName || user.email}</b><br>
        <button onclick="logoutUser()"
          style="font-family:monospace;font-size:.5rem;padding:3px 10px;border-radius:8px;
          border:1px solid rgba(220,38,38,.3);background:rgba(220,38,38,.08);
          color:#dc2626;cursor:pointer;margin-top:.3rem;">
          Uitloggen
        </button>
      </div>`;
  }
}

// ── LOGIN SCHERM ──────────────────────────────────────────

function showLoginScreen() {
  window.location.href = 'login.html';
}

function hideLoginScreen() {
  const ls = document.getElementById('screen-login');
  if (ls) ls.classList.remove('active');
}

// switchLoginTab — werkt met 'in'/'reg' (index.html) EN 'login'/'register' (legacy)
function switchLoginTab(tab) {
  // Normaliseer: 'login' → 'in', 'register' → 'reg'
  if (tab === 'login')    tab = 'in';
  if (tab === 'register') tab = 'reg';

  const formIn  = document.getElementById('login-form-in');
  const formReg = document.getElementById('login-form-reg');
  const btnIn   = document.getElementById('login-tab-in');
  const btnReg  = document.getElementById('login-tab-reg');
  if (!formIn || !formReg) return;

  const activeStyle   = 'linear-gradient(135deg,rgba(219,39,119,.9),rgba(124,58,237,.8))';
  const inactiveStyle = 'transparent';

  if (tab === 'in') {
    formIn.style.display  = 'block';
    formReg.style.display = 'none';
    if (btnIn)  { btnIn.style.background  = activeStyle;   btnIn.style.color  = '#fff'; }
    if (btnReg) { btnReg.style.background = inactiveStyle; btnReg.style.color = 'var(--sub)'; }
  } else {
    formIn.style.display  = 'none';
    formReg.style.display = 'block';
    if (btnIn)  { btnIn.style.background  = inactiveStyle; btnIn.style.color  = 'var(--sub)'; }
    if (btnReg) { btnReg.style.background = activeStyle;   btnReg.style.color = '#fff'; }
  }

  // Foutmelding wissen
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.textContent = '';
}

function skipLoginAndEnter() {
  localStorage.setItem('totoai_skip_login', '1');
  localStorage.setItem('totoai_onboarding_done', '1');
  hideLoginScreen();
  if (typeof switchScreen === 'function') switchScreen('dashboard');
}

function skipOnboarding() {
  localStorage.setItem('totoai_onboarding_done', '1');
  const ob = document.getElementById('onboardingScreen');
  if (ob) ob.style.display = 'none';
  const app = document.getElementById('app');
  if (app) app.style.display = 'block';
  setTimeout(() => { if (typeof switchScreen === 'function') switchScreen('wedstrijden'); }, 300);
}

// ── LOGIN ACTIES ──────────────────────────────────────────

async function loginWithEmail() {
  // Ondersteunt beide ID-stijlen
  const email    = (document.getElementById('login-email') || document.getElementById('loginEmail'))?.value.trim();
  const password = (document.getElementById('login-password') || document.getElementById('loginPassword'))?.value;
  const btn      = document.querySelector('#login-form-in .login-submit-btn');

  if (!email || !password) { showToast(t('auth.fillcredentials','Vul email en wachtwoord in')); return; }
  if (btn) { btn.textContent = '⟳ Inloggen...'; btn.disabled = true; }

  try {
    if (!_firebaseAuth) throw new Error('Firebase niet beschikbaar');
    await _firebaseAuth.signInWithEmailAndPassword(email, password);
  } catch(e) {
    const msgs = {
      'auth/user-not-found':    'Geen account gevonden',
      'auth/wrong-password':    'Verkeerd wachtwoord',
      'auth/invalid-email':     'Ongeldig emailadres',
      'auth/invalid-credential':'Email of wachtwoord onjuist',
      'auth/too-many-requests': 'Te veel pogingen, probeer later'
    };
    showToast('❌ ' + (msgs[e.code] || e.message));
    if (btn) { btn.textContent = 'Inloggen'; btn.disabled = false; }
  }
}

async function registerWithEmail() {
  const email     = (document.getElementById('reg-email')      || document.getElementById('registerEmail'))?.value.trim();
  const password  = (document.getElementById('reg-password')   || document.getElementById('registerPassword'))?.value;
  const password2 = (document.getElementById('reg-password2'))?.value;
  const btn       = document.querySelector('#login-form-reg .login-submit-btn');

  if (!email || !password) { showToast(t('auth.fillcredentials','Vul email en wachtwoord in')); return; }
  if (password.length < 6) { showToast(t('auth.pwmin','Wachtwoord min. 6 tekens')); return; }
  if (password2 !== undefined && password !== password2) { showToast(t('auth.pwmismatch','Wachtwoorden komen niet overeen')); return; }
  if (btn) { btn.textContent = '⟳ Account aanmaken...'; btn.disabled = true; }

  try {
    if (!_firebaseAuth) throw new Error('Firebase niet beschikbaar');
    await _firebaseAuth.createUserWithEmailAndPassword(email, password);
    showToast(t('auth.accountcreated','✅ Account aangemaakt!'));
  } catch(e) {
    const msgs = {
      'auth/email-already-in-use': 'Email al in gebruik',
      'auth/invalid-email':        'Ongeldig emailadres',
      'auth/weak-password':        'Wachtwoord te zwak'
    };
    showToast('❌ ' + (msgs[e.code] || e.message));
    if (btn) { btn.textContent = 'Account aanmaken'; btn.disabled = false; }
  }
}

async function loginWithGoogle() {
  try {
    if (!_firebaseAuth) throw new Error('Firebase niet beschikbaar');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Probeer popup eerst (werkt beter in PWA/TWA)
    // Val terug op redirect als popup geblokkeerd wordt
    try {
      showToast(t('auth.googlelogin','⟳ Google login...'));
      const result = await _firebaseAuth.signInWithPopup(provider);
      if (result?.user) {
        showToast(t('auth.loggedinas','✅ Ingelogd als ') + (result.user.displayName || result.user.email));
      }
    } catch(popupErr) {
      // Popup geblokkeerd of niet ondersteund → redirect
      if (popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/popup-closed-by-user' ||
          popupErr.code === 'auth/cancelled-popup-request') {
        showToast(t('auth.googleredirect','⟳ Doorsturen naar Google...'));
        await _firebaseAuth.signInWithRedirect(provider);
      } else {
        throw popupErr;
      }
    }
  } catch(e) {
    console.error('[Auth] Google login fout:', e.code, e.message);
    showToast(t('auth.googlefailed','❌ Google login mislukt: ') + (e.message || e.code));
  }
}

async function logoutUser() {
  try {
    if (_firebaseAuth) await _firebaseAuth.signOut();
    showAutoCheckBar('👋 Uitgelogd', 2000);

    // Topbar reset
    const topbarUser = document.getElementById('topbar-user');
    if (topbarUser) topbarUser.style.display = 'none';
    const loginDot = document.getElementById('login-status-dot');
    if (loginDot) loginDot.style.background = '#dc2626';

    // Auth sectie reset
    const authSection = document.getElementById('authAccountSection');
    if (authSection) {
      authSection.innerHTML = `
        <div style="font-family:monospace;font-size:.55rem;color:var(--sub);margin-bottom:.6rem;line-height:1.6;">
          Log in om data te synchroniseren tussen apparaten.
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          <button class="small-action-btn" onclick="showLoginScreen()">🔐 Inloggen / Registreren</button>
        </div>`;
    }
  } catch(e) {
    console.error('[Auth] Logout fout:', e);
  }
}

function handleLoginBtnClick() {
  const cu = _firebaseAuth && _firebaseAuth.currentUser;
  if (cu && !cu.isAnonymous) {
    switchScreen('instellingen');
    showToast(t('auth.loggedinas','✅ Ingelogd als ') + (cu.displayName || cu.email));
  } else {
    showLoginScreen();
  }
}
