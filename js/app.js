/* Abitare Co. Tool bootstrap (classic scripts)
   Entry point leggero: registra la PWA solo se supportata, senza toccare i moduli. */
(function(){
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js?v=20260525_sw1', { scope: './' });
    } catch (err) {
      console.warn('Service Worker non registrato:', err);
    }
  });
})();
