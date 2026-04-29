/* js/modules/bv_preview.js */

(function(){
  'use strict';

  function init(){
    const btn = document.getElementById('BvPreviewBtn');
    const hint = document.getElementById('BvPreviewHint');
    const cFront = document.getElementById('BvPreviewFront');
    const cBack  = document.getElementById('BvPreviewBack');

    const pillsWrap = document.getElementById('BvBrandPills');

    const fullName = document.getElementById('BvFullName');
    const jobTitle = document.getElementById('BvJobTitle');
    const phone    = document.getElementById('BvPhone');
    const email    = document.getElementById('BvEmail');
    const hasRea   = document.getElementById('BvHasRea');
    const rea      = document.getElementById('BvRea');

    if (!btn || !cFront || !cBack) return;
    if (btn.__bvPreviewBound) return;
    btn.__bvPreviewBound = true;

    let previewGenerated = false;
    let previewDirty = false;
    let rendering = false;

    async function ensurePdfJs(){
      if (window.pdfjsLib) return;
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload=resolve; s.onerror=reject;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    async function fetchOrThrow(url){
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) throw new Error(`File non trovato (${res.status}) → ${url}`);
      return res;
    }

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
      if (!window.fontkit) return;
      try { pdfDoc.registerFontkit(window.fontkit); } catch {}
    }

    async function loadBrandFontsForBV(pdfDoc, brand){
      await ensureFontkit(pdfDoc);

      let regCandidates = [];
      let boldCandidates = [];

      if (brand === 'riabitareco'){
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

      const regBytes = await fetchFirst(regCandidates);
      const boldBytes = await fetchFirst(boldCandidates);

      let fontReg = null, fontBold = null;
      try { if (regBytes) fontReg = await pdfDoc.embedFont(regBytes); } catch {}
      try { if (boldBytes) fontBold = await pdfDoc.embedFont(boldBytes); } catch {}
      return { fontReg, fontBold };
    }

    function getSelectedBrand(){
      const active = document.querySelector('.brand-pill.active');
      return active ? active.dataset.brand : null;
    }

    function isValid(){
      const brand = getSelectedBrand();
      if (!brand) return false;
      const vName = (fullName?.value || '').trim();
      const vJob  = (jobTitle?.value || '').trim();
      const vPh   = (phone?.value || '').trim();
      const vEm   = (email?.value || '').trim();
      if (!vName || !vJob || !vPh || !vEm) return false;
      if (brand === 'abitareco' && hasRea?.checked){
        const vRea = (rea?.value || '').trim();
        if (!vRea) return false;
      }
      return true;
    }

    function setHint(txt){ if (hint) hint.textContent = txt; }

    function updateBtn(){
      const ok = isValid();
      if (!previewGenerated) btn.textContent = 'Genera anteprima';
      else btn.textContent = previewDirty ? 'Aggiorna anteprima' : 'Anteprima aggiornata';
      btn.disabled = rendering || !ok;

      if (!ok) setHint('Compila i dati e seleziona un brand per generare l’anteprima.');
      else if (!previewGenerated) setHint('Pronto: genera l’anteprima (PDF identico all’export).');
      else if (previewDirty) setHint('Hai modificato dei campi: aggiorna l’anteprima per vedere il PDF finale.');
      else setHint('Anteprima aggiornata: corrisponde al PDF che verrà esportato.');
    }

    async function buildPdfBytes(){
      if (!window.PDFLib || !PDFLib.PDFDocument) throw new Error('pdf-lib non disponibile.');

      const brand = getSelectedBrand();
      const vName = (fullName?.value || '').trim();
      const vJob  = (jobTitle?.value || '').trim();
      const vPh   = (phone?.value || '').trim();
      const vEm   = (email?.value || '').trim();
      const wantsRea = (brand === 'abitareco') && !!hasRea?.checked;
      const vRea = wantsRea ? (rea?.value || '').trim() : '';

      const tpl = {
        abitareco: {
          front: 'assets/templates/businesscard/abitareco/front.pdf',
          backNoRea: 'assets/templates/businesscard/abitareco/back_form.pdf',
          backRea: 'assets/templates/businesscard/abitareco/back_rea_form.pdf'
        },
        commercial: {
          front: 'assets/templates/businesscard/commercial/front.pdf',
          backNoRea: 'assets/templates/businesscard/commercial/back_form.pdf',
          backRea: null
        },
        riabitareco: {
          front: 'assets/templates/businesscard/riabitareco/front.pdf',
          backNoRea: 'assets/templates/businesscard/riabitareco/back_form.pdf',
          backRea: null
        }
      }[brand];

      if (!tpl) throw new Error('Brand non valido');

      const backTplUrl = (wantsRea && tpl.backRea) ? tpl.backRea : tpl.backNoRea;

      const backTplBytes = await (await fetchOrThrow(backTplUrl)).arrayBuffer();
      let backDoc = await PDFLib.PDFDocument.load(backTplBytes);

      const { fontReg, fontBold } = await loadBrandFontsForBV(backDoc, brand);
      const form = backDoc.getForm();

      try { const f=form.getTextField('FullName'); f.setText(vName); (fontBold||fontReg) && f.updateAppearances(fontBold||fontReg); } catch {}
      try { const f=form.getTextField('JobTitle'); f.setText(vJob); (fontReg||fontBold) && f.updateAppearances(fontReg||fontBold); } catch {}
      try { const f=form.getTextField('Phone'); f.setText(vPh); (fontReg||fontBold) && f.updateAppearances(fontReg||fontBold); } catch {}
      try { const f=form.getTextField('Email'); f.setText(vEm); (fontReg||fontBold) && f.updateAppearances(fontReg||fontBold); } catch {}

      if (wantsRea && tpl.backRea){
        try { const f=form.getTextField('ReaCode'); f.setText(vRea); (fontReg||fontBold) && f.updateAppearances(fontReg||fontBold); } catch {}
      }

      try { form.flatten(); } catch {}
      const backFilledBytes = await backDoc.save();

      const frontBytes = new Uint8Array(await (await fetchOrThrow(tpl.front)).arrayBuffer());
      const frontDoc = await PDFLib.PDFDocument.load(frontBytes);

      const finalDoc = await PDFLib.PDFDocument.create();
      const [frontPg] = await finalDoc.copyPages(frontDoc, [0]);
      finalDoc.addPage(frontPg);

      const backFilledDoc = await PDFLib.PDFDocument.load(backFilledBytes);
      const [backPg] = await finalDoc.copyPages(backFilledDoc, [0]);
      finalDoc.addPage(backPg);

      return await finalDoc.save();
    }

    // IMPORTANT FIX:
    // Carichiamo PDF una sola volta e renderizziamo due pagine dallo stesso oggetto.
    // In questo modo evitiamo il DataCloneError "ArrayBuffer is already detached".
    async function renderTwoPages(pdfBytes, canvas1, canvas2){
      await ensurePdfJs();

      // pdf.js usa worker e può "detached" il buffer se passato più volte.
      // Facciamo una COPIA e creiamo un SOLO documento.
      const data = (pdfBytes instanceof Uint8Array) ? pdfBytes.slice(0) : new Uint8Array(pdfBytes);

      const pdf = await window.pdfjsLib.getDocument({ data }).promise;

      const renderOne = async (pageNum, canvas) => {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.15 });
        const ctx = canvas.getContext('2d');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      };

      await renderOne(1, canvas1);
      // se il pdf ha 2 pagine renderizziamo, altrimenti lasciamo vuoto
      if (pdf.numPages >= 2) await renderOne(2, canvas2);
      else {
        const ctx = canvas2.getContext('2d');
        ctx.clearRect(0,0,canvas2.width,canvas2.height);
      }

      try { pdf.cleanup && pdf.cleanup(); } catch {}
    }

    async function generatePreview(){
      if (!isValid()) return;
      rendering = true;
      btn.textContent = 'Generazione…';
      btn.disabled = true;
      setHint('Generazione anteprima…');

      try {
        const bytes = await buildPdfBytes();
        await renderTwoPages(bytes, cFront, cBack);
        previewGenerated = true;
        previewDirty = false;
      } catch (e){
        console.error(e);
        alert('Anteprima non riuscita: ' + (e?.message || e));
      } finally {
        rendering = false;
        updateBtn();
      }
    }

    const markDirty = () => {
      if (previewGenerated) previewDirty = true;
      updateBtn();
    };

    ['input','change'].forEach(ev => {
      fullName?.addEventListener(ev, markDirty);
      jobTitle?.addEventListener(ev, markDirty);
      phone?.addEventListener(ev, markDirty);
      email?.addEventListener(ev, markDirty);
      rea?.addEventListener(ev, markDirty);
      hasRea?.addEventListener(ev, markDirty);
    });
    pillsWrap?.addEventListener('click', () => setTimeout(markDirty, 0));

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      generatePreview();
    });

    updateBtn();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
