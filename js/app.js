// ============================================================
// Abitare Co. – Digital Content Tool (Web)
// app.js — Logica completa (10 modalità)
// Porta 1:1 la logica da AbitareCoTool.ps1 + AbitareCo.Core.psm1
// ============================================================

"use strict";

// ─── Stato globale ───────────────────────────────────────────
const State = {
  mode: null,           // stringa: "images-sito", "images-share", "digitaltool", ...
  files: [],            // FileList / File[] caricati
  folderName: "",       // nome cartella origine
  folderMap: {},        // mappa ITA→ENG da folder_map.csv
  bvBrand: null,        // "abitareco" | "commercial" | "riabitareco"
};

// ─── Slug (identico alla funzione PS) ────────────────────────
function slug(t) {
  if (!t) return "";
  t = t.toLowerCase();
  t = t.replace(/[àáâãäå]/g, "a");
  t = t.replace(/[èéêë]/g, "e");
  t = t.replace(/[ìíîï]/g, "i");
  t = t.replace(/[òóôõö]/g, "o");
  t = t.replace(/[ùúûü]/g, "u");
  t = t.replace(/ç/g, "c");
  t = t.replace(/ñ/g, "n");
  t = t.replace(/[''`]/g, "");
  t = t.replace(/[^a-z0-9]+/g, "-");
  return t.replace(/^-+|-+$/g, "");
}

function appendOnce(base, suffix) {
  const b = slug(base), s = slug(suffix);
  if (!s) return b;
  if (new RegExp("(^|-)" + escReg(s) + "$").test(b)) return b;
  return b + "-" + s;
}

function appendSlugFolderUnique(base, folder) {
  return appendOnce(base, folder);
}

function escReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── folder_map.csv loader ───────────────────────────────────
async function loadFolderMap(fileList) {
  const csvFile = Array.from(fileList).find(
    (f) => f.name.toLowerCase() === "folder_map.csv"
  );
  if (!csvFile) return {};
  const text = await csvFile.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return {};
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idxIta = headers.findIndex((h) => ["ita", "it"].includes(h));
  const idxEng = headers.findIndex((h) => ["eng", "en"].includes(h));
  if (idxIta < 0 || idxEng < 0) return {};
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const ita = (cols[idxIta] || "").trim().toLowerCase();
    const eng = (cols[idxEng] || "").trim();
    if (ita && eng) map[ita] = eng;
  }
  return map;
}

// ─── Image utils via Canvas ───────────────────────────────────
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function imageToCanvas(img, targetW, targetH, mode = "cover") {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  if (mode === "cover") {
    // crop centrato
    const srcRatio = img.width / img.height;
    const dstRatio = targetW / targetH;
    let sx, sy, sw, sh;
    if (srcRatio > dstRatio) {
      sh = img.height;
      sw = Math.round(img.height * dstRatio);
      sy = 0;
      sx = Math.round((img.width - sw) / 2);
    } else {
      sw = img.width;
      sh = Math.round(img.width / dstRatio);
      sx = 0;
      sy = Math.round((img.height - sh) / 2);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  } else {
    // fit
    const scale = Math.min(targetW / img.width, targetH / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const x = Math.round((targetW - w) / 2);
    const y = Math.round((targetH - h) / 2);
    ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
  }
  return canvas;
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.85) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Webp → canvas→blob con quality target (recompression)
async function recompressToTarget(blob, maxBytes, type) {
  if (blob.size <= maxBytes) return blob;
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = url; });
  URL.revokeObjectURL(url);
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  for (const q of [0.75, 0.65, 0.50, 0.40]) {
    const b = await canvasToBlob(canvas, type, q);
    if (b.size <= maxBytes) return b;
  }
  return blob;
}

// ─── Compute dimensions (come il PSM per mod 0) ───────────────
function computeSitoDimensions(w, h) {
  const ratio = w / h;
  const square = Math.abs(ratio - 1) <= 0.03;
  if (square)    return { tw: 1080, th: 1080, mode: "cover" };
  if (w >= h)    return { tw: 1920, th: 1080, mode: "cover" };
  return { tw: Math.round(h === 1080 ? w : (w * 1080 / h)), th: 1080, mode: "fit" };
}

// ─── Immagini per modalità ────────────────────────────────────
function isImage(f) {
  return /\.(jpe?g|png|tiff?)$/i.test(f.name);
}
function isPdf(f) {
  return /\.pdf$/i.test(f.name);
}

// Raggruppamento per cartella virtuale (simula struttura directory)
function groupByFolder(files) {
  const groups = {};
  for (const f of files) {
    const parts = (f.webkitRelativePath || f.name).split("/");
    const folder = parts.length > 2 ? parts[parts.length - 2] : "__root__";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(f);
  }
  return groups;
}

// ─── ZIP helper ──────────────────────────────────────────────
function downloadZip(zip, filename) {
  return zip.generateAsync({ type: "blob" }).then((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ─── Progress helpers ────────────────────────────────────────
function showProgress(msg = "Esportazione in corso...") {
  const wrap = document.getElementById("ActionProgressWrap");
  const label = document.getElementById("ActionProgressLabel");
  const bar = document.getElementById("ActionProgress");
  if (wrap) wrap.classList.remove("hidden");
  if (label) label.textContent = msg;
  if (bar) bar.value = 0;
}

function updateProgress(pct, msg) {
  const label = document.getElementById("ActionProgressLabel");
  const bar = document.getElementById("ActionProgress");
  if (bar) bar.value = Math.min(100, Math.max(0, pct));
  if (msg && label) label.textContent = msg;
}

function hideProgress() {
  const wrap = document.getElementById("ActionProgressWrap");
  const bar = document.getElementById("ActionProgress");
  if (wrap) wrap.classList.add("hidden");
  if (bar) bar.value = 0;
}

function setButtonBusy(busy) {
  const btn = document.getElementById("BtnProcedi");
  if (btn) btn.disabled = busy;
}

function showAlert(msg, title = "Info") {
  // toast elegante
  const toast = document.createElement("div");
  toast.className = "toast" + (title === "Errore" ? " toast-error" : " toast-ok");
  toast.innerHTML = `<strong>${title}</strong><span>${msg}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ─── Validazione campi ───────────────────────────────────────
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
function chk(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

// ============================================================
// MODALITÀ 0 — IMMAGINI SITO
// ============================================================
async function runImmaginiSito() {
  const slugIta = slug(val("TxtSlugIta"));
  const slugEng = slug(val("TxtSlugEng"));
  if (!slugIta || !slugEng) { showAlert("Inserisci entrambi gli slug.", "Errore"); return; }
  if (!State.files.length) { showAlert("Seleziona una cartella con immagini.", "Errore"); return; }

  const images = State.files.filter(isImage);
  if (!images.length) { showAlert("Nessuna immagine trovata nella cartella.", "Errore"); return; }

  const zip = new JSZip();
  const groups = groupByFolder(images);
  const total = images.length;
  let done = 0;

  showProgress("Elaborazione immagini sito...");

  // contatori per cartella
  const counters = {};

  for (const [folder, files] of Object.entries(groups)) {
    const isRoot = folder === "__root__";
    const leafIta = isRoot ? "hero" : folder.toLowerCase();
    const leafEng = isRoot ? "hero" : (State.folderMap[leafIta] || leafIta);
    const slugFolderIta = isRoot ? "hero" : slug(leafIta);
    const slugFolderEng = isRoot ? "hero" : slug(leafEng);

    const multi = files.length > 1;
    if (!counters[folder]) counters[folder] = 0;

    for (const f of files) {
      counters[folder]++;
      const suffix = multi ? "-" + String(counters[folder]).padStart(2, "0") : "";
      const baseIta = appendSlugFolderUnique(slugIta, slugFolderIta);
      const baseEng = appendSlugFolderUnique(slugEng, slugFolderEng);
      const outIta = baseIta + suffix;
      const outEng = baseEng + suffix;

      const img = await loadImage(f);
      const { tw, th, mode } = computeSitoDimensions(img.width, img.height);
      const canvas = imageToCanvas(img, tw, th, mode);

      const jpgBlob  = await canvasToBlob(canvas, "image/jpeg", 0.85);
      const webpBlob = await canvasToBlob(canvas, "image/webp", 0.85);

      zip.file(`ITA/JPG/${outIta}.jpg`,   jpgBlob);
      zip.file(`ITA/WEBP/${outIta}.webp`, webpBlob);
      zip.file(`ENG/JPG/${outEng}.jpg`,   jpgBlob);
      zip.file(`ENG/WEBP/${outEng}.webp`, webpBlob);

      done++;
      updateProgress(Math.round((done / total) * 100), `Elaborazione ${done}/${total}...`);
    }
  }

  updateProgress(100, "Creazione ZIP...");
  await downloadZip(zip, `${slugIta}_EXPORT_SITO.zip`);
  hideProgress();
  showAlert("Export completato! Il file ZIP è stato scaricato.", "Fatto");
}

// ============================================================
// MODALITÀ 1 — IMMAGINI SHARE
// ============================================================
async function runImmaginiShare() {
  const slugIta = slug(val("TxtSlugIta"));
  const slugEng = slug(val("TxtSlugEng"));
  if (!slugIta || !slugEng) { showAlert("Inserisci entrambi gli slug.", "Errore"); return; }
  if (!State.files.length) { showAlert("Seleziona una cartella con immagini.", "Errore"); return; }

  const images = State.files.filter(isImage);
  if (!images.length) { showAlert("Nessuna immagine trovata.", "Errore"); return; }

  const zip = new JSZip();
  const groups = groupByFolder(images);
  const total = images.length;
  let done = 0;
  const counters = {};

  showProgress("Elaborazione immagini share...");

  for (const [folder, files] of Object.entries(groups)) {
    const multi = files.length > 1;
    if (!counters[folder]) counters[folder] = 0;

    for (const f of files) {
      counters[folder]++;
      const suffix = multi ? "-" + String(counters[folder]).padStart(2, "0") : "";

      // Share: aggiunge "-share" una sola volta, ignora cartella
      const baseIta = appendOnce(slugIta, "share");
      const baseEng = appendOnce(slugEng, "share");
      const outIta = baseIta + suffix;
      const outEng = baseEng + suffix;

      const img = await loadImage(f);
      const canvas = imageToCanvas(img, 1200, 630, "cover");

      const jpgBlob  = await canvasToBlob(canvas, "image/jpeg", 0.85);
      const webpBlob = await canvasToBlob(canvas, "image/webp", 0.85);

      zip.file(`ITA/JPG/${outIta}.jpg`,   jpgBlob);
      zip.file(`ITA/WEBP/${outIta}.webp`, webpBlob);
      zip.file(`ENG/JPG/${outEng}.jpg`,   jpgBlob);
      zip.file(`ENG/WEBP/${outEng}.webp`, webpBlob);

      done++;
      updateProgress(Math.round((done / total) * 100), `Elaborazione ${done}/${total}...`);
    }
  }

  updateProgress(100, "Creazione ZIP...");
  await downloadZip(zip, `${slugIta}_EXPORT_SHARE.zip`);
  hideProgress();
  showAlert("Export completato! Il file ZIP è stato scaricato.", "Fatto");
}

// ============================================================
// MODALITÀ 2 — DIGITAL TOOL
// ============================================================
async function runDigitalTool() {
  if (!State.files.length) { showAlert("Seleziona una cartella con immagini.", "Errore"); return; }

  const images = State.files.filter(isImage);
  if (!images.length) { showAlert("Nessuna immagine trovata.", "Errore"); return; }

  const zip = new JSZip();
  const groups = groupByFolder(images);
  const total = images.length;
  let done = 0;
  const counters = {};

  showProgress("DigitalTool in corso...");
  const MAX = 450 * 1024; // 450KB

  for (const [folder, files] of Object.entries(groups)) {
    const folderSlug = folder === "__root__" ? "img" : slug(folder);
    if (!counters[folderSlug]) counters[folderSlug] = 0;

    for (const f of files) {
      counters[folderSlug]++;
      const nn = String(counters[folderSlug]).padStart(2, "0");
      const outBase = `${folder === "__root__" ? "" : folder + "/"}${folderSlug}-${nn}`;

      const img = await loadImage(f);
      const ratio = img.width / img.height;
      const square = Math.abs(ratio - 1) <= 0.03;

      let tw, th, mode;
      if (square)         { tw = 2500; th = 2500; mode = "cover"; }
      else if (img.width >= img.height) { tw = 2500; th = Math.round(2500 / ratio); mode = "fit-w"; }
      else                { tw = Math.round(2000 * ratio); th = 2000; mode = "fit-h"; }

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tw, th);

      if (square) {
        // cover 2500x2500
        const c = imageToCanvas(img, 2500, 2500, "cover");
        ctx.drawImage(c, 0, 0);
      } else {
        ctx.drawImage(img, 0, 0, tw, th);
      }

      let jpgBlob  = await canvasToBlob(canvas, "image/jpeg", 0.85);
      let webpBlob = await canvasToBlob(canvas, "image/webp", 0.85);

      jpgBlob  = await recompressToTarget(jpgBlob,  MAX, "image/jpeg");
      webpBlob = await recompressToTarget(webpBlob, MAX, "image/webp");

      zip.file(`${outBase}.jpg`,  jpgBlob);
      zip.file(`${outBase}.webp`, webpBlob);

      done++;
      updateProgress(Math.round((done / total) * 100), `DigitalTool ${done}/${total}...`);
    }
  }

  updateProgress(100, "Creazione ZIP...");
  await downloadZip(zip, `${State.folderName || "cartella"}_DIGITALTOOL.zip`);
  hideProgress();
  showAlert("DigitalTool completato! ZIP scaricato.", "Fatto");
}

// ============================================================
// MODALITÀ 3 — PDF → JPG
// (Usa PDF.js caricato lazy)
// ============================================================
async function runPdfToJpg() {
  if (!State.files.length) { showAlert("Seleziona una cartella con file PDF.", "Errore"); return; }

  const pdfs = State.files.filter(isPdf);
  if (!pdfs.length) { showAlert("Nessun file PDF trovato.", "Errore"); return; }

  // Lazy load PDF.js
  if (!window.pdfjsLib) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs", true);
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
  }

  const zip = new JSZip();
  const total = pdfs.length;
  let done = 0;
  const TARGET = 1.5 * 1024 * 1024; // 1.5MB

  showProgress("Conversione PDF → JPG...");

  for (const f of pdfs) {
    const base = f.name.replace(/\.pdf$/i, "");
    const folder = (() => {
      const parts = (f.webkitRelativePath || f.name).split("/");
      return parts.length > 2 ? parts[parts.length - 2] : "";
    })();
    const prefix = folder ? folder + "/" : "";

    const ab = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const numPages = pdf.numPages;

    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 300 / 72 }); // ~300dpi
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const suffix = numPages > 1 ? `-${String(p).padStart(2, "0")}` : "";
      let blob = await canvasToBlob(canvas, "image/jpeg", 0.95);

      // ricompressione target 1.5MB
      if (blob.size > TARGET) {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((r) => { img.onload = r; img.src = url; });
        URL.revokeObjectURL(url);
        const c2 = document.createElement("canvas");
        c2.width = img.width; c2.height = img.height;
        c2.getContext("2d").drawImage(img, 0, 0);
        for (const q of [0.90, 0.85, 0.80, 0.75]) {
          blob = await canvasToBlob(c2, "image/jpeg", q);
          if (blob.size <= TARGET) break;
        }
      }

      zip.file(`${prefix}${base}${suffix}.jpg`, blob);
    }

    done++;
    updateProgress(Math.round((done / total) * 100), `PDF ${done}/${total}...`);
  }

  updateProgress(100, "Creazione ZIP...");
  await downloadZip(zip, `${State.folderName || "cartella"}_EXPORT_PDF2JPG.zip`);
  hideProgress();
  showAlert("Conversione completata! ZIP scaricato.", "Fatto");
}

