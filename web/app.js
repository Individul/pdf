/**
 * PDF Toolbox - Frontend Application
 */

// State
const state = {
    merge: {
        files: [],
        dragSrcEl: null
    },
    delete: {
        file: null
    },
    extract: {
        file: null
    }
};

// DOM Elements
const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    panels: {
        merge: document.getElementById('merge-panel'),
        delete: document.getElementById('delete-panel'),
        extract: document.getElementById('extract-panel')
    },
    merge: {
        uploadZone: document.getElementById('merge-upload-zone'),
        fileInput: document.getElementById('merge-file-input'),
        fileList: document.getElementById('merge-file-list'),
        mergeBtn: document.getElementById('merge-btn'),
        status: document.getElementById('merge-status')
    },
    delete: {
        uploadZone: document.getElementById('delete-upload-zone'),
        fileInput: document.getElementById('delete-file-input'),
        fileDisplay: document.getElementById('delete-file-display'),
        filename: document.getElementById('delete-filename'),
        filesize: document.getElementById('delete-filesize'),
        clearBtn: document.getElementById('delete-clear-file'),
        pagesSpec: document.getElementById('delete-pages-spec'),
        deleteBtn: document.getElementById('delete-btn'),
        status: document.getElementById('delete-status')
    },
    extract: {
        uploadZone: document.getElementById('extract-upload-zone'),
        fileInput: document.getElementById('extract-file-input'),
        fileDisplay: document.getElementById('extract-file-display'),
        filename: document.getElementById('extract-filename'),
        filesize: document.getElementById('extract-filesize'),
        clearBtn: document.getElementById('extract-clear-file'),
        pagesSpec: document.getElementById('extract-pages-spec'),
        extractBtn: document.getElementById('extract-btn'),
        status: document.getElementById('extract-status')
    },
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// Constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_MERGE_FILES = 20;

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function showStatus(container, message, type = 'info') {
    container.classList.remove('hidden');
    container.className = 'rounded-xl p-4 flex items-center gap-3 ' +
        (type === 'error' ? 'status-error text-red-800' :
         type === 'success' ? 'status-success text-green-800' :
         'status-info text-blue-800');
    container.innerHTML = `
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${type === 'error' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' :
              type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' :
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
        </svg>
        <span>${message}</span>
    `;
}

function hideStatus(container) {
    container.classList.add('hidden');
}

function showLoading(text = 'Processing...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Tab Switching
elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update tab buttons
        elements.tabs.forEach(t => {
            t.classList.remove('active');
        });
        tab.classList.add('active');

        // Update panels
        Object.values(elements.panels).forEach(panel => panel.classList.add('hidden'));
        elements.panels[tabName].classList.remove('hidden');
    });
});

// File Validation
function validatePDFFile(file) {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Selectează un fișier PDF');
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Fișier prea mare. Dimensiune maximă: ${formatFileSize(MAX_FILE_SIZE)}`);
    }
    return true;
}

// Merge Functionality
function updateMergeFileList() {
    const { files } = state.merge;
    const { fileList, mergeBtn } = elements.merge;

    if (files.length === 0) {
        fileList.classList.add('hidden');
        mergeBtn.disabled = true;
        return;
    }

    fileList.classList.remove('hidden');
    mergeBtn.disabled = false;

    fileList.innerHTML = files.map((file, index) => `
        <div class="file-item rounded-xl p-4 flex items-center gap-4 cursor-move" data-index="${index}" draggable="true">
            <div class="page-number">${index + 1}</div>
            <svg class="w-5 h-5 text-purple-400 handle cursor-grab flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
            </svg>
            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2Z"/>
                </svg>
            </div>
            <span class="flex-1 truncate text-sm font-medium text-gray-800">${file.name}</span>
            <span class="text-xs text-gray-500 flex-shrink-0">${formatFileSize(file.size)}</span>
            <button class="remove-file w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" data-index="${index}">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Add drag and drop listeners
    setupMergeDragAndDrop();

    // Add remove button listeners
    fileList.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            state.merge.files.splice(index, 1);
            updateMergeFileList();
        });
    });
}

function setupMergeDragAndDrop() {
    const items = elements.merge.fileList.querySelectorAll('.file-item');

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            state.merge.dragSrcEl = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            items.forEach(i => i.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (item !== state.merge.dragSrcEl) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (state.merge.dragSrcEl !== item) {
                const fromIndex = parseInt(state.merge.dragSrcEl.dataset.index);
                const toIndex = parseInt(item.dataset.index);

                // Reorder files array
                const [movedFile] = state.merge.files.splice(fromIndex, 1);
                state.merge.files.splice(toIndex, 0, movedFile);

                updateMergeFileList();
            }

            return false;
        });
    });
}

function setupUploadZone(uploadZone, fileInput, onFilesSelected) {
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        onFilesSelected(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        onFilesSelected(fileInput.files);
        fileInput.value = ''; // Reset to allow selecting same file again
    });
}

