// QRZ Food - Painel Administrativo

let currentClients = [];
let uploadParsedData = null; // Para armazenar dados da planilha durante a criação do cliente
let uploadTargetClientId = null; // Para upload de planilha via modal de upload
let baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupThemeToggle();
    setupLogin();
    setupClientForm();
    setupUploadModal();
    setupBackup();

    await checkAuth();
});

// Autenticação
async function checkAuth() {
    try {
        const { data: { session }, error } = await sb.auth.getSession();
        if (error) throw error;

        if (session) {
            showApp();
        } else {
            showLogin();
        }
    } catch (err) {
        console.error('Erro ao verificar sessão:', err);
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('appWrapper').classList.add('hidden');
}

function showApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    loadClients();
}

function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const togglePw = document.getElementById('togglePw');
    const btnLogout = document.getElementById('btnLogout');

    togglePw.addEventListener('click', () => {
        const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassword.setAttribute('type', type);
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        try {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showApp();
        } catch (err) {
            console.error('Erro no login:', err);
            loginError.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Entrar no Painel';
        }
    });

    btnLogout.addEventListener('click', async () => {
        await sb.auth.signOut();
        showLogin();
    });
}

// Tema
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Gestão de Clientes
async function loadClients() {
    const grid = document.getElementById('clientsGrid');
    grid.innerHTML = '<p>Carregando clientes...</p>';

    try {
        const { data, error } = await sb.from('clients').select('*').order('name');
        if (error) throw error;

        currentClients = data;
        renderClients(data);
    } catch (err) {
        console.error('Erro ao carregar clientes:', err);
        grid.innerHTML = '<p>Erro ao carregar clientes. Tente novamente.</p>';
    }
}

