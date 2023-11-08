console.log("Running the content script");

const LANGUAGE_CONVERTER = {
    nodelogo: ".js",
    python3logo: ".py",
    cpplogo: ".cpp",
    javalogo: ".java"
}

function checkPassedAllTests(verbose = true) {
    if (verbose) {
        console.log("Checking to see whether all tests passed...");
    }

    const passedTests = document.querySelectorAll(".far.fa-check-circle");
    const failedTests = document.querySelectorAll(".far.fa-times-circle");
    const didNotTest = document.querySelectorAll(".far.fa-circle")
    const allTests = [...passedTests, ...failedTests, ...didNotTest];

    console.log("All tests length: ", allTests.length);

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

function getLanguageExtension() {
    const images = document.querySelectorAll("img");
    const imageOfInterest = images[1];
    return LANGUAGE_CONVERTER[imageOfInterest.alt];
}

function getSubmissionCode() {
    const lines = document.querySelectorAll("pre.CodeMirror-line");
    const linesText = [];
    lines.forEach(line => linesText.push(line.innerText));
    return linesText.join("\n");
}

function listenForTestSubmissions() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === "network_request_completed") {
            const passedAllTests = checkPassedAllTests(verbose = false);
            console.log("Passed all tests: ", passedAllTests);
            if (passedAllTests) {
                const languageExtension = getLanguageExtension();
                console.log(languageExtension);

                const code = getSubmissionCode();
                console.log(code);
            }
        }
    });
}

listenForTestSubmissions();
