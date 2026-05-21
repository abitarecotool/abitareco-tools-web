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
  try{ const [y,m,d] = String(iso||'').split('-'); if (!y||!m||!d) return iso||''; return `${d}/${m}/${y}`; }
  catch { return iso||''; }
 }

 function makeTimestamp(){ return String(Date.now()); }
 function round2(n){ return Math.round((Number(n||0) + Number.EPSILON) * 100) / 100; }

 async function loadListino(){
  if (LISTINO) return LISTINO;

  // JSON (preferito)
  try{
   const res = await fetch(PATH_JSON, { cache:'no-store' });
   if (res.ok){
    const j = await res.json();
    if (j && j.sections) { LISTINO = j; return LISTINO; }
   }
  } catch {}

  // CSV fallback
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
  qty.type = 'number'; qty.min='0'; qty.step='1'; qty.value='1';

  const unit = document.createElement('input');
  unit.type = 'number'; unit.min='-999999'; unit.step='1'; unit.value = (it.unitPrice ?? 0);

  const disc = makeDiscountSelect();

  const tot = document.createElement('div');
  tot.className = 'fat-total';
  tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value));

  const del = document.createElement('button');
  del.type = 'button'; del.className='fat-del'; del.title='Rimuovi riga'; del.textContent='✕';
  del.onclick = () => { wrap.remove(); recomputeAll(); };

  wrap.dataset.product = it.name;

  const onChange = () => { tot.textContent = euro(calcRowTotal(qty.value, unit.value, disc.value)); recomputeAll(); };
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

 function trunc(str, max){ const s = String(str||''); return s.length > max ? (s.slice(0, max-1) + '…') : s; }

 function wrapText(text, maxChars){
  const s = String(text||'').replace(/\r\n/g,'\n');
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

  const textW = (t) => {
    try{ return fontBold.widthOfTextAtSize(String(t||''), fontSize); }
    catch { return String(t||'').length * fontSize * 0.52; }
  };

  let cx = x;
  for (const c of cols){
    const w = textW(c.label);
    const tx = (c.align === 'right') ? (cx + c.w - 2 - w) : (cx + 2);
    page.drawText(c.label, { x: tx, y: y-10, size: fontSize, font: fontBold, color: rgb(0.22,0.25,0.30) });
    cx += c.w;
  }

  page.drawLine({ start: {x, y: y-14}, end: {x: x + totalW, y: y-14}, thickness: 1, color: rgb(0.90,0.90,0.90) });
}
)();