(function(){
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ROWS = 60;
  const COLS = 29; // A..AC
  const DEFAULT_ROW_HEIGHT = 20;
  const DEFAULT_COL_WIDTH = 64;
  const MIN_ROW_HEIGHT = 20;
  const MAX_ROW_HEIGHT = 64;
  const MIN_COL_WIDTH = 64;
  const MAX_COL_WIDTH = 180;
  const SHEET_MIN_HEIGHT = 248;
  const SHEET_MAX_HEIGHT = 528;

  const COLORS = {
    red: 'C4162B',
    burgundy: '4C1428',
    rose: 'E9A0A7',
    tortora: 'EAE3DA',
    black: '1A171B',
    grayDark: '787878',
    bg: 'FFFFFF',
    gridStroke: 'D4D7DD',
    headerBg: '5F6673',
    headerBorder: '778091',
    headerText: 'FFFFFF',
    selection: 'C4162B',
    selectionSoft: 'F7D8DE'
  };

  const PALETTE = [COLORS.red, COLORS.burgundy, '8E1E3A', 'D24A65', COLORS.rose, '7A2237'];

  const state = {
    type: 'graph',
    chartType: 'bar',
    grid: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => '')),
    rowHeights: Array.from({ length: ROWS }, () => DEFAULT_ROW_HEIGHT),
    colWidths: Array.from({ length: COLS }, () => DEFAULT_COL_WIDTH),
    active: { r: 0, c: 0 },
    selection: { r1: 0, c1: 0, r2: 0, c2: 0 },
    mouseSelecting: false,
    fillDragging: false,
    fillBase: null,
    fillPreview: null,
    resizing: null,
    sheetResize: null,
    previewTick: 0
  };

  function hasCard(){ return !!document.getElementById('SlideBuilderCard'); }
  function currentUser(){
    try { return window.Auth && typeof window.Auth.current === 'function' ? window.Auth.current() : null; }
    catch (e) { return null; }
  }
  function isAdmin(){
    const user = currentUser();
    return !!(user && user.role === 'admin');
  }
  function esc(text){
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function notify(msg, isError){
    try { if (typeof window.showToast === 'function') return window.showToast(msg, isError ? 'error' : 'ok'); }
    catch (e) {}
    if (isError) console.error(msg);
    else console.log(msg);
  }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function sidebarLogo(){ return document.getElementById('SidebarLogo')?.getAttribute('src') || './assets/logo.png'; }
  function toNumber(v){
    const cleaned = String(v == null ? '' : v).replace(/\./g, '').replace(',', '.').replace(/%/g, '').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
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
  function ensureGridSize(){
    while (state.grid.length < ROWS) state.grid.push(Array.from({ length: COLS }, () => ''));
    state.grid = state.grid.slice(0, ROWS).map(row => {
      const next = Array.isArray(row) ? row.slice(0, COLS) : [];
      while (next.length < COLS) next.push('');
      return next;
    });
    while (state.rowHeights.length < ROWS) state.rowHeights.push(DEFAULT_ROW_HEIGHT);
    state.rowHeights = state.rowHeights.slice(0, ROWS).map(v => clamp(Number(v) || DEFAULT_ROW_HEIGHT, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT));
    while (state.colWidths.length < COLS) state.colWidths.push(DEFAULT_COL_WIDTH);
    state.colWidths = state.colWidths.slice(0, COLS).map(v => clamp(Number(v) || DEFAULT_COL_WIDTH, MIN_COL_WIDTH, MAX_COL_WIDTH));
  }
  function normalizeRange(range){
    return {
      r1: Math.min(range.r1, range.r2),
      c1: Math.min(range.c1, range.c2),
      r2: Math.max(range.r1, range.r2),
      c2: Math.max(range.c1, range.c2)
    };
  }
  function currentRange(){ return normalizeRange(state.selection); }
  function cellSelector(r, c){ return '.sb-cell[data-r="' + r + '"][data-c="' + c + '"]'; }
  function inputSelector(r, c){ return 'textarea[data-r="' + r + '"][data-c="' + c + '"]'; }
  function getCell(r, c){ return document.querySelector(cellSelector(r, c)); }
  function getInput(r, c){ return document.querySelector(inputSelector(r, c)); }

  function getRawCellValue(r, c){
    return String((state.grid[r] && state.grid[r][c]) || '');
  }
  function cellRef(r, c){
    return colLabel(c) + String(r + 1);
  }
  function coordsFromRef(ref){
    const m = String(ref || '').toUpperCase().match(/^([A-Z]{1,3})(\d{1,4})$/);
    if (!m) return null;
    let col = 0;
    for (let i = 0; i < m[1].length; i += 1) col = col * 26 + (m[1].charCodeAt(i) - 64);
    return { r: Number(m[2]) - 1, c: col - 1 };
  }
  function splitFormulaArgs(text){
    const out = [];
    let cur = '';
    let depth = 0;
    for (const ch of String(text || '')) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if ((ch === ';' || ch === ',') && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim() || !out.length) out.push(cur.trim());
    return out.filter(Boolean);
  }
  function numericValuesFromArg(arg, stack){
    const token = String(arg || '').trim();
    if (!token) return [];
    const range = token.match(/^([A-Z]{1,3}\d{1,4}):([A-Z]{1,3}\d{1,4})$/i);
    if (range) {
      const a = coordsFromRef(range[1]);
      const b = coordsFromRef(range[2]);
      if (!a || !b) return [];
      const vals = [];
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r += 1) {
        for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c += 1) {
          const n = toNumber(getComputedCellValue(r, c, stack));
          if (Number.isFinite(n)) vals.push(n);
        }
      }
      return vals;
    }
    const ref = coordsFromRef(token);
    if (ref) {
      const n = toNumber(getComputedCellValue(ref.r, ref.c, stack));
      return Number.isFinite(n) ? [n] : [];
    }
    const num = toNumber(token);
    if (Number.isFinite(num)) return [num];
    return [];
  }
  function evaluateFormula(raw, stack){
    const expr = String(raw || '').trim().slice(1).trim();
    const fn = expr.match(/^([A-Z\.À-ÿ_]+)\((.*)\)$/i);
    if (fn) {
      const name = fn[1].toUpperCase();
      const args = splitFormulaArgs(fn[2]);
      const nums = args.flatMap(arg => numericValuesFromArg(arg, stack));
      if (name === 'SOMMA' || name === 'SUM') return nums.reduce((a, b) => a + b, 0);
      if (name === 'MEDIA' || name === 'AVERAGE') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      if (name === 'MAX') return nums.length ? Math.max(...nums) : 0;
      if (name === 'MIN') return nums.length ? Math.min(...nums) : 0;
      if (name === 'CONTA.NUMERI' || name === 'COUNT') return nums.length;
    }
    const refOnly = coordsFromRef(expr);
    if (refOnly) return getComputedCellValue(refOnly.r, refOnly.c, stack);
    const safeExpr = expr.replace(/\b([A-Z]{1,3}\d{1,4})\b/g, (m) => {
      const coords = coordsFromRef(m);
      if (!coords) return '0';
      const n = toNumber(getComputedCellValue(coords.r, coords.c, stack));
      return Number.isFinite(n) ? String(n) : '0';
    }).replace(/,/g, '.');
    if (/^[0-9+\-*/().\s]+$/.test(safeExpr)) {
      try {
        const val = Function('return (' + safeExpr + ')')();
        return Number.isFinite(val) ? val : raw;
      } catch (e) {
        return raw;
      }
    }
    return raw;
  }
  function getComputedCellValue(r, c, inherited){
    const raw = getRawCellValue(r, c);
    if (!raw.startsWith('=')) return raw;
    const stack = inherited || new Set();
    const key = r + ':' + c;
    if (stack.has(key)) return '#CIRC';
    stack.add(key);
    const out = evaluateFormula(raw, stack);
    stack.delete(key);
    return out;
  }
  function displayCellValue(r, c){
    const value = getComputedCellValue(r, c);
    return value == null ? '' : String(value);
  }
  function renderedCellValue(r, c){
    const raw = getRawCellValue(r, c);
    if (state.active.r === r && state.active.c === c) return raw;
    return raw.startsWith('=') ? displayCellValue(r, c) : raw;
  }
  function refreshVisibleGridValues(){
    Array.from(document.querySelectorAll('#SbDataGrid textarea[data-cell]')).forEach(inp => {
      const r = Number(inp.dataset.r || 0);
      const c = Number(inp.dataset.c || 0);
      const next = renderedCellValue(r, c);
      if (document.activeElement !== inp && inp.value !== next) inp.value = next;
    });
  }
  function refreshFormulaBar(){
    const nameBox = $('#SbNameBox');
    const formulaInput = $('#SbFormulaInput');
    if (nameBox) nameBox.value = cellRef(state.active.r, state.active.c);
    if (formulaInput && document.activeElement !== formulaInput) formulaInput.value = getRawCellValue(state.active.r, state.active.c);
  }
  function setSelection(r1, c1, r2, c2, focus){
    state.selection = {
      r1: clamp(r1, 0, ROWS - 1),
      c1: clamp(c1, 0, COLS - 1),
      r2: clamp(r2, 0, ROWS - 1),
      c2: clamp(c2, 0, COLS - 1)
    };
    if (focus) {
      state.active = { r: clamp(r2, 0, ROWS - 1), c: clamp(c2, 0, COLS - 1) };
      const el = getInput(state.active.r, state.active.c);
      if (el) el.focus({ preventScroll: false });
    }
    applySelectionClasses();
    refreshFormulaBar();
    refreshVisibleGridValues();
  }
  function focusCell(r, c, extend){
    const rr = clamp(r, 0, ROWS - 1);
    const cc = clamp(c, 0, COLS - 1);
    if (extend) setSelection(state.selection.r1, state.selection.c1, rr, cc, true);
    else setSelection(rr, cc, rr, cc, true);
  }
  function updateHint(){
    const hint = $('#SbDataHint');
    if (!hint) return;
    if (state.type === 'graph') hint.textContent = 'Per il grafico usa la colonna A come etichetta e la colonna B come valore. Usa la barra formule per valori e formule tipo =SOMMA(B2:B10).';
    else if (state.type === 'timeline') hint.textContent = 'Per la timeline usa le colonne A / B / C come Data / Titolo / Dettaglio. La prima riga è l’intestazione.';
    else hint.textContent = 'Per la tabella usa la prima riga come intestazione e le righe successive come dati. Puoi cambiare altezza righe e larghezza colonne trascinando gli header.';
  }
  function updateCellValue(r, c, value){
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return;
    state.grid[r][c] = value;
    const el = getInput(r, c);
    if (el && el.value !== value) el.value = value;
  }
  function schedulePreview(){
    state.previewTick += 1;
    const tick = state.previewTick;
    window.requestAnimationFrame(() => {
      if (tick !== state.previewTick) return;
      refreshPreview();
    });
  }
  function applySelectionClasses(){
    const range = currentRange();
    $$('#SbDataGrid .sb-cell').forEach(td => {
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      const selected = r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
      const active = r === state.active.r && c === state.active.c;
      const fillEdge = !state.fillDragging && r === range.r2 && c === range.c2;
      td.classList.toggle('is-selected', selected);
      td.classList.toggle('is-active', active);
      td.classList.toggle('is-fill-edge', fillEdge);
    });
    $$('#SbDataGrid .sb-row-head').forEach(th => {
      const r = Number(th.dataset.r);
      th.classList.toggle('is-selected', r >= range.r1 && r <= range.r2 && range.c1 === 0 && range.c2 === COLS - 1);
    });
    $$('#SbDataGrid .sb-col-head').forEach(th => {
      const c = Number(th.dataset.c);
      th.classList.toggle('is-selected', c >= range.c1 && c <= range.c2 && range.r1 === 0 && range.r2 === ROWS - 1);
    });
    const corner = $('#SbDataGrid .sb-corner');
    if (corner) corner.classList.toggle('is-selected', range.r1 === 0 && range.c1 === 0 && range.r2 === ROWS - 1 && range.c2 === COLS - 1);

    $$('#SbDataGrid .sb-fill-preview').forEach(el => el.classList.remove('sb-fill-preview'));
    if (state.fillPreview) {
      const fp = normalizeRange(state.fillPreview);
      for (let r = fp.r1; r <= fp.r2; r += 1) {
        for (let c = fp.c1; c <= fp.c2; c += 1) {
          const cell = getCell(r, c);
          if (cell) cell.classList.add('sb-fill-preview');
        }
      }
    }
  }
  function syncGridFromDom(){
    const formulaInput = $('#SbFormulaInput');
    const activeInput = getInput(state.active.r, state.active.c);
    if (formulaInput && document.activeElement === formulaInput) {
      state.grid[state.active.r][state.active.c] = formulaInput.value || '';
      return;
    }
    if (activeInput && document.activeElement === activeInput) {
      state.grid[state.active.r][state.active.c] = activeInput.value || '';
    }
  }
  function buildGrid(){
    ensureGridSize();
    const table = $('#SbDataGrid');
    if (!table) return;

    let thead = '<thead><tr><th class="sb-corner" aria-label="Seleziona tutto" style="height:26px;min-height:26px"></th>';
    for (let c = 0; c < COLS; c += 1) {
      thead += '<th class="sb-col-head" data-c="' + c + '" style="width:' + state.colWidths[c] + 'px;min-width:' + state.colWidths[c] + 'px;height:26px;min-height:26px">'
        + '<span>' + colLabel(c) + '</span>'
        + '<button type="button" class="sb-col-resizer" data-c="' + c + '" tabindex="-1" aria-label="Ridimensiona colonna ' + colLabel(c) + '"></button>'
        + '</th>';
    }
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    for (let r = 0; r < ROWS; r += 1) {
      const rowH = state.rowHeights[r];
      tbody += '<tr>'
        + '<th class="sb-row-head" data-r="' + r + '" style="height:' + rowH + 'px;min-height:' + rowH + 'px">'
        + '<span>' + (r + 1) + '</span>'
        + '<button type="button" class="sb-row-resizer" data-r="' + r + '" tabindex="-1" aria-label="Ridimensiona riga ' + (r + 1) + '"></button>'
        + '</th>';
      for (let c = 0; c < COLS; c += 1) {
        const value = renderedCellValue(r, c);
        const label = colLabel(c) + String(r + 1);
        const colW = state.colWidths[c];
        tbody += '<td class="sb-cell" data-r="' + r + '" data-c="' + c + '" style="width:' + colW + 'px;min-width:' + colW + 'px;height:' + rowH + 'px;min-height:' + rowH + 'px">'
          + '<textarea data-cell="1" data-r="' + r + '" data-c="' + c + '" aria-label="Cella ' + label + '" spellcheck="false">' + esc(value) + '</textarea>'
          + '<button type="button" class="sb-fill-handle" tabindex="-1" aria-label="Trascina per riempire"></button>'
          + '</td>';
      }
      tbody += '</tr>';
    }
    tbody += '</tbody>';
    table.innerHTML = thead + tbody;
    updateHint();
    applySelectionClasses();
    refreshFormulaBar();
    refreshVisibleGridValues();
    schedulePreview();
  }
  function resetGrid(){
    state.grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
    state.rowHeights = Array.from({ length: ROWS }, () => DEFAULT_ROW_HEIGHT);
    state.colWidths = Array.from({ length: COLS }, () => DEFAULT_COL_WIDTH);
    buildGrid();
    const wrap = $('#SbSheetWrap'); if (wrap) wrap.style.height = SHEET_MIN_HEIGHT + 'px';
    focusCell(0, 0, false);
  }
  function setType(type){
    state.type = type;
    $$('#SbTypeSwitch .platform-switch-btn').forEach(btn => {
      const on = btn.dataset.type === type;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const wrap = $('#SbChartTypeWrap');
    if (wrap) wrap.classList.toggle('hidden', type !== 'graph');
    updateHint();
    schedulePreview();
  }
  function setChart(chart){
    state.chartType = chart;
    $$('#SbChartSwitch .platform-switch-btn').forEach(btn => {
      const on = btn.dataset.chart === chart;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    schedulePreview();
  }
  function parseGraph(){
    syncGridFromDom();
    const bodyRows = state.grid.slice(1).map((r, idx) => ({ label: String(getComputedCellValue(idx + 1, 0)).trim(), value: getComputedCellValue(idx + 1, 1) })).filter(r => r.label || String(r.value || '').trim());
    const labels = bodyRows.map(r => r.label).filter(Boolean);
    const values = bodyRows.map(r => {
      const n = toNumber(r.value);
      return Number.isFinite(n) ? n : 0;
    }).slice(0, labels.length);
    return { labels, values };
  }
  function parseTimeline(){
    syncGridFromDom();
    return state.grid.slice(1)
      .map((r, idx) => ({ date: String(getComputedCellValue(idx + 1, 0)).trim(), title: String(getComputedCellValue(idx + 1, 1)).trim(), detail: String(getComputedCellValue(idx + 1, 2)).trim() }))
      .filter(x => x.date || x.title || x.detail);
  }
  function parseTable(){
    syncGridFromDom();
    const headers = Array.from({ length: (state.grid[0] || []).length }, (_, c) => String(getComputedCellValue(0, c)).trim());
    const rows = state.grid.slice(1).map((r, idx) => r.map((_, c) => String(getComputedCellValue(idx + 1, c)))).filter(r => r.some(v => String(v || '').trim()));
    let usedCols = headers.length;
    while (usedCols > 1 && !String(headers[usedCols - 1] || '').trim()) usedCols -= 1;
    return { headers: headers.slice(0, usedCols), rows: rows.map(r => r.slice(0, usedCols)) };
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
    const largeArc = (endAngle - startAngle) <= 180 ? '0' : '1';
    if (rInner <= 0) return 'M ' + cx + ' ' + cy + ' L ' + outerStart.x + ' ' + outerStart.y + ' A ' + rOuter + ' ' + rOuter + ' 0 ' + largeArc + ' 0 ' + outerEnd.x + ' ' + outerEnd.y + ' Z';
    return ['M ' + outerStart.x + ' ' + outerStart.y, 'A ' + rOuter + ' ' + rOuter + ' 0 ' + largeArc + ' 0 ' + outerEnd.x + ' ' + outerEnd.y, 'L ' + innerStart.x + ' ' + innerStart.y, 'A ' + rInner + ' ' + rInner + ' 0 ' + largeArc + ' 1 ' + innerEnd.x + ' ' + innerEnd.y, 'Z'].join(' ');
  }
  function svgDataUri(svg){
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function svgToPptSvgData(svg){
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    return 'data:image/svg+xml;base64,' + encoded;
  }
  function svgToPngData(svg, width, height){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = err => { URL.revokeObjectURL(url); reject(err || new Error('Errore conversione SVG')); };
      img.src = url;
    });
  }
  function renderBar(labels, values){
    const W = 1240, H = 380, left = 68, right = 18, top = 16, bottom = 52;
    const plotW = W - left - right;
    const plotH = H - top - bottom;
    const max = Math.max.apply(null, values.concat([1]));
    const gap = labels.length ? plotW / labels.length : 80;
    const bw = Math.min(72, gap * 0.58);
    let out = '';
    [0.25, 0.5, 0.75, 1].forEach(step => {
      const y = top + plotH - (plotH * step);
      out += '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (W - right) + '" y2="' + y.toFixed(1) + '" stroke="#DED7D1" stroke-width="1" />';
      out += '<text x="' + (left - 10) + '" y="' + (y + 4) + '" text-anchor="end" font-family="Manrope" font-size="13" fill="#787878">' + Math.round(max * step) + '</text>';
    });
    labels.forEach((label, i) => {
      const val = values[i] || 0;
      const h = (val / max) * plotH;
      const x = left + i * gap + (gap - bw) / 2;
      const y = top + plotH - h;
      const color = '#' + PALETTE[i % PALETTE.length];
      out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="10" fill="' + color + '" />';
      out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" text-anchor="middle" font-family="Manrope" font-size="12" font-weight="700" fill="#4C1428">' + val + '</text>';
      out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-family="Manrope" font-size="12" fill="#1A171B">' + esc(label) + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="100%" height="100%" fill="transparent" />' + out + '<line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (W - right) + '" y2="' + (top + plotH) + '" stroke="#9F9A95" stroke-width="1.1" /></svg>';
  }
  function renderLine(labels, values){
    const W = 1240, H = 380, left = 68, right = 18, top = 16, bottom = 52;
    const plotW = W - left - right;
    const plotH = H - top - bottom;
    const max = Math.max.apply(null, values.concat([1]));
    const min = Math.min.apply(null, values.concat([0]));
    const span = Math.max(max - min, 1);
    const xs = labels.map((_, i) => left + (plotW * i) / Math.max(labels.length - 1, 1));
    const ys = values.map(v => top + plotH - ((v - min) / span) * plotH);
    const points = xs.map((x, i) => x.toFixed(1) + ',' + ys[i].toFixed(1)).join(' ');
    let out = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(step => {
      const y = top + plotH - plotH * step;
      const label = Math.round(min + step * span);
      out += '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (W - right) + '" y2="' + y.toFixed(1) + '" stroke="#DED7D1" stroke-width="1" />';
      out += '<text x="' + (left - 10) + '" y="' + (y + 4) + '" text-anchor="end" font-family="Manrope" font-size="13" fill="#787878">' + label + '</text>';
    });
    out += '<polyline fill="none" stroke="#4C1428" stroke-width="3.5" points="' + points + '" stroke-linecap="round" stroke-linejoin="round" />';
    xs.forEach((x, i) => {
      out += '<circle cx="' + x.toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="5" fill="#C4162B" stroke="#fff" stroke-width="2.5" />';
      out += '<text x="' + x.toFixed(1) + '" y="' + (ys[i] - 12).toFixed(1) + '" text-anchor="middle" font-family="Manrope" font-size="11" font-weight="700" fill="#4C1428">' + values[i] + '</text>';
      out += '<text x="' + x.toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-family="Manrope" font-size="12" fill="#1A171B">' + esc(labels[i]) + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="100%" height="100%" fill="transparent" />' + out + '</svg>';
  }
  function renderPie(labels, values, doughnut){
    const W = 1240, H = 380, cx = 260, cy = 190, rOuter = 122, rInner = doughnut ? 68 : 0;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let angle = 0, out = '', legend = '';
    labels.forEach((label, i) => {
      const value = values[i] || 0;
      const next = angle + (value / total) * 360;
      const pct = (value / total) * 100;
      const color = '#' + PALETTE[i % PALETTE.length];
      out += '<path d="' + arcPath(cx, cy, rOuter, rInner, angle, next) + '" fill="' + color + '" />';
      const mid = angle + (next - angle) / 2;
      const p = polarToCartesian(cx, cy, doughnut ? 108 : 94, mid);
      const ly = 92 + i * 40;
      out += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="middle" font-family="Manrope" font-size="12" font-weight="700" fill="#1A171B">' + Math.round(pct) + '%</text>';
      legend += '<rect x="560" y="' + (ly - 12) + '" width="18" height="18" rx="4" fill="' + color + '" />';
      legend += '<text x="590" y="' + ly + '" font-family="Manrope" font-size="16" fill="#1A171B">' + esc(label) + '</text>';
      legend += '<text x="1080" y="' + ly + '" text-anchor="end" font-family="Manrope" font-size="16" font-weight="700" fill="#4C1428">' + value + '</text>';
      angle = next;
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="100%" height="100%" fill="transparent" />' + out + legend + '</svg>';
  }
  function renderTimeline(items){
    const W = 1240, H = 380, startX = 110, endX = 1120, centerY = 194, gap = items.length > 1 ? (endX - startX) / (items.length - 1) : 0;
    let out = '<line x1="' + startX + '" y1="' + centerY + '" x2="' + endX + '" y2="' + centerY + '" stroke="#D5CEC7" stroke-width="7" stroke-linecap="round" />';
    items.forEach((item, i) => {
      const x = startX + gap * i;
      const top = i % 2 === 0;
      const boxY = top ? 36 : 246;
      const anchorY = top ? boxY + 92 : boxY - 12;
      const color = i % 3 === 0 ? '#' + COLORS.red : (i % 3 === 1 ? '#' + COLORS.burgundy : '#' + COLORS.rose);
      out += '<line x1="' + x + '" y1="' + centerY + '" x2="' + x + '" y2="' + anchorY + '" stroke="#B29A9F" stroke-width="2" />';
      out += '<circle cx="' + x + '" cy="' + centerY + '" r="11" fill="' + color + '" stroke="#fff" stroke-width="4" />';
      out += '<rect x="' + (x - 105) + '" y="' + boxY + '" rx="14" width="210" height="100" fill="#fff" stroke="#E3DDD6" />';
      out += '<text x="' + (x - 88) + '" y="' + (boxY + 24) + '" font-family="Manrope" font-size="14" font-weight="700" fill="#C4162B">' + esc(item.date) + '</text>';
      out += '<text x="' + (x - 88) + '" y="' + (boxY + 48) + '" font-family="PP Pangaia Semibold, PP Pangaia, Georgia, serif" font-size="18" font-weight="600" fill="#4C1428">' + esc(item.title) + '</text>';
      out += '<text x="' + (x - 88) + '" y="' + (boxY + 72) + '" font-family="Manrope" font-size="11.5" fill="#1A171B">' + esc(item.detail) + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"><rect width="100%" height="100%" fill="transparent" />' + out + '</svg>';
  }
  function measureTextApprox(text, px){
    return String(text || '').length * (px * 0.55);
  }
  function truncateSvgText(text, maxWidth, fontPx){
    const raw = String(text == null ? '' : text).split('\n').join(' ');
    if (measureTextApprox(raw, fontPx) <= maxWidth) return raw;
    let out = raw;
    while (out.length > 1 && measureTextApprox(out + '…', fontPx) > maxWidth) out = out.slice(0, -1);
    return out + '…';
  }
  function renderTableShell(headers, rows){
    const safeHeaders = (headers || []).slice(0, 8);
    const safeRows = (rows || []).slice(0, 12).map(r => r.slice(0, safeHeaders.length));
    const W = 1240, H = 380, padX = 18, padY = 18;
    const cols = Math.max(safeHeaders.length, 1);
    const rowCount = safeRows.length + 1;
    const cellW = (W - padX * 2) / cols;
    const cellH = Math.min(30, (H - padY * 2) / Math.max(rowCount, 2));
    let out = '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="14" fill="#FFFFFF" opacity="0.94" />';
    for (let c = 0; c < cols; c += 1) {
      const x = padX + c * cellW;
      out += '<rect x="' + x.toFixed(1) + '" y="' + padY + '" width="' + cellW.toFixed(1) + '" height="' + cellH.toFixed(1) + '" fill="#4C1428" stroke="rgba(26,23,27,.08)" />';
      const txt = truncateSvgText(safeHeaders[c] || '', cellW - 14, 11);
      out += '<text x="' + (x + 8).toFixed(1) + '" y="' + (padY + cellH/2 + 4).toFixed(1) + '" font-family="Manrope" font-size="11" font-weight="700" fill="#FFFFFF">' + esc(txt) + '</text>';
    }
    safeRows.forEach((row, rIdx) => {
      const y = padY + cellH * (rIdx + 1);
      for (let c = 0; c < cols; c += 1) {
        const x = padX + c * cellW;
        out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + cellW.toFixed(1) + '" height="' + cellH.toFixed(1) + '" fill="#FFFFFF" stroke="rgba(26,23,27,.08)" />';
        const txt = truncateSvgText(row[c] || '', cellW - 14, 10);
        out += '<text x="' + (x + 8).toFixed(1) + '" y="' + (y + cellH/2 + 4).toFixed(1) + '" font-family="Manrope" font-size="10" fill="#1A171B">' + esc(txt) + '</text>';
      }
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">' + out + '</svg>';
  }
  function updateStats(boxes){ const el = $('#SbQuickStats'); if (el) el.innerHTML = boxes.join(''); }
  function refreshPreview(){
    if (!hasCard()) return;
    const canvas = $('#SbPreviewCanvas');
    if (!canvas) return;

    if (state.type === 'graph') {
      const parsed = parseGraph();
      if (!parsed.labels.length) {
        canvas.innerHTML = '<div class="sb-empty-state">Compila il foglio dati o incolla da Excel per vedere il grafico.</div>';
        updateStats([]);
        return;
      }
      let svg = renderBar(parsed.labels, parsed.values);
      if (state.chartType === 'line') svg = renderLine(parsed.labels, parsed.values);
      if (state.chartType === 'pie') svg = renderPie(parsed.labels, parsed.values, false);
      if (state.chartType === 'doughnut') svg = renderPie(parsed.labels, parsed.values, true);
      canvas.innerHTML = svg;
      const total = parsed.values.reduce((a, b) => a + b, 0);
      const topIdx = parsed.values.reduce((best, v, i, arr) => v > (arr[best] || -Infinity) ? i : best, 0);
      updateStats([
        '<div class="sb-stat"><strong>' + parsed.labels.length + '</strong><span>Categorie</span></div>',
        '<div class="sb-stat"><strong>' + total + '</strong><span>Valore totale</span></div>',
        '<div class="sb-stat"><strong>' + esc(parsed.labels[topIdx] || '—') + '</strong><span>Top categoria</span></div>'
      ]);
      return;
    }

    if (state.type === 'timeline') {
      const items = parseTimeline();
      if (!items.length) {
        canvas.innerHTML = '<div class="sb-empty-state">Compila il foglio dati per vedere la timeline.</div>';
        updateStats([]);
        return;
      }
      canvas.innerHTML = renderTimeline(items);
      updateStats([
        '<div class="sb-stat"><strong>' + items.length + '</strong><span>Milestone</span></div>',
        '<div class="sb-stat"><strong>' + esc(items[0]?.date || '—') + '</strong><span>Inizio</span></div>',
        '<div class="sb-stat"><strong>' + esc(items[items.length - 1]?.date || '—') + '</strong><span>Fine</span></div>'
      ]);
      return;
    }

    const t = parseTable();
    if (!t.headers.length || !t.rows.length) {
      canvas.innerHTML = '<div class="sb-empty-state">Compila il foglio dati per vedere l’anteprima della tabella.</div>';
      updateStats([]);
      return;
    }
    canvas.innerHTML = renderTableShell(t.headers, t.rows);
    updateStats([
      '<div class="sb-stat"><strong>' + t.headers.length + '</strong><span>Colonne</span></div>',
      '<div class="sb-stat"><strong>' + t.rows.length + '</strong><span>Righe dati</span></div>',
      '<div class="sb-stat"><strong>' + esc(t.headers[0] || '—') + '</strong><span>Prima intestazione</span></div>'
    ]);
  }
  function decodeMarkup(text){
    return String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }
  function parseTitleRuns(text){
    const raw = decodeMarkup(text);
    const runs = [];
    const regex = /<i>([\s\S]*?)<\/i>/gi;
    let idx = 0;
    let match;
    while ((match = regex.exec(raw))) {
      if (match.index > idx) runs.push({ text: raw.slice(idx, match.index), options: { fontFace: 'PP Pangaia Semibold', color: COLORS.burgundy, bold: true } });
      runs.push({ text: match[1], options: { fontFace: 'PP Pangaia Italic', color: COLORS.red, italic: false, bold: true } });
      idx = regex.lastIndex;
    }
    if (idx < raw.length) runs.push({ text: raw.slice(idx), options: { fontFace: 'PP Pangaia Semibold', color: COLORS.burgundy, bold: true } });
    if (!runs.length) runs.push({ text: raw, options: { fontFace: 'PP Pangaia Semibold', color: COLORS.burgundy, bold: true } });
    return runs;
  }
  function graphSeriesData(parsed){
    return [{ name: 'Serie 1', labels: parsed.labels, values: parsed.values }];
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
    pptx.title = decodeMarkup(title).replace(/<\/?i>/g, '');
    pptx.lang = 'it-IT';
    pptx.theme = { headFontFace: 'PP Pangaia Semibold', bodyFontFace: 'Manrope', lang: 'it-IT' };

    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };

    slide.addText(parseTitleRuns(title), {
      x: 2.18, y: 0.68, w: 8.95, h: 0.84,
      align: 'center', valign: 'mid',
      fontFace: 'PP Pangaia Semibold', fontSize: 48,
      color: COLORS.burgundy, margin: 0, breakLine: false, fit: 'shrink'
    });
    slide.addText(description, {
      x: 3.65, y: 1.66, w: 6.0, h: 0.28,
      align: 'center', valign: 'mid',
      fontFace: 'Manrope', fontSize: 12, color: COLORS.burgundy, margin: 0
    });

    const area = { x: 0.78, y: 2.08, w: 11.65, h: 4.0 };

    if (state.type === 'graph') {
      const parsed = parseGraph();
      if (!parsed.labels.length) throw new Error('Inserisci almeno una categoria e un valore nel foglio dati.');
      let svg = renderBar(parsed.labels, parsed.values);
      if (state.chartType === 'line') svg = renderLine(parsed.labels, parsed.values);
      if (state.chartType === 'pie') svg = renderPie(parsed.labels, parsed.values, false);
      if (state.chartType === 'doughnut') svg = renderPie(parsed.labels, parsed.values, true);
      const pngData = await svgToPngData(svg, 1800, 560);
      slide.addImage({ data: pngData, x: area.x, y: area.y, w: area.w, h: area.h });
      slide.addImage({ data: svgToPptSvgData(svg), x: area.x, y: area.y, w: area.w, h: area.h });
    } else if (state.type === 'timeline') {
      const items = parseTimeline();
      if (!items.length) throw new Error('Inserisci almeno una milestone nel foglio dati.');
      const svg = renderTimeline(items);
      const pngData = await svgToPngData(svg, 1800, 560);
      slide.addImage({ data: pngData, x: area.x, y: area.y, w: area.w, h: area.h });
      slide.addImage({ data: svgToPptSvgData(svg), x: area.x, y: area.y, w: area.w, h: area.h });
    } else {
      const t = parseTable();
      if (!t.headers.length || !t.rows.length) throw new Error('Compila il foglio dati della tabella.');
      const svg = renderTableShell(t.headers, t.rows);
      const pngData = await svgToPngData(svg, 1800, 560);
      slide.addImage({ data: pngData, x: area.x, y: area.y, w: area.w, h: area.h });
      slide.addImage({ data: svgToPptSvgData(svg), x: area.x, y: area.y, w: area.w, h: area.h });
    }

    slide.addText('© 2026 Abitare Co. | All rights reserved. Fonte: ' + source, {
      x: 0.18, y: 6.96, w: 6.2, h: 0.18,
      fontFace: 'Manrope', fontSize: 7, color: '6E6A67', margin: 0
    });

    const safeName = String(decodeMarkup(title).replace(/<\/?i>/g, ''))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'slide-builder';

    await pptx.writeFile({ fileName: safeName + '.pptx' });
    notify('PPT esportato con successo.');
  }
function clearRange(range){
    const r = normalizeRange(range);
    for (let rr = r.r1; rr <= r.r2; rr += 1) {
      for (let cc = r.c1; cc <= r.c2; cc += 1) updateCellValue(rr, cc, '');
    }
    schedulePreview();
  }
  function getRangeValues(range){
    const r = normalizeRange(range);
    const rows = [];
    for (let rr = r.r1; rr <= r.r2; rr += 1) {
      const row = [];
      for (let cc = r.c1; cc <= r.c2; cc += 1) row.push(state.grid[rr][cc]);
      rows.push(row);
    }
    return rows;
  }
  function buildTSVFromRange(range){
    const values = getRangeValues(range);
    return values.map(row => row.map(v => String(v || '')).join('\t')).join('\n');
  }
  function numericPattern(values){
    const nums = values.map(toNumber);
    if (nums.some(n => !Number.isFinite(n))) return null;
    if (nums.length <= 1) return { start: nums[0] || 0, step: 0 };
    const step = nums[nums.length - 1] - nums[nums.length - 2];
    return { start: nums[nums.length - 1], step };
  }
  function applyAutoFill(baseRange, previewRange){
    const base = normalizeRange(baseRange);
    const target = normalizeRange(previewRange);
    if (base.r1 === target.r1 && base.c1 === target.c1 && base.r2 === target.r2 && base.c2 === target.c2) return;
    const baseValues = getRangeValues(base);

    if (target.c1 === base.c1 && target.c2 === base.c2 && target.r2 > base.r2) {
      const extraRows = target.r2 - base.r2;
      const h = base.r2 - base.r1 + 1;
      const w = base.c2 - base.c1 + 1;
      for (let c = 0; c < w; c += 1) {
        const pattern = baseValues.map(row => row[c]);
        const numeric = numericPattern(pattern);
        for (let i = 0; i < extraRows; i += 1) {
          const rr = base.r2 + 1 + i;
          const value = numeric ? String(numeric.start + numeric.step * (i + 1)).replace(/\.0+$/, '') : pattern[i % h];
          updateCellValue(rr, base.c1 + c, value);
        }
      }
      setSelection(base.r1, base.c1, target.r2, target.c2, false);
      return;
    }
    if (target.r1 === base.r1 && target.r2 === base.r2 && target.c2 > base.c2) {
      const extraCols = target.c2 - base.c2;
      const h = base.r2 - base.r1 + 1;
      const w = base.c2 - base.c1 + 1;
      for (let r = 0; r < h; r += 1) {
        const pattern = baseValues[r].slice();
        const numeric = numericPattern(pattern);
        for (let i = 0; i < extraCols; i += 1) {
          const cc = base.c2 + 1 + i;
          const value = numeric ? String(numeric.start + numeric.step * (i + 1)).replace(/\.0+$/, '') : pattern[i % w];
          updateCellValue(base.r1 + r, cc, value);
        }
      }
      setSelection(base.r1, base.c1, target.r2, target.c2, false);
      return;
    }
    const full = getRangeValues(base);
    for (let r = target.r1; r <= target.r2; r += 1) {
      for (let c = target.c1; c <= target.c2; c += 1) {
        if (r >= base.r1 && r <= base.r2 && c >= base.c1 && c <= base.c2) continue;
        const vr = (r - base.r1) % full.length;
        const vc = (c - base.c1) % full[0].length;
        updateCellValue(r, c, full[(vr + full.length) % full.length][(vc + full[0].length) % full[0].length]);
      }
    }
    setSelection(target.r1, target.c1, target.r2, target.c2, false);
  }
  function startFillDrag(){
    state.fillBase = currentRange();
    state.fillDragging = true;
    state.fillPreview = null;
    document.body.classList.add('sb-is-filling');
  }
  function finishFillDrag(){
    if (!state.fillDragging) return;
    if (state.fillBase && state.fillPreview) applyAutoFill(state.fillBase, state.fillPreview);
    state.fillDragging = false;
    state.fillBase = null;
    state.fillPreview = null;
    document.body.classList.remove('sb-is-filling');
    applySelectionClasses();
    schedulePreview();
  }
  function startResize(kind, index, originX, originY){
    state.resizing = {
      kind, index,
      originX, originY,
      start: kind === 'col' ? state.colWidths[index] : state.rowHeights[index]
    };
    document.body.classList.add(kind === 'col' ? 'sb-is-resizing-col' : 'sb-is-resizing-row');
  }
  function updateResize(evt){
    if (!state.resizing) return;
    if (state.resizing.kind === 'col') {
      const delta = evt.clientX - state.resizing.originX;
      state.colWidths[state.resizing.index] = clamp(state.resizing.start + delta, MIN_COL_WIDTH, MAX_COL_WIDTH);
    } else {
      const delta = evt.clientY - state.resizing.originY;
      state.rowHeights[state.resizing.index] = clamp(state.resizing.start + delta, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT);
    }
    buildGrid();
    applySelectionClasses();
  }
  function finishResize(){
    if (!state.resizing) return;
    document.body.classList.remove('sb-is-resizing-col');
    document.body.classList.remove('sb-is-resizing-row');
    state.resizing = null;
  }
  function bindPasteOnGrid(){
    const table = $('#SbDataGrid');
    if (!table || table.dataset.pasteBound === '1') return;
    table.dataset.pasteBound = '1';

    table.addEventListener('paste', function(e){
      const target = e.target.closest('textarea[data-cell]');
      if (!target) return;
      const text = (e.clipboardData || window.clipboardData)?.getData('text');
      if (!text) return;
      const startRow = Number(target.dataset.r || 0);
      const startCol = Number(target.dataset.c || 0);
      const rows = text.replace(/\r/g, '').split('\n').filter(line => line !== '').map(line => line.split('\t'));
      if (!rows.length) return;
      e.preventDefault();
      rows.forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
          const rr = startRow + rIdx;
          const cc = startCol + cIdx;
          if (rr < ROWS && cc < COLS) updateCellValue(rr, cc, cell);
        });
      });
      setSelection(startRow, startCol, Math.min(ROWS - 1, startRow + rows.length - 1), Math.min(COLS - 1, startCol + rows[0].length - 1), true);
      schedulePreview();
    });

    table.addEventListener('copy', function(e){
      const active = document.activeElement;
      if (active && active.matches('textarea[data-cell]')) {
        const range = currentRange();
        if (range.r1 !== range.r2 || range.c1 !== range.c2) {
          e.preventDefault();
          e.clipboardData.setData('text/plain', buildTSVFromRange(range));
        }
      }
    });

    table.addEventListener('cut', function(e){
      const active = document.activeElement;
      if (active && active.matches('textarea[data-cell]')) {
        const range = currentRange();
        if (range.r1 !== range.r2 || range.c1 !== range.c2) {
          e.preventDefault();
          e.clipboardData.setData('text/plain', buildTSVFromRange(range));
          clearRange(range);
        }
      }
    });
  }
  function bindGridInteraction(){
    const card = $('#SlideBuilderCard');
    if (!card || card.dataset.gridBound === '1') return;
    card.dataset.gridBound = '1';

    card.addEventListener('mousedown', function(e){
      const colResizer = e.target.closest('.sb-col-resizer');
      if (colResizer) {
        e.preventDefault();
        startResize('col', Number(colResizer.dataset.c), e.clientX, e.clientY);
        return;
      }
      const rowResizer = e.target.closest('.sb-row-resizer');
      if (rowResizer) {
        e.preventDefault();
        startResize('row', Number(rowResizer.dataset.r), e.clientX, e.clientY);
        return;
      }
      const handle = e.target.closest('.sb-fill-handle');
      if (handle) {
        e.preventDefault();
        startFillDrag();
        return;
      }
      const cell = e.target.closest('.sb-cell');
      if (cell) {
        const r = Number(cell.dataset.r);
        const c = Number(cell.dataset.c);
        state.mouseSelecting = true;
        if (e.shiftKey) setSelection(state.selection.r1, state.selection.c1, r, c, true);
        else setSelection(r, c, r, c, true);
        return;
      }
      const rowHead = e.target.closest('.sb-row-head');
      if (rowHead) {
        const r = Number(rowHead.dataset.r);
        setSelection(r, 0, r, COLS - 1, false);
        const input = getInput(r, 0);
        if (input) input.focus();
        return;
      }
      const colHead = e.target.closest('.sb-col-head');
      if (colHead) {
        const c = Number(colHead.dataset.c);
        setSelection(0, c, ROWS - 1, c, false);
        const input = getInput(0, c);
        if (input) input.focus();
        return;
      }
      const corner = e.target.closest('.sb-corner');
      if (corner) {
        setSelection(0, 0, ROWS - 1, COLS - 1, false);
      }
    });

    card.addEventListener('mouseover', function(e){
      const cell = e.target.closest('.sb-cell');
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      if (state.mouseSelecting) setSelection(state.selection.r1, state.selection.c1, r, c, false);
      if (state.fillDragging && state.fillBase) {
        const base = normalizeRange(state.fillBase);
        const preview = { r1: base.r1, c1: base.c1, r2: base.r2, c2: base.c2 };
        if (r > base.r2) preview.r2 = r;
        else if (r < base.r1) preview.r1 = r;
        else if (c > base.c2) preview.c2 = c;
        else if (c < base.c1) preview.c1 = c;
        state.fillPreview = preview;
        applySelectionClasses();
      }
    });

    document.addEventListener('mousemove', function(e){ updateResize(e); });
    document.addEventListener('mouseup', function(){
      state.mouseSelecting = false;
      finishFillDrag();
      finishResize();
    });

    card.addEventListener('focusin', function(e){
      const input = e.target.closest('textarea[data-cell]');
      if (!input) return;
      const r = Number(input.dataset.r);
      const c = Number(input.dataset.c);
      state.active = { r, c };
      const raw = getRawCellValue(r, c);
      if (raw.startsWith('=')) input.value = raw;
      const range = currentRange();
      const inside = r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
      if (!inside) setSelection(r, c, r, c, false);
      else { applySelectionClasses(); refreshFormulaBar(); }
    });
    card.addEventListener('focusout', function(e){
      const input = e.target.closest('textarea[data-cell]');
      if (!input) return;
      const r = Number(input.dataset.r);
      const c = Number(input.dataset.c);
      const raw = getRawCellValue(r, c);
      if (raw.startsWith('=')) input.value = displayCellValue(r, c);
    });

    card.addEventListener('input', function(e){
      const input = e.target.closest('textarea[data-cell]');
      if (!input) {
        if (e.target.matches('#SbTitle, #SbDescription, #SbSource')) schedulePreview();
        return;
      }
      updateCellValue(Number(input.dataset.r), Number(input.dataset.c), input.value);
      refreshFormulaBar();
      schedulePreview();
    });

    card.addEventListener('keydown', function(e){
      const input = e.target.closest('textarea[data-cell]');
      if (!input) return;
      const r = Number(input.dataset.r);
      const c = Number(input.dataset.c);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelection(0, 0, ROWS - 1, COLS - 1, false);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        focusCell(r + 1, c, false);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        focusCell(r, c + (e.shiftKey ? -1 : 1), false);
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); focusCell(r + 1, c, e.shiftKey); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(r - 1, c, e.shiftKey); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); focusCell(r, c - 1, e.shiftKey); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); focusCell(r, c + 1, e.shiftKey); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const range = currentRange();
        if (range.r1 !== range.r2 || range.c1 !== range.c2) {
          e.preventDefault();
          clearRange(range);
          focusCell(range.r1, range.c1, false);
        }
      }
    });
  }

  function ensureSheetWrapResizer(){
    const wrap = $('#SbSheetWrap');
    if (!wrap) return;
    wrap.style.minHeight = SHEET_MIN_HEIGHT + 'px';
    wrap.style.maxHeight = SHEET_MAX_HEIGHT + 'px';
    if (!wrap.style.height) wrap.style.height = SHEET_MIN_HEIGHT + 'px';
    let handle = wrap.querySelector('.sb-sheet-resizer');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'sb-sheet-resizer';
      handle.setAttribute('aria-hidden', 'true');
      wrap.appendChild(handle);
    }
    if (!handle.dataset.bound) {
      handle.dataset.bound = '1';
      handle.addEventListener('mousedown', function(e){
        e.preventDefault();
        state.sheetResize = { startY: e.clientY, startH: wrap.getBoundingClientRect().height };
        document.body.classList.add('sb-is-resizing-sheet');
      });
    }
    if (!document.body.dataset.sbSheetResizeBound) {
      document.body.dataset.sbSheetResizeBound = '1';
      document.addEventListener('mousemove', function(e){
        if (!state.sheetResize) return;
        const next = clamp(state.sheetResize.startH + (e.clientY - state.sheetResize.startY), SHEET_MIN_HEIGHT, SHEET_MAX_HEIGHT);
        wrap.style.height = next + 'px';
      });
      document.addEventListener('mouseup', function(){
        if (!state.sheetResize) return;
        state.sheetResize = null;
        document.body.classList.remove('sb-is-resizing-sheet');
      });
    }
  }

  function bindGlobalExportInterceptor(){
    const btn = document.getElementById('BtnProcedi');
    if (!btn || btn.dataset.slidebuilderCapture === '1') return;
    btn.dataset.slidebuilderCapture = '1';
    btn.addEventListener('click', function(e){
      if ((window.currentMode || '') !== 'slidebuilder') return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      exportPpt().catch(err => {
        console.error(err);
        alert('Errore: ' + (err && err.message ? err.message : err));
      });
    }, true);
  }
  function bind(){
    const card = document.getElementById('SlideBuilderCard');
    if (!card || card.dataset.bound === '1') return;
    card.dataset.bound = '1';

    buildGrid();
    ensureSheetWrapResizer();
    bindPasteOnGrid();
    bindGridInteraction();
    bindGlobalExportInterceptor();

    const formulaInput = $('#SbFormulaInput');
    const fxPreset = $('#SbFxPreset');
    if (formulaInput && !formulaInput.dataset.bound) {
      formulaInput.dataset.bound = '1';
      formulaInput.addEventListener('input', function(){
        updateCellValue(state.active.r, state.active.c, formulaInput.value || '');
        const activeInput = getInput(state.active.r, state.active.c);
        if (activeInput && document.activeElement !== activeInput) activeInput.value = formulaInput.value || '';
        schedulePreview();
      });
      formulaInput.addEventListener('keydown', function(e){
        if (e.key === 'Enter') {
          e.preventDefault();
          const next = getInput(state.active.r, state.active.c);
          if (next) next.focus();
        }
      });
    }
    if (fxPreset && !fxPreset.dataset.bound) {
      fxPreset.dataset.bound = '1';
      fxPreset.addEventListener('change', function(){
        if (!fxPreset.value) return;
        const preset = '=' + fxPreset.value + '(';
        updateCellValue(state.active.r, state.active.c, preset);
        const activeInput = getInput(state.active.r, state.active.c);
        if (activeInput) { activeInput.value = preset; activeInput.focus(); }
        refreshFormulaBar();
        fxPreset.value = '';
        schedulePreview();
      });
    }
    card.addEventListener('click', function(e){
      const typeBtn = e.target.closest('#SbTypeSwitch .platform-switch-btn');
      if (typeBtn) { setType(typeBtn.dataset.type); return; }
      const chartBtn = e.target.closest('#SbChartSwitch .platform-switch-btn');
      if (chartBtn) { setChart(chartBtn.dataset.chart); return; }
      if (e.target.id === 'SbResetGrid') { resetGrid(); return; }
    });

    if (typeof window.selectMode === 'function' && !window.selectMode.__slidebuilderPatched) {
      const original = window.selectMode;
      const wrapped = function(mode){
        const result = original.apply(this, arguments);
        if (mode === 'slidebuilder') {
          const btn = document.getElementById('BtnProcedi');
          if (btn) {
            btn.classList.remove('hidden');
            btn.textContent = 'Esporta PPT';
          }
        }
        return result;
      };
      wrapped.__slidebuilderPatched = true;
      window.selectMode = wrapped;
    }

    setType(state.type);
    setChart(state.chartType);
    focusCell(0, 0, false);
    schedulePreview();
  }
  function init(){
    if (!hasCard()) return;
    if (!isAdmin()) return;
    bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
