function initializeThemeSwitcher() {
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            document.body.setAttribute('data-theme', event.target.value);
        });
    });
}

export { initializeThemeSwitcher };