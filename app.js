// ============================================================
// DASHBOARD DE FIADOS — PADARIA
// ============================================================

// --- CLIENT NAME NORMALIZATION MAP ---
const CLIENT_MAP = {
    'acguaxbrasil': 'ACQUAX BRASIL',
    'acqua x brasil': 'ACQUAX BRASIL',
    'acquax': 'ACQUAX BRASIL',
    'acquax do brasil': 'ACQUAX BRASIL',
    'acquaxbrasil': 'ACQUAX BRASIL',
    'aqua': 'ACQUAX BRASIL',
    'aqua brasil': 'ACQUAX BRASIL',
    'c3': 'C3 OFICINA',
    'c3 oficina': 'C3 OFICINA',
    'carol': 'CAROL / KAROL',
    'karol': 'CAROL / KAROL',
    'davinny': 'DAVINNY',
    'davynni': 'DAVINNY',
    'eco mais': 'ECO MAIS',
    'eco+': 'ECO MAIS',
    'ecomais': 'ECO MAIS',
    'fernando': 'FERNANDO DE MOURA ALVES',
    'fernando de moura': 'FERNANDO DE MOURA ALVES',
    'fernando de moura alves': 'FERNANDO DE MOURA ALVES',
    'givanildo': 'GIVANILDO',
    'isaque': 'ISAQUE',
    'izaque': 'ISAQUE',
    'juan': 'JUAN',
    'juan padeiro': 'JUAN',
    'larissa': 'LARYSSA',
    'laryssa': 'LARYSSA',
    'leo': 'LÉO',
    'léo padeiro': 'LÉO',
    'l\u00e9o padeiro': 'LÉO',
    'lidyane': 'LIDYANE',
    'mbr': 'MBR',
    'primicias': 'PRIMÍCIAS',
    'primicis': 'PRIMÍCIAS',
    'primícias': 'PRIMÍCIAS',
    'prim\u00edcias': 'PRIMÍCIAS',
    'rayane': 'RAYANE / RAYANNE',
    'rayanne': 'RAYANE / RAYANNE',
    'rayssa': 'RAYANE / RAYANNE',
    'stephany': 'STEPHANY',
    'sthephane': 'STEPHANY',
    'sthephany': 'STEPHANY',
    'suport ferramenta': 'SUPPORT FERRAMENTAS',
    'suporte': 'SUPPORT FERRAMENTAS',
    'support ferramentas': 'SUPPORT FERRAMENTAS',
    'vessa': 'VESSA VEÍCULOS',
    'vessa veiculos': 'VESSA VEÍCULOS',
    'versa veiculos': 'VESSA VEÍCULOS',
    'ana kallytha': 'ANA KALLYTHA',
    'andressa ganhadora': 'ANDRESSA GANHADORA',
    'arthur ferreira': 'ARTHUR FERREIRA',
    'arthuer': 'ARTHUR FERREIRA',
    'bel': 'BEL',
    'eli': 'ELI',
    'fex': 'FEX',
    'flaa': 'FLAA',
    'leandro': 'LEANDRO',
    'lilian da silva': 'LILIAN DA SILVA',
    'paulo': 'PAULO',
    'raissa': 'RAISSA',
    'raquel': 'RAQUEL',
    'resutare': 'RESUTARE',
    'ruan': 'RUAN',
    'thiago sistema': 'THIAGO SISTEMA',
};

function normalizeClientName(raw) {
    if (!raw || !raw.trim()) return 'SEM NOME';
    const key = raw.trim().toLowerCase();
    return CLIENT_MAP[key] || raw.trim().toUpperCase();
}

function parseDecimal(str) {
    if (!str || str === '' || str === 'None') return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
}

function formatBRL(num) {
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(str) {
    if (!str || str === '' || str === 'None') return '—';
    try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return str;
    }
}

function formatDateTime(str) {
    if (!str || str === '' || str === 'None') return '—';
    try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return str;
    }
}

