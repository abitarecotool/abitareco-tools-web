/* =========================================================
 Abitare Co. – Digital Content Tool (Web)
 app.js — Immagini + DigitalTool + PDF→JPG + Rename + Video + Watermark (auto)
        + BV (Akrobat / Calibri + REA dinamico) + QR (qrcodejs) + Iubenda + PPT
========================================================= */
"use strict";

/* ---------------------------- Helpers base ---------------------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const showEl = (el) => el && el.classList.remove('hidden');
const hideEl = (el) => el && el.classList.add('hidden');

/* ----------------------- Shell: sidebar & footer ---------------------- */
const SideMenu = $('#SideMenu');
const BtnProcedi = $('#BtnProcedi');
const ActionProgressWrap = $('#ActionProgressWrap');
const ActionProgress = $('#ActionProgress');
const ActionProgressLabel = $('#ActionProgressLabel');

const DEFAULT_PRIMARY_LABEL = 'Esporta ora';
function setPrimaryActionLabel(txt){
  if (!BtnProcedi) return;
  BtnProcedi.textContent = txt || DEFAULT_PRIMARY_LABEL;
}

/* ------------------------------ Cards UID ----------------------------- */
const WelcomeCard = $('#WelcomeCard');
const SlugCard = $('#SlugCard');
const FormatCard = $('#FormatCard');
const UploadCard = $('#UploadCard');
const DTCard = $('#DTCard');
const RenameCard = $('#RenameCard');
const VideoCard = $('#VideoCard');
const WatermarkCard = $('#WatermarkCard');
const BvCard = $('#BusinessCardCard');
const QrCard = $('#QrCard');
const IubCard = $('#IubendaCard');
const PptFontsCard = $('#PptFontsCard');
const PptCorporateCard = $('#PptCorporateCard');
const PptAdvisorCard = $('#PptAdvisorCard');
const PptMarketingCard = $('#PptMarketingCard');

const ALL_CARDS = [
  WelcomeCard, SlugCard, FormatCard, UploadCard,
  DTCard, RenameCard, VideoCard, WatermarkCard,
  BvCard, QrCard, IubCard,
  PptFontsCard, PptCorporateCard, PptAdvisorCard, PptMarketingCard
];

/* ------------------------------- Stato -------------------------------- */
let picked = [];        // Immagini / PDF / ecc.
let pickedRename = [];  // Rename
let pickedVideo = [];   // Video
let currentMode = null;

