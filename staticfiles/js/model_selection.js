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

function handleModelSelection(event) {
    const selectedModel = event.target.dataset.model;
    const dataTypeRecommendation = document.getElementById('dataTypeRecommendation').textContent;
    const targetType = document.getElementById('target-type').value;
    const featuresNameTarget = document.getElementById('features-name-target').value;

    if (!cleanedData) {
        alert('Please clean the data first.');
        return;
    }

    if (!isModelCompatible(selectedModel, dataTypeRecommendation, targetType)) {
        showWarningDialog(`This model (${selectedModel}) is not recommended for ${dataTypeRecommendation} problems. Do you want to continue anyway?`)
            .then(shouldContinue => {
                if (shouldContinue) {
                    runModel(selectedModel, targetType, featuresNameTarget);
                }
            });
    } else {
        runModel(selectedModel, targetType, featuresNameTarget);
    }
}

function runModel(selectedModel, targetType, featuresNameTarget) {
    const data = {
        model: selectedModel,
        target_type: targetType,
        features_name_target: featuresNameTarget
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

function isModelCompatible(model, dataTypeRecommendation, targetType) {
    const compatibilityMap = {
        'regression': ['regression'],
        'decision-tree': ['classification', 'regression'],
        'svm': ['classification', 'regression'],
        'random-forest': ['classification', 'regression'],
        'knn': ['classification'],
        'neural-network': ['classification', 'regression'],
        'k-means': ['clustering'],
        'naive-bayes': ['classification']
    };

    if (!compatibilityMap[model]) {
        console.error(`Unknown model: ${model}`);
        return false;
    }

    return compatibilityMap[model].includes(dataTypeRecommendation.toLowerCase()) && compatibilityMap[model].includes(targetType.toLowerCase());
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

export { initializeModelSelection, cleanData };
