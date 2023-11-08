// Listen for headers being received specifically for api.structy.net

chrome.webRequest.onCompleted.addListener(
    (details) => {
        console.log("Headers received from api.structy.net:", details.url);
        console.log(details);

        if (details.url.includes("test-results")) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
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
