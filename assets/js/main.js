// Minimal interactivity for the static pages
const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyRXsW2jhj_NarPEyX5T8Yqf8U05qrZtPWReMwC9oW4dHTqXegnZhUmCwuYVmMXZ1uX/exec';

document.addEventListener('DOMContentLoaded', async () => {
  // Fetch all tables at once so pages can parse locally later
  try {
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set('action', 'tables');
    const resp = await fetch(url.toString(), { method: 'GET', mode: 'cors', cache: 'no-store' });
    const data = await resp.json();
    if (data && data.ok) {
      window.__SHEETS__ = data.sheets || {};
      console.log('Loaded sheets:', Object.keys(window.__SHEETS__));
    } else {
      console.warn('Sheets load failed:', data);
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
  }

  const dataForm = document.getElementById('form-data');
  if (dataForm) {
    dataForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(dataForm).entries());
      console.log('Data submit:', data);
      alert('Dato salvato localmente (demo). Vedi console.');
    });
  }
});
