class TableManager {
    constructor() {
        this.customTableColumns = [];
        this.init();
    }

    init() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const addColumnBtn = document.getElementById('add-column-btn');
        if (addColumnBtn) {
            addColumnBtn.addEventListener('click', () => this.addColumn());
        }

        const addRowBtn = document.getElementById('add-row-btn');
        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => this.addRow());
        }

        const saveXlsBtn = document.getElementById('save-xls-btn');
        if (saveXlsBtn) {
            saveXlsBtn.addEventListener('click', () => this.saveAsExcel());
        }
    }

    addColumn() {
        const columnNameInput = document.getElementById('column-name');
        const columnName = columnNameInput.value.trim();

        if (!columnName) return;

        this.customTableColumns.push(columnName);

        // Update table header
        const tableColumns = document.getElementById('table-columns');
        if (tableColumns) {
            const th = document.createElement('th');
            th.textContent = columnName;
            tableColumns.appendChild(th);

            // Add new cell to each existing row
            const tbody = document.querySelector('#custom-table tbody');
            if (tbody) {
                tbody.querySelectorAll('tr').forEach(row => {
                    const td = document.createElement('td');
                    td.innerHTML = '<input type="text" placeholder="Enter data">';
                    row.appendChild(td);
                });
            }
        }

        columnNameInput.value = '';
    }

    addRow() {
        const tbody = document.querySelector('#custom-table tbody');
        if (!tbody) return;

        const tr = document.createElement('tr');
        this.customTableColumns.forEach(() => {
            const td = document.createElement('td');
            td.innerHTML = '<input type="text" placeholder="Enter data">';
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    }

    async saveAsExcel() {
        try {
            // Get table data
            const headers = Array.from(document.querySelectorAll('#table-columns th'))
                .map(th => th.textContent);

            const rows = Array.from(document.querySelectorAll('#custom-table tbody tr'))
                .map(row => Array.from(row.querySelectorAll('input'))
                    .map(input => input.value));

            const data = [headers, ...rows];

            // Create and save Excel file
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            XLSX.writeFile(wb, 'custom_table.xlsx');

            this.showAlert('Table saved successfully as Excel file!', 'success');
        } catch (error) {
            console.error('Error saving custom table:', error);
            this.showAlert('Error saving table as Excel file');
        }
    }

    showAlert(message, type = 'error') {
        alert(message);
    }
}

export { TableManager };