/* ------------------------ Sidebar: icone & nav ------------------------ */
function initSidebarIcons(){
  $$('#SideMenu li').forEach(li=>{
    const img = li.querySelector('.mi img');
    if (img && li.dataset.icon) img.src = li.dataset.icon;
  });
}
function activateMenuVisual(mode){
  $$('#SideMenu li').forEach(li=>{
    const active = li.dataset.mode === mode;
    li.classList.toggle('active', active);
    const img = li.querySelector('.mi img');
    if (!img) return;
    img.src = active ? (li.dataset.iconActive || li.dataset.icon)
                     : (li.dataset.icon || img.src);
  });
}
function selectMode(mode){
  currentMode = mode;
  ALL_CARDS.forEach(hideEl);
  // reset footer
  setPrimaryActionLabel(DEFAULT_PRIMARY_LABEL);
  if (BtnProcedi) BtnProcedi.disabled = false;
  BtnProcedi.classList.remove('hidden');

  switch(mode){
    case 'welcome':
      showEl(WelcomeCard);
      BtnProcedi.classList.add('hidden');
      activateMenuVisual('');
      return;

    case 'images':
      showEl(SlugCard); showEl(FormatCard); showEl(UploadCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'digitaltool':
      showEl(DTCard); showEl(UploadCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'pdf2jpg':
      showEl(UploadCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'rename':
      showEl(RenameCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'video':
      showEl(VideoCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'watermark':
      showEl(UploadCard); showEl(WatermarkCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'bv':
      showEl(BvCard);
      setPrimaryActionLabel('Esporta ora');
      break;

    case 'qr':
      showEl(QrCard);
      setPrimaryActionLabel('Genera QR');
      try { updateQrGeneratedUrl(); } catch {}
      break;

    case 'iubenda':
      showEl(IubCard);
      setPrimaryActionLabel('Genera snippet');
      try { iubSyncEnVisibility(); } catch {}
      break;

    case 'ppt':
      showEl(PptFontsCard);
      showEl(PptCorporateCard);
      showEl(PptAdvisorCard);
      showEl(PptMarketingCard);
      BtnProcedi.classList.add('hidden');
      break;

    default:
      showEl(WelcomeCard);
      BtnProcedi.classList.add('hidden');
      activateMenuVisual('');
      return;
  }
  activateMenuVisual(mode);
}
SideMenu?.addEventListener('click', (e)=>{
  const li = e.target.closest('li');
  if (!li) return;
  selectMode(li.dataset.mode || 'welcome');
});
initSidebarIcons();
selectMode('welcome');

/* ========================= Drag & Drop: GENERALE ====================== */
const DropArea = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath = $('#BtnClearPath');
if (DropArea) {
  const prevent = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropArea.addEventListener(ev, prevent));
  DropArea.addEventListener('dragenter', ()=> DropArea.classList.add('drag-over'));
  DropArea.addEventListener('dragleave', ()=> DropArea.classList.remove('drag-over'));
  DropArea.addEventListener('drop', async (e)=>{
    DropArea.classList.remove('drag-over');
    picked = await readDroppedDirectory(e.dataTransfer);
    TxtFolderPath.textContent = picked.length
      ? `Selezionati ${picked.length} file…`
      : 'Nessun file supportato.';
    BtnClearPath.classList.toggle('hidden', picked.length === 0);
  });
  DropArea.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true;
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      picked = fl
        .filter(f => /\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));
      TxtFolderPath.textContent = picked.length
        ? `Selezionati ${picked.length} file…`
        : 'Nessun file supportato.';
      BtnClearPath.classList.toggle('hidden', picked.length === 0);
    };
    input.click();
  });
  BtnClearPath?.addEventListener('click', (e)=>{
    e.stopPropagation();
    picked = [];
    TxtFolderPath.textContent = 'Trascina qui la cartella…';
    BtnClearPath.classList.add('hidden');
  });
}

/* ========================= Drag & Drop: RENAME ======================== */
const DropAreaRename = $('#DropAreaRename');
const TxtFolderRename = $('#TxtFolderRename');
const BtnClearRename = $('#BtnClearRename');
if (DropAreaRename) {
  const preventR = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaRename.addEventListener(ev, preventR));
  DropAreaRename.addEventListener('dragenter', ()=> DropAreaRename.classList.add('drag-over'));
  DropAreaRename.addEventListener('dragleave', ()=> DropAreaRename.classList.remove('drag-over'));
  DropAreaRename.addEventListener('drop', async (e)=>{
    DropAreaRename.classList.remove('drag-over');
    pickedRename = await readDroppedDirectory(e.dataTransfer);
    TxtFolderRename.textContent = pickedRename.length
      ? `Selezionati ${pickedRename.length} file…`
      : 'Nessun file supportato.';
    BtnClearRename.classList.toggle('hidden', pickedRename.length === 0);
  });
  DropAreaRename.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true; input.accept = 'image/*';
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      pickedRename = fl
        .filter(f => /\.(jpe?g|png|tif?f|webp)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));
      TxtFolderRename.textContent = pickedRename.length
        ? `Selezionati ${pickedRename.length} file…`
        : 'Nessun file supportato.';
      BtnClearRename.classList.toggle('hidden', pickedRename.length === 0);
    };
    input.click();
  });
  BtnClearRename?.addEventListener('click', (e)=>{
    e.stopPropagation();
    pickedRename = [];
    TxtFolderRename.textContent = 'Trascina qui la cartella…';
    BtnClearRename.classList.add('hidden');
  });
}

