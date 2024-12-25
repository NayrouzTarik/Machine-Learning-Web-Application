function initializeFileUpload() {
    const fileUpload = document.getElementById('file-upload');
    const uploadForm = document.getElementById('upload-form');
    const uploadIcon = document.querySelector('.upload-icon');
    const uploadMessage = uploadIcon.querySelector('span');
    const fileUploadWrapper = document.querySelector('.file-upload-wrapper');
    const dataTypeRecommendation = document.getElementById('dataTypeRecommendation');

    fileUpload.addEventListener('change', handleFileUploadChange);
    uploadForm.addEventListener('submit', handleUploadFormSubmit);
    initializeDragAndDrop(fileUploadWrapper, fileUpload);
}

function handleFileUploadChange(e) {
    const file = e.target.files[0];
    if (file) {
        const uploadMessage = document.querySelector('.upload-icon span');
        const fileUploadWrapper = document.querySelector('.file-upload-wrapper');
        uploadMessage.textContent = `Selected file: ${file.name}`;
        fileUploadWrapper.classList.add('file-selected');

        if (isSupportedFileType(file)) {
            previewFile(file, fileUploadWrapper);
        }
    }
}

function isSupportedFileType(file) {
    return ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type);
}

function previewFile(file, fileUploadWrapper) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = createFilePreview(file);
        const existingPreview = document.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        fileUploadWrapper.after(preview);
    };
    reader.readAsText(file);
}

function createFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.innerHTML = `
        <div class="preview-header">
            <span class="file-name">${file.name}</span>
            <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
        </div>
    `;
    return preview;
}

function handleUploadFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    fetch('/upload/', {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': csrfToken,
        },
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Data received:', data); // Add this line
        if (data.success) {
            updateStatisticsDisplay(data);
            moveToNextSection('exploration-section');
        } else {
            alert('Upload failed. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Upload failed. Please try again.');
    });
}

function updateStatisticsDisplay(data) {
    const dataTypeRecommendationElement = document.getElementById('dataTypeRecommendation');
    console.log('Data Type Recommendation Element in updateStatisticsDisplay:', dataTypeRecommendationElement); // Debugging statement

    if (dataTypeRecommendationElement) {
        dataTypeRecommendationElement.textContent = data.statistics.task_type;
    } else {
        console.error('Data Type Recommendation element not found in updateStatisticsDisplay');
    }

    const statsDisplay = document.getElementById('statistics-display');
    const basicStats = createBasicStats(data.statistics);
    const nullValuesSection = createCollapsibleSection('Null Values', formatNullValues(data.statistics.null_values));
    const categoricalAnalysisSection = createCollapsibleSection('Categorical Analysis', formatCategoricalAnalysis(data.statistics.category_analysis));
    const summaryStatsSection = createCollapsibleSection('Summary Statistics', formatSummaryStats(data.statistics));
    const correlationMatrixSection = createCollapsibleSection('Correlation Matrix', formatCorrelationMatrix(data.statistics.correlation_with_all_variables));
    statsDisplay.innerHTML = basicStats + nullValuesSection + categoricalAnalysisSection + summaryStatsSection + correlationMatrixSection;

    addCollapsibleSectionStyles();
}

function createBasicStats(statistics) {
    return `
        <div class="basic-stats">
            <div class="stat-item">
                <strong>Dimensions:</strong> ${statistics.shape[0]} rows × ${statistics.shape[1]} columns
            </div>
            <div class="stat-item">
                <strong>Duplicates:</strong> ${statistics.duplicates_count}
            </div>
        </div>
    `;
}

function createCollapsibleSection(title, content) {
    return `
        <div class="collapsible-section">
            <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
                <h4>${title}</h4>
                <span class="toggle-icon">▼</span>
            </div>
            <div class="section-content">
                ${content}
            </div>
        </div>
    `;
}

function formatNullValues(nullValues) {
    const columns = Object.entries(nullValues);
    let html = '<div class="grid-container">';

    for (let i = 0; i < columns.length; i += 3) {
        html += '<div class="grid-row">';
        for (let j = 0; j < 3 && i + j < columns.length; j++) {
            const [col, val] = columns[i + j];
            html += `
                <div class="grid-cell">
                    <span class="col-name" title="${col}">
                        ${col.length > 20 ? col.substring(0, 20) + '...' : col}
                    </span>
                    <span class="col-value">${val}</span>
                </div>
            `;
        }
        html += '</div>';
    }

    return html + '</div>';
}

