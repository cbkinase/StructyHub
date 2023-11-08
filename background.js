// Listen for each HTTP request to api.structy.net

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        console.log("Request made to Structy.net:", details);
    },
    {
        urls: [
            "https://api.structy.net/api/*"
        ]
    }
);

// Listen for headers being received specifically for api.structy.net

chrome.webRequest.onCompleted.addListener(
    (details) => {
        console.log("Headers received from Structy.net:", details.url);
        console.log(details);

        if (details.url.includes("test-results")) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                console.log(tabs);
                chrome.tabs.sendMessage(tabs[0].id, { action: "network_request_completed" });
            });
        }

    },
    {
        urls: [
            "https://api.structy.net/api/*"
        ]
    },
    ["responseHeaders"]
);
