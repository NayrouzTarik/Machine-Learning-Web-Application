import { initializeThemeSwitcher } from './theme.js';
import { initializeNavigation, initializeWorkflowNavigation } from './navigation.js';
import { initializeFileUpload } from './file_upload.js';
import { initializeModelSelection, cleanData } from './model_selection.js';
import { saveModelRun, saveCSV, loadHistory, updateHistoryDisplay, downloadCSV, viewModelResults } from './history.js';
import { TableManager } from './table_manager.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeWorkflowNavigation();
    initializeFileUpload();
    initializeThemeSwitcher();
    fetchWorkflowStats();
    initializeModelSelection();
    addCollapsibleSectionStyles(); 
    loadHistory();

    window.tableManager = new TableManager();

    const targetTypeSelect = document.getElementById('target-type');
    if (targetTypeSelect) {
        targetTypeSelect.addEventListener('change', function() {
            const selectedType = this.value;
            console.log('Target type changed to:', selectedType);
            updateFeatures(selectedType);
        });

        updateFeatures(targetTypeSelect.value);
    }
});

function showError(message) {
    console.error(message);
    const guidanceElement = document.getElementById('dataTypeRecommendation');
    if (guidanceElement) {
        guidanceElement.textContent = `Error: ${message}`;
        guidanceElement.style.color = 'red';
    }
}

async function getCompatibleFeatures(targetType) {
    try {
        console.log('Fetching features for:', targetType); 
        
        const response = await fetch('/get-compatible-features/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ target_type: targetType })
        });
        
        console.log('Response status:', response.status); 
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch features');
        }
        
        const features = await response.json();
        console.log('Received features:', features);
        return features;
    } catch (error) {
        showError(error.message);
        return [];
    }
}

async function updateFeatures(targetType) {
    console.log('Updating features for target type:', targetType);
    const featuresSelect = document.getElementById('features-name-target');
    if (!featuresSelect) return;

    try {
        // Show loading state
        featuresSelect.innerHTML = '<option value="">Loading...</option>';
        featuresSelect.disabled = true;

        const response = await fetch('/get-compatible-features/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken() // Make sure to implement getCsrfToken()
            },
            body: JSON.stringify({ target_type: targetType })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch features');
        }

        const features = await response.json();
        console.log('Received features:', features);

        // Clear and populate select
        featuresSelect.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = 'Select a feature';
        featuresSelect.appendChild(defaultOption);

        // Add feature options
        features.forEach(feature => {
            const option = document.createElement('option');
            option.value = feature;
            option.text = feature;
            featuresSelect.appendChild(option);
        });

        // Enable/disable based on clustering
        featuresSelect.disabled = targetType === 'clustering';

        // Update guidance
        const guidanceElement = document.getElementById('dataTypeRecommendation');
        if (guidanceElement) {
            const guidance = {
                'classification': 'Select a categorical target variable',
                'regression': 'Select a numerical target variable ',
                'clustering': 'No target variable needed for clustering'
            };
            guidanceElement.textContent = guidance[targetType] || '';
        }

    } catch (error) {
        console.error('Error updating features:', error);
        featuresSelect.innerHTML = '<option value="">Error loading features</option>';
    }
}

function getCsrfToken() {
    const csrfInput = document.querySelector('[name="csrfmiddlewaretoken"]');
    return csrfInput ? csrfInput.value : '';
}

function updateDataTypeGuidance(targetType) {
    const guidanceElement = document.getElementById('dataTypeRecommendation');
    if (!guidanceElement) return;

    const recommendations = {
        'classification': 'Select a categorical target variable',
        'regression': 'Select a numerical target variable',
        'clustering': 'No target variable needed'
    };

    guidanceElement.textContent = recommendations[targetType] || '';
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

function handleLogout(event) {
    event.preventDefault();
    const logoutForm = document.getElementById('logout-form');
    if (logoutForm) {
        logoutForm.submit();
    }
}
