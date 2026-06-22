// js/modules/fattura.js — Preventivo / Fattura (Marketing/Admin)
(function(){
  'use strict';

  const $ = (s) => document.querySelector(s);
  const elRows = () => document.getElementById('FatRows');
  const PATH_JSON = './assets/data/listino_marketing.json';
  const PATH_CSV  = './assets/data/listino_marketing.csv';
  const MANROPE_REG  = './assets/fonts/Manrope-Regular.ttf';
  const MANROPE_BOLD = './assets/fonts/Manrope-Bold.ttf';
  const STORAGE_PREFIX = 'abitare_preventivo_';
  const STORAGE_INDEX_KEY = 'abitare_preventivi_index';
  const DOC_META = {
    preventivo: {
      title: 'Preventivo',
      intro: 'Seleziona una sezione e un prodotto dal listino, inserisci quantità e (opzionale) sconto. Il costo unitario si compila automaticamente ma resta modificabile. Poi clicca <b>Esporta Preventivo PDF</b>. I dati verranno salvati anche automaticamente nel browser e dentro al PDF esportato.',
      buttonText: 'Esporta Preventivo PDF',
      pdfLabel: 'Preventivo',
      filePrefix: 'preventivo',
    },
    fattura: {
      title: 'Fattura',
      intro: 'La struttura resta identica al preventivo: puoi usare le stesse voci e gli stessi importi. Se hai già creato un preventivo, recuperalo dal numero oppure caricando il PDF preventivo esportato e poi clicca <b>Crea Fattura PDF</b>.',
      buttonText: 'Crea Fattura PDF',
      pdfLabel: 'Fattura',
      filePrefix: 'fattura',
    }
  };

  let LISTINO = null;
  let __bound = false;
  let currentDocType = 'preventivo';

  function toast(msg){
    try{ if (window.showToast) return window.showToast(msg); } catch {}
    alert(msg);
  }

  function euro(n){
    const v = Number(n || 0);
    return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(v);
  }

  function todayISO(){
    const d = new Date();
    const pad = (x) => String(x).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function fmtDate(iso){
    try{
      const [y,m,d] = String(iso||'').split('-');
      if (!y || !m || !d) return iso || '';
      return `${d}/${m}/${y}`;
    } catch { return iso || ''; }
  }

  function makeTimestamp(){ return String(Date.now()); }
  function round2(n){ return Math.round((Number(n||0) + Number.EPSILON) * 100) / 100; }

  function parseCsvLine(line){
    const out = [];
    let cur = '';
    let q = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        if (q && line[i+1] === '"'){ cur += '"'; i++; }
        else q = !q;
        continue;
      }
      if (ch === ',' && !q){ out.push(cur); cur=''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  async function loadListino(){
    if (LISTINO) return LISTINO;
    try{
      const res = await fetch(PATH_JSON, { cache:'no-store' });
      if (res.ok){
        const j = await res.json();
        if (j && j.sections) { LISTINO = j; return LISTINO; }
      }
    } catch {}
    try{
      const res = await fetch(PATH_CSV, { cache:'no-store' });
      if (!res.ok) throw new Error('CSV non disponibile');
      const txt = await res.text();
      const lines = txt.split(/\r?\n/).filter(Boolean);
      if (!lines.length) throw new Error('CSV vuoto');
      const head = parseCsvLine(lines.shift());
      const idx = (name) => head.indexOf(name);
      const iSec = idx('Sezione');
      const iProd = idx('Prodotto');
      const iPrice = idx('Prezzo_cu');
      const map = new Map();
      for (const line of lines){
        const cols = parseCsvLine(line);
        const sec = cols[iSec] || 'GENERICO';
        if (!map.has(sec)) map.set(sec, []);
        map.get(sec).push({
          name: cols[iProd] || '',
          unitPrice: cols[iPrice] ? Number(String(cols[iPrice]).replace(',', '.')) : 0
        });
      }
      LISTINO = { version:1, currency:'EUR', sections: Array.from(map.entries()).map(([name,items]) => ({ name, items })) };
      return LISTINO;
    } catch (e){
      console.error(e);
      LISTINO = { version:1, currency:'EUR', sections: [] };
      return LISTINO;
    }
  }

  function fillSections(listino){
    const selSec = $('#FatSezione');
    const selProd = $('#FatProdotto');
    if (!selSec || !selProd) return;
    selSec.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const s of (listino.sections || [])){
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      frag.appendChild(opt);
    }
    selSec.appendChild(frag);
    if (selSec.options.length) selSec.selectedIndex = 0;
    fillProductsForSection(selSec.value);
    selSec.onchange = () => fillProductsForSection(selSec.value);
  }

  function fillProductsForSection(secName){
    const selProd = $('#FatProdotto');
    if (!selProd) return;
    const sec = (LISTINO?.sections || []).find(s => s.name === secName);
    selProd.innerHTML = '';
    const frag = document.createDocumentFragment();
    (sec?.items || []).forEach((it, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = it.name;
      frag.appendChild(opt);
    });
    selProd.appendChild(frag);
  }

  function getSelectedItem(){
    const selSec = $('#FatSezione');
    const selProd = $('#FatProdotto');
    const sec = (LISTINO?.sections || []).find(s => s.name === (selSec?.value || ''));
    const idx = Number(selProd?.value || 0);
    return sec && sec.items ? sec.items[idx] : null;
  }

  function makeDiscountSelect(selectedValue){
    const sel = document.createElement('select');
    const vals = [0,5,10,15,20,25,30,40,50];
    vals.forEach(v => {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = v === 0 ? '—' : `${v}%`;
      if (Number(selectedValue || 0) === v) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function calcRowTotal(qty, unit, disc){
    const q = Number(qty || 0);
    const u = Number(unit || 0);
    const d = Number(disc || 0);
    return round2((q * u) * (1 - d/100));
  }

  function makeField(labelText, inputEl, cls){
    const field = document.createElement('div');
    field.className = 'fat-field ' + (cls || '');
    const lbl = document.createElement('div');
    lbl.className = 'fat-mini-label';
    lbl.textContent = labelText;
    field.appendChild(lbl);
    field.appendChild(inputEl);
    return field;
  }

  function createRowElement(data){
    const wrap = document.createElement('div');
    wrap.className = 'fattura-row';
    wrap.dataset.product = data.product || '';

    const prod = document.createElement('div');
    prod.className = 'fat-prod';
    prod.textContent = data.product || '—';

    const desc = document.createElement('input');
    desc.type = 'text';
    desc.placeholder = 'Descrizione (es. Maggio)';
    desc.className = 'fat-desc';
    desc.value = data.desc || '';

    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '0';
    qty.step = '1';
    qty.value = String(data.qty ?? 1);
    qty.className = 'fat-qty';

    const unit = document.createElement('input');
    unit.type = 'number';
    unit.min = '-999999';
    unit.step = '1';
    unit.value = String(data.unit ?? 0);
    unit.className = 'fat-unit';

    const disc = makeDiscountSelect(data.disc ?? 0);
    disc.className = 'fat-disc';

    const tot = document.createElement('div');
    tot.className = 'fat-total';
    tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'fat-del';
    del.title = 'Rimuovi riga';
    del.textContent = '✕';
    del.onclick = () => { wrap.remove(); recomputeAll(); };

    const onChange = () => {
      tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value));
      recomputeAll();
    };
    qty.addEventListener('input', onChange);
    unit.addEventListener('input', onChange);
    disc.addEventListener('change', onChange);

    wrap.appendChild(prod);
    wrap.appendChild(makeField('Descrizione', desc, 'fat-field-desc'));
    wrap.appendChild(makeField('Quantità', qty, 'fat-field-qty'));
    wrap.appendChild(makeField('Costo unit.', unit, 'fat-field-unit'));
    wrap.appendChild(makeField('Sconto %', disc, 'fat-field-disc'));
    wrap.appendChild(tot);
    wrap.appendChild(del);

    return wrap;
  }

  function addRowFromSelected(){
    const it = getSelectedItem();
    if (!it){ toast('Seleziona un prodotto dal listino.'); return; }
    const row = createRowElement({
      product: it.name,
      desc: '',
      qty: 1,
      unit: it.unitPrice ?? 0,
      disc: 0,
    });
    elRows()?.appendChild(row);
    recomputeAll();
  }

  function addRowFromData(rowData){
    const row = createRowElement({
      product: rowData?.product || '',
      desc: rowData?.desc || '',
      qty: Number(rowData?.qty ?? 1),
      unit: Number(rowData?.unit ?? 0),
      disc: Number(rowData?.disc ?? 0),
    });
    elRows()?.appendChild(row);
    recomputeAll();
  }

  function clearRows(){
    const rowsEl = elRows();
    if (rowsEl) rowsEl.innerHTML = '';
    recomputeAll();
  }

  function recomputeAll(){
    const rows = Array.from(document.querySelectorAll('#FatRows .fattura-row'));
    let sum = 0;
    for (const r of rows){
      const qty = r.querySelector('.fat-qty')?.value;
      const unit = r.querySelector('.fat-unit')?.value;
      const disc = r.querySelector('.fat-disc')?.value;
      sum += calcRowTotal(qty, unit, disc);
    }
    const out = document.getElementById('FatTotale');
    if (out) out.textContent = euro(sum);
  }

  function initHeaderDefaults(){
    const n = document.getElementById('FatNumero');
    const d = document.getElementById('FatData');
    if (n && !n.value) n.value = makeTimestamp();
    if (d && !d.value) d.value = todayISO();
  }

  function getState(){
    const noteEnabled = !!document.getElementById('FatNoteToggle')?.checked;
    const header = {
      numero: ($('#FatNumero')?.value || makeTimestamp()).trim(),
      data: $('#FatData')?.value || todayISO(),
      commessa: ($('#FatCommessa')?.value || '').trim(),
      rifCommessa: ($('#FatRifCommessa')?.value || '').trim(),
      oggetto: ($('#FatOggetto')?.value || '').trim(),
      noteEnabled,
      note: noteEnabled ? ($('#FatNote')?.value || '').trim() : ''
    };
    const rows = Array.from(document.querySelectorAll('#FatRows .fattura-row')).map(r => {
      const prod = r.dataset.product || r.querySelector('.fat-prod')?.textContent || '';
      const desc = (r.querySelector('.fat-desc')?.value || '').trim();
      const qty = Number(r.querySelector('.fat-qty')?.value || 0);
      const unit = Number(r.querySelector('.fat-unit')?.value || 0);
      const disc = Number(r.querySelector('.fat-disc')?.value || 0);
      const total = calcRowTotal(qty, unit, disc);
      return { product: prod, desc, qty, unit, disc, total };
    });
    const total = round2(rows.reduce((a,b)=>a+(b.total||0),0));
    return { header, rows, total };
  }

  function makePayload(docTypeOverride){
    return {
      version: 1,
      source: 'Abitare Co. Preventivo/Fattura Tool',
      docType: docTypeOverride || currentDocType,
      savedAt: new Date().toISOString(),
      state: getState(),
    };
  }
  function stringifyPayload(payload){
    return JSON.stringify(payload || {});
  }
  function encodePayloadForPdf(payload){
    try{
      return btoa(unescape(encodeURIComponent(stringifyPayload(payload))));
    } catch {
      return '';
    }
  }
  function decodePayloadFromPdf(encoded){
    try{
      const json = decodeURIComponent(escape(atob(String(encoded || '').trim())));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  function getPdfPayloadMarker(payload){
    const enc = encodePayloadForPdf(payload);
    return enc ? `ABITARE_PF:${enc}` : '';
  }
  function readPayloadMarker(text){
    const raw = String(text || '');
    if (!raw.startsWith('ABITARE_PF:')) return null;
    return decodePayloadFromPdf(raw.slice('ABITARE_PF:'.length));
  }

  function readStorageIndex(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_INDEX_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeStorageIndex(list){
    try{
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(list));
    } catch {}
  }

  function savePreventivoState(payload){
    try{
      const numero = payload?.state?.header?.numero;
      if (!numero) return;
      localStorage.setItem(STORAGE_PREFIX + numero, JSON.stringify(payload));
      const index = readStorageIndex().filter(item => item?.numero !== numero);
      index.unshift({
        numero,
        updatedAt: payload.savedAt,
        oggetto: payload?.state?.header?.oggetto || '',
        commessa: payload?.state?.header?.commessa || ''
      });
      writeStorageIndex(index.slice(0, 50));
    } catch (e){
      console.warn('Impossibile salvare il preventivo in locale', e);
    }
  }

  function loadSavedPayload(numero){
    try{
      const raw = localStorage.getItem(STORAGE_PREFIX + String(numero || '').trim());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function fillFormFromState(payload){
    const state = payload?.state || payload;
    if (!state?.header) {
      toast('Backup non valido.');
      return false;
    }

    $('#FatNumero').value = state.header.numero || makeTimestamp();
    $('#FatData').value = state.header.data || todayISO();
    $('#FatCommessa').value = state.header.commessa || '';
    $('#FatRifCommessa').value = state.header.rifCommessa || '';
    $('#FatOggetto').value = state.header.oggetto || '';

    const noteToggle = $('#FatNoteToggle');
    const note = $('#FatNote');
    if (noteToggle && note){
      noteToggle.checked = !!state.header.noteEnabled;
      note.value = state.header.note || '';
      note.classList.toggle('hidden', !noteToggle.checked);
    }

    clearRows();
    (state.rows || []).forEach(addRowFromData);
    recomputeAll();

    const byNumero = $('#FatSourceNumero');
    if (byNumero) byNumero.value = state.header.numero || '';
    return true;
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function downloadJsonBackup(){
    const payload = makePayload(currentDocType);
    if (!payload.state.rows.length){
      toast('Aggiungi almeno una riga prima di scaricare il backup.');
      return;
    }
    const nome = `${DOC_META[currentDocType].filePrefix}_${payload.state.header.numero}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    downloadBlob(blob, nome);
  }

  async function importUploadedSource(file){
    if (!file) return;
    const lowerName = String(file.name || '').toLowerCase();
    try{
      if (lowerName.endsWith('.pdf') || String(file.type || '').includes('pdf')){
        const bytes = await file.arrayBuffer();
        const { PDFDocument } = window.PDFLib || {};
        if (!PDFDocument) throw new Error('PDFLib non disponibile');
        const pdfDoc = await PDFDocument.load(bytes);
        const marker = readPayloadMarker(pdfDoc.getSubject?.())
          || readPayloadMarker(Array.isArray(pdfDoc.getKeywords?.()) ? pdfDoc.getKeywords().join(' ') : pdfDoc.getKeywords?.())
          || readPayloadMarker(pdfDoc.getTitle?.())
          || readPayloadMarker(pdfDoc.getProducer?.());
        if (!marker) throw new Error('Payload PDF assente');
        const ok = fillFormFromState(marker);
        if (!ok) return;
        toast(currentDocType === 'fattura'
          ? 'PDF preventivo caricato. Ora puoi creare la fattura mantenendo lo stesso numero.'
          : 'PDF caricato correttamente.');
        return;
      }
      const txt = await file.text();
      const payload = JSON.parse(txt);
      const ok = fillFormFromState(payload);
      if (!ok) return;
      toast(currentDocType === 'fattura'
        ? 'Backup caricato. Ora puoi creare la fattura mantenendo lo stesso numero.'
        : 'Backup caricato correttamente.');
    } catch (e){
      console.error(e);
      toast('Impossibile leggere il file selezionato. Usa il PDF esportato dal tool oppure un backup JSON valido.');
    }
  }

  function loadPreventivoByNumero(){
    const numero = ($('#FatSourceNumero')?.value || '').trim();
    if (!numero){
      toast('Inserisci il numero del preventivo da recuperare.');
      return;
    }
    const payload = loadSavedPayload(numero);
    if (!payload){
      toast('Nessun preventivo salvato in questo browser con quel numero.');
      return;
    }
    const ok = fillFormFromState(payload);
    if (!ok) return;
    toast('Preventivo recuperato con successo.');
  }

  function syncActionButton(){
    const btn = document.getElementById('BtnProcedi');
    if (!btn) return;
    btn.classList.remove('hidden');
    btn.textContent = DOC_META[currentDocType].buttonText;
  }

  function updateDocTypeUI(){
    const meta = DOC_META[currentDocType] || DOC_META.preventivo;
    const title = $('#FatDocTitle');
    const intro = $('#FatDocIntro');
    const recoverWrap = $('#FatRecoverWrap');

    if (title) title.textContent = meta.title;
    if (intro) intro.innerHTML = meta.intro;
    if (recoverWrap) recoverWrap.classList.toggle('hidden', currentDocType !== 'fattura');

    document.querySelectorAll('.fattura-doc-btn').forEach(btn => {
      const isActive = btn.dataset.docType === currentDocType;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    syncActionButton();
  }

  function setDocType(type){
    currentDocType = type === 'fattura' ? 'fattura' : 'preventivo';
    updateDocTypeUI();
  }

  function bindDocTypeSwitch(){
    document.querySelectorAll('.fattura-doc-btn').forEach(btn => {
      btn.addEventListener('click', () => setDocType(btn.dataset.docType || 'preventivo'));
    });
  }

  function trunc(str, max){
    const s = String(str || '');
    return s.length > max ? (s.slice(0, max-1) + '…') : s;
  }

  function wrapText(text, maxChars){
    const s = String(text || '').replace(/\r\n/g,'\n');
    const words = s.split(/(\s+)/);
    const lines = [];
    let line = '';
    for (const w of words){
      if (w === '\n'){ lines.push(line.trimEnd()); line=''; continue; }
      if ((line + w).length > maxChars){ lines.push(line.trimEnd()); line = w.trimStart(); }
      else line += w;
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  }

  async function fetchAsArrayBuffer(url){
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error('Impossibile caricare asset: ' + url);
    return await res.arrayBuffer();
  }

  async function loadPdfFonts(pdfDoc){
    const { StandardFonts } = window.PDFLib;
    try{
      if (window.fontkit) pdfDoc.registerFontkit(window.fontkit);
      const regBytes = await fetchAsArrayBuffer(MANROPE_REG);
      const boldBytes = await fetchAsArrayBuffer(MANROPE_BOLD);
      const reg = await pdfDoc.embedFont(regBytes);
      const bold = await pdfDoc.embedFont(boldBytes);
      return { reg, bold };
    } catch {
      const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      return { reg, bold };
    }
  }

  function drawKV(page, font, fontBold, x, y, k, v, rgb){
    page.drawText(k, { x, y, size: 9, font: fontBold, color: rgb(0.22,0.25,0.30) });
    page.drawText(String(v || ''), { x: x + 90, y, size: 9, font, color: rgb(0.07,0.09,0.12) });
  }

  function drawTableHeader(page, fontBold, x, y, cols, rgb){
    const headerH = 18;
    const fontSize = 9.5;
    const totalW = cols.reduce((a,c)=>a+c.w,0);
    page.drawRectangle({ x, y: y-14, width: totalW, height: headerH, color: rgb(0.97,0.98,0.99) });
    const wText = (t) => {
      try{ return fontBold.widthOfTextAtSize(String(t||''), fontSize); }
      catch { return String(t||'').length * fontSize * 0.52; }
    };
    let cx = x;
    for (const c of cols){
      const w = wText(c.label);
      const tx = (c.align === 'right') ? (cx + c.w - 2 - w) : (cx + 2);
      page.drawText(c.label, { x: tx, y: y-10, size: fontSize, font: fontBold, color: rgb(0.22,0.25,0.30) });
      cx += c.w;
    }
    page.drawLine({ start: {x, y: y-14}, end: {x: x + totalW, y: y-14}, thickness: 1, color: rgb(0.90,0.90,0.90) });
  }

  async function exportFatturaPdf(){
    const st = getState();
    if (!st.rows.length){ toast('Aggiungi almeno una riga prima di esportare.'); return; }

    if (currentDocType === 'preventivo') {
      savePreventivoState(makePayload('preventivo'));
    }

    const meta = DOC_META[currentDocType] || DOC_META.preventivo;
    const { PDFDocument, rgb } = window.PDFLib || {};
    if (!PDFDocument){ toast('Libreria PDF non disponibile.'); return; }

    const pdfDoc = await PDFDocument.create();
    const fonts = await loadPdfFonts(pdfDoc);
    const font = fonts.reg;
    const fontBold = fonts.bold;
    const textW = (f, t, s) => {
      try{ return f.widthOfTextAtSize(String(t||''), s); }
      catch { return String(t||'').length * s * 0.52; }
    };
    const fitText = (f, t, maxW, baseSize, minSize=7) => {
      let s = baseSize;
      let str = String(t || '');
      while (s > minSize && textW(f, str, s) > maxW) s -= 0.5;
      if (textW(f, str, s) <= maxW) return { text: str, size: s };
      const ell = '…';
      let out = str;
      while (out.length > 0 && textW(f, out + ell, s) > maxW) out = out.slice(0, -1);
      return { text: (out || '') + ell, size: s };
    };

    const sanitizeSvg = (svg) => {
      let s = String(svg || '');
      s = s.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, '');
      s = s.replace(/<!DOCTYPE[\s\S]*?>/ig, '');
      s = s.replace(/<!--([\s\S]*?)-->/g, '');
      s = s.replace(/<metadata[\s\S]*?<\/metadata>/ig, '');
      s = s.replace(/<title[\s\S]*?<\/title>/ig, '');
      s = s.replace(/<desc[\s\S]*?<\/desc>/ig, '');
      s = s.replace(/<defs[\s\S]*?<\/defs>/ig, '');
      s = s.replace(/<style[\s\S]*?<\/style>/ig, '');
      s = s.replace(/\s(filter|mask|clip-path)="[^"]*"/ig, '');
      s = s.replace(/\sstyle="[^"]*url\([^\)]*\)[^"]*"/ig, '');
      return s.trim();
    };

    const rasterizeSvgToPngBytes = async (svgText, scale=4) => {
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      try{
        const img = new Image();
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';
        const loaded = new Promise((res, rej) => {
          img.onload = () => res(true);
          img.onerror = (e) => rej(e);
        });
        img.src = url;
        await loaded;
        const w = Math.max(1, Math.round(img.naturalWidth || img.width || 400));
        const h = Math.max(1, Math.round(img.naturalHeight || img.height || 120));
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        return await pngBlob.arrayBuffer();
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    let logoSvgObj = null;
    let logoPngObj = null;
    let svgTxt = '';
    try{
      const res = await fetch('./assets/logo.svg', { cache:'no-store' });
      if (res.ok) svgTxt = await res.text();
    } catch {}
    if (svgTxt){
      const clean = sanitizeSvg(svgTxt);
      try{
        if (typeof pdfDoc.embedSvg === 'function'){
          logoSvgObj = await pdfDoc.embedSvg(clean);
        }
      } catch {
        try{
          const bytes = await rasterizeSvgToPngBytes(clean, 4);
          logoPngObj = await pdfDoc.embedPng(bytes);
        } catch {}
      }
    }
    if (!logoSvgObj && !logoPngObj){
      try{ const bytes = await fetchAsArrayBuffer('./assets/logo.png'); logoPngObj = await pdfDoc.embedPng(bytes); } catch {}
    }

    const A4 = [595.28, 841.89];
    const marginX = 40;
    const marginTop = 40;
    const marginBottom = 80;
    const contentW = A4[0] - marginX * 2;
    const colProdW = 200;
    const colQtyW  = 40;
    const colUnitW = 80;
    const colDescW = contentW - (colProdW + colQtyW + colUnitW);
    const cols = [
      { label:'Prodotto', w: colProdW },
      { label:'Descrizione', w: colDescW },
      { label:'Q.tà', w: colQtyW, align:'right' },
      { label:'Costo unit.', w: colUnitW, align:'right' },
    ];
    const tableX = marginX;
    const tableW = contentW;
    const newPage = () => pdfDoc.addPage(A4);
    let page = newPage();
    let y = A4[1] - marginTop;
    const rightBoxW = 195;
    const rightBoxX = A4[0] - marginX - rightBoxW;

    const drawHeader = () => {
      if (logoSvgObj){
        const w = 140;
        const h = (logoSvgObj.height / logoSvgObj.width) * w;
        page.drawSvg(logoSvgObj, { x: marginX, y: y - h, width: w, height: h });
      } else if (logoPngObj){
        const w = 140;
        const h = (logoPngObj.height / logoPngObj.width) * w;
        page.drawImage(logoPngObj, { x: marginX, y: y - h, width: w, height: h });
      }
      page.drawText(meta.pdfLabel, { x: rightBoxX, y: y - 18, size: 12, font: fontBold, color: rgb(0.07,0.09,0.12) });
      const box1Bottom = y - 82;
      page.drawRectangle({ x: rightBoxX, y: box1Bottom, width: rightBoxW, height: 54, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      drawKV(page, font, fontBold, rightBoxX + 10, box1Bottom + 54 - 22, 'N.ro', st.header.numero, rgb);
      drawKV(page, font, fontBold, rightBoxX + 10, box1Bottom + 54 - 44, 'Data', fmtDate(st.header.data), rgb);
      const gapBoxes = 20;
      const box2H = 46;
      const box2Bottom = box1Bottom - gapBoxes - box2H;
      page.drawRectangle({ x: rightBoxX, y: box2Bottom, width: rightBoxW, height: box2H, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      drawKV(page, font, fontBold, rightBoxX + 10, box2Bottom + box2H - 20, 'N. Commessa', st.header.commessa || '—', rgb);
      drawKV(page, font, fontBold, rightBoxX + 10, box2Bottom + box2H - 38, 'Nome cantiere', st.header.rifCommessa || '—', rgb);
      const gapOggetto = 20;
      const yOggetto = box2Bottom - gapOggetto - 14;
      page.drawText('Oggetto:', { x: marginX, y: yOggetto, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
      page.drawRectangle({ x: marginX + 70, y: yOggetto - 6, width: contentW - 70, height: 20, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      page.drawText(trunc(st.header.oggetto || '—', 78), { x: marginX + 78, y: yOggetto + 1, size: 10.5, font, color: rgb(0.07,0.09,0.12) });
      y = yOggetto - 40;
    };

    const newTablePage = () => {
      page = newPage();
      y = A4[1] - marginTop;
      page.drawText(meta.pdfLabel, { x: rightBoxX, y: y - 18, size: 12, font: fontBold, color: rgb(0.07,0.09,0.12) });
      y -= 40;
      drawTableHeader(page, fontBold, tableX, y, cols, rgb);
      y -= 18;
    };

    const ensureSpace = (needH) => {
      if (y - needH < marginBottom) newTablePage();
    };

    const drawRow = (row, alt, isLast) => {
      const hasDisc = Number(row.disc || 0) > 0;
      const baseH = 18;
      const extraH = hasDisc ? 14 : 0;
      const rowH = baseH + extraH;
      ensureSpace(rowH + 10);
      if (alt){
        page.drawRectangle({ x: tableX, y: y-rowH+3, width: tableW, height: rowH, color: rgb(0.995,0.995,0.995) });
      }
      let cx = tableX;
      const prodFit = fitText(font, row.product, cols[0].w - 4, 9.5);
      page.drawText(prodFit.text, { x: cx + 2, y: y-11, size: prodFit.size, font, color: rgb(0.07,0.09,0.12) });
      cx += cols[0].w;
      const descFit = fitText(font, row.desc || '', cols[1].w - 4, 9.5);
      page.drawText(descFit.text, { x: cx + 2, y: y-11, size: descFit.size, font, color: rgb(0.07,0.09,0.12) });
      cx += cols[1].w;
      const qtyStr = String(row.qty);
      page.drawText(qtyStr, { x: cx + cols[2].w - 2 - textW(font, qtyStr, 9.5), y: y-11, size: 9.5, font, color: rgb(0.07,0.09,0.12) });
      cx += cols[2].w;
      const unitStr = euro(row.unit);
      page.drawText(unitStr, { x: cx + cols[3].w - 2 - textW(font, unitStr, 9.5), y: y-11, size: 9.5, font, color: rgb(0.07,0.09,0.12) });
      if (hasDisc){
        const rightX = tableX + tableW;
        const discText = `Sconto: ${row.disc}%`;
        page.drawText(discText, { x: rightX - 2 - textW(font, discText, 9), y: y-26, size: 9, font, color: rgb(0.17,0.20,0.25) });
      }
      if (!isLast){
        page.drawLine({ start: {x: tableX, y: y-rowH+3}, end: {x: tableX + tableW, y: y-rowH+3}, thickness: 0.6, color: rgb(0.93,0.93,0.93) });
      }
      y -= rowH;
    };

    drawHeader();
    ensureSpace(120);
    drawTableHeader(page, fontBold, tableX, y, cols, rgb);
    y -= 18;
    st.rows.forEach((r, idx) => drawRow(r, idx % 2 === 1, idx === st.rows.length - 1));
    ensureSpace(160);
    y -= 12;
    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 1, color: rgb(0.86,0.86,0.86) });
    y -= 26;
    const labelTot = 'Totale fornitura';
    const valTot = euro(st.total);
    const labelX = tableX + (tableW - textW(fontBold, labelTot, 11)) / 2;
    page.drawText(labelTot, { x: labelX, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
    page.drawText(valTot, { x: tableX + tableW - 2 - textW(fontBold, valTot, 11), y, size: 11, font: fontBold, color: rgb(0.77,0.09,0.17) });

    if (st.header.noteEnabled){
      ensureSpace(180);
      y -= 34;
      page.drawText('Note', { x: marginX, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
      y -= 10;
      const noteBoxH = 90;
      page.drawRectangle({ x: marginX, y: y - noteBoxH, width: contentW, height: noteBoxH, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      const noteLines = wrapText(st.header.note || '', 92);
      let ny = y - 16;
      noteLines.slice(0,6).forEach(line => {
        page.drawText(line, { x: marginX + 10, y: ny, size: 9.5, font, color: rgb(0.17,0.20,0.25) });
        ny -= 13;
      });
      y = y - noteBoxH - 36;
    } else {
      y -= 36;
    }

    ensureSpace(140);
    page.drawText('Timbro e firma', { x: marginX, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
    y -= 24;
    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + 260, y }, thickness: 1, color: rgb(0.7,0.7,0.7) });

    const pdfPayload = makePayload(currentDocType);
    const pdfMarker = getPdfPayloadMarker(pdfPayload);
    try{
      if (pdfMarker){
        pdfDoc.setSubject(pdfMarker);
        pdfDoc.setKeywords(['ABITARE_PF', pdfMarker]);
        pdfDoc.setProducer(pdfMarker);
      }
      pdfDoc.setCreator('Abitare Co. Preventivo/Fattura Tool');
      pdfDoc.setTitle(`${meta.pdfLabel} ${st.header.numero}`);
    } catch (e) {
      console.warn('Metadati PDF non impostati', e);
    }
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `${meta.filePrefix}_${st.header.numero}.pdf`);

    if (currentDocType === 'preventivo') {
      toast('Preventivo esportato e salvato in locale. Quando vorrai, potrai recuperarlo per trasformarlo in fattura.');
    }
  }

  async function initFattura(){
    if (__bound) {
      updateDocTypeUI();
      syncActionButton();
      return;
    }
    if (!document.getElementById('FatturaCard')) return;
    __bound = true;

    initHeaderDefaults();
    const listino = await loadListino();
    fillSections(listino);

    const btnAdd = document.getElementById('FatAddRow');
    if (btnAdd) btnAdd.addEventListener('click', addRowFromSelected);

    const tgl = document.getElementById('FatNoteToggle');
    const note = document.getElementById('FatNote');
    if (tgl && note){
      const sync = () => note.classList.toggle('hidden', !tgl.checked);
      tgl.addEventListener('change', sync);
      sync();
    }

    bindDocTypeSwitch();


    const loadByNumeroBtn = document.getElementById('FatLoadByNumero');
    if (loadByNumeroBtn) loadByNumeroBtn.addEventListener('click', loadPreventivoByNumero);

    const fileBtn = document.getElementById('FatLoadFileBtn');
    const fileInput = document.getElementById('FatLoadFile');
    if (fileBtn && fileInput){
      fileBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        await importUploadedSource(file);
        fileInput.value = '';
      });
    }

    setDocType('preventivo');
    window.exportFatturaPdf = exportFatturaPdf;
  }

  try{
    const orig = window.selectMode;
    if (typeof orig === 'function' && !orig.__fatturaPatched){
      const patched = function(mode){
        orig(mode);
        if (mode === 'fattura') initFattura();
      };
      patched.__fatturaPatched = true;
      window.selectMode = patched;
    }
  } catch {}

  document.addEventListener('DOMContentLoaded', () => {
    if (window.currentMode === 'fattura') initFattura();
  });
})();
