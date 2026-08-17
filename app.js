// ============================================================
// QRZ FOOD — GESTÃO DE FIADOS | Padaria Divino Pão
// Desenvolvido por QRZ Tech (qrztech.com)
// ============================================================

// --- PASSWORD HASH (SHA-256 of the real password — never stored in plain text) ---
const PASSWORD_HASH = 'a534e5db0a1c9a7ed4e97ee451f0b3dae7dd0fa6b6686f777b27fcfb86607157';

// --- CLIENT NAME NORMALIZATION MAP ---
const CLIENT_MAP = {
    'acguaxbrasil':'ACQUAX BRASIL','acqua x brasil':'ACQUAX BRASIL','acquax':'ACQUAX BRASIL',
    'acquax do brasil':'ACQUAX BRASIL','acquaxbrasil':'ACQUAX BRASIL','aqua':'ACQUAX BRASIL',
    'aqua brasil':'ACQUAX BRASIL','c3':'C3 OFICINA','c3 oficina':'C3 OFICINA',
    'carol':'CAROL / KAROL','karol':'CAROL / KAROL','davinny':'DAVINNY','davynni':'DAVINNY',
    'eco mais':'ECO MAIS','eco+':'ECO MAIS','ecomais':'ECO MAIS',
    'fernando':'FERNANDO DE MOURA ALVES','fernando de moura':'FERNANDO DE MOURA ALVES',
    'fernando de moura alves':'FERNANDO DE MOURA ALVES','givanildo':'GIVANILDO',
    'isaque':'ISAQUE','izaque':'ISAQUE','juan':'JUAN','juan padeiro':'JUAN',
    'larissa':'LARYSSA','laryssa':'LARYSSA','leo':'LÉO','léo padeiro':'LÉO',
    'l\u00e9o padeiro':'LÉO','lidyane':'LIDYANE','mbr':'MBR',
    'primicias':'PRIMÍCIAS','primicis':'PRIMÍCIAS','primícias':'PRIMÍCIAS',
    'prim\u00edcias':'PRIMÍCIAS','rayane':'RAYANE / RAYANNE','rayanne':'RAYANE / RAYANNE',
    'rayssa':'RAYANE / RAYANNE','stephany':'STEPHANY','sthephane':'STEPHANY',
    'sthephany':'STEPHANY','suport ferramenta':'SUPPORT FERRAMENTAS',
    'suporte':'SUPPORT FERRAMENTAS','support ferramentas':'SUPPORT FERRAMENTAS',
    'vessa':'VESSA VEÍCULOS','vessa veiculos':'VESSA VEÍCULOS',
    'versa veiculos':'VESSA VEÍCULOS','ana kallytha':'ANA KALLYTHA',
    'andressa ganhadora':'ANDRESSA GANHADORA','arthur ferreira':'ARTHUR FERREIRA',
    'arthuer':'ARTHUR FERREIRA','bel':'BEL','eli':'ELI','fex':'FEX','flaa':'FLAA',
    'leandro':'LEANDRO','lilian da silva':'LILIAN DA SILVA','paulo':'PAULO',
    'raissa':'RAISSA','raquel':'RAQUEL','resutare':'RESUTARE','ruan':'RUAN',
    'thiago sistema':'THIAGO SISTEMA',
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function normalizeClientName(raw) {
    if (!raw || !raw.trim()) return 'SEM NOME';
    return CLIENT_MAP[raw.trim().toLowerCase()] || raw.trim().toUpperCase();
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
function escapeHTML(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ============================================================
// SHA-256 HASH (Web Crypto API)
// ============================================================
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// LOGIN / AUTH
// ============================================================
function initLogin() {
    // Check if already authenticated this session
    if (sessionStorage.getItem('qrzfood_auth') === 'ok') {
        showApp();
        return;
    }

    const form = document.getElementById('loginForm');
    const pwInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');
    const toggleBtn = document.getElementById('togglePw');

    toggleBtn.addEventListener('click', () => {
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hash = await sha256(pwInput.value);
        if (hash === PASSWORD_HASH) {
            sessionStorage.setItem('qrzfood_auth', 'ok');
            showApp();
        } else {
            errorEl.classList.remove('hidden');
            pwInput.value = '';
            pwInput.focus();
            pwInput.classList.add('shake');
            setTimeout(() => pwInput.classList.remove('shake'), 500);
        }
    });
}

function showApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
}

function logout() {
    sessionStorage.removeItem('qrzfood_auth');
    document.getElementById('appWrapper').classList.add('hidden');
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('hidden');
}

// ============================================================
// THEME
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('qrzfood_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
    document.getElementById('themeToggle').addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark');
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qrzfood_theme', theme);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
}

// ============================================================
// STATE
// ============================================================
let rawData = [];
let processedData = [];
let clientGroups = {};
let currentSort = { key: 'cliente', dir: 'asc' };
let currentCardSort = 'debt-desc';
let activePreset = 'all';
let chartInstances = {};

// --- PAYMENT TRACKING (localStorage) ---
const PAYMENTS_KEY = 'qrzfood_payments_divinopao';

function getPayments() {
    try { return JSON.parse(localStorage.getItem(PAYMENTS_KEY)) || {}; } catch { return {}; }
}
function savePayments(payments) {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}
function getItemPayment(itemId) {
    return getPayments()[itemId] || { paid: 0, notes: [] };
}
function setItemPayment(itemId, amount, note) {
    const payments = getPayments();
    if (!payments[itemId]) payments[itemId] = { paid: 0, notes: [] };
    payments[itemId].paid = Math.max(0, amount);
    if (note) payments[itemId].notes.push({ text: note, date: new Date().toISOString() });
    savePayments(payments);
}
function clearPaymentsForClient(clientName) {
    const payments = getPayments();
    processedData.forEach(item => {
        if (item.cliente === clientName) delete payments[item.id];
    });
    savePayments(payments);
}
function getItemRemaining(item) {
    const payment = getItemPayment(item.id);
    return Math.max(0, item.saldo - payment.paid);
}
function getItemStatus(item) {
    const remaining = getItemRemaining(item);
    if (remaining <= 0) return 'paid';
    const payment = getItemPayment(item.id);
    if (payment.paid > 0) return 'partial';
    return 'pending';
}
function getTotalPaid() {
    const payments = getPayments();
    let total = 0;
    for (const id in payments) total += payments[id].paid || 0;
    return total;
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
    try {
        if (window.location.protocol !== 'file:') {
            const resp = await fetch('dados_fiado.json');
            rawData = await resp.json();
        } else if (typeof EMBEDDED_DATA !== 'undefined') {
            rawData = EMBEDDED_DATA;
        }
    } catch {
        if (typeof EMBEDDED_DATA !== 'undefined') rawData = EMBEDDED_DATA;
        else rawData = [];
    }
    if ((!rawData || !rawData.length) && typeof EMBEDDED_DATA !== 'undefined') rawData = EMBEDDED_DATA;

    processedData = rawData.map((row, idx) => ({
        id: idx,
        clienteOriginal: (row.banco || '').trim(),
        cliente: normalizeClientName(row.banco),
        produto: (row.fatura || row.portador || '').trim(),
        codigo: (row.historico || '').trim(),
        valor: parseDecimal(row.valor),
        saldo: parseDecimal(row.saldoatual),
        dataEmissao: row.dataemi || '',
        usuario: (row.usuarioatual || '').trim(),
        parcela: (row.parcela || '').trim(),
        indice: (row.indice || '').trim(),
    }));

    buildClientGroups(processedData);
    populateFilters();
    applyFilters();
}

function buildClientGroups(data) {
    clientGroups = {};
    data.forEach(item => {
        if (!clientGroups[item.cliente]) clientGroups[item.cliente] = [];
        clientGroups[item.cliente].push(item);
    });
}

// ============================================================
// FILTERS — INSTANT APPLICATION
// ============================================================
function populateFilters() {
    const cs = document.getElementById('filterCliente');
    const ps = document.getElementById('filterProduto');
    const us = document.getElementById('filterUsuario');
    [...new Set(processedData.map(d => d.cliente))].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(c => {
        cs.appendChild(Object.assign(document.createElement('option'), { value: c, textContent: c }));
    });
    [...new Set(processedData.map(d => d.produto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(p => {
        ps.appendChild(Object.assign(document.createElement('option'), { value: p, textContent: p }));
    });
    [...new Set(processedData.map(d => d.usuario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(u => {
        us.appendChild(Object.assign(document.createElement('option'), { value: u, textContent: u }));
    });
}

function getFilteredData() {
    const cliente = document.getElementById('filterCliente').value;
    const produto = document.getElementById('filterProduto').value;
    const usuario = document.getElementById('filterUsuario').value;
    const dataDe = document.getElementById('filterDataDe').value;
    const dataAte = document.getElementById('filterDataAte').value;
    const valorMin = document.getElementById('filterValorMin').value;
    const valorMax = document.getElementById('filterValorMax').value;
    const search = document.getElementById('searchGlobal').value.toLowerCase().trim();

    let result = processedData.filter(item => {
        if (cliente && item.cliente !== cliente) return false;
        if (produto && item.produto !== produto) return false;
        if (usuario && item.usuario.toLowerCase() !== usuario.toLowerCase()) return false;
        if (dataDe) { const d = toDateObj(item.dataEmissao); if (!d || d < new Date(dataDe + 'T00:00:00')) return false; }
        if (dataAte) { const d = toDateObj(item.dataEmissao); if (!d || d > new Date(dataAte + 'T23:59:59')) return false; }
        if (valorMin !== '' && item.saldo < parseFloat(valorMin)) return false;
        if (valorMax !== '' && item.saldo > parseFloat(valorMax)) return false;

        // Preset filters
        if (activePreset === 'pending' && getItemStatus(item) !== 'pending') return false;
        if (activePreset === 'partial' && getItemStatus(item) !== 'partial') return false;
        if (activePreset === 'paid' && getItemStatus(item) !== 'paid') return false;
        if (activePreset === 'high-value' && getItemRemaining(item) < 50) return false;

        if (search) {
            const h = [item.cliente, item.clienteOriginal, item.produto, item.codigo, item.usuario, formatBRL(item.saldo), formatDate(item.dataEmissao)].join(' ').toLowerCase();
            if (!h.includes(search)) return false;
        }
        return true;
    });

    if (activePreset === 'top-clients') {
        const totals = {};
        result.forEach(d => { totals[d.cliente] = (totals[d.cliente] || 0) + getItemRemaining(d); });
        const top10 = new Set(Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]));
        result = result.filter(d => top10.has(d.cliente));
    }

    return result;
}

function applyFilters() {
    const filtered = getFilteredData();
    buildClientGroups(filtered);
    updateHeaderStats(filtered);
    renderCards();
    renderTable(filtered);
    renderCharts(filtered);
    const badge = document.getElementById('searchCountBadge');
    if (badge) badge.textContent = filtered.length;
    const fc = document.getElementById('footerSyncCount');
    if (fc) fc.textContent = processedData.length;
}

// ============================================================
// HEADER STATS
// ============================================================
function updateHeaderStats(data) {
    const totalRemaining = data.reduce((s, d) => s + getItemRemaining(d), 0);
    const totalPaidFiltered = data.reduce((s, d) => s + Math.min(getItemPayment(d.id).paid, d.saldo), 0);
    const clientes = new Set(data.map(d => d.cliente)).size;
    document.getElementById('totalGeral').textContent = formatBRL(totalRemaining);
    document.getElementById('totalRecebido').textContent = formatBRL(totalPaidFiltered);
    document.getElementById('totalClientes').textContent = clientes;
    document.getElementById('totalRegistros').textContent = data.length;
}

// ============================================================
// CARDS VIEW
// ============================================================
function renderCards() {
    const grid = document.getElementById('cardsGrid');
    const empty = document.getElementById('cardsEmptyState');
    grid.innerHTML = '';
    const names = Object.keys(clientGroups);
    if (!names.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    const sorted = names.sort((a, b) => {
        const ia = clientGroups[a], ib = clientGroups[b];
        const ta = ia.reduce((s, d) => s + getItemRemaining(d), 0);
        const tb = ib.reduce((s, d) => s + getItemRemaining(d), 0);
        switch (currentCardSort) {
            case 'debt-asc': return ta - tb;
            case 'name-asc': return a.localeCompare(b, 'pt-BR');
            case 'items-desc': return ib.length - ia.length;
            default: return tb - ta;
        }
    });

    sorted.forEach(name => {
        const items = clientGroups[name];
        const totalOriginal = items.reduce((s, d) => s + d.saldo, 0);
        const totalRemaining = items.reduce((s, d) => s + getItemRemaining(d), 0);
        const totalPaid = items.reduce((s, d) => s + Math.min(getItemPayment(d.id).paid, d.saldo), 0);
        const products = [...new Set(items.map(d => d.produto).filter(Boolean))];
        const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
        const minDate = dates.length ? new Date(Math.min(...dates)) : null;
        const maxDate = dates.length ? new Date(Math.max(...dates)) : null;

        // Status
        let statusClass = 'tag-pending', statusText = 'Pendente';
        if (totalRemaining <= 0) { statusClass = 'tag-paid'; statusText = 'Pago'; }
        else if (totalPaid > 0) { statusClass = 'tag-partial'; statusText = 'Parcial'; }

        const card = document.createElement('div');
        card.className = 'client-card' + (totalRemaining <= 0 ? ' card-paid' : '');
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3 class="card-client-title">${escapeHTML(name)}</h3>
                    <span class="card-status-tag ${statusClass}">${statusText}</span>
                </div>
                <div class="card-total-badge">${formatBRL(totalRemaining)}</div>
            </div>
            <div class="card-metrics-row">
                <div class="card-metric"><span class="card-metric-label">Itens</span><span class="card-metric-value">${items.length}</span></div>
                <div class="card-metric"><span class="card-metric-label">Total Original</span><span class="card-metric-value">${formatBRL(totalOriginal)}</span></div>
                <div class="card-metric"><span class="card-metric-label">Já Pago</span><span class="card-metric-value text-green">${formatBRL(totalPaid)}</span></div>
            </div>
            <div class="card-products-preview">
                <div class="card-products-preview-title">Itens</div>
                <div class="product-badges">
                    ${products.slice(0, 4).map(p => `<span class="product-pill">${escapeHTML(p)}</span>`).join('')}
                    ${products.length > 4 ? `<span class="product-pill pill-more">+${products.length - 4}</span>` : ''}
                </div>
            </div>
            <div class="card-bottom">
                <span>${minDate ? formatDate(minDate.toISOString()) : '—'} → ${maxDate ? formatDate(maxDate.toISOString()) : '—'}</span>
                <span class="card-action-hint">Ver Extrato <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg></span>
            </div>`;
        card.addEventListener('click', () => openModal(name));
        grid.appendChild(card);
    });
}

// ============================================================
// TABLE VIEW
// ============================================================
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    const sorted = [...data].sort((a, b) => {
        let va, vb;
        switch (currentSort.key) {
            case 'cliente': va = a.cliente; vb = b.cliente; break;
            case 'produto': va = a.produto; vb = b.produto; break;
            case 'valor': va = a.valor; vb = b.valor; break;
            case 'saldo': va = getItemRemaining(a); vb = getItemRemaining(b); break;
            case 'data': va = a.dataEmissao; vb = b.dataEmissao; break;
            default: return 0;
        }
        if (typeof va === 'string') { const c = va.localeCompare(vb, 'pt-BR'); return currentSort.dir === 'asc' ? c : -c; }
        return currentSort.dir === 'asc' ? va - vb : vb - va;
    });

    sorted.forEach(item => {
        const remaining = getItemRemaining(item);
        const paid = Math.min(getItemPayment(item.id).paid, item.saldo);
        const status = getItemStatus(item);
        const badgeClass = status === 'paid' ? 'badge-paid' : status === 'partial' ? 'badge-partial' : 'badge-pending';
        const badgeText = status === 'paid' ? '✓ Pago' : status === 'partial' ? '◐ Parcial' : '○ Pendente';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.cliente)}</strong></td>
            <td>${escapeHTML(item.produto)}</td>
            <td class="currency-cell">${formatBRL(item.valor)}</td>
            <td class="currency-cell text-accent">${formatBRL(remaining)}</td>
            <td class="currency-cell text-green">${formatBRL(paid)}</td>
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td>${formatDateTime(item.dataEmissao)}</td>
            <td><code>${escapeHTML(item.codigo)}</code></td>
            <td>${escapeHTML(item.usuario)}</td>
            <td>${escapeHTML(item.parcela)}</td>`;
        tbody.appendChild(tr);
    });

    const totalRemaining = data.reduce((s, d) => s + getItemRemaining(d), 0);
    document.getElementById('tableCount').textContent = `${data.length} registros`;
    document.getElementById('tableTotal').textContent = formatBRL(totalRemaining);
}

// ============================================================
// CHARTS
// ============================================================
function renderCharts(data) {
    if (typeof Chart === 'undefined') return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const textColor = isDark ? '#9ca3af' : '#7e8695';
    const defaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor, font: { family: "'Plus Jakarta Sans'" } } } }, scales: {} };

    // --- Daily Evolution ---
    const dailyMap = {};
    data.forEach(d => {
        const dt = toDateObj(d.dataEmissao);
        if (!dt) return;
        const key = dt.toISOString().split('T')[0];
        dailyMap[key] = (dailyMap[key] || 0) + d.saldo;
    });
    const dailyLabels = Object.keys(dailyMap).sort();
    const dailyValues = dailyLabels.map(k => dailyMap[k]);
    // Cumulative
    let cum = 0;
    const cumValues = dailyValues.map(v => { cum += v; return parseFloat(cum.toFixed(2)); });

    if (chartInstances.daily) chartInstances.daily.destroy();
    const ctx1 = document.getElementById('chartDaily');
    if (ctx1) {
        chartInstances.daily = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: dailyLabels.map(d => { const p = d.split('-'); return p[2] + '/' + p[1]; }),
                datasets: [
                    { label: 'Fiado por Dia (R$)', data: dailyValues, borderColor: '#e8590c', backgroundColor: 'rgba(232,89,12,.15)', fill: true, tension: .35, pointRadius: 2 },
                    { label: 'Acumulado (R$)', data: cumValues, borderColor: '#2b8a3e', backgroundColor: 'rgba(43,138,62,.08)', fill: false, tension: .35, pointRadius: 1, borderDash: [4, 3] }
                ]
            },
            options: { ...defaults, scales: { x: { ticks: { color: textColor, maxTicksLimit: 15 }, grid: { color: gridColor } }, y: { ticks: { color: textColor, callback: v => 'R$' + v }, grid: { color: gridColor } } } }
        });
    }

    // --- Top 10 Clients ---
    const clientTotals = {};
    data.forEach(d => { clientTotals[d.cliente] = (clientTotals[d.cliente] || 0) + getItemRemaining(d); });
    const top10 = Object.entries(clientTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (chartInstances.topClients) chartInstances.topClients.destroy();
    const ctx2 = document.getElementById('chartTopClients');
    if (ctx2) {
        chartInstances.topClients = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: top10.map(e => e[0]),
                datasets: [{ label: 'Saldo Restante (R$)', data: top10.map(e => e[1]), backgroundColor: 'rgba(232,89,12,.7)', borderRadius: 6 }]
            },
            options: { ...defaults, indexAxis: 'y', scales: { x: { ticks: { color: textColor, callback: v => 'R$' + v }, grid: { color: gridColor } }, y: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } } }, plugins: { legend: { display: false } } }
        });
    }

    // --- Products Distribution ---
    const prodTotals = {};
    data.forEach(d => { if (d.produto) prodTotals[d.produto] = (prodTotals[d.produto] || 0) + d.saldo; });
    const topProds = Object.entries(prodTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const prodColors = ['#e8590c', '#d9480f', '#f76707', '#ff922b', '#ffa94d', '#ffd8a8', '#2b8a3e', '#d97706'];

    if (chartInstances.products) chartInstances.products.destroy();
    const ctx3 = document.getElementById('chartProducts');
    if (ctx3) {
        chartInstances.products = new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: topProds.map(e => e[0]),
                datasets: [{ data: topProds.map(e => e[1]), backgroundColor: prodColors, borderWidth: 0 }]
            },
            options: { ...defaults, plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 11 }, padding: 10 } } } }
        });
    }
}

