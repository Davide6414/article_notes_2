// Minimal interactivity for visualization + edit (no insertion)
const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyRXsW2jhj_NarPEyX5T8Yqf8U05qrZtPWReMwC9oW4dHTqXegnZhUmCwuYVmMXZ1uX/exec';

document.addEventListener('DOMContentLoaded', async () => {
  // Evita CORS: usa direttamente JSONP per caricare le tabelle
  console.log('[tables] loading via JSONP');
  await loadSheetsJSONP();
  setupNotesPage();
  setupDataPage();
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
    script.onerror = () => {
      console.error('[tables] jsonp load error', script.src);
      resolve();
    };
    document.head.appendChild(script);
  });
}

function fillDatalist(id, items){
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.innerHTML = '';
  [...new Set((items||[]).map(x => String(x||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b))
    .forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      dl.appendChild(o);
    });
}

function setupNotesPage(){
  const tabsRoot = document.getElementById('notes-tabs');
  if (!tabsRoot) return;
  const sheets = window.__SHEETS__ || {};
  const notes = sheets['Notes'] || { headers: [], rows: [] };
  const rows = (notes.rows || []).slice(0); // shallow copy
  // datalist for editing
  fillDatalist('dl-notes-type', pluckColumn(rows, 'type'));
  fillDatalist('dl-notes-tags', splitTags(pluckColumn(rows, 'tags')));

  // Group by title
  const groups = {};
  rows.forEach(r => {
    const key = String(r.title || 'Senza titolo').trim() || 'Senza titolo';
    (groups[key] = groups[key] || []).push(r);
  });
  const titles = Object.keys(groups).sort((a,b)=>a.localeCompare(b));

  const tablist = tabsRoot.querySelector('.tablist');
  const panels = tabsRoot.querySelector('.panels');
  tablist.innerHTML = '';
  panels.innerHTML = '';

  titles.forEach((t, idx) => {
    const id = 'tab_' + idx;
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (idx===0?' active':'');
    btn.type = 'button';
    btn.setAttribute('role','tab');
    btn.setAttribute('aria-controls', id);
    btn.textContent = t || 'Senza titolo';
    tablist.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'tab-panel' + (idx===0?' active':'');
    panel.id = id;
    panel.setAttribute('role','tabpanel');
    const grid = document.createElement('div');
    grid.className = 'panel-grid';
    (groups[t] || []).forEach(r => renderNoteCard(grid, r));
    panel.appendChild(grid);
    panels.appendChild(panel);

    btn.addEventListener('click', () => activateTab(btn, panel));
  });
}

function setupDataPage(){
  const mount = document.getElementById('data-list');
  if (!mount) return;
  const sheets = window.__SHEETS__ || {};
  const data = sheets['Data'] || { headers: [], rows: [] };
  fillDatalist('dl-data-variable', pluckColumn(data.rows, 'variable'));
  fillDatalist('dl-data-unit', pluckColumn(data.rows, 'unit'));
  fillDatalist('dl-data-type', pluckColumn(data.rows, 'dataType'));
  fillDatalist('dl-data-tags', splitTags(pluckColumn(data.rows, 'dataTags')));
  const rows = data.rows || [];
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Variable</th><th>Value</th><th>ControlValue</th><th>Unit</th><th>N</th><th>Link</th><th>DOI</th><th>Azioni</th></tr></thead>';
  const tb = document.createElement('tbody');
  rows.slice(0, 200).forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.row = r.row;
    appendDataCells(tr, r);
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  mount.innerHTML = '<h2>Elenco Dati</h2>';
  mount.appendChild(table);
}

function appendNotesCells(tr, r){
  tr.innerHTML = '';
  if (r && r.row && !tr.dataset.row) tr.dataset.row = String(r.row);
  const cells = [
    td(escapeHtml(r.id||'')),
    td(escapeHtml(r.title||'')),
    td(escapeHtml(r.type||'')),
    td(escapeHtml(r.tags||'')),
    td(escapeHtml(r.doi||'')),
    td(r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''),
    td(escapeHtml(r.linkedIds||'')),
    td(`<button class="btn" data-act="link">Collega</button> <button class="btn" data-act="edit">Modifica</button>`)
  ];
  cells.forEach(c => tr.appendChild(c));
  const btnEdit = tr.querySelector('[data-act="edit"]');
  if (btnEdit) btnEdit.addEventListener('click', () => editNotesRow(tr, r));
  const btnLink = tr.querySelector('[data-act="link"]');
  if (btnLink) btnLink.addEventListener('click', async () => {
    const rowNum = getRowNumberFor(tr, r, 'Notes');
    const selection = await openLinkDialog(r, (window.__SHEETS__ && window.__SHEETS__['Notes'] && window.__SHEETS__['Notes'].rows) || []);
    if (!selection) return;
    const linked = selection.join(',');
    console.log('[link] chosen', { row: rowNum, linked });
    const ok = await updateSheet('Notes', rowNum, { linkedIds: linked });
    if (ok) { r.linkedIds = linked; appendNotesCells(tr, r); }
    else { alert('Salvataggio link fallito'); }
  });
}

