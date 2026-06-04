/* Abitare Co. Tool bootstrap (classic scripts)
   Entry point leggero: registra la PWA solo se supportata.
   Slide Builder viene caricato in modo non invasivo e solo come modulo separato. */
(function(){
  'use strict';

  function loadCssOnce(href){
    if (!href) return;
    const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => (l.getAttribute('href') || '').includes(href));
    if (exists) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScriptOnce(src){
    return new Promise((resolve, reject) => {
      if (!src) return resolve();
      const exists = Array.from(document.querySelectorAll('script')).some(s => (s.getAttribute('src') || '').includes(src));
      if (exists) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = err => reject(err);
      document.body.appendChild(script);
    });
  }

  async function bootSlideBuilder(){
    try {
      loadCssOnce('./css/modules/slidebuilder.css?v=20260529_sb3');
      await loadScriptOnce('https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs/dist/pptxgen.bundle.js');
      await loadScriptOnce('./js/modules/slidebuilder.js?v=20260529_sb3');
    } catch (err) {
      console.warn('Slide Builder non caricato:', err);
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js?v=20260525_sw1', { scope: './' });
      } catch (err) {
        console.warn('Service Worker non registrato:', err);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootSlideBuilder);
  else bootSlideBuilder();
})();
