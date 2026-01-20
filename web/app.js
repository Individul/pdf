/**
 * PDF Toolbox - Frontend Profesional
 * Instrumente PDF simple cu interfață modal
 */

// ============================================================================
// CONFIGURARE
// ============================================================================

const CONFIG = {
    MAX_FILE_SIZE: 100 * 1024 * 1024,      // 100 MB
    MAX_MERGE_FILES: 20,
    API_ENDPOINTS: {
        merge: '/api/merge',
        delete: '/api/delete-pages',
        extract: '/api/extract-pages'
    }
};

// ============================================================================
// STARE
// ============================================================================

const state = {
    currentTool: null,
    mergeFiles: [],
    selectedFile: null,
    isDarkMode: false,
    dragSrcEl: null
};

// ============================================================================
// ELEMENTE DOM
// ============================================================================

const DOM = {
    // Temă
    themeToggle: document.getElementById('theme-toggle'),
    html: document.documentElement,

    // Modal
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalDescription: document.getElementById('modal-description'),

    // Upload
    uploadZone: document.getElementById('upload-zone'),
    fileInput: document.getElementById('file-input'),
    uploadHint: document.getElementById('upload-hint'),

    // Afișare fișiere
    fileList: document.getElementById('file-list'),
    fileDisplay: document.getElementById('file-display'),
    selectedFilename: document.getElementById('selected-filename'),

    // Specificare pagini
    pagesSpecContainer: document.getElementById('pages-spec-container'),
    pagesSpecLabel: document.getElementById('pages-spec-label'),
    pagesSpecInput: document.getElementById('pages-spec-input'),

    // Acțiuni
    actionBtn: document.getElementById('action-btn'),

    // Status
    statusMessage: document.getElementById('status-message'),

    // Încărcare
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ============================================================================
// CONFIGURARE UNelte
// ============================================================================

const TOOLS = {
    merge: {
        title: 'Unește PDF-uri',
        description: 'Combină mai multe fișiere PDF într-un singur document.',
        actionLabel: 'Unește',
        multipleFiles: true,
        showPagesSpec: false,
        uploadHint: `Până la ${CONFIG.MAX_MERGE_FILES} fișiere, 100 MB fiecare`
    },
    delete: {
        title: 'Șterge Pagini',
        description: 'Elimină pagini specifice din PDF-ul tău.',
        actionLabel: 'Șterge & Descarcă',
        multipleFiles: false,
        showPagesSpec: true,
        pagesSpecLabel: 'Paginile de șters',
        uploadHint: 'Maximum 100 MB'
    },
    extract: {
        title: 'Extrage Pagini',
        description: 'Creează un PDF nou cu paginile selectate.',
        actionLabel: 'Extrage & Descarcă',
        multipleFiles: false,
        showPagesSpec: true,
        pagesSpecLabel: 'Paginile de extras',
        uploadHint: 'Maximum 100 MB'
    }
};

// ============================================================================
// FUNCȚII UTILITARE
// ============================================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// MANAGEMENT TEMĂ
// ============================================================================

function initTheme() {
    const saved = localStorage.getItem('pdf-toolbox-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.isDarkMode = saved === 'dark' || (!saved && prefersDark);
    applyTheme();
}

function applyTheme() {
    if (state.isDarkMode) {
        DOM.html.classList.add('dark');
    } else {
        DOM.html.classList.remove('dark');
    }
}

function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    localStorage.setItem('pdf-toolbox-theme', state.isDarkMode ? 'dark' : 'light');
    applyTheme();
}

// ============================================================================
// MANAGEMENT MODAL
// ============================================================================

function openModal(tool) {
    state.currentTool = tool;
    const config = TOOLS[tool];

    // Actualizează conținutul modalului
    DOM.modalTitle.textContent = config.title;
    DOM.modalDescription.textContent = config.description;
    DOM.actionBtn.textContent = config.actionLabel;
    DOM.uploadHint.textContent = config.uploadHint;

    // Reset input fișier
    DOM.fileInput.value = '';
    DOM.fileInput.multiple = config.multipleFiles;

    // Reset stare
    if (tool === 'merge') {
        state.mergeFiles = [];
        DOM.fileList.classList.add('hidden');
        DOM.fileDisplay.classList.add('hidden');
    } else {
        state.selectedFile = null;
        DOM.fileList.classList.add('hidden');
        DOM.fileDisplay.classList.add('hidden');
    }

    // Specificare pagini
    if (config.showPagesSpec) {
        DOM.pagesSpecContainer.classList.remove('hidden');
        DOM.pagesSpecLabel.textContent = config.pagesSpecLabel;
        DOM.pagesSpecInput.value = '';
    } else {
        DOM.pagesSpecContainer.classList.add('hidden');
    }

    // Ascunde status
    hideStatus();

    // Actualizează butonul
    updateActionButton();

    // Afișează modalul
    DOM.modalOverlay.classList.remove('hidden');
    DOM.modalOverlay.classList.add('flex');

    // Focus pe zona de upload după animație
    setTimeout(() => DOM.uploadZone.focus(), 100);
}

function closeModal() {
    DOM.modalOverlay.classList.add('hidden');
    DOM.modalOverlay.classList.remove('flex');
    state.currentTool = null;
}

// ============================================================================
// VALIDARE FIȘIERE
// ============================================================================

function validatePDFFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        throw new Error('Te rog selectează un fișier PDF valid.');
    }
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        throw new Error(`Fișier prea mare. Dimensiune maximă: ${formatFileSize(CONFIG.MAX_FILE_SIZE)}.`);
    }
    return true;
}