function editNotesRow(tr, r){
  tr.innerHTML = '';
  const inputs = {
    title: input(r.title||''),
    type: input(r.type||'', 'dl-notes-type'),
    tags: input(r.tags||'', 'dl-notes-tags'),
    doi: input(r.doi||''),
    link: input(r.link||'')
  };
  ['title','type','tags','doi','link'].forEach(k => tr.appendChild(td('').appendChildRet(inputs[k])));
  const actions = td('');
  actions.innerHTML = `<button class="btn" data-act="save">Salva</button> <button class="btn" data-act="cancel">Annulla</button>`;
  tr.appendChild(actions);
  actions.querySelector('[data-act="cancel"]').addEventListener('click', () => appendNotesCells(tr, r));
  actions.querySelector('[data-act="save"]').addEventListener('click', async () => {
    const patch = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
    const rowNum = getRowNumberFor(tr, r, 'Notes');
    console.log('[update] sending', { sheet: 'Notes', row: rowNum, patch });
    const ok = await updateSheet('Notes', rowNum, patch);
    if (ok) {
      Object.assign(r, patch);
      console.log('[update] saved', { sheet: 'Notes', row: Number(tr.dataset.row) });
      appendNotesCells(tr, r);
    } else {
      console.warn('[update] failed', { sheet: 'Notes', row: Number(tr.dataset.row) });
      alert('Aggiornamento fallito');
    }
  });
}

function activateTab(btn, panel){
  const tablist = btn.parentElement;
  tablist.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const panels = tablist.nextElementSibling;
  if (!panels) return;
  panels.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
}

function renderNoteCard(container, r){
  const card = document.createElement('div');
  card.className = 'card note-card';
  if (r && r.row) card.dataset.row = String(r.row);
  card.innerHTML = `
    <div class="card-header">
      <div class="note-id">ID: ${escapeHtml(r.id||'')}</div>
      <div class="card-actions">
        <button class="btn btn-small" data-act="link">Collega</button>
        <button class="btn btn-small" data-act="edit">Modifica</button>
      </div>
    </div>
    <div class="card-body">
      <div class="card-row"><strong>Title:</strong> ${escapeHtml(r.title||'')}</div>
      <div class="card-row"><strong>Tags:</strong> ${escapeHtml(r.tags||'')}</div>
      <div class="card-row"><strong>Type:</strong> ${escapeHtml(r.type||'')}</div>
      <div class="card-row"><strong>DOI:</strong> ${escapeHtml(r.doi||'')}</div>
      <div class="card-row"><strong>Link:</strong> ${r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''}</div>
      <div class="card-row"><strong>LinkedIDs:</strong> ${escapeHtml(r.linkedIds||'')}</div>
    </div>`;
  container.appendChild(card);
  const btnEdit = card.querySelector('[data-act="edit"]');
  const btnLink = card.querySelector('[data-act="link"]');
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
}

