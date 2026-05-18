// js/app.js
// Abitare Co. tool bootstrap (classic scripts)
// Fixpack 20260518fix3
//
// Perché serve:
// - Il progetto è splittato: questo file è l'entrypoint leggero e viene caricato per ultimo.
// - Qui mettiamo un "watchdog" che impedisce a Welcome/Login di comparire/sparire in modo errato.
//
// Funzioni:
// 1) Persistenza login almeno 24h anche senza "Ricordami" (copia sessionStorage -> localStorage con TTL)
// 2) Ripristino modalità su refresh/riapertura (last_mode in localStorage con TTL)
// 3) Welcome non deve mai restare visibile sopra altre modalità
// 4) Dopo logout: overlay login resta visibile con blur (non sparisce più)

(function(){
  'use strict';

  const AUTH_KEY = 'abitare_tools_auth_user';
  const FORCE_LOGIN_KEY = 'abitare_tools_force_login';
  const FORCE_WELCOME_KEY = 'abitare_tools_force_welcome';
  const LAST_MODE_KEY = 'abitare_tools_last_mode';

  const AUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  const MODE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  const now = () => Date.now();

  const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

  const pack = (payload, ttl) => JSON.stringify({ v: 1, exp: now() + ttl, payload });
  const unpack = (raw) => {
    const obj = safeJson(raw);
    if (!obj || !obj.exp) return null;
    if (now() > Number(obj.exp)) return null;
    return obj.payload ?? null;
  };

  function getUser(){
    // 1) localStorage TTL
    try {
      const rawL = localStorage.getItem(AUTH_KEY);
      const uTTL = unpack(rawL);
      if (uTTL && uTTL.role) return uTTL;
      // 2) localStorage legacy
      const uLegacy = safeJson(rawL);
      if (uLegacy && uLegacy.role) return uLegacy;
    } catch {}

    // 3) sessionStorage legacy
    try {
      const rawS = sessionStorage.getItem(AUTH_KEY);
      const uS = safeJson(rawS);
      if (uS && uS.role) return uS;
    } catch {}

    // 4) window.Auth
    try {
      const u = window.Auth && typeof window.Auth.current === 'function' ? window.Auth.current() : null;
      if (u && u.role) return u;
    } catch {}

    return null;
  }

  function persistUser24h(){
    // Se auth.js ha salvato in sessionStorage (login senza "Ricordami"), copio in localStorage con TTL
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

    // Migra eventuale user legacy in localStorage -> TTL
    try {
      const rawL = localStorage.getItem(AUTH_KEY);
      const uLegacy = safeJson(rawL);
      const uTTL = unpack(rawL);
      if (!uTTL && uLegacy && uLegacy.role){
        localStorage.setItem(AUTH_KEY, pack(uLegacy, AUTH_TTL_MS));
      }
    } catch {}
  }

  function mustForceLogin(){
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('logout') === '1') return true;
    } catch {}
    try { return localStorage.getItem(FORCE_LOGIN_KEY) === '1'; } catch { return false; }
  }

  function stripLogoutParam(){
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('logout') === '1'){
        url.searchParams.delete('logout');
        history.replaceState({}, '', url.toString());
      }
    } catch {}
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
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden','true');
    document.body.classList.remove('auth-blur');
    document.body.style.overflow = '';
  }

  function ensureWelcomeState(){
    const isWelcome = (window.currentMode === 'welcome');
    const welcomeCard = document.getElementById('WelcomeCard');

    if (!isWelcome){
      try { document.body.classList.remove('welcome-home'); } catch {}
      if (welcomeCard) welcomeCard.classList.add('hidden');
      try {
        document.getElementById('WelcomeHelpOverlay')?.classList.add('hidden');
        document.getElementById('WelcomeHelpDrawer')?.classList.add('hidden');
      } catch {}
    } else {
      if (welcomeCard) welcomeCard.classList.remove('hidden');
      try { document.body.classList.add('welcome-home'); } catch {}
    }
  }

  function writeMode(mode){
    try {
      localStorage.setItem(LAST_MODE_KEY, pack({ mode: String(mode) }, MODE_TTL_MS));
    } catch {}
  }

  function readMode(){
    try {
      const raw = localStorage.getItem(LAST_MODE_KEY);
      const obj = unpack(raw);
      if (obj && obj.mode) return String(obj.mode);
      // legacy semplice
      if (raw && raw.length < 40 && raw.indexOf('{') === -1) return raw;
    } catch {}
    return '';
  }

  function shouldForceWelcome(){
    try {
      const f = sessionStorage.getItem(FORCE_WELCOME_KEY) === '1';
      if (f) sessionStorage.removeItem(FORCE_WELCOME_KEY);
      return f;
    } catch { return false; }
  }

  function modeAllowed(mode, user){
    try {
      if (!mode || mode === 'welcome') return true;
      const role = user?.role;
      if (!role || !window.PERMISSIONS) return true;
      const allowed = window.PERMISSIONS[role];
      return Array.isArray(allowed) ? allowed.includes(mode) : true;
    } catch { return true; }
  }

  function hookSelectMode(){
    if (!window.selectMode || window.selectMode.__appFixHooked) return;
    const orig = window.selectMode;
    window.selectMode = function(mode){
      const res = orig.apply(this, arguments);
      try {
        if (mode && mode !== 'welcome') writeMode(mode);
      } catch {}
      try { ensureWelcomeState(); } catch {}
      return res;
    };
    window.selectMode.__appFixHooked = true;
  }

  function restoreMode(){
    if (mustForceLogin()) return;

    const user = getUser();
    if (shouldForceWelcome()){
      try { window.selectMode && window.selectMode('welcome'); } catch {}
      return;
    }

    const m = readMode();
    if (m && m !== 'welcome' && modeAllowed(m, user)){
      try { window.selectMode && window.selectMode(m); } catch {}
    }
  }

  function reconcile(){
    // 1) Persist login
    persistUser24h();

    // 2) Overlay login non deve sparire se il login è forzato
    const user = getUser();
    if (mustForceLogin() || !user){
      showLoginOverlay();
      stripLogoutParam();
    } else {
      hideLoginOverlay();
    }

    // 3) Welcome non deve comparire sopra altre modalità
    ensureWelcomeState();
  }

  function init(){
    // Hook selectMode appena esiste
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.selectMode){
        hookSelectMode();
        clearInterval(t);
        setTimeout(restoreMode, 0);
      }
      if (tries > 80) clearInterval(t);
    }, 50);

    // Watchdog anti-race: per 5 secondi riallinea UI
    reconcile();
    let count = 0;
    const t2 = setInterval(() => {
      reconcile();
      if (++count > 50) clearInterval(t2);
    }, 100);

    // Se qualcuno prova a togliere l'overlay mentre il login è forzato, lo rimettiamo
    const ov = document.getElementById('AuthOverlay');
    if (ov && window.MutationObserver){
      const obs = new MutationObserver(() => {
        try { reconcile(); } catch {}
      });
      try { obs.observe(ov, { attributes:true, attributeFilter:['class','aria-hidden'] }); } catch {}
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
