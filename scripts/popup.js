console.log("Popup script running");

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('');
}

function sha256(plain) { // returns promise ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier) {
    const hashed = await sha256(codeVerifier);
    return base64urlencode(hashed);
}

function generateState() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function oauthFlow() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store codeVerifier and state in localStorage to retrieve after auth redirect
    localStorage.setItem('structyhub_pkce_code_verifier', codeVerifier);
    localStorage.setItem('structyhub_oauth_state', state);

    const authUrl = buildAuthUrl(codeChallenge, state);
    chrome.tabs.create({ url: authUrl });
}

function buildAuthUrl(codeChallenge, state) {
    const clientId = encodeURIComponent('your-client-id');
    const redirectUri = encodeURIComponent('your-redirect-uri');
    const scope = encodeURIComponent('your-requested-scopes');

    return `https://github.com/login/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
}

const loginButton = document.getElementById('loginButton');
loginButton.addEventListener('click', function () {
    oauthFlow();
});


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
