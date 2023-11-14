function checkPassedAllTests(verbose = false) {
    if (verbose) {
        console.log("Checking to see whether all tests passed...");
    }

    const passedTests = document.querySelectorAll(".far.fa-check-circle");
    const failedTests = document.querySelectorAll(".far.fa-times-circle");
    const didNotTest = document.querySelectorAll(".far.fa-circle")
    const allTests = [...passedTests, ...failedTests, ...didNotTest];

    if (verbose) {
        console.log("All tests length: ", allTests.length);
    }

    if (allTests.length === 0) {
        return false;
    }

    if (failedTests.length) {
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

function joinNodeListText(nodeList, joinWith = "\n") {
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

function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['accessToken'], function (result) {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result.accessToken);
            }
        });
    });
}

async function getAuthenticatedUser(token) {
    const url = `https://api.github.com/user`;
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error('Failed to fetch authenticated user details.');
    }

    const userData = await response.json();
    return userData.login; // GitHub username of authenticated user
}

async function createRepo(token, repoName, isPrivate = true) {
    const url = 'https://api.github.com/user/repos';
    const headers = {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
    };

    const body = JSON.stringify({
        name: repoName,
        private: isPrivate,
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating repository: ', error);
    }
}

async function checkIfRepoExists(token, owner, repoName) {
    const url = `https://api.github.com/repos/${owner}/${repoName}`;
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        return false;  // If the repo exists, response.ok will be true
    }

    const data = await response.json();
    return data
}

async function createRepoIfNotExists(token, owner, repoName, isPrivate) {
    const repoExists = await checkIfRepoExists(token, owner, repoName);
    if (!repoExists) {
        const repo = await createRepo(token, repoName, isPrivate);
        const readmeContent = 'With love from StructyHub';
        await initializeRepoWithReadme(token, owner, repoName, readmeContent);
        return repo
    } else {
        return repoExists;
    }
}

async function initializeRepoWithReadme(token, owner, repoName, readmeContent) {
    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`;
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const data = {
        message: 'StructyHub repo initialization',
        content: btoa(readmeContent) // Base64 encode the README content
    };

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to initialize repository with README.');
        }

    } catch (error) {
        console.error('Error initializing repository:', error);
    }
}

function b64DecodeUnicode(str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    // See https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    return decodeURIComponent(atob(str).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

async function checkForChanges(token, owner, repo, branch, filepath, newContent, readmeFilepath, newReadmeContent, headers) {
    async function fetchFileContent(path) {
        const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
        const response = await fetch(fileUrl, { headers });
        if (!response.ok) return null;
        const data = await response.json();
        return b64DecodeUnicode(data.content);
    }

    const currentContent = await fetchFileContent(filepath);
    const currentReadmeContent = await fetchFileContent(readmeFilepath);

    return currentContent !== newContent || currentReadmeContent !== newReadmeContent;
}

async function createCommit(token, owner, repo, branch, commitMessage, content, filepath, readmeFilepath, readmeContent) {
    const headers = {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
    };

    // Get the reference of the branch (to get the latest commit SHA)
    const branchUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`;
    const branchResponse = await fetch(branchUrl, { headers });
    const branchData = await branchResponse.json();
    const latestCommitSha = branchData.object.sha;

    // Get the SHA of the tree associated with the latest commit
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`;
    const commitResponse = await fetch(commitUrl, { headers });
    const commitData = await commitResponse.json();
    const treeSha = commitData.tree.sha;

    // Check if the content of the files has changed
    // const hasChanges = await checkForChanges(token, owner, repo, branch, filepath, content, readmeFilepath, readmeContent, headers);
    // if (!hasChanges) {
    //     return; // Abort if no changes are detected
    // }

    // Create a new tree with the content for the commit
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees`;
    const treeBody = JSON.stringify({
        base_tree: treeSha,
        tree: [{
            path: filepath,
            mode: '100644',
            type: 'blob',
            content: content
        },
        {
            path: readmeFilepath,
            mode: '100644',
            type: 'blob',
            content: readmeContent
        }]
    });

    const treeResponse = await fetch(treeUrl, {
        method: 'POST',
        headers: headers,
        body: treeBody
    });
    const treeData = await treeResponse.json();
    const newTreeSha = treeData.sha;

    // Create a new commit
    const newCommitUrl = `https://api.github.com/repos/${owner}/${repo}/git/commits`;
    const newCommitBody = JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [latestCommitSha]
    });

    const newCommitResponse = await fetch(newCommitUrl, {
        method: 'POST',
        headers: headers,
        body: newCommitBody
    });
    const newCommitData = await newCommitResponse.json();
    const newCommitSha = newCommitData.sha;

    // Update the branch to point to the new commit
    const updateBranchUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`;
    const updateBranchBody = JSON.stringify({ sha: newCommitSha });

    const updateBranchResponse = await fetch(updateBranchUrl, {
        method: 'PATCH',
        headers: headers,
        body: updateBranchBody
    });

    if (updateBranchResponse.ok) {
    } else {
        console.error(`Error creating commit: ${updateBranchResponse.statusText}`);
    }
}

function main() {
    chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
        switch (request.action) {
            case "network_request_completed": {
                // Slight delay to ensure UI has updated
                await sleep(250);
                const passedAllTests = checkPassedAllTests(verbose = false);
                if (passedAllTests) {
                    const languageExtension = getLanguageExtension();
                    const code = getSubmissionCode();
                    const txt = getProblemText();

                    const repoName = "Structy-Hub";
                    const isPrivate = false;
                    const accessToken = await getAccessToken();
                    const owner = await getAuthenticatedUser(accessToken);
                    const repo = await createRepoIfNotExists(accessToken, owner, repoName, isPrivate);
                    await sleep(100);

                    const branch = "main";
                    const content = code;
                    const cleanedTitle = txt.title.split(" ").join("_");
                    const codeFilepath = `${cleanedTitle}/${cleanedTitle}${languageExtension}`;
                    const readmeFilepath = `${cleanedTitle}/README.txt`;
                    const commitMessage = `Solved '${txt.title}' (${languageExtension})`;

                    await createCommit(accessToken, owner, repo.name, branch, commitMessage, content, codeFilepath, readmeFilepath, txt.body);
                }
                break;
            }

            default:
                break;
        }
    });
}




main();
