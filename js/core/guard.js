// js/core/guard.js
(function(){
  'use strict';

  function allowedFor(user){
    try {
      const role = user?.role;
      return (window.PERMISSIONS && PERMISSIONS[role]) ? PERMISSIONS[role] : [];
    } catch { return []; }
  }

  function hideUnauthorizedMenu(allowed){
    document.querySelectorAll('#SideMenu li').forEach(li => {
      const mode = li.dataset.mode;
      if (!mode) return;
      if (!allowed.includes(mode)) li.classList.add('hidden');
      else li.classList.remove('hidden');
    });
  }

  function interceptSidebar(allowed){
    const menu = document.getElementById('SideMenu');
    if (!menu || menu.__guardBound) return;
    menu.__guardBound = true;

    // capture: blocca prima del listener normale
    menu.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const mode = li.dataset.mode;
      if (mode && !allowed.includes(mode)){
        e.preventDefault();
        e.stopImmediatePropagation();
        alert('Non sei autorizzato ad accedere a questa funzione.');
      }
    }, true);
  }

  function interceptAction(allowed){
    const btn = document.getElementById('BtnProcedi');
    if (!btn || btn.__guardBound) return;
    btn.__guardBound = true;

    btn.addEventListener('click', (e) => {
      const mode = window.currentMode;
      if (mode && !allowed.includes(mode)){
        e.preventDefault();
        e.stopImmediatePropagation();
        alert('Non sei autorizzato ad usare questa funzione.');
      }
    }, true);
  }

  // Esposto per auth.js
  window.applyGuards = function(user){
    const allowed = allowedFor(user);
    hideUnauthorizedMenu(allowed);
    interceptSidebar(allowed);
    interceptAction(allowed);

    // Se la modalità attuale non è consentita, torna a welcome
    try {
      if (window.currentMode && window.currentMode !== 'welcome' && !allowed.includes(window.currentMode)){
        window.selectMode && selectMode('welcome');
      }
    } catch {}
  };

  // Applica anche su DOMReady (se utente già loggato)
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const user = window.Auth && Auth.current ? Auth.current() : null;
      if (user) window.applyGuards(user);
    } catch {}
  });
})();
