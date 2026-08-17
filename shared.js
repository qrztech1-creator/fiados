// ============================================================
// QRZ FOOD — FUNÇÕES COMPARTILHADAS & BANCO LOCAL (shared.js)
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
    return 'R$ ' + (num || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

function escapeHTML(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

function slugify(text) {
    return text.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    const msgEl = document.getElementById('toastMsg');
    if (msgEl) msgEl.textContent = msg;
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

// ============================================================
// INDEXEDDB — PERSISTÊNCIA COMPLETA DE CLIENTES & PLANILHAS
// ============================================================
const DB_NAME = 'qrzfood_database';
const DB_VERSION = 1;

function openQRZDatabase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('clients')) {
                db.createObjectStore('clients', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('client_data')) {
                db.createObjectStore('client_data', { keyPath: 'clientId' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

// Salva ou atualiza metadados do cliente
async function dbSaveClient(client) {
    const db = await openQRZDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('clients', 'readwrite');
        const store = tx.objectStore('clients');
        const req = store.put({
            ...client,
            updatedAt: new Date().toISOString()
        });
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

// Salva ou atualiza os registros brutos do Excel do cliente
async function dbSaveClientData(clientId, rows) {
    const db = await openQRZDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('client_data', 'readwrite');
        const store = tx.objectStore('client_data');
        const req = store.put({
            clientId,
            rows,
            count: rows.length,
            updatedAt: new Date().toISOString()
        });
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

// Retorna todos os clientes (mescla clientes padrão de config com os criados pelo painel)
async function dbGetAllClients() {
    const db = await openQRZDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('clients', 'readonly');
        const store = tx.objectStore('clients');
        const req = store.getAll();
        req.onsuccess = () => {
            const customClients = req.result || [];
            const customIds = new Set(customClients.map(c => c.id));
            
            // Pega clientes nativos do arquivo de configuração caso não tenham sido alterados/excluídos
            const defaultClients = (typeof CLIENTS_CONFIG !== 'undefined' ? CLIENTS_CONFIG : [])
                .filter(c => !customIds.has(c.id));

            resolve([...customClients, ...defaultClients]);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

// Busca um cliente por ID
async function dbGetClient(clientId) {
    const db = await openQRZDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('clients', 'readonly');
        const store = tx.objectStore('clients');
        const req = store.get(clientId);
        req.onsuccess = () => {
            if (req.result) {
                resolve(req.result);
            } else {
                // Fallback para config estático
                const defaultClient = (typeof CLIENTS_CONFIG !== 'undefined' ? CLIENTS_CONFIG : []).find(c => c.id === clientId);
                resolve(defaultClient || null);
            }
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

// Busca os registros de dados de um cliente
async function dbGetClientData(clientId) {
    const db = await openQRZDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('client_data', 'readonly');
        const store = tx.objectStore('client_data');
        const req = store.get(clientId);
        req.onsuccess = () => {
            if (req.result && req.result.rows) {
                resolve(req.result.rows);
            } else {
                resolve(null);
            }
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

// Exclui um cliente e seus dados
async function dbDeleteClient(clientId) {
    const db = await openQRZDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['clients', 'client_data'], 'readwrite');
        tx.objectStore('clients').delete(clientId);
        tx.objectStore('client_data').delete(clientId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
    });
}
