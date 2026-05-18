// js/core/auth.js
(function(){
  'use strict';

  const USERS = {
    'admin@abitareco.it': { password: 'Abitare52!', role: 'admin' },
    'marketing@abitareco.it': { password: 'Abitare52!', role: 'marketing' },
    'tecnico@abitareco.it': { password: 'Abitare52!', role: 'tecnico' },
    'info@riabitareco.it': { password: 'Abitare52!', role: 'riabitare', brand: { label: 'RiAbitare Co.', logo: './assets/logo-riabitareco.png' } },
    'info@abitarecommercial.it': { password: 'Abitare52!', role: 'commercial', brand: { label: 'Abitare Commercial', logo: './assets/logo-commercial.png' } }
  };

  const KEY = 'abitare_tools_auth_user';
  const FORCE_KEY = 'abitare_tools_force_login';

  // Durata minima sessione: 1 giorno.
  const TTL_DAY_MS = 24 * 60 * 60 * 1000;
  const TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // se spunti "Ricordami" -> 30 giorni

  function now(){ return Date.now(); }

  function packUser(user, ttl){
    return JSON.stringify({ v: 1, exp: now() + ttl, user });
  }

  function unpackUser(raw){
    try {
      const obj = JSON.parse(raw);
      // nuova struttura
      if (obj && typeof obj === 'object' && obj.user && obj.exp){
        if (Number(obj.exp) && now() <= Number(obj.exp)) return obj.user;
        return null;
      }
      // vecchia struttura: raw era direttamente user
      if (obj && typeof obj === 'object' && obj.role){
        // migra: 1 giorno
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
    // Prima localStorage (persistente), fallback sessionStorage
    let raw = null;
    try { raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch {}
    if (!raw) return null;
    const u = unpackUser(raw);
    if (!u){
      clearUser();
      return null;
    }
    return u;
  }

  function storeUser(user, remember){
    const ttl = remember ? TTL_REMEMBER_MS : TTL_DAY_MS;
    const payload = packUser(user, ttl);
    // Salva SEMPRE in localStorage (così dura almeno 1 giorno anche chiudendo la tab)
    try { localStorage.setItem(KEY, payload); } catch {}
    // pulizia sessionStorage per evitare stati doppi
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
    setTimeout(() => { pl.style.display = 'none'; }, 420);
  }

  function setError(msg){
    const err = document.getElementById('AuthError');
    if (err) err.textContent = msg || '';
  }

  function applyBrand(user){
    try {
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

  function hideUserMenu(){
    try {
      document.getElementById('UserMenu')?.classList.add('hidden');
      document.getElementById('UserDropdown')?.classList.add('hidden');
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
      try { sessionStorage.removeItem('abitare_tools_last_mode'); } catch {}
      try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}

      clearUser();
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

      // post-login: vai in welcome
      try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}

      hideOverlay();

      try { window.applyGuards && window.applyGuards(user); } catch {}
      try { bindUserMenu(user); } catch {}
      try { applyBrand(user); } catch {}

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
    // sanifica base
    try { document.body.classList.remove('auth-blur'); } catch {}
    initLogin();

    // gestione preloader solo estetica
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

      // Mostra login e mantieni blur attivo
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

    // utente valido
    hideOverlay();
    try { window.applyGuards && window.applyGuards(user); } catch {}
    try { bindUserMenu(user); } catch {}
    try { applyBrand(user); } catch {}
  }

  window.Auth = {
    current: readStored,
    logout: () => {
      try { localStorage.setItem(FORCE_KEY,'1'); } catch {}
      try { sessionStorage.removeItem('abitare_tools_last_mode'); } catch {}
      try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}
      clearUser();
      location.href = new URL(location.href).toString();
    }
  };

  document.addEventListener('DOMContentLoaded', boot);

})();
