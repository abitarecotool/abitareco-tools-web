/* ------------------------------ PPT: download & fonts ----------------- */
window.downloadPPT = (href) => { const a = document.createElement('a'); a.href = href; a.download = href.split('/').pop(); a.click(); };

// ZIP solo dai font PPT (evita i font BV)
const FONTS_LIST = [
  'Manrope-Bold.ttf','Manrope-ExtraBold.ttf','Manrope-ExtraLight.ttf','Manrope-Light.ttf',
  'Manrope-Medium.ttf','Manrope-Regular.ttf','Manrope-SemiBold.ttf',
  'PPPangaia-Bold.otf','PPPangaia-BoldItalic.otf',
  'PPPangaia-Medium.otf','PPPangaia-MediumItalic.otf',
  'PPPangaia-Semibold.otf','PPPangaia-SemiboldItalic.otf',
  'PPPangaia-Ultralight.otf','PPPangaia-UltralightItalic.otf'
];
async function downloadFontsZip(){
  const base = 'assets/fonts/ppt/';
  const zip = new JSZip();
  let added = 0;
  for (const name of FONTS_LIST){
    try {
      const res = await fetch(base + name, { cache:'no-store' });
      if (!res.ok) continue;
      const blob = await res.blob();
      zip.file(name, blob);
      added++;
    } catch {}
  }
  if (!added){ alert('Nessun file font trovato in /assets/fonts/ppt/.'); return; }
  const out = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = 'abitareco-fonts.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}
$('#BtnFontsZip')?.addEventListener('click', downloadFontsZip);// JavaScript Document