function editNoteCard(card, r){
  const inputs = {
    title: input(r.title||''),
    type: input(r.type||'', 'dl-notes-type'),
    tags: input(r.tags||'', 'dl-notes-tags'),
    doi: input(r.doi||''),
    link: input(r.link||'')
  };
  card.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `<div class="note-id">ID: ${escapeHtml(r.id||'')}</div>`;
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const btnSave = document.createElement('button'); btnSave.className = 'btn btn-small'; btnSave.textContent = 'Salva';
  const btnCancel = document.createElement('button'); btnCancel.className = 'btn btn-small'; btnCancel.textContent = 'Annulla';
  actions.appendChild(btnSave); actions.appendChild(btnCancel); header.appendChild(actions);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'card-body';
  const fields = [
    ['Title','title'], ['Tags','tags'], ['Type','type'], ['DOI','doi'], ['Link','link']
  ];
  fields.forEach(([label,key]) => {
    const row = document.createElement('div');
    row.className = 'card-row';
    const lab = document.createElement('strong'); lab.textContent = label + ': ';
    row.appendChild(lab); row.appendChild(inputs[key]);
    body.appendChild(row);
  });
  card.appendChild(body);

  btnCancel.addEventListener('click', () => {
    const parent = card.parentElement; if (!parent) return; const idx = Array.from(parent.children).indexOf(card);
    renderNoteCard(parent, r); parent.children[idx].previousSibling?.remove; card.remove();
  });
  btnSave.addEventListener('click', async () => {
    const patch = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
    const rowNum = getRowNumberFor(card, r, 'Notes');
    console.log('[update] sending', { sheet: 'Notes', row: rowNum, patch });
    const ok = await updateSheet('Notes', rowNum, patch);
    if (ok) {
      Object.assign(r, patch);
      const parent = card.parentElement; if (!parent) return; const idx = Array.from(parent.children).indexOf(card);
      renderNoteCard(parent, r); parent.children[idx].previousSibling?.remove; card.remove();
    } else {
      alert('Aggiornamento fallito');
    }
  });
}

function appendDataCells(tr, r){
  tr.innerHTML = '';
  if (r && r.row && !tr.dataset.row) tr.dataset.row = String(r.row);
  const cells = [
    td(escapeHtml(r.variable||'')),
    td(escapeHtml(r.value||'')),
    td(escapeHtml(r.controlValue||'')),
    td(escapeHtml(r.unit||'')),
    td(escapeHtml(r.n||'')),
    td(r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''),
    td(escapeHtml(r.doi||'')),
    td(`<button class="btn" data-act="edit">Modifica</button>`)
  ];
  cells.forEach(c => tr.appendChild(c));
  tr.querySelector('[data-act="edit"]').addEventListener('click', () => editDataRow(tr, r));
}

function editDataRow(tr, r){
  tr.innerHTML = '';
  const inputs = {
    variable: input(r.variable||'', 'dl-data-variable'),
    value: input(r.value||''),
    controlValue: input(r.controlValue||''),
    unit: input(r.unit||'', 'dl-data-unit'),
    n: input(r.n||''),
    link: input(r.link||''),
    doi: input(r.doi||'')
  };
  ['variable','value','controlValue','unit','n','link','doi'].forEach(k => tr.appendChild(td('').appendChildRet(inputs[k])));
  const actions = td('');
  actions.innerHTML = `<button class="btn" data-act="save">Salva</button> <button class="btn" data-act="cancel">Annulla</button>`;
  tr.appendChild(actions);
  actions.querySelector('[data-act="cancel"]').addEventListener('click', () => appendDataCells(tr, r));
  actions.querySelector('[data-act="save"]').addEventListener('click', async () => {
    const patch = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
    const rowNum = getRowNumberFor(tr, r, 'Data');
    console.log('[update] sending', { sheet: 'Data', row: rowNum, patch });
    const ok = await updateSheet('Data', rowNum, patch);
    if (ok) {
      Object.assign(r, patch);
      console.log('[update] saved', { sheet: 'Data', row: Number(tr.dataset.row) });
      appendDataCells(tr, r);
    } else {
      console.warn('[update] failed', { sheet: 'Data', row: Number(tr.dataset.row) });
      alert('Aggiornamento fallito');
    }
  });
}

function td(html){
  const d = document.createElement('td');
  if (html) d.innerHTML = html;
  return d;
}
Element.prototype.appendChildRet = function(el){ this.appendChild(el); return this; };

function input(val, listId){
  const el = document.createElement('input');
  el.value = String(val||'');
  if (listId) el.setAttribute('list', listId);
  return el;
}

async function updateSheet(sheet, row, patch){
  // Evita CORS su GitHub Pages: usa sempre JSONP per l'update
  return await updateSheetJSONP(sheet, row, patch);
}

