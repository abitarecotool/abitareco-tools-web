// js/core/auth.js
(function(){
  'use strict';

  // Profili/permessi lato UI. Le password NON sono piu nel codice quando Supabase e configurato.
  // In Supabase crea gli utenti con queste email. Puoi anche impostare user_metadata.role e
  // user_metadata.brand per sovrascrivere questi default.
  const USER_PROFILES = {
    'admin@abitareco.it': { role: 'admin' },
    'marketing@abitareco.it': { role: 'marketing' },
    'tecnico@abitareco.it': { role: 'tecnico' },
    'info@riabitareco.it': {
      role: 'riabitare',
      brand: { label: 'RiAbitare Co.', logo: './assets/logo-riabitareco.png' }
    },
    'info@abitarecommercial.it': {
      role: 'commercial',
      brand: { label: 'Abitare Commercial', logo: './assets/logo-commercial.png' }
    }
  };

  // Fallback temporaneo: serve solo finche non inserisci url/anonKey Supabase.
  // Dopo il collegamento Supabase puoi disattivarlo in js/core/supabase-config.js.
  const LEGACY_USERS = {
    'admin@abitareco.it': { password: 'Abitare52!', role: 'admin' },
    'marketing@abitareco.it': { password: 'Abitare52!', role: 'marketing' },
    'tecnico@abitareco.it': { password: 'Abitare52!', role: 'tecnico' },
    'info@riabitareco.it': { password: 'Abitare52!', role: 'riabitare', brand: { label: 'RiAbitare Co.', logo: './assets/logo-riabitareco.png' } },
    'info@abitarecommercial.it': { password: 'Abitare52!', role: 'commercial', brand: { label: 'Abitare Commercial', logo: './assets/logo-commercial.png' } }
  };

  const KEY = 'abitare_tools_auth_user';
  const FORCE_KEY = 'abitare_tools_force_login';
  const REMEMBER_HOURS = 24 * 30;
  const REMEMBER_MS = REMEMBER_HOURS * 60 * 60 * 1000;
  const cfg = window.ABITARE_SUPABASE || {};
  const SUPABASE_URL = String(cfg.url || '').trim();
  const SUPABASE_ANON_KEY = String(cfg.anonKey || '').trim();
  const LEGACY_FALLBACK = cfg.legacyFallback !== false;
  let supabaseClient = null;

  function now(){ return Date.now(); }

  function hasSupabaseConfig(){
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  }

  function getSupabase(){
    if (!hasSupabaseConfig()) return null;
    if (!supabaseClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
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

    if (raw.payload && typeof raw.payload === 'object') {
      const exp = Number(raw.exp || 0);
      if (!Number.isFinite(exp) || exp <= now()) {
        clearUser();
        return null;
      }
      raw = raw.payload;
    }

    if (!raw.email || !raw.role) return null;

    const payload = {
      email: String(raw.email || '').trim().toLowerCase(),
      role: raw.role,
      brand: raw.brand || null,
      remember: !!raw.remember,
      loginAt: Number(raw.loginAt || now())
    };

    if (!payload.email) return null;

    if (payload.remember) {
      const expiresAt = Number(raw.expiresAt || (payload.loginAt + REMEMBER_MS));
      if (!Number.isFinite(expiresAt) || now() > expiresAt) {
        clearUser();
        return null;
      }
      payload.expiresAt = expiresAt;
    }

    return payload;
  }

  function readStored(){
    try {
      const rawS = sessionStorage.getItem(KEY);
      if (rawS) {
        const dataS = normalizePayload(JSON.parse(rawS));
        if (dataS) return dataS;
        try { sessionStorage.removeItem(KEY); } catch {}
      }
    } catch {
      try { sessionStorage.removeItem(KEY); } catch {}
    }

    try {
      const rawL = localStorage.getItem(KEY);
      if (rawL) {
        const dataL = normalizePayload(JSON.parse(rawL));
        if (dataL) return dataL;
        try { localStorage.removeItem(KEY); } catch {}
      }
    } catch {
      try { localStorage.removeItem(KEY); } catch {}
    }

    return null;
  }

  function storeUser(user, remember){
    clearUser();

    const payload = {
      email: user.email,
      role: user.role,
      brand: user.brand || null,
      remember: !!remember,
      loginAt: now()
    };

    if (remember) payload.expiresAt = payload.loginAt + REMEMBER_MS;

    try {
      const serialized = JSON.stringify(payload);
      (remember ? localStorage : sessionStorage).setItem(KEY, serialized);
    } catch {}
  }

  function showOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.add('show');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('auth-blur');
  }

  function hideOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('auth-blur');
  }

  function hidePreloader(){
    const pl = document.getElementById('AuthPreloader');
    if (!pl) return;
    pl.classList.add('fade-out');
    setTimeout(() => { pl.style.display = 'none'; }, 160);
  }

  function setError(msg){
    const err = document.getElementById('AuthError');
    if (err) err.textContent = msg || '';
  }

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
    return {
      email: cleanEmail,
      role: meta.role || base.role || 'marketing',
      brand: meta.brand || base.brand || null
    };
  }

  function bindUserMenu(user){
    const menu = document.getElementById('UserMenu');
    const dd = document.getElementById('UserDropdown');
    const btn = document.getElementById('BtnLogout');
    const label = document.getElementById('UserLabel');
    const avatar = document.querySelector('#UserMenu .user-avatar');
    if (!menu || !dd || !btn || !label) return;

    const roleLabel = (window.ROLE_LABELS && window.ROLE_LABELS[user.role])
      ? window.ROLE_LABELS[user.role]
      : user.role;

    label.textContent = roleLabel;
    if (avatar){
      const t = (roleLabel || 'U').trim();
      avatar.textContent = (t[0] || 'U').toUpperCase();
    }

    menu.classList.remove('hidden');

    const toggle = (e) => {
      if (e) e.stopPropagation();
      dd.classList.toggle('hidden');
    };

    if (!menu.__bound){
      menu.__bound = true;
      menu.addEventListener('click', toggle);
      menu.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') toggle(e);
      });
      document.addEventListener('click', () => dd.classList.add('hidden'));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dd.classList.add('hidden');
      });
    }

    btn.onclick = async () => {
      try { localStorage.setItem(FORCE_KEY, '1'); } catch {}
      try { await getSupabase()?.auth.signOut(); } catch {}
      clearUser();
      const url = new URL(location.href);
      url.searchParams.set('logout', '1');
      location.href = url.toString();
    };
  }

  function applyBrand(user){
    try {
      const defaultLogo = './assets/logo.png';
      const logoPath = (user && user.brand && user.brand.logo) ? user.brand.logo : defaultLogo;
      const label = (user && user.brand && user.brand.label) ? user.brand.label : 'Abitare Co.';

      const sideImg = document.getElementById('SidebarLogo');
      if (sideImg){
        sideImg.onerror = () => {
          sideImg.onerror = null;
          sideImg.src = defaultLogo;
          sideImg.alt = 'Abitare Co.';
        };
        sideImg.src = logoPath;
        sideImg.alt = label;
      }

      const welcomeImg = document.querySelector('.welcome-brand img');
      if (welcomeImg){
        welcomeImg.onerror = () => {
          welcomeImg.onerror = null;
          welcomeImg.src = defaultLogo;
          welcomeImg.alt = 'Abitare Co.';
        };
        welcomeImg.src = logoPath;
        welcomeImg.alt = label;
      }
    } catch {}
  }

  function enterApp(user){
    hideOverlay();
    try { window.applyGuards && window.applyGuards(user); } catch {}
    try { bindUserMenu(user); } catch {}
    try { applyBrand(user); } catch {}
    try { window.selectMode && window.selectMode('welcome'); } catch {}
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
      try { passEl.focus({ preventScroll: true }); } catch { passEl.focus(); }
      const len = passEl.value.length;
      try { passEl.setSelectionRange(len, len); } catch {}
    });
  }

  async function loginWithSupabase(email, pass){
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client.auth.signInWithPassword({
      email: email,
      password: pass
    });

    if (error) throw error;
    if (!data || !data.user) throw new Error('Login non completato.');
    return profileFromEmail(email, data.user);
  }

  function loginWithLegacy(email, pass){
    const u = LEGACY_USERS[email];
    if (!u || u.password !== pass) return null;
    return { email, role: u.role, brand: u.brand || null };
  }

  function initLogin(){
    const emailEl = document.getElementById('AuthEmail');
    const passEl = document.getElementById('AuthPassword');
    const remEl = document.getElementById('AuthRemember');
    const btn = document.getElementById('AuthConfirm');

    bindPasswordToggle();

    try {
      const remembered = readStored();
      if (remEl) remEl.checked = !!(remembered && remembered.remember);
    } catch {}

    const doLogin = async () => {
      const email = (emailEl?.value || '').trim().toLowerCase();
      const pass = (passEl?.value || '').trim();
      const remember = !!remEl?.checked;

      if (!email || !pass){
        setError('Compila Email e Password.');
        return;
      }

      setError('');
      setLoginBusy(true);

      try {
        let user = null;

        if (hasSupabaseConfig()){
          user = await loginWithSupabase(email, pass);
        } else if (LEGACY_FALLBACK) {
          user = loginWithLegacy(email, pass);
        } else {
          throw new Error('Configurazione Supabase mancante.');
        }

        if (!user){
          setError('Credenziali non valide.');
          return;
        }

        try { localStorage.removeItem(FORCE_KEY); } catch {}
        storeUser(user, remember);
        enterApp(user);
      } catch (err) {
        console.warn('[Auth] Login error', err);
        setError('Credenziali non valide o connessione Supabase non disponibile.');
      } finally {
        setLoginBusy(false);
      }
    };

    if (btn && !btn.__bound){
      btn.__bound = true;
      btn.addEventListener('click', doLogin);
    }

    passEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        doLogin();
      }
    });

    emailEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        doLogin();
      }
    });
  }

  function boot(){
    document.body.classList.remove('auth-blur');
    initLogin();

    const url = new URL(location.href);
    const forcedByUrl = url.searchParams.get('logout') === '1';
    let forcedByKey = false;
    try { forcedByKey = localStorage.getItem(FORCE_KEY) === '1'; } catch {}

    if (forcedByUrl || forcedByKey){
      try { localStorage.removeItem(FORCE_KEY); } catch {}
      clearUser();

      if (forcedByUrl){
        url.searchParams.delete('logout');
        history.replaceState({}, '', url.toString());
      }

      hidePreloader();
      showOverlay();
      try { document.getElementById('AuthEmail')?.focus(); } catch {}
      return;
    }

    const user = readStored();
    hidePreloader();

    if (!user){
      showOverlay();
      try { document.getElementById('AuthEmail')?.focus(); } catch {}
      return;
    }

    enterApp(user);
  }

  window.Auth = {
    current: readStored,
    logout: async () => {
      try { localStorage.setItem(FORCE_KEY, '1'); } catch {}
      try { await getSupabase()?.auth.signOut(); } catch {}
      clearUser();
      location.href = new URL(location.href).toString();
    }
  };

  document.addEventListener('DOMContentLoaded', boot);
})();
