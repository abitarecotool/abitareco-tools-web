/* =============================== Piattaforma (Absuite) ====================== */
(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const showEl = (el) => el && el.classList.remove('hidden');
  const hideEl = (el) => el && el.classList.add('hidden');

  const PlatformCard = $('#PlatformCard');
  const PlatformSlug = $('#PlatformSlug');
  const PlatformModeSwitch = $('#PlatformModeSwitch');
  const PlatformSectionTabs = $('#PlatformSectionTabs');
  const PlatformBody = $('#PlatformBody');
  const ActionProgressWrap = $('#ActionProgressWrap');
  const ActionProgress = $('#ActionProgress');
  const ActionProgressLabel = $('#ActionProgressLabel');

  const SECTIONS = [
    {
      key: 'homepage',
      label: 'Homepage',
      slots: [
        { key:'hero', label:'Hero', desk:[1920,1080], mob:[750,1600] },
        { key:'testo-immagine', label:'Testo e immagine', desk:[880,1080], mob:[750,720] },
        { key:'banner', label:'Banner', desk:[1920,1080], mob:[750,1600] },
        { key:'banner-appuntamento', label:'Banner appuntamento', desk:[1920,680], mob:[750,1440] }
      ]
    },
    {
      key: 'progetto',
      label: 'Il progetto',
      slots: [
        { key:'hero', label:'Hero', desk:[1920,1080], mob:[750,1600] },
        { key:'carousel', label:'Carousel', desk:[1420,642], mob:[660,660] },
        { key:'testo-immagine', label:'Testo e immagine', desk:[880,1080], mob:[750,720] },
        { key:'banner', label:'Banner', desk:[1920,1080], mob:[750,1600] },
        { key:'banner-appuntamento', label:'Banner appuntamento', desk:[1920,680], mob:[750,1440] }
      ]
    },
    {
      key: 'appartamenti',
      label: 'Gli appartamenti',
      slots: [
        { key:'hero', label:'Hero', desk:[1920,1080], mob:[750,1600] },
        { key:'appartamenti', label:'Appartamenti', desk:[1920,1080], mob:[1420,642] },
        { key:'testo-immagine', label:'Testo e immagine', desk:[880,1080], mob:[750,720] },
        { key:'banner', label:'Banner', desk:[1920,1080], mob:[750,1600] },
        { key:'banner-appuntamento', label:'Banner appuntamento', desk:[1920,680], mob:[750,1440] }
      ]
    },
    {
      key: 'dintorni',
      label: 'I dintorni',
      slots: [
        { key:'hero', label:'Hero', desk:[1920,1080], mob:[750,1600] },
        { key:'immagine', label:'Immagine', desk:[1760,990], mob:[670,420] },
        { key:'carousel', label:'Carousel', desk:[1420,642], mob:[660,660] },
        { key:'testo-immagine', label:'Testo e immagine', desk:[880,1080], mob:[750,720] },
        { key:'banner', label:'Banner', desk:[1920,1080], mob:[750,1600] },
        { key:'banner-appuntamento', label:'Banner appuntamento', desk:[1920,680], mob:[750,1440] }
      ]
    }
  ];

  const state = {
    view: 'images',
    section: 'homepage',
    images: {},
    plans: []
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

  function toArray(fileList){
    return Array.from(fileList || []);
  }

  function filterImages(files){
    return toArray(files).filter(f => /\.(jpe?g|png|webp|tif?f)$/i.test(f.name));
  }

  function filterPlanFiles(files){
    return toArray(files).filter(f => /\.(jpe?g|png|webp|tif?f|pdf)$/i.test(f.name));
  }

  function ensureState(){
    for (const section of SECTIONS){
      for (const slot of section.slots){
        const k = `${section.key}:${slot.key}`;
        if (!state.images[k]) state.images[k] = [];
      }
    }
  }

  function currentSectionConfig(){
    return SECTIONS.find(s => s.key === state.section) || SECTIONS[0];
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

  function slotHint(slot){
    return `Desktop ${slot.desk[0]}×${slot.desk[1]} · Mobile ${slot.mob[0]}×${slot.mob[1]} · cover`;
  }

  function renderImagesView(){
    const section = currentSectionConfig();
    const html = [`<div class="platform-section-grid">`];
    for (const slot of section.slots){
      const stateKey = `${section.key}:${slot.key}`;
      const files = state.images[stateKey] || [];
      const total = files.length;
      const firstName = total ? files[0].name : '';
      html.push(`
        <article class="platform-slot-card" data-platform-slot="${stateKey}">
          <div class="platform-slot-top">
            <div>
              <h4>${slot.label}</h4>
              <p class="muted">${slotHint(slot)}</p>
            </div>
            <div class="platform-generated-name">${slugify(PlatformSlug?.value || 'nome-iniziativa') || 'nome-iniziativa'}-${section.key}-${slot.key}</div>
          </div>
          <div class="platform-upload" data-upload-slot="${stateKey}" tabindex="0" role="button" aria-label="Upload ${slot.label}">
            <div class="platform-upload-inner">
              <div class="platform-upload-copy">
                <strong>${isMobileUploadUI() ? 'Tocca per aprire la galleria foto' : 'Clicca per selezionare una cartella immagini'}</strong>
                <span class="muted">${total ? `${total} file caricati${firstName ? ` · primo file: ${firstName}` : ''}` : 'Puoi caricare uno o più file per questo blocco.'}</span>
              </div>
              <div class="platform-upload-actions">
                <button type="button" class="btn-outline platform-mini-btn" data-platform-pick="${stateKey}">${isMobileUploadUI() ? 'Apri galleria' : 'Seleziona cartella'}</button>
                <button type="button" class="btn-outline platform-mini-btn ${total ? '' : 'hidden'}" data-platform-clear="${stateKey}">Svuota</button>
              </div>
            </div>
          </div>
        </article>
      `);
    }
    html.push(`</div>
      <div class="platform-footnote muted">Esporta dalla action bar la sezione attiva <strong>${section.label}</strong>. Se in uno slot carichi più immagini, il tool aggiunge automaticamente il contatore finale 01, 02, 03…</div>`);
    PlatformBody.innerHTML = html.join('');
  }

  function renderPlansView(){
    const total = state.plans.length;
    const names = total ? state.plans.slice(0,3).map(f => f.name).join(', ') : '';
    PlatformBody.innerHTML = `
      <div class="platform-plans-wrap">
        <div class="platform-plan-card">
          <h4>Preview planimetrie</h4>
          <p class="muted">Output automatico JPG 850×1000 px con contain e suffisso finale <strong>-preview.jpg</strong>. Supporta immagini e PDF multipagina.</p>
          <div class="platform-upload platform-plan-upload" tabindex="0" role="button" aria-label="Carica planimetrie">
            <div class="platform-upload-inner platform-upload-inner--stack">
              <div class="platform-upload-copy">
                <strong>${total ? `${total} file pronti per l'export` : 'Carica planimetrie da cartella, file immagine o PDF'}</strong>
                <span class="muted">${total ? names : 'Su desktop puoi usare cartella o file/PDF. Su mobile si apre il selettore file/galleria a seconda del contenuto scelto.'}</span>
              </div>
              <div class="platform-upload-actions platform-upload-actions--wrap">
                <button type="button" class="btn-outline platform-mini-btn" data-plan-pick="folder">Cartella immagini</button>
                <button type="button" class="btn-outline platform-mini-btn" data-plan-pick="files">File / PDF</button>
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
    $$('.platform-switch-btn', PlatformModeSwitch || document).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.platformView === state.view);
    });
    if (state.view === 'images') renderImagesView();
    else renderPlansView();
  }

  function bindEvents(){
    PlatformModeSwitch?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform-view]');
      if (!btn) return;
      state.view = btn.dataset.platformView;
      render();
    });

    PlatformSectionTabs?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform-section]');
      if (!btn) return;
      state.section = btn.dataset.platformSection;
      render();
    });

    PlatformSlug?.addEventListener('input', () => {
      if (state.view === 'images') renderImagesView();
    });

    PlatformBody?.addEventListener('click', async (e) => {
      const pickBtn = e.target.closest('[data-platform-pick]');
      if (pickBtn){
        e.preventDefault();
        return pickImagesForSlot(pickBtn.dataset.platformPick);
      }
      const clearBtn = e.target.closest('[data-platform-clear]');
      if (clearBtn){
        e.preventDefault();
        state.images[clearBtn.dataset.platformClear] = [];
        return renderImagesView();
      }
      const planPick = e.target.closest('[data-plan-pick]');
      if (planPick){
        e.preventDefault();
        return pickPlanFiles(planPick.dataset.planPick);
      }
      const planClear = e.target.closest('[data-plan-clear]');
      if (planClear){
        e.preventDefault();
        state.plans = [];
        return renderPlansView();
      }
      const uploadArea = e.target.closest('[data-upload-slot]');
      if (uploadArea){
        e.preventDefault();
        return pickImagesForSlot(uploadArea.dataset.uploadSlot);
      }
      const planArea = e.target.closest('.platform-plan-upload');
      if (planArea){
        e.preventDefault();
        return pickPlanFiles('files');
      }
    });

    PlatformBody?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const uploadArea = e.target.closest('[data-upload-slot]');
      if (uploadArea){
        e.preventDefault();
        pickImagesForSlot(uploadArea.dataset.uploadSlot);
      }
    });
  }

  function pickImagesForSlot(stateKey){
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (isMobileUploadUI()) {
      input.accept = 'image/*';
    } else {
      input.webkitdirectory = true;
      input.directory = true;
    }
    input.onchange = () => {
      const files = filterImages(input.files);
      state.images[stateKey] = files;
      renderImagesView();
    };
    input.click();
  }

  function pickPlanFiles(mode){
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (mode === 'folder') {
      input.webkitdirectory = true;
      input.directory = true;
    } else {
      input.accept = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf,image/*,application/pdf';
    }
    input.onchange = () => {
      state.plans = filterPlanFiles(input.files);
      renderPlansView();
    };
    input.click();
  }

  async function loadBitmapOriented(file){
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
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
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportImagesSection(){
    ensureState();
    const section = currentSectionConfig();
    const initiative = slugify(PlatformSlug?.value);
    if (!initiative){
      alert('Inserisci il nome iniziativa.');
      return;
    }
    const totalFiles = section.slots.reduce((sum, slot) => sum + (state.images[`${section.key}:${slot.key}`] || []).length, 0);
    if (!totalFiles){
      alert(`Carica almeno un blocco immagini nella sezione ${section.label}.`);
      return;
    }
    progressStart(`Esporto ${section.label}…`);
    const zip = new JSZip();
    let done = 0;
    for (const slot of section.slots){
      const files = state.images[`${section.key}:${slot.key}`] || [];
      if (!files.length) continue;
      for (let i = 0; i < files.length; i++){
        const file = files[i];
        progressSet(Math.round((done / Math.max(totalFiles,1)) * 100), `Elaboro ${section.label} · ${slot.label} · ${i+1}/${files.length}…`);
        const bmp = await loadBitmapOriented(file);
        const deskCanvas = drawCoverToCanvas(bmp, slot.desk[0], slot.desk[1]);
        const mobCanvas = drawCoverToCanvas(bmp, slot.mob[0], slot.mob[1]);
        const deskBlob = await canvasToBlob(deskCanvas, 'image/jpeg', 0.9);
        const mobBlob  = await canvasToBlob(mobCanvas, 'image/jpeg', 0.9);
        const suffix = files.length > 1 ? `-${pad(i+1)}` : '';
        const baseName = `${initiative}-${section.key}-${slot.key}${suffix}`;
        zip.file(`PIATTAFORMA/${section.key}/desktop/${baseName}-desktop.jpg`, deskBlob, { binary:true });
        zip.file(`PIATTAFORMA/${section.key}/mobile/${baseName}-mobile.jpg`, mobBlob, { binary:true });
        done += 1;
      }
    }
    await downloadZip(zip, `PIATTAFORMA-${initiative}-${section.key}-${nowStamp()}.zip`);
    progressDone(`${section.label} esportata.`);
  }

  async function exportPlans(){
    const files = state.plans || [];
    if (!files.length){
      alert('Carica almeno una planimetria o un PDF.');
      return;
    }
    progressStart('Esporto planimetrie…');
    const zip = new JSZip();
    let done = 0;
    let totalUnits = files.length;
    if (files.some(f => /\.pdf$/i.test(f.name))){
      try { if (typeof ensurePdfJs === 'function') await ensurePdfJs(); } catch {}
    }
    // Estimate extra pages progressively during render.
    for (const file of files){
      if (/\.pdf$/i.test(file.name)){
        if (typeof window.pdfjsLib === 'undefined'){
          throw new Error('Il supporto PDF non è disponibile.');
        }
        const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), useWorkerFetch:true, isEvalSupported:false }).promise;
        totalUnits += Math.max(0, pdf.numPages - 1);
        for (let p = 1; p <= pdf.numPages; p++){
          progressSet(Math.round((done / Math.max(totalUnits,1)) * 100), `Converto ${file.name} · pagina ${p}/${pdf.numPages}…`);
          const page = await pdf.getPage(p);
          const rendered = await renderPdfPage(page);
          const finalCanvas = drawContainToCanvas(rendered, 850, 1000, '#ffffff');
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
        const finalCanvas = drawContainToCanvas(bmp, 850, 1000, '#ffffff');
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
  });
})();
