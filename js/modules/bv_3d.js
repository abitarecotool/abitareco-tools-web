/* js/modules/bv_3d.js */
// Mockup 3D BV: Three.js + controlli custom (drag rotazione 360°, wheel/pinch zoom, +/-, Fronte/Retro, Auto OFF).
// Polish: niente "tavolo" grigio (rimossa base rettangolare), ombra soft realistica + riflesso/gloss leggero.

(function(){
  'use strict';

  if (window.__BV3D_INITED) return;
  window.__BV3D_INITED = true;

  const canvas = document.getElementById('Bv3DCanvas');
  const spinner = document.getElementById('Bv3DSpinner');
  const placeholder = document.getElementById('Bv3DPlaceholder');

  const btnFront = document.getElementById('Bv3DFront');
  const btnBack  = document.getElementById('Bv3DBack');
  const btnZoomIn = document.getElementById('Bv3DZoomIn');
  const btnZoomOut = document.getElementById('Bv3DZoomOut');
  const btnReset = document.getElementById('Bv3DReset');
  const chkAuto = document.getElementById('Bv3DAuto');

  if (!canvas) return;
  if (chkAuto) chkAuto.checked = false;

  const showSpinner = (on) => {
    if (!spinner) return;
    spinner.classList.toggle('hidden', !on);
  };

  const setPlaceholder = (txt, show) => {
    if (!placeholder) return;
    placeholder.textContent = txt || '';
    placeholder.style.display = show ? 'flex' : 'none';
  };

  function hasWebGL(){
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { return false; }
  }

  function loadScriptOnce(src, id){
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve();
      if (id && document.getElementById(id)) return resolve();
      const s = document.createElement('script');
      if (id) s.id = id;
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Script load error: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureThree(){
    if (window.__BV3D_THREE_READY) return;
    if (window.__BV3D_THREE_PROMISE) return window.__BV3D_THREE_PROMISE;

    window.__BV3D_THREE_PROMISE = (async ()=>{
      if (!hasWebGL()) throw new Error('WebGL not available');
      const VER = '0.160.0';
      await loadScriptOnce(`https://unpkg.com/three@${VER}/build/three.min.js`, 'BV3D_THREE');
      if (!window.THREE) throw new Error('THREE not available');
      window.__BV3D_THREE_READY = true;
    })();

    return window.__BV3D_THREE_PROMISE;
  }

  let THREE, renderer, scene, camera, card;
  let texFront = null, texBack = null;
  let glossMesh = null;
  let shadowMesh = null;

  // controls
  let rotY = 0.45;
  let rotX = -0.35;
  let targetRotY = null;

  let distance = 2.2;
  const minDist = 1.1;
  const maxDist = 3.6;

  let dragging = false;
  let lastX = 0, lastY = 0;

  const clamp = (v,a,b)=> Math.min(b, Math.max(a,v));

  function makeRadialShadowTexture(){
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');

    // Clear
    ctx.clearRect(0,0,c.width,c.height);

    // Soft radial gradient (no edges -> no "tavolo")
    const g = ctx.createRadialGradient(256, 260, 30, 256, 260, 240);
    g.addColorStop(0.0, 'rgba(0,0,0,0.22)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.12)');
    g.addColorStop(0.70, 'rgba(0,0,0,0.05)');
    g.addColorStop(1.0, 'rgba(0,0,0,0.0)');

    ctx.fillStyle = g;
    ctx.fillRect(0,0,512,512);

    return c;
  }

  function makeGlossTexture(){
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');

    ctx.clearRect(0,0,512,512);

    // Diagonal soft highlight (subtle, Pixart-like)
    const g = ctx.createLinearGradient(80, 80, 440, 440);
    g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.70, 'rgba(255,255,255,0.00)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');

    ctx.fillStyle = g;
    ctx.fillRect(0,0,512,512);

    // Gentle vignette to keep center crisp
    const v = ctx.createRadialGradient(256,256, 60, 256,256, 260);
    v.addColorStop(0.0, 'rgba(0,0,0,0.00)');
    v.addColorStop(1.0, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = v;
    ctx.fillRect(0,0,512,512);

    return c;
  }

  function initScene(){
    THREE = window.THREE;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene = new THREE.Scene();

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 420;
    camera = new THREE.PerspectiveCamera(35, w/h, 0.01, 50);

    // Lights: softer + a touch more premium
    scene.add(new THREE.AmbientLight(0xffffff, 0.92));
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(2.8, 4.2, 2.3);
    scene.add(dir);

    // Shadow: soft radial texture (no rectangular plane visible)
    const shCanvas = makeRadialShadowTexture();
    const shTex = new THREE.CanvasTexture(shCanvas);
    shTex.colorSpace = THREE.SRGBColorSpace;
    shTex.needsUpdate = true;

    const shGeo = new THREE.PlaneGeometry(2.4, 1.6);
    const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 1.0, depthWrite: false });
    shadowMesh = new THREE.Mesh(shGeo, shMat);
    shadowMesh.rotation.x = -Math.PI/2;
    shadowMesh.position.y = -0.028;
    shadowMesh.position.z = 0.12;
    scene.add(shadowMesh);

    // Card
    const geo = new THREE.BoxGeometry(1.6, 1.0, 0.02);
    const matNeutral = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.82, metalness:0.02 });
    const mats = [matNeutral, matNeutral, matNeutral, matNeutral, matNeutral, matNeutral];

    card = new THREE.Mesh(geo, mats);
    card.position.y = 0.38;
    scene.add(card);

    // Gloss overlay on front face (child of card)
    const glCanvas = makeGlossTexture();
    const glTex = new THREE.CanvasTexture(glCanvas);
    glTex.colorSpace = THREE.SRGBColorSpace;
    glTex.needsUpdate = true;

    const glGeo = new THREE.PlaneGeometry(1.58, 0.98);
    const glMat = new THREE.MeshBasicMaterial({
      map: glTex,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    glossMesh = new THREE.Mesh(glGeo, glMat);
    // slightly in front of +Z face
    glossMesh.position.z = 0.011;
    card.add(glossMesh);

    // enable 3D mode
    document.body.classList.add('bv-3d-enabled');

    function resize(){
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // input controls
    canvas.addEventListener('pointerdown', (e)=>{
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    });

    canvas.addEventListener('pointermove', (e)=>{
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      rotY += dx * 0.005;
      rotX += dy * 0.004;
      rotX = clamp(rotX, -0.9, -0.15);
      targetRotY = null;
    });

    const endDrag = (e)=>{
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('wheel', (e)=>{
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * 0.18;
      distance = clamp(distance + delta, minDist, maxDist);
    }, { passive:false });

    btnFront?.addEventListener('click', ()=>{ targetRotY = 0; });
    btnBack?.addEventListener('click', ()=>{ targetRotY = Math.PI; });
    btnZoomIn?.addEventListener('click', ()=>{ distance = clamp(distance - 0.18, minDist, maxDist); });
    btnZoomOut?.addEventListener('click', ()=>{ distance = clamp(distance + 0.18, minDist, maxDist); });
    btnReset?.addEventListener('click', ()=>{
      if (chkAuto) chkAuto.checked = false;
      rotY = 0.45; rotX = -0.35; targetRotY = null;
      distance = 2.2;
    });

    const loop = ()=>{
      requestAnimationFrame(loop);

      if (chkAuto && chkAuto.checked && !dragging){
        rotY += 0.008;
      }

      if (targetRotY != null){
        let d = targetRotY - rotY;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        rotY += d * 0.12;
        if (Math.abs(d) < 0.001) targetRotY = null;
      }

      if (card){
        card.rotation.y = rotY;
        card.rotation.x = rotX;
      }

      if (camera){
        camera.position.set(0, 1.15, distance);
        camera.lookAt(0, 0.38, 0);
      }

      renderer.render(scene, camera);
    };
    loop();

    setPlaceholder('Genera l’anteprima per vedere il mockup 3D.', true);
  }

  function applyTextures(frontCanvas, backCanvas){
    if (!THREE || !card) return;

    if (!texFront){
      texFront = new THREE.CanvasTexture(frontCanvas);
      texFront.colorSpace = THREE.SRGBColorSpace;
      texFront.anisotropy = 6;
    } else {
      texFront.image = frontCanvas;
    }

    if (!texBack){
      texBack = new THREE.CanvasTexture(backCanvas);
      texBack.colorSpace = THREE.SRGBColorSpace;
      texBack.anisotropy = 6;
    } else {
      texBack.image = backCanvas;
    }

    texFront.needsUpdate = true;
    texBack.needsUpdate = true;

    const matFront = new THREE.MeshStandardMaterial({ map: texFront, roughness:0.80, metalness:0.02 });
    const matBack  = new THREE.MeshStandardMaterial({ map: texBack,  roughness:0.82, metalness:0.02 });

    const mats = card.material;
    mats[4] = matFront;
    mats[5] = matBack;
    card.material = mats;
    card.material.needsUpdate = true;

    setPlaceholder('', false);
  }

  window.addEventListener('bvPreviewLoading', (e)=>{
    showSpinner(!!e.detail?.loading);
  });

  window.addEventListener('bvPreviewReady', async (e)=>{
    try {
      showSpinner(false);
      await ensureThree();
      if (!renderer) initScene();
      applyTextures(e.detail.frontCanvas, e.detail.backCanvas);
    } catch (err){
      console.error('[BV3D] failed:', err);
      document.body.classList.remove('bv-3d-enabled');
      setPlaceholder('Anteprima 3D non disponibile su questo dispositivo.', true);
    }
  });

})();
