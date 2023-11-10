// Listen for headers being received specifically for api.structy.net

chrome.webRequest.onCompleted.addListener(
    (details) => {
        console.log("Headers received from api.structy.net:", details.url);
        if (details.url.includes("test-results")) {
            chrome.tabs.query({ url: ["https://structy.net/*", "https://www.structy.net/*"] }, function (tabs) {
                for (const tab of tabs) {
                    chrome.tabs.sendMessage(tab.id, { action: "network_request_completed" });
                }
            });
        }
    },
    {
        urls: [
            "https://api.structy.net/api/*"
        ]
    },
);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case "handle_oauth":
            handleOauth();
            break;
        default:
            break;
    }
});

const clientId = 'c57a9d51b4a666b0790e';
const clientSecret = '';

const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;

function handleOauth() {
    chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        function (redirectUri) {
            const code = new URL(redirectUri).searchParams.get('code');
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
