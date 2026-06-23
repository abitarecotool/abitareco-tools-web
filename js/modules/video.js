/* ============================= VIDEO: Slideshow ======================= */
const VidTitle    = $('#VidTitle');
const VidDuration = $('#VidDuration');
const VidFmtH     = $('#VidFmtH');
const VidFmtV     = $('#VidFmtV');
const VidFmtS     = $('#VidFmtS');
const DropAreaVideo = $('#DropAreaVideo');
const TxtFolderVideo = $('#TxtFolderVideo');
const BtnClearVideo  = $('#BtnClearVideo');
const VidCanvas = $('#VidCanvas');
const VideoAdvancedTools = $('#VideoAdvancedTools');
const BtnVideoAdvanced   = $('#BtnVideoAdvanced');
const BtnVideoResetOrder = $('#BtnVideoResetOrder');
const VideoAdvancedMeta  = $('#VideoAdvancedMeta');
const VideoAdvancedCard  = $('#VideoAdvancedCard');
const VideoPreviewStage  = $('#VideoPreviewStage');
const VideoPreviewFrame  = $('#VideoPreviewFrame');
const VideoPreviewImage  = $('#VideoPreviewImage');
const VideoPreviewEmpty  = $('#VideoPreviewEmpty');
const VidSlideZoom       = $('#VidSlideZoom');
const BtnVideoResetFrame = $('#BtnVideoResetFrame');
const BtnVideoCenterFrame= $('#BtnVideoCenterFrame');
const VideoSelectedName  = $('#VideoSelectedName');
const VideoSelectedOrder = $('#VideoSelectedOrder');
const VideoSelectedTransform = $('#VideoSelectedTransform');
const VideoTimelineMeta  = $('#VideoTimelineMeta');
const VideoTimeline      = $('#VideoTimeline');
const VidTransitionType  = $('#VidTransitionType');
const VidTransitionDuration = $('#VidTransitionDuration');
const BtnVideoApplyTransition = $('#BtnVideoApplyTransition');
const BtnVideoRemoveTransition = $('#BtnVideoRemoveTransition');
const VideoTransitionHint = $('#VideoTransitionHint');
const BtnVideoRemoveSelected = $('#BtnVideoRemoveSelected');
const BtnVideoReplaceSelected = $('#BtnVideoReplaceSelected');
const BtnVideoAddImages = $('#BtnVideoAddImages');
const VideoManageHint = $('#VideoManageHint');
const VideoReplaceInput = $('#VideoReplaceInput');
const VideoAddImagesInput = $('#VideoAddImagesInput');

if (!Array.isArray(window.pickedVideo)) window.pickedVideo = [];

const VIDEO_TRANSITION_LABELS = {
  none: 'Nessuna',
  crossfade: 'Dissolvenza',
  fadeblack: 'Fade to black',
  slideleft: 'Slide left',
  slideright: 'Slide right',
  zoomsoft: 'Zoom soft'
};
const VIDEO_PREVIEW_MAX_HEIGHT = 470;

const videoEditorState = {
  enabled: false,
  slides: [],
  originalOrder: [],
  activeId: null,
  selectedIds: [],
  selectionAnchorId: null,
  previewPointerId: null,
  previewDragging: false,
  previewStartX: 0,
  previewStartY: 0,
  dragSlideId: null,
  hoverInsertAfter: false
};

const VIDEO_EXPORT_KEYFRAME_SECONDS = 2;
function isMp4MuxerReady(){
  return !!(window.Mp4Muxer?.Muxer && window.Mp4Muxer?.ArrayBufferTarget);
}
function getStableExportFrameCount(T, fps){
  return Math.max(1, Math.round(Math.max(0.001, Number(T) || 0) * Math.max(1, Number(fps) || 1)));
}
function getFrameDurationUs(fps){
  return Math.max(1, Math.round(1e6 / Math.max(1, Number(fps) || 1)));
}
function getFrameRenderTime(frameIndex, totalFrames, fps, T){
  if (totalFrames <= 1) return 0;
  const frameSeconds = frameIndex / Math.max(1, fps || 1);
  const lastRenderable = Math.max(0, (Number(T) || 0) - (0.5 / Math.max(1, fps || 1)));
  return Math.min(frameSeconds, lastRenderable);
}
function closeVideoBitmapItems(items){
  for (const item of items || []){
    try { item?.bmp?.close?.(); } catch {}
    try {
      if (item?.bmpZoomSoft && item.bmpZoomSoft !== item.bmp) item?.bmpZoomSoft?.close?.();
    } catch {}
  }
}
function updateVideoExportProgress(doneFrames, totalFrames, label='Esportazione MP4 in corso…'){
  if (ActionProgressLabel) ActionProgressLabel.textContent = label;
  if (ActionProgress) ActionProgress.value = Math.max(0, Math.min(100, Math.round((doneFrames / Math.max(1, totalFrames)) * 100)));
}


function vShow(el){
  if (!el) return;
  try { if (typeof showEl === 'function') return showEl(el); } catch {}
  el.classList.remove('hidden');
}

function getPreferredEncoderMode(mode='auto'){
  if (mode === 'prefer-software' || mode === 'software') return 'prefer-software';
  if (mode === 'prefer-hardware' || mode === 'hardware') return 'prefer-hardware';
  return 'auto';
}
function videoAdvancedUsesComplexMotion(){
  return videoEditorState.slides.some(slide => {
    const type = slide?.transitionToNext?.type || 'none';
    return type === 'slideleft' || type === 'slideright' || type === 'fadeblack';
  });
}
function currentVideoEncoderPreference(){
  if (!(videoEditorState.enabled && videoHasSlides())) return 'auto';
  return videoAdvancedUsesComplexMotion() ? 'prefer-software' : 'auto';
}
function videoAdvancedRequiresRecorderFallback(){
  return false;
}
function videoAdvancedHasMotionTransitions(){
  if (!(videoEditorState.enabled && videoHasSlides())) return false;
  return videoEditorState.slides.some(slide => {
    const type = slide?.transitionToNext?.type || 'none';
    return type === 'fadeblack' || type === 'slideleft' || type === 'slideright';
  });
}
function withVideoExportTimeout(promise, ms, label='Esportazione video'){
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error(`${label} non completata entro il tempo previsto.`)), ms);
    promise.then(
      value => { clearTimeout(timerId); resolve(value); },
      err => { clearTimeout(timerId); reject(err); }
    );
  });
}
async function throttleVideoEncoder(encoder, queueLimit=6){
  if (!encoder) return;
  if ((encoder.encodeQueueSize || 0) < queueLimit) return;
  await encoder.flush();
}
function drawScaledMotionCoverOn(ctx, bmp, W, H, opts={}){
  const iw = Number(bmp?.width) || 0;
  const ih = Number(bmp?.height) || 0;
  if (!(iw > 0) || !(ih > 0)) return false;
  const coverScale = Math.max(W / iw, H / ih);
  if (!Number.isFinite(coverScale) || !(coverScale > 0)) return false;
  const scaleMul = Math.max(0.1, Number.isFinite(Number(opts.scaleMul)) ? Number(opts.scaleMul) : 1);
  const moveX = Number.isFinite(Number(opts.dx)) ? Number(opts.dx) : 0;
  const moveY = Number.isFinite(Number(opts.dy)) ? Number(opts.dy) : 0;
  const dw = iw * coverScale * scaleMul;
  const dh = ih * coverScale * scaleMul;
  const x = ((W - dw) / 2) + moveX;
  const y = ((H - dh) / 2) + moveY;
  if (!Number.isFinite(dw) || !Number.isFinite(dh) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const oldAlpha = ctx.globalAlpha;
  if (opts.alpha != null) ctx.globalAlpha = vClamp(Number(opts.alpha), 0, 1);
  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, x, y, dw, dh);
  } finally {
    ctx.globalAlpha = oldAlpha;
  }
  return true;
}