function loadScript(src, isModule = false) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    if (isModule) s.type = "module";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ============================================================
// MODALITÀ 4 — RENAME
// ============================================================
async function runRename() {
  if (!State.files.length) { showAlert("Seleziona una cartella con file.", "Errore"); return; }

  const supported = State.files.filter((f) =>
    /\.(jpe?g|png|tiff?|webp)$/i.test(f.name)
  );
  if (!supported.length) { showAlert("Nessun file immagine trovato.", "Errore"); return; }

  // modale selezione modalità
  const choice = await showRenameModal();
  if (choice === null) return; // annullato

  const zip = new JSZip();
  const sorted = [...supported].sort((a, b) =>
    (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name)
  );

  showProgress("Rename in corso...");

  if (choice.mode === "numbers") {
    sorted.forEach((f, i) => {
      const ext = f.name.split(".").pop();
      zip.file(`${String(i + 1).padStart(2, "0")}.${ext}`, f);
    });
  } else {
    const base = choice.base ? slug(choice.base) : "file";
    sorted.forEach((f, i) => {
      const ext = f.name.split(".").pop();
      zip.file(`${base}-${String(i + 1).padStart(2, "0")}.${ext}`, f);
    });
  }

  updateProgress(100, "Creazione ZIP...");
  await downloadZip(zip, `${State.folderName || "cartella"}_RENAME.zip`);
  hideProgress();
  showAlert("Rename completato! ZIP scaricato.", "Fatto");
}

function showRenameModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <h3>Modalità Rename</h3>
        <p>Scegli come rinominare i file:</p>
        <div class="modal-options">
          <label class="modal-radio">
            <input type="radio" name="rmode" value="numbers" checked>
            <span>Solo numeri <em>(01, 02, ...)</em></span>
          </label>
          <label class="modal-radio">
            <input type="radio" name="rmode" value="base">
            <span>Nome base + numeri</span>
          </label>
        </div>
        <div id="BaseNameWrap" class="hidden" style="margin-top:12px;">
          <label style="font-size:13px;font-weight:600;">Nome base</label>
          <input id="RenameBase" type="text" class="input" placeholder="es. immobile-roma" style="margin-top:6px;"/>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" id="BtnRenameCancel">Annulla</button>
          <button class="btn-primary" id="BtnRenameOk">Procedi</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('input[name="rmode"]').forEach((r) => {
      r.addEventListener("change", () => {
        document.getElementById("BaseNameWrap").classList.toggle(
          "hidden", r.value !== "base"
        );
      });
    });

    document.getElementById("BtnRenameCancel").onclick = () => {
      overlay.remove(); resolve(null);
    };
    document.getElementById("BtnRenameOk").onclick = () => {
      const mode = overlay.querySelector('input[name="rmode"]:checked').value;
      const base = document.getElementById("RenameBase")?.value.trim() || "";
      overlay.remove();
      resolve({ mode, base });
    };
  });
}

