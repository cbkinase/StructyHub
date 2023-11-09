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

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case "send_data":
            storeData(request.data);
            console.log(request.data);
            break;
        case "request_data":
            sendResponse(retrieveData());
            break;
        default:
            break;
    }
});

function storeData(data) {
    // Logic to store data
}

function retrieveData() {
    // Logic to retrieve and return stored data
    return /* stored data */;
}
