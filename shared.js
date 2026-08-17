// ============================================================
// QRZ FOOD — FUNÇÕES COMPARTILHADAS (shared.js)
// ============================================================
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function parseDecimal(str) {
    if (!str || str === '' || str === 'None') return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
}
function formatBRL(num) {
    return 'R\u0024 ' + (num || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatDate(str) {
    if (!str || str === '' || str === 'None') return '—';
    try { const d = new Date(str); return isNaN(d) ? str : d.toLocaleDateString('pt-BR'); } catch { return str; }
}
function formatDateTime(str) {
    if (!str || str === '' || str === 'None') return '—';
    try {
        const d = new Date(str);
        if (isNaN(d)) return str;
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return str; }
}
function toDateObj(str) {
    if (!str || str === '' || str === 'None') return null;
    const d = new Date(str); return isNaN(d) ? null : d;
}
function escapeHTML(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    document.getElementById('toastMsg').textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}
function initTheme() {
    const saved = localStorage.getItem('qrzfood_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
}
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qrzfood_theme', theme);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
}
function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(cur === 'dark' ? 'light' : 'dark');
}
