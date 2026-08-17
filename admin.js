// ============================================================
// QRZ FOOD — PAINEL ADMINISTRATIVO (admin.js)
// Gestão completa de clientes, senhas e planilhas via interface
// ============================================================

let allClients = [];
let currentUploadClientId = null;
let newClientExcelData = null;

// ============================================================
// INICIALIZAÇÃO & LOGIN
// ============================================================
async function initAdminLogin() {
    if (sessionStorage.getItem('qrzfood_admin') === 'ok') {
        showAdminApp();
        return;
    }

    const form = document.getElementById('loginForm');
    const togglePw = document.getElementById('togglePw');
    const pwInput = document.getElementById('loginPassword');

    togglePw.addEventListener('click', () => {
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    });

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
            pwInput.value = '';
            pwInput.focus();
        }
    });
}

async function showAdminApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    await checkInitialSeed();
    await loadAndRenderClients();
}

// Inicializa a base inicial do Divino Pão caso o banco esteja novo
async function checkInitialSeed() {
    try {
        const existing = await dbGetClient('divino-pao');
        if (!existing) {
            await dbSaveClient({
                id: 'divino-pao',
                name: 'Padaria Divino Pão',
                shortName: 'Divino Pão',
                passwordHash: 'a534e5db0a1c9a7ed4e97ee451f0b3dae7dd0fa6b6686f777b27fcfb86607157',
                color: '#e8590c',
                dataFile: 'data/divino-pao.js'
            });
        }
    } catch (e) {
        console.error('Seed error:', e);
    }
}

