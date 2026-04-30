/* js/modules/bv_3d.js */
// Mockup 3D (solo BV) senza OrbitControls: controlli custom (drag rotate + wheel/pinch zoom)

(function(){
  'use strict';

  // Singleton guard
  if (window.__BV3D_INITED) return;
  window.__BV3D_INITED = true;

  const wrap = document.getElementById('Bv3DWrap');
  const canvas = document.getElementById('Bv3DCanvas');
  const spinner = document.getElementById('Bv3DSpinner');
  const placeholder = document.getElementById('Bv3DPlaceholder');

  const btnFront = document.getElementById('Bv3DFront');
  const btnBack  = document.getElementById('Bv3DBack');
  const btnZoomIn = document.getElementById('Bv3DZoomIn');
  const btnZoomOut = document.getElementById('Bv3DZoomOut');
  const btnReset = document.getElementById('Bv3DReset');
  const chkAuto = document.getElementById('Bv3DAuto');

  if (!wrap || !canvas) return;

  // Auto-rotate OFF by default
  if (chkAuto) chkAuto.checked = false;

  function showSpinner(on){
    if (!spinner) return;
    spinner.classList.toggle('hidden', !on);
  }

  function setPlaceholder(txt, show){
    if (!placeholder) return;
    placeholder.textContent = txt || '';
    placeholder.style.display = show ? 'flex' : 'none';
  }

  // WebGL check
  function hasWebGL(){
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { return false; }
  }

  // Script loader (THREE only). OrbitControls rimosso per evitare 404/CSP e doppie istanze.
  function loadScriptOnce(src, id){
    return new Promise((resolve, reject) => {
      if (id && document.getElementById(id)) return resolve();
      if (window.THREE) return resolve();

      const s = document.createElement('script');
      if (id) s.id = id;
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Script load error: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureThree(){
    if (window.__BV3D_THREE_READY) return;
    if (window.__BV3D_THREE_PROMISE) return window.__BV3D_THREE_PROMISE;

    window.__BV3D_THREE_PROMISE = (async () => {
      if (!hasWebGL()){
        setPlaceholder('WebGL non disponibile. Anteprima 3D disattivata.', true);
        throw new Error('WebGL not available');
      }

      // Se THREE già presente non ricarico
      if (!window.THREE){
        const THREE_VER = '0.160.0';
        const threeSrc = `https://unpkg.com/three@${THREE_VER}/build/three.min.js`;
        await loadScriptOnce(threeSrc, 'BV3D_THREE');
      }

      if (!window.THREE) throw new Error('THREE non disponibile');
      window.__BV3D_THREE_READY = true;
    })();

    return window.__BV3D_THREE_PROMISE;
  }

  // ---- 3D scene state ----
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let card = null;
  let texFront = null;
  let texBack = null;

  // custom controls state
  let rotY = 0.45;     // azimuth (front/back)
  let rotX = -0.35;    // tilt (table feel)
  let targetRotY = null;

  let distance = 2.2;  // zoom
  const minDist = 1.1;
  const maxDist = 3.6;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

  function initScene(){
    THREE = window.THREE;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene = new THREE.Scene();

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 420;
    camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 50);

    // luci
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    // ombra finta
    const shadowGeo = new THREE.PlaneGeometry(3, 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.10 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI/2;
    shadow.position.y = -0.03;
    scene.add(shadow);

    // card
    const cw = 1.6;
    const ch = 1.0;
    const ct = 0.02;
    const geo = new THREE.BoxGeometry(cw, ch, ct);
    const matNeutral = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });
    const mats = [matNeutral, matNeutral, matNeutral, matNeutral, matNeutral, matNeutral];
    card = new THREE.Mesh(geo, mats);
    card.position.y = 0.38;
    scene.add(card);

    // abilita 3D mode (nasconde 2D fallback)
    document.body.classList.add('bv-3d-enabled');

    // resize
    function resize(){
      if (!renderer || !camera) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // pointer drag
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      rotY += dx * 0.005;
      rotX += dy * 0.004;
      rotX = clamp(rotX, -0.9, -0.15); // limite inclinazione
      targetRotY = null;
    });

    function endDrag(e){
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * 0.18;
      distance = clamp(distance + delta, minDist, maxDist);
    }, { passive: false });

    // toolbar
    btnFront?.addEventListener('click', () => { targetRotY = 0; });
    btnBack?.addEventListener('click',  () => { targetRotY = Math.PI; });

    btnReset?.addEventListener('click', () => {
      if (chkAuto) chkAuto.checked = false;
      rotY = 0.45;
      rotX = -0.35;
      targetRotY = null;
      distance = 2.2;
    });

    btnZoomIn?.addEventListener('click', () => { distance = clamp(distance - 0.18, minDist, maxDist); });
    btnZoomOut?.addEventListener('click', () => { distance = clamp(distance + 0.18, minDist, maxDist); });

    // anim
    const animate = () => {
      requestAnimationFrame(animate);

      // auto-rotate
      if (chkAuto && chkAuto.checked && !dragging){
        rotY += 0.008;
      }

      // smooth snap
      if (targetRotY != null){
        let delta = targetRotY - rotY;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        rotY += delta * 0.12;
        if (Math.abs(delta) < 0.001) targetRotY = null;
      }

      // apply
      if (card){
        card.rotation.y = rotY;
        card.rotation.x = rotX;
      }

      // camera position (look at center)
      if (camera){
        camera.position.set(0, 1.15, distance);
        camera.lookAt(0, 0.38, 0);
      }

      renderer.render(scene, camera);
    };

    animate();
    setPlaceholder('Genera l’anteprima per vedere il mockup 3D.', true);
  }

  function updateTextures(frontCanvas, backCanvas){
    if (!THREE || !card) return;

    if (!texFront){
      texFront = new THREE.CanvasTexture(frontCanvas);
      texFront.colorSpace = THREE.SRGBColorSpace;
      texFront.anisotropy = 4;
    } else {
      texFront.image = frontCanvas;
    }

    if (!texBack){
      texBack = new THREE.CanvasTexture(backCanvas);
      texBack.colorSpace = THREE.SRGBColorSpace;
      texBack.anisotropy = 4;
    } else {
      texBack.image = backCanvas;
    }

    texFront.needsUpdate = true;
    texBack.needsUpdate = true;

    const matFront = new THREE.MeshStandardMaterial({ map: texFront, roughness: 0.9, metalness: 0.0 });
    const matBack  = new THREE.MeshStandardMaterial({ map: texBack,  roughness: 0.9, metalness: 0.0 });

    const mats = card.material;
    mats[4] = matFront; // +z
    mats[5] = matBack;  // -z
    card.material = mats;
    card.material.needsUpdate = true;

    setPlaceholder('', false);
  }

  // Listen events from bv_preview
  window.addEventListener('bvPreviewLoading', (e) => {
    showSpinner(!!e.detail?.loading);
  });

  window.addEventListener('bvPreviewReady', async (e) => {
    try {
      showSpinner(false);
      await ensureThree();
      if (!renderer) initScene();
      updateTextures(e.detail.frontCanvas, e.detail.backCanvas);
    } catch (err){
      console.error('[BV3D] init failed:', err);
      document.body.classList.remove('bv-3d-enabled');
      setPlaceholder('Anteprima 3D non disponibile su questo dispositivo.', true);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    ensureThree().catch(()=>{});
  });

})();
