// Minimal interactivity for visualization + edit (no insertion)
const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyRXsW2jhj_NarPEyX5T8Yqf8U05qrZtPWReMwC9oW4dHTqXegnZhUmCwuYVmMXZ1uX/exec';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[tables] loading via JSONP');
  await loadSheetsJSONP();
  setupNotesPage();
  setupDataPage();
  setupLinkedPage();
});

function loadSheetsJSONP(){
  return new Promise((resolve) => {
    const cb = '__SHEETS_CB_' + Math.random().toString(36).slice(2);
    window[cb] = (resp) => {
      try {
        if (resp && resp.ok && resp.sheets) {
          window.__SHEETS__ = resp.sheets;
          const names = Object.keys(window.__SHEETS__);
          console.log('[tables] loaded', { count: names.length, names });
        } else {
          console.warn('[tables] jsonp response not ok', resp);
        }
      } finally {
        delete window[cb];
        script.remove();
        resolve();
      }
    };
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set('action', 'tables');
    url.searchParams.set('callback', cb);
    const script = document.createElement('script');
    script.src = url.toString();
    script.async = true;
    console.log('[tables] jsonp url', script.src);
    script.onerror = () => { console.error('[tables] jsonp load error', script.src); resolve(); };
    document.head.appendChild(script);
  });
}

