// i18n.js — ProMatchXI interface-vertaling (Fase 1: fundament)
// NL is de standaard én de fallback. Ontbrekende sleutels vallen terug op NL, dan op de sleutel zelf.
// Schermen worden in latere fases stap voor stap op t('sleutel') gezet.
(function () {
  'use strict';

  var I18N = {
    nl: {
      'settings.lang.title': 'TAAL / LANGUAGE',
      'settings.lang.hint': 'De interface wordt stap voor stap vertaald. Nederlands is de standaard; teksten die nog niet vertaald zijn, blijven voorlopig Nederlands. De wedstrijdanalyses zelf blijven (nog) Nederlands.',
      'settings.lang.nl': 'Nederlands',
      'settings.lang.en': 'Engels',
      // veelgebruikte basis (seed voor latere fases)
      'common.save': 'Opslaan',
      'common.cancel': 'Annuleren',
      'common.close': 'Sluiten',
      'common.back': 'Terug',
      'common.loading': 'Laden…',
      'common.yes': 'Ja',
      'common.no': 'Nee',
      // app-chrome (fase 2) — NL ongewijzigd t.o.v. huidige labels
      'nav.home': 'Home',
      'nav.matches': 'Matches',
      'nav.analyse': 'Analyse',
      'nav.wallet': 'Wallet',
      'nav.wk': 'WK 2026',
      'nav.settings': 'Instellingen',
      'login.signin': 'Inloggen',
      'login.register': 'Registreren',
      'settings.cookies': 'Cookievoorkeuren',
      // Instellingen-sectietitels (fase 2 vervolg)
      'set.sec.apikeys': 'API KEYS',
      'set.sec.defaults': 'STANDAARD INSTELLINGEN',
      'set.sec.triplelock': 'TRIPLE LOCK CRITERIA',
      'set.sec.pickdisplay': 'PICK-WEERGAVE',
      'set.sec.push': 'PUSH NOTIFICATIES',
      'set.sec.autoscan': 'AUTOMATISCHE SCAN',
      'set.sec.theme': 'THEMA',
      'set.sec.wallet': 'WALLET BEHEER',
      'set.sec.analytics': 'ANALYTICS',
      'set.sec.cloudbackup': 'CLOUD BACKUP',
      'set.sec.localbackup': 'LOKALE BACKUP',
      'set.sec.costs': 'KOSTEN TRACKER',
      'set.sec.account': 'ACCOUNT',
      'set.sec.dbsecurity': 'DATABASE BEVEILIGING',
      'set.sec.admin': 'ADMIN TOOLS',
      'set.sec.appinfo': 'APP INFO',
      'set.save': 'OPSLAAN',
      // Modals
      'modal.bet.title': 'Weddenschap toevoegen',
      'modal.tracker.title': 'Tracker toevoegen',
      'modal.deposit': 'Storten',
      'modal.match': 'Wedstrijd',
      'modal.stake': 'Inzet (€)',
      'modal.odds': 'Odds',
      'modal.type': 'Type',
      'modal.note': 'Notitie (optioneel)',
      'modal.name': 'Naam / label',
      'modal.legs': 'Legs',
      'modal.totalodds': 'Totale odds (berekend)',
      'modal.amount': 'Bedrag (€)',
      'modal.add': 'Toevoegen',
      'modal.addleg': '+ Leg toevoegen',
      'opt.single': 'Enkelvoudig',
      'opt.combi': 'Combinatie',
      'opt.btts': 'Beide scoren',
      'opt.other': 'Overig'
    },
    en: {
      'settings.lang.title': 'LANGUAGE / TAAL',
      'settings.lang.hint': 'The interface is being translated step by step. Dutch is the default; text that has not been translated yet stays Dutch for now. The match analyses themselves remain in Dutch (for now).',
      'settings.lang.nl': 'Dutch',
      'settings.lang.en': 'English',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'common.back': 'Back',
      'common.loading': 'Loading…',
      'common.yes': 'Yes',
      'common.no': 'No',
      'nav.home': 'Home',
      'nav.matches': 'Matches',
      'nav.analyse': 'Analysis',
      'nav.wallet': 'Wallet',
      'nav.wk': 'WC 2026',
      'nav.settings': 'Settings',
      'login.signin': 'Sign in',
      'login.register': 'Register',
      'settings.cookies': 'Cookie preferences',
      'set.sec.apikeys': 'API KEYS',
      'set.sec.defaults': 'DEFAULT SETTINGS',
      'set.sec.triplelock': 'TRIPLE LOCK CRITERIA',
      'set.sec.pickdisplay': 'PICK DISPLAY',
      'set.sec.push': 'PUSH NOTIFICATIONS',
      'set.sec.autoscan': 'AUTOMATIC SCAN',
      'set.sec.theme': 'THEME',
      'set.sec.wallet': 'WALLET MANAGEMENT',
      'set.sec.analytics': 'ANALYTICS',
      'set.sec.cloudbackup': 'CLOUD BACKUP',
      'set.sec.localbackup': 'LOCAL BACKUP',
      'set.sec.costs': 'COST TRACKER',
      'set.sec.account': 'ACCOUNT',
      'set.sec.dbsecurity': 'DATABASE SECURITY',
      'set.sec.admin': 'ADMIN TOOLS',
      'set.sec.appinfo': 'APP INFO',
      'set.save': 'SAVE',
      'modal.bet.title': 'Add bet',
      'modal.tracker.title': 'Add tracker',
      'modal.deposit': 'Deposit',
      'modal.match': 'Match',
      'modal.stake': 'Stake (€)',
      'modal.odds': 'Odds',
      'modal.type': 'Type',
      'modal.note': 'Note (optional)',
      'modal.name': 'Name / label',
      'modal.legs': 'Legs',
      'modal.totalodds': 'Total odds (calculated)',
      'modal.amount': 'Amount (€)',
      'modal.add': 'Add',
      'modal.addleg': '+ Add leg',
      'opt.single': 'Single',
      'opt.combi': 'Combination',
      'opt.btts': 'Both teams to score',
      'opt.other': 'Other'
    }
  };

  function currentLang() {
    try {
      if (typeof state !== 'undefined' && state.settings && state.settings.lang) {
        return state.settings.lang === 'en' ? 'en' : 'nl';
      }
    } catch (e) {}
    try {
      var l = localStorage.getItem('pmx_lang');
      if (l) return l === 'en' ? 'en' : 'nl';
    } catch (e) {}
    return 'nl';
  }

  // t('sleutel', optioneleFallback) — kernhelper voor de hele app
  function t(key, fallback) {
    var lang = currentLang();
    var tbl = I18N[lang] || I18N.nl;
    if (tbl && tbl[key] != null) return tbl[key];
    if (I18N.nl && I18N.nl[key] != null) return I18N.nl[key];
    return fallback != null ? fallback : key;
  }

  // Taal wisselen: opslaan + html lang + state + herladen zodat alle schermen opnieuw renderen
  function setAppLang(lang) {
    lang = (lang === 'en') ? 'en' : 'nl';
    if (currentLang() === lang) return; // niets te doen
    try { if (typeof state !== 'undefined' && state.settings) state.settings.lang = lang; } catch (e) {}
    try { localStorage.setItem('pmx_lang', lang); } catch (e) {}
    try { document.documentElement.setAttribute('lang', lang); } catch (e) {}
    try { if (typeof saveState === 'function') saveState(); } catch (e) {}
    try { location.reload(); } catch (e) {}
  }

  // exporteren naar globale scope
  window.I18N       = I18N;
  window.t          = t;     // canonieke helper
  window.tr         = t;     // veilig alias (mocht 't' ooit botsen)
  window.pmxLang    = currentLang;
  window.setAppLang = setAppLang;

  // Statische HTML vertalen: elk element met data-i18n / data-i18n-ph
  function applyStaticI18n(root) {
    root = root || document;
    try {
      var nodes = root.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var k = nodes[i].getAttribute('data-i18n');
        if (k) nodes[i].textContent = t(k);
      }
      var ph = root.querySelectorAll('[data-i18n-ph]');
      for (var j = 0; j < ph.length; j++) {
        var pk = ph[j].getAttribute('data-i18n-ph');
        if (pk) ph[j].setAttribute('placeholder', t(pk));
      }
    } catch (e) {}
  }
  window.applyStaticI18n = applyStaticI18n;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyStaticI18n(); });
  } else {
    applyStaticI18n();
  }

  // html lang gelijktrekken met opgeslagen voorkeur (vóór state geladen is)
  try { document.documentElement.setAttribute('lang', currentLang()); } catch (e) {}
})();
