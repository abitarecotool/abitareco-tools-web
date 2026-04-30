/* js/modules/bv_3d.js */

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

  // Auto rotate OFF by default
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

  // ---- Robust script loader (avoid multiple instances / race conditions) ----
  function loadScriptOnce(src, id){
    return new Promise((resolve, reject) => {
      // already loaded?
      if (id && document.getElementById(id)) {
        return resolve();
      }
      // already in DOM by src?
      const existing = Array.from(document.scripts).find(s => s.src === src);
      if (existing){
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', () => resolve(), { once:true });
        existing.addEventListener('error', () => reject(new Error('Script load error: ' + src)), { once:true });
        return;
      }

      const s = document.createElement('script');
      if (id) s.id = id;
      s.src = src;
      s.async = true;
      s.dataset.loaded = '0';
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Script load error: ' + src));
      document.head.appendChild(s);
    });
  }

  // Shared promise so we never load THREE twice
  async function ensureThree(){
    if (window.__BV3D_THREE_READY) return;
    if (window.__BV3D_THREE_PROMISE) return window.__BV3D_THREE_PROMISE;

    window.__BV3D_THREE_PROMISE = (async () => {
      if (!hasWebGL()) {
        setPlaceholder('WebGL non disponibile. Anteprima 3D disattivata.', true);
        throw new Error('WebGL not available');
      }

      // IMPORTANT: use one CDN consistently (unpkg) to avoid mismatched builds
      const THREE_VER = '0.160.0';
      const threeSrc = `https://unpkg.com/three@${THREE_VER}/build/three.min.js`;
      const controlsSrc = `https://unpkg.com/three@${THREE_VER}/examples/js/controls/OrbitControls.js`;

      await loadScriptOnce(threeSrc, 'BV3D_THREE');
      if (!window.THREE) throw new Error('THREE non disponibile dopo il load');

      await loadScriptOnce(controlsSrc, 'BV3D_ORBIT');
      // OrbitControls non-module attaches to THREE.OrbitControls
      if (!window.THREE.OrbitControls) throw new Error('OrbitControls non disponibile');

      window.__BV3D_THREE_READY = true;
    })();

    return window.__BV3D_THREE_PROMISE;
  }

  // ---- 3D scene state ----
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let card = null;
  let texFront = null;
  let texBack = null;
  let targetAzimuth = null;

  function initScene(){
    THREE = window.THREE;

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Scene
    scene = new THREE.Scene();

    // Camera (prodotto sul tavolo)
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 420;
    camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 50);
    camera.position.set(0, 1.15, 2.2);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    // Ground shadow
    const shadowGeo = new THREE.PlaneGeometry(3, 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.10 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI/2;
    shadow.position.y = -0.03;
    scene.add(shadow);

    // Card geometry: thin box (front/back textures)
    const cw = 1.6;
    const ch = 1.0;
    const ct = 0.02;
    const geo = new THREE.BoxGeometry(cw, ch, ct);

    const matNeutral = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });
    const mats = [matNeutral, matNeutral, matNeutral, matNeutral, matNeutral, matNeutral];

    card = new THREE.Mesh(geo, mats);
    card.position.y = 0.38;
    scene.add(card);

    // Controls (drag rotate + wheel/pinch zoom)
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;

    controls.minDistance = 1.1;
    controls.maxDistance = 3.6;
    controls.minPolarAngle = 0.75;
    controls.maxPolarAngle = 1.35;

    // Default tilt
    try {
      controls.setPolarAngle(1.06);
      controls.setAzimuthalAngle(0.45);
      controls.update();
    } catch {}

    // Size
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

    // Enable 3D mode (hide 2D fallback)
    document.body.classList.add('bv-3d-enabled');

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);

      // Smooth snap to front/back
      if (targetAzimuth != null && controls){
        const cur = controls.getAzimuthalAngle();
        let delta = targetAzimuth - cur;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        const step = delta * 0.12;
        if (Math.abs(delta) < 0.001) targetAzimuth = null;
        else {
          try { controls.setAzimuthalAngle(cur + step); } catch {}
        }
      }

      if (controls){
        controls.autoRotate = !!(chkAuto && chkAuto.checked);
        controls.autoRotateSpeed = 1.1;
        controls.update();
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

  // UI buttons
  btnFront?.addEventListener('click', () => { if (controls) targetAzimuth = 0; });
  btnBack?.addEventListener('click', () => { if (controls) targetAzimuth = Math.PI; });

  btnReset?.addEventListener('click', () => {
    if (!controls) return;
    if (chkAuto) chkAuto.checked = false;
    try {
      controls.reset();
      controls.setPolarAngle(1.06);
      controls.setAzimuthalAngle(0.45);
      controls.update();
    } catch {}
  });

  function dolly(delta){
    if (!controls) return;
    const d = controls.getDistance();
    const next = Math.min(controls.maxDistance, Math.max(controls.minDistance, d + delta));
    const factor = next / d;
    if (factor > 1) controls.dollyOut(factor);
    else controls.dollyIn(1/factor);
    controls.update();
  }
  btnZoomIn?.addEventListener('click', () => dolly(-0.18));
  btnZoomOut?.addEventListener('click', () => dolly(0.18));

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
      // fallback: keep 2D visible
      document.body.classList.remove('bv-3d-enabled');
      setPlaceholder('Anteprima 3D non disponibile su questo dispositivo.', true);
    }
  });

  // Preload three lazily (non blocca)
  document.addEventListener('DOMContentLoaded', () => {
    ensureThree().catch(()=>{});
  });

})();