// ============================================================
// RENDERIZAÇÃO DOS CLIENTES
// ============================================================
async function loadAndRenderClients() {
    allClients = await dbGetAllClients();
    const grid = document.getElementById('clientsGrid');
    grid.innerHTML = '';

    if (!allClients.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <h3>Nenhum cliente cadastrado</h3>
                <p>Clique no botão <strong>+ Novo Cliente</strong> acima para criar seu primeiro cliente.</p>
            </div>
        `;
        return;
    }

    const baseUrl = window.location.href.replace(/\/[^/]*$/, '/');

    for (const client of allClients) {
        const clientUrl = `${baseUrl}cliente.html?c=${encodeURIComponent(client.id)}`;
        
        // Verifica se há dados no IndexedDB ou se usa arquivo estático
        let countText = 'Planilha vinculada';
        try {
            const data = await dbGetClientData(client.id);
            if (data && data.length) {
                countText = `${data.length} registros`;
            } else if (client.id === 'divino-pao') {
                countText = `587 registros (padrão)`;
            } else {
                countText = 'Sem planilha';
            }
        } catch {}

        const card = document.createElement('div');
        card.className = 'client-card';
        card.style.cursor = 'default';
        const clientColor = client.color || '#e8590c';

        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3 class="card-client-title">${escapeHTML(client.name)}</h3>
                    <span class="card-status-tag tag-pending">${escapeHTML(client.id)}</span>
                </div>
                <div class="card-total-badge" style="background:${clientColor}15;color:${clientColor};border-color:${clientColor}40;font-size:.85rem">
                    ${escapeHTML(client.shortName)}
                </div>
            </div>

            <div class="card-metrics-row" style="grid-template-columns:1fr 1fr;margin-bottom:0.75rem">
                <div class="card-metric">
                    <span class="card-metric-label">Status da Base</span>
                    <span class="card-metric-value" style="font-size:0.82rem;font-weight:700">${countText}</span>
                </div>
                <div class="card-metric">
                    <span class="card-metric-label">Acesso</span>
                    <span class="card-metric-value" style="font-size:0.82rem;color:var(--green)">Protegido por Senha</span>
                </div>
            </div>

            <div class="url-preview-box" style="margin-bottom:1rem">
                <span class="url-preview-label">Link do Cliente:</span>
                <code style="word-break:break-all">${escapeHTML(clientUrl)}</code>
            </div>

            <div class="card-bottom" style="gap:.45rem;flex-wrap:wrap;justify-content:space-between">
                <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                    <button class="btn btn-primary btn-sm btn-visit" data-url="${escapeHTML(clientUrl)}" title="Abrir painel em nova aba">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                        Abrir
                    </button>
                    <button class="btn btn-outline btn-sm btn-copy-link" data-url="${escapeHTML(clientUrl)}" title="Copiar link para enviar ao cliente">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        Copiar Link
                    </button>
                </div>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                    <button class="btn btn-success btn-sm btn-upload-excel" data-id="${escapeHTML(client.id)}" data-name="${escapeHTML(client.name)}" title="Subir nova planilha Excel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        Planilha
                    </button>
                    <button class="btn btn-secondary btn-sm btn-edit-client" data-id="${escapeHTML(client.id)}" title="Editar dados e senha">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-outline btn-sm btn-delete-client" data-id="${escapeHTML(client.id)}" data-name="${escapeHTML(client.name)}" title="Excluir cliente" style="color:var(--red)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    }

    // Eventos dos botões dos cards
    grid.querySelectorAll('.btn-visit').forEach(btn => {
        btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank'));
    });
    grid.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.url).then(() => showToast('Link copiado com sucesso!'));
        });
    });
    grid.querySelectorAll('.btn-upload-excel').forEach(btn => {
        btn.addEventListener('click', () => openUploadModal(btn.dataset.id, btn.dataset.name));
    });
    grid.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', () => openEditClientModal(btn.dataset.id));
    });
    grid.querySelectorAll('.btn-delete-client').forEach(btn => {
        btn.addEventListener('click', () => deleteClientAction(btn.dataset.id, btn.dataset.name));
    });
}

// ============================================================
// MODAL: CRIAR / EDITAR CLIENTE
// ============================================================
function openNewClientModal() {
    document.getElementById('clientFormTitle').textContent = 'Novo Cliente';
    document.getElementById('formClientIdOriginal').value = '';
    document.getElementById('formClientName').value = '';
    document.getElementById('formClientShortName').value = '';
    document.getElementById('formClientId').value = '';
    document.getElementById('formClientId').disabled = false;
    document.getElementById('formClientPassword').value = '';
    document.getElementById('formClientColor').value = '#e8590c';
    
    document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === '#e8590c');
    });

    newClientExcelData = null;
    document.getElementById('formDropzone').classList.remove('hidden');
    document.getElementById('formUploadStatus').classList.add('hidden');
    document.getElementById('formUploadText').textContent = 'Clique ou arraste o .xlsx aqui';
    updateUrlPreview('');

    document.getElementById('clientFormModal').classList.remove('hidden');
    document.getElementById('formClientName').focus();
}

async function openEditClientModal(clientId) {
    const client = await dbGetClient(clientId);
    if (!client) return;

    document.getElementById('clientFormTitle').textContent = `Editar — ${client.name}`;
    document.getElementById('formClientIdOriginal').value = client.id;
    document.getElementById('formClientName').value = client.name;
    document.getElementById('formClientShortName').value = client.shortName;
    document.getElementById('formClientId').value = client.id;
    document.getElementById('formClientId').disabled = true; // não muda id na edição
    document.getElementById('formClientPassword').value = '';
    document.getElementById('formClientPassword').placeholder = '(Deixe em branco para manter a senha atual)';
    document.getElementById('formClientColor').value = client.color || '#e8590c';

    document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === (client.color || '#e8590c'));
    });

    newClientExcelData = null;
    document.getElementById('formDropzone').classList.remove('hidden');
    document.getElementById('formUploadStatus').classList.add('hidden');
    document.getElementById('formUploadText').textContent = 'Substituir planilha (opcional)';
    updateUrlPreview(client.id);

    document.getElementById('clientFormModal').classList.remove('hidden');
}

function closeClientFormModal() {
    document.getElementById('clientFormModal').classList.add('hidden');
    newClientExcelData = null;
}

function updateUrlPreview(slug) {
    const baseUrl = window.location.href.replace(/\/[^/]*$/, '/');
    document.getElementById('urlPreviewText').textContent = `${baseUrl}cliente.html?c=${slug || 'identificador'}`;
}

// Salvar Cliente (Criar ou Editar)
async function handleClientFormSubmit(e) {
    e.preventDefault();

    const originalId = document.getElementById('formClientIdOriginal').value;
    const isEdit = !!originalId;
    const name = document.getElementById('formClientName').value.trim();
    const shortName = document.getElementById('formClientShortName').value.trim();
    const id = (isEdit ? originalId : document.getElementById('formClientId').value.trim()).toLowerCase();
    const password = document.getElementById('formClientPassword').value;
    const color = document.getElementById('formClientColor').value;

    if (!name || !shortName || !id) {
        showToast('Preencha os campos obrigatórios.');
        return;
    }

    let passwordHash = '';
    if (password) {
        passwordHash = await sha256(password);
    } else if (isEdit) {
        const existing = await dbGetClient(originalId);
        passwordHash = existing ? existing.passwordHash : '';
    } else {
        showToast('Defina uma senha para o cliente.');
        return;
    }

    const clientObj = {
        id,
        name,
        shortName,
        passwordHash,
        color
    };

    await dbSaveClient(clientObj);

    // Se uma planilha foi anexada no modal
    if (newClientExcelData && newClientExcelData.length) {
        await dbSaveClientData(id, newClientExcelData);
    }

    closeClientFormModal();
    await loadAndRenderClients();
    showToast(`Cliente ${shortName} salvo com sucesso!`);
}

// Excluir Cliente
async function deleteClientAction(clientId, clientName) {
    if (confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?\nTodos os dados de fiados e acessos serão removidos.`)) {
        await dbDeleteClient(clientId);
        await loadAndRenderClients();
        showToast(`Cliente "${clientName}" excluído.`);
    }
}