// ============================================================================
// MANAGEMENT INCĂRCARE FIȘIERE
// ============================================================================

function handleFiles(files) {
    hideStatus();
    const tool = state.currentTool;
    const config = TOOLS[tool];

    try {
        if (tool === 'merge') {
            handleMergeFiles(files);
        } else {
            handleSingleFile(files[0]);
        }
    } catch (err) {
        showStatus(err.message, 'error');
    }

    updateActionButton();
}

function handleMergeFiles(files) {
    const fileArray = Array.from(files);

    // Validează toate fișierele
    for (const file of fileArray) {
        validatePDFFile(file);
    }

    // Verifică numărul
    if (state.mergeFiles.length + fileArray.length > CONFIG.MAX_MERGE_FILES) {
        throw new Error(`Maximum ${CONFIG.MAX_MERGE_FILES} fișiere permise.`);
    }

    // Adaugă fișierele
    state.mergeFiles.push(...fileArray);
    renderFileList();
}

function handleSingleFile(file) {
    validatePDFFile(file);
    state.selectedFile = file;
    renderSelectedFile();
}

function renderFileList() {
    if (state.mergeFiles.length === 0) {
        DOM.fileList.classList.add('hidden');
        return;
    }

    DOM.fileList.classList.remove('hidden');
    DOM.fileList.innerHTML = state.mergeFiles.map((file, index) => `
        <div class="file-item rounded-input p-3 flex items-center gap-3 cursor-move"
             data-index="${index}"
             draggable="true">
            <span class="page-badge w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                ${index + 1}
            </span>
            <svg class="w-4 h-4 flex-shrink-0" style="color: var(--color-text-muted);"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16"/>
            </svg>
            <svg class="w-5 h-5 flex-shrink-0" style="color: var(--color-error);"
                 fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
            </svg>
            <span class="flex-1 text-sm truncate" style="color: var(--color-text);">${escapeHtml(file.name)}</span>
            <span class="text-xs flex-shrink-0" style="color: var(--color-text-muted);">
                ${formatFileSize(file.size)}
            </span>
            <button class="remove-file p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                    data-index="${index}"
                    aria-label="Elimină fișierul">
                <svg class="w-3.5 h-3.5" style="color: var(--color-error);"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Setup drag and drop
    setupFileDragDrop();

    // Setup butoane de eliminare
    DOM.fileList.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.currentTarget.dataset.index);
            state.mergeFiles.splice(index, 1);
            renderFileList();
            updateActionButton();
        });
    });
}

function setupFileDragDrop() {
    const items = DOM.fileList.querySelectorAll('.file-item');

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            state.dragSrcEl = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(item.dataset.index));
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            items.forEach(i => i.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (item !== state.dragSrcEl) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (state.dragSrcEl && state.dragSrcEl !== item) {
                const fromIndex = parseInt(state.dragSrcEl.dataset.index);
                const toIndex = parseInt(item.dataset.index);
                const [moved] = state.mergeFiles.splice(fromIndex, 1);
                state.mergeFiles.splice(toIndex, 0, moved);
                renderFileList();
            }
        });
    });
}

function renderSelectedFile() {
    if (!state.selectedFile) {
        DOM.fileDisplay.classList.add('hidden');
        return;
    }

    DOM.fileDisplay.classList.remove('hidden');
    DOM.selectedFilename.textContent = state.selectedFile.name;
}

function clearSelectedFile() {
    state.selectedFile = null;
    DOM.fileInput.value = '';
    renderSelectedFile();
    updateActionButton();
}

// ============================================================================
// EVENIMENTE ZONĂ INCĂRCARE
// ============================================================================

function setupUploadZone() {
    // Click pentru a deschide dialogul de fișiere
    DOM.uploadZone.addEventListener('click', () => {
        DOM.fileInput.click();
    });

    // Schimbare input fișier
    DOM.fileInput.addEventListener('change', () => {
        if (DOM.fileInput.files.length > 0) {
            handleFiles(DOM.fileInput.files);
        }
    });

    // Evenimente drag
    DOM.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.uploadZone.classList.add('drag-over');
    });

    DOM.uploadZone.addEventListener('dragleave', () => {
        DOM.uploadZone.classList.remove('drag-over');
    });

    DOM.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Previne comportamentul default pentru drag pe document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// ============================================================================
// MANAGEMENT ACȚIUNI
// ============================================================================

function updateActionButton() {
    const tool = state.currentTool;
    let enabled = false;

    if (tool === 'merge') {
        enabled = state.mergeFiles.length >= 2;
    } else {
        enabled = state.selectedFile !== null && DOM.pagesSpecInput.value.trim() !== '';
    }

    DOM.actionBtn.disabled = !enabled;
}

function handlePagesSpecInput() {
    updateActionButton();
}

async function processAction() {
    const tool = state.currentTool;
    if (!tool) return;

    hideStatus();
    showLoading();

    try {
        let response;
        const config = TOOLS[tool];

        if (tool === 'merge') {
            response = await mergePDFs();
        } else {
            const pagesSpec = DOM.pagesSpecInput.value.trim();
            if (tool === 'delete') {
                response = await deletePages(pagesSpec);
            } else {
                response = await extractPages(pagesSpec);
            }
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Procesarea a eșuat. Te rog încearcă din nou.');
        }

        // Obține numele fișierului din headere
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = tool === 'merge' ? 'unit.pdf' :
                       tool === 'delete' ? 'modificat.pdf' : 'extras.pdf';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        // Descarcă fișierul
        const blob = await response.blob();
        downloadBlob(blob, filename);

        // Afișează succes și închide modalul
        showToast(`${config.title} finalizat cu succes`, 'success');

        if (tool === 'merge') {
            state.mergeFiles = [];
            renderFileList();
        } else {
            state.selectedFile = null;
            DOM.pagesSpecInput.value = '';
            renderSelectedFile();
        }

        updateActionButton();
        setTimeout(closeModal, 1500);

    } catch (err) {
        showStatus(err.message, 'error');
        showToast(err.message, 'error');
    } finally {
        hideLoading();
    }
}

async function mergePDFs() {
    const formData = new FormData();
    state.mergeFiles.forEach(file => {
        formData.append('files', file);
    });
    return fetch(CONFIG.API_ENDPOINTS.merge, {
        method: 'POST',
        body: formData
    });
}

async function deletePages(pagesSpec) {
    const formData = new FormData();
    formData.append('file', state.selectedFile);
    formData.append('pages_spec', pagesSpec);
    return fetch(CONFIG.API_ENDPOINTS.delete, {
        method: 'POST',
        body: formData
    });
}

async function extractPages(pagesSpec) {
    const formData = new FormData();
    formData.append('file', state.selectedFile);
    formData.append('pages_spec', pagesSpec);
    return fetch(CONFIG.API_ENDPOINTS.extract, {
        method: 'POST',
        body: formData
    });
}

// ============================================================================
// DESCĂRCARE
// ============================================================================

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// MESAJE STATUS
// ============================================================================

function showStatus(message, type = 'info') {
    DOM.statusMessage.classList.remove('hidden', 'success', 'error', 'info');
    DOM.statusMessage.classList.add(type);

    const icons = {
        success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
    };

    DOM.statusMessage.innerHTML = `
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${icons[type]}
        </svg>
        <span class="text-sm">${escapeHtml(message)}</span>
    `;
}

function hideStatus() {
    DOM.statusMessage.classList.add('hidden');
}

// ============================================================================
// NOTIFICĂRI TOAST
// ============================================================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} animate-slide-in`;

    const icons = {
        success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
    };

    const colors = {
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        info: 'var(--color-primary)'
    };

    toast.innerHTML = `
        <svg class="w-5 h-5 flex-shrink-0" style="color: ${colors[type]};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${icons[type]}
        </svg>
        <span class="text-sm flex-1" style="color: var(--color-text);">${escapeHtml(message)}</span>
        <button class="toast-close p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg class="w-4 h-4" style="color: var(--color-text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;

    // Buton închidere
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    DOM.toastContainer.appendChild(toast);

    // Elimină automat după 4 secunde
    setTimeout(() => {
        removeToast(toast);
    }, 4000);
}

function removeToast(toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
}

// ============================================================================
// STARE ÎNCĂRCARE
// ============================================================================

function showLoading() {
    const loadingTexts = {
        merge: 'Se unesc PDF-urile...',
        delete: 'Se șterg paginile...',
        extract: 'Se extrag paginile...'
    };
    DOM.loadingText.textContent = loadingTexts[state.currentTool] || 'Se procesează...';
    DOM.loadingOverlay.classList.remove('hidden');
    DOM.loadingOverlay.classList.add('flex');
}

function hideLoading() {
    DOM.loadingOverlay.classList.add('hidden');
    DOM.loadingOverlay.classList.remove('flex');
}

// ============================================================================
// MANAGEMENT TASTATURĂ
// ============================================================================

function handleKeydown(e) {
    // Închide modal la Escape
    if (e.key === 'Escape' && !DOM.modalOverlay.classList.contains('hidden')) {
        closeModal();
    }
}

// ============================================================================
// INIȚIALIZARE
// ============================================================================

function init() {
    // Temă
    initTheme();
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Zonă upload
    setupUploadZone();

    // Input specificare pagini
    DOM.pagesSpecInput.addEventListener('input', handlePagesSpecInput);

    // Buton acțiune
    DOM.actionBtn.addEventListener('click', processAction);

    // Tastatură
    document.addEventListener('keydown', handleKeydown);

    // Închide modal la click pe overlay
    DOM.modalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.modalOverlay) {
            closeModal();
        }
    });

    console.log('PDF Toolbox inițializat');
}

// Pornește aplicația
init();
