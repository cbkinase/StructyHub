console.log("Running the content script");

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
    const LANGUAGE_CONVERTER = {
        nodelogo: ".js",
        python3logo: ".py",
        cpplogo: ".cpp",
        javalogo: ".java"
    }

    const images = document.querySelectorAll("img");
    const imageOfInterest = images[1];
    return LANGUAGE_CONVERTER[imageOfInterest.alt];
}

function joinNodeListText(nodeList, joinWith="\n") {
    const result = []
    nodeList.forEach(line => result.push(line.innerText));
    return result.join(joinWith);
}

function getSubmissionCode() {
    const lines = document.querySelectorAll("pre.CodeMirror-line");
    return joinNodeListText(lines);
}

function getProblemText() {
    let txtHeader;
    let txtBody;

    try {
        txtHeader = document.querySelectorAll("h2")[0].innerText;
        txtBody = document.querySelectorAll("h2 ~ *");
    } catch {
        txtHeader = document.querySelectorAll("h1")[0].innerText;
        txtBody = document.querySelectorAll("h1 ~ *");
    }

    return { title: txtHeader, body: joinNodeListText(txtBody, "\n\n") };
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

function listenForTestSubmissions() {
    chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
        if (request.action === "network_request_completed") {
            await sleep(250);
            const passedAllTests = checkPassedAllTests(verbose = false);
            console.log("Passed all tests: ", passedAllTests);
            if (passedAllTests) {
                const languageExtension = getLanguageExtension();
                console.log(languageExtension);

                const code = getSubmissionCode();
                console.log(code);

                const txt = getProblemText();
                console.log(txt);
            }
        }
    });
}

listenForTestSubmissions();
