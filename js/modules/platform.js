/* =============================== Piattaforma (Absuite) ====================== */
(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const showEl = (el) => el && el.classList.remove('hidden');
  const hideEl = (el) => el && el.classList.add('hidden');
  function paintPlanRangeFill(slider, pct){
    if (!slider) return;
    const safe = Math.max(0, Math.min(100, Number(pct) || 0));
    slider.style.setProperty('--fill', safe + '%');
    const gradient = `linear-gradient(to right, var(--red) 0 ${safe}%, var(--gray-200) ${safe}% 100%)`;
    slider.style.background = gradient;
    slider.style.backgroundImage = gradient;
  }

  const PlatformCard = $('#PlatformCard');
  const PlatformModeSwitch = $('#PlatformModeSwitch');
  const PlatformSectionTabs = $('#PlatformSectionTabs');
  const PlatformBody = $('#PlatformBody');
  const ActionProgressWrap = $('#ActionProgressWrap');
  const ActionProgress = $('#ActionProgress');
  const ActionProgressLabel = $('#ActionProgressLabel');
  const BtnProcedi = $('#BtnProcedi');

  const BASE_SLOTS = [
    { key:'hero', label:'Hero', desk:[1920,1080], mob:[750,1600] },
    { key:'carousel', label:'Carousel', desk:[1420,642], mob:[660,660] },
    { key:'immagine', label:'Immagine', desk:[1760,990], mob:[670,420] },
    { key:'testo-immagine', label:'Testo e immagine', desk:[880,1080], mob:[750,720] },
    { key:'banner', label:'Banner', desk:[1920,1080], mob:[750,1600] },
    { key:'banner-appuntamento', label:'Banner appuntamento', desk:[1920,680], mob:[750,1440] },
    { key:'appartamenti', label:'Appartamenti', desk:[1920,1080], mob:[1420,642] }
  ];

  const SECTIONS = [
    { key:'homepage', label:'Homepage', slots:['hero','testo-immagine','banner','banner-appuntamento'] },
    { key:'progetto', label:'Il progetto', slots:['hero','carousel','testo-immagine','banner','banner-appuntamento'] },
    { key:'appartamenti', label:'Gli appartamenti', slots:['hero','appartamenti','testo-immagine','banner','banner-appuntamento'] },
    { key:'dintorni', label:'I dintorni', slots:['hero','immagine','carousel','testo-immagine','banner','banner-appuntamento'] },
    { key:'altro', label:'Altro', slots:['hero','carousel','immagine','testo-immagine','banner','banner-appuntamento','appartamenti'] }
  ];

  const state = {
    view: 'images',
    section: 'homepage',
    sectionUploads: {},
    plans: [],
    platformSlug: '',
    customSectionName: '',
    customFormats: Object.fromEntries(BASE_SLOTS.map(s => [s.key, true])),
    renameFiles: { excelFile: null, appartamentiFiles: [], previewFiles: [], summary: null },
    planSettings: { width: 850, height: 1000 },
    planCrop: {
      active: false,
      items: [],
      index: 0,
      crop: { x:0, y:0, scale:1, minScale:0.01, maxScale:4, containScale:1, dragging:false, startX:0, startY:0, pointerId:null }
    }
  };

  function slugify(v){
    return String(v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
  function pad(n){ return String(n).padStart(2,'0'); }
  function nowStamp(){
    const d = new Date();
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  function isMobileUploadUI(){
    return window.matchMedia('(max-width: 900px)').matches && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));
  }
  function toArray(fileList){ return Array.from(fileList || []); }
  function filterImages(files){ return toArray(files).filter(f => /\.(jpe?g|png|webp|tif?f)$/i.test(f.name)); }
  function filterPlanFiles(files){ return toArray(files).filter(f => /\.(jpe?g|png|webp|tif?f|pdf)$/i.test(f.name)); }
  function ensureState(){
    for (const section of SECTIONS){
      if (!state.sectionUploads[section.key]) state.sectionUploads[section.key] = [];
    }
  }
  function getSectionDef(){ return SECTIONS.find(s => s.key === state.section) || SECTIONS[0]; }
  function getSlotDef(key){ return BASE_SLOTS.find(s => s.key === key); }
  function allSlotsForCurrentSection(){ return getSectionDef().slots.map(getSlotDef).filter(Boolean); }
  function exportableSlots(){
    const section = getSectionDef();
    const slots = section.slots.map(getSlotDef).filter(Boolean);
    if (section.key !== 'altro') return slots;
    return slots.filter(slot => !!state.customFormats[slot.key]);
  }
  function getSectionLabel(sectionKey=state.section){
    if (sectionKey === 'altro') return (state.customSectionName || '').trim() || 'Altro';
    return (SECTIONS.find(s => s.key === sectionKey) || {}).label || sectionKey;
  }
  function getSectionSlug(sectionKey=state.section){
    return slugify(getSectionLabel(sectionKey));
  }
  function humanCount(files){
    const n = (files || []).length;
    return n ? `${n} file pronti` : 'Nessun file caricato';
  }


  function getPlanOutputSize(){
    const w = Math.max(1, Number(state.planSettings?.width) || 850);
    const h = Math.max(1, Number(state.planSettings?.height) || 1000);
    return { w, h };
  }

  function rotateCanvas90(source){
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    const c = document.createElement('canvas');
    c.width = sh;
    c.height = sw;
    const ctx = c.getContext('2d', { alpha:false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);
    return c;
  }



  function canonicalRenameCode(letter, floor, unit){
    if (!letter || floor === undefined || unit === undefined) return null;
    const cleanLetter = String(letter).toUpperCase().replace(/[^A-Z]/g, '');
    const cleanFloor = parseInt(String(floor).replace(/\D/g, ''), 10);
    const cleanUnit = parseInt(String(unit).replace(/\D/g, ''), 10);
    if (!cleanLetter || !Number.isFinite(cleanFloor) || !Number.isFinite(cleanUnit)) return null;
    return `${cleanLetter}_${cleanFloor}_${cleanUnit}`;
  }
  function findRenameCode(value){
    const text = String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\.[A-Z0-9]{2,5}$/i, '')
      .replace(/[_\.\-\/\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;

    // Formati supportati, anche dentro nomi piu lunghi:
    // A.1.2, A_01_02, A-1-2, A 1 2 e prefissi tipo RES_A_1_2.
    const tokens = text.split(' ').filter(Boolean);
    for (let i = tokens.length - 3; i >= 0; i--){
      if (/^[A-Z]{1,4}$/.test(tokens[i]) && /^\d{1,4}$/.test(tokens[i + 1]) && /^\d{1,4}$/.test(tokens[i + 2])){
        return canonicalRenameCode(tokens[i], tokens[i + 1], tokens[i + 2]);
      }
    }

    // Variante compatta occasionale: A01 02 oppure A01_02.
    for (let i = tokens.length - 2; i >= 0; i--){
      const compact = tokens[i].match(/^([A-Z]{1,4})(\d{1,4})$/);
      if (compact && /^\d{1,4}$/.test(tokens[i + 1])){
        return canonicalRenameCode(compact[1], compact[2], tokens[i + 1]);
      }
    }
    return null;
  }
  function normalizeRenameCodeFromProduct(name){
    return findRenameCode(name);
  }
  function extractRenameCodeFromFilename(name){
    const base = String(name || '').replace(/\.[^.]+$/, '');
    return findRenameCode(base);
  }
  function safeOutputFilename(name, ext='.jpg'){
    const cleaned = String(name || 'non-trovato')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    return (cleaned || 'non-trovato') + ext;
  }

  async function parseRenameWorkbook(file){
    if (!file) throw new Error('Carica un file Excel o CSV.');
    if (!window.XLSX) throw new Error('Libreria Excel non disponibile.');
    const lower = String(file.name || '').toLowerCase();
    let wb;
    if (lower.endsWith('.csv')) {
      wb = window.XLSX.read(await file.text(), { type: 'string' });
    } else {
      wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows;
  }

  function buildNomeProdottoMap(rows){
    const map = new Map();
    for (const row of rows || []){
      const key = Object.keys(row || {}).find(k =>
        String(k || '')
          .replace(/^\uFEFF/, '')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .trim().toLowerCase().replace(/[_\s-]+/g, ' ') === 'nome prodotto'
      );
      const nomeProdotto = String(key ? row[key] : '').trim();
      if (!nomeProdotto) continue;
      const code = normalizeRenameCodeFromProduct(nomeProdotto);
      if (!code || map.has(code)) continue;
      map.set(code, nomeProdotto);
    }
    return map;
  }

  function summarizeRenameInputs(){
    const st = state.renameFiles;
    return {
      excel: st.excelFile ? st.excelFile.name : '',
      appartamenti: st.appartamentiFiles.length,
      preview: st.previewFiles.length,
      summary: st.summary || null
    };
  }

  function isRenameExcelFile(file){
    return /\.(xlsx|xls|csv)$/i.test(file?.name || '');
  }

  function isRenameImageFile(file){
    return /\.(jpe?g|png|webp|tif?f)$/i.test(file?.name || '');
  }

  async function getFilesFromDataTransferCustom(dt, predicate){
    const out = [];
    const addFile = (file, relPath='') => {
      if (!file || !predicate(file)) return;
      try { file._relPath = relPath || file.webkitRelativePath || file.name; } catch {}
      out.push(file);
    };
    const items = Array.from(dt?.items || []);
    function walkEntry(entry, prefix=''){
      return new Promise((resolve) => {
        if (!entry) return resolve();
        if (entry.isFile){
          entry.file((file) => { addFile(file, prefix + file.name); resolve(); }, () => resolve());
          return;
        }
        if (entry.isDirectory){
          const reader = entry.createReader();
          const entries = [];
          const readBatch = () => reader.readEntries(async (batch) => {
            if (!batch.length){
              for (const child of entries){ await walkEntry(child, prefix + entry.name + '/'); }
              resolve();
              return;
            }
            entries.push(...batch);
            readBatch();
          }, () => resolve());
          readBatch();
          return;
        }
        resolve();
      });
    }
    if (items.length && items.some(it => typeof it.webkitGetAsEntry === 'function')){
      for (const item of items){
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        if (entry) await walkEntry(entry);
      }
    } else {
      for (const file of Array.from(dt?.files || [])) addFile(file, file.webkitRelativePath || file.name);
    }
    return out;
  }

  function setupGenericDropzone(el, onDropFiles, predicate){
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => el.addEventListener(ev, prevent));
    el.addEventListener('dragenter', () => el.classList.add('drag-over'));
    el.addEventListener('dragover', () => el.classList.add('drag-over'));
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', async (e) => {
      el.classList.remove('drag-over');
      const files = await getFilesFromDataTransferCustom(e.dataTransfer, predicate);
      onDropFiles(files);
    });
  }

  function renderRenameSummary(summary){
    if (!summary) return '';
    const foundTot = (summary.appartamenti?.found || 0) + (summary.preview?.found || 0);
    const notFoundTot = (summary.appartamenti?.notFound || 0) + (summary.preview?.notFound || 0);
    const dupTot = (summary.appartamenti?.duplicates || 0) + (summary.preview?.duplicates || 0);
    return `
      <div class="platform-rename-summary">
        <div class="platform-rename-stat"><strong>Trovati</strong><span>${foundTot}</span></div>
        <div class="platform-rename-stat"><strong>Non trovati</strong><span>${notFoundTot}</span></div>
        <div class="platform-rename-stat"><strong>Doppioni ignorati</strong><span>${dupTot}</span></div>
      </div>`;
  }

  function renderRenameView(){
    const st = summarizeRenameInputs();
    PlatformBody.innerHTML = `
      <div class="platform-rename-wrap">
        <div class="platform-rename-head">
          <h4>Rinomina file</h4>
          <p class="muted">Carica il file Excel/CSV con la colonna <strong>Nome prodotto</strong>, poi le cartelle <strong>Appartamenti</strong> e <strong>Preview</strong>. Il tool estrae il codice appartamento dal nome file, lo confronta con il valore corretto presente in <strong>Nome prodotto</strong> e restituisce uno ZIP con due cartelle finali: <strong>Appartamenti</strong> e <strong>Preview</strong>. Le preview finali usano sempre il suffisso <strong>_preview.jpg</strong>.</p>
        </div>
        ${renderRenameSummary(st.summary)}
        <div class="platform-rename-grid">
          <article class="platform-upload-big platform-upload-big--compact">
            <div class="platform-upload-header">
              <div>
                <h4>Excel / CSV</h4>
                <p class="muted">${st.excel || 'Carica un file .xlsx, .xls oppure .csv'}</p>
              </div>
              <div class="platform-upload-actions">
                <button type="button" class="btn-outline platform-mini-btn" data-rename-pick="excel">Seleziona file</button>
                <button type="button" class="btn-outline platform-mini-btn ${st.excel ? '' : 'hidden'}" data-rename-clear="excel">Svuota</button>
              </div>
            </div>
            <div class="platform-upload platform-rename-dropzone" data-rename-drop="excel" tabindex="0" role="button" aria-label="Carica Excel o CSV">
              <div class="platform-upload-inner platform-upload-inner--stack">
                <div class="platform-upload-copy">
                  <strong>Trascina qui il file Excel o CSV</strong>
                  <span class="muted">Supporto: .xlsx, .xls, .csv. PDF non supportato.</span>
                </div>
              </div>
            </div>
          </article>
          <article class="platform-upload-big platform-upload-big--compact">
            <div class="platform-upload-header">
              <div>
                <h4>Cartella Appartamenti</h4>
                <p class="muted">${st.appartamenti ? `${st.appartamenti} file pronti` : 'Carica la cartella con i JPG appartamenti'}</p>
              </div>
              <div class="platform-upload-actions">
                <button type="button" class="btn-outline platform-mini-btn" data-rename-pick="appartamenti">Seleziona cartella</button>
                <button type="button" class="btn-outline platform-mini-btn ${st.appartamenti ? '' : 'hidden'}" data-rename-clear="appartamenti">Svuota</button>
              </div>
            </div>
            <div class="platform-upload platform-rename-dropzone" data-rename-drop="appartamenti" tabindex="0" role="button" aria-label="Carica cartella Appartamenti">
              <div class="platform-upload-inner platform-upload-inner--stack">
                <div class="platform-upload-copy">
                  <strong>Clicca o trascina qui la cartella Appartamenti</strong>
                  <span class="muted">Il tool considera i JPG e, se trova doppioni -01 / -02 sullo stesso codice, tiene solo il primo.</span>
                </div>
              </div>
            </div>
          </article>
          <article class="platform-upload-big platform-upload-big--compact">
            <div class="platform-upload-header">
              <div>
                <h4>Cartella Preview</h4>
                <p class="muted">${st.preview ? `${st.preview} file pronti` : 'Carica la cartella con i JPG preview'}</p>
              </div>
              <div class="platform-upload-actions">
                <button type="button" class="btn-outline platform-mini-btn" data-rename-pick="preview">Seleziona cartella</button>
                <button type="button" class="btn-outline platform-mini-btn ${st.preview ? '' : 'hidden'}" data-rename-clear="preview">Svuota</button>
              </div>
            </div>
            <div class="platform-upload platform-rename-dropzone" data-rename-drop="preview" tabindex="0" role="button" aria-label="Carica cartella Preview">
              <div class="platform-upload-inner platform-upload-inner--stack">
                <div class="platform-upload-copy">
                  <strong>Clicca o trascina qui la cartella Preview</strong>
                  <span class="muted">I file finali verranno rinominati come <strong>Nome prodotto_preview.jpg</strong>.</span>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div class="platform-footnote muted">Output ZIP: cartella <strong>Appartamenti</strong>, cartella <strong>Preview</strong>, <strong>report-riepilogo.txt</strong> e <strong>report-non-trovati.txt</strong>.</div>
      </div>`;
  }
  function planRotateIcon(){
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20v-6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 8a8 8 0 0 0-13.66-5.66L4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16a8 8 0 0 0 13.66 5.66L20 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  async function getFilesFromDataTransfer(dt, allowed='images'){
    const out = [];
    const addFile = (file, relPath='') => {
      if (!file) return;
      const name = file.name || '';
      const ok = allowed === 'images' ? /\.(jpe?g|png|webp|tif?f)$/i.test(name) : /\.(jpe?g|png|webp|tif?f|pdf)$/i.test(name);
      if (!ok) return;
      try { file._relPath = relPath || file.webkitRelativePath || name; } catch {}
      out.push(file);
    };
    const items = Array.from(dt?.items || []);
    function walkEntry(entry, prefix=''){
      return new Promise((resolve) => {
        if (!entry) return resolve();
        if (entry.isFile){
          entry.file((file) => { addFile(file, prefix + file.name); resolve(); }, () => resolve());
          return;
        }
        if (entry.isDirectory){
          const reader = entry.createReader();
          const entries = [];
          const readBatch = () => reader.readEntries(async (batch) => {
            if (!batch.length){
              for (const child of entries){ await walkEntry(child, prefix + entry.name + '/'); }
              resolve();
              return;
            }
            entries.push(...batch);
            readBatch();
          }, () => resolve());
          readBatch();
          return;
        }
        resolve();
      });
    }
    if (items.length && items.some(it => typeof it.webkitGetAsEntry === 'function')){
      for (const item of items){
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        if (entry) await walkEntry(entry);
      }
    } else {
      for (const file of Array.from(dt?.files || [])) addFile(file, file.webkitRelativePath || file.name);
    }
    return out;
  }

  function eyeIcon(hidden=false){
    return hidden
      ? `<span class="eye-open hidden" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="eye-closed" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c6.5 0 10.5 7.1 10.5 7.1a21.47 21.47 0 0 1-4.31 4.91" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.61 6.61A21.48 21.48 0 0 0 1.5 12s4 7.1 10.5 7.1a10.9 10.9 0 0 0 5.03-1.21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
      : `<span class="eye-open" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="eye-closed hidden" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c6.5 0 10.5 7.1 10.5 7.1a21.47 21.47 0 0 1-4.31 4.91" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.61 6.61A21.48 21.48 0 0 0 1.5 12s4 7.1 10.5 7.1a10.9 10.9 0 0 0 5.03-1.21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }

  function previewName(initiative, sectionSlug, slotKey, flavor){
    return `${initiative || 'nome-iniziativa'}-${sectionSlug || 'sezione'}-${slotKey}-${flavor}`;
  }

  function renderSectionTabs(){
    if (!PlatformSectionTabs) return;
    PlatformSectionTabs.innerHTML = '';
    if (state.view !== 'images' || state.planCrop.active) return;
    SECTIONS.forEach(section => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'platform-pill' + (state.section === section.key ? ' active' : '');
      btn.dataset.platformSection = section.key;
      btn.textContent = section.label;
      PlatformSectionTabs.appendChild(btn);
    });
  }

  function renderFormatCard(slot, options={}){
    const disabled = !!options.disabled;
    const sectionSlug = getSectionSlug();
    const initiative = slugify(state.platformSlug) || 'nome-iniziativa';
    return `
      <article class="platform-format-card ${disabled ? 'is-disabled' : ''}" data-format-key="${slot.key}">
        <div class="platform-format-top">
          <div>
            <h4>${slot.label}</h4>
            <p class="muted">Desktop ${slot.desk[0]}×${slot.desk[1]} · Mobile ${slot.mob[0]}×${slot.mob[1]} · cover</p>
          </div>
          ${options.togglable ? `<button type="button" class="platform-eye-btn" data-toggle-format="${slot.key}" title="${disabled ? 'Mostra formato' : 'Nascondi formato'}" aria-pressed="${disabled ? 'false' : 'true'}">${eyeIcon(disabled)}</button>` : ''}
        </div>
        <div class="platform-generated-name">${previewName(initiative, sectionSlug, slot.key, 'desktop')} · ${previewName(initiative, sectionSlug, slot.key, 'mobile')}</div>
      </article>
    `;
  }

  function renderImagesView(){
    const section = getSectionDef();
    const files = state.sectionUploads[section.key] || [];
    const slotsForRender = allSlotsForCurrentSection();
    const formatCards = slotsForRender.map(slot => renderFormatCard(slot, {
      disabled: section.key === 'altro' ? !state.customFormats[slot.key] : false,
      togglable: section.key === 'altro'
    })).join('');
    const mobileTxt = isMobileUploadUI() ? 'Tocca per aprire la galleria foto' : 'Clicca o trascina qui la cartella immagini';
    const previewNames = files.length ? files.slice(0,3).map(f => f.name).join(', ') : 'Puoi caricare cartelle con JPG e sottocartelle con JPG. Ogni file verrà esportato in tutti i formati attivi della sezione.';
    PlatformBody.innerHTML = `
      <div class="platform-images-wrap">
        <div class="form-group platform-name-group">
          <label for="PlatformSlugInput">Nome iniziativa*</label>
          <input id="PlatformSlugInput" class="input" type="text" placeholder="es. mia-torre-milano" value="${String(state.platformSlug || '').replace(/"/g, '&quot;')}" />
          <p class="muted platform-namehint">Il nome viene usato solo per la sezione Immagini. In Planimetrie resta il nome file originale con suffisso <strong>-preview.jpg</strong>.</p>
        </div>
        ${section.key === 'altro' ? `
          <div class="row platform-row-gap">
            <div class="form-group">
              <label for="PlatformCustomSectionName">Nome mini sezione*</label>
              <input id="PlatformCustomSectionName" class="input" type="text" placeholder="es. gallery-amenities" value="${String(state.customSectionName || '').replace(/"/g, '&quot;')}" />
            </div>
          </div>` : ''}
        <article class="platform-upload-big">
          <div class="platform-upload-header">
            <div>
              <h4>Upload ${getSectionLabel()}</h4>
              <p class="muted">${humanCount(files)} · ${previewNames}</p>
            </div>
            <div class="platform-upload-actions">
              <button type="button" class="btn-outline platform-mini-btn" data-section-pick>${isMobileUploadUI() ? 'Apri galleria' : 'Seleziona cartella'}</button>
              <button type="button" class="btn-outline platform-mini-btn ${files.length ? '' : 'hidden'}" data-section-clear>Svuota</button>
            </div>
          </div>
          <div class="platform-upload platform-upload-dropzone" data-section-drop tabindex="0" role="button" aria-label="Upload ${getSectionLabel()}" title="Clicca per selezionare o trascina qui una cartella/file supportato">
            <div class="platform-upload-inner platform-upload-inner--stack">
              <div class="platform-upload-copy">
                <strong>${mobileTxt}</strong>
                <span class="muted">Drag & drop attivo su desktop. Se carichi una cartella, il tool legge automaticamente anche le sottocartelle.</span>
              </div>
            </div>
          </div>
        </article>
        <div class="platform-formats-grid">${formatCards}</div>
        <div class="platform-footnote muted">Esportazione: <strong>${getSectionLabel()}</strong> → <strong>desktop/mobile</strong> → sottocartelle formato (<strong>hero</strong>, <strong>carousel</strong>, <strong>banner</strong>…). Ogni immagine caricata viene generata in tutti i formati attivi della sezione.</div>
      </div>`;
  }

  function renderPlanCropView(){
    const item = state.planCrop.items[state.planCrop.index];
    if (!item){
      state.planCrop.active = false;
      showEl(BtnProcedi);
      return renderPlansView();
    }
    const total = state.planCrop.items.length;
    const isLast = state.planCrop.index === total - 1;
    const { w, h } = getPlanOutputSize();
    PlatformBody.innerHTML = `
      <div class="platform-plan-crop-wrap">
        <div class="platform-plan-card">
          <div class="platform-crop-head">
            <div>
              <h4>Ritaglio preview planimetrie</h4>
              <p class="muted">File ${state.planCrop.index + 1} di ${total} · ${item.name}. Regola ritaglio, rotazione e zoom per centrare la planimetria nel formato finale ${w}×${h}px e poi vai avanti.</p>
            </div>
            <div class="platform-crop-counter">${state.planCrop.index + 1}/${total}</div>
          </div>
          <div id="PlatformPlanCropFrame" class="crop-frame platform-plan-crop-frame" style="aspect-ratio:${w} / ${h};"><img id="PlatformPlanCropImg" alt="Anteprima ritaglio planimetria" /></div>
          <div class="platform-crop-toolbar">
            <button type="button" class="btn-outline platform-rotate-btn" id="PlatformPlanRotate">${planRotateIcon()}<span>Ruota 90°</span></button>
          </div>
          <label style="margin-top:12px">Zoom immagine</label>
          <input type="range" id="PlatformPlanCropZoom" class="input" />
          <div class="platform-crop-actions">
            <button type="button" class="btn-outline" id="PlatformPlanCropReset">Ripristina</button>
            <button type="button" class="btn-outline" id="PlatformPlanCropSkip">Salta ritaglio</button>
            <button type="button" class="btn-primary" id="PlatformPlanCropNext">${isLast ? 'Esporta tutti' : 'Salva e successivo'}</button>
          </div>
        </div>
      </div>`;
    initPlanCropUI(item);
  }

  function renderPlansView(){
    if (state.planCrop.active) return renderPlanCropView();
    const total = state.plans.length;
    const names = total ? state.plans.slice(0,4).map(f => f.name).join(', ') : 'Accetta JPG/PNG/WEBP/TIFF/PDF anche misti. Drag & drop cartella o file supportato su desktop.';
    const { w, h } = getPlanOutputSize();
    PlatformBody.innerHTML = `
      <div class="platform-plans-wrap">
        <div class="platform-plan-card">
          <h4>Preview planimetrie</h4>
          <p class="muted">Imposta il formato preview personalizzato (default <strong>850×1000 px</strong>). Nei PDF il tool verifica i livelli disponibili, prova a spegnere <strong>CARTIGLIO</strong> e <strong>5_TESTO</strong>, poi rasterizza la tavola e la prepara per il ritaglio. Durante il crop puoi ruotare l’immagine di <strong>90°</strong> per volta e usare anche lo <strong>zoom-out</strong> per uniformare meglio la resa finale.</p>
          <div class="row platform-row-gap platform-plan-settings-row">
            <div class="form-group">
              <label for="PlatformPlanWidth">Larghezza preview (px)</label>
              <input id="PlatformPlanWidth" class="input" type="number" min="1" value="${w}" />
            </div>
            <div class="form-group">
              <label for="PlatformPlanHeight">Altezza preview (px)</label>
              <input id="PlatformPlanHeight" class="input" type="number" min="1" value="${h}" />
            </div>
          </div>
          <div class="platform-upload platform-plan-upload" data-plan-drop tabindex="0" role="button" aria-label="Carica planimetrie" title="Clicca per selezionare file o trascina qui cartella/file supportato">
            <div class="platform-upload-inner platform-upload-inner--stack">
              <div class="platform-upload-copy">
                <strong>${total ? `${total} file pronti per il crop/export` : 'Clicca o trascina qui cartelle / file misti JPG e PDF'}</strong>
                <span class="muted">${names}</span>
              </div>
              <div class="platform-upload-actions platform-upload-actions--wrap">
                <button type="button" class="btn-outline platform-mini-btn" data-plan-pick>${isMobileUploadUI() ? 'Seleziona file' : 'Seleziona file / PDF'}</button>
                <button type="button" class="btn-outline platform-mini-btn ${total ? '' : 'hidden'}" data-plan-clear>Svuota</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function render(){
    if (!PlatformCard) return;
    renderSectionTabs();
    $$('.platform-switch-btn', PlatformModeSwitch || document).forEach(btn => btn.classList.toggle('active', btn.dataset.platformView === state.view));
    if (BtnProcedi) BtnProcedi.textContent = state.view === 'rename' ? 'Rinomina ed esporta ZIP' : 'Esporta sezione';
    if (state.view === 'images') renderImagesView();
    else if (state.view === 'plans') renderPlansView();
    else renderRenameView();
  }

  function updateImageNamePreviews(){
    const sectionSlug = getSectionSlug();
    const initiative = slugify(state.platformSlug) || 'nome-iniziativa';
    $$('.platform-format-card').forEach(card => {
      const key = card.dataset.formatKey;
      const chip = $('.platform-generated-name', card);
      if (!chip) return;
      chip.textContent = `${previewName(initiative, sectionSlug, key, 'desktop')} · ${previewName(initiative, sectionSlug, key, 'mobile')}`;
    });
  }

  function storeSectionFiles(files){
    state.sectionUploads[state.section] = files;
    renderImagesView();
    afterRenderBindDnD();
  }

  function storePlanFiles(files){
    state.plans = files;
    renderPlansView();
    afterRenderBindDnD();
  }

  function pickImageSectionFiles(){
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (isMobileUploadUI()) input.accept = 'image/*';
    else { input.webkitdirectory = true; input.directory = true; }
    input.onchange = () => storeSectionFiles(filterImages(input.files));
    input.click();
  }

  function pickPlanFiles(){
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf,image/*,application/pdf';
    input.onchange = () => storePlanFiles(filterPlanFiles(input.files));
    input.click();
  }

  function setupDropzone(el, onDropFiles, allowed='images'){
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => el.addEventListener(ev, prevent));
    el.addEventListener('dragenter', () => el.classList.add('drag-over'));
    el.addEventListener('dragover', () => el.classList.add('drag-over'));
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', async (e) => {
      el.classList.remove('drag-over');
      const files = await getFilesFromDataTransfer(e.dataTransfer, allowed);
      onDropFiles(files);
    });
  }

  function bindEvents(){
    PlatformModeSwitch?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform-view]');
      if (!btn) return;
      state.view = btn.dataset.platformView;
      state.planCrop.active = false;
      showEl(BtnProcedi);
      render();
      afterRenderBindDnD();
    });

    PlatformSectionTabs?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform-section]');
      if (!btn) return;
      state.section = btn.dataset.platformSection;
      render();
      afterRenderBindDnD();
    });

    PlatformBody?.addEventListener('input', (e) => {
      if (e.target.id === 'PlatformSlugInput'){
        state.platformSlug = e.target.value || '';
        updateImageNamePreviews();
      }
      if (e.target.id === 'PlatformCustomSectionName'){
        state.customSectionName = e.target.value || '';
        const uploadHead = $('.platform-upload-header h4', PlatformBody);
        if (uploadHead) uploadHead.textContent = `Upload ${getSectionLabel()}`;
        updateImageNamePreviews();
      }
      if (e.target.id === 'PlatformPlanWidth'){
        state.planSettings.width = Math.max(1, Number(e.target.value) || 850);
      }
      if (e.target.id === 'PlatformPlanHeight'){
        state.planSettings.height = Math.max(1, Number(e.target.value) || 1000);
      }
    });

    PlatformBody?.addEventListener('click', async (e) => {
      const pickSection = e.target.closest('[data-section-pick]');
      if (pickSection){ e.preventDefault(); return pickImageSectionFiles(); }
      const clearSection = e.target.closest('[data-section-clear]');
      if (clearSection){ e.preventDefault(); return storeSectionFiles([]); }
      const dropSection = e.target.closest('[data-section-drop]');
      if (dropSection){ e.preventDefault(); return pickImageSectionFiles(); }
      const planPick = e.target.closest('[data-plan-pick]');
      if (planPick){ e.preventDefault(); return pickPlanFiles(); }
      const planClear = e.target.closest('[data-plan-clear]');
      if (planClear){ e.preventDefault(); return storePlanFiles([]); }
      const planDrop = e.target.closest('[data-plan-drop]');
      if (planDrop){ e.preventDefault(); return pickPlanFiles(); }
      const renamePick = e.target.closest('[data-rename-pick]');
      if (renamePick){ e.preventDefault(); return pickRenameFiles(renamePick.dataset.renamePick); }
      const renameClear = e.target.closest('[data-rename-clear]');
      if (renameClear){
        e.preventDefault();
        if (renameClear.dataset.renameClear === 'excel') state.renameFiles.excelFile = null;
        if (renameClear.dataset.renameClear === 'appartamenti') state.renameFiles.appartamentiFiles = [];
        if (renameClear.dataset.renameClear === 'preview') state.renameFiles.previewFiles = [];
        state.renameFiles.summary = null;
        renderRenameView();
        return afterRenderBindDnD();
      }
      const renameDrop = e.target.closest('[data-rename-drop]');
      if (renameDrop){ e.preventDefault(); return pickRenameFiles(renameDrop.dataset.renameDrop); }
      const toggleFormat = e.target.closest('[data-toggle-format]');
      if (toggleFormat){
        e.preventDefault();
        const key = toggleFormat.dataset.toggleFormat;
        state.customFormats[key] = !state.customFormats[key];
        const card = toggleFormat.closest('.platform-format-card');
        card?.classList.toggle('is-disabled', !state.customFormats[key]);
        toggleFormat.innerHTML = eyeIcon(!state.customFormats[key]);
        toggleFormat.setAttribute('aria-pressed', state.customFormats[key] ? 'true' : 'false');
        toggleFormat.title = state.customFormats[key] ? 'Nascondi formato' : 'Mostra formato';
        return;
      }
      if (e.target.id === 'PlatformPlanRotate' || e.target.closest('#PlatformPlanRotate')){ e.preventDefault(); return rotateCurrentPlanCrop(); }
      if (e.target.id === 'PlatformPlanCropReset'){ e.preventDefault(); return resetPlanCrop('contain'); }
      if (e.target.id === 'PlatformPlanCropSkip'){ e.preventDefault(); return saveAndAdvancePlanCrop(true); }
      if (e.target.id === 'PlatformPlanCropNext'){ e.preventDefault(); return saveAndAdvancePlanCrop(false); }
    });

    PlatformBody?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const dropSection = e.target.closest('[data-section-drop]');
      if (dropSection){ e.preventDefault(); pickImageSectionFiles(); }
      const planDrop = e.target.closest('[data-plan-drop]');
      if (planDrop){ e.preventDefault(); pickPlanFiles(); }
      const renameDrop = e.target.closest('[data-rename-drop]');
      if (renameDrop){ e.preventDefault(); pickRenameFiles(renameDrop.dataset.renameDrop); }
    });
  }

  function afterRenderBindDnD(){
    setupDropzone($('.platform-upload-dropzone', PlatformBody), (files) => storeSectionFiles(filterImages(files)), 'images');
    setupDropzone($('.platform-plan-upload', PlatformBody), (files) => storePlanFiles(filterPlanFiles(files)), 'plans');
    setupGenericDropzone($('[data-rename-drop="excel"]', PlatformBody), (files) => {
      state.renameFiles.excelFile = files[0] || null;
      state.renameFiles.summary = null;
      renderRenameView();
      afterRenderBindDnD();
    }, isRenameExcelFile);
    setupGenericDropzone($('[data-rename-drop="appartamenti"]', PlatformBody), (files) => {
      state.renameFiles.appartamentiFiles = files.filter(isRenameImageFile);
      state.renameFiles.summary = null;
      renderRenameView();
      afterRenderBindDnD();
    }, isRenameImageFile);
    setupGenericDropzone($('[data-rename-drop="preview"]', PlatformBody), (files) => {
      state.renameFiles.previewFiles = files.filter(isRenameImageFile);
      state.renameFiles.summary = null;
      renderRenameView();
      afterRenderBindDnD();
    }, isRenameImageFile);
  }


  function pickRenameFiles(kind){
    const input = document.createElement('input');
    input.type = 'file';
    if (kind === 'excel'){
      input.accept = '.xlsx,.xls,.csv';
      input.multiple = false;
      input.onchange = () => {
        state.renameFiles.excelFile = (input.files && input.files[0]) || null;
        state.renameFiles.summary = null;
        renderRenameView();
        afterRenderBindDnD();
      };
      input.click();
      return;
    }
    input.multiple = true;
    if (!isMobileUploadUI()) { input.webkitdirectory = true; input.directory = true; }
    else { input.accept = 'image/*'; }
    input.onchange = () => {
      const files = Array.from(input.files || []).filter(isRenameImageFile);
      if (kind === 'appartamenti') state.renameFiles.appartamentiFiles = files;
      if (kind === 'preview') state.renameFiles.previewFiles = files;
      state.renameFiles.summary = null;
      renderRenameView();
      afterRenderBindDnD();
    };
    input.click();
  }

  function buildRenameTextReports(summary){
    const lines = [];
    lines.push('RIEPILOGO RINOMINA FILE');
    lines.push('');
    lines.push(`Appartamenti trovati: ${summary.appartamenti.found}`);
    lines.push(`Appartamenti non trovati: ${summary.appartamenti.notFound}`);
    lines.push(`Appartamenti doppioni ignorati: ${summary.appartamenti.duplicates}`);
    lines.push('');
    lines.push(`Preview trovate: ${summary.preview.found}`);
    lines.push(`Preview non trovate: ${summary.preview.notFound}`);
    lines.push(`Preview doppioni ignorati: ${summary.preview.duplicates}`);
    const missing = ['NON TROVATI', ''];
    if (!summary.missing.length) missing.push('Nessun file non trovato.');
    else {
      summary.missing.forEach(row => {
        missing.push(`[${row.bucket}] ${row.original} -> codice ${row.code || 'non letto'} non trovato nell'Excel`);
      });
    }
    return {
      riepilogo: lines.join('\n'),
      nonTrovati: missing.join('\n')
    };
  }

  async function exportRenameFiles(){
    const excelFile = state.renameFiles.excelFile;
    const appartamentiFiles = state.renameFiles.appartamentiFiles || [];
    const previewFiles = state.renameFiles.previewFiles || [];
    if (!excelFile) { alert('Carica il file Excel o CSV.'); return; }
    if (!appartamentiFiles.length && !previewFiles.length) { alert('Carica almeno una cartella Appartamenti o Preview.'); return; }
    progressStart('Leggo Excel e preparo la rinomina…');
    const rows = await parseRenameWorkbook(excelFile);
    const map = buildNomeProdottoMap(rows);
    if (!map.size) throw new Error('Nel file Excel/CSV non trovo valori validi nella colonna Nome prodotto.');

    const zip = new JSZip();
    const summary = {
      appartamenti: { found: 0, notFound: 0, duplicates: 0 },
      preview: { found: 0, notFound: 0, duplicates: 0 },
      missing: []
    };

    const processBucket = async (files, bucket) => {
      const seen = new Set();
      for (let i = 0; i < files.length; i++){
        const file = files[i];
        const code = extractRenameCodeFromFilename(file.name || '');
        if (!code){
          summary[bucket].notFound += 1;
          summary.missing.push({ bucket, original: file.name, code: '' });
          continue;
        }
        if (seen.has(code)){
          summary[bucket].duplicates += 1;
          continue;
        }
        seen.add(code);
        const nomeProdotto = map.get(code);
        if (!nomeProdotto){
          summary[bucket].notFound += 1;
          summary.missing.push({ bucket, original: file.name, code });
          continue;
        }
        const ext = '.jpg';
        const finalName = bucket === 'preview'
          ? safeOutputFilename(`${nomeProdotto}_preview`, ext)
          : safeOutputFilename(nomeProdotto, ext);
        const folderName = bucket === 'preview' ? 'Preview' : 'Appartamenti';
        zip.file(`${folderName}/${finalName}`, file, { binary: true });
        summary[bucket].found += 1;
      }
    };

    await processBucket(appartamentiFiles, 'appartamenti');
    await processBucket(previewFiles, 'preview');

    const reports = buildRenameTextReports(summary);
    zip.file('report-riepilogo.txt', reports.riepilogo);
    zip.file('report-non-trovati.txt', reports.nonTrovati);

    state.renameFiles.summary = summary;
    progressSet(95, 'Creo ZIP rinominato…');
    await downloadZip(zip, `PIATTAFORMA-rinomina-file-${nowStamp()}.zip`);
    progressDone('Rinomina completata.');
    renderRenameView();
    afterRenderBindDnD();
  }

  async function loadBitmapOriented(file){
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
          try { resolve(await createImageBitmap(img)); } catch (err){ reject(err); }
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
  }

  function canvasToCanvasSource(source){
    const c = document.createElement('canvas');
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    c.width = sw; c.height = sh;
    const ctx = c.getContext('2d', { alpha:false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,sw,sh);
    ctx.drawImage(source, 0, 0, sw, sh);
    return c;
  }

  function rotateSourceToLandscape(source){
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    if (sw >= sh) return canvasToCanvasSource(source);
    const c = document.createElement('canvas');
    c.width = sh; c.height = sw;
    const ctx = c.getContext('2d', { alpha:false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);
    return c;
  }

  function extractLargestPlanComponent(sourceCanvas){
    try {
      const sw = sourceCanvas.width;
      const sh = sourceCanvas.height;
      const maxSide = 420;
      const scale = Math.min(1, maxSide / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const probe = document.createElement('canvas');
      probe.width = w; probe.height = h;
      const pctx = probe.getContext('2d', { alpha:false, willReadFrequently:true });
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0,0,w,h);
      pctx.drawImage(sourceCanvas, 0, 0, w, h);
      const data = pctx.getImageData(0,0,w,h).data;
      const mask = new Uint8Array(w * h);
      const thr = 22;
      for (let y = 0; y < h; y++){
        for (let x = 0; x < w; x++){
          const i = (y * w + x) * 4;
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          const delta = Math.abs(255-r) + Math.abs(255-g) + Math.abs(255-b);
          if (a > 8 && delta > thr) mask[y * w + x] = 1;
        }
      }
      const visited = new Uint8Array(w * h);
      let best = null;
      const nbs = [-1, 1, -w, w, -w-1, -w+1, w-1, w+1];
      for (let idx = 0; idx < mask.length; idx++){
        if (!mask[idx] || visited[idx]) continue;
        const q = [idx];
        visited[idx] = 1;
        let area = 0;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        while (q.length){
          const cur = q.pop();
          const x = cur % w, y = Math.floor(cur / w);
          area += 1;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          for (const d of nbs){
            const nxt = cur + d;
            if (nxt < 0 || nxt >= mask.length || visited[nxt] || !mask[nxt]) continue;
            const nx = nxt % w, ny = Math.floor(nxt / w);
            if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
            visited[nxt] = 1;
            q.push(nxt);
          }
        }
        const bboxW = maxX - minX + 1;
        const bboxH = maxY - minY + 1;
        const score = area * Math.max(1, bboxW * bboxH);
        if (!best || score > best.score) best = { score, minX, minY, maxX, maxY };
      }
      if (!best) return sourceCanvas;
      const padX = Math.round((best.maxX - best.minX + 1) * 0.08);
      const padY = Math.round((best.maxY - best.minY + 1) * 0.08);
      const sx = Math.max(0, Math.round((best.minX - padX) / scale));
      const sy = Math.max(0, Math.round((best.minY - padY) / scale));
      const ex = Math.min(sw, Math.round((best.maxX + padX + 1) / scale));
      const ey = Math.min(sh, Math.round((best.maxY + padY + 1) / scale));
      const cw = Math.max(1, ex - sx);
      const ch = Math.max(1, ey - sy);
      const out = document.createElement('canvas');
      out.width = cw; out.height = ch;
      const octx = out.getContext('2d', { alpha:false });
      octx.fillStyle = '#ffffff';
      octx.fillRect(0,0,cw,ch);
      octx.drawImage(sourceCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
      return out;
    } catch {
      return sourceCanvas;
    }
  }

  function preparePdfCanvasForCrop(renderedCanvas){
    const landscape = rotateSourceToLandscape(renderedCanvas);
    return extractLargestPlanComponent(landscape);
  }

  function drawCoverToCanvas(bmp, W, H){
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { alpha:false });
    const scale = Math.max(W / bmp.width, H / bmp.height);
    const dw = Math.round(bmp.width * scale);
    const dh = Math.round(bmp.height * scale);
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }

  function drawContainToCanvas(source, W, H, bg='#ffffff'){
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { alpha:false });
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    const scale = Math.min(W / sw, H / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, dx, dy, dw, dh);
    return c;
  }

  function drawCropStateToCanvas(source, W, H, cropData){
    if (!cropData || cropData.skipped) return drawContainToCanvas(source, W, H, '#ffffff');
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { alpha:false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,W,H);
    const frameW = cropData.frameW || 1;
    const frameH = cropData.frameH || 1;
    const sx = W / frameW;
    const sy = H / frameH;
    const scaleOut = cropData.scale * sx;
    const dxOut = cropData.x * sx;
    const dyOut = cropData.y * sy;
    const dw = source.width * scaleOut;
    const dh = source.height * scaleOut;
    const cx = (W / 2) + dxOut;
    const cy = (H / 2) + dyOut;
    const x = cx - (dw / 2);
    const y = cy - (dh / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, x, y, dw, dh);
    return c;
  }

  async function canvasToBlob(canvas, type='image/jpeg', quality=0.9){
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Impossibile generare il file.')), type, quality);
    });
  }

  async function renderPdfPage(page, optionalContentConfigPromise=null){
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha:false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const renderParams = { canvasContext: ctx, viewport };
    if (optionalContentConfigPromise) renderParams.optionalContentConfigPromise = optionalContentConfigPromise;
    await page.render(renderParams).promise;
    return canvas;
  }

  async function buildPdfOptionalContentConfigPromise(pdf, hiddenNames=['CARTIGLIO','5_TESTO']){
    try {
      if (!pdf || typeof pdf.getOptionalContentConfig !== 'function') return null;
      const normalize = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_]/g, '');
      const wanted = new Set((hiddenNames || []).map(normalize));
      const config = await pdf.getOptionalContentConfig({ intent: 'display' });
      if (!config || typeof config.getGroups !== 'function') return null;
      const groups = config.getGroups() || {};
      Object.keys(groups).forEach((id) => {
        const g = groups[id] || {};
        const rawName = g.name || g._name || '';
        const normalizedName = normalize(rawName);
        if (wanted.has(normalizedName)) {
          try { if (typeof config.setVisibility === 'function') config.setVisibility(id, false); } catch {}
          try { groups[id].visible = false; } catch {}
        }
      });
      return Promise.resolve(config);
    } catch {
      return null;
    }
  }

  function progressStart(label){
    showEl(ActionProgressWrap);
    if (ActionProgress) ActionProgress.value = 0;
    if (ActionProgressLabel) ActionProgressLabel.textContent = label || 'Elaborazione in corso…';
  }
  function progressSet(value, label){
    if (ActionProgress) ActionProgress.value = value;
    if (ActionProgressLabel && label) ActionProgressLabel.textContent = label;
  }
  function progressDone(label){
    if (ActionProgress) ActionProgress.value = 100;
    if (ActionProgressLabel) ActionProgressLabel.textContent = label || 'Esportazione completata.';
    setTimeout(() => hideEl(ActionProgressWrap), 1200);
  }
  async function downloadZip(zip, filename){
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level: 5 } }, meta => {
      if (ActionProgressLabel) ActionProgressLabel.textContent = `Compressione ZIP… ${Math.round(meta.percent || 0)}%`;
    });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportImagesSection(){
    ensureState();
    const files = state.sectionUploads[state.section] || [];
    const initiative = slugify(state.platformSlug);
    const slotDefs = exportableSlots();
    if (!initiative){ alert('Inserisci il nome iniziativa.'); return; }
    if (state.section === 'altro' && !slugify(state.customSectionName)){ alert('Inserisci il nome della mini sezione Altro.'); return; }
    if (!files.length){ alert(`Carica una cartella immagini per la sezione ${getSectionLabel()}.`); return; }
    if (!slotDefs.length){ alert('Seleziona almeno un formato da esportare.'); return; }

    const total = files.length * slotDefs.length;
    const zip = new JSZip();
    let done = 0;
    progressStart(`Esporto ${getSectionLabel()}…`);
    const sectionSlug = getSectionSlug();

    for (const slot of slotDefs){
      for (let i = 0; i < files.length; i++){
        const file = files[i];
        progressSet(Math.round((done / Math.max(total, 1)) * 100), `Elaboro ${getSectionLabel()} · ${slot.label} · ${i+1}/${files.length}…`);
        const bmp = await loadBitmapOriented(file);
        const deskCanvas = drawCoverToCanvas(bmp, slot.desk[0], slot.desk[1]);
        const mobCanvas = drawCoverToCanvas(bmp, slot.mob[0], slot.mob[1]);
        const deskBlob = await canvasToBlob(deskCanvas, 'image/jpeg', 0.9);
        const mobBlob = await canvasToBlob(mobCanvas, 'image/jpeg', 0.9);
        const nn = pad(i + 1);
        const baseDesk = `${initiative}-${sectionSlug}-${slot.key}-desktop-${nn}.jpg`;
        const baseMob = `${initiative}-${sectionSlug}-${slot.key}-mobile-${nn}.jpg`;
        zip.file(`PIATTAFORMA/${sectionSlug}/desktop/${slot.key}/${baseDesk}`, deskBlob, { binary:true });
        zip.file(`PIATTAFORMA/${sectionSlug}/mobile/${slot.key}/${baseMob}`, mobBlob, { binary:true });
        done += 1;
      }
    }
    await downloadZip(zip, `PIATTAFORMA-${sectionSlug}-${initiative}-${nowStamp()}.zip`);
    progressDone(`${getSectionLabel()} esportata.`);
  }

  async function preparePlanCropItems(files){
    const items = [];
    progressStart('Preparo il crop delle planimetrie…');
    let processed = 0;
    let total = files.length;
    if (files.some(f => /\.pdf$/i.test(f.name))){
      try { if (typeof ensurePdfJs === 'function') await ensurePdfJs(); } catch {}
    }
    for (const file of files){
      if (/\.pdf$/i.test(file.name)){
        if (typeof window.pdfjsLib === 'undefined') throw new Error('Il supporto PDF non è disponibile.');
        const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), useWorkerFetch:true, isEvalSupported:false }).promise;
        const optionalContentConfigPromise = await buildPdfOptionalContentConfigPromise(pdf, ['CARTIGLIO','5_TESTO']);
        total += Math.max(0, pdf.numPages - 1);
        for (let p = 1; p <= pdf.numPages; p++){
          progressSet(Math.round((processed / Math.max(total,1)) * 100), `Preparo ${file.name} · pagina ${p}/${pdf.numPages}…`);
          const page = await pdf.getPage(p);
          const rendered = await renderPdfPage(page, optionalContentConfigPromise);
          const prepared = preparePdfCanvasForCrop(rendered);
          const base = file.name.replace(/\.pdf$/i, '');
          items.push({ name: `${base}${pdf.numPages > 1 ? '-' + pad(p) : ''}`, source: prepared, cropData: null });
          processed += 1;
          try { page.cleanup && page.cleanup(); } catch {}
        }
        try { pdf.cleanup && pdf.cleanup(); } catch {}
        try { pdf.destroy && pdf.destroy(); } catch {}
      } else {
        progressSet(Math.round((processed / Math.max(total,1)) * 100), `Preparo ${file.name}…`);
        const bmp = await loadBitmapOriented(file);
        const landscape = rotateSourceToLandscape(bmp);
        const base = file.name.replace(/\.[^.]+$/, '');
        items.push({ name: base, source: landscape, cropData: null });
        processed += 1;
      }
    }
    return items;
  }

  function updatePlanCropPreview(){
    const frame = $('#PlatformPlanCropFrame');
    const img = $('#PlatformPlanCropImg');
    const zoom = $('#PlatformPlanCropZoom');
    const item = state.planCrop.items[state.planCrop.index];
    const crop = state.planCrop.crop;
    if (!frame || !img || !item) return;
    const rect = frame.getBoundingClientRect();
    const frameW = Math.max(1, rect.width);
    const frameH = Math.max(1, rect.height);
    const iw = item.source.width;
    const ih = item.source.height;
    const contain = Math.min(frameW / iw, frameH / ih);
    crop.containScale = Math.max(0.01, contain);
    crop.minScale = Math.max(crop.containScale * 0.30, 0.01);
    crop.maxScale = Math.max(crop.containScale * 5, crop.containScale + 0.01);
    const existing = item.cropData;
    if (existing && typeof existing.scale === 'number'){
      crop.x = existing.x || 0;
      crop.y = existing.y || 0;
      crop.scale = Math.max(crop.minScale, Math.min(existing.scale, crop.maxScale));
    } else {
      crop.x = 0; crop.y = 0; crop.scale = crop.containScale;
    }
    img.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`;
    if (zoom){
      zoom.min = String(crop.minScale);
      zoom.max = String(crop.maxScale);
      zoom.step = String(Math.max((crop.maxScale - crop.minScale) / 200, 0.005));
      zoom.value = String(crop.scale);
      const min = Number(zoom.min) || 0;
      const max = Number(zoom.max) || 1;
      const val = Number(zoom.value) || min;
      const pct = (max > min) ? ((val - min) / (max - min)) * 100 : 0;
      paintPlanRangeFill(zoom, pct);
    }
  }

  function resetPlanCrop(mode='contain'){
    const img = $('#PlatformPlanCropImg');
    const zoom = $('#PlatformPlanCropZoom');
    const crop = state.planCrop.crop;
    crop.x = 0; crop.y = 0;
    crop.scale = mode === 'contain' ? crop.containScale : crop.minScale;
    if (img) img.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`;
    if (zoom){
      zoom.value = String(crop.scale);
      const min = Number(zoom.min) || 0;
      const max = Number(zoom.max) || 1;
      const val = Number(zoom.value) || min;
      const pct = (max > min) ? ((val - min) / (max - min)) * 100 : 0;
      paintPlanRangeFill(zoom, pct);
    }
  }

  function saveCurrentCrop(skipped=false){
    const frame = $('#PlatformPlanCropFrame');
    const item = state.planCrop.items[state.planCrop.index];
    if (!item || !frame) return;
    const rect = frame.getBoundingClientRect();
    item.cropData = skipped ? { skipped:true } : {
      skipped:false,
      x: state.planCrop.crop.x,
      y: state.planCrop.crop.y,
      scale: state.planCrop.crop.scale,
      frameW: Math.max(1, rect.width),
      frameH: Math.max(1, rect.height)
    };
  }

  async function saveAndAdvancePlanCrop(skipped=false){
    saveCurrentCrop(skipped);
    const isLast = state.planCrop.index >= state.planCrop.items.length - 1;
    if (isLast){
      await finalizePlanCropExport();
      return;
    }
    state.planCrop.index += 1;
    renderPlanCropView();
  }

  function rotateCurrentPlanCrop(){
    const item = state.planCrop.items[state.planCrop.index];
    if (!item || !item.source) return;
    item.source = rotateCanvas90(item.source);
    item.cropData = null;
    renderPlanCropView();
  }

  function initPlanCropUI(item){
    const frame = $('#PlatformPlanCropFrame');
    const img = $('#PlatformPlanCropImg');
    const zoom = $('#PlatformPlanCropZoom');
    const crop = state.planCrop.crop;
    if (!frame || !img) return;
    try { img.src = item.source.toDataURL('image/png'); } catch { img.src = ''; }
    img.onload = () => requestAnimationFrame(() => updatePlanCropPreview());
    frame.addEventListener('pointerdown', (e) => {
      crop.dragging = true;
      crop.startX = e.clientX;
      crop.startY = e.clientY;
      crop.pointerId = e.pointerId;
      try { frame.setPointerCapture(e.pointerId); } catch {}
    });
    frame.addEventListener('pointermove', (e) => {
      if (!crop.dragging) return;
      if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
      crop.x += (e.clientX - crop.startX);
      crop.y += (e.clientY - crop.startY);
      crop.startX = e.clientX;
      crop.startY = e.clientY;
      img.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`;
    });
    const endPointer = (e) => {
      if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
      crop.dragging = false;
      try { frame.releasePointerCapture(crop.pointerId); } catch {}
      crop.pointerId = null;
    };
    frame.addEventListener('pointerup', endPointer);
    frame.addEventListener('pointercancel', endPointer);
    zoom?.addEventListener('input', () => {
      const min = Number(zoom.min) || 0;
      const max = Number(zoom.max) || 1;
      crop.scale = Math.max(crop.minScale, Math.min(Number(zoom.value) || crop.minScale, crop.maxScale));
      img.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`;
      const pct = (max > min) ? ((crop.scale - min) / (max - min)) * 100 : 0;
      paintPlanRangeFill(zoom, pct);
    });
    updatePlanCropPreview();
  }

  async function finalizePlanCropExport(){
    progressStart('Creo ZIP planimetrie…');
    const zip = new JSZip();
    const items = state.planCrop.items;
    for (let i = 0; i < items.length; i++){
      const item = items[i];
      progressSet(Math.round((i / Math.max(items.length,1)) * 100), `Esporto ${item.name}…`);
      const { w, h } = getPlanOutputSize();
      const canvas = drawCropStateToCanvas(item.source, w, h, item.cropData);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      zip.file(`PIATTAFORMA/planimetrie/${item.name}-preview.jpg`, blob, { binary:true });
    }
    await downloadZip(zip, `PIATTAFORMA-planimetrie-${nowStamp()}.zip`);
    state.planCrop.active = false;
    state.planCrop.items = [];
    state.planCrop.index = 0;
    showEl(BtnProcedi);
    renderPlansView();
    afterRenderBindDnD();
    progressDone('Planimetrie esportate.');
  }

  async function startPlanCropFlow(){
    const files = state.plans || [];
    if (!files.length){ alert('Carica almeno una planimetria o un PDF.'); return; }
    hideEl(BtnProcedi);
    const items = await preparePlanCropItems(files);
    hideEl(ActionProgressWrap);
    state.planCrop.active = true;
    state.planCrop.items = items;
    state.planCrop.index = 0;
    renderPlanCropView();
  }

  window.exportPlatform = async function(){
    if (state.view === 'plans') return startPlanCropFlow();
    if (state.view === 'rename') return exportRenameFiles();
    return exportImagesSection();
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureState();
    bindEvents();
    render();
    afterRenderBindDnD();
  });
})();
