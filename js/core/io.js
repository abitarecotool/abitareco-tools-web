/* ========================= Drag & Drop: IMMAGINI ====================== */
const DropArea = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath = $('#BtnClearPath');
function isMobileUploadUI(){
  return window.matchMedia('(max-width: 900px)').matches && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));
}
function isGalleryModeForMainUpload(){
  const mode = String(window.currentMode || '').toLowerCase();
  return isMobileUploadUI() && ['images','digitaltool'].includes(mode);
}
function updateMainUploadLabel(){
  TxtFolderPath.textContent = picked.length
    ? `Selezionati ${picked.length} file…`
    : 'Nessun file supportato.';
  BtnClearPath.classList.toggle('hidden', picked.length === 0);
  try { handleCropUI(); } catch {}
}

if (DropArea) {
  const prevent = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropArea.addEventListener(ev, prevent));

  DropArea.addEventListener('dragenter', () => DropArea.classList.add('drag-over'));
  DropArea.addEventListener('dragleave', () => DropArea.classList.remove('drag-over'));

  DropArea.addEventListener('drop', async (e)=>{
    DropArea.classList.remove('drag-over');
    picked = await readDroppedDirectory(e.dataTransfer);

    updateMainUploadLabel();
  });

  DropArea.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (isGalleryModeForMainUpload()) {
      input.accept = 'image/*';
    } else {
      input.webkitdirectory = true;
      input.directory = true;
    }

    input.onchange = ()=>{
      const fl = Array.from(input.files || []);
      picked = fl
        .filter(f => /\.(jpe?g|png|webp|tif?f|pdf)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));

      updateMainUploadLabel();
    };
    input.click();
  });

  BtnClearPath?.addEventListener('click', (e)=>{
    e.stopPropagation();
    picked = [];
    TxtFolderPath.textContent = isGalleryModeForMainUpload() ? 'Tocca per selezionare più immagini…' : 'Trascina qui la cartella…';
    BtnClearPath.classList.add('hidden');
    hideEl(ImageCropCard);
  });
}



