/* js/modules/bv_3d.js */

(function(){
  'use strict';

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

  // WebGL check
  function hasWebGL(){
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { return false; }
  }

  // Load THREE + OrbitControls (classic scripts)
  let threeReady = false;
  let THREE = null;
  let controls = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let card = null;
  let texFront = null;
  let texBack = null;

  let targetAzimuth = null;

  function showSpinner(on){
    if (!spinner) return;
    spinner.classList.toggle('hidden', !on);
  }

  function setPlaceholder(txt, show){
    if (!placeholder) return;
    placeholder.textContent = txt || '';
    placeholder.style.display = show ? 'flex' : 'none';
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureThree(){
    if (threeReady) return;
    if (!hasWebGL()){
      // fallback: lascia 2D
      return;
    }

    // Carico librerie
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/OrbitControls.js');

    THREE = window.THREE;
    if (!THREE) throw new Error('THREE non disponibile');

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    scene = new THREE.Scene();

    // Camera (leggermente inclinata “prodotto sul tavolo”)
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(35, aspect, 0.01, 50);
    camera.position.set(0, 1.15, 2.2);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(3, 4, 2);
    scene.add(dir);

    // Ground shadow (soft)
    const shadowGeo = new THREE.PlaneGeometry(3, 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.10 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI/2;
    shadow.position.y = -0.03;
    scene.add(shadow);

    // Card mesh (thin box)
    const w = 1.6; // proportions feel like business card
    const h = 1.0;
    const t = 0.02;
    const geo = new THREE.BoxGeometry(w, h, t);

    const matNeutral = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });

    // order of materials for BoxGeometry: +x, -x, +y, -y, +z, -z
    // We'll use +z as front, -z as back
    const mats = [matNeutral, matNeutral, matNeutral, matNeutral, matNeutral, matNeutral];
    card = new THREE.Mesh(geo, mats);
    card.position.y = 0.38;
    scene.add(card);

    // Controls
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;

    // Limits
    controls.minDistance = 1.1;
    controls.maxDistance = 3.6;
    controls.minPolarAngle = 0.75; // tilt up
    controls.maxPolarAngle = 1.35; // tilt down

    // Default tilt (table feel): set angles
    try {
      controls.setPolarAngle(1.06);
      controls.setAzimuthalAngle(0.45);
      controls.update();
    } catch {}

    // enable 3D mode
    document.body.classList.add('bv-3d-enabled');

    // Resize handling
    const resize = () => {
      if (!renderer || !camera) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Smooth snap to front/back
      if (targetAzimuth != null && controls){
        const cur = controls.getAzimuthalAngle();
        let delta = targetAzimuth - cur;
        // shortest path wrap
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        const step = delta * 0.12;
        if (Math.abs(delta) < 0.001){
          targetAzimuth = null;
        } else {
          try { controls.setAzimuthalAngle(cur + step); } catch {}
        }
      }

      // Auto-rotate (OFF by default)
      if (controls){
        controls.autoRotate = !!(chkAuto && chkAuto.checked);
        controls.autoRotateSpeed = 1.1;
        controls.update();
      }

      renderer.render(scene, camera);
    };

    animate();
    threeReady = true;
    setPlaceholder('Genera l’anteprima per vedere il mockup 3D.', true);
  }

  function updateTextures(frontCanvas, backCanvas){
    if (!threeReady || !THREE || !card) return;

    // Create or update textures
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

    // Apply to +z (front) and -z (back)
    const matFront = new THREE.MeshStandardMaterial({ map: texFront, roughness: 0.9, metalness: 0.0 });
    const matBack  = new THREE.MeshStandardMaterial({ map: texBack,  roughness: 0.9, metalness: 0.0 });

    const mats = card.material;
    mats[4] = matFront; // +z
    mats[5] = matBack;  // -z
    card.material = mats;
    card.material.needsUpdate = true;

    // show stage
    setPlaceholder('', false);
  }

  // Controls
  btnFront?.addEventListener('click', () => {
    if (!controls) return;
    // front: azimuth around current polar
    targetAzimuth = 0;
  });

  btnBack?.addEventListener('click', () => {
    if (!controls) return;
    targetAzimuth = Math.PI;
  });

  btnReset?.addEventListener('click', () => {
    if (!controls) return;
    chkAuto && (chkAuto.checked = false);
    try {
      controls.reset();
      controls.setPolarAngle(1.06);
      controls.setAzimuthalAngle(0.45);
      controls.update();
    } catch {}
  });

  // Zoom buttons
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
      if (!threeReady) return;
      updateTextures(e.detail.frontCanvas, e.detail.backCanvas);
    } catch (err){
      console.error(err);
    }
  });

  // Boot: init Three lazily when user enters BV
  // We'll attempt to load Three early (no textures yet), so UX is snappy.
  document.addEventListener('DOMContentLoaded', () => {
    // don't block if unsupported
    ensureThree().catch(()=>{});
  });

})();
