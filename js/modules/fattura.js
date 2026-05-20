// js/modules/fattura.js — Fattura (Marketing/Admin)
(function(){
 'use strict';

 const $ = (s) => document.querySelector(s);
 const elRows = () => document.getElementById('FatRows');

 const PATH_JSON = './assets/data/listino_marketing.json';
 const PATH_CSV  = './assets/data/listino_marketing.csv';

 let LISTINO = null; // {sections:[{name,items:[{name,unitPrice,...}]}]}
 let __bound = false;

 function toast(msg){
  try{
   if (window.showToast) return window.showToast(msg);
  } catch {}
  alert(msg);
 }

 function euro(n){
  const v = Number(n || 0);
  return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(v);
 }

 function euroPlain(n){
  const v = Number(n || 0);
  // Keep symbol for PDF strings
  return euro(v);
 }

 function todayISO(){
  const d = new Date();
  const pad = (x) => String(x).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 }

 function fmtDate(iso){
  // iso: YYYY-MM-DD
  try{
   const [y,m,d] = String(iso||'').split('-');
   if (!y || !m || !d) return iso || '';
   return `${d}/${m}/${y}`;
  } catch { return iso || ''; }
 }

 function makeTimestamp(){
  return String(Date.now());
 }

 function round2(n){
  return Math.round((Number(n||0) + Number.EPSILON) * 100) / 100;
 }

 async function loadListino(){
  if (LISTINO) return LISTINO;

  // prefer JSON
  try{
   const res = await fetch(PATH_JSON, { cache: 'no-store' });
   if (res.ok){
    const j = await res.json();
    if (j && j.sections) { LISTINO = j; return LISTINO; }
   }
  } catch {}

  // fallback CSV (simple parser)
  try{
   const res = await fetch(PATH_CSV, { cache: 'no-store' });
   if (!res.ok) throw new Error('CSV non disponibile');
   const txt = await res.text();
   const lines = txt.split(/\r?\n/).filter(Boolean);
   if (!lines.length) throw new Error('CSV vuoto');
   const head = parseCsvLine(lines.shift());
   const idx = (name) => head.indexOf(name);
   const iSec = idx('Sezione');
   const iProd = idx('Prodotto');
   const iPrice = idx('Prezzo_cu');
   const iSett = idx('Settore');
   const iDesc = idx('Descrizione');
   const iOre = idx('Ore');
   const iNote = idx('Note');

   const map = new Map();
   for (const line of lines){
    const cols = parseCsvLine(line);
    const sec = cols[iSec] || 'GENERICO';
    if (!map.has(sec)) map.set(sec, []);
    map.get(sec).push({
     name: cols[iProd] || '',
     channel: cols[iSett] || null,
     description: cols[iDesc] || null,
     hours: cols[iOre] || null,
     notes: cols[iNote] || null,
     unitPrice: cols[iPrice] ? Number(String(cols[iPrice]).replace(',', '.')) : null
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

 function parseCsvLine(line){
  // handles basic quoted CSV
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
  const base = q * u;
  const net = base * (1 - d/100);
  return round2(net);
 }

 function addRowFromSelected(){
  const it = getSelectedItem();
  if (!it){ toast('Seleziona un prodotto dal listino.'); return; }

  const wrap = document.createElement('div');
  wrap.className = 'fattura-row';

  const prod = document.createElement('div');
  prod.className = 'fat-prod';
  prod.textContent = it.name;

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
  wrap.dataset.section = ($('#FatSezione')?.value || '');

  const onChange = () => {
   tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value));
   recomputeAll();
  };
  qty.addEventListener('input', onChange);
  unit.addEventListener('input', onChange);
  disc.addEventListener('change', onChange);

  wrap.appendChild(prod);
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
   const qty = inputs[0]?.value;
   const unit = inputs[1]?.value;
   const disc = inputs[2]?.value;
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
  const header = {
   numero: ($('#FatNumero')?.value || makeTimestamp()).trim(),
   data: $('#FatData')?.value || todayISO(),
   commessa: ($('#FatCommessa')?.value || '').trim(),
   rifCommessa: ($('#FatRifCommessa')?.value || '').trim(),
   oggetto: ($('#FatOggetto')?.value || '').trim(),
   note: ($('#FatNote')?.value || '').trim(),
  };
  const rows = Array.from(document.querySelectorAll('#FatRows .fattura-row')).map(r => {
   const prod = r.dataset.product || r.querySelector('.fat-prod')?.textContent || '';
   const inputs = r.querySelectorAll('input, select');
   const qty = Number(inputs[0]?.value || 0);
   const unit = Number(inputs[1]?.value || 0);
   const disc = Number(inputs[2]?.value || 0);
   const base = round2(qty * unit);
   const total = calcRowTotal(qty, unit, disc);
   return { product: prod, qty, unit, disc, base, total };
  });
  const total = round2(rows.reduce((a,b) => a + (b.total || 0), 0));
  return { header, rows, total };
 }

 function trunc(str, max){
  const s = String(str || '');
  return s.length > max ? (s.slice(0, max-1) + '…') : s;
 }

 async function fetchAsArrayBuffer(url){
  const res = await fetch(url, { cache:'no-store' });
  if (!res.ok) throw new Error('Impossibile caricare asset: ' + url);
  return await res.arrayBuffer();
 }

 function drawKV(page, font, fontBold, x, y, k, v){
  page.drawText(k, { x, y, size: 9, font: fontBold });
  page.drawText(String(v || ''), { x: x + 90, y, size: 9, font });
 }

 function drawTableHeader(page, fontBold, x, y, cols, rgb){
  // background
  page.drawRectangle({ x, y: y-14, width: cols.reduce((a,c)=>a+c.w,0), height: 18, color: rgb(0.97,0.98,0.99) });
  let cx = x;
  for (const c of cols){
   const tx = (c.align === 'right') ? (cx + c.w - 2) : (cx + 2);
   page.drawText(c.label, { x: tx, y: y-10, size: 9.5, font: fontBold, color: rgb(0.22,0.25,0.30), ...(c.align==='right'?{ }:{}) });
   cx += c.w;
  }
  // bottom line
  page.drawLine({ start: {x, y: y-14}, end: {x: x + cols.reduce((a,c)=>a+c.w,0), y: y-14}, thickness: 1, color: rgb(0.9,0.9,0.9) });
 }

 function drawRow(page, font, x, y, cols, row, rgb, alt){
  const h = 18;
  if (alt){
   page.drawRectangle({ x, y: y-h+3, width: cols.reduce((a,c)=>a+c.w,0), height: h, color: rgb(0.995,0.995,0.995) });
  }
  let cx = x;
  // values: product, qty, unit, disc, total
  const values = [
   trunc(row.product, 48),
   String(row.qty),
   euroPlain(row.unit),
   row.disc ? `${row.disc}%` : '—',
   euroPlain(row.total)
  ];
  for (let i=0;i<cols.length;i++){
   const c = cols[i];
   const val = values[i];
   const tx = (c.align === 'right') ? (cx + c.w - 2) : (cx + 2);
   page.drawText(String(val), { x: tx, y: y-11, size: 9.5, font, color: rgb(0.07,0.09,0.12) });
   cx += c.w;
  }
  // row line
  page.drawLine({ start: {x, y: y-h+3}, end: {x: x + cols.reduce((a,c)=>a+c.w,0), y: y-h+3}, thickness: 0.6, color: rgb(0.93,0.93,0.93) });
  return y - h;
 }

 async function exportFatturaPdf(){
  const st = getState();
  if (!st.rows.length){ toast('Aggiungi almeno una riga prima di esportare.'); return; }

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
  if (!PDFDocument){ toast('Libreria PDF non disponibile.'); return; }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Logo (Abitare Co.)
  let logoImg = null;
  try{
   const bytes = await fetchAsArrayBuffer('./assets/logo.png');
   logoImg = await pdfDoc.embedPng(bytes);
  } catch { /* ignore */ }

  const A4 = [595.28, 841.89];
  const margin = 40;

  const newPage = () => pdfDoc.addPage(A4);
  let page = newPage();
  let y = A4[1] - margin;

  const drawHeader = () => {
   // logo
   if (logoImg){
    const w = 140;
    const h = (logoImg.height / logoImg.width) * w;
    page.drawImage(logoImg, { x: margin, y: y - h, width: w, height: h });
   }
   page.drawText('Statement accounting', { x: 360, y: y - 18, size: 12, font: fontBold, color: rgb(0.07,0.09,0.12) });

   // number/date box
   const boxX = 360;
   const boxW = 195;
   const boxH = 54;
   page.drawRectangle({ x: boxX, y: y - 74, width: boxW, height: boxH, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
   drawKV(page, font, fontBold, boxX + 10, y - 32, 'N.ro', st.header.numero);
   drawKV(page, font, fontBold, boxX + 10, y - 54, 'Del', fmtDate(st.header.data));

   // commessa box
   const y2 = y - 95;
   page.drawRectangle({ x: 360, y: y2 - 45, width: 195, height: 46, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
   drawKV(page, font, fontBold, 370, y2 - 18, 'N. Commessa', st.header.commessa || '—');
   drawKV(page, font, fontBold, 370, y2 - 36, 'Rif. Commessa', st.header.rifCommessa || '—');

   // Oggetto
   const y3 = y2 - 68;
   page.drawText('Oggetto:', { x: margin, y: y3, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
   page.drawRectangle({ x: margin + 70, y: y3 - 6, width: A4[0] - margin*2 - 70, height: 20, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
   page.drawText(trunc(st.header.oggetto || '—', 78), { x: margin + 78, y: y3 + 1, size: 10.5, font });

   y = y3 - 40;
  };

  drawHeader();

  // Table
  const cols = [
   { label:'Prodotto', w: 260 },
   { label:'Q.tà', w: 45, align:'right' },
   { label:'Costo unit.', w: 80, align:'right' },
   { label:'Sconto', w: 55, align:'right' },
   { label:'Totale', w: 85, align:'right' },
  ];
  const tableX = margin;

  const ensureSpace = (minY) => {
   if (y < minY){
    page = newPage();
    y = A4[1] - margin;
    // light header on new page
    page.drawText('Statement accounting', { x: 360, y: y - 18, size: 12, font: fontBold, color: rgb(0.07,0.09,0.12) });
    y -= 40;
   }
  };

  ensureSpace(160);
  drawTableHeader(page, fontBold, tableX, y, cols, rgb);
  y -= 18;

  st.rows.forEach((r, idx) => {
   ensureSpace(140);
   // if new page created and no header drawn yet
   if (y > A4[1] - margin - 60){
    drawTableHeader(page, fontBold, tableX, y, cols, rgb);
    y -= 18;
   }
   y = drawRow(page, font, tableX, y, cols, r, rgb, idx % 2 === 1);
  });

  // Totale
  ensureSpace(130);
  y -= 10;
  page.drawLine({ start: { x: tableX, y }, end: { x: tableX + cols.reduce((a,c)=>a+c.w,0), y }, thickness: 1, color: rgb(0.86,0.86,0.86) });
  y -= 18;
  page.drawText('Totale fornitura', { x: tableX + 260, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
  page.drawText(euroPlain(st.total), { x: tableX + 260 + 45 + 80 + 55 + 85 - 2, y, size: 11, font: fontBold, color: rgb(0.77,0.09,0.17) });

  // Note
  y -= 30;
  page.drawText('Note', { x: margin, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
  y -= 10;
  const noteBoxH = 90;
  page.drawRectangle({ x: margin, y: y - noteBoxH, width: A4[0] - margin*2, height: noteBoxH, borderWidth: 1, borderColor: rgb(0.9,0.9,0.9) });
  const noteLines = wrapText(st.header.note || '', 92);
  let ny = y - 16;
  noteLines.slice(0,6).forEach(line => {
   page.drawText(line, { x: margin + 10, y: ny, size: 9.5, font, color: rgb(0.17,0.20,0.25) });
   ny -= 13;
  });

  // Timbro e firma
  y = y - noteBoxH - 36;
  page.drawText('Timbro e firma', { x: margin, y, size: 11, font: fontBold, color: rgb(0.07,0.09,0.12) });
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 260, y }, thickness: 1, color: rgb(0.7,0.7,0.7) });

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

 function wrapText(text, maxChars){
  const s = String(text || '').replace(/\r\n/g,'\n');
  const words = s.split(/(\s+)/);
  const lines = [];
  let line = '';
  for (const w of words){
   if (w === '\n'){
    lines.push(line.trimEnd());
    line = '';
    continue;
   }
   if ((line + w).length > maxChars){
    lines.push(line.trimEnd());
    line = w.trimStart();
   } else {
    line += w;
   }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
 }

 async function initFattura(){
  if (__bound) return;
  // Ensure DOM exists
  if (!document.getElementById('FatturaCard')) return;

  __bound = true;

  initHeaderDefaults();

  const listino = await loadListino();
  if (!listino.sections || !listino.sections.length){
   toast('Listino non trovato in assets/data. Carica listino_marketing.json o .csv.');
  }
  fillSections(listino);

  const btnAdd = document.getElementById('FatAddRow');
  if (btnAdd) btnAdd.addEventListener('click', addRowFromSelected);

  // expose export for actionbar
  window.exportFatturaPdf = exportFatturaPdf;
 }

 // Hook into selectMode (defined by shell.js)
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
  // init in case user lands directly
  if (window.currentMode === 'fattura') initFattura();
 });

})();
