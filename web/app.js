/**
 * PDF Toolbox - Professional Frontend
 * Clean, minimal PDF tools with modal interface
 */

// ============================================================================
// CONFIGURATION
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
// STATE
// ============================================================================

const state = {
    currentTool: null,
    mergeFiles: [],
    selectedFile: null,
    isDarkMode: false,
    dragSrcEl: null
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const DOM = {
    // Theme
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

    // File display
    fileList: document.getElementById('file-list'),
    fileDisplay: document.getElementById('file-display'),
    selectedFilename: document.getElementById('selected-filename'),

    // Pages spec
    pagesSpecContainer: document.getElementById('pages-spec-container'),
    pagesSpecLabel: document.getElementById('pages-spec-label'),
    pagesSpecInput: document.getElementById('pages-spec-input'),

    // Actions
    actionBtn: document.getElementById('action-btn'),

    // Status
    statusMessage: document.getElementById('status-message'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ============================================================================
// TOOL CONFIGURATIONS
// ============================================================================

const TOOLS = {
    merge: {
        title: 'Merge PDFs',
        description: 'Combine multiple PDF files into a single document.',
        actionLabel: 'Merge',
        multipleFiles: true,
        showPagesSpec: false,
        uploadHint: `Up to ${CONFIG.MAX_MERGE_FILES} files, 100 MB each`
    },
    delete: {
        title: 'Delete Pages',
        description: 'Remove specific pages from your PDF.',
        actionLabel: 'Delete & Download',
        multipleFiles: false,
        showPagesSpec: true,
        pagesSpecLabel: 'Pages to delete',
        uploadHint: 'Maximum 100 MB'
    },
    extract: {
        title: 'Extract Pages',
        description: 'Create a new PDF with selected pages.',
        actionLabel: 'Extract & Download',
        multipleFiles: false,
        showPagesSpec: true,
        pagesSpecLabel: 'Pages to extract',
        uploadHint: 'Maximum 100 MB'
    }
};

// ============================================================================
// UTILITY FUNCTIONS
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
// THEME MANAGEMENT
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
// MODAL MANAGEMENT
// ============================================================================

function openModal(tool) {
    state.currentTool = tool;
    const config = TOOLS[tool];

    // Update modal content
    DOM.modalTitle.textContent = config.title;
    DOM.modalDescription.textContent = config.description;
    DOM.actionBtn.textContent = config.actionLabel;
    DOM.uploadHint.textContent = config.uploadHint;

    // Reset file input
    DOM.fileInput.value = '';
    DOM.fileInput.multiple = config.multipleFiles;

    // Reset state
    if (tool === 'merge') {
        state.mergeFiles = [];
        DOM.fileList.classList.add('hidden');
        DOM.fileDisplay.classList.add('hidden');
    } else {
        state.selectedFile = null;
        DOM.fileList.classList.add('hidden');
        DOM.fileDisplay.classList.add('hidden');
    }

    // Pages spec
    if (config.showPagesSpec) {
        DOM.pagesSpecContainer.classList.remove('hidden');
        DOM.pagesSpecLabel.textContent = config.pagesSpecLabel;
        DOM.pagesSpecInput.value = '';
    } else {
        DOM.pagesSpecContainer.classList.add('hidden');
    }

    // Hide status
    hideStatus();

    // Update button state
    updateActionButton();

    // Show modal
    DOM.modalOverlay.classList.remove('hidden');
    DOM.modalOverlay.classList.add('flex');

    // Focus upload zone after animation
    setTimeout(() => DOM.uploadZone.focus(), 100);
}

function closeModal() {
    DOM.modalOverlay.classList.add('hidden');
    DOM.modalOverlay.classList.remove('flex');
    state.currentTool = null;
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

function validatePDFFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        throw new Error('Please select a valid PDF file.');
    }
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${formatFileSize(CONFIG.MAX_FILE_SIZE)}.`);
    }
    return true;
}

// ============================================================================
// FILE UPLOAD HANDLING
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

    // Validate all files
    for (const file of fileArray) {
        validatePDFFile(file);
    }

    // Check count
    if (state.mergeFiles.length + fileArray.length > CONFIG.MAX_MERGE_FILES) {
        throw new Error(`Maximum ${CONFIG.MAX_MERGE_FILES} files allowed.`);
    }

    // Add files
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
                    aria-label="Remove file">
                <svg class="w-3.5 h-3.5" style="color: var(--color-error);"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Setup drag and drop
    setupFileDragDrop();

    // Setup remove buttons
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
// UPLOAD ZONE EVENTS
// ============================================================================

function setupUploadZone() {
    // Click to open file dialog
    DOM.uploadZone.addEventListener('click', () => {
        DOM.fileInput.click();
    });

    // File input change
    DOM.fileInput.addEventListener('change', () => {
        if (DOM.fileInput.files.length > 0) {
            handleFiles(DOM.fileInput.files);
        }
    });

    // Drag events
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

    // Prevent default drag behavior on document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// ============================================================================
// ACTION HANDLING
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
            throw new Error(error.detail || 'Processing failed. Please try again.');
        }

        // Get filename from headers
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = tool === 'merge' ? 'merged.pdf' :
                       tool === 'delete' ? 'modified.pdf' : 'extracted.pdf';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        // Download file
        const blob = await response.blob();
        downloadBlob(blob, filename);

        // Show success and close modal
        showToast(`${config.title} completed successfully`, 'success');

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
// DOWNLOAD
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
// STATUS MESSAGES
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
// TOAST NOTIFICATIONS
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

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    DOM.toastContainer.appendChild(toast);

    // Auto remove after 4 seconds
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
// LOADING STATE
// ============================================================================

function showLoading() {
    const loadingTexts = {
        merge: 'Merging PDFs...',
        delete: 'Deleting pages...',
        extract: 'Extracting pages...'
    };
    DOM.loadingText.textContent = loadingTexts[state.currentTool] || 'Processing...';
    DOM.loadingOverlay.classList.remove('hidden');
    DOM.loadingOverlay.classList.add('flex');
}

function hideLoading() {
    DOM.loadingOverlay.classList.add('hidden');
    DOM.loadingOverlay.classList.remove('flex');
}

// ============================================================================
// KEYBOARD HANDLING
// ============================================================================

function handleKeydown(e) {
    // Close modal on Escape
    if (e.key === 'Escape' && !DOM.modalOverlay.classList.contains('hidden')) {
        closeModal();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    // Theme
    initTheme();
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Upload zone
    setupUploadZone();

    // Pages spec input
    DOM.pagesSpecInput.addEventListener('input', handlePagesSpecInput);

    // Action button
    DOM.actionBtn.addEventListener('click', processAction);

    // Keyboard
    document.addEventListener('keydown', handleKeydown);

    // Close modal on overlay click
    DOM.modalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.modalOverlay) {
            closeModal();
        }
    });

    console.log('PDF Toolbox initialized');
}

// Start the app
init();
