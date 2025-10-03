// Minimal interactivity for the static pages
const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyRXsW2jhj_NarPEyX5T8Yqf8U05qrZtPWReMwC9oW4dHTqXegnZhUmCwuYVmMXZ1uX/exec';

document.addEventListener('DOMContentLoaded', async () => {
  // Fetch all tables at once so pages can parse locally later
  try {
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set('action', 'tables');
    let ok = false;
    try {
      const resp = await fetch(url.toString(), { method: 'GET', mode: 'cors', cache: 'no-store' });
      const data = await resp.json();
      if (data && data.ok) {
        window.__SHEETS__ = data.sheets || {};
        ok = true;
        console.log('Loaded sheets via fetch:', Object.keys(window.__SHEETS__));
      }
    } catch (e) {
      console.warn('Fetch failed, trying JSONP fallback:', e);
    }
    if (!ok) {
      await loadSheetsJSONP();
    }
  } catch (err) {
    console.warn('Sheets fetch error:', err);
  }
  const notesForm = document.getElementById('form-notes');
  if (notesForm) {
    notesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(notesForm).entries());
      console.log('Notes submit:', data);
      alert('Nota salvata localmente (demo). Vedi console.');
    });
    setupNotesPage();
  }

  const dataForm = document.getElementById('form-data');
  if (dataForm) {
    dataForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(dataForm).entries());
      console.log('Data submit:', data);
      alert('Dato salvato localmente (demo). Vedi console.');
    });
    setupDataPage();
  }
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
  const sheets = window.__SHEETS__ || {};
  const notes = sheets['Notes'] || { headers: [], rows: [] };
  // suggestions
  fillDatalist('dl-notes-type', pluckColumn(notes.rows, 'type'));
  fillDatalist('dl-notes-tags', splitTags(pluckColumn(notes.rows, 'tags')));
  // list render
  const mount = document.getElementById('notes-list');
  if (!mount) return;
  const rows = notes.rows || [];
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Title</th><th>Type</th><th>Tags</th><th>DOI</th><th>Link</th></tr></thead>';
  const tb = document.createElement('tbody');
  rows.slice(0, 200).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.title||'')}</td>
      <td>${escapeHtml(r.type||'')}</td>
      <td>${escapeHtml(r.tags||'')}</td>
      <td>${escapeHtml(r.doi||'')}</td>
      <td>${r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''}</td>
    `;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  mount.innerHTML = '<h2>Elenco Note</h2>';
  mount.appendChild(table);
}

function setupDataPage(){
  const sheets = window.__SHEETS__ || {};
  const data = sheets['Data'] || { headers: [], rows: [] };
  // suggestions
  fillDatalist('dl-data-variable', pluckColumn(data.rows, 'variable'));
  fillDatalist('dl-data-unit', pluckColumn(data.rows, 'unit'));
  fillDatalist('dl-data-type', pluckColumn(data.rows, 'dataType'));
  fillDatalist('dl-data-tags', splitTags(pluckColumn(data.rows, 'dataTags')));
  // list render
  const mount = document.getElementById('data-list');
  if (!mount) return;
  const rows = data.rows || [];
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Variable</th><th>Value</th><th>ControlValue</th><th>Unit</th><th>N</th><th>Link</th><th>DOI</th></tr></thead>';
  const tb = document.createElement('tbody');
  rows.slice(0, 200).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.variable||'')}</td>
      <td>${escapeHtml(r.value||'')}</td>
      <td>${escapeHtml(r.controlValue||'')}</td>
      <td>${escapeHtml(r.unit||'')}</td>
      <td>${escapeHtml(r.n||'')}</td>
      <td>${r.link ? `<a href="${escapeAttr(r.link)}" target="_blank">Apri</a>` : ''}</td>
      <td>${escapeHtml(r.doi||'')}</td>
    `;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  mount.innerHTML = '<h2>Elenco Dati</h2>';
  mount.appendChild(table);
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
