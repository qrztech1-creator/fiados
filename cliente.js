// ============================================================
// QRZ FOOD — CLIENT VIEW (cliente.js)
// Dashboard completo por cliente com baixas, gráficos e filtros
// ============================================================

let clientConfig = null;
let clientNameMap = {};
let rawData = [], processedData = [], clientGroups = {};
let currentSort = { key: 'cliente', dir: 'asc' };
let currentCardSort = 'debt-desc';
let activePreset = 'all';
let chartInstances = {};
let currentModalClient = '';
let selectedItems = new Set();

// ============================================================
// IDENTIFY CLIENT FROM URL
// ============================================================
function getClientIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('c') || params.get('client') || '';
}

// ============================================================
// LOGIN (password only)
// ============================================================
function initClientLogin() {
    const clientId = getClientIdFromURL();
    clientConfig = CLIENTS_CONFIG.find(c => c.id === clientId);

    if (!clientConfig) {
        document.getElementById('loginSubtitle').textContent = 'Cliente não encontrado. Verifique o link.';
        document.getElementById('loginForm').classList.add('hidden');
        return;
    }

    document.getElementById('loginTitle').textContent = clientConfig.shortName;
    document.getElementById('loginSubtitle').textContent = `${clientConfig.name} — Acesso Restrito`;
    document.title = `QRZ Food — ${clientConfig.shortName}`;

    // Already authed?
    if (sessionStorage.getItem('qrzfood_client_' + clientId) === 'ok') { showClientApp(); return; }

    const form = document.getElementById('loginForm');
    const pwInput = document.getElementById('loginPassword');
    const togglePw = document.getElementById('togglePw');
    togglePw.addEventListener('click', () => { pwInput.type = pwInput.type === 'password' ? 'text' : 'password'; });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hash = await sha256(pwInput.value);
        if (hash === clientConfig.passwordHash) {
            sessionStorage.setItem('qrzfood_client_' + clientId, 'ok');
            showClientApp();
        } else {
            document.getElementById('loginError').classList.remove('hidden');
            pwInput.value = ''; pwInput.focus();
        }
    });
}

function showClientApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    document.getElementById('headerBadge').textContent = clientConfig.shortName;
    document.getElementById('footerClientName').innerHTML = `Módulo de Cobrança — <strong>${clientConfig.name}</strong>`;
    if (document.getElementById('modalShopName')) document.getElementById('modalShopName').textContent = clientConfig.shortName;
    clientNameMap = CLIENT_NAME_MAPS[clientConfig.id] || {};
    loadClientData();
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadClientData() {
    // Load the data file dynamically
    try {
        const script = document.createElement('script');
        script.src = clientConfig.dataFile;
        script.onload = () => { initData(); };
        script.onerror = () => {
            console.error('Could not load data file:', clientConfig.dataFile);
            showToast('Erro ao carregar dados. Arquivo não encontrado.');
        };
        document.head.appendChild(script);
    } catch (e) {
        console.error(e);
    }
}

function normalizeClientName(raw) {
    if (!raw || !raw.trim()) return 'SEM NOME';
    return clientNameMap[raw.trim().toLowerCase()] || raw.trim().toUpperCase();
}

function initData() {
    if (typeof EMBEDDED_DATA === 'undefined') { showToast('Dados não encontrados.'); return; }
    rawData = EMBEDDED_DATA;
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
    document.getElementById('footerSyncCount').textContent = processedData.length;
}

function buildClientGroups(data) {
    clientGroups = {};
    data.forEach(item => { if (!clientGroups[item.cliente]) clientGroups[item.cliente] = []; clientGroups[item.cliente].push(item); });
}

