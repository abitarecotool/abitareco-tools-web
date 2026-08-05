// js/core/auth.js
(function(){
  'use strict';

  const USER_PROFILES = {
    'admin@abitareco.it': { role: 'admin' },
    'marketing@abitareco.it': { role: 'marketing' },
    'tecnico@abitareco.it': { role: 'tecnico' },
    'info@riabitareco.it': { role: 'riabitare', brand: { label: 'RiAbitare Co.', logo: './assets/logo-riabitareco.png' } },
    'info@abitarecommercial.it': { role: 'commercial', brand: { label: 'Abitare Commercial', logo: './assets/logo-commercial.png' } }
  };

  const KEY = 'abitare_tools_auth_user';
  const FORCE_KEY = 'abitare_tools_force_login';
  const REMEMBER_MS = 365 * 24 * 60 * 60 * 1000;
  const cfg = window.ABITARE_SUPABASE || {};
  const SUPABASE_URL = String(cfg.url || '').trim();
  const SUPABASE_ANON_KEY = String(cfg.anonKey || '').trim();
  let supabaseClient = null;
  let appLoadPromise = null;

  function now(){ return Date.now(); }
  function hasSupabaseConfig(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient); }
  function getSupabase(){
    if (!hasSupabaseConfig()) return null;
    if (!supabaseClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.localStorage }
      });
    }
    return supabaseClient;
  }

  function clearUser(){
    try { sessionStorage.removeItem(KEY); } catch {}
    try { localStorage.removeItem(KEY); } catch {}
  }
  function normalizePayload(raw){
    if (!raw || typeof raw !== 'object') return null;
    if (raw.payload && typeof raw.payload === 'object') raw = raw.payload;
    if (!raw.email || !raw.role) return null;
    const remember = !!raw.remember;
    const payload = {
      email: String(raw.email || '').trim().toLowerCase(),
      role: raw.role,
      brand: raw.brand || null,
      remember: remember,
      loginAt: Number(raw.loginAt || now())
    };
    if (!payload.email) return null;
    if (remember){
      const expiresAt = Number(raw.expiresAt || (payload.loginAt + REMEMBER_MS));
      if (!Number.isFinite(expiresAt) || now() > expiresAt){ clearUser(); return null; }
      payload.expiresAt = expiresAt;
    }
    return payload;
  }
  function readStored(){
    try {
      const rawS = sessionStorage.getItem(KEY);
      if (rawS){
        const data = normalizePayload(JSON.parse(rawS));
        if (data) return data;
        sessionStorage.removeItem(KEY);
      }
    } catch { try { sessionStorage.removeItem(KEY); } catch {} }
    try {
      const rawL = localStorage.getItem(KEY);
      if (rawL){
        const data = normalizePayload(JSON.parse(rawL));
        if (data) return data;
        localStorage.removeItem(KEY);
      }
    } catch { try { localStorage.removeItem(KEY); } catch {} }
    return null;
  }
  function storeUser(user, remember){
    clearUser();
    const payload = { email:user.email, role:user.role, brand:user.brand || null, remember:!!remember, loginAt:now() };
    if (remember) payload.expiresAt = payload.loginAt + REMEMBER_MS;
    try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(payload)); } catch {}
  }

  function showOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.add('show');
    ov.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function hideOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }
  function hidePreloader(){
    const pl = document.getElementById('AuthPreloader');
    if (!pl) return;
    pl.classList.add('fade-out');
    setTimeout(() => { pl.style.display = 'none'; }, 150);
  }
  function showPreloader(){
    const pl = document.getElementById('AuthPreloader');
    if (!pl) return;
    pl.style.display = 'flex';
    pl.classList.remove('fade-out');
  }
  function setError(msg){ const err = document.getElementById('AuthError'); if (err) err.textContent = msg || ''; }
  function setLoginBusy(isBusy){
    const btn = document.getElementById('AuthConfirm');
    if (!btn) return;
    btn.disabled = !!isBusy;
    btn.textContent = isBusy ? 'Accesso...' : 'Accedi';
  }
  function profileFromEmail(email, supabaseUser){
    const cleanEmail = String(email || '').trim().toLowerCase();
    const meta = (supabaseUser && supabaseUser.user_metadata) ? supabaseUser.user_metadata : {};
    const base = USER_PROFILES[cleanEmail] || {};
    return { email: cleanEmail, role: meta.role || base.role || 'marketing', brand: meta.brand || base.brand || null };
  }

  function loadOneScript(src){
    return new Promise((resolve) => {
      if (!src) return resolve(false);
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve(true);
      // Importante: se una CDN esterna fallisce, il tool non deve rimanere bloccato sul logo.
      s.onerror = () => {
        console.warn('[Auth] Script non caricato, continuo comunque:', src);
        resolve(false);
      };
      document.body.appendChild(s);
    });
  }
  function loadDeferredApp(){
    if (appLoadPromise) return appLoadPromise;
    appLoadPromise = (async () => {
      const nodes = Array.from(document.querySelectorAll('script[data-app-src]'));
      for (const node of nodes){
        const src = node.getAttribute('data-app-src');
        await loadOneScript(src);
        node.remove();
      }
      window.dispatchEvent(new CustomEvent('abitare:app-scripts-loaded'));
    })();
    return appLoadPromise;
  }


  function setWelcomeOnly(isWelcome){
    try {
      document.body.classList.toggle('welcome-only', !!isWelcome);
    } catch {}
  }

  function installWelcomeShellPatch(){
    if (window.__abitareWelcomeShellPatch) return;
    window.__abitareWelcomeShellPatch = true;
    const originalSelectMode = window.selectMode;
    if (typeof originalSelectMode === 'function'){
      window.selectMode = function(mode){
        const result = originalSelectMode.apply(this, arguments);
        setWelcomeOnly(mode === 'welcome');
        return result;
      };
    }
    document.addEventListener('click', (e) => {
      const item = e.target && e.target.closest ? e.target.closest('[data-mode]') : null;
      if (item && item.dataset && item.dataset.mode) setWelcomeOnly(item.dataset.mode === 'welcome');
    }, true);
  }

  function bindUserMenu(user){
    const menu = document.getElementById('UserMenu');
    const dd = document.getElementById('UserDropdown');
    const btn = document.getElementById('BtnLogout');
    const label = document.getElementById('UserLabel');
    const avatar = document.querySelector('#UserMenu .user-avatar');
    if (!menu || !dd || !btn || !label) return;
    const roleLabel = (window.ROLE_LABELS && window.ROLE_LABELS[user.role]) ? window.ROLE_LABELS[user.role] : user.role;
    label.textContent = roleLabel;
    if (avatar) avatar.textContent = ((roleLabel || 'U').trim()[0] || 'U').toUpperCase();
    menu.classList.remove('hidden');
    const toggle = (e) => { if (e) e.stopPropagation(); dd.classList.toggle('hidden'); };
    if (!menu.__bound){
      menu.__bound = true;
      menu.addEventListener('click', toggle);
      menu.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
      document.addEventListener('click', () => dd.classList.add('hidden'));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dd.classList.add('hidden'); });
    }
    btn.onclick = async () => {
      try { localStorage.setItem(FORCE_KEY, '1'); } catch {}
      try { await getSupabase()?.auth.signOut(); } catch {}
      clearUser();
      const url = new URL(location.href);
      url.searchParams.set('logout','1');
      location.href = url.toString();
    };
  }
  function applyBrand(user){
    try {
      const defaultLogo = './assets/logo.png';
      const logoPath = (user && user.brand && user.brand.logo) ? user.brand.logo : defaultLogo;
      const label = (user && user.brand && user.brand.label) ? user.brand.label : 'Abitare Co.';
      const sideImg = document.getElementById('SidebarLogo');
      if (sideImg){ sideImg.onerror = () => { sideImg.onerror = null; sideImg.src = defaultLogo; sideImg.alt = 'Abitare Co.'; }; sideImg.src = logoPath; sideImg.alt = label; }
      const welcomeImg = document.querySelector('.welcome-brand img');
      if (welcomeImg){ welcomeImg.onerror = () => { welcomeImg.onerror = null; welcomeImg.src = defaultLogo; welcomeImg.alt = 'Abitare Co.'; }; welcomeImg.src = logoPath; welcomeImg.alt = label; }
    } catch {}
  }
  async function enterApp(user){
    hideOverlay();
    showPreloader();
    await loadDeferredApp();
    installWelcomeShellPatch();
    document.body.classList.remove('auth-locked','auth-blur');
    document.body.classList.add('auth-ready');
    setWelcomeOnly(true);
    try { window.applyGuards && window.applyGuards(user); } catch {}
    try { bindUserMenu(user); } catch {}
    try { applyBrand(user); } catch {}
    try { window.selectMode && window.selectMode('welcome'); } catch {}
    setWelcomeOnly(true);
    hidePreloader();
  }

  function bindPasswordToggle(){
    const passEl = document.getElementById('AuthPassword');
    const toggleBtn = document.getElementById('AuthTogglePassword');
    if (!passEl || !toggleBtn || toggleBtn.__bound) return;
    const openIcon = toggleBtn.querySelector('.eye-open');
    const closedIcon = toggleBtn.querySelector('.eye-closed');
    const updateUi = (visible) => {
      passEl.type = visible ? 'text' : 'password';
      toggleBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', visible ? 'Nascondi password' : 'Mostra password');
      toggleBtn.setAttribute('title', visible ? 'Nascondi password' : 'Mostra password');
      if (openIcon) openIcon.classList.toggle('hidden', visible);
      if (closedIcon) closedIcon.classList.toggle('hidden', !visible);
    };
    updateUi(false);
    toggleBtn.__bound = true;
    toggleBtn.addEventListener('click', () => {
      const visible = passEl.type === 'password';
      updateUi(visible);
      requestAnimationFrame(() => { try { passEl.focus({ preventScroll:true }); } catch { passEl.focus(); } });
    });
  }
  async function loginWithSupabase(email, pass){
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    if (!data || !data.user) throw new Error('Login non completato.');
    return profileFromEmail(email, data.user);
  }

  function initLogin(){
    const emailEl = document.getElementById('AuthEmail');
    const passEl = document.getElementById('AuthPassword');
    const remEl = document.getElementById('AuthRemember');
    const btn = document.getElementById('AuthConfirm');
    bindPasswordToggle();
    if (remEl){
      remEl.checked = false;
      remEl.disabled = false;
      remEl.title = 'Seleziona per mantenere la sessione attiva anche nei prossimi giorni.';
    }
    const doLogin = async () => {
      const email = (emailEl?.value || '').trim().toLowerCase();
      const pass = passEl?.value || '';
      const remember = !!remEl?.checked;
      if (!email || !pass){ setError('Compila Email e Password.'); return; }
      setError(''); setLoginBusy(true);
      try {
        const user = await loginWithSupabase(email, pass);
        if (!user){ setError('Credenziali non valide.'); return; }
        try { localStorage.removeItem(FORCE_KEY); } catch {}
        storeUser(user, remember);
        await enterApp(user);
      } catch (err) {
        console.warn('[Auth] Login error', err);
        setError('Credenziali non valide o connessione Supabase non disponibile.');
      } finally { setLoginBusy(false); }
    };
    if (btn && !btn.__bound){ btn.__bound = true; btn.addEventListener('click', doLogin); }
    const onEnter = (e) => { if (e.key === 'Enter'){ e.preventDefault(); doLogin(); } };
    passEl?.addEventListener('keydown', onEnter);
    emailEl?.addEventListener('keydown', onEnter);
  }

  async function boot(){
    initLogin();
    const url = new URL(location.href);
    const forcedByUrl = url.searchParams.get('logout') === '1';
    let forcedByKey = false;
    try { forcedByKey = localStorage.getItem(FORCE_KEY) === '1'; } catch {}
    if (forcedByUrl || forcedByKey){
      try { localStorage.removeItem(FORCE_KEY); } catch {}
      clearUser();
      if (forcedByUrl){ url.searchParams.delete('logout'); history.replaceState({},'',url.toString()); }
      hidePreloader(); showOverlay();
      try { document.getElementById('AuthEmail')?.focus({ preventScroll:true }); } catch {}
      return;
    }
    const storedUser = readStored();
    if (storedUser){ await enterApp(storedUser); return; }
    hidePreloader(); showOverlay();
    try { document.getElementById('AuthEmail')?.focus({ preventScroll:true }); } catch {}
  }

  window.Auth = { current: readStored, logout: async () => { try { localStorage.setItem(FORCE_KEY,'1'); } catch {} try { await getSupabase()?.auth.signOut(); } catch {} clearUser(); location.href = new URL(location.href).toString(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
