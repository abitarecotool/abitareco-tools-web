(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const MODE = 'slidebuilder';
  const COLORS = {
    red: 'C4162B',
    burgundy: '4C1428',
    rose: 'E9A0A7',
    tortora: 'EAE3DA',
    black: '1A171B',
    grayDark: '787878',
    grayLight: 'E8E8E8',
    bg: 'F3F1EF'
  };
  const PALETTE = [COLORS.red, COLORS.burgundy, COLORS.rose, COLORS.tortora, COLORS.black, COLORS.grayDark];
  const PRESETS = {
    graph: [
      ['Categoria','Valore'],
      ['Milano','1000'],
      ['Roma','500'],
      ['Estero','600']
    ],
    timeline: [
      ['Data','Titolo','Dettaglio'],
      ['Gen 2026','Acquisizione','Avvio progetto'],
      ['Feb 2026','Strategia','Definizione concept'],
      ['Mar 2026','Campagna','Attivazione canali'],
      ['Apr 2026','Lancio','Go-live']
    ],
    table: [
      ['Indicatore','Q1','Q2','Q3'],
      ['Lead','120','145','162'],
      ['Appuntamenti','34','38','41'],
      ['Vendite','5','7','8']
    ]
  };

  let state = {
    type: 'graph',
    chartType: 'bar',
    grid: JSON.parse(JSON.stringify(PRESETS.graph))
  };

  function cloneGrid(src){ return src.map(row => row.slice()); }
  function currentUser(){ try { return window.Auth && typeof window.Auth.current === 'function' ? window.Auth.current() : null; } catch { return null; } }
  function isAdmin(){ return (currentUser()?.role || '') === 'admin'; }
  function notify(msg, isError){
    try { if (typeof window.showToast === 'function') return window.showToast(msg, isError ? 'error' : 'ok'); } catch {}
    if (isError) console.error(msg); else console.log(msg);
  }
  function esc(text){
    return String(text ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function num(v){
    const cleaned = String(v ?? '').replace(/\./g,'').replace(',', '.').replace(/%/g,'').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  function hasCard(){ return !!document.getElementById('SlideBuilderCard'); }

  function ensureStateFromGrid(){
    const table = $('#SbDataGrid');
    if (!table) return;
    const rows = [];
    const trList = Array.from(table.querySelectorAll('tr')).slice(1); // skip top header labels row
    trList.forEach(tr => {
      const vals = Array.from(tr.querySelectorAll('input[data-cell]')).map(inp => inp.value || '');
      rows.push(vals);
    });
    state.grid = rows;
  }

  function buildGrid(){
    const table = $('#SbDataGrid');
    if (!table) return;
    const maxCols = Math.max(...state.grid.map(r => r.length), 0);
    const labelsRow = ['#'];
    for (let i = 0; i < maxCols; i++) labelsRow.push(String.fromCharCode(65 + i));
    labelsRow.push('');

    let html = '<tr>';
    html += `<th class="sb-row-head">${labelsRow[0]}</th>`;
    for (let c = 1; c < labelsRow.length-1; c++) html += `<th><input value="${labelsRow[c]}" disabled /></th>`;
    html += `<th class="sb-actions-cell"></th></tr>`;

    state.grid.forEach((row, rIdx) => {
      html += `<tr><th class="sb-row-head">${rIdx + 1}</th>`;
      for (let c = 0; c < maxCols; c++) {
        html += `<td><input data-cell="1" data-r="${rIdx}" data-c="${c}" value="${esc(row[c] || '')}" /></td>`;
      }
      html += `<td class="sb-actions-cell"><button type="button" class="sb-trash-btn" data-del-row="${rIdx}" title="Elimina riga">✕</button></td></tr>`;
    });
    table.innerHTML = html;
    updateHint();
    refreshPreview();
  }

  function updateHint(){
    const hint = $('#SbDataHint');
    if (!hint) return;
    if (state.type === 'graph') hint.textContent = 'Suggerito: 2 colonne (Categoria / Valore). Puoi incollare da Excel direttamente nella griglia.';
    else if (state.type === 'timeline') hint.textContent = 'Suggerito: 3 colonne (Data / Titolo / Dettaglio). Una riga = una milestone.';
    else hint.textContent = 'Per la tabella, la prima riga è l’intestazione. Le righe successive sono i dati.';
  }

  function addRow(){
    const cols = Math.max(...state.grid.map(r => r.length), 2);
    state.grid.push(Array.from({ length: cols }, () => ''));
    buildGrid();
  }

  function addCol(){
    state.grid = state.grid.map(row => row.concat(''));
    buildGrid();
  }

  function deleteRow(idx){
    if (state.grid.length <= 2) return;
    state.grid.splice(idx, 1);
    buildGrid();
  }

  async function pasteFromExcel(){
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const rows = text.split(/?
/).filter(Boolean).map(line => line.split(/	/));
      if (!rows.length) return;
      state.grid = rows;
      buildGrid();
      notify('Dati incollati dalla clipboard.');
    } catch (err) {
      notify('Clipboard non accessibile. Copia da Excel e riprova cliccando il bottone.', true);
    }
  }

  function setType(type){
    state.type = type;
    state.grid = cloneGrid(PRESETS[type]);
    const typeBtns = $$('#SbTypeSwitch .platform-switch-btn');
    typeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
    $('#SbChartTypeWrap')?.classList.toggle('hidden', type !== 'graph');
    buildGrid();
  }

  function setChart(chart){
    state.chartType = chart;
    $$('#SbChartSwitch .platform-switch-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.chart === chart));
    refreshPreview();
  }

  function parseGraph(){
    ensureStateFromGrid();
    const rows = state.grid.slice(1).filter(r => (r[0] || '').trim() || (r[1] || '').trim());
    const labels = rows.map(r => String(r[0] || '').trim()).filter(Boolean);
    const values = rows.map(r => num(r[1])).slice(0, labels.length);
    return { labels, values };
  }

  function parseTimeline(){
    ensureStateFromGrid();
    return state.grid.slice(1)
      .map(r => ({ date: String(r[0] || '').trim(), title: String(r[1] || '').trim(), detail: String(r[2] || '').trim() }))
      .filter(x => x.date || x.title || x.detail);
  }

  function parseTable(){
    ensureStateFromGrid();
    const headers = state.grid[0] || [];
    const rows = state.grid.slice(1).filter(r => r.some(v => String(v || '').trim()));
    return { headers, rows };
  }

  function polarToCartesian(cx, cy, r, angle){
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle){
    const outerStart = polarToCartesian(cx, cy, rOuter, endAngle);
    const outerEnd = polarToCartesian(cx, cy, rOuter, startAngle);
    const innerStart = polarToCartesian(cx, cy, rInner, startAngle);
    const innerEnd = polarToCartesian(cx, cy, rInner, endAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    if (rInner <= 0) return `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y} Z`;
    return [`M ${outerStart.x} ${outerStart.y}`, `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`, `L ${innerStart.x} ${innerStart.y}`, `A ${rInner} ${rInner} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`, 'Z'].join(' ');
  }
  function svgDataUri(svg){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  function renderBar(labels, values){
    const W=1080, H=520, left=70, right=16, top=22, bottom=80;
    const plotW=W-left-right, plotH=H-top-bottom, max=Math.max(...values,1), gap=labels.length?plotW/labels.length:80, bw=Math.min(84, gap*0.58);
    let out='';
    [0.25,0.5,0.75,1].forEach(step => {
      const y=top+plotH-(plotH*step);
      out += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W-right}" y2="${y.toFixed(1)}" stroke="#D9D2CB" stroke-width="1" />`;
      out += `<text x="${left-10}" y="${y+4}" text-anchor="end" font-family="Manrope" font-size="14" fill="#787878">${Math.round(max*step)}</text>`;
    });
    labels.forEach((label,i)=>{
      const val = values[i] || 0;
      const h = (val/max)*plotH;
      const x = left + i*gap + (gap-bw)/2;
      const y = top + plotH - h;
      const color = '#' + PALETTE[i % PALETTE.length];
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="12" fill="${color}" />`;
      out += `<text x="${(x+bw/2).toFixed(1)}" y="${(y-10).toFixed(1)}" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="700" fill="#1A171B">${val}</text>`;
      out += `<text x="${(x+bw/2).toFixed(1)}" y="${H-30}" text-anchor="middle" font-family="Manrope" font-size="14" fill="#1A171B">${esc(label)}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="transparent"/>${out}<line x1="${left}" y1="${top+plotH}" x2="${W-right}" y2="${top+plotH}" stroke="#9F9A95" stroke-width="1.2"/></svg>`;
  }

  function renderLine(labels, values){
    const W=1080,H=520,left=70,right=16,top=28,bottom=80;
    const plotW=W-left-right, plotH=H-top-bottom, max=Math.max(...values,1), min=Math.min(...values,0), span=Math.max(max-min,1);
    const xs = labels.map((_,i)=> left + (plotW*i)/Math.max(labels.length-1,1));
    const ys = values.map(v=> top + plotH - ((v-min)/span)*plotH);
    const points = xs.map((x,i)=>`${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    let out='';
    [0,0.25,0.5,0.75,1].forEach(step=>{ const y=top+plotH-plotH*step; const label=Math.round(min+step*span); out += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W-right}" y2="${y.toFixed(1)}" stroke="#D9D2CB" stroke-width="1" /><text x="${left-10}" y="${y+4}" text-anchor="end" font-family="Manrope" font-size="14" fill="#787878">${label}</text>`;});
    out += `<polyline fill="none" stroke="#4C1428" stroke-width="4" points="${points}" stroke-linecap="round" stroke-linejoin="round"/>`;
    xs.forEach((x,i)=>{ out += `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="6" fill="#C4162B" stroke="#fff" stroke-width="3" /><text x="${x.toFixed(1)}" y="${(ys[i]-14).toFixed(1)}" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="700" fill="#1A171B">${values[i]}</text><text x="${x.toFixed(1)}" y="${H-30}" text-anchor="middle" font-family="Manrope" font-size="14" fill="#1A171B">${esc(labels[i])}</text>`;});
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="transparent"/>${out}</svg>`;
  }

  function renderPie(labels, values, doughnut){
    const W=1080,H=520,cx=310,cy=260,rOuter=162,rInner=doughnut?92:0,total=values.reduce((a,b)=>a+b,0)||1;
    let angle=0,out='',legend='';
    labels.forEach((label,i)=>{ const value=values[i]||0; const next=angle+(value/total)*360; const pct=(value/total)*100; const color='#'+PALETTE[i%PALETTE.length]; out += `<path d="${arcPath(cx,cy,rOuter,rInner,angle,next)}" fill="${color}" />`; const mid=angle+(next-angle)/2; const p=polarToCartesian(cx,cy,doughnut?130:110,mid); out += `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" font-family="Manrope" font-size="13" font-weight="700" fill="#1A171B">${Math.round(pct)}%</text>`; const ly=118+i*56; legend += `<rect x="610" y="${ly-14}" width="20" height="20" rx="5" fill="${color}" /><text x="642" y="${ly}" font-family="Manrope" font-size="18" fill="#1A171B">${esc(label)}</text><text x="965" y="${ly}" text-anchor="end" font-family="Manrope" font-size="18" font-weight="700" fill="#4C1428">${value}</text>`; angle=next; });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="transparent"/>${out}${legend}</svg>`;
  }

  function renderTimeline(items){
    const W=1080,H=520,startX=110,endX=970,centerY=270,gap=items.length>1?(endX-startX)/(items.length-1):0;
    let out = `<line x1="${startX}" y1="${centerY}" x2="${endX}" y2="${centerY}" stroke="#D5CEC7" stroke-width="8" stroke-linecap="round" />`;
    items.forEach((item,i)=>{ const x=startX+gap*i,top=i%2===0,boxY=top?58:328,anchorY=top?boxY+94:boxY-18,color=i%3===0?'#'+COLORS.red:(i%3===1?'#'+COLORS.burgundy:'#'+COLORS.rose); out += `<line x1="${x}" y1="${centerY}" x2="${x}" y2="${anchorY}" stroke="#B29A9F" stroke-width="2" /><circle cx="${x}" cy="${centerY}" r="14" fill="${color}" stroke="#fff" stroke-width="5" /><rect x="${x-120}" y="${boxY}" rx="16" width="240" height="112" fill="#fff" stroke="#E3DDD6" /><text x="${x-100}" y="${boxY+26}" font-family="Manrope" font-size="16" font-weight="700" fill="#C4162B">${esc(item.date)}</text><text x="${x-100}" y="${boxY+54}" font-family="PP Pangaia, Georgia, serif" font-size="22" font-weight="600" fill="#4C1428">${esc(item.title)}</text><text x="${x-100}" y="${boxY+82}" font-family="Manrope" font-size="13" fill="#1A171B">${esc(item.detail)}</text>`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="transparent"/>${out}</svg>`;
  }

  function renderTableShell(headers, rows){
    const head = '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    const body = rows.map(r => '<tr>' + headers.map((_,i)=>`<td>${esc(r[i]||'')}</td>`).join('') + '</tr>').join('');
    return `<div class="sb-preview-table-shell"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function updateStats(boxes){ $('#SbQuickStats').innerHTML = boxes.join(''); }

  function refreshPreview(){
    if (!hasCard()) return;
    $('#SbPreviewTitle').textContent = ($('#SbTitle')?.value || '').trim() || 'Inserire qui il titolo';
    $('#SbPreviewDescription').textContent = ($('#SbDescription')?.value || '').trim() || 'Inserire piccola descrizione';
    $('#SbPreviewFoot').textContent = `© 2026 Abitare Co. | All rights reserved.  Fonte: ${($('#SbSource')?.value || '').trim() || 'inserire qui fonte.'}`;
    const canvas = $('#SbPreviewCanvas');
    if (!canvas) return;

    if (state.type === 'graph') {
      const { labels, values } = parseGraph();
      if (!labels.length) { canvas.innerHTML = '<div class="sb-empty-state">Inserisci almeno una categoria e un valore per vedere la preview.</div>'; updateStats([]); return; }
      let svg = renderBar(labels, values);
      if (state.chartType === 'line') svg = renderLine(labels, values);
      if (state.chartType === 'pie') svg = renderPie(labels, values, false);
      if (state.chartType === 'doughnut') svg = renderPie(labels, values, true);
      canvas.innerHTML = svg;
      const total = values.reduce((a,b)=>a+b,0);
      const topIdx = values.reduce((best,v,i,arr)=>v>(arr[best]||-Infinity)?i:best,0);
      updateStats([
        `<div class="sb-stat"><strong>${labels.length}</strong><span>Categorie</span></div>`,
        `<div class="sb-stat"><strong>${total}</strong><span>Valore totale</span></div>`,
        `<div class="sb-stat"><strong>${esc(labels[topIdx]||'—')}</strong><span>Top categoria</span></div>`
      ]);
      return;
    }

    if (state.type === 'timeline') {
      const items = parseTimeline();
      if (!items.length) { canvas.innerHTML = '<div class="sb-empty-state">Inserisci almeno una milestone per vedere la preview.</div>'; updateStats([]); return; }
      canvas.innerHTML = renderTimeline(items);
      updateStats([
        `<div class="sb-stat"><strong>${items.length}</strong><span>Milestone</span></div>`,
        `<div class="sb-stat"><strong>${esc(items[0]?.date||'—')}</strong><span>Inizio</span></div>`,
        `<div class="sb-stat"><strong>${esc(items[items.length-1]?.date||'—')}</strong><span>Fine</span></div>`
      ]);
      return;
    }

    const { headers, rows } = parseTable();
    if (!headers.length || !rows.length) { canvas.innerHTML = '<div class="sb-empty-state">Compila intestazioni e righe per vedere la preview della tabella.</div>'; updateStats([]); return; }
    canvas.innerHTML = renderTableShell(headers, rows);
    updateStats([
      `<div class="sb-stat"><strong>${headers.length}</strong><span>Colonne</span></div>`,
      `<div class="sb-stat"><strong>${rows.length}</strong><span>Righe dati</span></div>`,
      `<div class="sb-stat"><strong>${esc(headers[0]||'—')}</strong><span>Prima intestazione</span></div>`
    ]);
  }

  async function exportPpt(){
    if (!window.PptxGenJS) throw new Error('Libreria PPT non caricata.');
    const title = ($('#SbTitle')?.value || '').trim() || 'Inserire qui il titolo';
    const description = ($('#SbDescription')?.value || '').trim() || 'Inserire piccola descrizione';
    const source = ($('#SbSource')?.value || '').trim() || 'inserire qui fonte.';
    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Abitare Co.';
    pptx.company = 'Abitare Co.';
    pptx.subject = 'Slide Builder';
    pptx.title = title;
    pptx.lang = 'it-IT';
    pptx.theme = { headFontFace: 'PP Pangaia', bodyFontFace: 'Manrope', lang: 'it-IT' };
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    slide.addText(title, { x:1.34, y:0.28, w:10.66, h:0.62, align:'center', valign:'mid', fontFace:'PP Pangaia', fontSize:28, bold:true, color:COLORS.burgundy, margin:0 });
    slide.addText(description, { x:2.0, y:1.16, w:9.3, h:0.26, align:'center', valign:'mid', fontFace:'Manrope', fontSize:10.5, color:COLORS.burgundy, margin:0 });
    const area = { x:0.86, y:1.78, w:11.60, h:4.82 };

    if (state.type === 'graph') {
      const { labels, values } = parseGraph();
      if (!labels.length) throw new Error('Inserisci almeno una categoria e un valore.');
      let svg = renderBar(labels, values);
      if (state.chartType === 'line') svg = renderLine(labels, values);
      if (state.chartType === 'pie') svg = renderPie(labels, values, false);
      if (state.chartType === 'doughnut') svg = renderPie(labels, values, true);
      slide.addImage({ data: svgDataUri(svg), x:area.x, y:area.y, w:area.w, h:area.h });
    } else if (state.type === 'timeline') {
      const items = parseTimeline();
      if (!items.length) throw new Error('Inserisci almeno una milestone per la timeline.');
      slide.addImage({ data: svgDataUri(renderTimeline(items)), x:area.x, y:area.y, w:area.w, h:area.h });
    } else {
      const { headers, rows } = parseTable();
      if (!headers.length || !rows.length) throw new Error('Compila intestazioni e righe della tabella.');
      slide.addTable([headers, ...rows], {
        x:area.x, y:area.y, w:area.w, h:area.h,
        border:{ type:'solid', color:'D8D1CA', pt:0.75 },
        fontFace:'Manrope', fontSize:10.5, color:COLORS.black,
        fill:COLORS.tortora, fillHeader:COLORS.burgundy, colorHeader:'FFFFFF', boldHeader:true,
        margin:0.08, rowH:0.36, autoFit:true, valign:'mid'
      });
    }

    slide.addText(`© 2026 Abitare Co. | All rights reserved.  Fonte: ${source}`, { x:0.08, y:7.02, w:7.2, h:0.18, fontFace:'Manrope', fontSize:7.4, color:'6E6A67', margin:0 });
    try { slide.addImage({ path:'./assets/logo.png', x:11.86, y:6.78, w:1.22, h:0.32 }); }
    catch { slide.addText('Abitare co.', { x:11.60, y:6.76, w:1.5, h:0.22, fontFace:'Times New Roman', fontSize:18, color:COLORS.black, align:'right', margin:0 }); }

    const safeName = String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42) || 'slide-builder';
    await pptx.writeFile({ fileName: `${safeName}.pptx` });
    notify('PPT esportato con successo.');
  }

  function bind(){
    if (!hasCard() || document.getElementById('SlideBuilderCard').dataset.bound === '1') return;
    document.getElementById('SlideBuilderCard').dataset.bound = '1';

    buildGrid();

    document.getElementById('SlideBuilderCard').addEventListener('input', (e) => {
      if (e.target.matches('#SbTitle, #SbDescription, #SbSource, #SbDataGrid input[data-cell]')) refreshPreview();
    });

    document.getElementById('SlideBuilderCard').addEventListener('click', async (e) => {
      const typeBtn = e.target.closest('#SbTypeSwitch .platform-switch-btn');
      if (typeBtn) { setType(typeBtn.dataset.type); return; }
      const chartBtn = e.target.closest('#SbChartSwitch .platform-switch-btn');
      if (chartBtn) { setChart(chartBtn.dataset.chart); return; }
      const delBtn = e.target.closest('[data-del-row]');
      if (delBtn) { deleteRow(Number(delBtn.dataset.delRow)); return; }
      if (e.target.id === 'SbAddRow') { addRow(); return; }
      if (e.target.id === 'SbAddCol') { addCol(); return; }
      if (e.target.id === 'SbPasteExcel') { await pasteFromExcel(); return; }
      if (e.target.id === 'SbResetGrid') { state.grid = cloneGrid(PRESETS[state.type]); buildGrid(); return; }
    });

    window.exportSlideBuilderPpt = exportPpt;
    refreshPreview();
  }

  function init(){
    if (!hasCard()) return;
    if (!isAdmin()) return;
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
