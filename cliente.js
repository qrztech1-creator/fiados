let clientConfig = null;
let clientNameMap = {};
let rawRecords = [];
let processedData = [];
let clientGroups = {};
let paymentsMap = {};
let paymentsData = [];
let selectedItems = new Set();
let currentModalClient = '';
let currentSort = { key: 'cliente', dir: 'asc' };
let currentCardSort = 'debt-desc';
let activePreset = 'all';
let chartInstances = { daily: null, top: null, prod: null };
let baixaMode = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('c') || urlParams.get('client');
    
    if (!clientId) {
        document.getElementById('loginSubtitle').textContent = 'Link de cliente invalido.';
        return;
    }
    
    try {
        const { data: clientData, error } = await sb.from('clients').select('*').eq('id', clientId).single();
        if (error || !clientData) {
            document.getElementById('loginSubtitle').textContent = 'Cliente nao encontrado.';
            return;
        }
        clientConfig = clientData;
        clientNameMap = clientConfig.name_map || {};
        
        document.getElementById('loginTitle').textContent = clientConfig.short_name || clientConfig.name;
        
        if (clientConfig.color) {
            document.documentElement.style.setProperty('--accent', clientConfig.color);
        }
        
        const sessionKey = 'qrzfood_client_' + clientId;
        if (sessionStorage.getItem(sessionKey) === 'ok') {
            await initApp();
        }
    } catch (e) {
        console.error(e);
        document.getElementById('loginSubtitle').textContent = 'Erro ao carregar dados do cliente.';
    }
    
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = document.getElementById('loginPassword').value;
        if (!pw) return;
        
        const hashed = await sha256(pw);
        if (hashed === clientConfig.password_hash) {
            sessionStorage.setItem('qrzfood_client_' + clientConfig.id, 'ok');
            await initApp();
        } else {
            document.getElementById('loginError').classList.remove('hidden');
        }
    });
    
    document.getElementById('togglePw').addEventListener('click', () => {
        const pwInput = document.getElementById('loginPassword');
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    });
    
    setupEventListeners();
});

async function initApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    
    document.getElementById('headerBadge').textContent = clientConfig.short_name || 'Cliente';
    document.getElementById('footerClientName').textContent = clientConfig.name;
    document.getElementById('modalShopName').textContent = clientConfig.short_name;
    
    await loadClientData();
    await syncLocalStoragePayments();
}

async function loadClientData() {
    try {
        const { data: records, error: recError } = await sb.from('records')
            .select('*')
            .eq('client_id', clientConfig.id)
            .order('data_emissao', { ascending: true })
            .limit(50000);
        if (recError) throw recError;
        rawRecords = records || [];
        
        const { data: payments, error: payError } = await sb.from('payments')
            .select('*')
            .eq('client_id', clientConfig.id)
            .limit(50000);
        if (payError) throw payError;
        paymentsData = payments || [];
        
        paymentsMap = {};
        paymentsData.forEach(p => {
            paymentsMap[p.record_id] = (paymentsMap[p.record_id] || 0) + parseFloat(p.amount);
        });
        
        processedData = rawRecords.map(row => ({
            id: row.id,
            indice: row.indice,
            clienteOriginal: row.banco || '',
            cliente: row.banco_normalized || normalizeClientName(row.banco),
            produto: row.fatura || '',
            codigo: row.historico || '',
            valor: parseFloat(row.valor) || 0,
            saldo: parseFloat(row.saldo_atual) || 0,
            dataEmissao: row.data_emissao || '',
            usuario: row.usuario || '',
            parcela: row.parcela || '',
        }));
        
        buildClientGroups(processedData);
        populateFilters();
        applyFilters();
        document.getElementById('footerSyncCount').textContent = processedData.length;
    } catch (e) {
        showToast('Erro ao carregar dados');
        console.error(e);
    }
}

async function syncLocalStoragePayments() {
    const key = 'qrzfood_payments_' + clientConfig.id;
    const localData = localStorage.getItem(key);
    if (!localData) return;
    
    try {
        const payments = JSON.parse(localData);
        let synced = 0;
        for (const [indice, payment] of Object.entries(payments)) {
            if (!payment.paid || payment.paid <= 0) continue;
            
            const record = processedData.find(r => String(r.indice) === String(indice));
            if (!record) continue;
            
            if (getItemPaid(record) > 0) continue;
            
            await registerPayment(record.id, payment.paid, 'Migrado do localStorage');
            synced++;
        }
        
        if (synced > 0) {
            localStorage.setItem(key + '_migrated', localData);
            localStorage.removeItem(key);
            showToast(`${synced} baixa(s) migrada(s) do navegador!`);
            await loadClientData();
        }
    } catch (e) {
        console.error('Erro na migracao localStorage:', e);
    }
}

function getItemPaid(item) {
    return paymentsMap[item.id] || 0;
}

function getItemRemaining(item) {
    return Math.max(0, item.saldo - getItemPaid(item));
}

function getItemStatus(item) {
    const paid = getItemPaid(item);
    if (paid >= item.saldo) return 'paid';
    if (paid > 0) return 'partial';
    return 'pending';
}

