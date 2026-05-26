/* =============================== Piattaforma (Absuite) ====================== */
(function(){
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const showEl = (el) => el && el.classList.remove('hidden');
  const hideEl = (el) => el && el.classList.add('hidden');

  const PlatformCard = $('#PlatformCard');
  const PlatformModeSwitch = $('#PlatformModeSwitch');
  const PlatformSectionTabs = $('#PlatformSectionTabs');
  const PlatformBody = $('#PlatformBody');
  const ActionProgressWrap = $('#ActionProgressWrap');
  const ActionProgress = $('#ActionProgress');
  const ActionProgressLabel = $('#ActionProgressLabel');

  const BASE_SLOTS = [
    { key:'hero', label:'Hero', desk:[1920,1080], mob:[750,1600], enabled:true },
    { key:'carousel', label:'Carousel', desk:[1420,642], mob:[660,660], enabled:true },
    { key:'immagine', label:'Immagine', desk:[1760,990], mob:[670,420], enabled:true },
    { key:'testo-immagine', label:'Testo e immagine', desk:[880,1080], mob:[750,720], enabled:true },
    { key:'banner', label:'Banner', desk:[1920,1080], mob:[750,1600], enabled:true },
    { key:'banner-appuntamento', label:'Banner appuntamento', desk:[1920,680], mob:[750,1440], enabled:true },
    { key:'appartamenti', label:'Appartamenti', desk:[1920,1080], mob:[1420,642], enabled:true }
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
    customFormats: Object.fromEntries(BASE_SLOTS.map(s => [s.key, true]))
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
  function getSectionLabel(sectionKey=state.section){
    if (sectionKey === 'altro'){
      return (state.customSectionName || '').trim() || 'Altro';
    }
    return (SECTIONS.find(s => s.key === sectionKey) || {}).label || sectionKey;
  }
  function getSectionSlug(sectionKey=state.section){ return slugify(getSectionLabel(sectionKey)); }
  function activeSlots(){
    const section = getSectionDef();
    let slotKeys = [...section.slots];
    if (section.key === 'altro') slotKeys = slotKeys.filter(k => !!state.customFormats[k]);
    return slotKeys.map(getSlotDef).filter(Boolean);
  }
  function humanCount(files){
    const n = (files || []).length;
    return n ? `${n} file pronti` : 'Nessun file caricato';
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

  function renderSectionTabs(){
    if (!PlatformSectionTabs) return;
    PlatformSectionTabs.innerHTML = '';
    if (state.view !== 'images') return;
    SECTIONS.forEach(section => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'platform-pill' + (state.section === section.key ? ' active' : '');
      btn.dataset.platformSection = section.key;
      btn.textContent = section.label;
      PlatformSectionTabs.appendChild(btn);
    });
  }

  function eyeIcon(hidden=false){
    return hidden
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.9 5.1A11 11 0 0 1 12 4.9c6.5 0 10.5 7.1 10.5 7.1a21.4 21.4 0 0 1-4.3 4.9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.6 6.6A21.4 21.4 0 0 0 1.5 12s4 7.1 10.5 7.1a10.8 10.8 0 0 0 5-1.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>`;
  }

  function renderFormatCard(slot, enabled=true){
    return `
      <article class="platform-format-card ${enabled ? '' : 'is-disabled'}" data-format-key="${slot.key}">
        <div class="platform-format-top">
          <div>
            <h4>${slot.label}</h4>
            <p class="muted">Desktop ${slot.desk[0]}×${slot.desk[1]} · Mobile ${slot.mob[0]}×${slot.mob[1]} · cover</p>
          </div>
          <button type="button" class="platform-eye-btn" data-toggle-format="${slot.key}" aria-pressed="${enabled ? 'true' : 'false'}" title="${enabled ? 'Nascondi export formato' : 'Mostra export formato'}">
            ${eyeIcon(!enabled)}
          </button>
        </div>
      </article>
    `;
  }

  function renderImagesView(){
    const section = getSectionDef();
    const files = state.sectionUploads[section.key] || [];
    const slots = activeSlots();
    const formatCards = slots.map(slot => renderFormatCard(slot, section.key === 'altro' ? !!state.customFormats[slot.key] : true)).join('');
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
        <div class="platform-formats-grid">
          ${formatCards}
        </div>
        <div class="platform-footnote muted">Esportazione: <strong>${getSectionLabel()}</strong> → <strong>desktop/mobile</strong> → sottocartelle formato (<strong>hero</strong>, <strong>carousel</strong>, <strong>banner</strong>…). Ogni immagine caricata viene generata in tutti i formati attivi della sezione.</div>
      </div>`;
  }

  function renderPlansView(){
    const total = state.plans.length;
    const names = total ? state.plans.slice(0,4).map(f => f.name).join(', ') : 'Accetta JPG/PNG/WEBP/TIFF/PDF anche misti. Drag & drop cartella o file supportato su desktop.';
    PlatformBody.innerHTML = `
      <div class="platform-plans-wrap">
        <div class="platform-plan-card">
          <h4>Preview planimetrie</h4>
          <p class="muted">Output automatico JPG 850×1000 px con <strong>contain</strong>. Se il file sorgente è verticale, viene ruotato in orizzontale prima del contain per uniformare la resa finale. Il nome finale resta sempre <strong>nomefile-preview.jpg</strong>.</p>
          <div class="platform-upload platform-plan-upload" data-plan-drop tabindex="0" role="button" aria-label="Carica planimetrie" title="Clicca per selezionare file o trascina qui cartella/file supportato">
            <div class="platform-upload-inner platform-upload-inner--stack">
              <div class="platform-upload-copy">
                <strong>${total ? `${total} file pronti per l'export` : 'Clicca o trascina qui cartelle / file misti JPG e PDF'}</strong>
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
    if (state.view === 'images') renderImagesView();
    else renderPlansView();
  }

  function storeSectionFiles(files){
    state.sectionUploads[state.section] = files;
    renderImagesView();
  }

  function storePlanFiles(files){
    state.plans = files;
    renderPlansView();
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
      if (e.target.id === 'PlatformSlugInput') { state.platformSlug = e.target.value || ''; renderImagesView(); afterRenderBindDnD(); }
      if (e.target.id === 'PlatformCustomSectionName') { state.customSectionName = e.target.value || ''; renderImagesView(); afterRenderBindDnD(); }
    });

    PlatformBody?.addEventListener('click', (e) => {
      const pickSection = e.target.closest('[data-section-pick]');
      if (pickSection){ e.preventDefault(); return pickImageSectionFiles(); }
      const clearSection = e.target.closest('[data-section-clear]');
      if (clearSection){ e.preventDefault(); state.sectionUploads[state.section] = []; renderImagesView(); return afterRenderBindDnD(); }
      const dropSection = e.target.closest('[data-section-drop]');
      if (dropSection){ e.preventDefault(); return pickImageSectionFiles(); }
      const planPick = e.target.closest('[data-plan-pick]');
      if (planPick){ e.preventDefault(); return pickPlanFiles(); }
      const planClear = e.target.closest('[data-plan-clear]');
      if (planClear){ e.preventDefault(); state.plans = []; renderPlansView(); return afterRenderBindDnD(); }
      const planDrop = e.target.closest('[data-plan-drop]');
      if (planDrop){ e.preventDefault(); return pickPlanFiles(); }
      const toggleFormat = e.target.closest('[data-toggle-format]');
      if (toggleFormat){
        e.preventDefault();
        const key = toggleFormat.dataset.toggleFormat;
        state.customFormats[key] = !state.customFormats[key];
        renderImagesView();
        return afterRenderBindDnD();
      }
    });

    PlatformBody?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const dropSection = e.target.closest('[data-section-drop]');
      if (dropSection){ e.preventDefault(); pickImageSectionFiles(); }
      const planDrop = e.target.closest('[data-plan-drop]');
      if (planDrop){ e.preventDefault(); pickPlanFiles(); }
    });
  }

  function afterRenderBindDnD(){
    setupDropzone($('.platform-upload-dropzone', PlatformBody), (files) => storeSectionFiles(filterImages(files)), 'images');
    setupDropzone($('.platform-plan-upload', PlatformBody), (files) => storePlanFiles(filterPlanFiles(files)), 'plans');
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

  function drawPlanPreviewToCanvas(source, W=850, H=1000, bg='#ffffff'){
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    if (sh > sw){
      const rotated = document.createElement('canvas');
      rotated.width = sh;
      rotated.height = sw;
      const rctx = rotated.getContext('2d', { alpha:false });
      rctx.fillStyle = bg;
      rctx.fillRect(0,0,rotated.width, rotated.height);
      rctx.translate(rotated.width / 2, rotated.height / 2);
      rctx.rotate(Math.PI / 2);
      rctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);
      return drawContainToCanvas(rotated, W, H, bg);
    }
    return drawContainToCanvas(source, W, H, bg);
  }

  async function canvasToBlob(canvas, type='image/jpeg', quality=0.9){
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Impossibile generare il file.')), type, quality);
    });
  }

  async function renderPdfPage(page){
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha:false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
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
    const slotDefs = activeSlots();
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
        const originalBase = slugify((file.name || '').replace(/\.[^.]+$/, '')) || `img-${pad(i+1)}`;
        const numbered = files.length > 1 ? `-${pad(i+1)}` : '';
        const baseName = `${initiative}-${sectionSlug}-${originalBase}${numbered}`;
        zip.file(`PIATTAFORMA/${sectionSlug}/desktop/${slot.key}/${baseName}-desktop.jpg`, deskBlob, { binary:true });
        zip.file(`PIATTAFORMA/${sectionSlug}/mobile/${slot.key}/${baseName}-mobile.jpg`, mobBlob, { binary:true });
        done += 1;
      }
    }
    await downloadZip(zip, `PIATTAFORMA-${sectionSlug}-${initiative}-${nowStamp()}.zip`);
    progressDone(`${getSectionLabel()} esportata.`);
  }

  async function exportPlans(){
    const files = state.plans || [];
    if (!files.length){ alert('Carica almeno una planimetria o un PDF.'); return; }
    progressStart('Esporto planimetrie…');
    const zip = new JSZip();
    let done = 0;
    let totalUnits = files.length;
    if (files.some(f => /\.pdf$/i.test(f.name))){
      try { if (typeof ensurePdfJs === 'function') await ensurePdfJs(); } catch {}
    }
    for (const file of files){
      if (/\.pdf$/i.test(file.name)){
        if (typeof window.pdfjsLib === 'undefined') throw new Error('Il supporto PDF non è disponibile.');
        const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), useWorkerFetch:true, isEvalSupported:false }).promise;
        totalUnits += Math.max(0, pdf.numPages - 1);
        for (let p = 1; p <= pdf.numPages; p++){
          progressSet(Math.round((done / Math.max(totalUnits,1)) * 100), `Converto ${file.name} · pagina ${p}/${pdf.numPages}…`);
          const page = await pdf.getPage(p);
          const rendered = await renderPdfPage(page);
          const finalCanvas = drawPlanPreviewToCanvas(rendered, 850, 1000, '#ffffff');
          const blob = await canvasToBlob(finalCanvas, 'image/jpeg', 0.92);
          const base = file.name.replace(/\.pdf$/i, '');
          const pageSuffix = pdf.numPages > 1 ? `-${pad(p)}` : '';
          zip.file(`PIATTAFORMA/planimetrie/${base}${pageSuffix}-preview.jpg`, blob, { binary:true });
          done += 1;
          try { page.cleanup && page.cleanup(); } catch {}
        }
        try { pdf.cleanup && pdf.cleanup(); } catch {}
        try { pdf.destroy && pdf.destroy(); } catch {}
      } else {
        progressSet(Math.round((done / Math.max(totalUnits,1)) * 100), `Converto ${file.name}…`);
        const bmp = await loadBitmapOriented(file);
        const finalCanvas = drawPlanPreviewToCanvas(bmp, 850, 1000, '#ffffff');
        const blob = await canvasToBlob(finalCanvas, 'image/jpeg', 0.92);
        const base = file.name.replace(/\.[^.]+$/,'');
        zip.file(`PIATTAFORMA/planimetrie/${base}-preview.jpg`, blob, { binary:true });
        done += 1;
      }
    }
    await downloadZip(zip, `PIATTAFORMA-planimetrie-${nowStamp()}.zip`);
    progressDone('Planimetrie esportate.');
  }

  window.exportPlatform = async function(){
    if (state.view === 'plans') return exportPlans();
    return exportImagesSection();
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureState();
    bindEvents();
    render();
    afterRenderBindDnD();
  });
})();
