/* ========================= Drag & Drop: IMMAGINI ====================== */
const DropArea = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath = $('#BtnClearPath');

if (DropArea) {
  const prevent = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropArea.addEventListener(ev, prevent));

  DropArea.addEventListener('dragenter', () => DropArea.classList.add('drag-over'));
  DropArea.addEventListener('dragleave', () => DropArea.classList.remove('drag-over'));

  DropArea.addEventListener('drop', async (e)=>{
    DropArea.classList.remove('drag-over');
    picked = await readDroppedDirectory(e.dataTransfer);

    TxtFolderPath.textContent = picked.length
      ? `Selezionati ${picked.length} file…`
      : 'Nessun file supportato.';
    BtnClearPath.classList.toggle('hidden', picked.length === 0);

    handleCropUI();
  });

  DropArea.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = ()=>{
      const fl = Array.from(input.files || []);
      picked = fl
        .filter(f => /\.(jpe?g|png|webp|tif?f|pdf)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));

      TxtFolderPath.textContent = picked.length
        ? `Selezionati ${picked.length} file…`
        : 'Nessun file supportato.';
      BtnClearPath.classList.toggle('hidden', picked.length === 0);

      handleCropUI();
    };
    input.click();
  });

  BtnClearPath?.addEventListener('click', (e)=>{
    e.stopPropagation();
    picked = [];
    TxtFolderPath.textContent = 'Trascina qui la cartella…';
    BtnClearPath.classList.add('hidden');
    hideEl(ImageCropCard);
  });
}