/* ======================= Utility: lettura cartelle ==================== */
async function readDroppedDirectory(dt){
  const items = dt?.items ? Array.from(dt.items) : [];
  const out = [];
  async function traverse(entry, base=''){
    if (entry.isFile){
      const f = await new Promise(res => entry.file(res));
      if (/\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name)){
        out.push({ file: f, relPath: base ? `${base}/${f.name}` : f.name });
      }
    } else if (entry.isDirectory){
      const reader = entry.createReader();
      const entries = await new Promise(res => reader.readEntries(res));
      for (const en of entries){ await traverse(en, base ? `${base}/${entry.name}` : entry.name); }
    }
  }
  const hasEntries = items.length && typeof items[0].webkitGetAsEntry === 'function';
  if (hasEntries){
    for (const it of items){
      const en = it.webkitGetAsEntry();
      if (en) await traverse(en, '');
    }
  }
  return out;
}

/* ========================= Helper generici immagini =================== */
function slugify(t){
  if (!t) return '';
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\u2019'`]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}
async function loadImageBitmap(file){
  const url = URL.createObjectURL(file);
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation:'from-image' });
  URL.revokeObjectURL(url);
  return bmp;
}
function canvasToBlob(canvas, mime, q=0.85){ return new Promise(res => canvas.toBlob(res, mime, q)); }

/* =============================== Immagini (Sito) ====================== */
// ... (SEZIONE INVARIATA — come tua versione attuale)

/* ============================== DigitalTool =========================== */
// ... (SEZIONE INVARIATA)

/* ============================== PDF → JPG ============================= */
// ... (SEZIONE INVARIATA)

/* ================================= Rename ============================= */
// ... (SEZIONE INVARIATA)

/* ============================= VIDEO: Slideshow ======================= */
// ... (SEZIONE INVARIATA)

/* ========================= WATERMARK (auto) =========================== */
// ... (SEZIONE INVARIATA)

/* ========================= BIGLIETTO DA VISITA ======================= */
// ... (SEZIONE INVARIATA)

/* =============================== QR + UTM (qrcodejs) ================== */
const QrBase = $('#QrBase');
const QrSource = $('#QrSource');
const QrMedium = $('#QrMedium');
const QrCampaign = $('#QrCampaign');
const QrId = $('#QrId');
const QrTerm = $('#QrTerm');
const QrContent = $('#QrContent');
const QrGeneratedUrl = $('#QrGeneratedUrl');
const QrCopyUrl = $('#QrCopyUrl');
const QrCanvas = $('#QrCanvas');
const QrPreviewWrap = $('#QrPreviewWrap');
const QrDownloadPng = $('#QrDownloadPng');
const QrDownloadSvg = $('#QrDownloadSvg');

