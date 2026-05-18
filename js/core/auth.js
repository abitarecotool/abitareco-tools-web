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

  function clearUser(){
  // rimuove utente salvato (anche eventuali vecchie chiavi)
  const keysToNuke = [KEY, 'abitare_tools_auth_user', 'abitare_tools_auth'];
  const nuke = (store) => {
    try {
      keysToNuke.forEach(k => { try { store.removeItem(k); } catch {} });
      // fallback: rimuovi qualsiasi chiave legacy che contenga "abitare_tools_auth"
      for (let i = store.length - 1; i >= 0; i--){
        const k = store.key(i);
        if (k && k.toLowerCase().includes('abitare_tools_auth')){ try { store.removeItem(k); } catch {} }
      }
    } catch {}
  };
  try { nuke(sessionStorage); } catch {}
  try { nuke(localStorage); } catch {}
}
function readStored(){
    try {
      const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function storeUser(u, remember){
    try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(u)); } catch {}
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
  syncAuthBlur();
  }

  function hidePreloader
function syncAuthBlur(){
  try {
    const ov = document.getElementById('AuthOverlay');
    const on = !!(ov && ov.classList.contains('show') && ov.getAttribute('aria-hidden') === 'false');
    document.body.classList.toggle('auth-blur', on);
    if (!on) document.body.style.overflow = '';
  } catch {}
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

  function bindUserMenu(user){
    const menu = document.getElementById('UserMenu');
    const dd = document.getElementById('UserDropdown');
    const btn = document.getElementById('BtnLogout');
    const label = document.getElementById('UserLabel');
    const avatar = document.querySelector('#UserMenu .user-avatar');

    if (!menu || !dd || !btn || !label) return;

    const roleLabel = (window.ROLE_LABELS && ROLE_LABELS[user.role]) ? ROLE_LABELS[user.role] : user.role;
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
      // Logout definitivo: pulizia + forzo login anche se c'è “Ricordami”
      try { localStorage.setItem(FORCE_KEY, '1'); } catch {}
      clearUser();
      // aggiungo parametro per evitare cache/vecchi script
      const url = new URL(location.href);
      url.searchParams.set('logout','1');
      // pulisco eventuale last mode (sessione) e forzo Welcome al prossimo accesso
try { sessionStorage.removeItem('abitare_tools_last_mode'); } catch {}
try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}
// sicurezza: rimuovo blur prima del redirect
try { document.body.classList.remove('auth-blur'); } catch {}
location.href = url.toString();
    };
  }

  

function applyBrand(user){
  try{
    const defaultLogo = './assets/logo.png';
    const logoPath = (user && user.brand && user.brand.logo) ? user.brand.logo : defaultLogo;
    const label = (user && user.brand && user.brand.label) ? user.brand.label : 'Abitare Co.';

    // Sidebar logo
    const sideImg = document.getElementById('SidebarLogo');
    if (sideImg){
      sideImg.onerror = () => { sideImg.onerror = null; sideImg.src = defaultLogo; sideImg.alt = 'Abitare Co.'; };
      sideImg.src = logoPath;
      sideImg.alt = label;
    }

    // Welcome logo
    const welcomeImg = document.querySelector('.welcome-brand img');
    if (welcomeImg){
      welcomeImg.onerror = () => { welcomeImg.onerror = null; welcomeImg.src = defaultLogo; welcomeImg.alt = 'Abitare Co.'; };
      welcomeImg.src = logoPath;
      welcomeImg.alt = label;
    }
  } catch {}
}
function initLogin(){
    const emailEl = document.getElementById('AuthEmail');
    const passEl  = document.getElementById('AuthPassword');
    const remEl   = document.getElementById('AuthRemember');
    const btn     = document.getElementById('AuthConfirm');

    const doLogin = () => {
      const email = (emailEl?.value || '').trim().toLowerCase();
      const pass  = (passEl?.value || '').trim();
      const remember = !!remEl?.checked;

      if (!email || !pass){ setError('Compila Email e Password.'); return; }

      const u = USERS[email];
      if (!u || u.password !== pass){ setError('Credenziali non valide.'); return; }

      setError('');
      try { localStorage.removeItem(FORCE_KEY); } catch {}
      const user = { email, role: u.role, brand: u.brand || null };
      storeUser(user, remember);
      hideOverlay();
    syncAuthBlur();

      try { window.applyGuards && window.applyGuards(user); } catch {}
      try { bindUserMenu(user); } catch {}
    try { applyBrand(user); } catch {}
      try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}
};

    if (btn && !btn.__bound){
      btn.__bound = true;
      btn.addEventListener('click', doLogin);
    }

    passEl?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); doLogin(); } });
    emailEl?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); doLogin(); } });
  }

  function boot(){
    // sanifica UI
    document.body.classList.remove('auth-blur');

    initLogin();

    setTimeout(() => {
      hidePreloader();

      // se logout=1 o FORCE_KEY=1 -> mostra login sempre
      const url = new URL(location.href);
      const forcedByUrl = url.searchParams.get('logout') === '1';
      let forcedByKey = false;
      try { forcedByKey = localStorage.getItem(FORCE_KEY) === '1'; } catch {}

      if (forcedByUrl || forcedByKey){
        try { localStorage.removeItem(FORCE_KEY); } catch {}
        clearUser();
        // pulisco url
        if (forcedByUrl){
          url.searchParams.delete('logout');
          history.replaceState({}, '', url.toString());
        }
        showOverlay();
  syncAuthBlur();
        try { document.getElementById('AuthEmail')?.focus(); } catch {}
        return;
      }

      const user = readStored();
      if (!user){
        showOverlay();
  syncAuthBlur();
        try { document.getElementById('AuthEmail')?.focus(); } catch {}
        return;
      }

      hideOverlay();
    syncAuthBlur();
      try { window.applyGuards && window.applyGuards(user); } catch {}
      try { bindUserMenu(user); } catch {}
    try { applyBrand(user); } catch {}
}, 2000);
  }

  window.Auth = { current: readStored, logout: () => {
    try { localStorage.setItem(FORCE_KEY,'1'); } catch {}
    try { sessionStorage.removeItem('abitare_tools_last_mode'); } catch {}
    try { sessionStorage.setItem('abitare_tools_force_welcome','1'); } catch {}
    try { document.body.classList.remove('auth-blur'); } catch {}
    clearUser();
    location.href = new URL(location.href).toString();
  } };

  document.addEventListener('DOMContentLoaded', boot);
})();
