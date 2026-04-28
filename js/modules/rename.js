/* ================================ Rename ============================== */

// Modulo isolato (evita collisioni di variabili tra script classici)
(function(){
  'use strict';

  const DropAreaRename  = $('#DropAreaRename');
  const TxtFolderRename = $('#TxtFolderRename');
  const BtnClearRename  = $('#BtnClearRename');
  const TxtRenameBase   = $('#TxtRenameBase');

  if (DropAreaRename) {
    const preventR = (e)=>{ e.preventDefault(); e.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaRename.addEventListener(ev, preventR));

    DropAreaRename.addEventListener('dragenter', () => DropAreaRename.classList.add('drag-over'));
    DropAreaRename.addEventListener('dragleave', () => DropAreaRename.classList.remove('drag-over'));

    DropAreaRename.addEventListener('drop', async (e)=>{
      DropAreaRename.classList.remove('drag-over');
      pickedRename = await readDroppedDirectory(e.dataTransfer);
      // Rename accetta solo immagini
      pickedRename = pickedRename.filter(p => /\.(jpe?g|png|webp|tif?f)$/i.test(p.file.name));

      TxtFolderRename.textContent = pickedRename.length
        ? `Selezionati ${pickedRename.length} file…`
        : 'Nessun file supportato.';
      BtnClearRename.classList.toggle('hidden', pickedRename.length === 0);
    });

    DropAreaRename.addEventListener('click', ()=>{
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.accept = 'image/*';

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
      TxtFolderRename.textContent = 'Trascina qui la cartella o clicca per sfogliare…';
      BtnClearRename.classList.add('hidden');
    });
  }

  async function exportRename(){
    const base = slugify(TxtRenameBase?.value || '').trim();
    const mode = base ? 2 : 1;

    const files = pickedRename.filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
    if (!files.length){ alert('Carica una cartella per rinominare.'); return; }

    const sorted = files.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));

    const zip = new JSZip();
    showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
    const total = sorted.length;

    for (let i=0; i<sorted.length; i++){
      const rec = sorted[i];
      const file = rec.file;
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const nn = String(i+1).padStart(2,'0');
      const newName = (mode === 1) ? `${nn}${ext}` : `${base}-${nn}${ext}`;
      zip.file(newName, file);
      ActionProgress.value = Math.round(((i+1)/total)*100);
    }

    const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
    const blob = await zip.generateAsync({type:'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RENAME-${stamp}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    hideEl(ActionProgressWrap);
  }

  // export globale
  window.exportRename = exportRename;
})();
