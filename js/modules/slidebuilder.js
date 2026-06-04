(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const COLORS = { red:'C4162B', burgundy:'4C1428', rose:'E9A0A7', tortora:'EAE3DA', black:'1A171B', grayDark:'787878', grayLight:'E8E8E8', bg:'F3F1EF' };
  const PALETTE = [COLORS.red, COLORS.burgundy, COLORS.rose, COLORS.tortora, COLORS.black, COLORS.grayDark];
  const PRESETS = {
    graph: [['Categoria','Valore'],['',''],['',''],['','']],
    timeline: [['Data','Titolo','Dettaglio'],['','',''],['','',''],['','','']],
    table: [['Colonna 1','Colonna 2','Colonna 3'],['','',''],['','',''],['','','']]
  };
  let state = { type:'graph', chartType:'bar', grid: JSON.parse(JSON.stringify(PRESETS.graph)) };

  function currentUser(){ try { return window.Auth && typeof window.Auth.current === 'function' ? window.Auth.current() : null; } catch(e){ return null; } }
  function isAdmin(){ const user = currentUser(); return !!(user && user.role === 'admin'); }
  function hasCard(){ return !!document.getElementById('SlideBuilderCard'); }
  function notify(msg, isError){ try { if (typeof window.showToast === 'function') return window.showToast(msg, isError ? 'error' : 'ok'); } catch(e){} if (isError) console.error(msg); else console.log(msg); }
  function esc(text){ return String(text == null ? '' : text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function num(v){ const cleaned = String(v == null ? '' : v).replace(/\./g,'').replace(',', '.').replace(/%/g,'').trim(); const n = Number(cleaned); return Number.isFinite(n) ? n : 0; }
  function clonePreset(type){ return JSON.parse(JSON.stringify(PRESETS[type])); }
  function sidebarLogo(){ return document.getElementById('SidebarLogo')?.getAttribute('src') || './assets/logo.png'; }

  function gridFromDom(){
    const rows = [];
    Array.from(document.querySelectorAll('#SbDataGrid tbody tr')).forEach(tr => {
      rows.push(Array.from(tr.querySelectorAll('input[data-cell]')).map(inp => inp.value || ''));
    });
    if (rows.length) state.grid = rows;
  }

  function colLabel(i){
    let n = i + 1;
    let out = '';
    while (n > 0) {
      const mod = (n - 1) % 26;
      out = String.fromCharCode(65 + mod) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function updateHint(){
    const hint = $('#SbDataHint');
    if (!hint) return;
    if (state.type === 'graph') hint.textContent = 'Grafico: usa la prima riga come intestazione (es. Categoria / Valore) e le righe sotto per i dati.';
    else if (state.type === 'timeline') hint.textContent = 'Timeline: usa le colonne Data / Titolo / Dettaglio. Una riga = una milestone.';
    else hint.textContent = 'Tabella: la prima riga è l’intestazione. Le righe successive sono i dati.';
  }

  function buildGrid(){
    const table = $('#SbDataGrid');
    if (!table) return;
    const maxCols = Math.max.apply(null, state.grid.map(r => r.length).concat([2]));
    let thead = '<thead><tr><th class="sb-corner"></th>';
    for (let c = 0; c < maxCols; c++) {
      thead += '<th class="sb-col-head"><input value="' + colLabel(c) + '" disabled></th>';
    }
    thead += '<th class="sb-col-head is-right"></th></tr></thead>';
    let tbody = '<tbody>';
    state.grid.forEach((row, rIdx) => {
      tbody += '<tr><th class="sb-row-head">' + (rIdx + 1) + '</th>';
      for (let c = 0; c < maxCols; c++) {
        tbody += '<td><input data-cell="1" data-r="' + rIdx + '" data-c="' + c + '" value="' + esc(row[c] || '') + '"></td>';
      }
      tbody += '<td class="sb-actions-cell"><button type="button" class="sb-trash-btn" data-del-row="' + rIdx + '" title="Elimina riga">✕</button></td></tr>';
    });
    tbody += '</tbody>';
    table.innerHTML = thead + tbody;
    updateHint();
    refreshPreview();
  }

  function addRow(){
    const cols = Math.max.apply(null, state.grid.map(r => r.length).concat([2]));
    state.grid.push(Array.from({ length: cols }, () => ''));
    buildGrid();
  }

  function addCol(){
    state.grid = state.grid.map(row => row.concat(''));
    buildGrid();
  }

  function deleteRow(idx){
    if (state.grid.length <= 1) return;
    state.grid.splice(idx, 1);
    if (!state.grid.length) state.grid = [['','']];
    buildGrid();
  }

  async function pasteFromExcel(){
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const rows = text.replaceAll('','').split('
').filter(Boolean).map(line => line.split('	'));
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
    state.grid = clonePreset(type);
    $$('#SbTypeSwitch .platform-switch-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
    const wrap = $('#SbChartTypeWrap');
    if (wrap) wrap.classList.toggle('hidden', type !== 'graph');
    buildGrid();
  }

  function setChart(chart){
    state.chartType = chart;
    $$('#SbChartSwitch .platform-switch-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.chart === chart));
    refreshPreview();
  }

  function parseGraph(){
    gridFromDom();
    const rows = state.grid.slice(1).filter(r => String(r[0] || '').trim() || String(r[1] || '').trim());
    const labels = rows.map(r => String(r[0] || '').trim()).filter(Boolean);
    const values = rows.map(r => num(r[1])).slice(0, labels.length);
    return { labels, values };
  }

  function parseTimeline(){
    gridFromDom();
    return state.grid.slice(1).map(r => ({ date:String(r[0] || '').trim(), title:String(r[1] || '').trim(), detail:String(r[2] || '').trim() })).filter(x => x.date || x.title || x.detail);
  }

  function parseTable(){
    gridFromDom();
    const headers = state.grid[0] || [];
    const rows = state.grid.slice(1).filter(r => r.some(v => String(v || '').trim()));
    return { headers, rows };
  }

  function polarToCartesian(cx,cy,r,angle){ const rad=(angle-90)*Math.PI/180; return { x:cx+r*Math.cos(rad), y:cy+r*Math.sin(rad) }; }
  function arcPath(cx,cy,rOuter,rInner,startAngle,endAngle){
    const outerStart=polarToCartesian(cx,cy,rOuter,endAngle), outerEnd=polarToCartesian(cx,cy,rOuter,startAngle), innerStart=polarToCartesian(cx,cy,rInner,startAngle), innerEnd=polarToCartesian(cx,cy,rInner,endAngle), largeArc=endAngle-startAngle<=180?'0':'1';
    if(rInner<=0) return 'M '+cx+' '+cy+' L '+outerStart.x+' '+outerStart.y+' A '+rOuter+' '+rOuter+' 0 '+largeArc+' 0 '+outerEnd.x+' '+outerEnd.y+' Z';
    return ['M '+outerStart.x+' '+outerStart.y,'A '+rOuter+' '+rOuter+' 0 '+largeArc+' 0 '+outerEnd.x+' '+outerEnd.y,'L '+innerStart.x+' '+innerStart.y,'A '+rInner+' '+rInner+' 0 '+largeArc+' 1 '+innerEnd.x+' '+innerEnd.y,'Z'].join(' ');
  }
  function svgDataUri(svg){ return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); }

  function renderBar(labels,values){
    const W=1080,H=520,left=70,right=16,top=22,bottom=80,plotW=W-left-right,plotH=H-top-bottom,max=Math.max.apply(null, values.concat([1])),gap=labels.length?plotW/labels.length:80,bw=Math.min(84,gap*0.58);
    let out='';
    [0.25,0.5,0.75,1].forEach(step=>{ const y=top+plotH-(plotH*step); out += '<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(W-right)+'" y2="'+y.toFixed(1)+'" stroke="#D9D2CB" stroke-width="1" />'; out += '<text x="'+(left-10)+'" y="'+(y+4)+'" text-anchor="end" font-family="Manrope" font-size="14" fill="#787878">'+Math.round(max*step)+'</text>'; });
    labels.forEach((label,i)=>{ const val=values[i]||0,h=(val/max)*plotH,x=left+i*gap+(gap-bw)/2,y=top+plotH-h,color='#'+PALETTE[i%PALETTE.length]; out += '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="12" fill="'+color+'" />'; out += '<text x="'+(x+bw/2).toFixed(1)+'" y="'+(y-10).toFixed(1)+'" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="700" fill="#1A171B">'+val+'</text>'; out += '<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-30)+'" text-anchor="middle" font-family="Manrope" font-size="14" fill="#1A171B">'+esc(label)+'</text>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" fill="transparent"/>'+out+'<line x1="'+left+'" y1="'+(top+plotH)+'" x2="'+(W-right)+'" y2="'+(top+plotH)+'" stroke="#9F9A95" stroke-width="1.2"/></svg>';
  }

  function renderLine(labels,values){
    const W=1080,H=520,left=70,right=16,top=28,bottom=80,plotW=W-left-right,plotH=H-top-bottom,max=Math.max.apply(null, values.concat([1])),min=Math.min.apply(null, values.concat([0])),span=Math.max(max-min,1), xs=labels.map((_,i)=> left + (plotW*i)/Math.max(labels.length-1,1)), ys=values.map(v=> top + plotH - ((v-min)/span)*plotH), points=xs.map((x,i)=> x.toFixed(1)+','+ys[i].toFixed(1)).join(' ');
    let out='';
    [0,0.25,0.5,0.75,1].forEach(step=>{ const y=top+plotH-plotH*step,label=Math.round(min+step*span); out += '<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(W-right)+'" y2="'+y.toFixed(1)+'" stroke="#D9D2CB" stroke-width="1" />'; out += '<text x="'+(left-10)+'" y="'+(y+4)+'" text-anchor="end" font-family="Manrope" font-size="14" fill="#787878">'+label+'</text>'; });
    out += '<polyline fill="none" stroke="#4C1428" stroke-width="4" points="'+points+'" stroke-linecap="round" stroke-linejoin="round"/>';
    xs.forEach((x,i)=>{ out += '<circle cx="'+x.toFixed(1)+'" cy="'+ys[i].toFixed(1)+'" r="6" fill="#C4162B" stroke="#fff" stroke-width="3" />'; out += '<text x="'+x.toFixed(1)+'" y="'+(ys[i]-14).toFixed(1)+'" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="700" fill="#1A171B">'+values[i]+'</text>'; out += '<text x="'+x.toFixed(1)+'" y="'+(H-30)+'" text-anchor="middle" font-family="Manrope" font-size="14" fill="#1A171B">'+esc(labels[i])+'</text>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" fill="transparent"/>'+out+'</svg>';
  }

  function renderPie(labels,values,doughnut){
    const W=1080,H=520,cx=310,cy=260,rOuter=162,rInner=doughnut?92:0,total=values.reduce((a,b)=>a+b,0)||1;
    let angle=0,out='',legend='';
    labels.forEach((label,i)=>{ const value=values[i]||0,next=angle+(value/total)*360,pct=(value/total)*100,color='#'+PALETTE[i%PALETTE.length]; out += '<path d="'+arcPath(cx,cy,rOuter,rInner,angle,next)+'" fill="'+color+'" />'; const mid=angle+(next-angle)/2,p=polarToCartesian(cx,cy,doughnut?130:110,mid),ly=118+i*56; out += '<text x="'+p.x.toFixed(1)+'" y="'+p.y.toFixed(1)+'" text-anchor="middle" font-family="Manrope" font-size="13" font-weight="700" fill="#1A171B">'+Math.round(pct)+'%</text>'; legend += '<rect x="610" y="'+(ly-14)+'" width="20" height="20" rx="5" fill="'+color+'" />'; legend += '<text x="642" y="'+ly+'" font-family="Manrope" font-size="18" fill="#1A171B">'+esc(label)+'</text>'; legend += '<text x="965" y="'+ly+'" text-anchor="end" font-family="Manrope" font-size="18" font-weight="700" fill="#4C1428">'+value+'</text>'; angle=next; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" fill="transparent"/>'+out+legend+'</svg>';
  }

  function renderTimeline(items){
    const W=1080,H=520,startX=110,endX=970,centerY=270,gap=items.length>1?(endX-startX)/(items.length-1):0;
    let out='<line x1="'+startX+'" y1="'+centerY+'" x2="'+endX+'" y2="'+centerY+'" stroke="#D5CEC7" stroke-width="8" stroke-linecap="round" />';
    items.forEach((item,i)=>{ const x=startX+gap*i,top=i%2===0,boxY=top?58:328,anchorY=top?boxY+94:boxY-18,color=i%3===0?'#'+COLORS.red:(i%3===1?'#'+COLORS.burgundy:'#'+COLORS.rose); out += '<line x1="'+x+'" y1="'+centerY+'" x2="'+x+'" y2="'+anchorY+'" stroke="#B29A9F" stroke-width="2" />'; out += '<circle cx="'+x+'" cy="'+centerY+'" r="14" fill="'+color+'" stroke="#fff" stroke-width="5" />'; out += '<rect x="'+(x-120)+'" y="'+boxY+'" rx="16" width="240" height="112" fill="#fff" stroke="#E3DDD6" />'; out += '<text x="'+(x-100)+'" y="'+(boxY+26)+'" font-family="Manrope" font-size="16" font-weight="700" fill="#C4162B">'+esc(item.date)+'</text>'; out += '<text x="'+(x-100)+'" y="'+(boxY+54)+'" font-family="PP Pangaia, Georgia, serif" font-size="22" font-weight="600" fill="#4C1428">'+esc(item.title)+'</text>'; out += '<text x="'+(x-100)+'" y="'+(boxY+82)+'" font-family="Manrope" font-size="13" fill="#1A171B">'+esc(item.detail)+'</text>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" fill="transparent"/>'+out+'</svg>';
  }

  function renderTableShell(headers,rows){
    const head='<tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>';
    const body=rows.map(r=>'<tr>'+headers.map((_,i)=>'<td>'+esc(r[i]||'')+'</td>').join('')+'</tr>').join('');
    return '<div class="sb-preview-table-shell"><table><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
  }

  function updateStats(boxes){ const el=$('#SbQuickStats'); if(el) el.innerHTML=boxes.join(''); }

  function refreshPreview(){
    if(!hasCard()) return;
    const logo = $('#SbPreviewLogoImg');
    if(logo) logo.src = sidebarLogo();
    const canvas = $('#SbPreviewCanvas');
    if(!canvas) return;
    if(state.type==='graph'){
      const parsed=parseGraph(), labels=parsed.labels, values=parsed.values;
      if(!labels.length){ canvas.innerHTML='<div class="sb-empty-state">Compila i dati del grafico oppure incolla da Excel per vedere l’anteprima.</div>'; updateStats([]); return; }
      let svg=renderBar(labels,values);
      if(state.chartType==='line') svg=renderLine(labels,values);
      if(state.chartType==='pie') svg=renderPie(labels,values,false);
      if(state.chartType==='doughnut') svg=renderPie(labels,values,true);
      canvas.innerHTML=svg;
      const total=values.reduce((a,b)=>a+b,0), topIdx=values.reduce((best,v,i,arr)=>v>(arr[best]||-Infinity)?i:best,0);
      updateStats(['<div class="sb-stat"><strong>'+labels.length+'</strong><span>Categorie</span></div>','<div class="sb-stat"><strong>'+total+'</strong><span>Valore totale</span></div>','<div class="sb-stat"><strong>'+esc(labels[topIdx]||'—')+'</strong><span>Top categoria</span></div>']);
      return;
    }
    if(state.type==='timeline'){
      const items=parseTimeline();
      if(!items.length){ canvas.innerHTML='<div class="sb-empty-state">Compila le milestone della timeline per vedere l’anteprima.</div>'; updateStats([]); return; }
      canvas.innerHTML=renderTimeline(items);
      updateStats(['<div class="sb-stat"><strong>'+items.length+'</strong><span>Milestone</span></div>','<div class="sb-stat"><strong>'+esc(items[0]?.date||'—')+'</strong><span>Inizio</span></div>','<div class="sb-stat"><strong>'+esc(items[items.length-1]?.date||'—')+'</strong><span>Fine</span></div>']);
      return;
    }
    const t=parseTable();
    if(!t.headers.length || !t.rows.length){ canvas.innerHTML='<div class="sb-empty-state">Compila intestazioni e righe per vedere l’anteprima della tabella.</div>'; updateStats([]); return; }
    canvas.innerHTML=renderTableShell(t.headers,t.rows);
    updateStats(['<div class="sb-stat"><strong>'+t.headers.length+'</strong><span>Colonne</span></div>','<div class="sb-stat"><strong>'+t.rows.length+'</strong><span>Righe dati</span></div>','<div class="sb-stat"><strong>'+esc(t.headers[0]||'—')+'</strong><span>Prima intestazione</span></div>']);
  }

  async function exportPpt(){
    if(!window.PptxGenJS) throw new Error('Libreria PPT non caricata.');
    const title = ($('#SbTitle')?.value || '').trim() || 'Titolo slide';
    const description = ($('#SbDescription')?.value || '').trim() || 'Sottotitolo / descrizione breve';
    const source = ($('#SbSource')?.value || '').trim() || 'Fonte da inserire';
    const pptx = new window.PptxGenJS();
    pptx.layout='LAYOUT_WIDE';
    pptx.author='Abitare Co.';
    pptx.company='Abitare Co.';
    pptx.subject='Slide Builder';
    pptx.title=title;
    pptx.lang='it-IT';
    pptx.theme={ headFontFace:'PP Pangaia', bodyFontFace:'Manrope', lang:'it-IT' };
    const slide=pptx.addSlide();
    slide.background={ color:COLORS.bg };
    slide.addText(title,{ x:1.34, y:0.28, w:10.66, h:0.62, align:'center', valign:'mid', fontFace:'PP Pangaia', fontSize:28, bold:true, color:COLORS.burgundy, margin:0 });
    slide.addText(description,{ x:2.0, y:1.16, w:9.3, h:0.26, align:'center', valign:'mid', fontFace:'Manrope', fontSize:10.5, color:COLORS.burgundy, margin:0 });
    const area={ x:0.86, y:1.78, w:11.60, h:4.82 };
    if(state.type==='graph'){
      const parsed=parseGraph(), labels=parsed.labels, values=parsed.values;
      if(!labels.length) throw new Error('Inserisci almeno una categoria e un valore.');
      let svg=renderBar(labels,values);
      if(state.chartType==='line') svg=renderLine(labels,values);
      if(state.chartType==='pie') svg=renderPie(labels,values,false);
      if(state.chartType==='doughnut') svg=renderPie(labels,values,true);
      slide.addImage({ data:svgDataUri(svg), x:area.x, y:area.y, w:area.w, h:area.h });
    } else if(state.type==='timeline'){
      const items=parseTimeline();
      if(!items.length) throw new Error('Inserisci almeno una milestone per la timeline.');
      slide.addImage({ data:svgDataUri(renderTimeline(items)), x:area.x, y:area.y, w:area.w, h:area.h });
    } else {
      const t=parseTable();
      if(!t.headers.length || !t.rows.length) throw new Error('Compila intestazioni e righe della tabella.');
      slide.addTable([t.headers].concat(t.rows), { x:area.x, y:area.y, w:area.w, h:area.h, border:{ type:'solid', color:'D8D1CA', pt:0.75 }, fontFace:'Manrope', fontSize:10.5, color:COLORS.black, fill:COLORS.tortora, fillHeader:COLORS.burgundy, colorHeader:'FFFFFF', boldHeader:true, margin:0.08, rowH:0.36, autoFit:true, valign:'mid' });
    }
    slide.addText('© 2026 Abitare Co. | All rights reserved.  Fonte: '+source,{ x:0.08, y:7.02, w:7.2, h:0.18, fontFace:'Manrope', fontSize:7.4, color:'6E6A67', margin:0 });
    try{ slide.addImage({ path:sidebarLogo(), x:11.72, y:6.76, w:1.34, h:0.34 }); }catch(e){}
    const safeName=String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42) || 'slide-builder';
    await pptx.writeFile({ fileName:safeName+'.pptx' });
    notify('PPT esportato con successo.');
  }

  function bind(){
    const card=document.getElementById('SlideBuilderCard');
    if(!card || card.dataset.bound==='1') return;
    card.dataset.bound='1';
    buildGrid();
    const logo=$('#SbPreviewLogoImg');
    if(logo) logo.src=sidebarLogo();
    card.addEventListener('input', e=>{
      if(e.target.matches('#SbTitle, #SbDescription, #SbSource, #SbDataGrid input[data-cell]')) refreshPreview();
    });
    card.addEventListener('click', async e=>{
      const typeBtn=e.target.closest('#SbTypeSwitch .platform-switch-btn');
      if(typeBtn){ setType(typeBtn.dataset.type); return; }
      const chartBtn=e.target.closest('#SbChartSwitch .platform-switch-btn');
      if(chartBtn){ setChart(chartBtn.dataset.chart); return; }
      const delBtn=e.target.closest('[data-del-row]');
      if(delBtn){ deleteRow(Number(delBtn.dataset.delRow)); return; }
      if(e.target.id==='SbAddRow'){ addRow(); return; }
      if(e.target.id==='SbAddCol'){ addCol(); return; }
      if(e.target.id==='SbPasteExcel'){ await pasteFromExcel(); return; }
      if(e.target.id==='SbResetGrid'){ state.grid = clonePreset(state.type); buildGrid(); return; }
    });
    window.exportSlideBuilderPpt = exportPpt;
    refreshPreview();
  }

  function clonePreset(type){ return JSON.parse(JSON.stringify(PRESETS[type])); }

  function init(){ if(!hasCard()) return; if(!isAdmin()) return; bind(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
