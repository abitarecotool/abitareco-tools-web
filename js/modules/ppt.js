
/* ------------------------------ PPT: download & fonts ----------------- */

// Download PPT helper
window.downloadPPT = (href) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = href.split('/').pop();
  a.click();
};

// ZIP solo dai font PPT (evita i font BV)
// Include: Manrope + PPPangaia + Circular Std
const FONTS_LIST = [
  // Circular Std (OTF)
  'CircularStd-Black.otf',
  'CircularStd-BlackItalic.otf',
  'CircularStd-Bold.otf',
  'CircularStd-BoldItalic.otf',
  'CircularStd-Book.otf',
  'CircularStd-BookItalic.otf',
  'CircularStd-Light.otf',
  'CircularStd-LightItalic.otf',
  'CircularStd-Medium.otf',
  'CircularStd-MediumItalic.otf',

  // Manrope (TTF)
  'Manrope-Bold.ttf',
  'Manrope-ExtraBold.ttf',
  'Manrope-ExtraLight.ttf',
  'Manrope-Light.ttf',
  'Manrope-Medium.ttf',
  'Manrope-Regular.ttf',
  'Manrope-SemiBold.ttf',

  // PPPangaia (OTF)
  'PPPangaia-Bold.otf',
  'PPPangaia-BoldItalic.otf',
  'PPPangaia-Medium.otf',
  'PPPangaia-MediumItalic.otf',
  'PPPangaia-Semibold.otf',
  'PPPangaia-SemiboldItalic.otf',
  'PPPangaia-Ultralight.otf',
  'PPPangaia-UltralightItalic.otf'
];

async function downloadFontsZip() {
  const base = 'assets/fonts/ppt/';
  const zip = new JSZip();
  let added = 0;
  const missing = [];

  for (const name of FONTS_LIST) {
    try {
      const res = await fetch(base + name, { cache: 'no-store' });
      if (!res.ok) {
        missing.push(name);
        continue;
      }
      const blob = await res.blob();
      zip.file(name, blob);
      added++;
    } catch {
      missing.push(name);
    }
  }

  if (!added) {
    alert('Nessun file font trovato in /assets/fonts/ppt/. Verifica che i file siano presenti e che i nomi corrispondano.');
    return;
  }

  const out = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = 'abitareco-fonts-ppt.zip';
  a.click();
  URL.revokeObjectURL(a.href);

  // opzionale: se vuoi sapere se manca qualcosa, decommenta:
  // if (missing.length) console.warn('Font mancanti:', missing);
}

document.getElementById('BtnFontsZip')?.addEventListener('click', downloadFontsZip);