function fillDatalist(id, items){
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.innerHTML = '';
  [...new Set((items||[]).map(x => String(x||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b))
    .forEach(v => { const o = document.createElement('option'); o.value = v; dl.appendChild(o); });
}

let NOTES_ROWS = [];
let NOTES_ID_TITLE = {};
let COLLAPSE_STATE = {};
let SHOW_TITLE_IN_CARDS = false;
try { COLLAPSE_STATE = JSON.parse(localStorage.getItem('notesCollapse')||'{}'); } catch { COLLAPSE_STATE = {}; }

function setupNotesPage(){
  const tabsRoot = document.getElementById('notes-tabs');
  if (!tabsRoot) return;
  SHOW_TITLE_IN_CARDS = false;
  const sheets = window.__SHEETS__ || {};
  const notes = sheets['Notes'] || { headers: [], rows: [] };
  NOTES_ROWS = (notes.rows || []).slice(0);
  // Build ID->Title map
  NOTES_ID_TITLE = {};
  NOTES_ROWS.forEach(r => {
    const id = String(r.id || r.row || '').trim();
    if (id) NOTES_ID_TITLE[id] = String(r.title || 'Senza titolo');
  });
  fillDatalist('dl-notes-type', pluckColumn(NOTES_ROWS, 'type'));
  fillDatalist('dl-notes-tags', splitTags(pluckColumn(NOTES_ROWS, 'tags')));

  renderNotesGroups();
}

function activateTab(btn, panel){
  const tablist = btn.parentElement;
  tablist.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const panels = tablist.nextElementSibling; if (!panels) return;
  panels.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
}

function renderNotesGroups(){
  const tabsRoot = document.getElementById('notes-tabs');
  if (!tabsRoot) return;
  const tablist = tabsRoot.querySelector('.tablist');
  const panels = tabsRoot.querySelector('.panels');
  tablist.innerHTML = '';
  panels.innerHTML = '';

  // Always render all groups as collapsible panels
  tablist.style.display = 'none';
  const groups = {};
  NOTES_ROWS.forEach(r => { const key = String(r.title || 'Senza titolo').trim() || 'Senza titolo'; (groups[key] = groups[key] || []).push(r); });
  const titles = Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  titles.forEach((t, idx) => {
    const id = 'panel_' + idx;
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = id;
    const collapsed = !!COLLAPSE_STATE[t];
    if (collapsed) panel.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<h4>${escapeHtml(t||'Senza titolo')}</h4><span class="chev">▾</span>`;
    header.addEventListener('click', () => {
      const now = panel.classList.toggle('collapsed');
      COLLAPSE_STATE[t] = now;
      try { localStorage.setItem('notesCollapse', JSON.stringify(COLLAPSE_STATE)); } catch {}
    });

    const grid = document.createElement('div'); grid.className = 'panel-grid';
    (groups[t] || []).forEach(r => renderNoteCard(grid, r));
    panel.appendChild(header);
    panel.appendChild(grid);
    panels.appendChild(panel);
  });
}

// toggle-all removed as per request

function renderNoteCard(container, r){
  const card = document.createElement('div');
  card.className = 'card note-card';
  if (r && r.row) card.dataset.row = String(r.row);
  const typeColor = getTypeColor(String(r.type||''));
  if (typeColor) { card.classList.add('colored'); card.style.setProperty('--type-color', typeColor); }

  const tags = String(r.tags||'').split(/[;,]/).map(t=>String(t).trim()).filter(Boolean);
  const tagHtml = tags.map(t=>`<span class="tag-chip">${escapeHtml(t)}</span>`).join(' ');
  const animalHtml = r.animal ? `<span class="animal-chip">${escapeHtml(r.animal)}</span>` : '';
  const imgHtml = r.imageLink ? `<div class="note-image"><img src="${escapeAttr(r.imageLink)}" alt="Image" onerror="this.style.display='none'"/></div>` : '';
  const linkedIds = String(r.linkedIds||'').split(/[;,]/).map(x=>String(x).trim()).filter(Boolean);
  const linkedCount = linkedIds.length;
  const titleRow = SHOW_TITLE_IN_CARDS ? `<div class="card-row"><div class="note-title">${escapeHtml(r.title||'')}</div></div>` : '';
  const typeTitle = '<div class="note-type-title"'+(typeColor?(' style="color:'+typeColor+'"'):'')+'>' + escapeHtml(r.type||'') + '</div>';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-actions">
        ${linkedCount ? `<button class="btn btn-small" data-act="open-linked" data-id="${escapeAttr(String(r.id||r.row||''))}">Linked (${linkedCount})</button>` : ''}
        <button class="btn btn-small" data-act="link">Collega</button>
        <button class="btn btn-small" data-act="edit">Modifica</button>
      </div>
    </div>
    <div class="card-body">
      ${typeTitle}
      ${titleRow}
      <div class="card-row note-text-row"><span class="note-text">${escapeHtml(r.text||'')}</span></div>
      <div class="chips-row">${tagHtml}${animalHtml}${r.doi?`<span class="chip">${escapeHtml(r.doi)}</span>`:''}${r.link?`<a class="chip" href="${escapeAttr(r.link)}" target="_blank">Apri</a>`:''}</div>
      ${imgHtml}
      <div class="note-id-small">ID ${escapeHtml(r.id||'')}</div>
    </div>`;
  container.appendChild(card);

  const btnEdit = card.querySelector('[data-act="edit"]');
  const btnLink = card.querySelector('[data-act="link"]');
  const btnOpenLinked = card.querySelector('[data-act="open-linked"]');
  if (btnEdit) btnEdit.addEventListener('click', () => editNoteCard(card, r));
  if (btnLink) btnLink.addEventListener('click', async () => {
    const selection = await openLinkDialog(r, (window.__SHEETS__ && window.__SHEETS__['Notes'] && window.__SHEETS__['Notes'].rows) || []);
    if (!selection) return;
    const linked = selection.join(',');
    const rowNum = getRowNumberFor(card, r, 'Notes');
    console.log('[link] chosen', { row: rowNum, linked });
    const ok = await updateSheet('Notes', rowNum, { linkedIds: linked });
    if (ok) { r.linkedIds = linked; renderNoteCard(container, r); card.replaceWith(container.lastElementChild); }
    else { alert('Salvataggio link fallito'); }
  });
  if (btnOpenLinked) btnOpenLinked.addEventListener('click', () => {
    const id = String(r.id || r.row || '').trim();
    if (id) window.location.href = `linked.html?id=${encodeURIComponent(id)}`;
  });
}

function setupLinkedPage(){
  const root = document.getElementById('linked-root');
  if (!root) return;
  SHOW_TITLE_IN_CARDS = true;
  const sheets = window.__SHEETS__ || {};
  const notes = sheets['Notes'] || { headers: [], rows: [] };
  // Prepare index
  NOTES_ROWS = (notes.rows || []).slice(0);
  NOTES_ID_TITLE = {};
  NOTES_ROWS.forEach(r => { const id = String(r.id || r.row || '').trim(); if (id) NOTES_ID_TITLE[id] = String(r.title || 'Senza titolo'); });
  const q = new URLSearchParams(window.location.search);
  const id = q.get('id') || '';
  const source = NOTES_ROWS.find(r => String(r.id||r.row||'') === id);
  const grid = document.getElementById('linked-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!source) {
    const p = document.createElement('p'); p.textContent = 'Nessuna nota trovata per id=' + id; grid.appendChild(p); return;
  }
  // Render source card (opzionale)
  const srcWrap = document.createElement('div'); srcWrap.className = 'card note-card';
  const srcTitle = document.createElement('div'); srcTitle.className = 'panel-header'; srcTitle.innerHTML = `<h4>Sorgente: ${escapeHtml(source.title||'Senza titolo')} (ID ${escapeHtml(source.id||'')})</h4>`; srcWrap.appendChild(srcTitle); grid.appendChild(srcWrap);
  // Linked
  const linkedIds = String(source.linkedIds||'').split(/[;,]/).map(x=>String(x).trim()).filter(Boolean);
  if (!linkedIds.length) {
    const p = document.createElement('p'); p.textContent = 'Nessun elemento collegato.'; grid.appendChild(p); return;
  }
  const linkedRows = NOTES_ROWS.filter(r => linkedIds.includes(String(r.id||r.row||'')));
  linkedRows.forEach(r => renderNoteCard(grid, r));
}

function editNoteCard(card, r){
  const inputs = { title: input(r.title||''), type: input(r.type||'', 'dl-notes-type'), tags: input(r.tags||'', 'dl-notes-tags'), doi: input(r.doi||''), link: input(r.link||'') };
  const typeColor = getTypeColor(String(r.type||''));
  card.innerHTML = '';
  if (typeColor) { card.classList.add('colored'); card.style.setProperty('--type-color', typeColor); }
  const header = document.createElement('div'); header.className = 'card-header'; header.innerHTML = `<div class="note-id">ID: ${escapeHtml(r.id||'')}</div>`;
  const actions = document.createElement('div'); actions.className = 'card-actions';
  const btnSave = document.createElement('button'); btnSave.className = 'btn btn-small'; btnSave.textContent = 'Salva';
  const btnCancel = document.createElement('button'); btnCancel.className = 'btn btn-small'; btnCancel.textContent = 'Annulla';
  actions.appendChild(btnSave); actions.appendChild(btnCancel); header.appendChild(actions); card.appendChild(header);
  const body = document.createElement('div'); body.className = 'card-body';
  [['Title','title'], ['Tags','tags'], ['Type','type'], ['DOI','doi'], ['Link','link']].forEach(([lab,key]) => { const row = document.createElement('div'); row.className = 'card-row'; const s = document.createElement('strong'); s.textContent = lab+': '; row.appendChild(s); row.appendChild(inputs[key]); body.appendChild(row); });
  card.appendChild(body);
  btnCancel.addEventListener('click', () => { const parent = card.parentElement; if (!parent) return; const idx = Array.from(parent.children).indexOf(card); renderNoteCard(parent, r); parent.children[idx].previousSibling?.remove; card.remove(); });
  btnSave.addEventListener('click', async () => { const patch = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])); const rowNum = getRowNumberFor(card, r, 'Notes'); console.log('[update] sending', { sheet: 'Notes', row: rowNum, patch }); const ok = await updateSheet('Notes', rowNum, patch); if (ok) { Object.assign(r, patch); const parent = card.parentElement; if (!parent) return; const idx = Array.from(parent.children).indexOf(card); renderNoteCard(parent, r); parent.children[idx].previousSibling?.remove; card.remove(); } else { alert('Aggiornamento fallito'); } });
}

function setupDataPage(){
  const mount = document.getElementById('data-list'); if (!mount) return;
  const sheets = window.__SHEETS__ || {}; const data = sheets['Data'] || { headers: [], rows: [] };
  fillDatalist('dl-data-variable', pluckColumn(data.rows, 'variable'));
  fillDatalist('dl-data-unit', pluckColumn(data.rows, 'unit'));
  fillDatalist('dl-data-type', pluckColumn(data.rows, 'dataType'));
  fillDatalist('dl-data-tags', splitTags(pluckColumn(data.rows, 'dataTags')));
  const rows = data.rows || [];
  const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Variable</th><th>Value</th><th>ControlValue</th><th>Unit</th><th>N</th><th>Link</th><th>DOI</th><th>Azioni</th></tr></thead>';
  const tb = document.createElement('tbody'); rows.slice(0, 200).forEach(r => { const tr = document.createElement('tr'); tr.dataset.row = r.row; appendDataCells(tr, r); tb.appendChild(tr); });
  table.appendChild(tb); mount.innerHTML = '<h2>Elenco Dati</h2>'; mount.appendChild(table);
}

function appendDataCells(tr, r){
  tr.innerHTML = '';
  if (r && r.row && !tr.dataset.row) tr.dataset.row = String(r.row);
  const cells = [ td(escapeHtml(r.variable||'')), td(escapeHtml(r.value||'')), td(escapeHtml(r.controlValue||'')), td(escapeHtml(r.unit||'')), td(escapeHtml(r.n||'')), td(r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''), td(escapeHtml(r.doi||'')), td(`<button class="btn" data-act="edit">Modifica</button>`) ];
  cells.forEach(c => tr.appendChild(c));
  tr.querySelector('[data-act="edit"]').addEventListener('click', () => editDataRow(tr, r));
}

function editDataRow(tr, r){
  tr.innerHTML = '';
  const inputs = { variable: input(r.variable||'', 'dl-data-variable'), value: input(r.value||''), controlValue: input(r.controlValue||''), unit: input(r.unit||'', 'dl-data-unit'), n: input(r.n||''), link: input(r.link||''), doi: input(r.doi||'') };
  ['variable','value','controlValue','unit','n','link','doi'].forEach(k => tr.appendChild(td('').appendChildRet(inputs[k])));
  const actions = td(''); actions.innerHTML = `<button class="btn" data-act="save">Salva</button> <button class="btn" data-act="cancel">Annulla</button>`; tr.appendChild(actions);
  actions.querySelector('[data-act="cancel"]').addEventListener('click', () => appendDataCells(tr, r));
  actions.querySelector('[data-act="save"]').addEventListener('click', async () => { const patch = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])); const rowNum = getRowNumberFor(tr, r, 'Data'); console.log('[update] sending', { sheet: 'Data', row: rowNum, patch }); const ok = await updateSheet('Data', rowNum, patch); if (ok) { Object.assign(r, patch); console.log('[update] saved', { sheet: 'Data', row: Number(tr.dataset.row) }); appendDataCells(tr, r); } else { console.warn('[update] failed', { sheet: 'Data', row: Number(tr.dataset.row) }); alert('Aggiornamento fallito'); } });
}

