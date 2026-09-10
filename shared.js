// ============================================================
// QRZ FOOD — SHARED UTILITIES (Supabase Edition)
// Funções compartilhadas entre admin.js e cliente.js
// ============================================================

// Inicializa cliente Supabase (usa a variável global do CDN)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// CRYPTO
// ============================================================
async function sha256(message) {
    const data = new TextEncoder().encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// FORMATAÇÃO & PARSING
// ============================================================
function parseDecimal(str) {
    if (!str || str === 'None' || str === 'null') return 0;
    return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

function formatBRL(num) {
    return 'R$ ' + (num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(str) {
    if (!str) return '—';
    const d = toDateObj(str);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR');
}

function formatDateTime(str) {
    if (!str) return '—';
    const d = toDateObj(str);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toDateObj(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function escapeHTML(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function slugify(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

// ============================================================
// TEMA (CLARO/ESCURO)
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('qrzfood_theme');
    if (saved) { setTheme(saved); return; }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
    else setTheme('light');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qrzfood_theme', theme);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
}

function toggleTheme() {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(msg) {
    const t = document.getElementById('toast');
    const m = document.getElementById('toastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.add('hidden'), 2800);
}
