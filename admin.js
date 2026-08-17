// ============================================================
// QRZ FOOD — ADMIN PANEL (admin.js)
// ============================================================

let currentUploadClient = null;
let processedExcelData = null;

function initAdminLogin() {
    if (sessionStorage.getItem('qrzfood_admin') === 'ok') { showAdminApp(); return; }
    const form = document.getElementById('loginForm');
    const togglePw = document.getElementById('togglePw');
    const pwInput = document.getElementById('loginPassword');
    togglePw.addEventListener('click', () => { pwInput.type = pwInput.type === 'password' ? 'text' : 'password'; });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const pw = document.getElementById('loginPassword').value;
        const hash = await sha256(pw);
        if (email === ADMIN_EMAIL && hash === ADMIN_PASSWORD_HASH) {
            sessionStorage.setItem('qrzfood_admin', 'ok');
            showAdminApp();
        } else {
            document.getElementById('loginError').classList.remove('hidden');
        }
    });
}

function showAdminApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    renderClientCards();
}

function renderClientCards() {
    const grid = document.getElementById('clientsGrid');
    grid.innerHTML = '';

    CLIENTS_CONFIG.forEach(client => {
        // Build the client page URL
        const baseUrl = window.location.href.replace(/\/[^/]*$/, '/');
        const clientUrl = `${baseUrl}cliente.html?c=${client.id}`;

        const card = document.createElement('div');
        card.className = 'client-card';
        card.style.cursor = 'default';
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3 class="card-client-title">${escapeHTML(client.name)}</h3>
                    <span class="card-status-tag tag-pending">${client.id}</span>
                </div>
                <div class="card-total-badge" style="background:${client.color}15;color:${client.color};border-color:${client.color}40;font-size:.85rem">
                    ${escapeHTML(client.shortName)}
                </div>
            </div>

            <div class="card-metrics-row" style="grid-template-columns:1fr">
                <div class="card-metric">
                    <span class="card-metric-label">Link do Cliente (compartilhar)</span>
                    <span class="card-metric-value" style="font-size:.72rem;word-break:break-all;line-height:1.4">${escapeHTML(clientUrl)}</span>
                </div>
            </div>

            <div class="card-bottom" style="gap:.5rem;flex-wrap:wrap;justify-content:center">
                <button class="btn btn-primary btn-sm btn-visit" data-url="${escapeHTML(clientUrl)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                    Abrir Painel
                </button>
                <button class="btn btn-outline btn-sm btn-copy-link" data-url="${escapeHTML(clientUrl)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copiar Link
                </button>
                <button class="btn btn-success btn-sm btn-upload" data-client="${client.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    Upload Excel
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    // Event listeners
    grid.querySelectorAll('.btn-visit').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); window.open(btn.dataset.url, '_blank'); });
    });
    grid.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(btn.dataset.url).then(() => showToast('Link copiado!')).catch(() => showToast('Erro ao copiar'));
        });
    });
    grid.querySelectorAll('.btn-upload').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openUploadModal(btn.dataset.client); });
    });
}

// ============================================================
// UPLOAD & EXCEL PROCESSING
// ============================================================
function openUploadModal(clientId) {
    const client = CLIENTS_CONFIG.find(c => c.id === clientId);
    if (!client) return;
    currentUploadClient = client;
    processedExcelData = null;
    document.getElementById('uploadTitle').textContent = `Upload — ${client.name}`;
    document.getElementById('uploadSubtitle').textContent = `Envie o .xlsx com os dados de fiados de ${client.shortName}`;
    document.getElementById('uploadStatus').classList.add('hidden');
    document.getElementById('btnDownloadData').classList.add('hidden');
    document.getElementById('dropzone').classList.remove('hidden');
    document.getElementById('uploadOverlay').classList.remove('hidden');
}

function closeUploadModal() {
    document.getElementById('uploadOverlay').classList.add('hidden');
    currentUploadClient = null;
    processedExcelData = null;
}

function processExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            // Convert dates to ISO strings
            jsonData.forEach(row => {
                Object.keys(row).forEach(key => {
                    if (row[key] instanceof Date) {
                        row[key] = row[key].toISOString().replace('T', ' ').substring(0, 19);
                    }
                });
            });

            processedExcelData = jsonData;

            document.getElementById('dropzone').classList.add('hidden');
            document.getElementById('uploadStatus').classList.remove('hidden');
            document.getElementById('uploadStatusText').textContent = `✅ ${jsonData.length} registros processados do arquivo "${file.name}"`;
            document.getElementById('btnDownloadData').classList.remove('hidden');
            showToast(`${jsonData.length} registros carregados com sucesso!`);
        } catch (err) {
            console.error(err);
            showToast('Erro ao processar o arquivo. Verifique o formato.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function downloadProcessedData() {
    if (!processedExcelData || !currentUploadClient) return;
    const content = 'const EMBEDDED_DATA = ' + JSON.stringify(processedExcelData, null, 2) + ';\n';
    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentUploadClient.id}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Arquivo ${currentUploadClient.id}.js baixado! Coloque em /data/ e faça o deploy.`);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAdminLogin();

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('btnLogout').addEventListener('click', () => {
        sessionStorage.removeItem('qrzfood_admin');
        document.getElementById('appWrapper').classList.add('hidden');
        document.getElementById('loginOverlay').classList.remove('hidden');
    });

    // Upload modal
    document.getElementById('uploadClose').addEventListener('click', closeUploadModal);
    document.getElementById('btnCloseUpload').addEventListener('click', closeUploadModal);
    document.getElementById('uploadOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeUploadModal(); });

    // Drag & drop
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault(); dropzone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file) processExcelFile(file);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) processExcelFile(fileInput.files[0]);
    });

    // Download processed
    document.getElementById('btnDownloadData').addEventListener('click', downloadProcessedData);
});
