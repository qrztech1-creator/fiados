// ============================================================
// QRZ FOOD — GESTÃO & CONTROLE DE FIADOS
// Personalizado para: Padaria Divino Pão
// Desenvolvido por: QRZ Tech (qrztech.com)
// ============================================================

// --- MAPEAMENTO DE NORMALIZAÇÃO DE CLIENTES (CONFIRMADO) ---
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
    return 'R$ ' + (num || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ============================================================
// GLOBAL STATE & DATA STORAGE
// ============================================================
let rawData = [];
let processedData = [];
let clientGroups = {};
let currentSort = { key: 'cliente', dir: 'asc' };
let currentCardSort = 'debt-desc';
let activePreset = 'all';

// ============================================================
// DATA LOADING & NORMALIZATION
// ============================================================
async function loadData() {
    try {
        if (window.location.protocol !== 'file:') {
            const resp = await fetch('dados_fiado.json');
            rawData = await resp.json();
        } else if (typeof EMBEDDED_DATA !== 'undefined') {
            rawData = EMBEDDED_DATA;
        }
    } catch (e) {
        console.warn('Carregando dados embutidos como fallback...', e);
        if (typeof EMBEDDED_DATA !== 'undefined') {
            rawData = EMBEDDED_DATA;
        } else {
            console.error('Erro fatal ao carregar dados:', e);
            rawData = [];
        }
    }

    if ((!rawData || rawData.length === 0) && typeof EMBEDDED_DATA !== 'undefined') {
        rawData = EMBEDDED_DATA;
    }

    // Process all granular records
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
    updateHeaderStats(processedData);
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
// THEME SWITCHER (DARK / LIGHT MODE)
// ============================================================
function initTheme() {
    const savedTheme = localStorage.getItem('qrzfood_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    setTheme(initialTheme);

    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qrzfood_theme', theme);
    const themeLabel = document.getElementById('themeLabel');
    if (themeLabel) {
        themeLabel.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
    }
}

// ============================================================
// POPULATE DROPDOWNS
// ============================================================
function populateFilters() {
    const clienteSelect = document.getElementById('filterCliente');
    const produtoSelect = document.getElementById('filterProduto');
    const usuarioSelect = document.getElementById('filterUsuario');

    const clientes = [...new Set(processedData.map(d => d.cliente))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const produtos = [...new Set(processedData.map(d => d.produto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const usuarios = [...new Set(processedData.map(d => d.usuario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

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

// ============================================================
// FILTERING & SEARCH LOGIC
// ============================================================
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
        
        // Preset filtering
        if (activePreset === 'month') {
            const d = toDateObj(item.dataEmissao);
            if (d && (d.getMonth() !== 7 || d.getFullYear() !== 2026)) { // Month of August 2026 in data
                // Just for generic month matching
            }
        } else if (activePreset === 'high-value') {
            if (item.saldo < 50) return false;
        }

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
    let filtered = getFilteredData();
    
    // Top 10 clients preset
    if (activePreset === 'top-clients') {
        const fullGroups = {};
        filtered.forEach(d => {
            fullGroups[d.cliente] = (fullGroups[d.cliente] || 0) + d.saldo;
        });
        const top10Names = new Set(
            Object.entries(fullGroups)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(e => e[0])
        );
        filtered = filtered.filter(d => top10Names.has(d.cliente));
    }

    buildClientGroups(filtered);
    updateHeaderStats(filtered);
    renderCards();
    renderTable(filtered);

    // Update search badge
    const badge = document.getElementById('searchCountBadge');
    if (badge) {
        badge.textContent = `${filtered.length} registro(s)`;
    }
}

// ============================================================
// HEADER STATS UPDATE
// ============================================================
function updateHeaderStats(data) {
    const total = data.reduce((sum, d) => sum + d.saldo, 0);
    const clientes = new Set(data.map(d => d.cliente)).size;

    document.getElementById('totalGeral').textContent = formatBRL(total);
    document.getElementById('totalClientes').textContent = clientes;
    document.getElementById('totalRegistros').textContent = data.length;
}

// ============================================================
// CARDS VIEW (CLIENT GROUPING)
// ============================================================
function renderCards() {
    const grid = document.getElementById('cardsGrid');
    const emptyState = document.getElementById('cardsEmptyState');
    grid.innerHTML = '';

    const clientNames = Object.keys(clientGroups);

    if (clientNames.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    } else {
        emptyState.classList.add('hidden');
    }

    // Sort clients based on dropdown selection
    const sortedClients = clientNames.sort((a, b) => {
        const itemsA = clientGroups[a];
        const itemsB = clientGroups[b];
        const totalA = itemsA.reduce((s, d) => s + d.saldo, 0);
        const totalB = itemsB.reduce((s, d) => s + d.saldo, 0);

        switch (currentCardSort) {
            case 'debt-asc': return totalA - totalB;
            case 'name-asc': return a.localeCompare(b, 'pt-BR');
            case 'items-desc': return itemsB.length - itemsA.length;
            case 'debt-desc':
            default:
                return totalB - totalA;
        }
    });

    sortedClients.forEach(clientName => {
        const items = clientGroups[clientName];
        const total = items.reduce((sum, d) => sum + d.saldo, 0);
        const qtd = items.length;

        // Unique products list
        const products = [...new Set(items.map(d => d.produto).filter(Boolean))];

        // Date range
        const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
        const minDate = dates.length ? new Date(Math.min(...dates)) : null;
        const maxDate = dates.length ? new Date(Math.max(...dates)) : null;

        // Ticket Médio
        const avgTicket = qtd > 0 ? total / qtd : 0;

        // Original variations in names
        const originalVariations = [...new Set(items.map(d => d.clienteOriginal).filter(Boolean))];
        const variationsText = originalVariations.length > 1
            ? `(${originalVariations.join(', ')})`
            : '';

        const card = document.createElement('div');
        card.className = 'client-card';
        card.setAttribute('data-client', clientName);
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3 class="card-client-title">${escapeHTML(clientName)}</h3>
                    ${variationsText ? `<div class="card-original-tag" title="Variações no sistema">${escapeHTML(variationsText)}</div>` : ''}
                </div>
                <div class="card-total-badge">${formatBRL(total)}</div>
            </div>

            <div class="card-metrics-row">
                <div class="card-metric">
                    <span class="card-metric-label">Lançamentos</span>
                    <span class="card-metric-value">${qtd}</span>
                </div>
                <div class="card-metric">
                    <span class="card-metric-label">Ticket Médio</span>
                    <span class="card-metric-value">${formatBRL(avgTicket)}</span>
                </div>
                <div class="card-metric">
                    <span class="card-metric-label">Produtos</span>
                    <span class="card-metric-value">${products.length}</span>
                </div>
            </div>

            <div class="card-products-preview">
                <div class="card-products-preview-title">Itens Comprados</div>
                <div class="product-badges">
                    ${products.slice(0, 4).map(p => `<span class="product-pill">${escapeHTML(p)}</span>`).join('')}
                    ${products.length > 4 ? `<span class="product-pill pill-more">+${products.length - 4} itens</span>` : ''}
                </div>
            </div>

            <div class="card-bottom">
                <span>${minDate ? formatDate(minDate.toISOString()) : '—'} até ${maxDate ? formatDate(maxDate.toISOString()) : '—'}</span>
                <span class="card-action-hint">
                    Ver Extrato
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </span>
            </div>
        `;

        card.addEventListener('click', () => openModal(clientName));
        grid.appendChild(card);
    });
}

// ============================================================
// TABLE VIEW (RAW RECORDS)
// ============================================================
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    const sorted = sortData(data, currentSort.key, currentSort.dir);

    sorted.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.cliente)}</strong></td>
            <td><span class="text-muted">${escapeHTML(item.clienteOriginal)}</span></td>
            <td>${escapeHTML(item.produto)}</td>
            <td class="currency-cell">${formatBRL(item.valor)}</td>
            <td class="currency-cell text-accent">${formatBRL(item.saldo)}</td>
            <td>${formatDateTime(item.dataEmissao)}</td>
            <td><code>${escapeHTML(item.codigo)}</code></td>
            <td>${escapeHTML(item.usuario)}</td>
            <td>${escapeHTML(item.parcela)}</td>
            <td>${escapeHTML(item.indice)}</td>
        `;
        tbody.appendChild(tr);
    });

    const total = data.reduce((sum, d) => sum + d.saldo, 0);
    document.getElementById('tableCount').textContent = `${data.length} registros`;
    document.getElementById('tableTotal').textContent = formatBRL(total);
}

function sortData(data, key, dir) {
    return [...data].sort((a, b) => {
        let va, vb;
        switch (key) {
            case 'cliente': va = a.cliente; vb = b.cliente; break;
            case 'clienteOriginal': va = a.clienteOriginal; vb = b.clienteOriginal; break;
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
// CLIENT DETAILS MODAL
// ============================================================
function openModal(clientName) {
    const overlay = document.getElementById('modalOverlay');
    const items = clientGroups[clientName] || [];
    const total = items.reduce((sum, d) => sum + d.saldo, 0);
    const totalValor = items.reduce((sum, d) => sum + d.valor, 0);
    const dates = items.map(d => toDateObj(d.dataEmissao)).filter(Boolean);
    const minDate = dates.length ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length ? new Date(Math.max(...dates)) : null;
    const uniqueProducts = [...new Set(items.map(d => d.produto).filter(Boolean))];

    document.getElementById('modalClientName').textContent = clientName;
    document.getElementById('modalClientSummary').textContent =
        `${items.length} lançamentos • ${uniqueProducts.length} itens distintos • Padaria Divino Pão`;

    // Metrics
    const statsContainer = document.getElementById('modalStats');
    statsContainer.innerHTML = `
        <div class="modal-kpi-card">
            <span class="modal-kpi-label">Saldo a Pagar</span>
            <span class="modal-kpi-value accent">${formatBRL(total)}</span>
        </div>
        <div class="modal-kpi-card">
            <span class="modal-kpi-label">Total Comprado</span>
            <span class="modal-kpi-value">${formatBRL(totalValor)}</span>
        </div>
        <div class="modal-kpi-card">
            <span class="modal-kpi-label">Qtd. Itens</span>
            <span class="modal-kpi-value">${items.length}</span>
        </div>
        <div class="modal-kpi-card">
            <span class="modal-kpi-label">Ticket Médio</span>
            <span class="modal-kpi-value">${formatBRL(items.length > 0 ? total / items.length : 0)}</span>
        </div>
        <div class="modal-kpi-card">
            <span class="modal-kpi-label">Primeiro Fiado</span>
            <span class="modal-kpi-value">${minDate ? formatDate(minDate.toISOString()) : '—'}</span>
        </div>
        <div class="modal-kpi-card">
            <span class="modal-kpi-label">Último Fiado</span>
            <span class="modal-kpi-value">${maxDate ? formatDate(maxDate.toISOString()) : '—'}</span>
        </div>
    `;

    // Granular table
    const tbody = document.getElementById('modalTableBody');
    tbody.innerHTML = '';
    
    // Sort items chronologically
    const sortedItems = [...items].sort((a, b) => {
        const da = toDateObj(a.dataEmissao);
        const db = toDateObj(b.dataEmissao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
    });

    sortedItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.produto)}</strong></td>
            <td>${formatBRL(item.valor)}</td>
            <td class="currency-cell text-accent">${formatBRL(item.saldo)}</td>
            <td>${formatDateTime(item.dataEmissao)}</td>
            <td><code>${escapeHTML(item.codigo)}</code></td>
            <td>${escapeHTML(item.usuario)}</td>
            <td>${escapeHTML(item.parcela)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('modalItemsCount').textContent = `${sortedItems.length} compras listadas`;

    overlay.dataset.currentClient = clientName;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================================
// WHATSAPP BILLING GENERATOR (DIVINO PÃO BRANDED)
// ============================================================
function generateBillingMessage(clientName) {
    const items = clientGroups[clientName] || [];
    const total = items.reduce((sum, d) => sum + d.saldo, 0);

    let text = `🥖 *PADARIA DIVINO PÃO — EXTRATO DE FIADO*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Olá, *${clientName}*! Tudo bem?\n`;
    text += `Segue o demonstrativo dos seus lançamentos em aberto:\n\n`;
    text += `📋 *ITENS REGISTRADOS:*\n`;

    const sortedItems = [...items].sort((a, b) => {
        const da = toDateObj(a.dataEmissao);
        const db = toDateObj(b.dataEmissao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
    });

    sortedItems.forEach((item, i) => {
        text += `▪️ ${item.produto}\n`;
        text += `   ↳ ${formatBRL(item.saldo)} (${formatDate(item.dataEmissao)})\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 *TOTAL A RECEBER: ${formatBRL(total)}*\n`;
    text += `📦 *${items.length} item(ns) no total*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Qualquer dúvida ou para combinarmos o acerto, estamos à disposição!\n`;
    text += `*Padaria Divino Pão* agradece sua preferência! 🙏🥐`;

    return text;
}

function copyBillingText() {
    const overlay = document.getElementById('modalOverlay');
    const clientName = overlay.dataset.currentClient;
    const text = generateBillingMessage(clientName);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Mensagem para WhatsApp copiada com sucesso!');
        }).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Mensagem para WhatsApp copiada!');
}

// ============================================================
// CSV / EXCEL EXPORT (CLIENT & GLOBAL)
// ============================================================
function exportClientCSV() {
    const overlay = document.getElementById('modalOverlay');
    const clientName = overlay.dataset.currentClient;
    const items = clientGroups[clientName] || [];
    const total = items.reduce((sum, d) => sum + d.saldo, 0);

    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += 'Padaria Divino Pão - Extrato de Fiado por QRZ Food\n';
    csv += `Cliente;${clientName}\n\n`;
    csv += 'Produto;Código;Valor Original;Saldo a Pagar;Data/Hora;Atendente;Qtd/Parcela\n';
    
    items.forEach(item => {
        csv += [
            `"${item.produto}"`,
            `"${item.codigo}"`,
            formatBRL(item.valor),
            formatBRL(item.saldo),
            formatDateTime(item.dataEmissao),
            `"${item.usuario}"`,
            `"${item.parcela}"`
        ].join(';') + '\n';
    });
    
    csv += `\n;;TOTAL A PAGAR:;${formatBRL(total)};;;\n`;

    downloadCSV(csv, `divino_pao_fiado_${clientName.replace(/\s+/g, '_').toLowerCase()}.csv`);
    showToast('Extrato do cliente exportado para Excel!');
}

function exportGeneralCSV() {
    const filtered = getFilteredData();
    const total = filtered.reduce((sum, d) => sum + d.saldo, 0);

    let csv = '\uFEFF';
    csv += 'Padaria Divino Pão - Relatório Geral de Fiados (QRZ Food)\n\n';
    csv += 'Cliente Normalizado;Nome Original;Produto;Código;Valor Original;Saldo Atual;Data/Hora;Atendente;Parcela;Índice\n';

    filtered.forEach(item => {
        csv += [
            `"${item.cliente}"`,
            `"${item.clienteOriginal}"`,
            `"${item.produto}"`,
            `"${item.codigo}"`,
            formatBRL(item.valor),
            formatBRL(item.saldo),
            formatDateTime(item.dataEmissao),
            `"${item.usuario}"`,
            `"${item.parcela}"`,
            `"${item.indice}"`
        ].join(';') + '\n';
    });

    csv += `\n;;;TOTAL GERAL:;${formatBRL(total)};;;;;\n`;

    downloadCSV(csv, `divino_pao_relatorio_geral_fiados.csv`);
    showToast('Relatório geral exportado com sucesso!');
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ============================================================
// EVENT LISTENERS INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
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
        activePreset = 'all';
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.preset-chip[data-preset="all"]').classList.add('active');
        applyFilters();
    });

    // Preset chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activePreset = chip.dataset.preset;
            applyFilters();
        });
    });

    // Card sort selector
    document.getElementById('cardSortSelect').addEventListener('change', (e) => {
        currentCardSort = e.target.value;
        renderCards();
    });

    // Live search debounced
    let searchTimer;
    document.getElementById('searchGlobal').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 200);
    });

    // View toggle (Cards vs Table)
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
            document.querySelectorAll('.data-table th.sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
            renderTable(getFilteredData());
        });
    });

    // Modal controls
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('btnFecharModal').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Actions
    document.getElementById('btnCopiarCobranca').addEventListener('click', copyBillingText);
    document.getElementById('btnExportarCliente').addEventListener('click', exportClientCSV);
    document.getElementById('btnExportarGeral').addEventListener('click', exportGeneralCSV);
});
