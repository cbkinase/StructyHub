// Initialize or retrieve the MRU tab history
chrome.storage.local.get(['tabHistory'], function (result) {
    let tabHistory = result.tabHistory || [];

    // Update tab history on tab activation
    chrome.tabs.onActivated.addListener(activeInfo => {
        updateTabHistory(activeInfo.tabId);
    });

    // Update tab history on tab URL update
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url && changeInfo.url.includes('structy.net')) {
            updateTabHistory(tabId);
        }
    });

    // Function to update tab history
    function updateTabHistory(tabId) {
        chrome.tabs.get(tabId, function (tab) {
            if (tab.url && tab.url.includes('structy.net')) {
                // Remove any previous entry for this tab
                tabHistory = tabHistory.filter(item => item.tabId !== tabId);
                // Add the tab with window ID to the end of the history
                tabHistory.push({ tabId: tabId, windowId: tab.windowId });
                // Update the stored tab history
                chrome.storage.local.set({ tabHistory: tabHistory });
            }
        });
    }

    // Remove tab from history on tab closure
    chrome.tabs.onRemoved.addListener(tabId => {
        // Remove the closed tab from the history
        tabHistory = tabHistory.filter(item => item.tabId !== tabId);
        // Update the stored tab history
        chrome.storage.local.set({ tabHistory: tabHistory });
    });

    // Listen for network requests and send a message to the MRU tab of structy.net
    chrome.webRequest.onCompleted.addListener(
        (details) => {
            if (details.url.includes("test-results")) {
                // Get the current window ID
                chrome.windows.getCurrent({ populate: false }, (currentWindow) => {
                    // Find the MRU tab for the current window
                    let mruTab = tabHistory.reverse().find(item => item.windowId === currentWindow.id);
                    if (mruTab) {
                        chrome.tabs.sendMessage(mruTab.tabId, { action: "network_request_completed" });
                    }
                });
            }
        },
        { urls: ["https://api.structy.net/api/*"] }
    );
});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case "handle_oauth":
            handleOauth();
            break;
        default:
            break;
    }
});

function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const clientId = 'c57a9d51b4a666b0790e';
const clientSecret = '';
const state = generateState();

const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}`;

function handleOauth() {
    chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        function (redirectUri) {
            const code = new URL(redirectUri).searchParams.get('code');
            const receivedState = new URL(redirectUri).searchParams.get('state');
            if (state !== receivedState) {
                throw new Error("Preventing possible CSRF attack");
            }
            exchangeCodeForToken(code);
        }
    );
}

function exchangeCodeForToken(code) {
    const tokenUrl = 'https://github.com/login/oauth/access_token';
    const body = new URLSearchParams();
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
    body.append('code', code);

    fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
        },
        body: body
    })
        .then(response => response.json())
        .then(data => {
            if (data.access_token) {
                chrome.storage.local.set({ accessToken: data.access_token });
                chrome.runtime.sendMessage({ action: "login_successful" });
            } else {
                console.error('Failed to retrieve access token:', data);
            }
        })
        .catch(error => {
            console.error('Error exchanging code for token:', error);
        });
}
