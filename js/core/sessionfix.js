// js/core/sessionfix.js
// Fixpack 20260519_sessionfix1
// Obiettivo: NON toccare funzioni/moduli/permessi/account.
// Aggiunge solo stabilità a:
// - sessione login (min 24h)
// - logout: overlay login resta visibile
// - refresh: resta nella modalità corrente (non torna welcome)
// - welcome: solo dopo login o click logo (force_welcome)

(function(){
  'use strict';

  const AUTH_KEY = 'abitare_tools_auth_user';
  const FORCE_LOGIN_KEY = 'abitare_tools_force_login';
  const FORCE_WELCOME_KEY = 'abitare_tools_force_welcome';
  const LAST_MODE_KEY = 'abitare_tools_last_mode';

  const AUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  const now = () => Date.now();

  const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const pack = (payload, ttl) => JSON.stringify({ v: 1, exp: now() + ttl, payload });
  const unpack = (raw) => {
    const obj = safeJson(raw);
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.exp) return null;
    if (now() > Number(obj.exp)) return null;
    return obj.payload ?? null;
  };

  function getUser(){
    try {
      const rawL = localStorage.getItem(AUTH_KEY);
      const uTTL = unpack(rawL);
      if (uTTL && uTTL.role) return uTTL;
      const legacy = safeJson(rawL);
      if (legacy && legacy.role) return legacy;
    } catch {}

    try {
      const rawS = sessionStorage.getItem(AUTH_KEY);
      const uS = safeJson(rawS);
      if (uS && uS.role) return uS;
    } catch {}

    try {
      const u = window.Auth && typeof window.Auth.current === 'function' ? window.Auth.current() : null;
      if (u && u.role) return u;
    } catch {}

    return null;
  }

  function persistUser24h(){
    // Se c'è un user legacy in localStorage, trasformalo in TTL 24h
    try {
      const rawL = localStorage.getItem(AUTH_KEY);
      const uTTL = unpack(rawL);
      const legacy = safeJson(rawL);
      if (!uTTL && legacy && legacy.role){
        localStorage.setItem(AUTH_KEY, pack(legacy, AUTH_TTL_MS));
      }
    } catch {}

    // Se auth salva in sessionStorage, copialo in localStorage con TTL
    try {
      const rawS = sessionStorage.getItem(AUTH_KEY);
      const uS = safeJson(rawS);
      if (uS && uS.role){
        const rawL = localStorage.getItem(AUTH_KEY);
        const uTTL = unpack(rawL);
        if (!uTTL || !uTTL.role){
          localStorage.setItem(AUTH_KEY, pack(uS, AUTH_TTL_MS));
        }
      }
    } catch {}
  }

  function isForcedLogin(){
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('logout') === '1') return true;
    } catch {}
    try { return localStorage.getItem(FORCE_LOGIN_KEY) === '1'; } catch { return false; }
  }

  function cleanLogoutParam(){
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('logout') === '1'){
        url.searchParams.delete('logout');
        history.replaceState({}, '', url.toString());
      }
    } catch {}
  }

  function blurActive(){
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch {}
  }

  function showLoginOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.add('show');
    ov.setAttribute('aria-hidden','false');
    document.body.classList.add('auth-blur');
    document.body.style.overflow = 'hidden';
  }

  function hideLoginOverlay(){
    blurActive();
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden','true');
    document.body.classList.remove('auth-blur');
    document.body.style.overflow = '';
  }

  function killPreloaderIfStuck(){
    const pl = document.getElementById('AuthPreloader');
    if (!pl) return;
    setTimeout(() => {
      try {
        if (pl.style.display === 'none') return;
        pl.classList.add('fade-out');
        setTimeout(() => { try { pl.style.display = 'none'; } catch {} }, 450);
      } catch {}
    }, 2600);
  }

  function enforceLoginOverlayWatchdog(ms=3500){
    const ov = document.getElementById('AuthOverlay');
    if (!ov || !window.MutationObserver) return;
    const end = now() + ms;
    const obs = new MutationObserver(() => {
      if (now() > end) return;
      try {
        const user = getUser();
        if (isForcedLogin() || !user) showLoginOverlay();
      } catch {}
    });
    try { obs.observe(ov, { attributes:true, attributeFilter:['class','aria-hidden'] }); } catch {}
    setTimeout(() => { try { obs.disconnect(); } catch {} }, ms);
  }

  // -------- Mode persistence / anti-welcome --------
  function shouldForceWelcomeConsume(){
    try {
      const f = sessionStorage.getItem(FORCE_WELCOME_KEY) === '1';
      if (f) sessionStorage.removeItem(FORCE_WELCOME_KEY);
      return f;
    } catch { return false; }
  }

  function getLastMode(){
    try { return sessionStorage.getItem(LAST_MODE_KEY) || ''; } catch { return ''; }
  }

  function setLastMode(mode){
    try { if (mode) sessionStorage.setItem(LAST_MODE_KEY, String(mode)); } catch {}
  }

  function hideWelcomeIfNotWelcome(){
    try {
      if ((window.currentMode || '') !== 'welcome'){
        document.body.classList.remove('welcome-home');
        document.getElementById('WelcomeCard')?.classList.add('hidden');
      }
    } catch {}
  }

  function hookSelectMode(){
    if (!window.selectMode || window.selectMode.__sessionfix) return;
    const orig = window.selectMode;
    const wrapped = function(mode){
      // Se qualcuno prova a forzare welcome ma non è stato richiesto (force_welcome) e abbiamo last_mode, ignoriamo.
      try {
        const last = getLastMode();
        const force = sessionStorage.getItem(FORCE_WELCOME_KEY) === '1';
        if (mode === 'welcome' && !force && last && last !== 'welcome'){
          // mantieni la modalità
          return orig.call(this, last);
        }
      } catch {}

      const res = orig.apply(this, arguments);
      try {
        if (mode && mode !== 'welcome') setLastMode(mode);
      } catch {}
      try { hideWelcomeIfNotWelcome(); } catch {}
      return res;
    };
    wrapped.__sessionfix = true;
    wrapped.__orig = orig;
    window.selectMode = wrapped;
  }

  function restoreModeAfterLoad(){
    const user = getUser();
    if (!user) return; // se non loggato, non ripristiniamo

    const forceWelcome = shouldForceWelcomeConsume();
    if (forceWelcome) return; // lascia welcome

    const last = getLastMode();
    if (!last || last === 'welcome') return;

    // prova subito e poi anti-race per 2 secondi
    const tryRestore = () => { try { window.selectMode && window.selectMode(last); } catch {} };
    tryRestore();

    let ticks = 0;
    const t = setInterval(() => {
      ticks++;
      try {
        if ((window.currentMode || '') === 'welcome') tryRestore();
        hideWelcomeIfNotWelcome();
      } catch {}
      if (ticks > 20) clearInterval(t);
    }, 100);
  }

  // -------- Logout interception (capture) --------
  function interceptLogoutButton(){
    const btn = document.getElementById('BtnLogout');
    if (!btn || btn.__sessionfix) return;
    btn.__sessionfix = true;

    btn.addEventListener('click', (e) => {
      // blocca handler precedenti
      try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } catch {}

      try { localStorage.setItem(FORCE_LOGIN_KEY, '1'); } catch {}
      try { sessionStorage.removeItem(LAST_MODE_KEY); } catch {}
      try { sessionStorage.setItem(FORCE_WELCOME_KEY, '1'); } catch {}

      // Pulisci utente (qualunque implementazione)
      try { localStorage.removeItem(AUTH_KEY); } catch {}
      try { sessionStorage.removeItem(AUTH_KEY); } catch {}

      // Reload con flag
      try {
        const url = new URL(location.href);
        url.searchParams.set('logout','1');
        location.href = url.toString();
      } catch {
        location.reload();
      }
    }, true);
  }

  function reconcile(){
    persistUser24h();

    const user = getUser();
    if (isForcedLogin() || !user){
      showLoginOverlay();
      cleanLogoutParam();
      enforceLoginOverlayWatchdog();
    } else {
      hideLoginOverlay();
    }

    hideWelcomeIfNotWelcome();
  }

  function init(){
    killPreloaderIfStuck();

    // hook selectMode appena esiste
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.selectMode){
        hookSelectMode();
        clearInterval(t);
        setTimeout(restoreModeAfterLoad, 0);
      }
      if (tries > 80) clearInterval(t);
    }, 50);

    interceptLogoutButton();

    // watchdog per 4s (race tra script)
    reconcile();
    let count = 0;
    const t2 = setInterval(() => {
      reconcile();
      interceptLogoutButton();
      if (++count > 40) clearInterval(t2);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
