document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeWorkflowNavigation();
    initializeFileUpload();
    initializeThemeSwitcher();
    fetchWorkflowStats();
    initializeModelSelection();
    addCollapsibleSectionStyles();
    initializeTargetTypeSelection();
    initializePlotting(); 
});


let currentChart = null; // Declare currentChart in the global scope

function initializePlotting() {
    const plotTypeSelect = document.getElementById('plot-type');
    const xVariableSelect = document.getElementById('x-variable');
    const yVariableSelect = document.getElementById('y-variable');
    const generatePlotButton = document.getElementById('generate-plot');
    const plotCanvas = document.getElementById('plot-canvas');
    let variableTypes = {};

    // Enhanced function to populate variables with validation and error handling
    function populateVariables(variables) {
        console.log('Starting populateVariables with:', variables);

        // DOM element validation
        if (!xVariableSelect) {
            console.error('xVariableSelect not found in DOM');
            return;
        }
        if (!yVariableSelect) {
            console.error('yVariableSelect not found in DOM');
            return;
        }

        // Input validation
        if (!Array.isArray(variables)) {
            console.error('Variables must be an array, received:', typeof variables);
            return;
        }

        // Clear existing options
        xVariableSelect.innerHTML = '<option value="">Select X Variable</option>';
        yVariableSelect.innerHTML = '<option value="">Select Y Variable</option>';

        // Reset variable types
        variableTypes = {};

        // Add new options with validation
        variables.forEach((variable, index) => {
            if (!variable || typeof variable !== 'object') {
                console.error(`Invalid variable at index ${index}:`, variable);
                return;
            }

            if (!variable.name) {
                console.error(`Variable at index ${index} missing name property:`, variable);
                return;
            }

            // Create and append options
            const optionX = new Option(variable.name, variable.name);
            const optionY = new Option(variable.name, variable.name);

            try {
                xVariableSelect.add(optionX);
                yVariableSelect.add(optionY);
                variableTypes[variable.name] = variable.type;
                console.log(`Successfully added variable: ${variable.name}`);
            } catch (error) {
                console.error(`Error adding variable ${variable.name}:`, error);
            }
        });

        // Verify population
        console.log('Final state:', {
            xOptionsCount: xVariableSelect.options.length,
            yOptionsCount: yVariableSelect.options.length,
            variableTypes: variableTypes
        });
    }

    async function fetchVariables() {
        try {
            console.log('Starting fetchVariables');

            // Verify CSRF token
            const csrfToken = getCsrfToken();
            if (!csrfToken) {
                throw new Error('CSRF token not found');
            }

            const response = await fetch('/get-variables/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received data:', data);

            if (!data.success) {
                throw new Error(data.error || 'Unknown error in response');
            }

            if (!data.variables || !Array.isArray(data.variables)) {
                throw new Error('Invalid variables data received');
            }

            // Map the array of variable names to an array of objects
            const variablesArray = data.variables.map(variable => ({ name: variable }));
            populateVariables(variablesArray);
        } catch (error) {
            console.error('Error in fetchVariables:', error);
            // Add visual feedback for users
            if (xVariableSelect && yVariableSelect) {
                const errorOption = new Option('Error loading variables', '');
                xVariableSelect.innerHTML = '';
                yVariableSelect.innerHTML = '';
                xVariableSelect.add(errorOption.cloneNode(true));
                yVariableSelect.add(errorOption.cloneNode(true));
            }
        }
    }

    // Initialize event listeners
    document.addEventListener('fileUploaded', () => {
        console.log('File upload event detected');
        clearChart();
        fetchVariables();
    });

    // Add event listener for generating plot
    generatePlotButton.addEventListener('click', async function() {
        console.log('Generate plot clicked'); // Debug log
        const plotType = plotTypeSelect.value;
        const xVariable = xVariableSelect.value;
        const yVariable = yVariableSelect.value;

        console.log('Selected values:', { plotType, xVariable, yVariable }); // Debug log

        try {
            validatePlotRequirements(plotType, xVariable, yVariable);
            clearChart();

            const response = await fetch(
                `/get-plot-data/?x_variable=${xVariable}&y_variable=${yVariable}&plot_type=${plotType}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    }
                }
            );

            const data = await response.json();
            if (data.success) {
                const config = createChartConfig(plotType, xVariable, yVariable, data.plot_data);
                currentChart = new Chart(plotCanvas.getContext('2d'), config);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            alert(error.message);
            console.error('Error generating plot:', error);
        }
    });

    // Initial fetch
    console.log('Initializing plotting module');
    fetchVariables();
}

function clearChart() {
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

function validatePlotRequirements(plotType, xVariable, yVariable) {
    // Add validation logic based on plot type and selected variables
    if (!plotType) {
        throw new Error('Please select a plot type.');
    }
    if (!xVariable) {
        throw new Error('Please select an X variable.');
    }
    if (plotType !== 'histogram' && !yVariable) {
        throw new Error('Please select a Y variable.');
    }
}

function createChartConfig(plotType, xVariable, yVariable, plotData) {
    // Add logic to create chart configuration based on plot type and data
    let config = {};

    switch (plotType) {
        case 'histogram':
            config = {
                type: 'bar',
                data: {
                    labels: plotData.labels,
                    datasets: [{
                        label: xVariable,
                        data: plotData.values,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        x: {
                            beginAtZero: true
                        }
                    }
                }
            };
            break;
        case 'scatter':
            config = {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: `Scatter Plot of ${xVariable} vs ${yVariable}`,
                        data: plotData.points,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom'
                        }
                    }
                }
            };
            break;
        case 'bar':
            config = {
                type: 'bar',
                data: {
                    labels: plotData.labels,
                    datasets: [{
                        label: yVariable,
                        data: plotData.values,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            };
            break;
        default:
            throw new Error('Unsupported plot type.');
    }

    return config;
}

function clearChart() {
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

function validatePlotRequirements(plotType, xVariable, yVariable) {
    // Add validation logic based on plot type and selected variables
    if (!plotType) {
        throw new Error('Please select a plot type.');
    }
    if (!xVariable) {
        throw new Error('Please select an X variable.');
    }
    if (plotType !== 'histogram' && !yVariable) {
        throw new Error('Please select a Y variable.');
    }
}

function createChartConfig(plotType, xVariable, yVariable, plotData) {
    // Add logic to create chart configuration based on plot type and data
    let config = {};

    switch (plotType) {
        case 'histogram':
            config = {
                type: 'bar',
                data: {
                    labels: plotData.labels,
                    datasets: [{
                        label: xVariable,
                        data: plotData.values,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        x: {
                            beginAtZero: true
                        }
                    }
                }
            };
            break;
        case 'scatter':
            config = {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: `Scatter Plot of ${xVariable} vs ${yVariable}`,
                        data: plotData.points,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom'
                        }
                    }
                }
            };
            break;
        case 'bar':
            config = {
                type: 'bar',
                data: {
                    labels: plotData.labels,
                    datasets: [{
                        label: yVariable,
                        data: plotData.values,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            };
            break;
        default:
            throw new Error('Unsupported plot type.');
    }

    return config;
}



function initializeTargetTypeSelection() {
    const targetTypeSelect = document.getElementById('target-type');
    const featuresNameTargetSelect = document.getElementById('features-name-target');

    targetTypeSelect.addEventListener('change', () => {
        const selectedTargetType = targetTypeSelect.value;
        fetchCompatibleFeatures(selectedTargetType).then(features => {
            populateFeaturesDropdown(featuresNameTargetSelect, features);
        });
    });
}

async function fetchCompatibleFeatures(targetType) {
    try {
        const response = await fetch('/get-compatible-features/', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ target_type: targetType })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.features || [];
    } catch (error) {
        console.error('Error fetching compatible features:', error);
        return [];
    }
}


function populateFeaturesDropdown(dropdown, features) {
    dropdown.innerHTML = ''; // Clear existing options
    features.forEach(feature => {
        const option = document.createElement('option');
        option.value = feature.name;
        option.textContent = `${feature.name} (${feature.dtype}, Unique: ${feature.unique_count})`;
        dropdown.appendChild(option);
    });
}

async function initializeModelSelection() {
    const targetTypeSelect = document.getElementById('target-type');
    const featuresSelect = document.getElementById('features-name-target');
    const modelButtons = document.querySelectorAll('.model-btn');

    // Initialize with current data
    await updateFeatures(targetTypeSelect.value);

    targetTypeSelect.addEventListener('change', async (e) => {
        const selectedType = e.target.value;
        const recommendation = document.getElementById('dataTypeRecommendation').textContent;

        if (selectedType !== recommendation) {
            if (!confirm('This differs from the recommended type. Continue?')) {
                e.preventDefault();
                targetTypeSelect.value = recommendation;
                return;
            }
        }

        await updateFeatures(selectedType);
        updateAvailableModels(selectedType);
    });

    modelButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const model = button.dataset.model;
            const targetType = targetTypeSelect.value;
            const selectedFeature = featuresSelect.value;

            try {
                const response = await fetch('/run-model/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        model: model,
                        target_type: targetType,
                        features_name_target: selectedFeature
                    })
                });

                const result = await response.json();
                if (result.success) {
                    displayModelResults(result.results);
                } else {
                    showError(result.error);
                }
            } catch (error) {
                showError('Failed to run model: ' + error.message);
            }
        });
    });
}

async function updateFeatures(targetType) {
    const featuresSelect = document.getElementById('features-name-target');
    featuresSelect.disabled = true;
    featuresSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        const response = await fetch('/get-compatible-features/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ target_type: targetType })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Update recommendation
        document.getElementById('dataTypeRecommendation').textContent = data.recommendation;

        // Update features dropdown
        featuresSelect.innerHTML = '';
        data.features.forEach(feature => {
            const option = document.createElement('option');
            option.value = feature.name;
            option.textContent = `${feature.name} (${feature.dtype})`;
            featuresSelect.appendChild(option);
        });

        featuresSelect.disabled = targetType === 'clustering';

    } catch (error) {
        showError(error.message);
    }
}

function updateAvailableModels(targetType) {
    const modelButtons = document.querySelectorAll('.model-btn');
    const validModels = {
        'classification': ['decision-tree', 'svm', 'random-forest', 'knn', 'neural-network', 'naive-bayes'],
        'regression': ['regression', 'neural-network', 'random-forest', 'svm'],
        'clustering': ['k-means']
    };

    modelButtons.forEach(button => {
        const model = button.dataset.model;
        if (validModels[targetType].includes(model)) {
            button.style.display = 'block';
            button.disabled = false;
        } else {
            button.style.display = 'none';
            button.disabled = true;
        }
    });
}

function getCsrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.model-category').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

let cleanedData = null;

async function cleanData() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    console.log('Cleaning data...');

    try {
        const response = await fetch('/clean_data/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });

        const data = await response.json();
        console.log('Clean data response:', data);

        if (data.success) {
            console.log('Data cleaned successfully');
            cleanedData = true; // Set the flag
            return true;
        } else {
            console.error('Error cleaning data:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

function handleModelSelection(event) {
    const selectedModel = event.target.dataset.model;
    const dataTypeRecommendation = document.getElementById('dataTypeRecommendation').textContent;

    if (!cleanedData) {
        alert('Please clean the data first.');
        return;
    }

    if (!isModelCompatible(selectedModel, dataTypeRecommendation)) {
        showWarningDialog(`This model (${selectedModel}) is not recommended for ${dataTypeRecommendation} problems. Do you want to continue anyway?`)
            .then(shouldContinue => {
                if (shouldContinue) {
                    runModel(selectedModel);
                }
            });
    } else {
        runModel(selectedModel);
    }
}

function runModel(selectedModel) {
    const data = {
        model: selectedModel,
        target_type: document.getElementById('target-type').value,
        features_name_target: document.getElementById('features-name-target').value
    };

    fetch('/run-model/', {  // Update URL
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success && data.results) {
            updateVisualization(data.results);
            saveModelRun(selectedModel, data.results, modelHistory.currentCSV?.fileName || 'Unknown');
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(`Model execution failed: ${error.message}`);
    });
}

function updateVisualization(results) {
    const metricsChart = document.getElementById('metrics-chart');

    if (!results || !metricsChart) return;

    let data, layout;

    if ('accuracy' in results) {
        // Classification metrics
        data = [{
            x: ['Accuracy', 'Precision', 'Recall', 'F1'],
            y: [
                results.accuracy,
                results.precision,
                results.recall,
                results.f1
            ],
            type: 'bar',
            marker: {
                color: 'rgb(255, 105, 180)'
            }
        }];
        layout = {
            title: 'Classification Metrics',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#fff' },
            margin: { t: 50, b: 50, l: 50, r: 50 }
        };
    }
    else if ('train_score' in results) {
        // Model performance metrics
        data = [{
            x: ['Training Score', 'Test Score'],
            y: [results.train_score, results.test_score],
            type: 'bar',
            marker: {
                color: 'rgb(255, 105, 180)'
            }
        }];
        layout = {
            title: 'Model Performance',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#fff' },
            margin: { t: 50, b: 50, l: 50, r: 50 }
        };
    }

    Plotly.newPlot(metricsChart, data, layout);
}

function isModelCompatible(model, dataTypeRecommendation) {
    const compatibilityMap = {
        'regression': ['regression'],
        'decision-tree': ['classification', 'regression'],
        'svm': ['classification', 'regression'],
        'random-forest': ['classification', 'regression'],
        'knn': ['classification'],
        'neural-network': ['classification', 'regression'],
        'K-Means': ['clustering'],
        'naive-bayes': ['classification']
    };

    if (!compatibilityMap[model]) {
        console.error(`Unknown model: ${model}`);
        return false;
    }

    return compatibilityMap[model].includes(dataTypeRecommendation.toLowerCase());
}

function showWarningDialog(message) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'warning-dialog';
        dialog.innerHTML = `
            <div class="warning-content">
                <h3>Warning</h3>
                <p>${message}</p>
                <div class="warning-buttons">
                    <button class="continue-btn">Continue Anyway</button>
                    <button class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.continue-btn').onclick = () => {
            dialog.remove();
            resolve(true);
        };

        dialog.querySelector('.cancel-btn').onclick = () => {
            dialog.remove();
            resolve(false);
        };
    });
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('section');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            handleNavItemClick(navItems, this, sections);
        });
    });
}

