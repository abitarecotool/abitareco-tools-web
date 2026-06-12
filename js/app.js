/* Abitare Co. Tool bootstrap (classic scripts)
   Entry point leggero: registra la PWA solo se supportata.
   Slide Builder viene caricato staticamente da index.html per evitare doppi caricamenti. */
(function(){
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async function(){
      try {
        await navigator.serviceWorker.register('./sw.js?v=20260612_sw2', { scope: './' });
      } catch (err) {
        console.warn('Service Worker non registrato:', err);
      }
    });
  }
})();
