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
      'common.no': 'Nee'
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
      'common.no': 'No'
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

  // html lang gelijktrekken met opgeslagen voorkeur (vóór state geladen is)
  try { document.documentElement.setAttribute('lang', currentLang()); } catch (e) {}
})();
