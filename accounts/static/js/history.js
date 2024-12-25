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

    // CSV History
    html += '<div class="csv-history">';
    html += '<h3>CSV History</h3>';
    modelHistory.csvs.forEach(csv => {
        html += `
            <div class="history-item">
                <span>${csv.fileName}</span>
                <span>${csv.timestamp}</span>
                <button onclick="downloadCSV('${csv.id}')">Download</button>
            </div>
        `;
    });
    html += '</div>';

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

export { saveModelRun, saveCSV, loadHistory, updateHistoryDisplay, downloadCSV, viewModelResults };