function toDateObj(str) {
    if (!str || str === '' || str === 'None') return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

// ============================================================
// DATA LOADING
// ============================================================
let rawData = [];
let processedData = [];
let clientGroups = {};
let currentSort = { key: 'cliente', dir: 'asc' };

async function loadData() {
    try {
        if (window.location.protocol !== 'file:') {
            const resp = await fetch('dados_fiado.json');
            rawData = await resp.json();
        } else if (typeof EMBEDDED_DATA !== 'undefined') {
            rawData = EMBEDDED_DATA;
        }
    } catch (e) {
        console.warn('Tentando carregar dados embutidos...', e);
        if (typeof EMBEDDED_DATA !== 'undefined') {
            rawData = EMBEDDED_DATA;
        } else {
            console.error('Erro ao carregar dados:', e);
            rawData = [];
        }
    }

    if ((!rawData || rawData.length === 0) && typeof EMBEDDED_DATA !== 'undefined') {
        rawData = EMBEDDED_DATA;
    }

    processedData = rawData.map((row, idx) => ({
        id: idx,
        clienteOriginal: (row.banco || '').trim(),
        cliente: normalizeClientName(row.banco),
        produto: (row.fatura || row.portador || '').trim(),
        codigo: (row.historico || '').trim(),
        valor: parseDecimal(row.valor),
        saldo: parseDecimal(row.saldoatual),
        juros: parseDecimal(row.juros),
        descontos: parseDecimal(row.descontos),
        valorPago: parseDecimal(row.valorpago),
        dataEmissao: row.dataemi || '',
        dataVencimento: row.datavenc || '',
        dataAtual: row.dataatual || '',
        dataPagamento: row.datapgto || '',
        usuario: (row.usuarioatual || '').trim(),
        situacao: (row.situacao || '').trim(),
        parcela: (row.parcela || '').trim(),
        indice: (row.indice || '').trim(),
        status: (row.status || '').trim(),
        valorRec: parseDecimal(row.valorrec),
    }));

    buildClientGroups(processedData);
    populateFilters();
    updateHeader(processedData);
    renderCards();
    renderTable(processedData);
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

// ============================================================
// FILTERS
// ============================================================
function populateFilters() {
    const clienteSelect = document.getElementById('filterCliente');
    const produtoSelect = document.getElementById('filterProduto');
    const usuarioSelect = document.getElementById('filterUsuario');

    const clientes = [...new Set(processedData.map(d => d.cliente))].sort();
    const produtos = [...new Set(processedData.map(d => d.produto).filter(p => p))].sort();
    const usuarios = [...new Set(processedData.map(d => d.usuario).filter(u => u))].sort();

    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        clienteSelect.appendChild(opt);
    });

    produtos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        produtoSelect.appendChild(opt);
    });

    usuarios.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = u;
        usuarioSelect.appendChild(opt);
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

    return processedData.filter(item => {
        if (cliente && item.cliente !== cliente) return false;
        if (produto && item.produto !== produto) return false;
        if (usuario && item.usuario.toLowerCase() !== usuario.toLowerCase()) return false;
        if (dataDe) {
            const d = toDateObj(item.dataEmissao);
            if (!d || d < new Date(dataDe + 'T00:00:00')) return false;
        }
        if (dataAte) {
            const d = toDateObj(item.dataEmissao);
            if (!d || d > new Date(dataAte + 'T23:59:59')) return false;
        }
        if (valorMin !== '' && item.saldo < parseFloat(valorMin)) return false;
        if (valorMax !== '' && item.saldo > parseFloat(valorMax)) return false;
        if (search) {
            const haystack = [
                item.cliente, item.clienteOriginal, item.produto,
                item.codigo, item.usuario, formatBRL(item.saldo),
                formatDate(item.dataEmissao)
            ].join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

function applyFilters() {
    const filtered = getFilteredData();
    buildClientGroups(filtered);
    updateHeader(filtered);
    renderCards();
    renderTable(filtered);
}

// ============================================================
// HEADER STATS
// ============================================================
function updateHeader(data) {
    const total = data.reduce((sum, d) => sum + d.saldo, 0);
    const clientes = new Set(data.map(d => d.cliente)).size;
    document.getElementById('totalGeral').textContent = formatBRL(total);
    document.getElementById('totalClientes').textContent = clientes;
    document.getElementById('totalRegistros').textContent = data.length;
}

// ============================================================
// CARDS VIEW
// ============================================================
function renderCards() {
    const grid = document.getElementById('cardsGrid');
    grid.innerHTML = '';

    const sortedClients = Object.keys(clientGroups).sort((a, b) => {
        const totalA = clientGroups[a].reduce((s, d) => s + d.saldo, 0);
        const totalB = clientGroups[b].reduce((s, d) => s + d.saldo, 0);
        return totalB - totalA; // Highest debt first
    });

    sortedClients.forEach(clientName => {
        const items = clientGroups[clientName];
        const total = items.reduce((sum, d) => sum + d.saldo, 0);
        const qtd = items.length;

        // Unique products
        const products = [...new Set(items.map(d => d.produto).filter(p => p))];

        // Date range
        const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
        const minDate = dates.length ? new Date(Math.min(...dates)) : null;
        const maxDate = dates.length ? new Date(Math.max(...dates)) : null;

        // Average ticket
        const avgTicket = qtd > 0 ? total / qtd : 0;

        const card = document.createElement('div');
        card.className = 'client-card';
        card.setAttribute('data-client', clientName);
        card.innerHTML = `
            <div class="card-header">
                <span class="card-name">${escapeHTML(clientName)}</span>
                <span class="card-total">${formatBRL(total)}</span>
            </div>
            <div class="card-meta">
                <div class="card-meta-item">
                    <span class="card-meta-label">Itens</span>
                    <span class="card-meta-value">${qtd}</span>
                </div>
                <div class="card-meta-item">
                    <span class="card-meta-label">Ticket Médio</span>
                    <span class="card-meta-value">${formatBRL(avgTicket)}</span>
                </div>
                <div class="card-meta-item">
                    <span class="card-meta-label">Produtos</span>
                    <span class="card-meta-value">${products.length}</span>
                </div>
            </div>
            <div class="card-products">
                <div class="card-products-title">Produtos</div>
                <div class="product-tags">
                    ${products.slice(0, 5).map(p => `<span class="product-tag">${escapeHTML(p)}</span>`).join('')}
                    ${products.length > 5 ? `<span class="product-tag">+${products.length - 5}</span>` : ''}
                </div>
            </div>
            <div class="card-footer">
                <span class="card-date-range">${minDate ? formatDate(minDate.toISOString()) : '—'} → ${maxDate ? formatDate(maxDate.toISOString()) : '—'}</span>
                <span class="card-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        `;

        card.addEventListener('click', () => openModal(clientName));
        grid.appendChild(card);
    });
}

// ============================================================
// TABLE VIEW
// ============================================================
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    const sorted = sortData(data, currentSort.key, currentSort.dir);

    sorted.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.cliente)}</strong></td>
            <td>${escapeHTML(item.produto)}</td>
            <td class="val-col">${formatBRL(item.valor)}</td>
            <td class="val-col">${formatBRL(item.saldo)}</td>
            <td>${formatDateTime(item.dataEmissao)}</td>
            <td>${escapeHTML(item.codigo)}</td>
            <td>${escapeHTML(item.usuario)}</td>
            <td>${escapeHTML(item.parcela)}</td>
            <td>${escapeHTML(item.indice)}</td>
        `;
        tbody.appendChild(tr);
    });

    const total = data.reduce((sum, d) => sum + d.saldo, 0);
    document.getElementById('tableCount').textContent = `${data.length} registros`;
    document.getElementById('tableTotal').textContent = `Total: ${formatBRL(total)}`;
}

function sortData(data, key, dir) {
    return [...data].sort((a, b) => {
        let va, vb;
        switch (key) {
            case 'cliente': va = a.cliente; vb = b.cliente; break;
            case 'produto': va = a.produto; vb = b.produto; break;
            case 'valor': va = a.valor; vb = b.valor; break;
            case 'saldo': va = a.saldo; vb = b.saldo; break;
            case 'data': va = a.dataEmissao; vb = b.dataEmissao; break;
            default: return 0;
        }
        if (typeof va === 'string') {
            const cmp = va.localeCompare(vb, 'pt-BR');
            return dir === 'asc' ? cmp : -cmp;
        }
        return dir === 'asc' ? va - vb : vb - va;
    });
}

// ============================================================
// MODAL
// ============================================================
function openModal(clientName) {
    const overlay = document.getElementById('modalOverlay');
    const items = clientGroups[clientName] || [];
    const total = items.reduce((sum, d) => sum + d.saldo, 0);
    const totalValor = items.reduce((sum, d) => sum + d.valor, 0);
    const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
    const minDate = dates.length ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length ? new Date(Math.max(...dates)) : null;
    const uniqueProducts = [...new Set(items.map(d => d.produto).filter(p => p))];

    document.getElementById('modalClientName').textContent = clientName;
    document.getElementById('modalClientSummary').textContent =
        `${items.length} registro(s) • ${uniqueProducts.length} produto(s) diferente(s)`;

    // Stats
    const statsContainer = document.getElementById('modalStats');
    statsContainer.innerHTML = `
        <div class="modal-stat-card">
            <div class="modal-stat-label">Saldo Total</div>
            <div class="modal-stat-value accent">${formatBRL(total)}</div>
        </div>
        <div class="modal-stat-card">
            <div class="modal-stat-label">Valor Total</div>
            <div class="modal-stat-value">${formatBRL(totalValor)}</div>
        </div>
        <div class="modal-stat-card">
            <div class="modal-stat-label">Qtd. Itens</div>
            <div class="modal-stat-value">${items.length}</div>
        </div>
        <div class="modal-stat-card">
            <div class="modal-stat-label">Ticket Médio</div>
            <div class="modal-stat-value">${formatBRL(items.length > 0 ? total / items.length : 0)}</div>
        </div>
        <div class="modal-stat-card">
            <div class="modal-stat-label">Primeiro Registro</div>
            <div class="modal-stat-value">${minDate ? formatDate(minDate.toISOString()) : '—'}</div>
        </div>
        <div class="modal-stat-card">
            <div class="modal-stat-label">Último Registro</div>
            <div class="modal-stat-value">${maxDate ? formatDate(maxDate.toISOString()) : '—'}</div>
        </div>
    `;

    // Table
    const tbody = document.getElementById('modalTableBody');
    tbody.innerHTML = '';
    items.sort((a, b) => {
        const da = toDateObj(a.dataEmissao);
        const db = toDateObj(b.dataEmissao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
    }).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(item.produto)}</td>
            <td class="val-col">${formatBRL(item.valor)}</td>
            <td class="val-col">${formatBRL(item.saldo)}</td>
            <td>${formatDateTime(item.dataEmissao)}</td>
            <td>${escapeHTML(item.codigo)}</td>
            <td>${escapeHTML(item.usuario)}</td>
            <td>${escapeHTML(item.parcela)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Store current client for export
    overlay.dataset.currentClient = clientName;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================================
// COPY BILLING TEXT
// ============================================================
function generateBillingText(clientName) {
    const items = clientGroups[clientName] || [];
    const total = items.reduce((sum, d) => sum + d.saldo, 0);

    let text = `📋 *CONTROLE DE FIADO — PADARIA*\n\n`;
    text += `👤 *Cliente:* ${clientName}\n`;
    text += `📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📝 *Itens:*\n\n`;

    items.sort((a, b) => {
        const da = toDateObj(a.dataEmissao);
        const db = toDateObj(b.dataEmissao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
    }).forEach((item, i) => {
        text += `${i + 1}. ${item.produto}\n`;
        text += `   💰 ${formatBRL(item.saldo)} — ${formatDate(item.dataEmissao)}\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 *TOTAL A RECEBER: ${formatBRL(total)}*\n`;
    text += `📦 *${items.length} item(ns)*\n\n`;
    text += `Qualquer dúvida, estamos à disposição! 🙏`;

    return text;
}

function copyBillingText() {
    const overlay = document.getElementById('modalOverlay');
    const clientName = overlay.dataset.currentClient;
    const text = generateBillingText(clientName);
    navigator.clipboard.writeText(text).then(() => showToast('Texto de cobrança copiado!')).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Texto de cobrança copiado!');
    });
}

// ============================================================
// EXPORT CLIENT
// ============================================================
function exportClient() {
    const overlay = document.getElementById('modalOverlay');
    const clientName = overlay.dataset.currentClient;
    const items = clientGroups[clientName] || [];
    const total = items.reduce((sum, d) => sum + d.saldo, 0);

    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += 'Cliente;Produto;Código;Valor;Saldo;Data Emissão;Registrado Por;Parcela;Índice\n';
    items.forEach(item => {
        csv += [
            clientName,
            item.produto,
            item.codigo,
            formatBRL(item.valor),
            formatBRL(item.saldo),
            formatDateTime(item.dataEmissao),
            item.usuario,
            item.parcela,
            item.indice
        ].join(';') + '\n';
    });
    csv += `\n;;TOTAL:;${formatBRL(total)};;;;\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiado_${clientName.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo CSV exportado!');
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // Filters
    document.getElementById('btnFiltrar').addEventListener('click', applyFilters);
    document.getElementById('btnLimpar').addEventListener('click', () => {
        document.getElementById('filterCliente').value = '';
        document.getElementById('filterProduto').value = '';
        document.getElementById('filterUsuario').value = '';
        document.getElementById('filterDataDe').value = '';
        document.getElementById('filterDataAte').value = '';
        document.getElementById('filterValorMin').value = '';
        document.getElementById('filterValorMax').value = '';
        document.getElementById('searchGlobal').value = '';
        applyFilters();
    });

    // Live search
    let searchTimer;
    document.getElementById('searchGlobal').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 250);
    });

    // View toggle
    document.getElementById('viewCards').addEventListener('click', () => {
        document.getElementById('viewCards').classList.add('active');
        document.getElementById('viewTable').classList.remove('active');
        document.getElementById('cardsView').classList.remove('hidden');
        document.getElementById('tableView').classList.add('hidden');
    });

    document.getElementById('viewTable').addEventListener('click', () => {
        document.getElementById('viewTable').classList.add('active');
        document.getElementById('viewCards').classList.remove('active');
        document.getElementById('tableView').classList.remove('hidden');
        document.getElementById('cardsView').classList.add('hidden');
    });

    // Table sorting
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = key;
                currentSort.dir = 'asc';
            }
            // Update sort indicators
            document.querySelectorAll('.data-table th.sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
            renderTable(getFilteredData());
        });
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Modal actions
    document.getElementById('btnCopiarCobranca').addEventListener('click', copyBillingText);
    document.getElementById('btnExportarCliente').addEventListener('click', exportClient);
});