// ============================================================
// MODAL — CLIENT DETAILS & PAYMENT MANAGEMENT
// ============================================================
let currentModalClient = '';
let selectedItems = new Set();

function openModal(clientName) {
    currentModalClient = clientName;
    selectedItems.clear();
    const items = clientGroups[clientName] || [];
    const totalOriginal = items.reduce((s, d) => s + d.saldo, 0);
    const totalRemaining = items.reduce((s, d) => s + getItemRemaining(d), 0);
    const totalPaid = items.reduce((s, d) => s + Math.min(getItemPayment(d.id).paid, d.saldo), 0);
    const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
    const minDate = dates.length ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length ? new Date(Math.max(...dates)) : null;
    const uniqueProducts = [...new Set(items.map(d => d.produto).filter(Boolean))];

    document.getElementById('modalClientName').textContent = clientName;
    document.getElementById('modalClientSummary').textContent = `${items.length} lançamentos • ${uniqueProducts.length} itens distintos • Divino Pão`;

    document.getElementById('modalStats').innerHTML = `
        <div class="modal-kpi-card"><span class="modal-kpi-label">Saldo Restante</span><span class="modal-kpi-value accent">${formatBRL(totalRemaining)}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Total Original</span><span class="modal-kpi-value">${formatBRL(totalOriginal)}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Já Recebido</span><span class="modal-kpi-value green">${formatBRL(totalPaid)}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Qtd. Itens</span><span class="modal-kpi-value">${items.length}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Primeiro Fiado</span><span class="modal-kpi-value">${minDate ? formatDate(minDate.toISOString()) : '—'}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Último Fiado</span><span class="modal-kpi-value">${maxDate ? formatDate(maxDate.toISOString()) : '—'}</span></div>`;

    renderModalTable(items);
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function renderModalTable(items) {
    const tbody = document.getElementById('modalTableBody');
    tbody.innerHTML = '';
    const sorted = [...items].sort((a, b) => {
        const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao);
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db;
    });

    sorted.forEach(item => {
        const remaining = getItemRemaining(item);
        const paid = Math.min(getItemPayment(item.id).paid, item.saldo);
        const status = getItemStatus(item);
        const badgeClass = status === 'paid' ? 'badge-paid' : status === 'partial' ? 'badge-partial' : 'badge-pending';
        const badgeText = status === 'paid' ? '✓ Pago' : status === 'partial' ? '◐ Parcial' : '○ Pendente';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="item-check" data-id="${item.id}" ${selectedItems.has(item.id) ? 'checked' : ''}></td>
            <td><strong>${escapeHTML(item.produto)}</strong></td>
            <td>${formatBRL(item.saldo)}</td>
            <td class="text-green">${formatBRL(paid)}</td>
            <td class="currency-cell text-accent">${formatBRL(remaining)}</td>
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td>${formatDateTime(item.dataEmissao)}</td>
            <td>${escapeHTML(item.usuario)}</td>
            <td>${status !== 'paid' ? `<button class="btn btn-success btn-sm btn-item-pay" data-id="${item.id}" data-saldo="${item.saldo}">Baixa</button>` : '<span class="text-muted">—</span>'}</td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('modalItemsCount').textContent = `${sorted.length} compras`;

    // Checkbox listeners
    tbody.querySelectorAll('.item-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) selectedItems.add(id); else selectedItems.delete(id);
        });
    });

    // Individual pay buttons
    tbody.querySelectorAll('.btn-item-pay').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const saldo = parseFloat(btn.dataset.saldo);
            setItemPayment(id, saldo, 'Baixa individual');
            refreshModal();
            showToast('Baixa registrada!');
        });
    });

    // Select all
    const selectAll = document.getElementById('selectAllItems');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onchange = () => {
            const checks = tbody.querySelectorAll('.item-check');
            checks.forEach(cb => {
                cb.checked = selectAll.checked;
                const id = parseInt(cb.dataset.id);
                if (selectAll.checked) selectedItems.add(id); else selectedItems.delete(id);
            });
        };
    }
}

