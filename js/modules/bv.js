/* ========================= BIGLIETTO DA VISITA (Akrobat/Calibri) ===== */
const BvBrandPills = $('#BvBrandPills');
const BvForm       = $('#BvForm');
const BvFullName   = $('#BvFullName');
const BvJobTitle   = $('#BvJobTitle');
const BvPhone      = $('#BvPhone');
const BvEmail      = $('#BvEmail');
const BvReaWrap    = $('#BvReaWrap');   // checkbox container
const BvReaInput   = $('#BvReaInput');  // input container (hidden)
const BvHasRea     = $('#BvHasRea');
const BvRea        = $('#BvRea');

let bvBrand = null; // 'abitareco' | 'commercial' | 'riabitareco'

// UI: brand / REA
BvBrandPills?.addEventListener('click', (e) => {
  const btn = e.target.closest('.brand-pill'); if (!btn) return;
  $$('.brand-pill').forEach(p => p.classList.toggle('active', p === btn));
  bvBrand = btn.dataset.brand;
  showEl(BvForm);

  if (bvBrand === 'abitareco') {
    showEl(BvReaWrap);
    (BvHasRea?.checked) ? showEl(BvReaInput) : hideEl(BvReaInput);
  } else {
    hideEl(BvReaWrap); hideEl(BvReaInput);
    if (BvHasRea) BvHasRea.checked = false;
    if (BvRea)    BvRea.value = '';
  }
});
BvHasRea?.addEventListener('change', ()=>{
  if (bvBrand !== 'abitareco') return;
  (BvHasRea.checked) ? showEl(BvReaInput) : (hideEl(BvReaInput), BvRea && (BvRea.value=''));
});

// Font helpers (brand -> Akrobat / Calibri)
async function fetchFirst(paths){
  for (const p of paths){
    try {
      const res = await fetch(p, { cache:'no-store' });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {}
  }
  return null;
}
async function ensureFontkit(pdfDoc){
  if (!window.fontkit) {
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://unpkg.com/@pdf-lib/fontkit@1.0.0/dist/fontkit.umd.min.js';
      s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }
  pdfDoc.registerFontkit(window.fontkit);

}
async function loadBrandFontsForBV(pdfDoc, brand) {
  await ensureFontkit(pdfDoc);

  let regCandidates = [];
  let boldCandidates = [];

  if (brand === 'riabitareco') {
    // Calibri (dallo screenshot: calibri.ttf, calibrib.ttf, calibriz.ttf…)
    regCandidates = [
      'assets/fonts/bv/calibri.ttf',
      'assets/fonts/bv/Calibri.ttf',
      'assets/fonts/bv/Calibri-Regular.ttf',
      'assets/fonts/bv/Calibri Regular.ttf'
    ];
    boldCandidates = [
      'assets/fonts/bv/calibrib.ttf',
      'assets/fonts/bv/Calibri-Bold.ttf',
      'assets/fonts/bv/Calibri Bold.ttf',
      'assets/fonts/bv/CalibriBold.ttf'
    ];
  } else {
    // Akrobat
    regCandidates = [
      'assets/fonts/bv/Akrobat-Regular.otf',
      'assets/fonts/bv/Akrobat-Regular.ttf',
      'assets/fonts/bv/Akrobat Regular.ttf'
    ];
    boldCandidates = [
      'assets/fonts/bv/Akrobat-Bold.otf',
      'assets/fonts/bv/Akrobat-Bold.ttf',
      'assets/fonts/bv/Akrobat Bold.ttf'
    ];
  }

  const regBytes  = await fetchFirst(regCandidates);
  const boldBytes = await fetchFirst(boldCandidates);

  let fontReg = null, fontBold = null;
  try { if (regBytes)  fontReg  = await pdfDoc.embedFont(regBytes); }  catch {}
  try { if (boldBytes) fontBold = await pdfDoc.embedFont(boldBytes); } catch {}

  return { fontReg, fontBold };
}

async function exportBusinessCard(){
  if (!bvBrand) { alert('Seleziona un brand (Abitare Co. / Abitare Commercial / RiAbitare Co.).'); return; }
  const fullName = (BvFullName?.value || '').trim();
  const jobTitle = (BvJobTitle?.value || '').trim();
  const phone    = (BvPhone?.value    || '').trim();
  const email    = (BvEmail?.value    || '').trim();
  if (!fullName || !jobTitle || !phone || !email) { alert('Compila tutti i campi obbligatori.'); return; }
  const wantsRea = (bvBrand === 'abitareco') && (BvHasRea?.checked);
  const reaCode  = (wantsRea ? (BvRea?.value || '').trim() : '');

  const tpl = {
    abitareco: {
      front: 'assets/templates/businesscard/abitareco/front.pdf',
      backNoRea: 'assets/templates/businesscard/abitareco/back_form.pdf',
      backRea:   'assets/templates/businesscard/abitareco/back_rea_form.pdf',
      nameMode: 'NoBrand'
    },
    commercial: {
      front: 'assets/templates/businesscard/commercial/front.pdf',
      backNoRea: 'assets/templates/businesscard/commercial/back_form.pdf',
      backRea: null,
      nameMode: 'WithBrand'
    },
    riabitareco: {
      front: 'assets/templates/businesscard/riabitareco/front.pdf',
      backNoRea: 'assets/templates/businesscard/riabitareco/back_form.pdf',
      backRea: null,
      nameMode: 'WithBrand'
    }
  }[bvBrand];

  // Back compilato + font brand
  const backTplUrl = (wantsRea && tpl.backRea) ? tpl.backRea : tpl.backNoRea;
  const backTplBytes = await (await fetch(backTplUrl, { cache:'no-store' })).arrayBuffer();
  let backDoc = await PDFLib.PDFDocument.load(backTplBytes);

  const { fontReg, fontBold } = await loadBrandFontsForBV(backDoc, bvBrand);

  const form = backDoc.getForm();
  try { const f=form.getTextField('FullName'); f.setText(fullName); (fontBold||fontReg)&&f.updateAppearances(fontBold||fontReg); } catch {}
  try { const f=form.getTextField('JobTitle'); f.setText(jobTitle); (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  try { const f=form.getTextField('Phone');    f.setText(phone);    (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  try { const f=form.getTextField('Email');    f.setText(email);    (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  if (wantsRea && tpl.backRea){
    try { const f=form.getTextField('ReaCode'); f.setText(reaCode); (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  }
  form.flatten();
  const backFilledBytes = await backDoc.save();

  // Front
  const frontBytes = new Uint8Array(await (await fetch(tpl.front, { cache:'no-store' })).arrayBuffer());
  const frontDoc = await PDFLib.PDFDocument.load(frontBytes);

  // Merge (front -> back)
  const finalDoc = await PDFLib.PDFDocument.create();
  const [frontPg] = await finalDoc.copyPages(frontDoc, [0]);
  finalDoc.addPage(frontPg);
  const backFilledDoc = await PDFLib.PDFDocument.load(backFilledBytes);
  const [backPg] = await finalDoc.copyPages(backFilledDoc, [0]);
  finalDoc.addPage(backPg);

  const out = await finalDoc.save();

  // Filename
  const safe = fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'biglietto';
  const fileName = (tpl.nameMode === 'WithBrand') ? `BV-${bvBrand}-${safe}.pdf` : `BV-${safe}.pdf`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], {type:'application/pdf'}));
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

