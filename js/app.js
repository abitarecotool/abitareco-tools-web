// Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

// Riferimenti
const sideMenu = $('#SideMenu');
const welcomeCard = $('#WelcomeCard');
const uploadCard = $('#UploadCard');
const slugCard = $('#SlugCard');
const bvCard = $('#BusinessCardCard');
const qrCard = $('#QrCard');
const iubCard = $('#IubendaCard');
const videoCard = $('#VideoCard');

const progress = $('#MainProgress');
const progressLabel = $('#ProgressLabel');
const btnProcedi = $('#BtnProcedi');

const dropArea = $('#DropArea');
const txtFolderPath = $('#TxtFolderPath');
const btnClearPath = $('#BtnClearPath');

// BV
const btnBV_AbitareCo = $('#BtnBV_AbitareCo');
const btnBV_Commercial = $('#BtnBV_Commercial');
const btnBV_Riabitareco = $('#BtnBV_Riabitareco');
const bvForm = $('#BvForm');
const chkBvRea = $('#ChkBvRea');
const reaField = $('#ReaField');

// Stato
let selectedBV = '';

// Navigazione
const ALL_CARDS = [welcomeCard, uploadCard, slugCard, bvCard, qrCard, iubCard, videoCard];

function selectMenu(index) {
  ALL_CARDS.forEach(hide);
  show(uploadCard);
  show(btnProcedi);

  if (index === 0 || index === 1) show(slugCard); else hide(slugCard);

  if (index === 5) { show(videoCard); hide(slugCard); } else hide(videoCard);

  if (index === 7) {
    hide(uploadCard); hide(slugCard); hide(qrCard); hide(iubCard); hide(videoCard);
    show(bvCard);
    selectedBV = '';
    [btnBV_AbitareCo, btnBV_Commercial, btnBV_Riabitareco].forEach(b => b.classList.remove('is-selected'));
    hide(bvForm); hide(reaField); if (chkBvRea) chkBvRea.checked = false;
  }

  if (index === 8) { hide(uploadCard); hide(slugCard); hide(bvCard); hide(iubCard); hide(videoCard); show(qrCard); }
  if (index === 9) { hide(uploadCard); hide(slugCard); hide(bvCard); hide(qrCard); hide(videoCard); show(iubCard); }

  $$('#SideMenu li').forEach(li => li.classList.remove('active'));
  const active = $(`#SideMenu li[data-index="${index}"]`);
  if (active) active.classList.add('active');
}

// default
selectMenu(-1);
show(welcomeCard);
hide(btnProcedi);

// Click menu
sideMenu.addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  const idx = parseInt(li.dataset.index, 10);
  selectMenu(idx);
  if (idx >= 0) { hide(welcomeCard); show(btnProcedi); }
});

// Drag&Drop (UI)
['dragenter','dragover'].forEach(ev => {
  dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add('focus'); });
});
['dragleave','drop'].forEach(ev => {
  dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove('focus'); });
});
dropArea.addEventListener('drop', (e) => {
  const items = e.dataTransfer?.items ?? [];
  if (items.length) { txtFolderPath.textContent = 'Cartella selezionata (simulazione UI)…'; btnClearPath.classList.remove('hidden'); }
});
btnClearPath.addEventListener('click', () => { txtFolderPath.textContent = 'Trascina qui la cartella...'; btnClearPath.classList.add('hidden'); });

// BV brand pills
function selectBV(brand){
  selectedBV = brand;
  [btnBV_AbitareCo, btnBV_Commercial, btnBV_Riabitareco].forEach(b => b.classList.remove('is-selected'));
  if (brand === 'abitareco') btnBV_AbitareCo.classList.add('is-selected');
  if (brand === 'commercial') btnBV_Commercial.classList.add('is-selected');
  if (brand === 'riabitareco') btnBV_Riabitareco.classList.add('is-selected');
  show(bvForm);
  if (brand === 'abitareco') { show(chkBvRea.closest('.checkline')); }
  else { hide(reaField); if (chkBvRea) chkBvRea.checked = false; }
}
btnBV_AbitareCo?.addEventListener('click', () => selectBV('abitareco'));
btnBV_Commercial?.addEventListener('click', () => selectBV('commercial'));
btnBV_Riabitareco?.addEventListener('click', () => selectBV('riabitareco'));
chkBvRea?.addEventListener('change', () => (chkBvRea.checked ? show(reaField) : hide(reaField)));

// Iubenda EN panel
const chkIubEnableEn = $('#ChkIubEnableEn');
const iubEnPanel = $('#IubEnPanel');
chkIubEnableEn?.addEventListener('change', () => (chkIubEnableEn.checked ? show(iubEnPanel) : hide(iubEnPanel)));

// “Esporta ora” (placeholder)
btnProcedi.addEventListener('click', () => {
  progress.value = 30;
  progressLabel.classList.remove('hidden');
  progress.classList.remove('hidden');
  const t = setInterval(() => {
    progress.value = Math.min(100, progress.value + 10);
    if (progress.value >= 100) {
      clearInterval(t);
      setTimeout(() => {
        progress.value = 0;
        progressLabel.classList.add('hidden');
        progress.classList.add('hidden');
      }, 400);
    }
  }, 120);
});