function refreshModal() {
    // Rebuild modal content and refresh global state
    const items = clientGroups[currentModalClient] || [];
    openModal(currentModalClient);
    applyFilters();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================================
// BAIXA PARCIAL MODAL
// ============================================================
let baixaParcialContext = { mode: 'client', itemId: null };

function openBaixaParcial(mode, itemId) {
    baixaParcialContext = { mode, itemId };
    const subtitle = document.getElementById('baixaParcialSubtitle');
    if (mode === 'selected') {
        subtitle.textContent = `Registrar valor recebido para ${selectedItems.size} item(ns) selecionado(s)`;
    } else {
        subtitle.textContent = `Informe o valor total recebido do cliente ${currentModalClient}`;
    }
    document.getElementById('baixaValorInput').value = '';
    document.getElementById('baixaNotaInput').value = '';
    document.getElementById('baixaParcialOverlay').classList.remove('hidden');
}

function closeBaixaParcial() {
    document.getElementById('baixaParcialOverlay').classList.add('hidden');
}

function confirmarBaixa() {
    const valor = parseFloat(document.getElementById('baixaValorInput').value);
    const nota = document.getElementById('baixaNotaInput').value.trim();
    if (!valor || valor <= 0) { showToast('Informe um valor válido!'); return; }

    if (baixaParcialContext.mode === 'selected' && selectedItems.size > 0) {
        // Distribute payment across selected items proportionally
        let remaining = valor;
        const ids = [...selectedItems];
        for (const id of ids) {
            const item = processedData[id];
            if (!item) continue;
            const itemRemaining = getItemRemaining(item);
            if (itemRemaining <= 0) continue;
            const payThis = Math.min(remaining, itemRemaining);
            const current = getItemPayment(id).paid;
            setItemPayment(id, current + payThis, nota || `Baixa parcial de ${formatBRL(valor)}`);
            remaining -= payThis;
            if (remaining <= 0) break;
        }
    } else {
        // Client-level: distribute across all pending items oldest first
        let remaining = valor;
        const items = (clientGroups[currentModalClient] || []).sort((a, b) => {
            const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao);
            if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db;
        });
        for (const item of items) {
            const itemRemaining = getItemRemaining(item);
            if (itemRemaining <= 0) continue;
            const payThis = Math.min(remaining, itemRemaining);
            const current = getItemPayment(item.id).paid;
            setItemPayment(item.id, current + payThis, nota || `Baixa parcial de ${formatBRL(valor)}`);
            remaining -= payThis;
            if (remaining <= 0) break;
        }
    }

    closeBaixaParcial();
    refreshModal();
    showToast(`Baixa de ${formatBRL(valor)} registrada com sucesso!`);
}

