// js/core/auth.js
(function(){
  'use strict';

  // Accounts (NON modificare)
  const USERS = {
    'admin@abitareco.it': { password: 'Abitare52!', role: 'admin' },
    'marketing@abitareco.it': { password: 'Abitare52!', role: 'marketing' },
    'tecnico@abitareco.it': { password: 'Abitare52!', role: 'tecnico' },
    'info@riabitareco.it': { password: 'Abitare52!', role: 'riabitare', brand: { label: 'RiAbitare Co.', logo: './assets/logo-riabitareco.png' } },
    'info@abitarecommercial.it': { password: 'Abitare52!', role: 'commercial', brand: { label: 'Abitare Commercial', logo: './assets/logo-commercial.png' } }
  };

  const KEY = 'abitare_tools_auth_user';
  const FORCE_KEY = 'abitare_tools_force_login';

  // Sessione minima: 1 giorno. Se spunti "Ricordami": 30 giorni.
  const TTL_DAY_MS = 24 * 60 * 60 * 1000;
  const TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

  const now = () => Date.now();

  function packUser(user, ttlMs){
    return JSON.stringify({ v: 1, exp: now() + ttlMs, user });
  }

  function unpackUser(raw){
    try {
      const obj = JSON.parse(raw);
      // Nuova struttura con scadenza
      if (obj && typeof obj === 'object' && obj.user && obj.exp){
        if (now() <= Number(obj.exp)) return obj.user;
        return null;
      }
      // Legacy: user diretto
      if (obj && typeof obj === 'object' && obj.role){
        // Migra a 1 giorno
        try { localStorage.setItem(KEY, packUser(obj, TTL_DAY_MS)); } catch {}
        return obj;
      }
      return null;
    } catch { return null; }
  }

  function clearUser(){
    try { localStorage.removeItem(KEY); } catch {}
    try { sessionStorage.removeItem(KEY); } catch {}
  }

  function readStored(){
    let raw = null;
    try { raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch {}
    if (!raw) return null;
    const user = unpackUser(raw);
    if (!user){
      clearUser();
      return null;
    }
    return user;
  }

  function storeUser(user, remember){
    const ttl = remember ? TTL_REMEMBER_MS : TTL_DAY_MS;
    const payload = packUser(user, ttl);
    // Salva SEMPRE in localStorage: dura anche chiudendo Chrome
    try { localStorage.setItem(KEY, payload); } catch {}
    try { sessionStorage.removeItem(KEY); } catch {}
  }

  function showOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.add('show');
    ov.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('auth-blur');
  }

  function hideOverlay(){
    const ov = document.getElementById('AuthOverlay');
    if (!ov) return;
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    document.body.classList.remove('auth-blur');
  }

  function hidePreloader(){
    const pl = document.getElementById('AuthPreloader');
    if (!pl) return;
    pl.classList.add('fade-out');
    setTimeout(() => { try { pl.style.display = 'none'; } catch {} }, 420);
  }

  function setError(msg){
    const err = document.getElementById('AuthError');
    if (err) err.textContent = msg || '';
  }

  function hideUserMenu(){
    try {
      document.getElementById('UserMenu')?.classList.add('hidden');
      document.getElementById('UserDropdown')?.classList.add('hidden');
    } catch {}
  }

  function applyBrand(user){
    try{
      const defaultLogo = './assets/logo.png';
      const logoPath = (user && user.brand && user.brand.logo) ? user.brand.logo : defaultLogo;
      const label = (user && user.brand && user.brand.label) ? user.brand.label : 'Abitare Co.';

      const sideImg = document.getElementById('SidebarLogo');
      if (sideImg){
        sideImg.onerror = () => { sideImg.onerror = null; sideImg.src = defaultLogo; sideImg.alt = 'Abitare Co.'; };
        sideImg.src = logoPath;
        sideImg.alt = label;
      }

      const welcomeImg = document.querySelector('.welcome-brand img');
      if (welcomeImg){
        welcomeImg.onerror = () => { welcomeImg.onerror = null; welcomeImg.src = defaultLogo; welcomeImg.alt = 'Abitare Co.'; };
        welcomeImg.src = logoPath;
        welcomeImg.alt = label;
      }
    } catch {}
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

    if (avatar){
      const t = (roleLabel || 'U').trim();
      avatar.textContent = (t[0] || 'U').toUpperCase();
    }

    menu.classList.remove('hidden');

    const toggle = (e) => { e && e.stopPropagation(); dd.classList.toggle('hidden'); };
    if (!menu.__bound){
      menu.__bound = true;
      menu.addEventListener('click', toggle);
      menu.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') toggle(e); });
      document.addEventListener('click', ()=> dd.classList.add('hidden'));
      document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') dd.classList.add('hidden'); });
    }

    btn.onclick = () => {
      // Logout: vogliamo rimanere sulla schermata login con blur attivo.
      try { localStorage.setItem(FORCE_KEY, '1'); } catch {}
      // pulisco utente e last_mode di tab
      clearUser();
      try { sessionStorage.removeItem('abitare_tools_last_mode'); } catch {}
      // Alla prossima apertura/tab: welcome
      try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}

      hideUserMenu();

      const url = new URL(location.href);
      url.searchParams.set('logout','1');
      location.href = url.toString();
    };
  }

  function initLogin(){
    const emailEl = document.getElementById('AuthEmail');
    const passEl = document.getElementById('AuthPassword');
    const remEl = document.getElementById('AuthRemember');
    const btn = document.getElementById('AuthConfirm');

    const doLogin = () => {
      const email = (emailEl?.value || '').trim().toLowerCase();
      const pass = (passEl?.value || '').trim();
      const remember = !!remEl?.checked;

      if (!email || !pass){ setError('Compila Email e Password.'); return; }
      const u = USERS[email];
      if (!u || u.password !== pass){ setError('Credenziali non valide.'); return; }

      setError('');
      try { localStorage.removeItem(FORCE_KEY); } catch {}

      const user = { email, role: u.role, brand: u.brand || null };
      storeUser(user, remember);

      hideOverlay();

      try { window.applyGuards && window.applyGuards(user); } catch {}
      try { bindUserMenu(user); } catch {}
      try { applyBrand(user); } catch {}

      // Welcome SOLO subito dopo login (come richiesto)
      try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}
      try { window.selectMode && window.selectMode('welcome'); } catch {}
    };

    if (btn && !btn.__bound){
      btn.__bound = true;
      btn.addEventListener('click', doLogin);
    }

    passEl?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); doLogin(); } });
    emailEl?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); doLogin(); } });
  }

  function boot(){
    initLogin();

    // Preloader: solo estetica
    setTimeout(hidePreloader, 2000);

    const url = new URL(location.href);
    const forcedByUrl = url.searchParams.get('logout') === '1';
    let forcedByKey = false;
    try { forcedByKey = localStorage.getItem(FORCE_KEY) === '1'; } catch {}

    if (forcedByUrl || forcedByKey){
      try { localStorage.removeItem(FORCE_KEY); } catch {}
      clearUser();
      hideUserMenu();

      if (forcedByUrl){
        url.searchParams.delete('logout');
        history.replaceState({}, '', url.toString());
      }

      // IMPORTANT: overlay resta visibile (blur attivo)
      showOverlay();
      try { document.getElementById('AuthEmail')?.focus(); } catch {}
      return;
    }

    const user = readStored();
    if (!user){
      hideUserMenu();
      showOverlay();
      try { document.getElementById('AuthEmail')?.focus(); } catch {}
      return;
    }

    // Utente valido: non forzare welcome qui, così F5 resta nella modalità (shell.js ripristina last_mode)
    hideOverlay();
    try { window.applyGuards && window.applyGuards(user); } catch {}
    try { bindUserMenu(user); } catch {}
    try { applyBrand(user); } catch {}
  }

  window.Auth = {
    current: readStored,
    logout: () => {
      try { localStorage.setItem(FORCE_KEY, '1'); } catch {}
      clearUser();
      location.href = new URL(location.href).toString();
    }
  };

  document.addEventListener('DOMContentLoaded', boot);

})();