function td(html){ const d = document.createElement('td'); if (html) d.innerHTML = html; return d; }
Element.prototype.appendChildRet = function(el){ this.appendChild(el); return this; };
function input(val, listId){ const el = document.createElement('input'); el.value = String(val||''); if (listId) el.setAttribute('list', listId); return el; }

async function updateSheet(sheet, row, patch){ return await updateSheetJSONP(sheet, row, patch); }
function updateSheetJSONP(sheet, row, patch){
  return new Promise((resolve) => {
    const cb = '__UPDATE_CB_' + Math.random().toString(36).slice(2);
    window[cb] = (resp) => { try { console.log('[update] response', resp); resolve(!!(resp && resp.ok)); } finally { delete window[cb]; script.remove(); } };
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set('action','update'); url.searchParams.set('sheet', sheet); url.searchParams.set('row', String(row)); url.searchParams.set('data', JSON.stringify(patch)); url.searchParams.set('callback', cb);
    const script = document.createElement('script'); script.src = url.toString(); script.async = true; console.log('[update] jsonp url', script.src); script.onerror = () => { console.error('[update] jsonp load error', script.src); resolve(false); }; document.head.appendChild(script);
  });
}

function getRowNumberFor(el, r, sheet){
  let row = Number(el && el.dataset ? el.dataset.row : undefined);
  if (!row || Number.isNaN(row)) row = Number(r && r.row);
  if (!row || Number.isNaN(row)) { try { const rows = (window.__SHEETS__ && window.__SHEETS__[sheet] && window.__SHEETS__[sheet].rows) || []; const idx = rows.indexOf(r); if (idx >= 0) row = idx + 2; } catch {} }
  if (!row || Number.isNaN(row)) { console.warn('[update] missing row number; cannot update', { sheet, r }); row = NaN; }
  return row;
}