// Merge upload zone
setupUploadZone(elements.merge.uploadZone, elements.merge.fileInput, (files) => {
    hideStatus(elements.merge.status);

    for (const file of files) {
        try {
            validatePDFFile(file);
        } catch (err) {
            showStatus(elements.merge.status, err.message, 'error');
            return;
        }
    }

    if (state.merge.files.length + files.length > MAX_MERGE_FILES) {
        showStatus(elements.merge.status, `Maximum ${MAX_MERGE_FILES} de fișiere permise`, 'error');
        return;
    }

    state.merge.files.push(...Array.from(files));
    updateMergeFileList();
});

// Merge button
elements.merge.mergeBtn.addEventListener('click', async () => {
    const { files } = state.merge;

    if (files.length < 2) {
        showStatus(elements.merge.status, 'Adaugă cel puțin 2 fișiere PDF', 'error');
        return;
    }

    hideStatus(elements.merge.status);
    showLoading('Se combină PDF-urile...');

    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch('/api/merge', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to merge PDFs');
        }

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'merged.pdf';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        const blob = await response.blob();
        downloadBlob(blob, filename);

        showStatus(elements.merge.status, 'PDF-uri combinate cu succes!', 'success');

        // Clear files after successful merge
        state.merge.files = [];
        updateMergeFileList();

    } catch (err) {
        showStatus(elements.merge.status, err.message || 'An error occurred while merging PDFs', 'error');
    } finally {
        hideLoading();
    }
});

// Delete Pages Functionality
function updateDeleteFileDisplay() {
    const { file } = state.delete;
    const { fileDisplay, filename, filesize, deleteBtn, pagesSpec } = elements.delete;

    if (file) {
        fileDisplay.classList.remove('hidden');
        filename.textContent = file.name;
        filesize.textContent = formatFileSize(file.size);
        deleteBtn.disabled = !pagesSpec.value.trim();
    } else {
        fileDisplay.classList.add('hidden');
        deleteBtn.disabled = true;
    }
}

setupUploadZone(elements.delete.uploadZone, elements.delete.fileInput, (files) => {
    hideStatus(elements.delete.status);

    if (files.length === 0) return;

    try {
        validatePDFFile(files[0]);
        state.delete.file = files[0];
        updateDeleteFileDisplay();
    } catch (err) {
        showStatus(elements.delete.status, err.message, 'error');
    }
});

elements.delete.clearBtn.addEventListener('click', () => {
    state.delete.file = null;
    updateDeleteFileDisplay();
});

elements.delete.pagesSpec.addEventListener('input', () => {
    const { file } = state.delete;
    elements.delete.deleteBtn.disabled = !file || !elements.delete.pagesSpec.value.trim();
});

elements.delete.deleteBtn.addEventListener('click', async () => {
    const { file } = state.delete;
    const pagesSpec = elements.delete.pagesSpec.value.trim();

    if (!file || !pagesSpec) return;

    hideStatus(elements.delete.status);
    showLoading('Se șterg paginile...');

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pages_spec', pagesSpec);

        const response = await fetch('/api/delete-pages', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete pages');
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'modified.pdf';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        const blob = await response.blob();
        downloadBlob(blob, filename);

        showStatus(elements.delete.status, 'Pagini șterse cu succes!', 'success');

    } catch (err) {
        showStatus(elements.delete.status, err.message || 'An error occurred while deleting pages', 'error');
    } finally {
        hideLoading();
    }
});

// Extract Pages Functionality
function updateExtractFileDisplay() {
    const { file } = state.extract;
    const { fileDisplay, filename, filesize, extractBtn, pagesSpec } = elements.extract;

    if (file) {
        fileDisplay.classList.remove('hidden');
        filename.textContent = file.name;
        filesize.textContent = formatFileSize(file.size);
        extractBtn.disabled = !pagesSpec.value.trim();
    } else {
        fileDisplay.classList.add('hidden');
        extractBtn.disabled = true;
    }
}

setupUploadZone(elements.extract.uploadZone, elements.extract.fileInput, (files) => {
    hideStatus(elements.extract.status);

    if (files.length === 0) return;

    try {
        validatePDFFile(files[0]);
        state.extract.file = files[0];
        updateExtractFileDisplay();
    } catch (err) {
        showStatus(elements.extract.status, err.message, 'error');
    }
});

elements.extract.clearBtn.addEventListener('click', () => {
    state.extract.file = null;
    updateExtractFileDisplay();
});

elements.extract.pagesSpec.addEventListener('input', () => {
    const { file } = state.extract;
    elements.extract.extractBtn.disabled = !file || !elements.extract.pagesSpec.value.trim();
});

elements.extract.extractBtn.addEventListener('click', async () => {
    const { file } = state.extract;
    const pagesSpec = elements.extract.pagesSpec.value.trim();

    if (!file || !pagesSpec) return;

    hideStatus(elements.extract.status);
    showLoading('Se extrag paginile...');

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pages_spec', pagesSpec);

        const response = await fetch('/api/extract-pages', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to extract pages');
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'extracted.pdf';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        const blob = await response.blob();
        downloadBlob(blob, filename);

        showStatus(elements.extract.status, 'Pagini extrase cu succes!', 'success');

    } catch (err) {
        showStatus(elements.extract.status, err.message || 'An error occurred while extracting pages', 'error');
    } finally {
        hideLoading();
    }
});

// Initialize
console.log('PDF Toolbox initialized');