// ============================================================
// MODALITÀ 5 — VIDEO SLIDESHOW (placeholder desktop)
// ============================================================
function runVideoSlideshow() {
  showAlert(
    "Il Video Slideshow richiede FFmpeg e non è disponibile nella versione web.\n\nUsa la versione desktop per questa funzione.",
    "Funzione desktop"
  );
}

// ============================================================
// MODALITÀ 6 — WATERMARK PORTALI
// ============================================================
async function runWatermark() {
  if (!State.files.length) { showAlert("Seleziona una cartella.", "Errore"); return; }

  const images = State.files.filter(isImage);
  const pdfs   = State.files.filter(isPdf);
  const allFiles = [...images, ...pdfs];

  if (!allFiles.length) { showAlert("Nessun file immagine o PDF trovato.", "Errore"); return; }

  // Cerca il logo-watermark nella cartella
  const logoFile = State.files.find((f) =>
    f.name.toLowerCase().includes("logo-watermark") ||
    f.name.toLowerCase() === "logo.png"
  );

  showProgress("Applicazione watermark...");

  // Carica logo watermark (usa un placeholder se non trovato)
  let logoImg = null;
  if (logoFile) {
    logoImg = await loadImage(logoFile);
  }

  const zip = new JSZip();
  const total = images.length;
  let done = 0;
  let counter = 0;

  for (const f of images) {
    counter++;
    const nn = String(counter).padStart(2, "0");
    const img = await loadImage(f);

    // Resize 1024×768 centrato (come il PS)
    const canvas = imageToCanvas(img, 1024, 768, "cover");
    const ctx = canvas.getContext("2d");

    // Watermark centrato
    if (logoImg) {
      const maxW = Math.round(canvas.width * 0.4);
      const scale = Math.min(maxW / logoImg.width, 1);
      const lw = Math.round(logoImg.width * scale);
      const lh = Math.round(logoImg.height * scale);
      const lx = Math.round((canvas.width - lw) / 2);
      const ly = Math.round((canvas.height - lh) / 2);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(logoImg, lx, ly, lw, lh);
      ctx.globalAlpha = 1;
    }

    const blob = await canvasToBlob(canvas, "image/jpeg", 0.90);
    zip.file(`IMG/immagini-${nn}.jpg`, blob);

    done++;
    updateProgress(Math.round((done / total) * 100), `Watermark ${done}/${total}...`);
  }

  // PDF: prima pagina come JPG (senza watermark su PDF, come in PS)
  if (window.pdfjsLib) {
    for (const f of pdfs) {
      const base = f.name.replace(/\.pdf$/i, "");
      const ab = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 200 / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      // Resize a 1024x768 fit
      const canvas2 = imageToCanvas(
        { width: canvas.width, height: canvas.height, _canvas: canvas },
        1024, 768, "fit"
      );
      const blob = await canvasToBlob(canvas2, "image/jpeg", 0.90);
      zip.file(`PDF/${base}.jpg`, blob);
    }
  }

  updateProgress(100, "Creazione ZIP...");
  await downloadZip(zip, `${State.folderName || "cartella"}_WATERMARK.zip`);
  hideProgress();
  showAlert("Watermark completato! ZIP scaricato.", "Fatto");
}

