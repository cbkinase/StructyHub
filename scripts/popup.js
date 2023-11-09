console.log("Popup script running");

document.querySelectorAll('.color_mode_button').forEach((button) => {
    button.addEventListener('click', (event) => {
        const targetElement = /** @type {HTMLElement} */ (event.currentTarget);
        const elementId = targetElement.id;
        if (elementId === 'enable_light_mode') {
            document.documentElement.setAttribute('data-color-mode', 'light');
            localStorage.setItem('structyhub-data-color-mode', 'light');
        } else if (elementId === 'enable_dark_mode') {
            document.documentElement.setAttribute('data-color-mode', 'dark');
            localStorage.setItem('structyhub-data-color-mode', 'dark');
        } else {
            throw new Error(`unrecognized color mode button id ${elementId}.`)
        }
    });
});

if (localStorage.getItem('structyhub-data-color-mode') === 'dark') {
    document.documentElement.setAttribute('data-color-mode', 'dark');
}

const loginButton = document.getElementById('loginButton');
loginButton.addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: "handle_oauth" });
});