function buildUtmUrl(){
  const base = (QrBase?.value || '').trim();
  if (!base) return '';
  try {
    const u = new URL(base);
    const set = (k, el) => {
      const v = (el?.value || '').trim();
      if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
    };
    set('utm_source', QrSource);
    set('utm_medium', QrMedium);
    set('utm_campaign', QrCampaign);
    set('utm_id', QrId);
    set('utm_term', QrTerm);
    set('utm_content', QrContent);
    return u.toString();
  } catch { return ''; }
}
function hideQrOutputs(){
  if (QrDownloadPng) { QrDownloadPng.classList.add('hidden'); QrDownloadPng.removeAttribute('href'); }
  if (QrDownloadSvg) { QrDownloadSvg.classList.add('hidden'); QrDownloadSvg.removeAttribute('href'); }
  if (QrPreviewWrap) QrPreviewWrap.classList.add('hidden');
  if (QrCanvas) QrCanvas.getContext('2d')?.clearRect(0,0,QrCanvas.width,QrCanvas.height);
}
function updateQrGeneratedUrl(){
  const url = buildUtmUrl();
  if (QrGeneratedUrl) QrGeneratedUrl.value = url || '';
  if (QrCopyUrl) QrCopyUrl.disabled = !url;
  hideQrOutputs();
}
function canvasToEmbeddedSvg(canvas){
  const pngDataUrl = canvas.toDataURL('image/png');
  const w = canvas.width, h = canvas.height;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${pngDataUrl}" width="${w}" height="${h}"/></svg>\n`;
}
async function makeQr(){
  const base = (QrBase?.value || '').trim();
  const src  = (QrSource?.value || '').trim();
  const med  = (QrMedium?.value || '').trim();
  const camp = (QrCampaign?.value || '').trim();
  if (!/^https?:\/\//i.test(base)) { alert('Website URL deve iniziare con http/https'); return; }
  if (!src || !med || !camp){ alert('Compila source, medium e campaign.'); return; }

  const url = buildUtmUrl();
  if (QrGeneratedUrl) QrGeneratedUrl.value = url;

  // qrcodejs → genera offscreen
  const size = 512;
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed'; wrap.style.left = '-99999px'; wrap.style.top = '-99999px';
  document.body.appendChild(wrap);

  const qr = new window.QRCode(wrap, { text:url, width:size, height:size, correctLevel: window.QRCode.CorrectLevel.M });
  await new Promise(r => setTimeout(r, 0));
  const canvas = wrap.querySelector('canvas');
  if (!canvas){ wrap.remove(); alert('Impossibile generare il QR.'); return; }

  const pngBlob = await new Promise((res)=> canvas.toBlob(res, 'image/png'));
  const svgStr  = canvasToEmbeddedSvg(canvas);
  wrap.remove();

  const zip = new JSZip();
  zip.file('qr.png', pngBlob);
  zip.file('qr.svg', svgStr);
  zip.file('url.txt', url + '\n');
  const safeName = slugify(camp) || 'qr';
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const out = await zip.generateAsync({ type:'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out); a.download = `QR-${safeName}-${stamp}.zip`; a.click();
  URL.revokeObjectURL(a.href);
}
QrCopyUrl?.addEventListener('click', async ()=>{
  const txt = (QrGeneratedUrl?.value || '').trim();
  if (!txt) return;
  try { await navigator.clipboard.writeText(txt); alert('URL copiata negli appunti.'); }
  catch { QrGeneratedUrl?.select(); document.execCommand('copy'); alert('URL copiata (fallback).'); }
});
[QrBase, QrSource, QrMedium, QrCampaign, QrId, QrTerm, QrContent].forEach(el=>{
  el?.addEventListener('input', updateQrGeneratedUrl);
  el?.addEventListener('change', updateQrGeneratedUrl);
});

/* ================================ IUBENDA ============================= */
const IubSiteId   = $('#IubSiteId');
const IubCookieIt = $('#IubCookieIt');
const IubCookieEn = $('#IubCookieEn');
const IubWidgetUrl= $('#IubWidgetUrl');
const IubDualLang = $('#IubDualLang');
const IubCopyBtn  = $('#IubCopyBtn');
const IubOut      = $('#IubOut');

function iubSyncEnVisibility(){
  const wrap = $('.IubEnWrap');
  if (!wrap) return;
  if (IubDualLang?.checked){ showEl(wrap); }
  else { hideEl(wrap); if (IubCookieEn) IubCookieEn.value = ''; }
}

function makeIubendaSnippet(){
  const siteId = (IubSiteId?.value || '').trim();
  const cpIt   = (IubCookieIt?.value || '').trim();
  const cpEn   = (IubCookieEn?.value || '').trim();
  const widget = (IubWidgetUrl?.value || '//cdn.iubenda.com/cs/iubenda_cs.js').trim();
  if (!siteId || !cpIt){ alert('Compila siteId e cookiePolicyId (IT).'); return; }

  const callback = `
callback: {
  onPreferenceExpressedOrNotNeeded: function (preference) {
    window.dataLayer = window.dataLayer || [];
    dataLayer.push({ event: "cookie_consent_update" });
    if (!preference) { dataLayer.push({ event: "iubenda_preference_not_needed" }); return; }
    if (preference.consent === true)  dataLayer.push({ event: "iubenda_consent_given" });
    if (preference.consent === false) dataLayer.push({ event: "iubenda_consent_rejected" });
  }
}`.trim();

  let snippet;
  if (IubDualLang?.checked && cpEn){
    // switch automatico IT/EN (basato su lang html o path /en)
    snippet = `
<script type="text/javascript">
  window.dataLayer = window.dataLayer || [];
  var _iub = _iub || [];
  var pageLang = (document.documentElement.getAttribute("lang")||"").toLowerCase().split("-")[0];
  if (!pageLang) pageLang = (location.pathname.startsWith("/en") ? "en" : "it");
  var cookiePolicyByLang = { it: ${cpIt}, en: ${cpEn} };
  if (!cookiePolicyByLang[pageLang]) pageLang = "it";
  _iub.csConfiguration = {
    siteId: ${siteId},
    cookiePolicyId: cookiePolicyByLang[pageLang],
    lang: pageLang,
    storage: { useSiteId: true },
    ${callback}
  };
</script>
${widget}script>`.trim();
  } else {
    // solo IT
    snippet = `
<script type="text/javascript">
  window.dataLayer = window.dataLayer || [];
  var _iub = _iub || [];
  _iub.csConfiguration = {
    siteId: ${siteId},
    cookiePolicyId: ${cpIt},
    lang: "it",
    storage: { useSiteId: true },
    ${callback}
  };
</script>
${widget}script>`.trim();
  }
  if (IubOut) IubOut.value = snippet;
}
IubCopyBtn?.addEventListener('click', async ()=>{
  try { await navigator.clipboard.writeText(IubOut?.value || ''); alert('Snippet copiato negli appunti.'); }
  catch { IubOut?.select(); document.execCommand('copy'); alert('Snippet copiato (fallback).'); }
});
IubDualLang?.addEventListener('change', iubSyncEnVisibility);
iubSyncEnVisibility();

/* -------------------------- Dispatcher globale ------------------------ */
BtnProcedi?.addEventListener('click', async ()=>{
  try {
    BtnProcedi.disabled = true;
    if (currentMode === 'images')   { /* ... */ await exportImages(); return; }
    if (currentMode === 'digitaltool'){ await exportDigitalTool(); return; }
    if (currentMode === 'pdf2jpg')  { await exportPdfToJpg(); return; }
    if (currentMode === 'rename')   { await exportRename(); return; }
    if (currentMode === 'video')    { await exportVideoSlideshow(); return; }
    if (currentMode === 'watermark'){ await exportWatermarkPortali(); return; }
    if (currentMode === 'bv')       { await exportBusinessCard(); return; }
    if (currentMode === 'qr')       { await makeQr(); return; }
    if (currentMode === 'iubenda')  { makeIubendaSnippet(); return; }
    alert("Funzione non attiva.");
  } finally {
    BtnProcedi.disabled = false;
  }
});

/* ------------------------------ PPT: download & fonts ----------------- */
window.downloadPPT = (href) => { const a = document.createElement('a'); a.href = href; a.download = href.split('/').pop(); a.click(); };
const FONTS_LIST = [
  'Manrope-Bold.ttf','Manrope-ExtraBold.ttf','Manrope-ExtraLight.ttf','Manrope-Light.ttf',
  'Manrope-Medium.ttf','Manrope-Regular.ttf','Manrope-SemiBold.ttf',
  'PPPangaia-Bold.otf','PPPangaia-BoldItalic.otf',
  'PPPangaia-Medium.otf','PPPangaia-MediumItalic.otf',
  'PPPangaia-Semibold.otf','PPPangaia-SemiboldItalic.otf',
  'PPPangaia-Ultralight.otf','PPPangaia-UltralightItalic.otf'
];
async function downloadFontsZip(){
  const base = 'assets/fonts/ppt/';
  const zip = new JSZip();
  let added = 0;
  for (const name of FONTS_LIST){
    try {
      const res = await fetch(base + name, { cache:'no-store' });
      if (!res.ok) continue;
      const blob = await res.blob();
      zip.file(name, blob);
      added++;
    } catch {}
  }
  if (!added){ alert('Nessun file font trovato in /assets/fonts/ppt/.'); return; }
  const out = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = 'abitareco-fonts.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}
$('#BtnFontsZip')?.addEventListener('click', downloadFontsZip);