// ============================================================
// MODALITÀ 7 — BIGLIETTO DA VISITA
// (Genera PDF client-side con jsPDF + template visuale)
// ============================================================
async function runBigliettoVisita() {
  if (!State.bvBrand) { showAlert("Seleziona prima un brand.", "Errore"); return; }

  const name  = val("TxtBVName");
  const job   = val("TxtBVJob");
  const phone = val("TxtBVPhone");
  const email = val("TxtBVEmail");

  if (!name || !job || !phone || !email) {
    showAlert("Compila tutti i campi obbligatori (*).", "Errore");
    return;
  }

  let reaCode = "";
  if (State.bvBrand === "abitareco" && chk("ChkBvRea")) {
    reaCode = val("TxtBVReaCode");
    if (!reaCode) { showAlert("Inserisci il codice REA.", "Errore"); return; }
  }

  showProgress("Generazione biglietto da visita...");

  // Lazy load jsPDF
  if (!window.jspdf) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }

  updateProgress(30, "Composizione biglietto...");

  const { jsPDF } = window.jspdf;

  // Biglietto standard 85×55mm (orizzontale)
  const doc = new jsPDF({ unit: "mm", format: [85, 55], orientation: "landscape" });

  const brands = {
    abitareco:   { bg: "#ffffff", accent: "#c4162b", brandName: "Abitare Co." },
    commercial:  { bg: "#1a1a2e", accent: "#c4162b", brandName: "Abitare Commercial" },
    riabitareco: { bg: "#f9fafb", accent: "#c4162b", brandName: "RiAbitare Co." },
  };
  const brand = brands[State.bvBrand];

  // Fronte
  doc.setFillColor(brand.bg === "#ffffff" ? 255 : brand.bg === "#1a1a2e" ? 26 : 249,
                   brand.bg === "#ffffff" ? 255 : brand.bg === "#1a1a2e" ? 26 : 250,
                   brand.bg === "#ffffff" ? 255 : brand.bg === "#1a1a2e" ? 46 : 251);
  doc.rect(0, 0, 85, 55, "F");

  // Banda rossa a sinistra
  doc.setFillColor(196, 22, 43);
  doc.rect(0, 0, 4, 55, "F");

  const textColor = brand.bg === "#1a1a2e" ? [255, 255, 255] : [17, 24, 39];

  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(name, 9, 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(196, 22, 43);
  doc.text(job, 9, 21);

  doc.setTextColor(...textColor);
  doc.setFontSize(7.5);
  doc.text(phone, 9, 32);
  doc.text(email, 9, 38);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(brand.brandName, 9, 50);

  if (reaCode) {
    doc.text(`REA: ${reaCode}`, 9, 44);
  }

  updateProgress(80, "Salvataggio PDF...");

  const safeName = slug(name) || "biglietto";
  const brandKey = State.bvBrand;
  const fileName = brandKey === "abitareco"
    ? `BV-${safeName}.pdf`
    : `BV-${brandKey}-${safeName}.pdf`;

  doc.save(fileName);

  hideProgress();
  showAlert("Biglietto da visita generato!", "Fatto");
}

