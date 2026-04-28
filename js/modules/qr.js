/* =============================== QR + UTM ============================= */
const QrBase = $('#QrBase');
const QrSource = $('#QrSource');
const QrMedium = $('#QrMedium');
const QrCampaign = $('#QrCampaign');
const QrId = $('#QrId');
const QrTerm = $('#QrTerm');
const QrContent = $('#QrContent');
const QrGeneratedUrl = $('#QrGeneratedUrl');
const QrCopyUrl = $('#QrCopyUrl');
// Non mostriamo anteprima: teniamo i riferimenti ma li nascondiamo.
const QrCanvas = $('#QrCanvas');
const QrPreviewWrap = $('#QrPreviewWrap');
const QrDownloadPng = $('#QrDownloadPng');
const QrDownloadSvg = $('#QrDownloadSvg');

function isValidHttpUrl(str){
  try {
    const u = new URL(str);
    return (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

function buildUtmUrl(){
  const base = (QrBase?.value || '').trim();
  if (!base) return '';
  try {
    const u = new URL(base);
    const set = (k, el) => {
      const v = (el?.value || '').trim();
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    };
    set('utm_source', QrSource);
    set('utm_medium', QrMedium);
    set('utm_campaign', QrCampaign);
    set('utm_id', QrId);
    set('utm_term', QrTerm);
    set('utm_content', QrContent);
    return u.toString();
  } catch {
    return '';
  }
}

function validateQrInputs(){
  const base = (QrBase?.value || '').trim();
  const src = (QrSource?.value || '').trim();
  const med = (QrMedium?.value || '').trim();
  const camp = (QrCampaign?.value || '').trim();

  if (!base) return { ok:false, msg:'Compila Website URL.' };
  if (!isValidHttpUrl(base)) return { ok:false, msg:'Website URL deve iniziare con http:// o https://'};
  if (!src) return { ok:false, msg:'Compila Campaign source (utm_source).'};
  if (!med) return { ok:false, msg:'Compila Campaign medium (utm_medium).'};
  if (!camp) return { ok:false, msg:'Compila Campaign name (utm_campaign).'};

  const built = buildUtmUrl();
  if (!built || !isValidHttpUrl(built)) return { ok:false, msg:'URL generata non valida. Controlla i campi.' };
  return { ok:true, url: built };
}

function hideQrUIExtras(){
  if (QrPreviewWrap) QrPreviewWrap.classList.add('hidden');
  if (QrDownloadPng) { QrDownloadPng.classList.add('hidden'); QrDownloadPng.removeAttribute('href'); }
  if (QrDownloadSvg) { QrDownloadSvg.classList.add('hidden'); QrDownloadSvg.removeAttribute('href'); }
}

function safeDownloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 2000);
}

async function ensureQrLib(){
  // Useremo qrcodejs (https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js)
  // che espone window.QRCode come costruttore.
  if (typeof window.QRCode === 'function' && window.QRCode.CorrectLevel) return;
  throw new Error('Libreria QRCode non disponibile (qrcodejs non caricata).');
}

function canvasToEmbeddedSvg(canvas){
  // SVG che contiene l'immagine PNG incorporata (compatibile e leggero)
  const pngDataUrl = canvas.toDataURL('image/png');
  const w = canvas.width, h = canvas.height;
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
         `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
         `<image href="${pngDataUrl}" width="${w}" height="${h}"/>` +
         `</svg>\n`;
}

function updateQrGeneratedUrl(){
  const url = buildUtmUrl();
  if (QrGeneratedUrl) QrGeneratedUrl.value = url || '';
  if (QrCopyUrl) QrCopyUrl.disabled = !url;

  if (currentMode === 'qr' && BtnProcedi){
    const v = validateQrInputs();
    BtnProcedi.disabled = !v.ok;
  }
  hideQrUIExtras();
}

async function makeQr(){
  try {
    const v = validateQrInputs();
    if (!v.ok){ alert(v.msg); return; }
    const url = v.url;
    if (QrGeneratedUrl) QrGeneratedUrl.value = url;

    await ensureQrLib();

    // Generazione senza preview: creiamo un contenitore offscreen
    const size = 512;
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.left = '-99999px';
    wrap.style.top = '-99999px';
    document.body.appendChild(wrap);

    // qrcodejs scrive canvas o table nel DOM
    const qr = new window.QRCode(wrap, {
      text: url,
      width: size,
      height: size,
      correctLevel: window.QRCode.CorrectLevel.M
    });

    // aspetta che qrcodejs abbia scritto il canvas
    await new Promise(r => setTimeout(r, 0));
    const canvas = wrap.querySelector('canvas');
    if (!canvas) {
      wrap.remove();
      throw new Error('Impossibile generare il QR (canvas non creato).');
    }

    const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!pngBlob) { wrap.remove(); throw new Error('Impossibile esportare PNG.'); }

    const svgStr = canvasToEmbeddedSvg(canvas);
    wrap.remove();

    if (!window.JSZip) throw new Error('JSZip non disponibile (CDN).');
    const zip = new JSZip();
    zip.file('qr.png', pngBlob);
    zip.file('qr.svg', svgStr);
    zip.file('url.txt', url + '\n');

    const camp = slugify((QrCampaign?.value || 'qr')) || 'qr';
    const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
    const zipBlob = await zip.generateAsync({ type:'blob' });
    safeDownloadBlob(zipBlob, `QR-${camp}-${stamp}.zip`);
  } catch (err){
    console.error(err);
    alert('Errore durante la generazione del QR: ' + (err?.message || err));
  }
}

QrCopyUrl?.addEventListener('click', async () => {
  const txt = (QrGeneratedUrl?.value || '').trim();
  if (!txt) return;
  try { await navigator.clipboard.writeText(txt); alert('URL copiata negli appunti.'); }
  catch { QrGeneratedUrl?.select(); document.execCommand('copy'); alert('URL copiata (fallback).'); }
});

let __qrDebounce = 0;
function scheduleQrUrlUpdate(){
  if (currentMode !== 'qr') return;
  if (__qrDebounce) clearTimeout(__qrDebounce);
  __qrDebounce = setTimeout(updateQrGeneratedUrl, 150);
}
[QrBase, QrSource, QrMedium, QrCampaign, QrId, QrTerm, QrContent].forEach(el => {
  el?.addEventListener('input', scheduleQrUrlUpdate);
  el?.addEventListener('change', scheduleQrUrlUpdate);
});