function openLinkDialog(currentRow, allRows){
  return new Promise((resolve) => {
    const preselected = new Set(String(currentRow && currentRow.linkedIds || '').split(/[;,]/).map(x=>String(x).trim()).filter(Boolean));
    const selfId = String(currentRow && (currentRow.id || currentRow.row || '')); if (selfId) preselected.delete(selfId);
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog">
        <div class="modal-header"><h3>Collega righe (Notes)</h3><button class="modal-close" title="Chiudi">×</button></div>
        <div class="modal-body">
          <div class="modal-search">
            <input type="text" placeholder="Filtra per ID o titolo..." class="modal-filter" />
            <div class="modal-actions-small"><button class="btn btn-small modal-select-all">Seleziona tutti</button><button class="btn btn-small modal-clear-all">Pulisci</button></div>
          </div>
          <div class="modal-list"></div>
        </div>
        <div class="modal-footer"><button class="btn modal-cancel">Annulla</button><button class="btn btn-primary modal-confirm">Conferma</button></div>
      </div>`; document.body.appendChild(overlay);
    const list = overlay.querySelector('.modal-list'); const filter = overlay.querySelector('.modal-filter'); const btnClose = overlay.querySelector('.modal-close'); const btnCancel = overlay.querySelector('.modal-cancel'); const btnConfirm = overlay.querySelector('.modal-confirm'); const btnSelAll = overlay.querySelector('.modal-select-all'); const btnClrAll = overlay.querySelector('.modal-clear-all');
    const candidates = (allRows||[]).map(r => ({ id: String(r.id || r.row || ''), title: String(r.title||''), row: r })).filter(x => x.id && x.id !== selfId);
    function render(q=''){ const qq = String(q||'').toLowerCase(); list.innerHTML=''; candidates.filter(x => !qq || x.id.toLowerCase().includes(qq) || x.title.toLowerCase().includes(qq)).slice(0,500).forEach(x => { const item = document.createElement('label'); item.className='modal-item'; const checked = preselected.has(x.id); item.innerHTML = `<input type="checkbox" value="${escapeAttr(x.id)}" ${checked?'checked':''}/> <span class="id">${escapeHtml(x.id)}</span> <span class="title">${escapeHtml(x.title)}</span>`; list.appendChild(item); }); }
    render();
    function close(ret){ try { document.body.removeChild(overlay); } catch {} resolve(ret); }
    btnClose.addEventListener('click', ()=>close(null)); btnCancel.addEventListener('click', ()=>close(null)); btnConfirm.addEventListener('click', ()=>{ const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value); close(selected); }); btnSelAll.addEventListener('click', ()=>{ list.querySelectorAll('input[type="checkbox"]').forEach(i=>{ i.checked = true; }); }); btnClrAll.addEventListener('click', ()=>{ list.querySelectorAll('input[type="checkbox"]').forEach(i=>{ i.checked = false; }); }); filter.addEventListener('input', ()=>render(filter.value)); overlay.querySelector('.modal-backdrop').addEventListener('click', ()=>close(null));
  });
}

function pluckColumn(rows, key){ const out = []; (rows||[]).forEach(r => { if (r && r[key]) out.push(r[key]); }); return out; }
function splitTags(items){ const out = []; (items||[]).forEach(v => String(v||'').split(/[;,]/).forEach(p => { const t = p.trim(); if (t) out.push(t); })); return out; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g, '&quot;'); }

// Type color ramp
const TYPE_COLORS = ['#ef4444','#f97316','#f59e0b','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#84cc16'];
function hashString(s){ let h=0; for (let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h|=0; } return Math.abs(h); }
function getTypeColor(type){ const t = String(type||'').trim().toLowerCase(); if (!t) return ''; return TYPE_COLORS[ hashString(t) % TYPE_COLORS.length ]; }