// ============================================================
// MODALITÀ 8 — QR CODE
// ============================================================
function buildUtmUrl() {
  const urlBase  = val("TxtQrUrl");
  const source   = val("TxtQrSource");
  const medium   = val("TxtQrMedium");
  const campaign = val("TxtQrCampaign");
  const id       = val("TxtQrCampaignId");
  const term     = val("TxtQrTerm");
  const content  = val("TxtQrContent");

  if (!urlBase) return "";
  if (!/^https?:\/\//i.test(urlBase)) return "⚠️ L'URL deve iniziare con http:// o https://";
  if (!source || !medium || !campaign) return "Compila i campi obbligatori (*) per generare l'URL.";

  const params = new URLSearchParams();
  params.set("utm_source", source);
  params.set("utm_medium", medium);
  params.set("utm_campaign", campaign);
  if (id)      params.set("utm_id", id);
  if (term)    params.set("utm_term", term);
  if (content) params.set("utm_content", content);

  const sep = urlBase.includes("?") ? "&" : "?";
  return urlBase + sep + params.toString();
}

function updateQrPreview() {
  const el = document.getElementById("TxtQrPreview");
  if (el) el.textContent = buildUtmUrl() || "—";
}

async function runQrCode() {
  const finalUrl = buildUtmUrl();
  if (!finalUrl || finalUrl.startsWith("⚠️") || finalUrl.startsWith("Compila")) {
    showAlert("Compila URL, source, medium e campaign.", "Errore");
    return;
  }

  // Lazy load QRCode lib
  if (!window.QRCode) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js");
  }

  showProgress("Generazione QR Code...");
  updateProgress(20, "Generazione QR...");

  const tmpDiv = document.createElement("div");
  tmpDiv.style.display = "none";
  document.body.appendChild(tmpDiv);

  await new Promise((resolve) => {
    new QRCode(tmpDiv, {
      text: finalUrl,
      width: 1024,
      height: 1024,
      correctLevel: QRCode.CorrectLevel.M,
    });
    setTimeout(resolve, 500); // QRCode è sincrono ma lasciamo render
  });

  updateProgress(70, "Download file...");

  const canvas = tmpDiv.querySelector("canvas");
  const campaignSlug = slug(val("TxtQrCampaign")) || "qr";
  const stamp = new Date().toISOString().replace(/[:\-T]/g, "").slice(0, 15);

  // Scarica PNG
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `QR-${campaignSlug}-${stamp}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");

  // Scarica TXT con URL
  const txtBlob = new Blob([finalUrl], { type: "text/plain;charset=utf-8" });
  const a2 = document.createElement("a");
  a2.href = URL.createObjectURL(txtBlob);
  a2.download = `URL-${campaignSlug}-${stamp}.txt`;
  setTimeout(() => { a2.click(); URL.revokeObjectURL(a2.href); }, 300);

  tmpDiv.remove();
  updateProgress(100, "");
  hideProgress();
  showAlert("QR Code generato! PNG e TXT scaricati.", "Fatto");
}

// ============================================================
// MODALITÀ 9 — IUBENDA
// ============================================================
function buildIubendaSnippet(includeComments = false) {
  const widget  = val("TxtIubWidgetUrl");
  const siteId  = val("TxtIubSiteId");
  const cookieIt = val("TxtIubCookieIt");
  const enableEn = chk("ChkIubEnableEn");
  const cookieEn = val("TxtIubCookieEn");

  if (!widget || !siteId || !cookieIt) return "";
  if (enableEn && !cookieEn) return "";

  const callback = `callback: {
  onPreferenceExpressedOrNotNeeded: function (preference) {
    dataLayer.push({ iubenda_ccpa_opted_out: _iub.cs.api.isCcpaOptedOut() });
    dataLayer.push({ event: "cookie_consent_update" });
    if (!preference) {
      dataLayer.push({ event: "iubenda_preference_not_needed" });
    } else {
      if (preference.consent === true) {
        dataLayer.push({ event: "iubenda_consent_given" });
      } else if (preference.consent === false) {
        dataLayer.push({ event: "iubenda_consent_rejected" });
      } else if (preference.purposes) {
        for (var purposeId in preference.purposes) {
          if (preference.purposes[purposeId]) {
            dataLayer.push({ event: "iubenda_consent_given_purpose_" + purposeId });
          }
        }
      }
    }
  }
}`;

  if (!enableEn) {
    const head = includeComments ? "<!-- IUBENDA - IT -->\n" : "";
    return `${head}<script type="text/javascript">
  window.dataLayer = window.dataLayer || [];
  var _iub = _iub || [];

  _iub.csConfiguration = {
    siteId: ${siteId},
    cookiePolicyId: ${cookieIt},
    lang: "it",
    storage: { useSiteId: true },
    ${callback}
  };
</script>

${widget}</script>`;
  }

  const head = includeComments ? "<!-- IUBENDA - AUTO IT/EN (UNICO SCRIPT) -->\n" : "";
  return `${head}<script type="text/javascript">
  window.dataLayer = window.dataLayer || [];
  var _iub = _iub || [];

  var pageLang = (document.documentElement.getAttribute("lang") || "")
    .toLowerCase()
    .split("-")[0];

  if (!pageLang) {
    pageLang = (location.pathname.startsWith("/en") ? "en" : "it");
  }

  var cookiePolicyByLang = { it: ${cookieIt}, en: ${cookieEn} };
  if (!cookiePolicyByLang[pageLang]) pageLang = "it";

  _iub.csConfiguration = {
    siteId: ${siteId},
    cookiePolicyId: cookiePolicyByLang[pageLang],
    lang: pageLang,
    storage: { useSiteId: true },
    ${callback}
  };
</script>

${widget}</script>`;
}

function updateIubPreview() {
  const el = document.getElementById("TxtIubPreview");
  if (el) el.value = buildIubendaSnippet(false);
}

async function runIubenda() {
  const snippet = buildIubendaSnippet(true);
  if (!snippet) {
    showAlert("Compila Widget URL, siteId e cookiePolicyId IT.", "Errore");
    return;
  }

  showProgress("Generazione snippet iubenda...");
  updateProgress(50, "");

  const siteId = val("TxtIubSiteId").replace(/\D/g, "") || "site";
  const stamp  = new Date().toISOString().replace(/[:\-T]/g, "").slice(0, 15);
  const blob   = new Blob([snippet], { type: "text/plain;charset=utf-8" });
  const a      = document.createElement("a");
  a.href       = URL.createObjectURL(blob);
  a.download   = `IubendaSnippet-${siteId}-${stamp}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);

  updateProgress(100, "");
  hideProgress();
  showAlert("Snippet iubenda esportato! File .txt scaricato.", "Fatto");
}