// ============================================================
// PAYMENTS (localStorage per client)
// ============================================================
function paymentsKey() { return 'qrzfood_payments_' + (clientConfig ? clientConfig.id : 'unknown'); }
function getPayments() { try { return JSON.parse(localStorage.getItem(paymentsKey())) || {}; } catch { return {}; } }
function savePayments(p) { localStorage.setItem(paymentsKey(), JSON.stringify(p)); }
function getItemPayment(id) { return getPayments()[id] || { paid: 0 }; }
function setItemPayment(id, amount, note) {
    const p = getPayments(); if (!p[id]) p[id] = { paid: 0, notes: [] };
    p[id].paid = Math.max(0, amount);
    if (note) { if (!p[id].notes) p[id].notes = []; p[id].notes.push({ text: note, date: new Date().toISOString() }); }
    savePayments(p);
}
function clearPaymentsForClient(clientName) {
    const p = getPayments();
    processedData.forEach(item => { if (item.cliente === clientName) delete p[item.id]; });
    savePayments(p);
}
function getItemRemaining(item) { return Math.max(0, item.saldo - (getItemPayment(item.id).paid || 0)); }
function getItemStatus(item) {
    const rem = getItemRemaining(item);
    if (rem <= 0) return 'paid';
    if ((getItemPayment(item.id).paid || 0) > 0) return 'partial';
    return 'pending';
}

