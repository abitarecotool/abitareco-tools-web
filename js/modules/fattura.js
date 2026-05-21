// js/modules/fattura.js — Fattura (Marketing/Admin)
(function(){
  'use strict';

  const $ = (s) => document.querySelector(s);
  const elRows = () => document.getElementById('FatRows');

  const PATH_JSON = './assets/data/listino_marketing.json';
  const PATH_CSV  = './assets/data/listino_marketing.csv';

  // Font PDF (caricare in assets/fonts)
  const MANROPE_REG  = './assets/fonts/Manrope-Regular.ttf';
  const MANROPE_BOLD = './assets/fonts/Manrope-Bold.ttf';

  let LISTINO = null;
  let __bound = false;

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

  function makeDiscountSelect(){
    const sel = document.createElement('select');
    const vals = [0,5,10,15,20,25,30,40,50];
    vals.forEach(v => {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = v === 0 ? '—' : `${v}%`;
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

  function addRowFromSelected(){
    const it = getSelectedItem();
    if (!it){ toast('Seleziona un prodotto dal listino.'); return; }

    const wrap = document.createElement('div');
    wrap.className = 'fattura-row';

    const prod = document.createElement('div');
    prod.className = 'fat-prod';
    prod.textContent = it.name;

    const desc = document.createElement('input');
    desc.type = 'text';
    desc.placeholder = 'Descrizione (es. Maggio)';

    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '0';
    qty.step = '1';
    qty.value = '1';

    const unit = document.createElement('input');
    unit.type = 'number';
    unit.min = '-999999';
    unit.step = '1';
    unit.value = (it.unitPrice ?? 0);

    const disc = makeDiscountSelect();

    const tot = document.createElement('div');
    tot.className = 'fat-total';
    tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'fat-del';
    del.title = 'Rimuovi riga';
    del.textContent = '✕';
    del.onclick = () => { wrap.remove(); recomputeAll(); };

    wrap.dataset.product = it.name;

    const onChange = () => {
      tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value));
      recomputeAll();
    };
    qty.addEventListener('input', onChange);
    unit.addEventListener('input', onChange);
    disc.addEventListener('change', onChange);

    wrap.appendChild(prod);
    wrap.appendChild(desc);
    wrap.appendChild(qty);
    wrap.appendChild(unit);
    wrap.appendChild(disc);
    wrap.appendChild(tot);
    wrap.appendChild(del);

    elRows()?.appendChild(wrap);
    recomputeAll();
  }

  function recomputeAll(){
    const rows = Array.from(document.querySelectorAll('#FatRows .fattura-row'));
    let sum = 0;
    for (const r of rows){
      const inputs = r.querySelectorAll('input, select');
      const qty = inputs[1]?.value; // desc=0
      const unit = inputs[2]?.value;
      const disc = inputs[3]?.value;
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
      const inputs = r.querySelectorAll('input, select');
      const desc = (inputs[0]?.value || '').trim();
      const qty = Number(inputs[1]?.value || 0);
      const unit = Number(inputs[2]?.value || 0);
      const disc = Number(inputs[3]?.value || 0);
      const total = calcRowTotal(qty, unit, disc);
      return { product: prod, desc, qty, unit, disc, total };
    });

    const total = round2(rows.reduce((a,b)=>a+(b.total||0),0));
    return { header, rows, total };
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

    // "Contain" celle
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

    // Logo: preferisci SVG (vettoriale). Fallback PNG.
    let logoSvg = null;
    let logoImg = null;
    try{
      const svgTxt = await (await fetch('./assets/logo.svg', { cache:'no-store' })).text();
      if (svgTxt && svgTxt.trim().startsWith('<')){
        logoSvg = await pdfDoc.embedSvg(svgTxt);
      }
    } catch {}
    if (!logoSvg){
      try{ const bytes = await fetchAsArrayBuffer('./assets/logo.png'); logoImg = await pdfDoc.embedPng(bytes); } catch {}
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
      if (logoSvg){
        const w = 140;
        const h = (logoSvg.height / logoSvg.width) * w;
        page.drawSvg(logoSvg, { x: marginX, y: y - h, width: w, height: h });
      } else if (logoImg){
        const w = 140;
        const h = (logoImg.height / logoImg.width) * w;
        page.drawImage(logoImg, { x: marginX, y: y - h, width: w, height: h });
      }

      page.drawText('Statement accounting', { x: rightBoxX, y: y - 18, size: 12, font: fontBold, color: rgb(0.07,0.09,0.12) });

      // Box N.ro / Del leggermente più in basso
      page.drawRectangle({ x: rightBoxX, y: y - 82, width: rightBoxW, height: 54, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      drawKV(page, font, fontBold, rightBoxX + 10, y - 40, 'N.ro', st.header.numero, rgb);
      drawKV(page, font, fontBold, rightBoxX + 10, y - 62, 'Del', fmtDate(st.header.data), rgb);

      const y2 = y - 105;
      page.drawRectangle({ x: rightBoxX, y: y2 - 45, width: rightBoxW, height: 46, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      drawKV(page, font, fontBold, rightBoxX + 10, y2 - 18, 'N. Commessa', st.header.commessa || '—', rgb);
      drawKV(page, font, fontBold, rightBoxX + 10, y2 - 36, 'Rif. Commessa', st.header.rifCommessa || '—', rgb);

      const y3 = y2 - 68;
      page.drawText('Oggetto:', { x: marginX, y: y3, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
      page.drawRectangle({ x: marginX + 70, y: y3 - 6, width: contentW - 70, height: 20, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
      page.drawText(trunc(st.header.oggetto || '—', 78), { x: marginX + 78, y: y3 + 1, size: 10.5, font, color: rgb(0.07,0.09,0.12) });

      y = y3 - 40;
    };

    const newTablePage = () => {
      page = newPage();
      y = A4[1] - marginTop;
      page.drawText('Statement accounting', { x: rightBoxX, y: y - 18, size: 12, font: fontBold, color: rgb(0.07,0.09,0.12) });
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

      // evita doppia riga: non disegnare la linea sottile sull'ultima riga
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

    // Totale fornitura
    ensureSpace(160);
    y -= 12;
    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 1, color: rgb(0.86,0.86,0.86) });
    y -= 26;

    const labelTot = 'Totale fornitura';
    const valTot = euro(st.total);
    const labelX = tableX + (tableW - textW(fontBold, labelTot, 11)) / 2;
    page.drawText(labelTot, { x: labelX, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
    page.drawText(valTot, { x: tableX + tableW - 2 - textW(fontBold, valTot, 11), y, size: 11, font: fontBold, color: rgb(0.77,0.09,0.17) });

    // Note
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

    // Firma
    ensureSpace(120);
    page.drawText('Timbro e firma', { x: marginX, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
    y -= 10;
    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + 260, y }, thickness: 1, color: rgb(0.7,0.7,0.7) });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fattura_${st.header.numero}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function initFattura(){
    if (__bound) return;
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
