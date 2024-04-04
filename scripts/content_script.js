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

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
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

async function getSubmissionCode() {
    /*
    Oh god, why...

    Well, for anyone reading this wondering, "wtf is going on?"
    It's because CodeMirror virtualizes "distant" parts of the page.

    Do I hate this solution? Yes. Does it seem to be necessary? Also yes.
    */
    const nodes = new Set();
    const box = document.querySelector(".cm-theme").parentNode.parentNode;
    box.scrollTop = 0;
    // TODO: should find the proper number of iterations more dynamically
    for (let i = 0; i < 10; i++) {
        const lines = document.querySelectorAll(".cm-line");
        lines.forEach((line) => nodes.add(line));
        box.scrollTop += 300;
        // For whatever reason, a slight delay is needed here
        // Or the next iteration won't actually update `lines`
        await sleep(5);
    }
    return joinNodeListText(Array.from(nodes));
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
        const readmeContent = `# ${repoName}\nMade with [StructyHub](https://github.com/cbkinase/StructyHub)`;
        await initializeRepoWithReadme(token, owner, repoName, readmeContent);
        // Allow some time for GH API to realize the repo isn't empty
        await sleep(1000);
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
        const resData = await response.json();
        chrome.storage.local.set({ cachedSha: resData.commit.sha, cachedShaTimestamp: Date.now() });

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

async function getLatestCommitSha(owner, repo, branch, headers) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['cachedSha', 'cachedShaTimestamp'], async (result) => {
            if (result.cachedShaTimestamp) {
                let thirtySeconds = 30 * 1000; // 30 seconds to invalidate
                let currentTime = Date.now();

                if (currentTime - result.cachedShaTimestamp < thirtySeconds) {
                    // The timestamp is within the invalidation period
                    resolve(result.cachedSha);
                } else {
                    // The timestamp is older than invalidation period
                    const branchUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`;
                    const branchResponse = await fetch(branchUrl, { headers });
                    const branchData = await branchResponse.json();
                    resolve(branchData.object.sha);
                }
            } else {
                // No cached SHA/timestamp found
                const branchUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`;
                const branchResponse = await fetch(branchUrl, { headers });
                const branchData = await branchResponse.json();
                resolve(branchData.object.sha);
            }
        });
    });
}

async function createCommit(token, owner, repo, branch, commitMessage, content, filepath, readmeFilepath, readmeContent) {
    const headers = {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
    };

    const latestCommitSha = await getLatestCommitSha(owner, repo, branch, headers);

    // Get the SHA of the tree associated with the latest commit
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`;
    const commitResponse = await fetch(commitUrl, { headers });
    const commitData = await commitResponse.json();
    const treeSha = commitData.tree.sha;

    // Check if the content of any of the files has changed
    const hasChanges = await checkForChanges(token, owner, repo, branch, filepath, content, readmeFilepath, readmeContent, headers);
    if (!hasChanges) {
        return; // Abort if no changes are detected
    }

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
        // Cache the SHA so high frequency submissions don't error out
        const data = await updateBranchResponse.json();
        chrome.storage.local.set({ cachedSha: data.object.sha, cachedShaTimestamp: Date.now() });
    } else {
        console.error(`Error creating commit: ${updateBranchResponse.statusText}`);
        throw new Error("Branch update failed...")
    }
}

function getRepoName() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['repoName'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (result.repoName) {
                resolve(result.repoName);
            } else {
                resolve("Structy-Hub");
            }
        });
    });
}

function main() {
    chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
        switch (request.action) {
            case "network_request_completed": {
                // Slight delay to ensure UI has updated
                await sleep(25);
                const passedAllTests = checkPassedAllTests(verbose = false);
                if (passedAllTests) {
                    const languageExtension = getLanguageExtension();
                    const code = await getSubmissionCode();
                    const txt = getProblemText();

                    const repoName = await getRepoName();
                    const isPrivate = false;
                    const accessToken = await getAccessToken();
                    const owner = await getAuthenticatedUser(accessToken);
                    const repo = await createRepoIfNotExists(accessToken, owner, repoName, isPrivate);

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
