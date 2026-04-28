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

if (DropAreaVideo) {
  const preventV = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaVideo.addEventListener(ev, preventV));
  DropAreaVideo.addEventListener('dragenter', ()=> DropAreaVideo.classList.add('drag-over'));
  DropAreaVideo.addEventListener('dragleave', ()=> DropAreaVideo.classList.remove('drag-over'));
  DropAreaVideo.addEventListener('drop', async (e)=>{
    DropAreaVideo.classList.remove('drag-over');
    const all = await readDroppedDirectory(e.dataTransfer);
    pickedVideo = all
      .filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name))
      .sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
    TxtFolderVideo.textContent = pickedVideo.length
      ? `Selezionati ${pickedVideo.length} file…`
      : 'Nessun file supportato.';
    BtnClearVideo.classList.toggle('hidden', pickedVideo.length === 0);
  });
  DropAreaVideo.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true; input.accept = 'image/*';
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      pickedVideo = fl
        .filter(f => /\.(jpe?g|png|tif?f|webp)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }))
        .sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
      TxtFolderVideo.textContent = pickedVideo.length
        ? `Selezionati ${pickedVideo.length} file…`
        : 'Nessun file supportato.';
      BtnClearVideo.classList.toggle('hidden', pickedVideo.length === 0);
    };
    input.click();
  });
  BtnClearVideo?.addEventListener('click', (e)=>{
    e.stopPropagation();
    pickedVideo = [];
    TxtFolderVideo.textContent = 'Trascina qui la cartella…';
    BtnClearVideo.classList.add('hidden');
  });
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
function renderAt(tl, items, W, H, tSec){
  const { still, fade, offsets } = tl;
  const ctx = VidCanvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
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
async function filesToBitmapsVideo(recs){
  const arr = [];
  for (const r of recs){ arr.push({ name:r.file.name, bmp: await loadImageBitmap(r.file) }); }
  return arr;
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
  const c=[
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4'
  ];
  for (const m of c){
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return null;
}
async function supportsH264WebCodecs(){
  if (!('VideoEncoder' in window)) return null;
  try {
    const test = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E01E', width:1080, height:1080, framerate:30, hardwareAcceleration:'prefer-hardware' });
    return test.supported ? test.config : null;
  } catch { return null; }
}
async function exportWithWebCodecsMP4(items, {T,F,fps,W,H,bitrate}){
  if (!window.MP4Box) throw new Error('MP4Box.js non caricato');
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const cfg = await supportsH264WebCodecs();
  if (!cfg) throw new Error('H.264 WebCodecs non disponibile');
  const encConfig = { ...cfg, width:W, height:H, framerate:fps, bitrate, bitrateMode:'constant', avc:{ format:'annexb' } };
  const mp4 = MP4Box.createFile();
  const chunks = [];
  const segCtx = { nextFileStart: 0 };
  mp4.onSegment = (id, user, buffer) => { buffer.fileStart = user.nextFileStart; user.nextFileStart += buffer.byteLength; chunks.push(buffer); };
  let trackId = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const ts = chunk.timestamp;
      const dur = chunk.duration || Math.round(1e6 / fps);
      const key = (chunk.type === 'key');
      const buf = new Uint8Array(chunk.byteLength); chunk.copyTo(buf);
      if (!trackId && meta?.decoderConfig?.description){
        trackId = mp4.addTrack({ timescale: 1e6, width: W, height: H, h264: { avcDecoderConfigRecord: meta.decoderConfig.description } });
        mp4.setSegmentOptions(trackId, segCtx, { nbSamples: 1e6 });
        const inits = mp4.initializeSegmentation();
        inits.forEach(seg => { seg.buffer.fileStart = segCtx.nextFileStart; segCtx.nextFileStart += seg.buffer.byteLength; chunks.push(seg.buffer); });
      }
      mp4.addSample(trackId, buf.buffer, { dts:ts, cts:ts, duration:dur, is_sync:key });
    }, error: e => console.error(e)
  });
  encoder.configure(encConfig);
  const total = tl.frames;
  const frameDurUs = Math.round(1e6 / fps);
  for (let f=0; f<total; f++){
    renderAt(tl, items, W, H, f / fps);
    const vf = new VideoFrame(VidCanvas, { timestamp: f * frameDurUs });
    encoder.encode(vf, { keyFrame: (f===0) || (f % (fps*2) === 0) });
    vf.close();
    if ((f % fps) === 0){
      ActionProgress.value = Math.round((f/total)*100);
      await new Promise(r => setTimeout(r));
    }
  }
  await encoder.flush();
  encoder.close();
  mp4.flush();
  hideEl(ActionProgressWrap);
  return new Blob(chunks, { type:'video/mp4' });
}
async function exportWithMediaRecorder(items, {T,F,fps,W,H,mime,bitrate}){
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const str = VidCanvas.captureStream(fps);
  const rec = new MediaRecorder(str, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 128000 });
  const parts = [];
  rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
  const stopped = new Promise(res => rec.onstop = res);
  rec.start(Math.min(1000, Math.round(1000/fps)));
  const t0 = performance.now(); let rafId = 0;
  (function loop(){
    const now = performance.now();
    const tSec = Math.min((now - t0)/1000, T);
    renderAt(tl, items, W, H, tSec);
    ActionProgress.value = Math.min(100, Math.round((tSec/T)*100));
    if (tSec < T) rafId = requestAnimationFrame(loop);
  })();
  await new Promise(r => setTimeout(r, Math.max(0, T*1000)));
  rec.stop();
  if (rafId) cancelAnimationFrame(rafId);
  await stopped;
  hideEl(ActionProgressWrap);
  return new Blob(parts, { type: mime });
}
async function exportVideoSlideshow(){
  const title = (VidTitle?.value || '').trim();
  if (!title){ alert('Inserisci “Nome video”.'); return; }
  if (!pickedVideo.length){ alert('Carica una cartella con immagini.'); return; }
  const T = parseFloat(VidDuration.value);
  const F = 1.0;  const fps = 30;
  const { W, H } = pickVideoSize(); const bitrate = pickBitrate(W,H,fps);
  const items = await filesToBitmapsVideo(pickedVideo);
  const h264Cfg = await supportsH264WebCodecs(); const mp4Mime = supportsMp4Recorder();
  let blob, filename;
  if (h264Cfg && window.MP4Box){ blob = await exportWithWebCodecsMP4(items, {T,F,fps,W,H,bitrate}); filename = `${slugify(title)}.mp4`; }
  else if (mp4Mime){ blob = await exportWithMediaRecorder(items, {T,F,fps,W,H,mime:mp4Mime,bitrate}); filename = `${slugify(title)}.mp4`; }
  else { const webmMime = (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    blob = await exportWithMediaRecorder(items, {T,F,fps,W,H,mime:webmMime,bitrate}); filename = `${slugify(title)}.webm`; }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download= filename; a.click(); URL.revokeObjectURL(url);
}

