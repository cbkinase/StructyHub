console.log("Running the content script");

function checkPassedAllTests(verbose = true) {
    console.log("Checking to see whether all tests passed...");
    const passedTests = document.querySelectorAll(".far.fa-check-circle");
    const failedTests = document.querySelectorAll(".far.fa-times-circle");
    const didNotTest = document.querySelectorAll(".far.fa-circle")
    const allTests = [...passedTests, ...failedTests, ...didNotTest];

    if (allTests.length === 0) {
        return false;
    }

    if (failedTests.length || didNotTest.length) {
        return false;
    }

    if (verbose) {
        console.log("Passed:", passedTests.length);
        console.log("Failed:", failedTests.length);
        console.log("Did not test:", didNotTest.length);
    }


    if (allTests.length === passedTests.length) {
        return true;
    }
}

function listenForTestSubmissions() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === "network_request_completed") {
            console.log("Network request completed - message received in content script");
            const result = checkPassedAllTests();
            console.log("Passed all tests: ", result);
        }
    });
}

listenForTestSubmissions();
