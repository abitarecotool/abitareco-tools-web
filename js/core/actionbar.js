// ========================= ACTION BAR (dispatcher) =========================
// Gestisce il click su "Esporta ora" per tutte le modalità.
// Nota: per Iubenda NON facciamo reset automatico (lo snippet deve restare visibile).

BtnProcedi?.addEventListener('click', async ()=>{
  const mode = currentMode;
  let ok = false;

  try {
    BtnProcedi.disabled = true;

    if (mode === 'images')       { await exportImages(); ok = true; return; }
    if (mode === 'digitaltool')  { await exportDigitalTool(); ok = true; return; }
    if (mode === 'platform')     { await exportPlatform(); ok = true; return; }
    if (mode === 'pdf2jpg')      { await exportPdfToJpg(); ok = true; return; }
    if (mode === 'rename')       { await exportRename(); ok = true; return; }
    if (mode === 'video')        { await exportVideoSlideshow(); ok = true; return; }
    if (mode === 'watermark')    { await exportWatermarkPortali(); ok = true; return; }
    if (mode === 'bv')           { await exportBusinessCard(); ok = true; return; }

    if (mode === 'qr')           { await makeQr(); ok = true; return; }

    if (mode === 'fattura') {
  if (typeof window.exportFatturaPdf !== 'function') { throw new Error('Export Fattura non pronto: apri la sezione Fattura e riprova.'); }
  await window.exportFatturaPdf(); ok = true; return;
 }
 // IUBENDA: genera snippet ma NON resettare
    if (mode === 'iubenda')      { makeIubendaSnippet(); ok = true; return; }

    alert('Funzione non attiva.');

  } catch (err){
    console.error(err);
    alert('Errore: ' + (err?.message || err));

  } finally {
    BtnProcedi.disabled = false;

    // Reset post-export per TUTTE le modalità tranne Iubenda
    if (ok && !['iubenda','platform'].includes(mode)) {
      try { resetAllUIAndState(); } catch {}
    }
  }
});