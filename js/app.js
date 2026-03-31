/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   ========================================================= */
"use strict";

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const showEl = (el) => el && el.classList.remove('hidden');
const hideEl = (el) => el && el.classList.add('hidden');

const SideMenu = $('#SideMenu');
const BtnProcedi = $('#BtnProcedi');
const ActionProgressWrap  = $('#ActionProgressWrap');
const ActionProgress      = $('#ActionProgress');
const ActionProgressLabel = $('#ActionProgressLabel');

const ALL_CARDS = [
  $('#WelcomeCard'), $('#SlugCard'), $('#FormatCard'), $('#UploadCard'),
  $('#WatermarkCard'), $('#RenameCard'), $('#VideoCard'), 
  $('#BusinessCardCard'), $('#QrCard'), $('#IubendaCard')
];

let currentMode = 'images';
let picked = [];

/* -------------------------- Inizializzazione -------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
});

SideMenu.addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (!item) return;

  $$('.nav-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');

  const mode = item.dataset.mode;
  currentMode = mode;
  
  ALL_CARDS.forEach(hideEl);
  hideEl(ActionProgressWrap);
  showEl(BtnProcedi);

  switch (mode) {
    case 'images':
      showEl($('#SlugCard')); showEl($('#FormatCard')); showEl($('#UploadCard'));
      break;
    case 'digitaltool':
      showEl($('#SlugCard')); showEl($('#UploadCard'));
      break;
    case 'pdf2jpg':
      showEl($('#UploadCard'));
      break;
    case 'watermark':
      showEl($('#WatermarkCard')); showEl($('#UploadCard'));
      break;
    case 'rename':
      showEl($('#RenameCard')); showEl($('#UploadCard'));
      break;
    case 'videoslideshow':
      showEl($('#VideoCard')); showEl($('#UploadCard'));
      break;
    case 'businesscard':
      showEl($('#BusinessCardCard'));
      break;
    case 'qrcode':
      showEl($('#QrCard'));
      break;
    case 'iubenda':
      showEl($('#IubendaCard'));
      break;
  }
});

/* -------------------------- Gestione Upload --------------------------- */
const InpFile = $('#InpFile');
const DropZone = $('#DropZone');
const FileList = $('#FileList');

DropZone.addEventListener('click', () => InpFile.click());
InpFile.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
  for (const f of files) {
    if (picked.find(x => x.file.name === f.name)) continue;
    picked.push({ file: f, id: crypto.randomUUID() });
  }
  renderFiles();
}

function renderFiles() {
  FileList.innerHTML = picked.map(item => `
    <div class="file-item">
      <span>${item.file.name}</span>
      <button onclick="removeFile('${item.id}')">×</button>
    </div>
  `).join('');
}

window.removeFile = (id) => {
  picked = picked.filter(x => x.id !== id);
  renderFiles();
};

/* -------------------------- Logica Watermark -------------------------- */
async function exportWatermark() {
  if (!picked.length) return alert("Carica le immagini.");
  const logoFile = $('#InpWatermarkLogo').files[0];
  if (!logoFile) return alert("Seleziona il logo PNG.");

  const zip = new JSZip();
  const logoBmp = await loadImageBitmap(logoFile);
  
  showEl(ActionProgressWrap);

  for (let i = 0; i < picked.length; i++) {
    ActionProgress.value = Math.floor(((i+1)/picked.length)*100);
    ActionProgressLabel.textContent = `Elaborando ${i+1}/${picked.length}`;

    const imgBmp = await loadImageBitmap(picked[i].file);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Background bianco per JPG
    ctx.fillStyle = "white";
    ctx.fillRect(0,0,1024,768);

    // Resize Cover 1024x768
    const ratio = Math.max(1024/imgBmp.width, 768/imgBmp.height);
    const sw = 1024/ratio, sh = 768/ratio;
    const sx = (imgBmp.width - sw)/2, sy = (imgBmp.height - sh)/2;
    ctx.drawImage(imgBmp, sx, sy, sw, sh, 0, 0, 1024, 768);

    // Logo Centro
    ctx.drawImage(logoBmp, (1024 - logoBmp.width)/2, (768 - logoBmp.height)/2);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
    zip.file(`immagini-${(i+1).toString().padStart(2,'0')}.jpg`, blob);
  }

  const content = await zip.generateAsync({type:"blob"});
  saveAs(content, "Watermark_Export.zip");
  hideEl(ActionProgressWrap);
}

/* -------------------------- Helpers -------------------------- */
async function loadImageBitmap(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

/* -------------------------- Dispatcher -------------------------- */
BtnProcedi.addEventListener('click', async () => {
  BtnProcedi.disabled = true;
  try {
    if (currentMode === 'watermark') await exportWatermark();
    // Aggiungeremo qui le altre funzioni man mano
    else alert("Funzione in fase di implementazione.");
  } catch (err) {
    console.error(err);
    alert("Errore durante l'esportazione.");
  }
  BtnProcedi.disabled = false;
});