// ============================================================
// UI — SIDEBAR + CARD SHOW/HIDE
// ============================================================
const MODES = [
  "images-sito",
  "images-share",
  "digitaltool",
  "pdf2jpg",
  "rename",
  "video",
  "watermark",
  "bv",
  "qr",
  "iubenda",
];

// Configurazione visibilità card per ogni modo
const CARD_CONFIG = {
  "images-sito":   { slug: true,  upload: true,  bv: false, qr: false, iub: false, video: false },
  "images-share":  { slug: true,  upload: true,  bv: false, qr: false, iub: false, video: false },
  "digitaltool":   { slug: false, upload: true,  bv: false, qr: false, iub: false, video: false },
  "pdf2jpg":       { slug: false, upload: true,  bv: false, qr: false, iub: false, video: false },
  "rename":        { slug: false, upload: true,  bv: false, qr: false, iub: false, video: false },
  "video":         { slug: false, upload: true,  bv: false, qr: false, iub: false, video: true  },
  "watermark":     { slug: false, upload: true,  bv: false, qr: false, iub: false, video: false },
  "bv":            { slug: false, upload: false, bv: true,  qr: false, iub: false, video: false },
  "qr":            { slug: false, upload: false, bv: false, qr: true,  iub: false, video: false },
  "iubenda":       { slug: false, upload: false, bv: false, qr: false, iub: true,  video: false },
};

function show(id) { document.getElementById(id)?.classList.remove("hidden"); }
function hide(id) { document.getElementById(id)?.classList.add("hidden"); }

function switchMode(mode) {
  State.mode = mode;
  const cfg = CARD_CONFIG[mode];

  // Welcome
  hide("WelcomeCard");

  // Cards
  cfg.slug   ? show("SlugCard")         : hide("SlugCard");
  cfg.upload ? show("UploadCard")       : hide("UploadCard");
  cfg.bv     ? show("BusinessCardCard") : hide("BusinessCardCard");
  cfg.qr     ? show("QrCard")           : hide("QrCard");
  cfg.iub    ? show("IubendaCard")      : hide("IubendaCard");
  cfg.video  ? show("VideoCard")        : hide("VideoCard");

  // Action bar sempre visibile
  show("ActionBar");
  show("BtnProcedi");

  // BV: reset stato brand
  if (mode === "bv") {
    State.bvBrand = null;
    document.querySelectorAll(".brand-pill").forEach((b) => b.classList.remove("active"));
    hide("BvForm");
    document.getElementById("ChkBvRea") && (document.getElementById("ChkBvRea").checked = false);
    hide("ReaField");
  }

  // QR: aggiorna preview
  if (mode === "qr") updateQrPreview();

  // Iubenda: aggiorna preview
  if (mode === "iubenda") updateIubPreview();

  // Video: messaggio info
  if (mode === "video") {
    const info = document.getElementById("VideoDesktopNote");
    if (info) info.classList.remove("hidden");
  }
}

// ─── Sidebar click ────────────────────────────────────────────
function initSidebar() {
  const menuItems = document.querySelectorAll("#SideMenu li");
  menuItems.forEach((li) => {
    li.addEventListener("click", () => {
      menuItems.forEach((x) => x.classList.remove("active"));
      li.classList.add("active");
      const mode = li.dataset.mode;
      if (mode) switchMode(mode);

      // Icone: swap normal/active
      const img = li.querySelector(".mi img");
      if (img) {
        menuItems.forEach((x) => {
          const i = x.querySelector(".mi img");
          if (i && x.dataset.icon) i.src = x.dataset.icon;
        });
        if (li.dataset.iconActive) img.src = li.dataset.iconActive;
      }
    });

    // Init icone default
    const img = li.querySelector(".mi img");
    if (img && li.dataset.icon) img.src = li.dataset.icon;
  });
}

// ─── Drag & Drop cartella ─────────────────────────────────────
function initDropArea() {
  const drop = document.getElementById("DropArea");
  const label = document.getElementById("TxtFolderPath");
  const clearBtn = document.getElementById("BtnClearPath");

  if (!drop) return;

  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    drop.classList.remove("drag-over");
    const items = e.dataTransfer.items;
    if (!items) return;
    const files = await readDroppedFolder(items);
    if (files.length) {
      State.files = files;
      const name = files[0]?.webkitRelativePath?.split("/")[0] || "Cartella selezionata";
      State.folderName = slug(name) || "export";
      if (label) label.textContent = name;
      if (clearBtn) clearBtn.classList.remove("hidden");
      // Carica folder_map.csv se presente
      State.folderMap = await loadFolderMap(files);
    }
  });

  // Click sul drop area: apri file input cartella
  drop.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files);
      if (!files.length) return;
      State.files = files;
      const name = files[0]?.webkitRelativePath?.split("/")[0] || "Cartella selezionata";
      State.folderName = slug(name) || "export";
      if (label) label.textContent = name;
      if (clearBtn) clearBtn.classList.remove("hidden");
      State.folderMap = await loadFolderMap(files);
    };
    input.click();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      State.files = [];
      State.folderName = "";
      State.folderMap = {};
      if (label) label.textContent = "Trascina qui la cartella...";
      clearBtn.classList.add("hidden");
    });
  }
}

