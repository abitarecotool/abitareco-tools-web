"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const showEl = (el) => el && el.classList.remove('hidden');
const hideEl = (el) => el && el.classList.add('hidden');

let picked = [];
let currentMode = 'welcome';

// Inizializzazione PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

/* --- Navigazione --- */
$('#SideMenu').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    currentMode = li.dataset.mode;
    $$('#SideMenu li').forEach(el => el.classList.remove('active'));
    li.classList.add('active');
    
    $$('.card').forEach(hideEl);
    showEl($('#UploadCard'));
    showEl($('#BtnProcedi'));

    if (currentMode === 'images') { showEl($('#SlugCard')); showEl($('#FormatCard')); }
    if (currentMode === 'watermark') showEl($('#WatermarkCard'));
    if (currentMode === 'digitaltool') { /* Solo upload */ }
});

/* --- Gestione Drag & Drop Fixato --- */
const DropArea = $('#DropArea');
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    DropArea.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); });
});

DropArea.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
});

DropArea.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.onchange = () => handleFiles(input.files);
    input.click();
});

function handleFiles(files) {
    picked = Array.from(files);
    $('#TxtFolderPath').textContent = `Selezionati ${picked.length} file`;
    showEl($('#BtnClearPath'));
}

/* --- Funzione Watermark (Immagini + PDF) --- */
async function exportWatermark() {
    if (!picked.length) return alert("Carica i file.");
    const logoFile = $('#InpWatermarkLogo').files[0];
    if (!logoFile) return alert("Carica il logo.");

    const zip = new JSZip();
    const logoImg = await loadImage(logoFile);
    showEl($('#ActionProgressWrap'));

    for (let i = 0; i < picked.length; i++) {
        const file = picked[i];
        let source;

        if (file.type === "application/pdf") {
            source = await renderPdfPage(file);
        } else {
            source = await loadImage(file);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 768;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = "white"; ctx.fillRect(0,0,1024,768);

        // Resize cover
        const ratio = Math.max(1024 / source.width, 768 / source.height);
        const w = source.width * ratio, h = source.height * ratio;
        ctx.drawImage(source, (1024-w)/2, (768-h)/2, w, h);
        
        // Logo center
        ctx.drawImage(logoImg, (1024 - logoImg.width)/2, (768 - logoImg.height)/2);

        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
        zip.file(`immagini-${(i+1).toString().padStart(2,'0')}.jpg`, blob);
        
        $('#ActionProgress').value = ((i+1)/picked.length)*100;
    }

    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, "Watermark_Export.zip");
    hideEl($('#ActionProgressWrap'));
    // Niente alert, download automatico eseguito.
}

/* --- Helpers --- */
async function loadImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = URL.createObjectURL(file);
    });
}

async function renderPdfPage(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
}

$('#BtnProcedi').addEventListener('click', async () => {
    if (currentMode === 'watermark') await exportWatermark();
    else alert("Funzione in fase di implementazione");
});