async function registerPayment(recordId, amount, note) {
    const { error } = await sb.from('payments').insert({
        record_id: recordId,
        client_id: clientConfig.id,
        amount: amount,
        note: note || '',
        created_by: clientConfig.email || clientConfig.short_name,
    });
    if (error) { showToast('Erro ao registrar baixa: ' + error.message); return false; }
    paymentsMap[recordId] = (paymentsMap[recordId] || 0) + amount;
    return true;
}

async function clearPaymentsForDebtor(debtorName) {
    const recordIds = processedData.filter(d => d.cliente === debtorName).map(d => d.id);
    if (recordIds.length === 0) return;
    
    const { error } = await sb.from('payments').delete().eq('client_id', clientConfig.id).in('record_id', recordIds);
    if (error) { showToast('Erro ao desfazer baixas: ' + error.message); return; }
    
    recordIds.forEach(id => { paymentsMap[id] = 0; });
}

function normalizeClientName(raw) {
    if (!raw || !raw.trim()) return 'SEM NOME';
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    return clientNameMap[lower] || clientNameMap[trimmed] || trimmed.toUpperCase();
}

function buildClientGroups(data) {
    clientGroups = {};
    data.forEach(item => {
        if (!clientGroups[item.cliente]) {
            clientGroups[item.cliente] = [];
        }
        clientGroups[item.cliente].push(item);
    });
}

function populateFilters() {
    const filterCliente = document.getElementById('filterCliente');
    const filterProduto = document.getElementById('filterProduto');
    const filterUsuario = document.getElementById('filterUsuario');
    
    const selC = filterCliente.value;
    const selP = filterProduto.value;
    const selU = filterUsuario.value;
    
    const clientes = [...new Set(processedData.map(d => d.cliente))].sort();
    const produtos = [...new Set(processedData.map(d => d.produto).filter(Boolean))].sort();
    const usuarios = [...new Set(processedData.map(d => d.usuario).filter(Boolean))].sort();
    
    const buildOptions = (items, selected) => {
        let html = '<option value="">Todos</option>';
        items.forEach(i => {
            html += `<option value="${escapeHTML(i)}" ${i === selected ? 'selected' : ''}>${escapeHTML(i)}</option>`;
        });
        return html;
    };
    
    filterCliente.innerHTML = buildOptions(clientes, selC);
    filterProduto.innerHTML = buildOptions(produtos, selP);
    filterUsuario.innerHTML = buildOptions(usuarios, selU);
}

function getFilteredData() {
    const fCli = document.getElementById('filterCliente').value.toLowerCase();
    const fProd = document.getElementById('filterProduto').value.toLowerCase();
    const fUser = document.getElementById('filterUsuario').value.toLowerCase();
    const fDe = document.getElementById('filterDataDe').value;
    const fAte = document.getElementById('filterDataAte').value;
    const fMin = parseFloat(document.getElementById('filterValorMin').value) || null;
    const fMax = parseFloat(document.getElementById('filterValorMax').value) || null;
    const q = document.getElementById('searchGlobal').value.toLowerCase();
    
    const dateDe = fDe ? new Date(fDe + 'T00:00:00') : null;
    const dateAte = fAte ? new Date(fAte + 'T23:59:59') : null;

    return processedData.filter(item => {
        if (q) {
            const searchStr = `${item.cliente} ${item.produto} ${item.codigo} ${item.usuario}`.toLowerCase();
            if (!searchStr.includes(q)) return false;
        }
        
        if (fCli && item.cliente.toLowerCase() !== fCli) return false;
        if (fProd && item.produto.toLowerCase() !== fProd) return false;
        if (fUser && item.usuario.toLowerCase() !== fUser) return false;
        
        if (fMin !== null && item.saldo < fMin) return false;
        if (fMax !== null && item.saldo > fMax) return false;
        
        if (dateDe || dateAte) {
            const itemDate = toDateObj(item.dataEmissao);
            if (itemDate) {
                if (dateDe && itemDate < dateDe) return false;
                if (dateAte && itemDate > dateAte) return false;
            }
        }
        
        const status = getItemStatus(item);
        if (activePreset === 'pending' && status !== 'pending') return false;
        if (activePreset === 'partial' && status !== 'partial') return false;
        if (activePreset === 'paid' && status !== 'paid') return false;
        if (activePreset === 'high-value' && item.saldo <= 50) return false;
        
        return true;
    });
}