function vHide(el){
  if (!el) return;
  try { if (typeof hideEl === 'function') return hideEl(el); } catch {}
  el.classList.add('hidden');
}
function vToggle(el, show){ show ? vShow(el) : vHide(el); }
function vClamp(v, a, b){ return Math.min(b, Math.max(a, v)); }
function vEscapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function vPaintRangeFill(slider, pct){
  if (!slider) return;
  const safe = Math.max(0, Math.min(100, Number(pct) || 0));
  slider.style.setProperty('--fill', safe + '%');
  const gradient = `linear-gradient(to right, var(--red) 0 ${safe}%, var(--gray-200) ${safe}% 100%)`;
  slider.style.background = gradient;
  slider.style.backgroundImage = gradient;
}
function vUpdateSliderFill(slider){
  if (!slider) return;
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 1;
  const val = Number(slider.value) || min;
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  vPaintRangeFill(slider, pct);
}
function videoRecords(){ return Array.isArray(window.pickedVideo) ? window.pickedVideo : []; }
function videoHasSlides(){ return Array.isArray(videoEditorState.slides) && videoEditorState.slides.length > 0; }
function currentVideoTitle(){ return (VidTitle?.value || '').trim(); }
function currentVideoDuration(){ return Math.max(1, parseFloat(VidDuration?.value || '30') || 30); }
function currentVideoFade(){ return 1.0; }
function currentVideoFps(){ return 30; }
function videoAdvancedHasZoomSoftTransitions(){
  if (!(videoEditorState.enabled && videoHasSlides())) return false;
  return videoEditorState.slides.some(slide => (slide?.transitionToNext?.type || 'none') === 'zoomsoft');
}
function currentVideoExportFps(){
  return videoAdvancedHasZoomSoftTransitions() ? 24 : currentVideoFps();
}
function videoAdvancedNeedsAllKeyframes(){
  return false;
}
function currentVideoFormatLabel(){
  if (VidFmtV?.checked) return 'Verticale · 1080×1920';
  if (VidFmtS?.checked) return 'Quadrato · 1080×1080';
  return 'Orizzontale · 1920×1080';
}
function isMobileGalleryPicker(){
  return window.matchMedia('(max-width: 900px)').matches && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));
}
function pickVideoSize(){
  if (VidFmtV?.checked) return { W:1080, H:1920 };
  if (VidFmtS?.checked) return { W:1080, H:1080 };
  return { W:1920, H:1080 };
}
function pickBitrate(W,H,fps){
  const isSquare = (W===1080 && H===1080);
  let bps = isSquare ? 8e6 : 12e6;
  if (fps > 30) bps = Math.round(bps * (fps/30));
  return bps;
}
function supportsMp4Recorder(){
  if (!('MediaRecorder' in window)) return null;
  const c = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4'
  ];
  for (const m of c){
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return null;
}
async function supportsH264WebCodecs(W=1920, H=1080, fps=30, bitrate=12e6, encoderMode='auto'){
  if (!('VideoEncoder' in window)) return [];
  const codecCandidates = ['avc1.42E01E', 'avc1.4D401F', 'avc1.640028'];
  const mode = getPreferredEncoderMode(encoderMode);
  const accelCandidates = mode === 'prefer-software'
    ? ['prefer-software', null]
    : mode === 'prefer-hardware'
      ? ['prefer-hardware', null]
      : ['prefer-software', null, 'prefer-hardware'];
  const supported = [];
  const seen = new Set();
  for (const codec of codecCandidates){
    for (const accel of accelCandidates){
      const cfg = {
        codec,
        width: W,
        height: H,
        framerate: fps,
        bitrate,
        bitrateMode: 'constant',
        avc: { format: 'avc' }
      };
      if (accel) cfg.hardwareAcceleration = accel;
      try {
        const test = (typeof VideoEncoder.isConfigSupported === 'function')
          ? await VideoEncoder.isConfigSupported(cfg)
          : { supported:true, config: cfg };
        if (!test?.supported) continue;
        const normalized = test.config || cfg;
        const key = JSON.stringify(normalized);
        if (seen.has(key)) continue;
        seen.add(key);
        supported.push(normalized);
      } catch {}
    }
  }
  return supported;
}
function makeVideoSlideId(rec, idx){
  const base = String(rec?.relPath || rec?.file?.webkitRelativePath || rec?.file?.name || `slide-${idx+1}`);
  return `slide-${idx+1}-${slugify(base) || idx+1}`;
}
function revokeSlidePreviewUrls(list = videoEditorState.slides){
  for (const slide of list || []){
    try { if (slide?.previewUrl) URL.revokeObjectURL(slide.previewUrl); } catch {}
  }
}
function buildVideoSlidesFromRecords(records){
  revokeSlidePreviewUrls();
  videoEditorState.slides = records.map((rec, idx) => ({
    id: makeVideoSlideId(rec, idx),
    file: rec.file,
    relPath: rec.relPath || rec.file?.webkitRelativePath || rec.file?.name,
    name: rec.file?.name || `slide-${idx+1}`,
    previewUrl: URL.createObjectURL(rec.file),
    transform: { x: 0, y: 0, scale: 1, minScale: 0.25, maxScale: 4 },
    transitionToNext: { type: 'crossfade', duration: 0.8 }
  }));
  videoEditorState.originalOrder = videoEditorState.slides.map(slide => slide.id);
  videoEditorState.activeId = videoEditorState.slides[0]?.id || null;
  videoEditorState.selectedIds = videoEditorState.activeId ? [videoEditorState.activeId] : [];
  videoEditorState.selectionAnchorId = videoEditorState.activeId;
}