async function renderClients(clients) {
    const grid = document.getElementById('clientsGrid');
    grid.innerHTML = '';

    if (clients.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <h3>Nenhum cliente cadastrado</h3>
                <p>Clique no botao <strong>+ Novo Cliente</strong> acima para criar seu primeiro cliente.</p>
            </div>
        `;
        return;
    }

    for (const client of clients) {
        // Buscar contagem de registros no Supabase
        const { count, error } = await sb.from('records')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id);
        
        const recordCount = error ? 0 : (count || 0);
        const countText = `${recordCount} registros`;
        const clientUrl = `${baseUrl}cliente.html?c=${encodeURIComponent(client.id)}`;
        const clientColor = client.color || '#e8590c';

        const card = document.createElement('div');
        card.className = 'client-card';
        card.style.cursor = 'default';
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3 class="card-client-title">${escapeHTML(client.name)}</h3>
                    <span class="card-status-tag tag-pending">${escapeHTML(client.id)}</span>
                </div>
                <div class="card-total-badge" style="background:${clientColor}15;color:${clientColor};border-color:${clientColor}40;font-size:.85rem">
                    ${escapeHTML(client.short_name)}
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

    // Ações dos botões
    grid.querySelectorAll('.btn-visit').forEach(btn => {
        btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank'));
    });

    grid.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.url);
            showToast('Link copiado!');
        });
    });

    grid.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', () => openEditClient(btn.dataset.id));
    });

    grid.querySelectorAll('.btn-delete-client').forEach(btn => {
        btn.addEventListener('click', () => deleteClient(btn.dataset.id));
    });

    grid.querySelectorAll('.btn-upload-excel').forEach(btn => {
        btn.addEventListener('click', () => openUploadModal(btn.dataset.id, btn.dataset.name));
    });
}

// Formulário de Cliente (Criar/Editar)
function setupClientForm() {
    const modal = document.getElementById('clientFormModal');
    const btnNovo = document.getElementById('btnNovoCliente');
    const btnClose = document.getElementById('closeClientFormModal');
    const btnCancel = document.getElementById('btnCancelClientForm');
    const form = document.getElementById('clientForm');
    
    const inputName = document.getElementById('formClientName');
    const inputShortName = document.getElementById('formClientShortName');
    const inputId = document.getElementById('formClientId');
    const urlPreview = document.getElementById('urlPreviewText');
    const btnGenPassword = document.getElementById('btnGenPassword');
    const inputPassword = document.getElementById('formClientPassword');
    
    const colorDots = document.querySelectorAll('.color-dot');
    const inputColor = document.getElementById('formClientColor');

    // Modal aberto/fechado
    btnNovo.addEventListener('click', () => {
        form.reset();
        document.getElementById('formClientIdOriginal').value = '';
        document.getElementById('clientFormTitle').textContent = 'Novo Cliente';
        document.getElementById('formClientPassword').required = true;
        uploadParsedData = null;
        updateUploadStatusForm();
        updateUrlPreview();
        modal.classList.remove('hidden');
    });

    const closeModal = () => modal.classList.add('hidden');
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    // Auto-fill e URL Preview
    inputName.addEventListener('input', () => {
        if (!document.getElementById('formClientIdOriginal').value) { // Só preenche se for novo
            if (!inputShortName.value || inputShortName.value === slugify(inputName.value, true)) {
                inputShortName.value = inputName.value.split(' ')[0];
            }
            if (!inputId.value || inputId.value === slugify(inputName.value)) {
                inputId.value = slugify(inputName.value);
                updateUrlPreview();
            }
        }
    });

    inputId.addEventListener('input', updateUrlPreview);

    function updateUrlPreview() {
        urlPreview.textContent = `.../cliente.html?c=${inputId.value}`;
    }

    // Gerar Senha
    btnGenPassword.addEventListener('click', () => {
        const short = inputShortName.value || 'Cliente';
        const year = new Date().getFullYear();
        inputPassword.value = `${short}@${year}`;
    });

    // Cores
    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            inputColor.value = dot.dataset.color;
        });
    });

    inputColor.addEventListener('input', () => {
        colorDots.forEach(d => d.classList.remove('active'));
    });

    // Planilha (no form de criação)
    const dropzone = document.getElementById('formDropzone');
    const fileInput = document.getElementById('formFileInput');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary-color)'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-color)');
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length) handleFileSelectForm(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelectForm(e.target.files[0]);
    });

    // Salvar
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btnSaveClient');
        btnSave.disabled = true;
        btnSave.textContent = 'Salvando...';

        try {
            const inputEmail = document.getElementById('formClientEmail');
            const clientData = {
                id: inputId.value.trim(),
                name: inputName.value.trim(),
                short_name: inputShortName.value.trim(),
                email: inputEmail ? inputEmail.value.trim() : '',
                color: inputColor.value
            };

            if (inputPassword.value) {
                clientData.password_hash = await sha256(inputPassword.value);
            }

            if (isEdit) {
                const { error } = await sb.from('clients').update(clientData).eq('id', originalId);
                if (error) throw error;
                showToast('Cliente atualizado!');
            } else {
                clientData.name_map = {}; // default
                const { error } = await sb.from('clients').insert([clientData]);
                if (error) throw error;
                showToast('Cliente criado!');

                if (uploadParsedData && uploadParsedData.length > 0) {
                    await processAndUploadRecords(clientData.id, uploadParsedData, {});
                }
            }

            closeModal();
            loadClients();
        } catch (err) {
            console.error(err);
            showToast('Erro ao salvar cliente');
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar Cliente';
        }
    });
}

function openEditClient(id) {
    const client = currentClients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('formClientIdOriginal').value = client.id;
    document.getElementById('formClientName').value = client.name;
    document.getElementById('formClientShortName').value = client.short_name;
    document.getElementById('formClientId').value = client.id;
    
    const inputEmail = document.getElementById('formClientEmail');
    if (inputEmail) inputEmail.value = client.email || '';
    
    document.getElementById('urlPreviewText').textContent = `.../cliente.html?c=${client.id}`;
    
    document.getElementById('formClientPassword').value = '';
    document.getElementById('formClientPassword').required = false; // Opcional na edição
    
    document.getElementById('formClientColor').value = client.color || '#e8590c';
    document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === client.color);
    });

    document.getElementById('clientFormTitle').textContent = 'Editar Cliente';
    uploadParsedData = null;
    updateUploadStatusForm();

    document.getElementById('clientFormModal').classList.remove('hidden');
}

async function deleteClient(id) {
    if (!confirm(`Tem certeza que deseja excluir o cliente ${id} e todos os seus dados?`)) return;
    
    try {
        const { error } = await sb.from('clients').delete().eq('id', id);
        if (error) throw error;
        showToast('Cliente excluído!');
        loadClients();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir cliente');
    }
}

// Upload de Planilha (No form)
function handleFileSelectForm(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet);
            uploadParsedData = json;
            updateUploadStatusForm();
        } catch (err) {
            console.error(err);
            showToast('Erro ao ler arquivo Excel');
        }
    };
    reader.readAsArrayBuffer(file);
}

function updateUploadStatusForm() {
    const status = document.getElementById('formUploadStatus');
    const text = document.getElementById('formUploadStatusText');
    const dropzone = document.getElementById('formDropzone');

    if (uploadParsedData) {
        dropzone.classList.add('hidden');
        status.classList.remove('hidden');
        text.textContent = `${uploadParsedData.length} registros prontos para envio.`;
    } else {
        dropzone.classList.remove('hidden');
        status.classList.add('hidden');
        document.getElementById('formFileInput').value = '';
    }
}

// Upload de Planilha (Modal avulso)
function setupUploadModal() {
    const modal = document.getElementById('uploadOverlay');
    const btnClose = document.getElementById('uploadClose');
    const btnClose2 = document.getElementById('btnCloseUpload');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    const closeModal = () => modal.classList.add('hidden');
    btnClose.addEventListener('click', closeModal);
    btnClose2.addEventListener('click', closeModal);

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary-color)'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-color)');
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length) handleFileUploadAvulso(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileUploadAvulso(e.target.files[0]);
    });
}

function openUploadModal(clientId, clientName) {
    uploadTargetClientId = clientId;
    document.getElementById('uploadSubtitle').textContent = `Cliente: ${clientName}`;
    document.getElementById('uploadOverlay').classList.remove('hidden');
    document.getElementById('uploadStatus').classList.add('hidden');
    document.getElementById('dropzone').classList.remove('hidden');
    document.getElementById('fileInput').value = '';
}

function handleFileUploadAvulso(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            document.getElementById('dropzone').classList.add('hidden');
            const status = document.getElementById('uploadStatus');
            const statusText = document.getElementById('uploadStatusText');
            status.classList.remove('hidden');
            statusText.textContent = 'Processando arquivo...';

            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array', cellDates: true});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet);

            // Fetch name_map
            const client = currentClients.find(c => c.id === uploadTargetClientId);
            const nameMap = client ? (client.name_map || {}) : {};

            await processAndUploadRecords(uploadTargetClientId, json, nameMap);
            
            statusText.textContent = `${json.length} registros atualizados com sucesso!`;
            showToast('Planilha atualizada!');
            loadClients(); // Atualiza contagem
        } catch (err) {
            console.error(err);
            document.getElementById('uploadStatusText').textContent = 'Erro ao processar planilha.';
        }
    };
    reader.readAsArrayBuffer(file);
}

// Processamento de registros
function normalizeName(name, nameMap) {
    if (!name) return '';
    name = name.trim();
    return nameMap[name.toLowerCase()] || nameMap[name] || name.toUpperCase();
}

async function processAndUploadRecords(clientId, parsedData, nameMap) {
    const batchId = `upload_${Date.now()}`;
    
    const rows = parsedData.map(row => {
        // Conversão de data (trata se já for objeto Date ou string)
        let dataEmi = null;
        if (row.dataemi instanceof Date) {
            dataEmi = row.dataemi.toISOString();
        } else if (typeof row.dataemi === 'string') {
            dataEmi = new Date(row.dataemi.replace(' ', 'T')).toISOString();
        }

        return {
            client_id: clientId,
            indice: parseInt(row.indice) || null,
            banco: (row.banco || '').toString().trim(),
            banco_normalized: normalizeName((row.banco || '').toString(), nameMap),
            fatura: (row.fatura || row.portador || '').toString().trim(),
            historico: (row.historico || '').toString().trim(),
            valor: parseDecimal(row.valor),
            saldo_atual: parseDecimal(row.saldoatual),
            data_emissao: dataEmi,
            usuario: (row.usuarioatual || '').toString().trim(),
            parcela: (row.parcela || '').toString().trim(),
            batch: batchId
        };
    });

    // Upsert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await sb.from('records').upsert(batch, { onConflict: 'client_id,indice' });
        if (error) throw error;
    }

    // Insert log
    await sb.from('import_logs').insert([{
        client_id: clientId,
        filename: batchId,
        record_count: rows.length,
        imported_by: 'admin'
    }]);
}

// Backup
function setupBackup() {
    const btnBackup = document.getElementById('btnBackup');
    if (!btnBackup) return;

    btnBackup.addEventListener('click', async () => {
        btnBackup.disabled = true;
        btnBackup.textContent = 'Gerando...';
        
        try {
            const { data: clients, error: errC } = await sb.from('clients').select('*');
            if (errC) throw errC;

            const { data: records, error: errR } = await sb.from('records').select('*');
            if (errR) throw errR;

            const backupData = {
                timestamp: new Date().toISOString(),
                clients,
                records
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `qrzfood_backup_${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('Backup gerado com sucesso!');
        } catch (err) {
            console.error('Erro no backup:', err);
            showToast('Erro ao gerar backup');
        } finally {
            btnBackup.disabled = false;
            btnBackup.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Backup`;
        }
    });
}
