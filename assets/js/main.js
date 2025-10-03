// Minimal interactivity for visualization + edit (no insertion)
const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyRXsW2jhj_NarPEyX5T8Yqf8U05qrZtPWReMwC9oW4dHTqXegnZhUmCwuYVmMXZ1uX/exec';

document.addEventListener('DOMContentLoaded', async () => {
  // Evita CORS: usa direttamente JSONP per caricare le tabelle
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
          console.log('Loaded sheets via JSONP:', Object.keys(window.__SHEETS__));
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
  const mount = document.getElementById('notes-list');
  if (!mount) return;
  const sheets = window.__SHEETS__ || {};
  const notes = sheets['Notes'] || { headers: [], rows: [] };
  fillDatalist('dl-notes-type', pluckColumn(notes.rows, 'type'));
  fillDatalist('dl-notes-tags', splitTags(pluckColumn(notes.rows, 'tags')));
  const rows = notes.rows || [];
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Title</th><th>Type</th><th>Tags</th><th>DOI</th><th>Link</th><th>Azioni</th></tr></thead>';
  const tb = document.createElement('tbody');
  rows.slice(0, 200).forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.row = r.row;
    appendNotesCells(tr, r);
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  mount.innerHTML = '<h2>Elenco Note</h2>';
  mount.appendChild(table);
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
  const cells = [
    td(escapeHtml(r.title||'')),
    td(escapeHtml(r.type||'')),
    td(escapeHtml(r.tags||'')),
    td(escapeHtml(r.doi||'')),
    td(r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''),
    td(`<button class="btn" data-act="edit">Modifica</button>`)
  ];
  cells.forEach(c => tr.appendChild(c));
  tr.querySelector('[data-act="edit"]').addEventListener('click', () => editNotesRow(tr, r));
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
    const ok = await updateSheet('Notes', Number(tr.dataset.row), patch);
    if (ok) { Object.assign(r, patch); appendNotesCells(tr, r); } else { alert('Aggiornamento fallito'); }
  });
}

function appendDataCells(tr, r){
  tr.innerHTML = '';
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
    const ok = await updateSheet('Data', Number(tr.dataset.row), patch);
    if (ok) { Object.assign(r, patch); appendDataCells(tr, r); } else { alert('Aggiornamento fallito'); }
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
    window[cb] = (resp) => { try { resolve(!!(resp && resp.ok)); } finally { delete window[cb]; script.remove(); } };
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set('action','update');
    url.searchParams.set('sheet', sheet);
    url.searchParams.set('row', String(row));
    url.searchParams.set('data', JSON.stringify(patch));
    url.searchParams.set('callback', cb);
    const script = document.createElement('script');
    script.src = url.toString();
    script.async = true;
    document.head.appendChild(script);
  });
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
