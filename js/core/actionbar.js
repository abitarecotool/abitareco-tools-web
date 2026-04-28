BtnProcedi?.addEventListener('click', async ()=>{
  let ok = false;
  try {
    BtnProcedi.disabled = true;

    if (currentMode === 'images')      { await exportImages(); ok = true; return; }
    if (currentMode === 'digitaltool') { await exportDigitalTool(); ok = true; return; }
    if (currentMode === 'pdf2jpg')     { await exportPdfToJpg(); ok = true; return; }
    if (currentMode === 'rename')      { await exportRename(); ok = true; return; }
    if (currentMode === 'video')       { await exportVideoSlideshow(); ok = true; return; }
    if (currentMode === 'watermark')   { await exportWatermarkPortali(); ok = true; return; }
    if (currentMode === 'bv')          { await exportBusinessCard(); ok = true; return; }

    if (currentMode === 'qr')          { await makeQr(); ok = true; return; }
    if (currentMode === 'iubenda')     { makeIubendaSnippet(); ok = true; return; }

    alert('Funzione non attiva.');
  } catch (err){
    console.error(err);
    alert('Errore: ' + (err?.message || err));
  } finally {
    BtnProcedi.disabled = false;
    if (ok) {
      // reset dopo export/generazione
      try { resetAllUIAndState(); } catch {}
    }
  }
});

