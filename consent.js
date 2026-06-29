// ProMatchXI — cookie/consent banner (Google Consent Mode v2)
// Toont een banner tot de gebruiker kiest; standaard = analytics geweigerd (AVG/Play Store).
// Heropenen vanuit instellingen kan via window.pmxOpenConsent().
(function () {
  'use strict';
  var KEY = 'pmx_consent';

  function getLang() {
    try {
      var l = localStorage.getItem('pmx_lang');
      if (l) return l.slice(0, 2).toLowerCase() === 'en' ? 'en' : 'nl';
    } catch (e) {}
    var h = (document.documentElement.getAttribute('lang') || navigator.language || 'nl')
      .slice(0, 2).toLowerCase();
    return h === 'en' ? 'en' : 'nl';
  }

  var T = {
    nl: {
      title: 'Cookies & privacy',
      body: 'We gebruiken alleen anonieme analytics (Google Analytics) om de app te verbeteren. Geen advertenties, geen verkoop van gegevens. Je kunt dit later wijzigen in Instellingen.',
      accept: 'Accepteren',
      reject: 'Weigeren',
      more: 'Privacybeleid'
    },
    en: {
      title: 'Cookies & privacy',
      body: 'We only use anonymous analytics (Google Analytics) to improve the app. No ads, no selling of data. You can change this later in Settings.',
      accept: 'Accept',
      reject: 'Decline',
      more: 'Privacy policy'
    }
  };

  function grant() {
    try { if (typeof gtag === 'function') gtag('consent', 'update', { 'analytics_storage': 'granted' }); } catch (e) {}
  }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function removeEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function build() {
    if (document.getElementById('pmx-consent')) return;
    var lang = getLang();
    var t = T[lang] || T.nl;

    if (!document.getElementById('pmx-consent-style')) {
      var style = document.createElement('style');
      style.id = 'pmx-consent-style';
      style.textContent =
        '#pmx-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;max-width:560px;margin:0 auto;' +
        'background:#0f172a;color:#e2e8f0;border:1px solid #1e293b;border-radius:16px;padding:18px 18px 16px;' +
        'box-shadow:0 12px 40px rgba(0,0,0,.45);font-family:inherit;animation:pmxc-in .25s ease}' +
        '@keyframes pmxc-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
        '#pmx-consent h3{margin:0 0 6px;font-size:16px;font-weight:700;color:#5eead4}' +
        '#pmx-consent p{margin:0 0 14px;font-size:13.5px;line-height:1.5;color:#cbd5e1}' +
        '#pmx-consent a{color:#5eead4;text-decoration:underline}' +
        '#pmx-consent .pmxc-row{display:flex;gap:10px;flex-wrap:wrap}' +
        '#pmx-consent button{flex:1 1 120px;border:0;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:600;cursor:pointer}' +
        '#pmx-consent .pmxc-acc{background:#14b8a6;color:#04211d}' +
        '#pmx-consent .pmxc-rej{background:#1e293b;color:#e2e8f0;border:1px solid #334155}';
      document.head.appendChild(style);
    }

    var box = document.createElement('div');
    box.id = 'pmx-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.innerHTML =
      '<h3>' + t.title + '</h3>' +
      '<p>' + t.body + ' <a href="privacy.html">' + t.more + '</a></p>' +
      '<div class="pmxc-row">' +
        '<button class="pmxc-rej" type="button">' + t.reject + '</button>' +
        '<button class="pmxc-acc" type="button">' + t.accept + '</button>' +
      '</div>';
    document.body.appendChild(box);

    box.querySelector('.pmxc-acc').addEventListener('click', function () { grant(); store('granted'); removeEl(box); });
    box.querySelector('.pmxc-rej').addEventListener('click', function () { store('denied'); removeEl(box); });
  }

  function init() {
    var choice = null;
    try { choice = localStorage.getItem(KEY); } catch (e) {}
    if (choice !== 'granted' && choice !== 'denied') {
      if (document.body) build();
      else document.addEventListener('DOMContentLoaded', build);
    }
  }

  // Heropenen vanuit Instellingen (cookievoorkeuren wijzigen)
  window.pmxOpenConsent = function () { build(); };

  init();
})();
