/*      *** Dark-Light Mode Toggle ***       */



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



/*     *** Login Handler ***       */



function getRepoName() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['repoName'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (result.repoName) {
                resolve(result.repoName);
            } else {
                resolve("");
            }
        });
    });
}

const loginButton = document.getElementById('loginButton');
const btnTxt = document.getElementById("btn-text");

function applyLoggedInStyles() {
    btnTxt.innerText = "Authorized";
    loginButton.style.cursor = "text";
    loginButton.removeEventListener('click', handleOauth);
}

function applyCheckingLoginStyles() {
    btnTxt.innerText = "Verifying Token";
}

function applyLoggedOutStyles() {
    btnTxt.innerText = "Sign in with GitHub";
}

function checkLoginStatus() {
    applyCheckingLoginStyles();
    chrome.storage.local.get(['accessToken'], function (result) {
        if (result.accessToken) {
            validateToken(result.accessToken, function (isValid) {
                if (isValid) {
                    applyLoggedInStyles();
                } else {
                    applyLoggedOutStyles();
                }
            });
        } else {
            applyLoggedOutStyles();
        }
    });
}

function validateToken(token, callback) {
    fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    }).then(response => {
        callback(response.ok);
    }).catch(error => {
        callback(false);
    });
}

function showPreferencesMenu() {
    const loginView = document.getElementById('loginView');
    const preferencesMenu = document.getElementById('preferencesMenu');
    const repoInput = document.getElementById("repoName");
    getRepoName().then(repoName => {
        repoInput.value = repoName;
    })

    if (loginView && preferencesMenu) {
        loginView.classList.remove('active');
        preferencesMenu.classList.add('active');
    }
}

const preferencesStartButton = document.getElementById('preferences-start');
if (preferencesStartButton) {
    preferencesStartButton.addEventListener('click', showPreferencesMenu);
}

function showLoginView() {
    const loginView = document.getElementById('loginView');
    const preferencesMenu = document.getElementById('preferencesMenu');

    if (loginView && preferencesMenu) {
        preferencesMenu.classList.remove('active');
        loginView.classList.add('active');
    }
}

function validatePreferences() {
    const repoName = document.getElementById("repoName").value;

    const errorRepoName = document.getElementById("errorRepoName");

    const repoNameRegex = /^[a-zA-Z0-9]+[a-zA-Z0-9-_]*[a-zA-Z0-9]+$/;

    errorRepoName.textContent = '';

    if (repoName.length > 100 || !repoNameRegex.test(repoName)) {
        errorRepoName.textContent = 'Invalid repository name';
        return false;
    }
    return true;
}

const preferencesForm = document.getElementById('preferencesForm');
if (preferencesForm) {
    preferencesForm.addEventListener('submit', function(event) {
        event.preventDefault();
        if (validatePreferences()) {
            const repoName = document.getElementById("repoName").value;
            chrome.storage.local.set({ repoName });
            showLoginView();
        }
    });
}

const cancelPreferencesButton = document.getElementById('cancelPreferences');

if (cancelPreferencesButton) {
    cancelPreferencesButton.addEventListener('click', function () {
        showLoginView();
    })
}



/*     *** Event Listeners ***       */



function handleOauth() {
    chrome.runtime.sendMessage({ action: "handle_oauth" });
}

loginButton.addEventListener('click', handleOauth);

document.addEventListener('DOMContentLoaded', checkLoginStatus);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case "login_successful": {
            applyLoggedInStyles();
            break;
        }
        default:
            break;
    }
});