// ============================================================
// BILLING & EXPORT
// ============================================================
function generateBillingMessage(clientName) {
    const items = clientGroups[clientName] || [];
    const totalRemaining = items.reduce((s, d) => s + getItemRemaining(d), 0);
    const pendingItems = items.filter(d => getItemRemaining(d) > 0).sort((a, b) => {
        const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao);
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db;
    });

    let text = `🥖 *PADARIA DIVINO PÃO — EXTRATO DE FIADO*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Olá, *${clientName}*! Tudo bem?\nSegue o demonstrativo dos seus lançamentos em aberto:\n\n📋 *ITENS PENDENTES:*\n`;
    pendingItems.forEach(item => {
        text += `▪️ ${item.produto}\n   ↳ ${formatBRL(getItemRemaining(item))} (${formatDate(item.dataEmissao)})\n`;
    });
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *TOTAL A RECEBER: ${formatBRL(totalRemaining)}*\n📦 *${pendingItems.length} item(ns) pendente(s)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Qualquer dúvida, estamos à disposição!\n*Padaria Divino Pão* agradece! 🙏🥐`;
    return text;
}

function copyBillingText() {
    const text = generateBillingMessage(currentModalClient);
    navigator.clipboard.writeText(text).then(() => showToast('Mensagem WhatsApp copiada!')).catch(() => {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showToast('Mensagem WhatsApp copiada!');
    });
}

function exportClientCSV() {
    const items = clientGroups[currentModalClient] || [];
    const total = items.reduce((s, d) => s + getItemRemaining(d), 0);
    let csv = '\uFEFF';
    csv += 'Padaria Divino Pão - Extrato (QRZ Food)\n';
    csv += `Cliente;${currentModalClient}\n\n`;
    csv += 'Produto;Valor Original;Pago;Restante;Status;Data;Operador\n';
    items.forEach(item => {
        const rem = getItemRemaining(item);
        const paid = Math.min(getItemPayment(item.id).paid, item.saldo);
        const st = getItemStatus(item) === 'paid' ? 'PAGO' : getItemStatus(item) === 'partial' ? 'PARCIAL' : 'PENDENTE';
        csv += `"${item.produto}";${formatBRL(item.saldo)};${formatBRL(paid)};${formatBRL(rem)};${st};${formatDateTime(item.dataEmissao)};"${item.usuario}"\n`;
    });
    csv += `\n;;TOTAL RESTANTE:;${formatBRL(total)};;;\n`;
    downloadCSV(csv, `divino_pao_${currentModalClient.replace(/\s+/g, '_').toLowerCase()}.csv`);
    showToast('CSV exportado!');
}

function exportGeneralCSV() {
    const filtered = getFilteredData();
    let csv = '\uFEFF';
    csv += 'Padaria Divino Pão - Relatório Geral (QRZ Food)\n\n';
    csv += 'Cliente;Produto;Valor;Pago;Restante;Status;Data;Operador\n';
    filtered.forEach(item => {
        const rem = getItemRemaining(item);
        const paid = Math.min(getItemPayment(item.id).paid, item.saldo);
        const st = getItemStatus(item) === 'paid' ? 'PAGO' : getItemStatus(item) === 'partial' ? 'PARCIAL' : 'PENDENTE';
        csv += `"${item.cliente}";"${item.produto}";${formatBRL(item.saldo)};${formatBRL(paid)};${formatBRL(rem)};${st};${formatDateTime(item.dataEmissao)};"${item.usuario}"\n`;
    });
    const total = filtered.reduce((s, d) => s + getItemRemaining(d), 0);
    csv += `\n;TOTAL RESTANTE:;;${formatBRL(total)};;\n`;
    downloadCSV(csv, 'divino_pao_relatorio_geral.csv');
    showToast('Relatório exportado!');
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLogin();
    loadData();

    // --- INSTANT FILTERS (no button needed) ---
    const filterIds = ['filterCliente', 'filterProduto', 'filterUsuario', 'filterDataDe', 'filterDataAte', 'filterValorMin', 'filterValorMax'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', applyFilters);
    });

    // Clear filters
    document.getElementById('btnLimpar').addEventListener('click', () => {
        filterIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('searchGlobal').value = '';
        activePreset = 'all';
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.preset-chip[data-preset="all"]').classList.add('active');
        applyFilters();
    });

    // Presets
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activePreset = chip.dataset.preset;
            applyFilters();
        });
    });

    // Live search
    let sTimer;
    document.getElementById('searchGlobal').addEventListener('input', () => {
        clearTimeout(sTimer); sTimer = setTimeout(applyFilters, 150);
    });

    // Card sort
    document.getElementById('cardSortSelect').addEventListener('change', e => {
        currentCardSort = e.target.value;
        renderCards();
    });

    // View toggle (Cards / Table / Chart)
    const views = { viewCards: 'cardsView', viewTable: 'tableView', viewChart: 'chartView' };
    Object.entries(views).forEach(([btnId, sectionId]) => {
        document.getElementById(btnId).addEventListener('click', () => {
            document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(btnId).classList.add('active');
            Object.values(views).forEach(v => document.getElementById(v).classList.add('hidden'));
            document.getElementById(sectionId).classList.remove('hidden');
            if (sectionId === 'chartView') renderCharts(getFilteredData());
        });
    });

    // Table sorting
    document.querySelectorAll('#dataTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (currentSort.key === key) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            else { currentSort.key = key; currentSort.dir = 'asc'; }
            renderTable(getFilteredData());
        });
    });

    // Modal controls
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('btnFecharModal').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeBaixaParcial(); closeModal(); } });

    // Baixa Total (selected or all)
    document.getElementById('btnBaixaTotal').addEventListener('click', () => {
        const items = clientGroups[currentModalClient] || [];
        const targets = selectedItems.size > 0 ? items.filter(d => selectedItems.has(d.id)) : items;
        targets.forEach(item => setItemPayment(item.id, item.saldo, 'Baixa total'));
        refreshModal();
        showToast(`Baixa total de ${targets.length} item(ns) registrada!`);
    });

    // Baixa Parcial
    document.getElementById('btnBaixaParcial').addEventListener('click', () => {
        openBaixaParcial(selectedItems.size > 0 ? 'selected' : 'client');
    });

    // Desfazer Baixas
    document.getElementById('btnDesfazerBaixas').addEventListener('click', () => {
        if (confirm(`Deseja desfazer todas as baixas do cliente ${currentModalClient}?`)) {
            clearPaymentsForClient(currentModalClient);
            refreshModal();
            showToast('Baixas desfeitas!');
        }
    });

    // Baixa Parcial Modal
    document.getElementById('btnConfirmarBaixa').addEventListener('click', confirmarBaixa);
    document.getElementById('btnCancelarBaixa').addEventListener('click', closeBaixaParcial);
    document.getElementById('baixaParcialClose').addEventListener('click', closeBaixaParcial);
    document.getElementById('baixaParcialOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeBaixaParcial(); });

    // Export & billing
    document.getElementById('btnCopiarCobranca').addEventListener('click', copyBillingText);
    document.getElementById('btnExportarCliente').addEventListener('click', exportClientCSV);
    document.getElementById('btnExportarGeral').addEventListener('click', exportGeneralCSV);

    // Logout
    document.getElementById('btnLogout').addEventListener('click', logout);

    // Re-render charts on theme change
    document.getElementById('themeToggle').addEventListener('click', () => {
        setTimeout(() => renderCharts(getFilteredData()), 300);
    });
});