async function readDroppedFolder(items) {
  const files = [];
  const traverse = async (entry) => {
    if (entry.isFile) {
      const file = await new Promise((r) => entry.file(r));
      // Aggiungi webkitRelativePath simulato
      Object.defineProperty(file, "webkitRelativePath", {
        value: entry.fullPath.replace(/^\//, ""),
        writable: false,
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise((r) => reader.readEntries(r));
      for (const e of entries) await traverse(e);
    }
  };
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await traverse(entry);
  }
  return files;
}

// ─── BV brand selection ───────────────────────────────────────
function initBvBrands() {
  document.querySelectorAll(".brand-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".brand-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      State.bvBrand = btn.dataset.brand;
      show("BvForm");

      const reaWrap = document.getElementById("ChkBvReaWrap");
      const reaField = document.getElementById("ReaField");
      const chkRea = document.getElementById("ChkBvRea");

      if (State.bvBrand === "abitareco") {
        reaWrap && reaWrap.classList.remove("hidden");
      } else {
        reaWrap && reaWrap.classList.add("hidden");
        if (chkRea) chkRea.checked = false;
        reaField && hide("ReaField");
      }
    });
  });

  const chkRea = document.getElementById("ChkBvRea");
  if (chkRea) {
    chkRea.addEventListener("change", () => {
      chkRea.checked ? show("ReaField") : hide("ReaField");
    });
  }
}

// ─── QR live preview ──────────────────────────────────────────
function initQrPreview() {
  const ids = ["TxtQrUrl","TxtQrCampaignId","TxtQrSource","TxtQrMedium","TxtQrCampaign","TxtQrTerm","TxtQrContent"];
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateQrPreview);
  });
}

// ─── Iubenda live preview ─────────────────────────────────────
function initIubPreview() {
  const ids = ["TxtIubWidgetUrl","TxtIubSiteId","TxtIubCookieIt","TxtIubCookieEn"];
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateIubPreview);
  });

  const chkEn = document.getElementById("ChkIubEnableEn");
  if (chkEn) {
    chkEn.addEventListener("change", () => {
      chkEn.checked ? show("IubEnPanel") : hide("IubEnPanel");
      if (!chkEn.checked) {
        const el = document.getElementById("TxtIubCookieEn");
        if (el) el.value = "";
      }
      updateIubPreview();
    });
  }

  document.getElementById("BtnIubCopy")?.addEventListener("click", () => {
    const txt = document.getElementById("TxtIubPreview")?.value;
    if (!txt?.trim()) { showAlert("Non c'è codice da copiare. Compila i campi.", "Info"); return; }
    navigator.clipboard.writeText(txt).then(() => showAlert("Codice copiato negli appunti.", "Fatto"));
  });
}

// ─── Immagini: selezione formato ─────────────────────────────
function initFormatCard() {
  document.querySelectorAll('input[name="fmtSite"]').forEach((r) => {
    r.addEventListener("change", () => {
      const customRow = document.getElementById("CustomSizeRow");
      if (r.value === "custom" && r.checked) {
        customRow?.classList.remove("hidden");
      } else if (r.checked) {
        customRow?.classList.add("hidden");
      }
    });
  });
}

// ─── Video: nota desktop-only ────────────────────────────────
// (gestita inline nell'HTML)

// ─── ESPORTA ORA (dispatcher) ────────────────────────────────
async function onExport() {
  if (!State.mode) {
    showAlert("Per iniziare, seleziona una modalità dal menu laterale.", "Info");
    return;
  }

  try {
    setButtonBusy(true);
    hideProgress();

    switch (State.mode) {
      case "images-sito":  await runImmaginiSito();   break;
      case "images-share": await runImmaginiShare();  break;
      case "digitaltool":  await runDigitalTool();    break;
      case "pdf2jpg":      await runPdfToJpg();       break;
      case "rename":       await runRename();         break;
      case "video":              runVideoSlideshow(); break;
      case "watermark":    await runWatermark();      break;
      case "bv":           await runBigliettoVisita();break;
      case "qr":           await runQrCode();         break;
      case "iubenda":      await runIubenda();        break;
      default:
        showAlert("Modalità non riconosciuta.", "Errore");
    }
  } catch (err) {
    console.error(err);
    showAlert("Errore: " + err.message, "Errore");
    hideProgress();
  } finally {
    setButtonBusy(false);
  }
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initDropArea();
  initBvBrands();
  initQrPreview();
  initIubPreview();
  initFormatCard();

  document.getElementById("BtnProcedi")?.addEventListener("click", onExport);

  // Welcome
  const name = "Ciao!";
  const title = document.getElementById("WelcomeTitle");
  if (title) title.textContent = "Welcome!";
});