function makeUniqueVideoSlideId(rec){
  const base = slugify(rec?.relPath || rec?.file?.name || 'slide') || 'slide';
  const uid = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).replace(/[^a-zA-Z0-9-]/g, '');
  return `slide-${base}-${uid}`;
}
function createVideoSlideFromRecord(rec){
  return {
    id: makeUniqueVideoSlideId(rec),
    file: rec.file,
    relPath: rec.relPath || rec.file?.webkitRelativePath || rec.file?.name,
    name: rec.file?.name || 'slide',
    previewUrl: URL.createObjectURL(rec.file),
    transform: { x: 0, y: 0, scale: 1, minScale: 0.25, maxScale: 4 },
    transitionToNext: { type: 'crossfade', duration: 0.8 }
  };
}
async function extractDroppedVideoRecords(dataTransfer){
  const out = [];
  const seen = new Set();
  const addRecord = (file, relPath) => {
    if (!file || !/\.(jpe?g|png|tif?f|webp)$/i.test(file.name || '')) return;
    const key = `${relPath || file.name}__${file.size}__${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ file, relPath: relPath || file.webkitRelativePath || file.name });
  };
  const items = Array.from(dataTransfer?.items || []);
  let hasDirectory = false;
  for (const item of items){
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry?.isDirectory) hasDirectory = true;
    if (item.kind === 'file') {
      const file = item.getAsFile();
      addRecord(file, file?.name);
    }
  }
  if (!out.length && dataTransfer?.files?.length) {
    Array.from(dataTransfer.files).forEach(file => addRecord(file, file.webkitRelativePath || file.name));
  }
  if (hasDirectory && typeof readDroppedDirectory === 'function') {
    const dropped = await readDroppedDirectory(dataTransfer);
    (dropped || []).forEach(rec => addRecord(rec.file, rec.relPath || rec.file?.webkitRelativePath || rec.file?.name));
  }
  return sortVideoRecords(out);
}
function appendVideoPickedRecords(records){
  const normalized = sortVideoRecords(records || []);
  if (!normalized.length) return;
  window.pickedVideo = [...videoRecords(), ...normalized];
  TxtFolderVideo.textContent = `Selezionati ${window.pickedVideo.length} file…`;
  BtnClearVideo?.classList.toggle('hidden', window.pickedVideo.length === 0);
  const newSlides = normalized.map(createVideoSlideFromRecord);
  if (videoHasSlides()) {
    videoEditorState.slides.push(...newSlides);
  } else {
    videoEditorState.slides = newSlides;
  }
  videoEditorState.originalOrder = videoEditorState.slides.map(slide => slide.id);
  if (!videoEditorState.activeId && videoEditorState.slides[0]) {
    videoEditorState.activeId = videoEditorState.slides[0].id;
    videoEditorState.selectedIds = [videoEditorState.activeId];
    videoEditorState.selectionAnchorId = videoEditorState.activeId;
  }
  syncVideoUiState();
}
function sortVideoRecords(records){
  return records
    .filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name))
    .map(r => ({ file:r.file, relPath:r.relPath || r.file.webkitRelativePath || r.file.name }))
    .sort((a,b) => (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
}
function updateVideoPickedRecords(records){
  window.pickedVideo = sortVideoRecords(records);
  TxtFolderVideo.textContent = window.pickedVideo.length
    ? `Selezionati ${window.pickedVideo.length} file…`
    : 'Nessun file supportato.';
  BtnClearVideo?.classList.toggle('hidden', window.pickedVideo.length === 0);
  if (window.pickedVideo.length) buildVideoSlidesFromRecords(window.pickedVideo);
  else revokeSlidePreviewUrls();
  syncVideoUiState();
}
function currentActiveSlide(){
  return videoEditorState.slides.find(slide => slide.id === videoEditorState.activeId) || videoEditorState.slides[0] || null;
}
function ensureActiveVideoSlide(){
  if (!videoHasSlides()) {
    videoEditorState.activeId = null;
    return null;
  }
  const active = currentActiveSlide();
  if (active) return active;
  videoEditorState.activeId = videoEditorState.slides[0].id;
  return videoEditorState.slides[0];
}
function alignSelectedIds(){
  const existing = new Set(videoEditorState.slides.map(slide => slide.id));
  videoEditorState.selectedIds = videoEditorState.selectedIds.filter(id => existing.has(id));
  if (videoEditorState.selectionAnchorId && !existing.has(videoEditorState.selectionAnchorId)) {
    videoEditorState.selectionAnchorId = videoEditorState.selectedIds[0] || videoEditorState.slides[0]?.id || null;
  }
  const active = ensureActiveVideoSlide();
  if (!videoEditorState.selectedIds.length && active) videoEditorState.selectedIds = [active.id];
}
function getSlideIndexById(id){
  return videoEditorState.slides.findIndex(slide => slide.id === id);
}
function getSelectedSlideIdsOrdered(){
  alignSelectedIds();
  return videoEditorState.selectedIds.slice().sort((a,b) => getSlideIndexById(a) - getSlideIndexById(b));
}
function getRangeIds(fromId, toId){
  const from = getSlideIndexById(fromId);
  const to = getSlideIndexById(toId);
  if (from < 0 || to < 0) return [toId];
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  return videoEditorState.slides.slice(a, b + 1).map(slide => slide.id);
}
function setVideoSelection(id, opts={}){
  const slide = videoEditorState.slides.find(item => item.id === id);
  if (!slide) return;
  const mode = opts.mode || 'single';
  if (mode === 'range'){
    const anchor = videoEditorState.selectionAnchorId || videoEditorState.activeId || id;
    videoEditorState.selectedIds = getRangeIds(anchor, id);
  } else if (mode === 'toggle'){
    const has = videoEditorState.selectedIds.includes(id);
    if (has) videoEditorState.selectedIds = videoEditorState.selectedIds.filter(x => x !== id);
    else videoEditorState.selectedIds = [...videoEditorState.selectedIds, id];
    if (!videoEditorState.selectedIds.length) videoEditorState.selectedIds = [id];
    videoEditorState.selectionAnchorId = id;
  } else {
    videoEditorState.selectedIds = [id];
    videoEditorState.selectionAnchorId = id;
  }
  videoEditorState.activeId = id;
  alignSelectedIds();
  renderVideoIfNeeded();
}
function getSelectedTransitionPairs(){
  const orderedIds = getSelectedSlideIdsOrdered();
  if (orderedIds.length < 2) return [];
  const idSet = new Set(orderedIds);
  const pairs = [];
  videoEditorState.slides.forEach((slide, idx) => {
    if (idx >= videoEditorState.slides.length - 1) return;
    const next = videoEditorState.slides[idx + 1];
    if (idSet.has(slide.id) && idSet.has(next.id)) {
      pairs.push({ from: slide, to: next, fromIndex: idx, toIndex: idx + 1 });
    }
  });
  return pairs;
}
function formatTransitionLabel(transition){
  if (!transition || transition.type === 'none' || !(transition.duration > 0)) return 'Nessuna';
  return `${VIDEO_TRANSITION_LABELS[transition.type] || transition.type} · ${Number(transition.duration || 0).toFixed(1)}s`;
}
function buildTransitionList(slides){
  return slides.map((slide, idx) => {
    if (idx >= slides.length - 1) return { type:'none', duration:0 };
    const t = slide.transitionToNext || { type:'crossfade', duration:0.8 };
    const duration = t.type === 'none' ? 0 : Math.max(0, Number(t.duration) || 0);
    return { type: t.type || 'crossfade', duration };
  });
}
function buildAdvancedTimelinePlan(slides, totalDuration, fallbackFade=0.8){
  const count = Math.max(0, slides?.length || 0);
  if (!count) return { still:0, offsets:[], transitions:[], frames:0, totalDuration:0 };
  const transitions = buildTransitionList(slides);
  let totalTransitions = transitions.reduce((sum, item) => sum + Math.max(0, item.duration || 0), 0);
  const minStill = 0.35;
  const maxTransitionsTotal = Math.max(0, totalDuration - (count * minStill));
  if (totalTransitions > maxTransitionsTotal && totalTransitions > 0){
    const ratio = maxTransitionsTotal / totalTransitions;
    transitions.forEach(item => { item.duration = Number((item.duration * ratio).toFixed(4)); });
    totalTransitions = transitions.reduce((sum, item) => sum + Math.max(0, item.duration || 0), 0);
  }
  let still = (totalDuration - totalTransitions) / count;
  if (!(still > 0)){
    const safeFade = Math.max(0, Math.min(fallbackFade, totalDuration / Math.max(1, (count - 1) || 1)));
    transitions.forEach((item, idx) => { if (idx < count - 1) item.duration = safeFade; });
    totalTransitions = transitions.reduce((sum, item) => sum + Math.max(0, item.duration || 0), 0);
    still = Math.max(minStill, (totalDuration - totalTransitions) / count);
  }
  const planned = (still * count) + totalTransitions;
  if (Math.abs(planned - totalDuration) > 1e-6) still += (totalDuration - planned) / count;
  const offsets = [0];
  for (let i = 1; i < count; i++) offsets[i] = Number((offsets[i-1] + still + (transitions[i-1]?.duration || 0)).toFixed(6));
  return { still, offsets, transitions, frames: getStableExportFrameCount(totalDuration, currentVideoExportFps()), totalDuration };
}
function getTimelineClipSeconds(plan, idx){
  const transitionDur = plan?.transitions?.[idx]?.duration || 0;
  return idx < (plan.offsets.length - 1) ? plan.still + transitionDur : plan.still;
}

function getVideoAdvancedSummary(){
  const total = videoEditorState.slides.length;
  const plan = buildAdvancedTimelinePlan(videoEditorState.slides, currentVideoDuration());
  const each = total ? `${plan.still.toFixed(1)}s base` : '0 slide';
  return { total, each, plan };
}
function syncVideoUiState(){
  const count = videoRecords().length;
  vToggle(VideoAdvancedTools, count > 0);
  if (!count){
    videoEditorState.enabled = false;
    if (BtnVideoAdvanced){
      BtnVideoAdvanced.classList.remove('is-active');
      BtnVideoAdvanced.textContent = 'Avanzate';
    }
    vHide(VideoAdvancedCard);
    revokeSlidePreviewUrls();
    videoEditorState.slides = [];
    videoEditorState.originalOrder = [];
    videoEditorState.activeId = null;
    videoEditorState.selectedIds = [];
    videoEditorState.selectionAnchorId = null;
    updateVideoSelectionInspector();
    renderVideoTimeline();
    renderVideoPreview();
    return;
  }
  if (!videoHasSlides()) buildVideoSlidesFromRecords(videoRecords());
  if (BtnVideoResetOrder) BtnVideoResetOrder.disabled = count <= 1;
  if (VideoAdvancedMeta){
    const info = getVideoAdvancedSummary();
    VideoAdvancedMeta.textContent = `${info.total} slide · ${currentVideoFormatLabel()} · ${info.each}`;
  }
  renderVideoIfNeeded();
}
function setVideoAdvancedEnabled(enabled){
  videoEditorState.enabled = !!enabled && videoRecords().length > 0;
  if (BtnVideoAdvanced){
    BtnVideoAdvanced.classList.toggle('is-active', videoEditorState.enabled);
    BtnVideoAdvanced.textContent = videoEditorState.enabled ? 'Avanzate attive' : 'Avanzate';
  }
  vToggle(VideoAdvancedCard, videoEditorState.enabled);
  if (videoEditorState.enabled) {
    if (!videoHasSlides()) buildVideoSlidesFromRecords(videoRecords());
    renderVideoIfNeeded();
  }
}
function updateVideoSelectionInspector(){
  alignSelectedIds();
  const active = currentActiveSlide();
  const pairs = getSelectedTransitionPairs();
  const selectedOrdered = getSelectedSlideIdsOrdered();
  const selectedCount = selectedOrdered.length;
  if (VideoSelectedName) {
    VideoSelectedName.textContent = selectedCount > 1
      ? `${selectedCount} slide selezionate`
      : (active?.name || 'Nessuna slide selezionata');
  }
  if (VideoSelectedOrder) {
    if (!active) VideoSelectedOrder.textContent = '—';
    else if (selectedCount > 1) {
      const firstIdx = getSlideIndexById(selectedOrdered[0]);
      const lastIdx = getSlideIndexById(selectedOrdered[selectedOrdered.length - 1]);
      VideoSelectedOrder.textContent = `Slide ${firstIdx + 1} → ${lastIdx + 1} su ${videoEditorState.slides.length}`;
    } else {
      const idx = getSlideIndexById(active.id);
      VideoSelectedOrder.textContent = `Slide ${idx + 1} / ${videoEditorState.slides.length}`;
    }
  }
  if (VideoSelectedTransform) {
    if (!active) VideoSelectedTransform.textContent = 'Nessuna inquadratura disponibile.';
    else if (selectedCount > 1) VideoSelectedTransform.textContent = 'Le azioni inquadratura lavorano sulla slide attiva all’interno della selezione.';
    else VideoSelectedTransform.textContent = `Zoom ${Number(active.transform.scale || 1).toFixed(2)} · X ${Number(active.transform.x || 0).toFixed(3)} · Y ${Number(active.transform.y || 0).toFixed(3)}`;
  }
  if (VideoTimelineMeta){
    const transCount = videoEditorState.slides.slice(0, -1).filter(slide => slide.transitionToNext && slide.transitionToNext.type !== 'none' && slide.transitionToNext.duration > 0).length;
    VideoTimelineMeta.textContent = `${videoEditorState.slides.length} slide · ${currentVideoDuration()}s totali · ${transCount} transizioni attive`;
  }
  if (VideoTransitionHint){
    const pairCount = pairs.length;
    if (pairCount > 0) {
      const first = pairs[0];
      const extra = pairCount > 1 ? ` + ${pairCount - 1} collegamenti consecutivi` : '';
      VideoTransitionHint.textContent = `Pronto: ${first.from.name} → ${first.to.name}${extra}. Le transizioni verranno applicate a tutti i passaggi consecutivi selezionati.`;
    } else {
      VideoTransitionHint.textContent = 'Seleziona almeno 2 slide consecutive con Shift oppure Ctrl/Cmd + click per applicare o rimuovere la transizione.';
    }
  }
  if (VideoManageHint){
    if (!selectedCount) VideoManageHint.textContent = 'Seleziona almeno una slide per attivare le azioni.';
    else if (selectedCount === 1) VideoManageHint.textContent = `Pronto: ${active?.name || 'slide'} selezionata. Puoi rimuoverla, sostituirla oppure aggiungere nuove immagini alla timeline.`;
    else VideoManageHint.textContent = `${selectedCount} slide selezionate. Puoi rimuoverle tutte insieme oppure aggiungere altre immagini in coda.`;
  }
  if (BtnVideoApplyTransition) BtnVideoApplyTransition.disabled = pairs.length === 0;
  if (BtnVideoRemoveTransition) BtnVideoRemoveTransition.disabled = pairs.length === 0;
  if (BtnVideoRemoveSelected) BtnVideoRemoveSelected.disabled = selectedCount === 0;
  if (BtnVideoReplaceSelected) BtnVideoReplaceSelected.disabled = selectedCount !== 1;
  if (BtnVideoAddImages) BtnVideoAddImages.disabled = false;
}
function buildVideoTimelineHtml(){
  if (!videoHasSlides()) return '<div class="video-timeline-empty">Carica una cartella immagini e clicca “Avanzate” per comporre il montaggio.</div>';
  const plan = buildAdvancedTimelinePlan(videoEditorState.slides, currentVideoDuration());
  let html = '';
  videoEditorState.slides.forEach((slide, idx) => {
    const isActive = slide.id === videoEditorState.activeId;
    const isSelected = videoEditorState.selectedIds.includes(slide.id);
    const clipSeconds = getTimelineClipSeconds(plan, idx);
    const width = Math.max(132, Math.min(220, 96 + (clipSeconds * 22)));
    html += `
      <button type="button" class="video-timeline-item ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}" data-video-slide-id="${vEscapeHtml(slide.id)}" draggable="true" style="flex-basis:${width}px">
        <span class="video-timeline-thumb"><img src="${slide.previewUrl}" alt="${vEscapeHtml(slide.name)}" draggable="false" /></span>
        <span class="video-timeline-body">
          <span class="video-timeline-topline">
            <strong>${String(idx + 1).padStart(2, '0')}</strong>
            <span>${clipSeconds.toFixed(1)}s</span>
          </span>
          <span class="video-timeline-name">${vEscapeHtml(slide.name)}</span>
        </span>
      </button>`;
    if (idx < videoEditorState.slides.length - 1){
      const tr = slide.transitionToNext || { type:'none', duration:0 };
      const activeGap = tr.type !== 'none' && tr.duration > 0;
      html += `
        <div class="video-timeline-gap ${activeGap ? 'has-transition' : ''}" data-video-gap-after="${vEscapeHtml(slide.id)}">
          <span class="video-transition-pill">${activeGap ? formatTransitionLabel(tr) : 'Nessuna'}</span>
        </div>`;
    }
  });
  return html;
}
function renderVideoTimeline(){
  if (!VideoTimeline) return;
  VideoTimeline.innerHTML = buildVideoTimelineHtml();
}
function updateVideoPreviewRatio(){
  if (!VideoPreviewFrame || !VideoPreviewStage) return;
  const { W, H } = pickVideoSize();
  const ratio = W / H;
  const stageRect = VideoPreviewStage.getBoundingClientRect();
  const availableWidth = Math.max(220, Math.floor(stageRect.width || 0));
  const availableHeight = Math.max(320, Math.floor(stageRect.height || VIDEO_PREVIEW_MAX_HEIGHT));
  let width = Math.round(availableHeight * ratio);
  let height = availableHeight;
  if (width > availableWidth){
    width = availableWidth;
    height = Math.round(width / ratio);
  }
  if (height > availableHeight){
    height = availableHeight;
    width = Math.round(height * ratio);
  }
  VideoPreviewFrame.style.width = `${Math.max(180, width)}px`;
  VideoPreviewFrame.style.height = `${Math.max(180, height)}px`;
  VideoPreviewFrame.style.setProperty('--video-preview-ratio', `${W} / ${H}`);
  try { VideoPreviewFrame.style.aspectRatio = `${W} / ${H}`; } catch {}
}
function computeSlideCoverMetrics(slide, frameW, frameH, naturalW, naturalH){
  const coverScale = Math.max(frameW / naturalW, frameH / naturalH);
  const containScale = Math.min(frameW / naturalW, frameH / naturalH);
  const minMultiplier = vClamp(containScale / coverScale, 0.25, 1);
  return { coverScale, containScale, minMultiplier, maxMultiplier: 4 };
}
function syncActiveSlideSliderBounds(){
  const slide = currentActiveSlide();
  if (!slide || !VidSlideZoom || !VideoPreviewImage || !VideoPreviewImage.naturalWidth) {
    if (VidSlideZoom) {
      VidSlideZoom.min = '0.25';
      VidSlideZoom.max = '4';
      VidSlideZoom.value = '1';
      vUpdateSliderFill(VidSlideZoom);
    }
    return;
  }
  const rect = VideoPreviewFrame.getBoundingClientRect();
  const metrics = computeSlideCoverMetrics(slide, Math.max(rect.width, 1), Math.max(rect.height, 1), VideoPreviewImage.naturalWidth, VideoPreviewImage.naturalHeight);
  slide.transform.minScale = metrics.minMultiplier;
  slide.transform.maxScale = metrics.maxMultiplier;
  slide.transform.scale = vClamp(Number(slide.transform.scale || 1), slide.transform.minScale, slide.transform.maxScale);
  VidSlideZoom.min = String(slide.transform.minScale);
  VidSlideZoom.max = String(slide.transform.maxScale);
  VidSlideZoom.step = String(Math.max(0.01, (slide.transform.maxScale - slide.transform.minScale) / 240));
  VidSlideZoom.value = String(slide.transform.scale);
  vUpdateSliderFill(VidSlideZoom);
}
function applyVideoPreviewTransform(){
  const slide = currentActiveSlide();
  if (!slide || !VideoPreviewImage || !VideoPreviewImage.naturalWidth) return;
  const rect = VideoPreviewFrame.getBoundingClientRect();
  const frameW = Math.max(rect.width, 1);
  const frameH = Math.max(rect.height, 1);
  const metrics = computeSlideCoverMetrics(slide, frameW, frameH, VideoPreviewImage.naturalWidth, VideoPreviewImage.naturalHeight);
  slide.transform.minScale = metrics.minMultiplier;
  slide.transform.maxScale = metrics.maxMultiplier;
  slide.transform.scale = vClamp(Number(slide.transform.scale || 1), slide.transform.minScale, slide.transform.maxScale);
  const drawScale = metrics.coverScale * slide.transform.scale;
  const drawW = Math.round(VideoPreviewImage.naturalWidth * drawScale);
  const drawH = Math.round(VideoPreviewImage.naturalHeight * drawScale);
  const shiftX = Number(slide.transform.x || 0) * frameW;
  const shiftY = Number(slide.transform.y || 0) * frameH;
  VideoPreviewImage.style.width = `${drawW}px`;
  VideoPreviewImage.style.height = `${drawH}px`;
  VideoPreviewImage.style.transform = `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px))`;
  VideoPreviewImage.style.left = '50%';
  VideoPreviewImage.style.top = '50%';
  if (VidSlideZoom) {
    VidSlideZoom.value = String(slide.transform.scale);
    vUpdateSliderFill(VidSlideZoom);
  }
  updateVideoSelectionInspector();
}
function renderVideoPreview(){
  updateVideoPreviewRatio();
  const slide = ensureActiveVideoSlide();
  if (!slide || !videoEditorState.enabled) {
    if (VideoPreviewImage) {
      VideoPreviewImage.removeAttribute('src');
      VideoPreviewImage.classList.add('hidden');
    }
    vShow(VideoPreviewEmpty);
    syncActiveSlideSliderBounds();
    return;
  }
  vHide(VideoPreviewEmpty);
  if (VideoPreviewImage && VideoPreviewImage.dataset.slideId !== slide.id){
    VideoPreviewImage.dataset.slideId = slide.id;
    VideoPreviewImage.onload = () => {
      syncActiveSlideSliderBounds();
      applyVideoPreviewTransform();
    };
    VideoPreviewImage.src = slide.previewUrl;
  }
  VideoPreviewImage?.classList.remove('hidden');
  syncActiveSlideSliderBounds();
  applyVideoPreviewTransform();
}
function renderVideoIfNeeded(){
  if (!videoHasSlides()) return;
  updateVideoSelectionInspector();
  renderVideoTimeline();
  renderVideoPreview();
}
function resetVideoSlideTransform(slide){
  if (!slide) return;
  slide.transform.x = 0;
  slide.transform.y = 0;
  slide.transform.scale = 1;
  syncActiveSlideSliderBounds();
  applyVideoPreviewTransform();
}
function centerVideoSlideTransform(slide){
  if (!slide) return;
  slide.transform.x = 0;
  slide.transform.y = 0;
  applyVideoPreviewTransform();
}
function reorderVideoSlides(dragId, targetId, insertAfter=false){
  if (!dragId || !targetId || dragId === targetId) return;
  const list = videoEditorState.slides.slice();
  const fromIdx = list.findIndex(slide => slide.id === dragId);
  const targetIdxRaw = list.findIndex(slide => slide.id === targetId);
  if (fromIdx < 0 || targetIdxRaw < 0) return;
  const [moved] = list.splice(fromIdx, 1);
  let targetIdx = list.findIndex(slide => slide.id === targetId);
  if (targetIdx < 0) targetIdx = list.length;
  const insertIdx = insertAfter ? targetIdx + 1 : targetIdx;
  list.splice(insertIdx, 0, moved);
  videoEditorState.slides = list;
  alignSelectedIds();
  renderVideoIfNeeded();
}
function resetVideoSlideOrder(){
  if (!videoHasSlides()) return;
  const order = new Map(videoEditorState.originalOrder.map((id, idx) => [id, idx]));
  videoEditorState.slides.sort((a,b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  alignSelectedIds();
  renderVideoIfNeeded();
}
function setTransitionOnSelectedPairs(type, duration){
  const pairs = getSelectedTransitionPairs();
  if (!pairs.length) return false;
  pairs.forEach(pair => {
    pair.from.transitionToNext = {
      type: type || 'crossfade',
      duration: Math.max(0, Number(duration) || 0.8)
    };
  });
  renderVideoIfNeeded();
  return true;
}
function removeTransitionOnSelectedPairs(){
  const pairs = getSelectedTransitionPairs();
  if (!pairs.length) return false;
  pairs.forEach(pair => {
    pair.from.transitionToNext = { type:'none', duration:0 };
  });
  renderVideoIfNeeded();
  return true;
}
function removeSelectedSlides(){
  const selected = new Set(getSelectedSlideIdsOrdered());
  if (!selected.size) return false;
  const removedAll = videoEditorState.slides.filter(slide => selected.has(slide.id));
  revokeSlidePreviewUrls(removedAll);
  videoEditorState.slides = videoEditorState.slides.filter(slide => !selected.has(slide.id));
  if (!videoEditorState.slides.length){
    window.pickedVideo = [];
    TxtFolderVideo.textContent = isMobileGalleryPicker() ? 'Tocca per selezionare più immagini…' : 'Trascina qui una cartella o una o più immagini…';
    BtnClearVideo?.classList.add('hidden');
    setVideoAdvancedEnabled(false);
    syncVideoUiState();
    return true;
  }
  window.pickedVideo = videoEditorState.slides.map(slide => ({ file: slide.file, relPath: slide.relPath || slide.name }));
  videoEditorState.originalOrder = videoEditorState.slides.map(slide => slide.id);
  videoEditorState.activeId = videoEditorState.slides[Math.min(getSlideIndexById(videoEditorState.activeId), videoEditorState.slides.length - 1)]?.id || videoEditorState.slides[0].id;
  videoEditorState.selectedIds = [videoEditorState.activeId];
  videoEditorState.selectionAnchorId = videoEditorState.activeId;
  TxtFolderVideo.textContent = `Selezionati ${videoEditorState.slides.length} file…`;
  syncVideoUiState();
  return true;
}
function replaceSelectedSlideFile(file){
  const selected = getSelectedSlideIdsOrdered();
  if (selected.length !== 1) return false;
  const slide = videoEditorState.slides.find(item => item.id === selected[0]);
  if (!slide) return false;
  try { if (slide.previewUrl) URL.revokeObjectURL(slide.previewUrl); } catch {}
  slide.file = file;
  slide.name = file.name;
  slide.relPath = file.webkitRelativePath || file.name;
  slide.previewUrl = URL.createObjectURL(file);
  slide.transform = { x: 0, y: 0, scale: 1, minScale: 0.25, maxScale: 4 };
  const idx = videoEditorState.slides.findIndex(item => item.id === slide.id);
  if (idx >= 0) {
    window.pickedVideo[idx] = { file, relPath: slide.relPath };
  }
  renderVideoIfNeeded();
  return true;
}
function computeStill(T, N, F){
  let still = (T - (N - 1) * F) / N;
  if (still <= 0){ F = Math.max(0, (T / Math.max(1, N - 1)) * 0.35); still = Math.max(0.3, (T - (N - 1) * F) / N); }
  return { still, fade: F };
}
function buildTimelineVideo(N, T, F, fps){
  const { still, fade } = computeStill(T, N, F);
  const frames = Math.round(T * fps);
  const seg = [];
  for (let i=0;i<N;i++) seg.push(i < N-1 ? (still + fade) : still);
  const offsets = [0];
  for (let i=1;i<N;i++) offsets[i] = offsets[i-1] + seg[i-1];
  return { still, fade, offsets, frames };
}

function sanitizeVideoTransform(transform){
  const safe = transform || {};
  const x = Number.isFinite(Number(safe.x)) ? Number(safe.x) : 0;
  const y = Number.isFinite(Number(safe.y)) ? Number(safe.y) : 0;
  const scale = Number.isFinite(Number(safe.scale)) ? Number(safe.scale) : 1;
  return {
    x: vClamp(x, -3, 3),
    y: vClamp(y, -3, 3),
    scale: vClamp(scale, 0.1, 8)
  };
}
function buildVideoExportSlide(slide, bmp){
  return {
    ...slide,
    bmp,
    transform: sanitizeVideoTransform(slide?.transform)
  };
}
function normalizeVideoTransitionForExport(transition){
  const type = transition?.type || 'none';
  const duration = Math.max(0, Number(transition?.duration) || 0);
  if (type === 'zoomsoft') return { type:'zoomsoft_safe', duration };
  if (type === 'fadeblack') return { type:'fadeblack_safe', duration };
  return { type, duration };
}
function buildVideoExportSlides(slides){
  return (slides || []).map(slide => ({
    ...slide,
    transform: sanitizeVideoTransform(slide?.transform),
    transitionToNext: normalizeVideoTransitionForExport(slide?.transitionToNext)
  }));
}
async function createZoomSoftBitmapVariant(sourceBmp, zoomFactor=1.03){
  if (!sourceBmp) return null;
  const iw = Number(sourceBmp.width) || 0;
  const ih = Number(sourceBmp.height) || 0;
  if (!(iw > 0) || !(ih > 0)) return null;
  const factor = Math.max(1.001, Number(zoomFactor) || 1.03);
  const sw = Math.max(1, Math.round(iw / factor));
  const sh = Math.max(1, Math.round(ih / factor));
  const sx = Math.max(0, Math.round((iw - sw) / 2));
  const sy = Math.max(0, Math.round((ih - sh) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = iw;
  canvas.height = ih;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceBmp, sx, sy, sw, sh, 0, 0, iw, ih);
  return canvas;
}
function drawFallbackTransformedOn(ctx, bmp, W, H, alpha=1){
  const oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha = vClamp(Number(alpha), 0, 1);
  drawCoverOn(ctx, bmp, W, H);
  ctx.globalAlpha = oldAlpha;
}
function getZoomSoftSettleSeconds(plan){
  const still = Math.max(0, Number(plan?.still) || 0);
  return Math.max(0.18, Math.min(0.42, still * 0.32));
}
function easeOutSoft01(v){
  const p = vClamp(Number(v) || 0, 0, 1);
  return 1 - Math.pow(1 - p, 2);
}
function drawCoverOn(ctx, bmp, W, H){
  const iw=bmp.width, ih=bmp.height;
  const cr=W/H, ir=iw/ih;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  let dw,dh,dx,dy;
  if (ir > cr) { dh=H; dw=Math.round(dh*ir); dx=Math.round((W-dw)/2); dy=0; }
  else { dw=W; dh=Math.round(dw/ir); dx=0; dy=Math.round((H-dh)/2); }
  ctx.drawImage(bmp, dx, dy, dw, dh);
}
function drawTransformedOn(ctx, bmp, slide, W, H, opts={}){
  if (!ctx || !bmp) return false;
  const iw = Number(bmp.width) || 0;
  const ih = Number(bmp.height) || 0;
  if (!(iw > 0) || !(ih > 0) || !(W > 0) || !(H > 0)) return false;
  const safeTransform = sanitizeVideoTransform(slide?.transform);
  const coverScale = Math.max(W / iw, H / ih);
  if (!Number.isFinite(coverScale) || !(coverScale > 0)) {
    drawFallbackTransformedOn(ctx, bmp, W, H, opts.alpha ?? 1);
    return true;
  }
  const userScale  = Math.max(0.1, Number(safeTransform.scale || 1));
  const extraScale = Math.max(0.1, Number.isFinite(Number(opts.scaleMul)) ? Number(opts.scaleMul) : 1);
  const dxUser = (safeTransform.x * W) + (Number.isFinite(Number(opts.dx)) ? Number(opts.dx) : 0);
  const dyUser = (safeTransform.y * H) + (Number.isFinite(Number(opts.dy)) ? Number(opts.dy) : 0);
  const drawScale = coverScale * userScale * extraScale;
  const dw = iw * drawScale;
  const dh = ih * drawScale;
  if (!Number.isFinite(dw) || !Number.isFinite(dh) || !(dw > 0) || !(dh > 0)) {
    drawFallbackTransformedOn(ctx, bmp, W, H, opts.alpha ?? 1);
    return true;
  }
  const x = ((W - dw) / 2) + dxUser;
  const y = ((H - dh) / 2) + dyUser;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    drawFallbackTransformedOn(ctx, bmp, W, H, opts.alpha ?? 1);
    return true;
  }
  const oldAlpha = ctx.globalAlpha;
  if (opts.alpha != null) ctx.globalAlpha = vClamp(Number(opts.alpha), 0, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  try {
    ctx.drawImage(bmp, x, y, dw, dh);
  } catch (err) {
    ctx.globalAlpha = oldAlpha;
    drawFallbackTransformedOn(ctx, bmp, W, H, opts.alpha ?? 1);
    return true;
  }
  ctx.globalAlpha = oldAlpha;
  return true;
}
function drawTransitionFrame(ctx, currentItem, nextItem, transition, progress, W, H){
  const type = transition?.type || 'crossfade';
  const p = vClamp(progress, 0, 1);
  if (type === 'fadeblack_safe' || type === 'fadeblack'){
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (p < 0.5) {
      const alpha = 1 - (p * 2);
      if (!drawScaledMotionCoverOn(ctx, currentItem?.bmp, W, H, { alpha })) {
        drawFallbackTransformedOn(ctx, currentItem?.bmp, W, H, alpha);
      }
    } else {
      const alpha = (p - 0.5) * 2;
      if (!drawScaledMotionCoverOn(ctx, nextItem?.bmp, W, H, { alpha })) {
        drawFallbackTransformedOn(ctx, nextItem?.bmp, W, H, alpha);
      }
    }
    return;
  }
  if (type === 'slideleft'){
    drawTransformedOn(ctx, currentItem?.bmp, currentItem, W, H, { dx: -p * W });
    drawTransformedOn(ctx, nextItem?.bmp, nextItem, W, H, { dx: (1 - p) * W });
    return;
  }
  if (type === 'slideright'){
    drawTransformedOn(ctx, currentItem?.bmp, currentItem, W, H, { dx: p * W });
    drawTransformedOn(ctx, nextItem?.bmp, nextItem, W, H, { dx: -(1 - p) * W });
    return;
  }
  if (type === 'crossfade_safe'){
    drawFallbackTransformedOn(ctx, currentItem?.bmp, W, H, 1);
    drawFallbackTransformedOn(ctx, nextItem?.bmp, W, H, p);
    return;
  }
  if (type === 'zoomsoft_safe' || type === 'zoomsoft'){
    const eased = easeOutSoft01(p);
    drawFallbackTransformedOn(ctx, currentItem?.bmp, W, H, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawFallbackTransformedOn(ctx, nextItem?.bmpZoomSoft || nextItem?.bmp, W, H, eased);
    return;
  }
  drawTransformedOn(ctx, currentItem?.bmp, currentItem, W, H, { alpha: 1 });
  drawTransformedOn(ctx, nextItem?.bmp, nextItem, W, H, { alpha: p });
}
function renderSimpleAt(tl, items, W, H, tSec){
  const { still, fade, offsets } = tl;
  const ctx = VidCanvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,W,H);
  let i=0;
  for (; i<items.length; i++){
    const start = offsets[i];
    const segDur = (i < items.length-1 ? (still + fade) : still);
    if (tSec < start + segDur || i === items.length-1) break;
  }
  const start = offsets[i];
  const localT = tSec - start;
  const cur = items[i].bmp;
  if (i < items.length-1 && localT > still){
    const alpha = Math.min(1, (localT - still)/fade);
    ctx.globalAlpha = 1; drawCoverOn(ctx, cur, W, H);
    ctx.globalAlpha = alpha; drawCoverOn(ctx, items[i+1].bmp, W, H);
    ctx.globalAlpha = 1;
  } else {
    drawCoverOn(ctx, cur, W, H);
  }
}
function renderAdvancedAt(tl, items, W, H, tSec){
  const ctx = VidCanvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (!Array.isArray(items) || !items.length) return;
  let i = 0;
  for (; i < items.length; i++){
    const start = Number(tl?.offsets?.[i] || 0);
    const segDur = i < items.length - 1 ? (Number(tl?.still || 0) + Number(tl?.transitions?.[i]?.duration || 0)) : Number(tl?.still || 0);
    if (tSec < start + segDur || i === items.length - 1) break;
  }
  i = Math.max(0, Math.min(i, items.length - 1));
  const start = Number(tl?.offsets?.[i] || 0);
  const localT = Math.max(0, tSec - start);
  const cur = items[i];
  const tr = tl?.transitions?.[i] || { type:'none', duration:0 };
  if (!cur?.bmp) return;
  if (i < items.length - 1 && tr.type !== 'none' && tr.duration > 0 && localT > Number(tl?.still || 0)){
    const progress = (localT - Number(tl?.still || 0)) / Math.max(0.000001, tr.duration);
    drawTransitionFrame(ctx, cur, items[i+1], tr, progress, W, H);
    return;
  }
  const prevTr = i > 0 ? (tl?.transitions?.[i - 1] || { type:'none', duration:0 }) : { type:'none', duration:0 };
  if ((prevTr.type === 'zoomsoft_safe' || prevTr.type === 'zoomsoft') && (cur?.bmpZoomSoft || cur?.bmp)) {
    const settleSeconds = getZoomSoftSettleSeconds(tl);
    if (localT < settleSeconds) {
      const settleProgress = easeOutSoft01(localT / Math.max(0.000001, settleSeconds));
      drawFallbackTransformedOn(ctx, cur.bmpZoomSoft || cur.bmp, W, H, 1);
      drawFallbackTransformedOn(ctx, cur.bmp, W, H, settleProgress);
      return;
    }
  }
  if (!drawTransformedOn(ctx, cur.bmp, cur, W, H, { alpha:1 })) {
    drawCoverOn(ctx, cur.bmp, W, H);
  }
}
async function filesToBitmapsVideo(recs){
  const arr = [];
  for (const r of recs) arr.push({ name:r.file.name, bmp: await loadImageBitmap(r.file) });
  return arr;
}
async function filesToBitmapsVideoAdvanced(slides){
  const arr = [];
  for (const slide of slides || []){
    const bmp = await loadImageBitmap(slide.file);
    const bmpZoomSoft = await createZoomSoftBitmapVariant(bmp, 1.018);
    arr.push({
      ...buildVideoExportSlide(slide, bmp),
      bmpZoomSoft: bmpZoomSoft || bmp
    });
  }
  return arr;
}
async function exportWithWebCodecsMP4Renderer(renderFrame, {T,fps,W,H,bitrate,encoderPreference='auto',forceAllKeyframes=false}){
  if (!isMp4MuxerReady()) throw new Error('mp4-muxer non caricato');
  vShow(ActionProgressWrap);
  if (ActionProgress) ActionProgress.value = 0;
  if (ActionProgressLabel) ActionProgressLabel.textContent = 'Esportazione MP4 in corso…';
  VidCanvas.width = W;
  VidCanvas.height = H;
  const cfgList = await supportsH264WebCodecs(W, H, fps, bitrate, encoderPreference);
  if (!cfgList.length) {
    vHide(ActionProgressWrap);
    throw new Error('H.264 WebCodecs non disponibile in questo browser');
  }
  const totalFrames = getStableExportFrameCount(T, fps);
  const frameDurUs = getFrameDurationUs(fps);
  let lastErr = null;
  for (const cfg of cfgList){
    let encoder = null;
    let encoderErr = null;
    try {
      const muxerTarget = new window.Mp4Muxer.ArrayBufferTarget();
      const muxer = new window.Mp4Muxer.Muxer({
        target: muxerTarget,
        video: { codec:'avc', width:W, height:H, frameRate:fps },
        fastStart:'in-memory',
        firstTimestampBehavior:'offset'
      });
      encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: err => { encoderErr = err; }
      });
      encoder.configure({
        ...cfg,
        width: W,
        height: H,
        framerate: fps,
        bitrate,
        bitrateMode: 'constant',
        avc: { format:'avc' }
      });
      const lowFpsMode = fps <= 24;
      const queueLimit = lowFpsMode ? 2 : 6;
      const flushEvery = lowFpsMode ? 12 : 30;
      for (let f = 0; f < totalFrames; f++){
        renderFrame(getFrameRenderTime(f, totalFrames, fps, T));
        const frame = new VideoFrame(VidCanvas, {
          timestamp: f * frameDurUs,
          duration: frameDurUs
        });
        encoder.encode(frame, {
          keyFrame: forceAllKeyframes || (f === 0) || (f % Math.max(1, Math.round(fps * VIDEO_EXPORT_KEYFRAME_SECONDS)) === 0)
        });
        frame.close();
        if (encoderErr) throw encoderErr;
        if ((encoder.encodeQueueSize || 0) >= queueLimit || (f > 0 && (f % flushEvery) === 0)) {
          await throttleVideoEncoder(encoder, queueLimit);
          if (encoderErr) throw encoderErr;
        }
        if ((f % Math.max(1, Math.round(fps / 2))) === 0 || f === totalFrames - 1){
          updateVideoExportProgress(f + 1, totalFrames);
          await new Promise(resolve => setTimeout(resolve));
        }
      }
      await encoder.flush();
      if (encoderErr) throw encoderErr;
      try { encoder.close(); } catch {}
      muxer.finalize();
      const out = muxerTarget.buffer;
      if (!out || !out.byteLength) throw new Error('MP4 generato vuoto');
      updateVideoExportProgress(totalFrames, totalFrames, 'MP4 pronto…');
      vHide(ActionProgressWrap);
      return new Blob([out], { type:'video/mp4' });
    } catch (err) {
      lastErr = err;
      try { encoder?.close?.(); } catch {}
    }
  }
  vHide(ActionProgressWrap);
  throw (lastErr || new Error('Impossibile generare MP4 con WebCodecs'));
}
async function exportWithMediaRecorderRenderer(renderFrame, {T,fps,W,H,mime,bitrate}){
  vShow(ActionProgressWrap);
  if (ActionProgress) ActionProgress.value = 0;
  if (ActionProgressLabel) ActionProgressLabel.textContent = 'Esportazione MP4 in corso…';
  VidCanvas.width = W;
  VidCanvas.height = H;
  const stream = VidCanvas.captureStream(Math.max(1, fps));
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const parts = [];
  recorder.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start(1000);
  const t0 = performance.now();
  let rafId = 0;
  (function loop(){
    const tSec = Math.min((performance.now() - t0) / 1000, T);
    renderFrame(tSec);
    updateVideoExportProgress(Math.round(tSec * fps), Math.max(1, Math.round(T * fps)), 'Esportazione MP4 in corso…');
    if (tSec < T) rafId = requestAnimationFrame(loop);
  })();
  await new Promise(resolve => setTimeout(resolve, Math.max(0, T * 1000) + 320));
  renderFrame(Math.max(0, T - (1 / Math.max(1, fps))));
  try {
    const track = stream.getVideoTracks?.()[0];
    track?.requestFrame?.();
  } catch {}
  try { recorder.requestData?.(); } catch {}
  await new Promise(resolve => setTimeout(resolve, 180));
  recorder.stop();
  if (rafId) cancelAnimationFrame(rafId);
  await stopped;
  updateVideoExportProgress(Math.max(1, Math.round(T * fps)), Math.max(1, Math.round(T * fps)), 'MP4 pronto…');
  vHide(ActionProgressWrap);
  return new Blob(parts, { type: mime });
}
async function exportVideoBlob(renderFrame, {T,fps,W,H,bitrate,encoderPreference='auto',forceRecorder=false,forceAllKeyframes=false}){
  const mp4Mime = supportsMp4Recorder();
  if (forceRecorder) {
    if (mp4Mime) {
      return { blob: await exportWithMediaRecorderRenderer(renderFrame, {T,fps,W,H,mime:mp4Mime,bitrate}), ext:'mp4' };
    }
    throw new Error('Questo browser non supporta il fallback MP4 richiesto per questa transizione. Apri il tool con Chrome o Edge desktop aggiornato.');
  }
  if (window.VideoEncoder && isMp4MuxerReady()) {
    const webCodecsTask = exportWithWebCodecsMP4Renderer(renderFrame, {T,fps,W,H,bitrate,encoderPreference,forceAllKeyframes});
    return {
      blob: await withVideoExportTimeout(webCodecsTask, Math.max(300000, Math.round(T * 12000)), 'Esportazione MP4'),
      ext:'mp4'
    };
  }
  if (mp4Mime) {
    return { blob: await exportWithMediaRecorderRenderer(renderFrame, {T,fps,W,H,mime:mp4Mime,bitrate}), ext:'mp4' };
  }
  throw new Error('Questo browser non supporta un export MP4 stabile. Apri il tool con Chrome o Edge desktop aggiornato.');
}

async function exportVideoBlobPreferRecorder(renderFrame, {T,fps,W,H,bitrate,encoderPreference='auto',forceRecorder=false,forceAllKeyframes=false}){
  try {
    return await exportVideoBlob(renderFrame, {T,fps,W,H,bitrate,encoderPreference,forceRecorder,forceAllKeyframes});
  } catch (err) {
    console.warn('Export MP4 non disponibile:', err);
    throw err;
  }
}
function downloadVideoBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
  }, 4000);
}
async function exportVideoSlideshow(){
  const title = currentVideoTitle();
  if (!title){ alert('Inserisci “Nome video”.'); return; }
  if (!videoRecords().length){ alert('Carica una cartella con immagini.'); return; }
  const T = currentVideoDuration();
  const fps = currentVideoExportFps();
  const { W, H } = pickVideoSize();
  const bitrate = pickBitrate(W,H,fps);
  let items = [];
  try {
    let blobInfo;
    if (videoEditorState.enabled && videoHasSlides()){
      const slides = buildVideoExportSlides(videoEditorState.slides);
      items = await filesToBitmapsVideoAdvanced(slides);
      const plan = buildAdvancedTimelinePlan(slides, T);
      const hasMotion = videoAdvancedHasMotionTransitions();
      const forceRecorder = false;
      const forceAllKeyframes = videoAdvancedNeedsAllKeyframes();
      const encoderPreference = hasMotion ? currentVideoEncoderPreference() : 'auto';
      renderAdvancedAt(plan, items, W, H, 0);
      blobInfo = await exportVideoBlobPreferRecorder(
        (tSec) => renderAdvancedAt(plan, items, W, H, tSec),
        { T, fps, W, H, bitrate, encoderPreference, forceRecorder, forceAllKeyframes }
      );
    } else {
      const fade = currentVideoFade();
      items = await filesToBitmapsVideo(videoRecords());
      const tl = buildTimelineVideo(items.length, T, fade, fps);
      renderSimpleAt(tl, items, W, H, 0);
      blobInfo = await exportVideoBlobPreferRecorder(
        (tSec) => renderSimpleAt(tl, items, W, H, tSec),
        { T, fps, W, H, bitrate, encoderPreference:'auto', forceRecorder:false }
      );
    }
    downloadVideoBlob(blobInfo.blob, `${slugify(title)}.mp4`);
  } catch (err) {
    console.error('Export slideshow fallito:', err);
    const msg = err?.message || 'Errore durante l’esportazione del video.';
    alert(msg);
  } finally {
    closeVideoBitmapItems(items);
    try {
      const ctx = VidCanvas?.getContext?.('2d', { alpha:false });
      ctx?.clearRect?.(0, 0, VidCanvas.width || 0, VidCanvas.height || 0);
    } catch {}
    if (ActionProgress) ActionProgress.value = 0;
    vHide(ActionProgressWrap);
  }
}

if (DropAreaVideo) {
  const preventV = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaVideo.addEventListener(ev, preventV));
  DropAreaVideo.addEventListener('dragenter', ()=> DropAreaVideo.classList.add('drag-over'));
  DropAreaVideo.addEventListener('dragleave', ()=> DropAreaVideo.classList.remove('drag-over'));
  DropAreaVideo.addEventListener('drop', async (e)=>{
    DropAreaVideo.classList.remove('drag-over');
    const all = await extractDroppedVideoRecords(e.dataTransfer);
    updateVideoPickedRecords(all);
  });
  DropAreaVideo.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    if (!isMobileGalleryPicker()) { input.webkitdirectory = true; input.directory = true; }
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      updateVideoPickedRecords(fl.map(f => ({ file:f, relPath:f.webkitRelativePath || f.name })));
    };
    input.click();
  });
  BtnClearVideo?.addEventListener('click', (e)=>{
    e.stopPropagation();
    window.pickedVideo = [];
    TxtFolderVideo.textContent = isMobileGalleryPicker() ? 'Tocca per selezionare più immagini…' : 'Trascina qui una cartella o una o più immagini…';
    BtnClearVideo.classList.add('hidden');
    revokeSlidePreviewUrls();
    videoEditorState.slides = [];
    videoEditorState.originalOrder = [];
    videoEditorState.activeId = null;
    videoEditorState.selectedIds = [];
    videoEditorState.selectionAnchorId = null;
    setVideoAdvancedEnabled(false);
    syncVideoUiState();
  });
}

BtnVideoAdvanced?.addEventListener('click', () => {
  if (!videoRecords().length) return;
  setVideoAdvancedEnabled(!videoEditorState.enabled);
});
BtnVideoResetOrder?.addEventListener('click', resetVideoSlideOrder);
BtnVideoResetFrame?.addEventListener('click', () => resetVideoSlideTransform(currentActiveSlide()));
BtnVideoCenterFrame?.addEventListener('click', () => centerVideoSlideTransform(currentActiveSlide()));
VidSlideZoom?.addEventListener('input', () => {
  const slide = currentActiveSlide();
  if (!slide) return;
  slide.transform.scale = vClamp(Number(VidSlideZoom.value || 1), Number(VidSlideZoom.min || 0.25), Number(VidSlideZoom.max || 4));
  vUpdateSliderFill(VidSlideZoom);
  applyVideoPreviewTransform();
});
BtnVideoApplyTransition?.addEventListener('click', () => {
  if (!setTransitionOnSelectedPairs(VidTransitionType?.value || 'crossfade', Number(VidTransitionDuration?.value || 0.8))) {
    alert('Seleziona almeno due slide consecutive per aggiungere la transizione.');
  }
});
BtnVideoRemoveTransition?.addEventListener('click', () => {
  if (!removeTransitionOnSelectedPairs()) alert('Seleziona almeno due slide consecutive per rimuovere la transizione.');
});
BtnVideoRemoveSelected?.addEventListener('click', () => {
  if (!removeSelectedSlides()) alert('Seleziona almeno una slide da rimuovere.');
});
BtnVideoReplaceSelected?.addEventListener('click', () => {
  if (getSelectedSlideIdsOrdered().length !== 1) {
    alert('Per sostituire l’immagine seleziona una sola slide.');
    return;
  }
  VideoReplaceInput?.click();
});
VideoReplaceInput?.addEventListener('change', () => {
  const file = VideoReplaceInput.files?.[0];
  if (!file) return;
  if (!/\.(jpe?g|png|tif?f|webp)$/i.test(file.name || '')) {
    alert('Formato non supportato. Seleziona JPG, PNG, TIFF o WEBP.');
    VideoReplaceInput.value = '';
    return;
  }
  replaceSelectedSlideFile(file);
  VideoReplaceInput.value = '';
});
BtnVideoAddImages?.addEventListener('click', () => {
  VideoAddImagesInput?.click();
});
VideoAddImagesInput?.addEventListener('change', () => {
  const files = VideoAddImagesInput.files ? Array.from(VideoAddImagesInput.files) : [];
  if (!files.length) return;
  appendVideoPickedRecords(files.map(file => ({ file, relPath: file.webkitRelativePath || file.name })));
  VideoAddImagesInput.value = '';
});

VideoTimeline?.addEventListener('click', (e) => {
  const item = e.target.closest('[data-video-slide-id]');
  if (!item) return;
  const id = item.dataset.videoSlideId;
  if (e.shiftKey) setVideoSelection(id, { mode:'range' });
  else if (e.metaKey || e.ctrlKey) setVideoSelection(id, { mode:'toggle' });
  else setVideoSelection(id, { mode:'single' });
});
VideoTimeline?.addEventListener('dragstart', (e) => {
  const item = e.target.closest('[data-video-slide-id]');
  if (!item) return;
  videoEditorState.dragSlideId = item.dataset.videoSlideId;
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', videoEditorState.dragSlideId || ''); } catch {}
});
VideoTimeline?.addEventListener('dragend', () => {
  videoEditorState.dragSlideId = null;
  Array.from(VideoTimeline.querySelectorAll('.video-timeline-item')).forEach(el => el.classList.remove('drop-before', 'drop-after'));
});
VideoTimeline?.addEventListener('dragover', (e) => {
  const item = e.target.closest('[data-video-slide-id]');
  if (!item || !videoEditorState.dragSlideId) return;
  e.preventDefault();
  const rect = item.getBoundingClientRect();
  const after = (e.clientX - rect.left) > (rect.width / 2);
  Array.from(VideoTimeline.querySelectorAll('.video-timeline-item')).forEach(el => el.classList.remove('drop-before', 'drop-after'));
  item.classList.add(after ? 'drop-after' : 'drop-before');
  videoEditorState.hoverInsertAfter = after;
});
VideoTimeline?.addEventListener('drop', (e) => {
  const item = e.target.closest('[data-video-slide-id]');
  if (!item || !videoEditorState.dragSlideId) return;
  e.preventDefault();
  reorderVideoSlides(videoEditorState.dragSlideId, item.dataset.videoSlideId, !!videoEditorState.hoverInsertAfter);
});

VideoPreviewFrame?.addEventListener('pointerdown', (e) => {
  if (!videoEditorState.enabled || !currentActiveSlide()) return;
  videoEditorState.previewDragging = true;
  videoEditorState.previewPointerId = e.pointerId;
  videoEditorState.previewStartX = e.clientX;
  videoEditorState.previewStartY = e.clientY;
  VideoPreviewImage?.classList.add('is-grabbing');
  try { VideoPreviewFrame.setPointerCapture(e.pointerId); } catch {}
});
VideoPreviewFrame?.addEventListener('pointermove', (e) => {
  const slide = currentActiveSlide();
  if (!videoEditorState.previewDragging || !slide) return;
  if (videoEditorState.previewPointerId != null && e.pointerId !== videoEditorState.previewPointerId) return;
  const rect = VideoPreviewFrame.getBoundingClientRect();
  slide.transform.x += (e.clientX - videoEditorState.previewStartX) / Math.max(rect.width, 1);
  slide.transform.y += (e.clientY - videoEditorState.previewStartY) / Math.max(rect.height, 1);
  videoEditorState.previewStartX = e.clientX;
  videoEditorState.previewStartY = e.clientY;
  applyVideoPreviewTransform();
});
function endVideoPreviewPointer(e){
  if (videoEditorState.previewPointerId != null && e.pointerId !== videoEditorState.previewPointerId) return;
  videoEditorState.previewDragging = false;
  VideoPreviewImage?.classList.remove('is-grabbing');
  try { VideoPreviewFrame?.releasePointerCapture(videoEditorState.previewPointerId); } catch {}
  videoEditorState.previewPointerId = null;
}
VideoPreviewFrame?.addEventListener('pointerup', endVideoPreviewPointer);
VideoPreviewFrame?.addEventListener('pointercancel', endVideoPreviewPointer);
window.addEventListener('resize', () => {
  if (!videoEditorState.enabled) return;
  renderVideoPreview();
  renderVideoTimeline();
});
[VidDuration, VidFmtH, VidFmtV, VidFmtS].forEach(el => {
  el?.addEventListener('change', () => {
    syncVideoUiState();
    if (videoEditorState.enabled) {
      renderVideoPreview();
      renderVideoTimeline();
    }
  });
  el?.addEventListener('click', () => {
    syncVideoUiState();
    if (videoEditorState.enabled) {
      renderVideoPreview();
      renderVideoTimeline();
    }
  });
});

try { vUpdateSliderFill(VidSlideZoom); } catch {}
try { syncVideoUiState(); } catch {}
window.exportVideoSlideshow = exportVideoSlideshow;