function handleNavItemClick(navItems, clickedItem, sections) {
    navItems.forEach(nav => nav.classList.remove('active'));
    clickedItem.classList.add('active');

    const pageId = clickedItem.dataset.page;
    if (pageId) {
        sections.forEach(section => section.classList.remove('active'));
        const targetSection = document.getElementById(`${pageId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    if (pageId === 'workflow') {
        initializeWorkflowContent();
    }
}

function initializeWorkflowContent() {
    const workflowContents = document.querySelectorAll('.workflow-content');
    workflowContents.forEach(content => content.classList.remove('active'));
    const firstWorkflowStep = document.getElementById('upload-section');
    if (firstWorkflowStep) {
        firstWorkflowStep.classList.add('active');
    }
}

function initializeWorkflowNavigation() {
    const nextStepButtons = document.querySelectorAll('.next-step');
    const prevStepButtons = document.querySelectorAll('.prev-step');

    nextStepButtons.forEach(button => {
        button.addEventListener('click', function() {
            handleStepButtonClick(this, 'next');
        });
    });

    prevStepButtons.forEach(button => {
        button.addEventListener('click', function() {
            handleStepButtonClick(this, 'prev');
        });
    });
}

function handleStepButtonClick(button, direction) {
    const currentSection = button.closest('.workflow-content');
    const targetSectionId = button.dataset[direction];
    const targetSection = document.getElementById(targetSectionId);

    if (currentSection && targetSection) {
        currentSection.classList.remove('active');
        targetSection.classList.add('active');
    }
    if (targetSectionId === 'selection-section') {
        cleanData();
    }
}

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

function handleSaveEmailButtonClick() {
    const emailInput = document.getElementById('user-email');
    const emailDisplay = document.getElementById('user-email-display');
    const saveEmailButton = document.getElementById('save-email');

    const isEditing = emailInput.style.display === 'none';

    if (isEditing) {
        emailInput.style.display = 'block';
        emailInput.value = emailDisplay.textContent;
        saveEmailButton.textContent = 'Save';
    } else {
        const newEmail = emailInput.value.trim();

        if (!newEmail) {
            alert('Please enter a valid email address');
            return;
        }

        fetch('/api/update-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            },
            body: JSON.stringify({ email: newEmail })
        })
        .then(response => {
            if (response.ok) {
                emailDisplay.textContent = newEmail;
                emailInput.style.display = 'none';
                saveEmailButton.textContent = 'Edit';
                alert('Email updated successfully!');
            } else {
                throw new Error('Failed to update email');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to update email. Please try again.');
        });
    }
}

async function fetchWorkflowStats() {
    try {
        const response = await fetch('/api/workflow-statistics');
        const data = await response.json();
        document.getElementById('workflow-stat').textContent = `${data.completed} / ${data.total}`;
    } catch (error) {
        console.error('Error fetching workflow statistics:', error);
        document.getElementById('workflow-stat').textContent = 'Error loading stats';
    }
}

function initializeThemeSwitcher() {
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            document.body.setAttribute('data-theme', event.target.value);
        });
    });
}

function handleLogout(event) {
    event.preventDefault();
    const logoutForm = document.getElementById('logout-form');
    if (logoutForm) {
        logoutForm.submit();
    }
}

// testing history
let modelHistory = {
    models: [],
    csvs: [],
    currentCSV: null
};

function saveModelRun(model, results, csvName) {
    const modelRun = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        modelType: model,
        results: results,
        csvName: csvName
    };
    modelHistory.models.push(modelRun);
    localStorage.setItem('modelHistory', JSON.stringify(modelHistory));
    updateHistoryDisplay();
}

function saveCSV(fileName, data) {
    const csvEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        fileName: fileName,
        data: data
    };
    modelHistory.csvs.push(csvEntry);
    modelHistory.currentCSV = csvEntry;
    localStorage.setItem('modelHistory', JSON.stringify(modelHistory));
}

function loadHistory() {
    const saved = localStorage.getItem('modelHistory');
    if (saved) {
        modelHistory = JSON.parse(saved);
        updateHistoryDisplay();
    }
}

function updateHistoryDisplay() {
    const historySection = document.getElementById('history-section');
    if (!historySection) return;

    let html = '<div class="history-container">';

    // Model History
    html += '<div class="model-history">';
    html += '<h3>Model Runs</h3>';
    modelHistory.models.forEach(run => {
        html += `
            <div class="history-item">
                <span>${run.modelType}</span>
                <span>${run.timestamp}</span>
                <span>CSV: ${run.csvName}</span>
                <button onclick="viewModelResults('${run.id}')">View Results</button>
            </div>
        `;
    });
    html += '</div>';

    historySection.innerHTML = html;
}

function downloadCSV(csvId) {
    const csv = modelHistory.csvs.find(c => c.id === parseInt(csvId));
    if (!csv) return;

    const blob = new Blob([csv.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csv.fileName;
    a.click();
}

function viewModelResults(modelId) {
    const run = modelHistory.models.find(m => m.id === parseInt(modelId));
    if (!run) return;
    updateVisualization(run.results);
}

// Update existing runModel function
function runModel(selectedModel) {
    const data = {
        model: selectedModel
    };

    fetch('/run_model/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.results) {
            console.log('Model results:', data.results);
            updateVisualization(data.results);
            saveModelRun(selectedModel, data.results, modelHistory.currentCSV?.fileName || 'Unknown');
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(`Model execution failed: ${error.message}`);
    });
}
