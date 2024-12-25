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

export { initializeNavigation, initializeWorkflowNavigation };
