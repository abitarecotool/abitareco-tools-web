/* =========================================================
 Abitare Co. – Digital Content Tool (Web)
 app.js — Immagini + DigitalTool + PDF→JPG + Rename + Video + Watermark (auto)
        + BV (Akrobat / Calibri + REA dinamico) + QR + Iubenda + PPT
========================================================= */
"use strict";

/* ---------------------------- Helpers base ---------------------------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const showEl = (el) => el && el.classList.remove('hidden');
const hideEl = (el) => el && el.classList.add('hidden');

/* ------------------------ Auth gate: preloader + password ------------------------
   NOTE: Questa è una protezione "leggera" lato client (visibile nel sorgente).
   Serve a limitare l'accesso casuale al tool interno.
*/
const AUTH_PASSWORD = 'Abitare52!';
const AUTH_SESSION_KEY = 'abitare_tools_auth_ok';

// ===== Welcome voice overlay (stile login) =====
function showVoiceOverlay(){
  const ov = document.getElementById('VoiceOverlay');
  if (!ov) return;
  ov.classList.add('show');
  ov.setAttribute('aria-hidden','false');
}

function hideVoiceOverlay(){
  const ov = document.getElementById('VoiceOverlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.setAttribute('aria-hidden','true');
}

function playWelcomeAudio(opts = { force:false }){
  try {
    const force = !!opts.force;
    const a = document.getElementById('WelcomeAudio');
    if (!a) return;

    if (!force && sessionStorage.getItem('welcome_audio_played') === '1') return;

    showVoiceOverlay();

    const stop = () => {
      try { hideVoiceOverlay(); } catch {}
    };

    a.onended = stop;
    a.onabort = stop;
    a.onerror = stop;

    a.currentTime = 0;
    a.volume = 1;

    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => stop());

    sessionStorage.setItem('welcome_audio_played','1');
  } catch {}
}

function stopWelcomeAudio(){
  try { document.getElementById('WelcomeAudio')?.pause(); } catch {}
  try { hideVoiceOverlay(); } catch {}
}

function bindVoiceUI(){
  const btnSidebar = document.getElementById('BtnSidebarInfo');
  const btnClose = document.getElementById('VoiceClose');
  const btnReplay = document.getElementById('VoiceReplay');
  const ov = document.getElementById('VoiceOverlay');

  if (btnSidebar && !btnSidebar.__bound){
    btnSidebar.__bound = true;
    btnSidebar.addEventListener('click', () => playWelcomeAudio({ force:true }));
  }

  if (btnReplay && !btnReplay.__bound){
    btnReplay.__bound = true;
    btnReplay.addEventListener('click', () => playWelcomeAudio({ force:true }));
  }

  if (btnClose && !btnClose.__bound){
    btnClose.__bound = true;
    btnClose.addEventListener('click', stopWelcomeAudio);
  }

  if (ov && !ov.__bound){
    ov.__bound = true;
    ov.addEventListener('click', (e) => {
      if (e.target === ov) stopWelcomeAudio();
    });
  }
}

function _qs(id){ return document.getElementById(id); }

function _showAuthOverlay(){
  const ov = _qs('AuthOverlay');
  if (!ov) return;
  ov.classList.add('show');
  ov.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { _qs('AuthPassword')?.focus(); }, 50);
}

function _hideAuthOverlay(){
  const ov = _qs('AuthOverlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

function _hidePreloader(){
  const pl = _qs('AuthPreloader');
  if (!pl) return;
  pl.classList.add('fade-out');
  setTimeout(() => { pl.style.display = 'none'; }, 420);
}

function _isAuthed(){
  try { return sessionStorage.getItem(AUTH_SESSION_KEY) === '1'; } catch { return false; }
}

function _setAuthed(){
  try { sessionStorage.setItem(AUTH_SESSION_KEY, '1'); } catch {}
}

function initAuthGate(){
  const btnOk = _qs('AuthConfirm');
  const btnCancel = _qs('AuthCancel');
  const input = _qs('AuthPassword');
  const err = _qs('AuthError');

  const doCheck = () => {
    const v = (input?.value || '').trim();
    if (v === AUTH_PASSWORD){
      if (err) err.textContent = '';
      _setAuthed();
      _hideAuthOverlay();
      try { selectMode('welcome'); } catch {}
      try { playWelcomeAudio({ force:false }); } catch {}
      return;
    }
    if (err) err.textContent = 'Password non corretta.';
    if (input) input.value = '';
    input?.focus();
  };

  btnOk?.addEventListener('click', doCheck);
  btnCancel?.addEventListener('click', () => {
    if (err) err.textContent = '';
    if (input) input.value = '';
    input?.focus();
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter'){ e.preventDefault(); doCheck(); }
  });

  setTimeout(() => {
    _hidePreloader();
    setTimeout(() => {
      if (_isAuthed()) {
        _hideAuthOverlay();
        try { selectMode('welcome'); } catch {}
      } else {
        _showAuthOverlay();
      }
    }, 380);
  }, 2000);
}

if (!window.__ABITARE_AUTH_INIT){
  window.__ABITARE_AUTH_INIT = true;
  document.addEventListener('DOMContentLoaded', initAuthGate);
  document.addEventListener('DOMContentLoaded', bindVoiceUI);
}