function applyFilters() {
    let data = getFilteredData();
    
    if (activePreset === 'top-clients') {
        const cTotals = {};
        data.forEach(d => {
            const rem = getItemRemaining(d);
            if (rem > 0) {
                cTotals[d.cliente] = (cTotals[d.cliente] || 0) + rem;
            }
        });
        const top10 = Object.entries(cTotals).sort((a,b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
        data = data.filter(d => top10.includes(d.cliente));
    }
    
    document.getElementById('searchCountBadge').textContent = data.length;
    
    updateHeaderStats(data);
    
    const activeView = document.querySelector('.view-tab.active').id;
    if (activeView === 'viewCards') renderCards(data);
    else if (activeView === 'viewTable') renderTable(data);
    else renderCharts(data);
}

function updateHeaderStats(data) {
    let totalReceber = 0;
    let totalRecebido = 0;
    const clientesSet = new Set();
    
    data.forEach(item => {
        const paid = getItemPaid(item);
        const rem = getItemRemaining(item);
        totalReceber += rem;
        totalRecebido += paid;
        if (rem > 0) clientesSet.add(item.cliente);
    });
    
    document.getElementById('totalGeral').textContent = formatBRL(totalReceber);
    document.getElementById('totalRecebido').textContent = formatBRL(totalRecebido);
    document.getElementById('totalClientes').textContent = clientesSet.size;
    document.getElementById('totalRegistros').textContent = data.length;
}

function renderCards(data) {
    const grid = document.getElementById('cardsGrid');
    const emptyState = document.getElementById('cardsEmptyState');
    
    if (data.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    
    const cStats = {};
    data.forEach(item => {
        if (!cStats[item.cliente]) cStats[item.cliente] = { name: item.cliente, total: 0, items: 0, oldest: null };
        const rem = getItemRemaining(item);
        if (rem > 0) {
            cStats[item.cliente].total += rem;
            cStats[item.cliente].items++;
            const dt = toDateObj(item.dataEmissao);
            if (dt && (!cStats[item.cliente].oldest || dt < cStats[item.cliente].oldest)) {
                cStats[item.cliente].oldest = dt;
            }
        }
    });
    
    let cards = Object.values(cStats).filter(c => c.total > 0);
    
    cards.sort((a, b) => {
        if (currentCardSort === 'debt-desc') return b.total - a.total;
        if (currentCardSort === 'debt-asc') return a.total - b.total;
        if (currentCardSort === 'name-asc') return a.name.localeCompare(b.name);
        if (currentCardSort === 'items-desc') return b.items - a.items;
        return 0;
    });
    
    grid.innerHTML = cards.map(c => {
        const oldestStr = c.oldest ? c.oldest.toLocaleDateString('pt-BR') : '-';
        return `
            <div class="client-card" onclick="openModal('${escapeHTML(c.name)}')">
                <div class="card-header-flex">
                    <h3 class="card-title">${escapeHTML(c.name)}</h3>
                </div>
                <div class="card-kpis">
                    <div class="kpi-box">
                        <span class="kpi-label">Debito Total</span>
                        <span class="kpi-val text-accent">${formatBRL(c.total)}</span>
                    </div>
                    <div class="kpi-box">
                        <span class="kpi-label">Lancamentos</span>
                        <span class="kpi-val">${c.items}</span>
                    </div>
                </div>
                <div class="card-footer-flex">
                    <span class="oldest-date">Desde: ${oldestStr}</span>
                    <button class="btn btn-outline btn-sm">Ver Extrato</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Nenhum registro encontrado.</td></tr>';
        document.getElementById('tableCount').textContent = '0 registros';
        document.getElementById('tableTotal').textContent = 'R$ 0,00';
        return;
    }
    
    let sorted = [...data].sort((a, b) => {
        let valA, valB;
        if (currentSort.key === 'cliente') { valA = a.cliente; valB = b.cliente; }
        else if (currentSort.key === 'produto') { valA = a.produto; valB = b.produto; }
        else if (currentSort.key === 'valor') { valA = a.valor; valB = b.valor; }
        else if (currentSort.key === 'saldo') { valA = a.saldo; valB = b.saldo; }
        else if (currentSort.key === 'data') { valA = toDateObj(a.dataEmissao) || 0; valB = toDateObj(b.dataEmissao) || 0; }
        
        if (typeof valA === 'string') return currentSort.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return currentSort.dir === 'asc' ? valA - valB : valB - valA;
    });
    
    let totalTable = 0;
    tbody.innerHTML = sorted.map(item => {
        const paid = getItemPaid(item);
        const rem = getItemRemaining(item);
        const status = getItemStatus(item);
        totalTable += rem;
        
        let statusHtml = '';
        if (status === 'paid') statusHtml = '<span class="status-badge paid">Pago</span>';
        else if (status === 'partial') statusHtml = '<span class="status-badge partial">Parcial</span>';
        else statusHtml = '<span class="status-badge pending">Pendente</span>';
        
        return `
            <tr>
                <td><strong>${escapeHTML(item.cliente)}</strong></td>
                <td>${escapeHTML(item.produto)}<br><small class="text-muted">${escapeHTML(item.codigo)}</small></td>
                <td>${formatBRL(item.saldo)}</td>
                <td><span class="text-accent"><strong>${formatBRL(rem)}</strong></span></td>
                <td>${formatBRL(paid)}</td>
                <td>${statusHtml}</td>
                <td>${formatDate(item.dataEmissao)}</td>
                <td>${escapeHTML(item.usuario)}</td>
                <td>${escapeHTML(item.parcela)}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('tableCount').textContent = `${sorted.length} registros`;
    document.getElementById('tableTotal').textContent = formatBRL(totalTable);
}

function renderCharts(data) {
    if (typeof Chart === 'undefined') return;
    
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b';
    
    const gridColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : '#e2e8f0';
    const accentColor = clientConfig.color || '#e8590c';
    
    const dailyMap = {};
    data.forEach(d => {
        const rem = getItemRemaining(d);
        if (rem > 0 && d.dataEmissao) {
            const dateStr = d.dataEmissao.split('T')[0];
            dailyMap[dateStr] = (dailyMap[dateStr] || 0) + rem;
        }
    });
    const dailyKeys = Object.keys(dailyMap).sort();
    const dailyLabels = dailyKeys.map(k => {
        const [y,m,d] = k.split('-');
        return `${d}/${m}`;
    });
    const dailyValues = dailyKeys.map(k => dailyMap[k]);
    
    if (chartInstances.daily) chartInstances.daily.destroy();
    chartInstances.daily = new Chart(document.getElementById('chartDaily'), {
        type: 'line',
        data: { labels: dailyLabels, datasets: [{ label: 'Saldo', data: dailyValues, borderColor: accentColor, backgroundColor: accentColor+'33', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true } } }
    });
    
    const cliMap = {};
    data.forEach(d => {
        const rem = getItemRemaining(d);
        if (rem > 0) cliMap[d.cliente] = (cliMap[d.cliente] || 0) + rem;
    });
    const top10 = Object.entries(cliMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    if (chartInstances.top) chartInstances.top.destroy();
    chartInstances.top = new Chart(document.getElementById('chartTopClients'), {
        type: 'bar',
        data: { labels: top10.map(x=>x[0]), datasets: [{ label: 'Debito', data: top10.map(x=>x[1]), backgroundColor: accentColor, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { grid: { color: gridColor }, beginAtZero: true }, y: { grid: { display: false } } } }
    });
    
    const prodMap = {};
    data.forEach(d => {
        const rem = getItemRemaining(d);
        if (rem > 0 && d.produto) prodMap[d.produto] = (prodMap[d.produto] || 0) + rem;
    });
    const topProd = Object.entries(prodMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    if (chartInstances.prod) chartInstances.prod.destroy();
    chartInstances.prod = new Chart(document.getElementById('chartProducts'), {
        type: 'doughnut',
        data: { labels: topProd.map(x=>x[0]), datasets: [{ data: topProd.map(x=>x[1]), backgroundColor: [accentColor, '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
}

// ============================================================
// AUXILIARES DE DATA E PERÍODO
// ============================================================
function getDateRangeValues(rangeType) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    if (rangeType === 'today') {
        const todayStr = toYMD(now);
        return { de: todayStr, ate: todayStr };
    }
    if (rangeType === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = toYMD(y);
        return { de: yStr, ate: yStr };
    }
    if (rangeType === 'last7') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return { de: toYMD(d), ate: toYMD(now) };
    }
    if (rangeType === 'thisMonth') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { de: toYMD(first), ate: toYMD(last) };
    }
    if (rangeType === 'lastMonth') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { de: toYMD(first), ate: toYMD(last) };
    }
    return { de: '', ate: '' };
}

function formatYMDToBR(ymd) {
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return formatDate(ymd);
}

// ============================================================
// MODAL EXTRATO E FILTRAGEM
// ============================================================
function getModalFilteredItems() {
    const allItems = clientGroups[currentModalClient] || [];
    const deInput = document.getElementById('modalFilterDataDe');
    const ateInput = document.getElementById('modalFilterDataAte');
    
    const deVal = deInput ? deInput.value : '';
    const ateVal = ateInput ? ateInput.value : '';
    
    const dateDe = deVal ? new Date(deVal + 'T00:00:00') : null;
    const dateAte = ateVal ? new Date(ateVal + 'T23:59:59') : null;
    
    if (!dateDe && !dateAte) return allItems;
    
    return allItems.filter(item => {
        const dt = toDateObj(item.dataEmissao);
        if (!dt) return true;
        if (dateDe && dt < dateDe) return false;
        if (dateAte && dt > dateAte) return false;
        return true;
    });
}

function updateModalChipsActive() {
    const deVal = document.getElementById('modalFilterDataDe').value;
    const ateVal = document.getElementById('modalFilterDataAte').value;
    const panelDe = document.getElementById('filterDataDe').value;
    const panelAte = document.getElementById('filterDataAte').value;
    
    document.querySelectorAll('.modal-quick-btn').forEach(btn => btn.classList.remove('active'));
    
    if (!deVal && !ateVal) {
        const btnAll = document.getElementById('btnModalAllDates');
        if (btnAll) btnAll.classList.add('active');
    } else if (deVal === panelDe && ateVal === panelAte && (panelDe || panelAte)) {
        const btnPanel = document.getElementById('btnModalPanelDates');
        if (btnPanel) btnPanel.classList.add('active');
    }
}

window.openModal = function(clientName) {
    currentModalClient = clientName;
    selectedItems.clear();
    baixaMode = 'all';
    
    document.getElementById('modalClientName').textContent = clientName;
    document.getElementById('selectAllItems').checked = false;
    
    // Herda automaticamente o filtro de data ativo na tela principal
    const panelDe = document.getElementById('filterDataDe').value;
    const panelAte = document.getElementById('filterDataAte').value;
    
    document.getElementById('modalFilterDataDe').value = panelDe || '';
    document.getElementById('modalFilterDataAte').value = panelAte || '';
    
    updateModalChipsActive();
    refreshModal();
    document.getElementById('modalOverlay').classList.remove('hidden');
};

function refreshModal() {
    const allItems = clientGroups[currentModalClient] || [];
    const items = getModalFilteredItems();
    
    let totalDebt = 0;
    let pendingCount = 0;
    let paidTotal = 0;
    
    items.forEach(i => {
        const rem = getItemRemaining(i);
        const paid = getItemPaid(i);
        paidTotal += paid;
        if (rem > 0) {
            totalDebt += rem;
            pendingCount++;
        }
    });
    
    const deVal = document.getElementById('modalFilterDataDe').value;
    const ateVal = document.getElementById('modalFilterDataAte').value;
    const isFiltered = !!(deVal || ateVal);
    
    const indicator = document.getElementById('modalFilterIndicator');
    if (indicator) {
        if (isFiltered) {
            indicator.className = 'modal-filter-indicator';
            let rangeText = '';
            if (deVal && ateVal) rangeText = deVal === ateVal ? formatYMDToBR(deVal) : `${formatYMDToBR(deVal)} a ${formatYMDToBR(ateVal)}`;
            else if (deVal) rangeText = `A partir de ${formatYMDToBR(deVal)}`;
            else rangeText = `Até ${formatYMDToBR(ateVal)}`;
            
            indicator.textContent = `Filtrado: ${items.length} de ${allItems.length} lançamentos (${rangeText})`;
            document.getElementById('modalClientSummary').textContent = `${pendingCount} lançamento(s) pendente(s) no período selecionado (Total no histórico: ${allItems.length})`;
        } else {
            indicator.className = 'modal-filter-indicator unfiltered';
            indicator.textContent = `Todo o Histórico (${allItems.length} lançamentos)`;
            document.getElementById('modalClientSummary').textContent = `${pendingCount} lançamento(s) pendente(s) | Total de histórico: ${allItems.length}`;
        }
    }
    
    document.getElementById('modalStats').innerHTML = `
        <div class="modal-kpi-card"><div class="modal-kpi-label">${isFiltered ? 'Débito no Período' : 'Débito Atual'}</div><div class="modal-kpi-val text-accent">${formatBRL(totalDebt)}</div></div>
        <div class="modal-kpi-card"><div class="modal-kpi-label">${isFiltered ? 'Pago no Período' : 'Já Pago (Histórico)'}</div><div class="modal-kpi-val text-green">${formatBRL(paidTotal)}</div></div>
        <div class="modal-kpi-card"><div class="modal-kpi-label">${isFiltered ? 'Pendentes no Período' : 'Lançamentos Pendentes'}</div><div class="modal-kpi-val">${pendingCount}</div></div>
    `;
    
    renderModalTable(items);
    updateBaixaButtons();
}

function renderModalTable(items) {
    const tbody = document.getElementById('modalTableBody');
    
    const sorted = [...items].sort((a,b) => {
        const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao);
        if(!da && !db) return 0; if(!da) return 1; if(!db) return -1;
        return db - da;
    });
    
    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">Nenhum lançamento encontrado para o período selecionado.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = sorted.map(item => {
        const rem = getItemRemaining(item);
        const paid = getItemPaid(item);
        const status = getItemStatus(item);
        
        let statusHtml = '';
        if (status === 'paid') statusHtml = '<span class="status-badge paid">Pago</span>';
        else if (status === 'partial') statusHtml = '<span class="status-badge partial">Parcial</span>';
        else statusHtml = '<span class="status-badge pending">Pendente</span>';
        
        const isChecked = selectedItems.has(item.id) ? 'checked' : '';
        const disableCheck = status === 'paid' ? 'disabled' : '';
        const disableBtn = status === 'paid' ? 'disabled' : '';
        
        return `
            <tr class="${status === 'paid' ? 'row-paid' : ''}">
                <td><input type="checkbox" class="item-checkbox" data-id="${item.id}" ${isChecked} ${disableCheck}></td>
                <td>${escapeHTML(item.produto)}<br><small class="text-muted">${escapeHTML(item.codigo)}</small></td>
                <td>${formatBRL(item.saldo)}</td>
                <td>${formatBRL(paid)}</td>
                <td><strong>${formatBRL(rem)}</strong></td>
                <td>${statusHtml}</td>
                <td>${formatDate(item.dataEmissao)}</td>
                <td>${escapeHTML(item.usuario)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="baixaIndividual(${item.id})" ${disableBtn}>Baixar</button>
                </td>
            </tr>
        `;
    }).join('');
    
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) selectedItems.add(id);
            else selectedItems.delete(id);
            updateBaixaButtons();
        });
    });
}

function updateBaixaButtons() {
    const btnTotal = document.getElementById('btnBaixaTotal');
    const deVal = document.getElementById('modalFilterDataDe').value;
    const ateVal = document.getElementById('modalFilterDataAte').value;
    const isFiltered = !!(deVal || ateVal);
    
    if (selectedItems.size > 0) {
        btnTotal.textContent = `Baixar Selecionados (${selectedItems.size})`;
        baixaMode = 'selected';
    } else if (isFiltered) {
        btnTotal.textContent = `✓ Baixar Período`;
        baixaMode = 'all';
    } else {
        btnTotal.textContent = `✓ Baixa Total`;
        baixaMode = 'all';
    }
}

window.baixaIndividual = async function(id) {
    const item = processedData.find(d => d.id === id);
    if (!item) return;
    const rem = getItemRemaining(item);
    if (rem <= 0) return;
    
    const ok = await registerPayment(id, rem, 'Baixa individual');
    if (ok) {
        showToast('Baixa registrada!');
        applyFilters();
        refreshModal();
    }
};

async function handleBaixaTotal() {
    const items = baixaMode === 'selected' 
        ? processedData.filter(d => selectedItems.has(d.id))
        : getModalFilteredItems();
        
    const pendingItems = items.filter(i => getItemRemaining(i) > 0);
    if (pendingItems.length === 0) {
        showToast('Não há lançamentos pendentes para baixar no período.');
        return;
    }
    
    const totalToPay = pendingItems.reduce((acc, i) => acc + getItemRemaining(i), 0);
    const deVal = document.getElementById('modalFilterDataDe').value;
    const ateVal = document.getElementById('modalFilterDataAte').value;
    const isFiltered = !!(deVal || ateVal);
    
    let confirmMsg = '';
    if (baixaMode === 'selected') {
        confirmMsg = `Confirmar baixa de ${pendingItems.length} item(s) selecionado(s) no valor total de ${formatBRL(totalToPay)}?`;
    } else if (isFiltered) {
        confirmMsg = `Confirmar baixa de ${pendingItems.length} lançamento(s) do PERÍODO FILTRADO no valor de ${formatBRL(totalToPay)} para ${currentModalClient}?`;
    } else {
        confirmMsg = `Confirmar baixa total de ${pendingItems.length} lançamento(s) no valor de ${formatBRL(totalToPay)} para ${currentModalClient}?`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    let count = 0;
    for (const item of pendingItems) {
        const rem = getItemRemaining(item);
        const desc = baixaMode === 'selected' ? 'Baixa em lote' : (isFiltered ? 'Baixa por período' : 'Baixa total');
        const ok = await registerPayment(item.id, rem, desc);
        if (ok) count++;
    }
    
    if (count > 0) {
        showToast(`${count} baixa(s) registrada(s)!`);
        selectedItems.clear();
        document.getElementById('selectAllItems').checked = false;
        applyFilters();
        refreshModal();
    }
}

function openBaixaParcial() {
    document.getElementById('baixaValorInput').value = '';
    document.getElementById('baixaNotaInput').value = '';
    const isFiltered = !!(document.getElementById('modalFilterDataDe').value || document.getElementById('modalFilterDataAte').value);
    let scopeText = baixaMode === 'selected' 
        ? `${selectedItems.size} item(s) selecionado(s)` 
        : (isFiltered ? `${currentModalClient} (Período filtrado)` : currentModalClient);
        
    document.getElementById('baixaParcialSubtitle').textContent = scopeText;
    document.getElementById('baixaParcialOverlay').classList.remove('hidden');
}

function closeBaixaParcial() {
    document.getElementById('baixaParcialOverlay').classList.add('hidden');
}

async function confirmarBaixaParcial() {
    const valStr = document.getElementById('baixaValorInput').value;
    const valor = parseFloat(valStr);
    const nota = document.getElementById('baixaNotaInput').value;
    
    if (isNaN(valor) || valor <= 0) {
        showToast('Digite um valor válido');
        return;
    }
    
    const targets = baixaMode === 'selected' 
        ? processedData.filter(d => selectedItems.has(d.id))
        : getModalFilteredItems();
        
    const sortedTargets = [...targets].sort((a,b) => {
        const da = toDateObj(a.dataEmissao), db = toDateObj(b.dataEmissao);
        if(!da && !db) return 0; if(!da) return 1; if(!db) return -1;
        return da - db;
    });
    
    let remaining = valor;
    let count = 0;
    for (const item of sortedTargets) {
        const rem = getItemRemaining(item);
        if (rem <= 0) continue;
        const pay = Math.min(remaining, rem);
        const ok = await registerPayment(item.id, pay, nota || `Baixa parcial ${formatBRL(valor)}`);
        if (ok) {
            remaining -= pay;
            count++;
        }
        if (remaining <= 0) break;
    }
    
    closeBaixaParcial();
    if (count > 0) {
        showToast('Baixa parcial registrada!');
        selectedItems.clear();
        document.getElementById('selectAllItems').checked = false;
        applyFilters();
        refreshModal();
    }
}

async function handleDesfazerBaixas() {
    if (!confirm(`Desfazer todas as baixas de ${currentModalClient}?`)) return;
    await clearPaymentsForDebtor(currentModalClient);
    showToast('Baixas desfeitas!');
    selectedItems.clear();
    document.getElementById('selectAllItems').checked = false;
    applyFilters();
    refreshModal();
}

function copyBillingText() {
    const items = getModalFilteredItems();
    const deVal = document.getElementById('modalFilterDataDe').value;
    const ateVal = document.getElementById('modalFilterDataAte').value;
    const isFiltered = !!(deVal || ateVal);
    
    let text = `Olá, somos da ${clientConfig.short_name || clientConfig.name}.\n\nSegue o extrato das suas compras`;
    if (isFiltered) {
        if (deVal && ateVal) text += ` (${formatYMDToBR(deVal)} a ${formatYMDToBR(ateVal)})`;
        else if (deVal) text += ` (a partir de ${formatYMDToBR(deVal)})`;
        else text += ` (até ${formatYMDToBR(ateVal)})`;
    }
    text += `:\n\n`;
    
    let total = 0;
    items.forEach(item => {
        const rem = getItemRemaining(item);
        if (rem > 0) {
            total += rem;
            const dt = formatDate(item.dataEmissao);
            text += `- ${dt}: ${item.produto} (R$ ${rem.toFixed(2)})\n`;
        }
    });
    
    if (total === 0) {
        showToast('Não há débitos pendentes para cobrar no período.');
        return;
    }
    
    text += `\n*Total em aberto: R$ ${total.toFixed(2)}*\n\nQualquer dúvida, estamos à disposição.`;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Texto copiado para o WhatsApp!');
    }).catch(() => {
        showToast('Erro ao copiar texto.');
    });
}

function exportClientCSV() {
    const items = getModalFilteredItems();
    let csv = 'Produto,Codigo,Valor Original,Pago,Restante,Data,Operador\n';
    items.forEach(item => {
        const rem = getItemRemaining(item);
        const paid = getItemPaid(item);
        csv += `"${item.produto}","${item.codigo}",${item.saldo.toFixed(2)},${paid.toFixed(2)},${rem.toFixed(2)},"${formatDate(item.dataEmissao)}","${item.usuario}"\n`;
    });
    downloadCSV(csv, `extrato_${slugify(currentModalClient)}.csv`);
}

function exportGeneralCSV() {
    const data = getFilteredData();
    let csv = 'Cliente,Produto,Codigo,Valor Original,Pago,Restante,Data,Operador\n';
    data.forEach(item => {
        const rem = getItemRemaining(item);
        const paid = getItemPaid(item);
        csv += `"${item.cliente}","${item.produto}","${item.codigo}",${item.saldo.toFixed(2)},${paid.toFixed(2)},${rem.toFixed(2)},"${formatDate(item.dataEmissao)}","${item.usuario}"\n`;
    });
    downloadCSV(csv, `relatorio_geral.csv`);
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// EVENT LISTENERS GERAIS
// ============================================================
function setupEventListeners() {
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('btnLogout').addEventListener('click', () => {
        sessionStorage.removeItem('qrzfood_client_' + clientConfig.id);
        window.location.reload();
    });
    
    // Inputs de filtro do painel principal
    ['filterCliente', 'filterProduto', 'filterUsuario', 'filterValorMin', 'filterValorMax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', applyFilters);
            el.addEventListener('input', applyFilters);
        }
    });
    
    // Filtro de data do painel principal
    const mainDe = document.getElementById('filterDataDe');
    const mainAte = document.getElementById('filterDataAte');
    
    const onMainDateChange = () => {
        // Atualiza estilo dos chips de data rápida do painel
        document.querySelectorAll('.date-quick-btn').forEach(btn => btn.classList.remove('active'));
        if (!mainDe.value && !mainAte.value) {
            const allBtn = document.querySelector('.date-quick-btn[data-range="all"]');
            if (allBtn) allBtn.classList.add('active');
        }
        applyFilters();
    };
    
    if (mainDe) {
        mainDe.addEventListener('change', onMainDateChange);
        mainDe.addEventListener('input', onMainDateChange);
    }
    if (mainAte) {
        mainAte.addEventListener('change', onMainDateChange);
        mainAte.addEventListener('input', onMainDateChange);
    }
    
    // Botões de período rápido do painel principal (Hoje, Ontem, etc.)
    document.querySelectorAll('.date-quick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.date-quick-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const range = e.target.dataset.range;
            const { de, ate } = getDateRangeValues(range);
            mainDe.value = de;
            mainAte.value = ate;
            applyFilters();
        });
    });
    
    // Busca global instantânea
    document.getElementById('searchGlobal').addEventListener('input', applyFilters);
    
    // Limpar filtros gerais
    document.getElementById('btnLimpar').addEventListener('click', () => {
        ['filterCliente', 'filterProduto', 'filterUsuario', 'filterDataDe', 'filterDataAte', 'filterValorMin', 'filterValorMax', 'searchGlobal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        activePreset = 'all';
        document.querySelectorAll('.preset-chip').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.preset-chip[data-preset="all"]').classList.add('active');
        document.querySelectorAll('.date-quick-btn').forEach(btn => btn.classList.remove('active'));
        const allDateBtn = document.querySelector('.date-quick-btn[data-range="all"]');
        if (allDateBtn) allDateBtn.classList.add('active');
        applyFilters();
    });
    
    // Presets de status (Todos, Pendentes, Parcial, Pagos, etc.)
    document.querySelectorAll('.preset-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activePreset = e.target.dataset.preset;
            applyFilters();
        });
    });
    
    // Alternadores de visualização (Cards / Tabela / Gráfico)
    document.getElementById('viewCards').addEventListener('click', (e) => switchView('viewCards', e));
    document.getElementById('viewTable').addEventListener('click', (e) => switchView('viewTable', e));
    document.getElementById('viewChart').addEventListener('click', (e) => switchView('viewChart', e));
    
    function switchView(viewId, event) {
        document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById('cardsView').classList.add('hidden');
        document.getElementById('tableView').classList.add('hidden');
        document.getElementById('chartView').classList.add('hidden');
        
        if (viewId === 'viewCards') { document.getElementById('cardsView').classList.remove('hidden'); renderCards(getFilteredData()); }
        if (viewId === 'viewTable') { document.getElementById('tableView').classList.remove('hidden'); renderTable(getFilteredData()); }
        if (viewId === 'viewChart') { document.getElementById('chartView').classList.remove('hidden'); renderCharts(getFilteredData()); }
    }
    
    // Ordenação da tabela geral
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = key;
                currentSort.dir = 'asc';
            }
            document.querySelectorAll('.sort-indicator').forEach(ind => ind.textContent = '↕');
            th.querySelector('.sort-indicator').textContent = currentSort.dir === 'asc' ? '↑' : '↓';
            renderTable(getFilteredData());
        });
    });
    
    // Ordenação dos cards
    document.getElementById('cardSortSelect').addEventListener('change', (e) => {
        currentCardSort = e.target.value;
        renderCards(getFilteredData());
    });
    
    // Controles do Modal de Extrato
    document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modalOverlay').classList.add('hidden'));
    document.getElementById('btnFecharModal').addEventListener('click', () => document.getElementById('modalOverlay').classList.add('hidden'));
    
    // Filtros de Data DENTRO do Modal
    const modalDe = document.getElementById('modalFilterDataDe');
    const modalAte = document.getElementById('modalFilterDataAte');
    
    const onModalDateChange = () => {
        updateModalChipsActive();
        refreshModal();
    };
    
    if (modalDe) {
        modalDe.addEventListener('change', onModalDateChange);
        modalDe.addEventListener('input', onModalDateChange);
    }
    if (modalAte) {
        modalAte.addEventListener('change', onModalDateChange);
        modalAte.addEventListener('input', onModalDateChange);
    }
    
    // Botões de período rápido DENTRO do modal
    document.querySelectorAll('.modal-quick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.modal-quick-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const mrange = e.target.dataset.mrange;
            
            if (mrange === 'panel') {
                modalDe.value = mainDe.value;
                modalAte.value = mainAte.value;
            } else if (mrange === 'all') {
                modalDe.value = '';
                modalAte.value = '';
            } else {
                const { de, ate } = getDateRangeValues(mrange);
                modalDe.value = de;
                modalAte.value = ate;
            }
            refreshModal();
        });
    });
    
    // Botão Limpar Filtro de Data dentro do modal
    const btnLimparModalData = document.getElementById('btnModalLimparData');
    if (btnLimparModalData) {
        btnLimparModalData.addEventListener('click', () => {
            modalDe.value = '';
            modalAte.value = '';
            document.querySelectorAll('.modal-quick-btn').forEach(b => b.classList.remove('active'));
            const btnAll = document.getElementById('btnModalAllDates');
            if (btnAll) btnAll.classList.add('active');
            refreshModal();
        });
    }
    
    // Seleção de itens no modal
    document.getElementById('selectAllItems').addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.item-checkbox').forEach(cb => {
            if (!cb.disabled) {
                cb.checked = checked;
                const id = parseInt(cb.dataset.id);
                if (checked) selectedItems.add(id);
                else selectedItems.delete(id);
            }
        });
        updateBaixaButtons();
    });
    
    // Ações de Baixa no Modal
    document.getElementById('btnBaixaTotal').addEventListener('click', handleBaixaTotal);
    document.getElementById('btnBaixaParcial').addEventListener('click', openBaixaParcial);
    document.getElementById('btnDesfazerBaixas').addEventListener('click', handleDesfazerBaixas);
    
    // Modal de Baixa Parcial
    document.getElementById('baixaParcialClose').addEventListener('click', closeBaixaParcial);
    document.getElementById('btnCancelarBaixa').addEventListener('click', closeBaixaParcial);
    document.getElementById('btnConfirmarBaixa').addEventListener('click', confirmarBaixaParcial);
    
    // Exportações do Modal
    document.getElementById('btnCopiarCobranca').addEventListener('click', copyBillingText);
    document.getElementById('btnExportarCliente').addEventListener('click', exportClientCSV);
    document.getElementById('btnExportarGeral').addEventListener('click', exportGeneralCSV);
}