// ============================================================
// MODAL: UPLOAD DE PLANILHA EM CLIENTE EXISTENTE
// ============================================================
function openUploadModal(clientId, clientName) {
    currentUploadClientId = clientId;
    document.getElementById('uploadTitle').textContent = `Atualizar Planilha — ${clientName}`;
    document.getElementById('uploadSubtitle').textContent = `Envie o .xlsx para atualizar a base de dados de ${clientName}`;
    document.getElementById('uploadStatus').classList.add('hidden');
    document.getElementById('dropzone').classList.remove('hidden');
    document.getElementById('uploadOverlay').classList.remove('hidden');
}

function closeUploadModal() {
    document.getElementById('uploadOverlay').classList.add('hidden');
    currentUploadClientId = null;
}

// Leitura de Excel universal via XLSX.js
function parseExcelFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            jsonData.forEach(row => {
                Object.keys(row).forEach(key => {
                    if (row[key] instanceof Date) {
                        row[key] = row[key].toISOString().replace('T', ' ').substring(0, 19);
                    }
                });
            });

            onSuccess(jsonData);
        } catch (err) {
            console.error(err);
            showToast('Erro ao ler a planilha. Verifique o formato do arquivo.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
// BACKUP & RESTORE
// ============================================================
async function exportFullBackup() {
    const clients = await dbGetAllClients();
    const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        clients: []
    };

    for (const c of clients) {
        const rows = await dbGetClientData(c.id);
        backupData.clients.push({
            metadata: c,
            rows: rows || []
        });
    }

    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrzfood_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso!');
}

// ============================================================
// EVENT LISTENERS GLOBAIS
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

    // Abrir Modal Novo Cliente
    document.getElementById('btnNovoCliente').addEventListener('click', openNewClientModal);
    document.getElementById('closeClientFormModal').addEventListener('click', closeClientFormModal);
    document.getElementById('btnCancelClientForm').addEventListener('click', closeClientFormModal);
    document.getElementById('clientFormModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeClientFormModal();
    });

    // Auto slug e geração de nome curto
    document.getElementById('formClientName').addEventListener('input', e => {
        const val = e.target.value;
        const originalId = document.getElementById('formClientIdOriginal').value;
        if (!originalId) {
            const slug = slugify(val);
            document.getElementById('formClientId').value = slug;
            updateUrlPreview(slug);

            if (!document.getElementById('formClientShortName').value || document.getElementById('formClientShortName').value === val.slice(0, -1)) {
                document.getElementById('formClientShortName').value = val.split(' ')[0];
            }
        }
    });

    document.getElementById('formClientId').addEventListener('input', e => {
        const slug = slugify(e.target.value);
        e.target.value = slug;
        updateUrlPreview(slug);
    });

    // Gerador de senha amigável
    document.getElementById('btnGenPassword').addEventListener('click', () => {
        const shortName = document.getElementById('formClientShortName').value.trim() || 'Cliente';
        const cleanName = shortName.replace(/[^a-zA-Z]/g, '');
        const year = new Date().getFullYear();
        const gen = `${cleanName}@${year}`;
        document.getElementById('formClientPassword').value = gen;
        showToast(`Senha gerada: ${gen}`);
    });

    // Seletor de cores
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            document.getElementById('formClientColor').value = dot.dataset.color;
        });
    });
    document.getElementById('formClientColor').addEventListener('input', e => {
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    });

    // Upload de Excel dentro do formulário do cliente
    const formDropzone = document.getElementById('formDropzone');
    const formFileInput = document.getElementById('formFileInput');

    formDropzone.addEventListener('click', () => formFileInput.click());
    formDropzone.addEventListener('dragover', e => { e.preventDefault(); formDropzone.style.borderColor = 'var(--accent)'; });
    formDropzone.addEventListener('dragleave', () => { formDropzone.style.borderColor = ''; });
    formDropzone.addEventListener('drop', e => {
        e.preventDefault();
        formDropzone.style.borderColor = '';
        if (e.dataTransfer.files[0]) {
            parseExcelFile(e.dataTransfer.files[0], rows => {
                newClientExcelData = rows;
                formDropzone.classList.add('hidden');
                document.getElementById('formUploadStatus').classList.remove('hidden');
                document.getElementById('formUploadStatusText').textContent = `✅ ${rows.length} registros prontos para salvar`;
                showToast(`${rows.length} registros lidos da planilha!`);
            });
        }
    });
    formFileInput.addEventListener('change', () => {
        if (formFileInput.files[0]) {
            parseExcelFile(formFileInput.files[0], rows => {
                newClientExcelData = rows;
                formDropzone.classList.add('hidden');
                document.getElementById('formUploadStatus').classList.remove('hidden');
                document.getElementById('formUploadStatusText').textContent = `✅ ${rows.length} registros prontos para salvar`;
                showToast(`${rows.length} registros lidos da planilha!`);
            });
        }
    });

    // Submissão do formulário do cliente
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);

    // Modal de Upload Direto em cliente existente
    const uploadOverlay = document.getElementById('uploadOverlay');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    document.getElementById('uploadClose').addEventListener('click', closeUploadModal);
    document.getElementById('btnCloseUpload').addEventListener('click', closeUploadModal);
    uploadOverlay.addEventListener('click', e => { if (e.target === e.currentTarget) closeUploadModal(); });

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        if (e.dataTransfer.files[0] && currentUploadClientId) {
            parseExcelFile(e.dataTransfer.files[0], async rows => {
                await dbSaveClientData(currentUploadClientId, rows);
                dropzone.classList.add('hidden');
                document.getElementById('uploadStatus').classList.remove('hidden');
                document.getElementById('uploadStatusText').textContent = `✅ ${rows.length} registros atualizados com sucesso!`;
                await loadAndRenderClients();
                showToast(`${rows.length} registros atualizados!`);
            });
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0] && currentUploadClientId) {
            parseExcelFile(fileInput.files[0], async rows => {
                await dbSaveClientData(currentUploadClientId, rows);
                dropzone.classList.add('hidden');
                document.getElementById('uploadStatus').classList.remove('hidden');
                document.getElementById('uploadStatusText').textContent = `✅ ${rows.length} registros atualizados com sucesso!`;
                await loadAndRenderClients();
                showToast(`${rows.length} registros atualizados!`);
            });
        }
    });

    // Backup
    document.getElementById('btnBackup').addEventListener('click', exportFullBackup);
});