// ============================================================
// FILTERS (instant)
// ============================================================
function populateFilters() {
    const addOpts = (sel, vals) => vals.forEach(v => sel.appendChild(Object.assign(document.createElement('option'), { value: v, textContent: v })));
    addOpts(document.getElementById('filterCliente'), [...new Set(processedData.map(d => d.cliente))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    addOpts(document.getElementById('filterProduto'), [...new Set(processedData.map(d => d.produto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    addOpts(document.getElementById('filterUsuario'), [...new Set(processedData.map(d => d.usuario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
}

function getFilteredData() {
    const gv = id => document.getElementById(id).value;
    const cliente = gv('filterCliente'), produto = gv('filterProduto'), usuario = gv('filterUsuario');
    const dataDe = gv('filterDataDe'), dataAte = gv('filterDataAte'), valorMin = gv('filterValorMin'), valorMax = gv('filterValorMax');
    const search = document.getElementById('searchGlobal').value.toLowerCase().trim();

    let result = processedData.filter(item => {
        if (cliente && item.cliente !== cliente) return false;
        if (produto && item.produto !== produto) return false;
        if (usuario && item.usuario.toLowerCase() !== usuario.toLowerCase()) return false;
        if (dataDe) { const d = toDateObj(item.dataEmissao); if (!d || d < new Date(dataDe + 'T00:00:00')) return false; }
        if (dataAte) { const d = toDateObj(item.dataEmissao); if (!d || d > new Date(dataAte + 'T23:59:59')) return false; }
        if (valorMin !== '' && item.saldo < parseFloat(valorMin)) return false;
        if (valorMax !== '' && item.saldo > parseFloat(valorMax)) return false;
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
        const t = {}; result.forEach(d => { t[d.cliente] = (t[d.cliente] || 0) + getItemRemaining(d); });
        const top = new Set(Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]));
        result = result.filter(d => top.has(d.cliente));
    }
    return result;
}

function applyFilters() {
    const f = getFilteredData();
    buildClientGroups(f);
    updateHeaderStats(f);
    renderCards();
    renderTable(f);
    if (!document.getElementById('chartView').classList.contains('hidden')) renderCharts(f);
    document.getElementById('searchCountBadge').textContent = f.length;
}

function updateHeaderStats(data) {
    document.getElementById('totalGeral').textContent = formatBRL(data.reduce((s, d) => s + getItemRemaining(d), 0));
    document.getElementById('totalRecebido').textContent = formatBRL(data.reduce((s, d) => s + Math.min(getItemPayment(d.id).paid || 0, d.saldo), 0));
    document.getElementById('totalClientes').textContent = new Set(data.map(d => d.cliente)).size;
    document.getElementById('totalRegistros').textContent = data.length;
}

// ============================================================
// CARDS
// ============================================================
function renderCards() {
    const grid = document.getElementById('cardsGrid'), empty = document.getElementById('cardsEmptyState');
    grid.innerHTML = '';
    const names = Object.keys(clientGroups);
    if (!names.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    names.sort((a, b) => {
        const ta = clientGroups[a].reduce((s, d) => s + getItemRemaining(d), 0), tb = clientGroups[b].reduce((s, d) => s + getItemRemaining(d), 0);
        switch (currentCardSort) { case 'debt-asc': return ta - tb; case 'name-asc': return a.localeCompare(b, 'pt-BR'); case 'items-desc': return clientGroups[b].length - clientGroups[a].length; default: return tb - ta; }
    }).forEach(name => {
        const items = clientGroups[name];
        const totalOrig = items.reduce((s, d) => s + d.saldo, 0), totalRem = items.reduce((s, d) => s + getItemRemaining(d), 0), totalPaid = items.reduce((s, d) => s + Math.min(getItemPayment(d.id).paid || 0, d.saldo), 0);
        const products = [...new Set(items.map(d => d.produto).filter(Boolean))];
        const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
        const minD = dates.length ? new Date(Math.min(...dates)) : null, maxD = dates.length ? new Date(Math.max(...dates)) : null;
        let sc = 'tag-pending', st = 'Pendente'; if (totalRem <= 0) { sc = 'tag-paid'; st = 'Pago'; } else if (totalPaid > 0) { sc = 'tag-partial'; st = 'Parcial'; }
        const c = document.createElement('div'); c.className = 'client-card' + (totalRem <= 0 ? ' card-paid' : '');
        c.innerHTML = `<div class="card-top"><div><h3 class="card-client-title">${escapeHTML(name)}</h3><span class="card-status-tag ${sc}">${st}</span></div><div class="card-total-badge">${formatBRL(totalRem)}</div></div>
            <div class="card-metrics-row"><div class="card-metric"><span class="card-metric-label">Itens</span><span class="card-metric-value">${items.length}</span></div><div class="card-metric"><span class="card-metric-label">Original</span><span class="card-metric-value">${formatBRL(totalOrig)}</span></div><div class="card-metric"><span class="card-metric-label">Pago</span><span class="card-metric-value text-green">${formatBRL(totalPaid)}</span></div></div>
            <div class="card-products-preview"><div class="card-products-preview-title">Itens</div><div class="product-badges">${products.slice(0, 4).map(p => `<span class="product-pill">${escapeHTML(p)}</span>`).join('')}${products.length > 4 ? `<span class="product-pill pill-more">+${products.length - 4}</span>` : ''}</div></div>
            <div class="card-bottom"><span>${minD ? formatDate(minD.toISOString()) : '—'} → ${maxD ? formatDate(maxD.toISOString()) : '—'}</span><span class="card-action-hint">Ver Extrato →</span></div>`;
        c.addEventListener('click', () => openModal(name)); grid.appendChild(c);
    });
}

// ============================================================
// TABLE
// ============================================================
function renderTable(data) {
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = '';
    [...data].sort((a, b) => { let va, vb; switch (currentSort.key) { case 'cliente': va = a.cliente; vb = b.cliente; break; case 'produto': va = a.produto; vb = b.produto; break; case 'valor': va = a.valor; vb = b.valor; break; case 'saldo': va = getItemRemaining(a); vb = getItemRemaining(b); break; case 'data': va = a.dataEmissao; vb = b.dataEmissao; break; default: return 0; } if (typeof va === 'string') { const c = va.localeCompare(vb, 'pt-BR'); return currentSort.dir === 'asc' ? c : -c; } return currentSort.dir === 'asc' ? va - vb : vb - va; }).forEach(item => {
        const rem = getItemRemaining(item), paid = Math.min(getItemPayment(item.id).paid || 0, item.saldo), status = getItemStatus(item);
        const bc = status === 'paid' ? 'badge-paid' : status === 'partial' ? 'badge-partial' : 'badge-pending';
        const bt = status === 'paid' ? '✓ Pago' : status === 'partial' ? '◐ Parcial' : '○ Pendente';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${escapeHTML(item.cliente)}</strong></td><td>${escapeHTML(item.produto)}</td><td class="currency-cell">${formatBRL(item.valor)}</td><td class="currency-cell text-accent">${formatBRL(rem)}</td><td class="text-green">${formatBRL(paid)}</td><td><span class="status-badge ${bc}">${bt}</span></td><td>${formatDateTime(item.dataEmissao)}</td><td>${escapeHTML(item.usuario)}</td><td>${escapeHTML(item.parcela)}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('tableCount').textContent = data.length + ' registros';
    document.getElementById('tableTotal').textContent = formatBRL(data.reduce((s, d) => s + getItemRemaining(d), 0));
}

// ============================================================
// CHARTS
// ============================================================
function renderCharts(data) {
    if (typeof Chart === 'undefined') return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gc = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', tc = isDark ? '#9ca3af' : '#7e8695';

    // Daily
    const dm = {}; data.forEach(d => { const dt = toDateObj(d.dataEmissao); if (!dt) return; const k = dt.toISOString().split('T')[0]; dm[k] = (dm[k] || 0) + d.saldo; });
    const dl = Object.keys(dm).sort(), dv = dl.map(k => dm[k]); let cum = 0; const cv = dv.map(v => { cum += v; return +cum.toFixed(2); });
    if (chartInstances.daily) chartInstances.daily.destroy();
    const c1 = document.getElementById('chartDaily');
    if (c1) chartInstances.daily = new Chart(c1, { type: 'line', data: { labels: dl.map(d => d.split('-').slice(1).reverse().join('/')), datasets: [{ label: 'Fiado/Dia', data: dv, borderColor: '#e8590c', backgroundColor: 'rgba(232,89,12,.15)', fill: true, tension: .35, pointRadius: 2 }, { label: 'Acumulado', data: cv, borderColor: '#2b8a3e', fill: false, tension: .35, pointRadius: 1, borderDash: [4, 3] }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: tc, maxTicksLimit: 15 }, grid: { color: gc } }, y: { ticks: { color: tc }, grid: { color: gc } } }, plugins: { legend: { labels: { color: tc } } } } });

    // Top clients
    const ct = {}; data.forEach(d => { ct[d.cliente] = (ct[d.cliente] || 0) + getItemRemaining(d); });
    const t10 = Object.entries(ct).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (chartInstances.top) chartInstances.top.destroy();
    const c2 = document.getElementById('chartTopClients');
    if (c2) chartInstances.top = new Chart(c2, { type: 'bar', data: { labels: t10.map(e => e[0]), datasets: [{ data: t10.map(e => e[1]), backgroundColor: 'rgba(232,89,12,.7)', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { ticks: { color: tc }, grid: { color: gc } }, y: { ticks: { color: tc, font: { size: 11 } }, grid: { display: false } } }, plugins: { legend: { display: false } } } });

    // Products
    const pt = {}; data.forEach(d => { if (d.produto) pt[d.produto] = (pt[d.produto] || 0) + d.saldo; });
    const tp = Object.entries(pt).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const pc = ['#e8590c', '#d9480f', '#f76707', '#ff922b', '#ffa94d', '#ffd8a8', '#2b8a3e', '#d97706'];
    if (chartInstances.prod) chartInstances.prod.destroy();
    const c3 = document.getElementById('chartProducts');
    if (c3) chartInstances.prod = new Chart(c3, { type: 'doughnut', data: { labels: tp.map(e => e[0]), datasets: [{ data: tp.map(e => e[1]), backgroundColor: pc, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tc, font: { size: 11 }, padding: 10 } } } } });
}

// ============================================================
// MODAL
// ============================================================
function openModal(name) {
    currentModalClient = name; selectedItems.clear();
    const items = clientGroups[name] || [];
    const tO = items.reduce((s, d) => s + d.saldo, 0), tR = items.reduce((s, d) => s + getItemRemaining(d), 0), tP = items.reduce((s, d) => s + Math.min(getItemPayment(d.id).paid || 0, d.saldo), 0);
    const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
    const minD = dates.length ? new Date(Math.min(...dates)) : null, maxD = dates.length ? new Date(Math.max(...dates)) : null;
    document.getElementById('modalClientName').textContent = name;
    document.getElementById('modalClientSummary').textContent = `${items.length} lançamentos • ${clientConfig.shortName}`;
    document.getElementById('modalStats').innerHTML = `
        <div class="modal-kpi-card"><span class="modal-kpi-label">Saldo Restante</span><span class="modal-kpi-value accent">${formatBRL(tR)}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Total Original</span><span class="modal-kpi-value">${formatBRL(tO)}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Já Recebido</span><span class="modal-kpi-value green">${formatBRL(tP)}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Itens</span><span class="modal-kpi-value">${items.length}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Primeiro</span><span class="modal-kpi-value">${minD ? formatDate(minD.toISOString()) : '—'}</span></div>
        <div class="modal-kpi-card"><span class="modal-kpi-label">Último</span><span class="modal-kpi-value">${maxD ? formatDate(maxD.toISOString()) : '—'}</span></div>`;
    renderModalTable(items);
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function renderModalTable(items) {
    const tbody = document.getElementById('modalTableBody'); tbody.innerHTML = '';
    [...items].sort((a, b) => { const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao); if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db; }).forEach(item => {
        const rem = getItemRemaining(item), paid = Math.min(getItemPayment(item.id).paid || 0, item.saldo), status = getItemStatus(item);
        const bc = status === 'paid' ? 'badge-paid' : status === 'partial' ? 'badge-partial' : 'badge-pending';
        const bt = status === 'paid' ? '✓ Pago' : status === 'partial' ? '◐ Parcial' : '○ Pendente';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="item-check" data-id="${item.id}" ${selectedItems.has(item.id) ? 'checked' : ''}></td><td><strong>${escapeHTML(item.produto)}</strong></td><td>${formatBRL(item.saldo)}</td><td class="text-green">${formatBRL(paid)}</td><td class="currency-cell text-accent">${formatBRL(rem)}</td><td><span class="status-badge ${bc}">${bt}</span></td><td>${formatDateTime(item.dataEmissao)}</td><td>${escapeHTML(item.usuario)}</td><td>${status !== 'paid' ? `<button class="btn btn-success btn-sm btn-item-pay" data-id="${item.id}" data-saldo="${item.saldo}">Baixa</button>` : '—'}</td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.item-check').forEach(cb => cb.addEventListener('change', e => { const id = parseInt(e.target.dataset.id); e.target.checked ? selectedItems.add(id) : selectedItems.delete(id); }));
    tbody.querySelectorAll('.btn-item-pay').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); setItemPayment(parseInt(btn.dataset.id), parseFloat(btn.dataset.saldo), 'Baixa individual'); refreshModal(); showToast('Baixa registrada!'); }));
    const sa = document.getElementById('selectAllItems'); if (sa) { sa.checked = false; sa.onchange = () => { tbody.querySelectorAll('.item-check').forEach(cb => { cb.checked = sa.checked; const id = parseInt(cb.dataset.id); sa.checked ? selectedItems.add(id) : selectedItems.delete(id); }); }; }
}

function refreshModal() { openModal(currentModalClient); applyFilters(); }
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); document.body.style.overflow = ''; }

// Baixa parcial
let baixaMode = 'client';
function openBaixaParcial(mode) {
    baixaMode = mode;
    document.getElementById('baixaParcialSubtitle').textContent = mode === 'selected' ? `${selectedItems.size} item(ns) selecionado(s)` : `Cliente: ${currentModalClient}`;
    document.getElementById('baixaValorInput').value = ''; document.getElementById('baixaNotaInput').value = '';
    document.getElementById('baixaParcialOverlay').classList.remove('hidden');
}
function closeBaixaParcial() { document.getElementById('baixaParcialOverlay').classList.add('hidden'); }
function confirmarBaixa() {
    const valor = parseFloat(document.getElementById('baixaValorInput').value);
    const nota = document.getElementById('baixaNotaInput').value.trim();
    if (!valor || valor <= 0) { showToast('Informe um valor válido!'); return; }
    let remaining = valor;
    const targets = baixaMode === 'selected' && selectedItems.size > 0 ? [...selectedItems].map(id => processedData[id]).filter(Boolean) : (clientGroups[currentModalClient] || []).sort((a, b) => { const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao); if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db; });
    for (const item of targets) { const ir = getItemRemaining(item); if (ir <= 0) continue; const pay = Math.min(remaining, ir); setItemPayment(item.id, (getItemPayment(item.id).paid || 0) + pay, nota || `Baixa parcial ${formatBRL(valor)}`); remaining -= pay; if (remaining <= 0) break; }
    closeBaixaParcial(); refreshModal(); showToast(`Baixa de ${formatBRL(valor)} registrada!`);
}

// Billing
function copyBillingText() {
    const items = clientGroups[currentModalClient] || [];
    const pending = items.filter(d => getItemRemaining(d) > 0).sort((a, b) => { const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao); if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db; });
    const total = pending.reduce((s, d) => s + getItemRemaining(d), 0);
    let text = `🥖 *${clientConfig.name.toUpperCase()} — EXTRATO DE FIADO*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nOlá, *${currentModalClient}*! Tudo bem?\nSegue o extrato dos lançamentos em aberto:\n\n📋 *ITENS PENDENTES:*\n`;
    pending.forEach(item => { text += `▪️ ${item.produto}\n   ↳ ${formatBRL(getItemRemaining(item))} (${formatDate(item.dataEmissao)})\n`; });
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *TOTAL: ${formatBRL(total)}*\n📦 *${pending.length} item(ns)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*${clientConfig.name}* agradece! 🙏`;
    navigator.clipboard.writeText(text).then(() => showToast('Mensagem WhatsApp copiada!')).catch(() => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Copiado!'); });
}

// Export
function exportClientCSV() {
    const items = clientGroups[currentModalClient] || [];
    let csv = '\uFEFF' + clientConfig.name + ' - Extrato (QRZ Food)\nCliente;' + currentModalClient + '\n\nProduto;Valor;Pago;Restante;Status;Data;Operador\n';
    items.forEach(item => { const r = getItemRemaining(item), p = Math.min(getItemPayment(item.id).paid || 0, item.saldo), s = getItemStatus(item) === 'paid' ? 'PAGO' : getItemStatus(item) === 'partial' ? 'PARCIAL' : 'PENDENTE'; csv += `"${item.produto}";${formatBRL(item.saldo)};${formatBRL(p)};${formatBRL(r)};${s};${formatDateTime(item.dataEmissao)};"${item.usuario}"\n`; });
    csv += `\n;;TOTAL:;${formatBRL(items.reduce((s, d) => s + getItemRemaining(d), 0))};;;\n`;
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = `${clientConfig.id}_${currentModalClient.replace(/\s+/g, '_').toLowerCase()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); showToast('CSV exportado!');
}
function exportGeneralCSV() {
    const f = getFilteredData(); let csv = '\uFEFF' + clientConfig.name + ' - Relatório (QRZ Food)\n\nCliente;Produto;Valor;Pago;Restante;Status;Data;Operador\n';
    f.forEach(item => { const r = getItemRemaining(item), p = Math.min(getItemPayment(item.id).paid || 0, item.saldo), s = getItemStatus(item) === 'paid' ? 'PAGO' : getItemStatus(item) === 'partial' ? 'PARCIAL' : 'PENDENTE'; csv += `"${item.cliente}";"${item.produto}";${formatBRL(item.saldo)};${formatBRL(p)};${formatBRL(r)};${s};${formatDateTime(item.dataEmissao)};"${item.usuario}"\n`; });
    csv += `\nTOTAL:;;;${formatBRL(f.reduce((s, d) => s + getItemRemaining(d), 0))};;\n`;
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = `${clientConfig.id}_relatorio.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); showToast('Exportado!');
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initClientLogin();
    document.getElementById('themeToggle').addEventListener('click', () => { toggleTheme(); setTimeout(() => { if (!document.getElementById('chartView').classList.contains('hidden')) renderCharts(getFilteredData()); }, 300); });

    // Instant filters
    ['filterCliente', 'filterProduto', 'filterUsuario', 'filterDataDe', 'filterDataAte', 'filterValorMin', 'filterValorMax'].forEach(id => {
        const el = document.getElementById(id); if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', applyFilters);
    });
    document.getElementById('btnLimpar').addEventListener('click', () => {
        ['filterCliente', 'filterProduto', 'filterUsuario', 'filterDataDe', 'filterDataAte', 'filterValorMin', 'filterValorMax'].forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('searchGlobal').value = ''; activePreset = 'all';
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.preset-chip[data-preset="all"]').classList.add('active'); applyFilters();
    });
    document.querySelectorAll('.preset-chip').forEach(chip => chip.addEventListener('click', () => { document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); activePreset = chip.dataset.preset; applyFilters(); }));
    let st; document.getElementById('searchGlobal').addEventListener('input', () => { clearTimeout(st); st = setTimeout(applyFilters, 150); });
    document.getElementById('cardSortSelect').addEventListener('change', e => { currentCardSort = e.target.value; renderCards(); });

    // Views
    const views = { viewCards: 'cardsView', viewTable: 'tableView', viewChart: 'chartView' };
    Object.entries(views).forEach(([btn, sec]) => { document.getElementById(btn).addEventListener('click', () => { document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active')); document.getElementById(btn).classList.add('active'); Object.values(views).forEach(v => document.getElementById(v).classList.add('hidden')); document.getElementById(sec).classList.remove('hidden'); if (sec === 'chartView') renderCharts(getFilteredData()); }); });

    // Table sort
    document.querySelectorAll('#dataTable th.sortable').forEach(th => th.addEventListener('click', () => { const k = th.dataset.sort; if (currentSort.key === k) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc'; else { currentSort.key = k; currentSort.dir = 'asc'; } renderTable(getFilteredData()); }));

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('btnFecharModal').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeBaixaParcial(); closeModal(); } });
    document.getElementById('btnBaixaTotal').addEventListener('click', () => { const items = clientGroups[currentModalClient] || []; (selectedItems.size > 0 ? items.filter(d => selectedItems.has(d.id)) : items).forEach(item => setItemPayment(item.id, item.saldo, 'Baixa total')); refreshModal(); showToast('Baixa total registrada!'); });
    document.getElementById('btnBaixaParcial').addEventListener('click', () => openBaixaParcial(selectedItems.size > 0 ? 'selected' : 'client'));
    document.getElementById('btnDesfazerBaixas').addEventListener('click', () => { if (confirm(`Desfazer todas as baixas de ${currentModalClient}?`)) { clearPaymentsForClient(currentModalClient); refreshModal(); showToast('Baixas desfeitas!'); } });
    document.getElementById('btnConfirmarBaixa').addEventListener('click', confirmarBaixa);
    document.getElementById('btnCancelarBaixa').addEventListener('click', closeBaixaParcial);
    document.getElementById('baixaParcialClose').addEventListener('click', closeBaixaParcial);
    document.getElementById('baixaParcialOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeBaixaParcial(); });
    document.getElementById('btnCopiarCobranca').addEventListener('click', copyBillingText);
    document.getElementById('btnExportarCliente').addEventListener('click', exportClientCSV);
    document.getElementById('btnExportarGeral').addEventListener('click', exportGeneralCSV);

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (clientConfig) sessionStorage.removeItem('qrzfood_client_' + clientConfig.id);
            document.getElementById('appWrapper').classList.add('hidden');
            document.getElementById('loginOverlay').classList.remove('hidden');
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginError').classList.add('hidden');
        });
    }
});