function formatCategoricalAnalysis(categoryAnalysis) {
    let html = '<div class="grid-container">';

    for (const [col, counts] of Object.entries(categoryAnalysis)) {
        html += `
            <div class="grid-row">
                <div class="grid-cell">
                    <span class="col-name" title="${col}">${col}</span>
                    <div class="col-value">
                        ${formatCounts(counts)}
                    </div>
                </div>
            </div>
        `;
    }

    return html + '</div>';
}

function formatCounts(counts) {
    let html = '<ul>';
    for (const [key, value] of Object.entries(counts)) {
        html += `<li>${key}: ${value}</li>`;
    }
    return html + '</ul>';
}

function formatSummaryStats(statistics) {
    let html = '<table class="summary-stats-table">';
    html += '<thead><tr><th>Column</th><th>Mean</th><th>Variance</th><th>Std Dev</th></tr></thead>';
    html += '<tbody>';

    for (const col of Object.keys(statistics.mean_values)) {
        html += `
            <tr>
                <td>${col}</td>
                <td>${statistics.mean_values[col]}</td>
                <td>${statistics.variance_values[col]}</td>
                <td>${statistics.std_values[col]}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    return html;
}

function formatCorrelationMatrix(correlationMatrix) {
    let html = '<table class="correlation-matrix-table">';
    html += '<thead><tr><th>Column</th>';

    for (const col of Object.keys(correlationMatrix)) {
        html += `<th>${col}</th>`;
    }

    html += '</tr></thead>';
    html += '<tbody>';

    for (const col of Object.keys(correlationMatrix)) {
        html += `<tr><td>${col}</td>`;
        for (const subCol of Object.keys(correlationMatrix)) {
            html += `<td>${correlationMatrix[col][subCol]}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
}

function addCollapsibleSectionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .collapsible-section {
            margin: 20px 0;
            border: 1px solid var(--border-color); /* Respect the theme */
            border-radius: 4px;
            max-height: 600px;
            overflow: hidden;
            background-color: var(--background-color); /* Respect the theme */
            color: var(--text-color); /* Respect the theme */
            transition: max-height 0.3s ease; /* Smooth transition for collapsing */
        }
        .section-header {
            padding: 10px;
            background: var(--header-background-color); /* Respect the theme */
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 1;
        }
        .section-content {
            display: none;
            padding: 10px;
            max-height: calc(100vh - 300px);
            overflow-y: auto;
            transition: max-height 0.3s ease; /* Smooth transition for collapsing */
        }
        .expanded .section-content {
            display: block;
            max-height: 1000px; /* Adjust as needed */
        }
        .grid-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .grid-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }
        .grid-cell {
            padding: 8px;
            border: 1px solid var(--border-color); /* Respect the theme */
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            background: var(--cell-background-color); /* Respect the theme */
        }
        .col-name {
            color: var(--text-color); /* Respect the theme */
            font-size: 0.9em;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .section-content::-webkit-scrollbar {
            width: 8px;
        }
        .section-content::-webkit-scrollbar-track {
            background: var(--scrollbar-track-color); /* Respect the theme */
            border-radius: 4px;
        }
        .section-content::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb-color); /* Respect the theme */
            border-radius: 4px;
        }
        .summary-stats-table, .correlation-matrix-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px; /* Add margin to separate from step buttons */
        }
        .summary-stats-table th, .correlation-matrix-table th,
        .summary-stats-table td, .correlation-matrix-table td {
            border: 1px solid var(--border-color); /* Respect the theme */
            padding: 8px;
            text-align: left;
        }
        .summary-stats-table th, .correlation-matrix-table th {
            background-color: var(--header-background-color); /* Respect the theme */
        }
        .step-buttons {
            margin-top: 20px; /* Add margin to separate from statistics display */
        }
    `;
    document.head.appendChild(style);
}

function moveToNextSection(sectionId) {
    const nextButton = document.querySelector(`.next-step[data-next="${sectionId}"]`);
    if (nextButton) nextButton.click();
}

function initializeDragAndDrop(fileUploadWrapper, fileUpload) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUploadWrapper.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        fileUploadWrapper.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileUploadWrapper.addEventListener(eventName, unhighlight, false);
    });

    fileUploadWrapper.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        fileUploadWrapper.classList.add('drag-over');
    }

    function unhighlight(e) {
        fileUploadWrapper.classList.remove('drag-over');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        fileUpload.files = dt.files;

        const event = new Event('change');
        fileUpload.dispatchEvent(event);
    }
}

export { initializeFileUpload };