function updateSheetJSONP(sheet, row, patch){
  return new Promise((resolve) => {
    const cb = '__UPDATE_CB_' + Math.random().toString(36).slice(2);
    window[cb] = (resp) => {
      try {
        console.log('[update] response', resp);
        resolve(!!(resp && resp.ok));
      } finally {
        delete window[cb];
        script.remove();
      }
    };
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set('action','update');
    url.searchParams.set('sheet', sheet);
    url.searchParams.set('row', String(row));
    url.searchParams.set('data', JSON.stringify(patch));
    url.searchParams.set('callback', cb);
    const script = document.createElement('script');
    script.src = url.toString();
    script.async = true;
    console.log('[update] jsonp url', script.src);
    script.onerror = () => {
      console.error('[update] jsonp load error', script.src);
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

function getRowNumberFor(tr, r, sheet){
  let row = Number(tr && tr.dataset ? tr.dataset.row : undefined);
  if (!row || Number.isNaN(row)) row = Number(r && r.row);
  if (!row || Number.isNaN(row)) {
    try {
      const rows = (window.__SHEETS__ && window.__SHEETS__[sheet] && window.__SHEETS__[sheet].rows) || [];
      const idx = rows.indexOf(r);
      if (idx >= 0) row = idx + 2; // header is row 1
    } catch {}
  }
  if (!row || Number.isNaN(row)) {
    console.warn('[update] missing row number; cannot update', { sheet, r });
    row = NaN;
  }
  return row;
}

function pluckColumn(rows, key){
  const out = [];
  (rows||[]).forEach(r => { if (r && r[key]) out.push(r[key]); });
  return out;
}

function splitTags(items){
  const out = [];
  (items||[]).forEach(v => String(v||'').split(/[;,]/).forEach(p => { const t = p.trim(); if (t) out.push(t); }));
  return out;
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s){
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// ---- Dialog linking (Notes) ----
function openLinkDialog(currentRow, allRows){
  return new Promise((resolve) => {
    const preselected = new Set(String(currentRow && currentRow.linkedIds || '').split(/[;,]/).map(x=>String(x).trim()).filter(Boolean));
    const selfId = String(currentRow && (currentRow.id || currentRow.row || ''));
    if (selfId) preselected.delete(selfId); // non linkare a se stessa

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Collega righe (Notes)</h3>
          <button class="modal-close" title="Chiudi">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-search">
            <input type="text" placeholder="Filtra per ID o titolo..." class="modal-filter" />
            <div class="modal-actions-small">
              <button class="btn btn-small modal-select-all">Seleziona tutti</button>
              <button class="btn btn-small modal-clear-all">Pulisci</button>
            </div>
          </div>
          <div class="modal-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn modal-cancel">Annulla</button>
          <button class="btn btn-primary modal-confirm">Conferma</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const list = overlay.querySelector('.modal-list');
    const filter = overlay.querySelector('.modal-filter');
    const btnClose = overlay.querySelector('.modal-close');
    const btnCancel = overlay.querySelector('.modal-cancel');
    const btnConfirm = overlay.querySelector('.modal-confirm');
    const btnSelAll = overlay.querySelector('.modal-select-all');
    const btnClrAll = overlay.querySelector('.modal-clear-all');

    const candidates = (allRows||[])
      .map(r => ({ id: String(r.id || r.row || ''), title: String(r.title||''), row: r }))
      .filter(x => x.id && x.id !== selfId);

    function render(filterText=''){
      const q = String(filterText||'').toLowerCase();
      list.innerHTML = '';
      candidates
        .filter(x => !q || x.id.toLowerCase().includes(q) || x.title.toLowerCase().includes(q))
        .slice(0, 500)
        .forEach(x => {
          const item = document.createElement('label');
          item.className = 'modal-item';
          const checked = preselected.has(x.id);
          item.innerHTML = `<input type="checkbox" value="${escapeAttr(x.id)}" ${checked?'checked':''}/> <span class="id">${escapeHtml(x.id)}</span> <span class="title">${escapeHtml(x.title)}</span>`;
          list.appendChild(item);
        });
    }
    render();

    function close(ret){
      try { document.body.removeChild(overlay); } catch {}
      resolve(ret);
    }
    btnClose.addEventListener('click', ()=>close(null));
    btnCancel.addEventListener('click', ()=>close(null));
    btnConfirm.addEventListener('click', ()=>{
      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value);
      close(selected);
    });
    btnSelAll.addEventListener('click', ()=>{
      list.querySelectorAll('input[type="checkbox"]').forEach(i=>{ i.checked = true; });
    });
    btnClrAll.addEventListener('click', ()=>{
      list.querySelectorAll('input[type="checkbox"]').forEach(i=>{ i.checked = false; });
    });
    filter.addEventListener('input', ()=>render(filter.value));
    overlay.querySelector('.modal-backdrop').addEventListener('click', ()=>close(null));
  });
}
