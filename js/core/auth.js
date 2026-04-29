// js/core/auth.js
(function(){
  'use strict';

  const USERS = {
    'admin@abitareco.it':     { password: 'Abitare52!', role: 'admin' },
    'marketing@abitareco.it': { password: 'Abitare52!', role: 'marketing' },
    'tecnico@abitareco.it':   { password: 'Abitare52!', role: 'tecnico' }
  };

  const KEY = 'abitare_tools_auth_user';
  const FORCE_KEY = 'abitare_tools_force_login';

  function clearUser(){
    try { sessionStorage.removeItem(KEY); } catch {}
    try { localStorage.removeItem(KEY); } catch {}
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
      location.href = url.toString();
    };
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
      const user = { email, role: u.role };
      storeUser(user, remember);
      hideOverlay();

      try { window.applyGuards && window.applyGuards(user); } catch {}
      try { bindUserMenu(user); } catch {}
      try { window.selectMode && selectMode('welcome'); } catch {}
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
        try { document.getElementById('AuthEmail')?.focus(); } catch {}
        return;
      }

      const user = readStored();
      if (!user){
        showOverlay();
        try { document.getElementById('AuthEmail')?.focus(); } catch {}
        return;
      }

      hideOverlay();
      try { window.applyGuards && window.applyGuards(user); } catch {}
      try { bindUserMenu(user); } catch {}
      try { window.selectMode && selectMode('welcome'); } catch {}
    }, 2000);
  }

  window.Auth = { current: readStored, logout: () => { try { localStorage.setItem(FORCE_KEY,'1'); } catch {}; clearUser(); location.href = new URL(location.href).toString(); } };

  document.addEventListener('DOMContentLoaded', boot);
})();
