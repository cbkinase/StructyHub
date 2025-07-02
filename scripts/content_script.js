function chromeStorageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result[key]);
    });
  });
}

async function getAccessToken() {
  const token = await chromeStorageGet("accessToken");
  if (!token) throw new Error("No access token found");
  return token;
}

function checkPassedAllTests(verbose = false) {
  if (verbose) {
    console.log("Checking to see whether all tests passed...");
  }

  const passedTests = document.querySelectorAll(".far.fa-check-circle");
  const failedTests = document.querySelectorAll(".far.fa-times-circle");
  const didNotTest = document.querySelectorAll(".far.fa-circle");
  const allTests = [...passedTests, ...failedTests, ...didNotTest];

  if (verbose) {
    console.log("All tests length: ", allTests.length);
    console.log("Passed:", passedTests.length);
    console.log("Failed:", failedTests.length);
    console.log("Did not test:", didNotTest.length);
  }

  return (
    allTests.length > 0 &&
    failedTests.length === 0 &&
    allTests.length === passedTests.length
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function languageToExtension(language) {
  const LANGUAGE_EXTENSION_MAP = {
    node: ".js",
    python3: ".py",
    cpp: ".cpp",
    java: ".java",
  };
  return LANGUAGE_EXTENSION_MAP[language] || ".txt";
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(`https://api.github.com${url}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub request failed: ${response.status} ${details}`);
  }

  return response.json();
}

async function getAuthenticatedUser(token) {
  const userData = await githubRequest("/user", token);
  return userData.login;
}

async function createRepo(token, repoName, isPrivate = true) {
  return await githubRequest("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({ name: repoName, private: isPrivate }),
  });
}

async function checkIfRepoExists(token, owner, repoName) {
  try {
    return await githubRequest(`/repos/${owner}/${repoName}`, token);
  } catch {
    return false;
  }
}

async function initializeRepoWithReadme(token, owner, repoName, readmeContent) {
  await githubRequest(`/repos/${owner}/${repoName}/contents/README.md`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: "StructyHub repo initialization",
      content: btoa(readmeContent),
    }),
  });
}

async function createRepoIfNotExists(token, owner, repoName, isPrivate) {
  let repo = await checkIfRepoExists(token, owner, repoName);
  if (!repo) {
    repo = await createRepo(token, repoName, isPrivate);
    const readmeContent = `# ${repoName}\nMade with [StructyHub](https://github.com/cbkinase/StructyHub)`;
    await initializeRepoWithReadme(token, owner, repoName, readmeContent);
    // Allow some time for GH API to realize the repo isn't empty
    await sleep(1000);
  }
  return repo;
}

async function createCommit(
  token,
  owner,
  repo,
  branch,
  commitMessage,
  codeContent,
  codePath,
  readmeContent,
  readmePath,
) {
  const latestCommitData = await githubRequest(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    token,
  );
  const latestCommitSha = latestCommitData.object.sha;
  const commitDetails = await githubRequest(
    `/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
    token,
  );

  const tree = await githubRequest(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: commitDetails.tree.sha,
      tree: [
        { path: codePath, mode: "100644", type: "blob", content: codeContent },
        {
          path: readmePath,
          mode: "100644",
          type: "blob",
          content: readmeContent,
        },
      ],
    }),
  });

  const newCommit = await githubRequest(
    `/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        message: commitMessage,
        tree: tree.sha,
        parents: [latestCommitSha],
      }),
    },
  );

  await githubRequest(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    },
  );
}

function getProblemSlug() {
  const slug = window.location.pathname.split("/").at(-1);
  if (!slug) throw new Error("Unable to get URL");
  return slug;
}

async function getProblemInfo(slug) {
  const url = window.location.pathname;
  let path;

  // Check if the problem is premium
  if (url.includes("premium")) {
    path = `premium/${slug}`;
  } else {
    path = slug;
  }

  const response = await fetch(`https://api.structy.net/api/problems/${path}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Structy request failed: ${response.status} ${details}`);
  }

  return response.json();
}

async function getProblemAnswer(slug, language) {
  const response = await fetch(
    `https://api.structy.net/api/code/problems/${slug}/runtimes/${language}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Structy request failed: ${response.status} ${details}`);
  }

  return response.json();
}

function sanitize(str) {
  return str
    .trim()
    .replace(/[^\w- ]/g, "")
    .replace(/\s+/g, "-");
}

function showToast(message, success = true, duration = 3000) {
  const toast = document.createElement("div");
  toast.id = "structyhub-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "10px 16px",
    borderRadius: "4px",
    color: "#ffffff",
    backgroundColor: success ? "#00C49A" : "#FF4500",
    fontSize: "14px",
    fontWeight: "600",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.3s",
  });

  document.body.appendChild(toast);
  // Trigger fade-in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  // Fade-out and remove after the specified duration
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.addEventListener("transitionend", () => toast.remove());
  }, duration);
}

async function main() {
  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.action !== "submitted") return;
    if (!checkPassedAllTests()) return;

    try {
      const language = await chromeStorageGet("language");
      const slug = getProblemSlug();

      if (!language) {
        throw new Error("Setup error: Language is not set");
      }

      const languageExtension = languageToExtension(language);
      const repoName = (await chromeStorageGet("repoName")) || "Structy-Hub";
      const accessToken = await getAccessToken();
      const isPrivate = false;

      const [{ environments, module, number, name }, { code }] =
        await Promise.all([
          getProblemInfo(slug),
          getProblemAnswer(slug, language),
        ]);
      const readmeContent = environments[language].prompt;

      const owner = await getAuthenticatedUser(accessToken);
      const cleanedName = sanitize(name);
      const formattedNumber = number.toString().padStart(3, "0");
      const pathPrefix = `${sanitize(
        module,
      )}/${formattedNumber}-${cleanedName}`;
      const branch = "main";
      const commitMessage = `Solved '${name}' (${language})`;
      const codePath = `${pathPrefix}/${cleanedName}${languageExtension}`;
      const readmePath = `${pathPrefix}/README.md`;

      await createRepoIfNotExists(accessToken, owner, repoName, isPrivate);
      await createCommit(
        accessToken,
        owner,
        repoName,
        branch,
        commitMessage,
        code,
        codePath,
        readmeContent,
        readmePath,
      );

      showToast("Successfully uploaded to GitHub!", true);
    } catch (error) {
      console.error(error);
      showToast("Failed to upload to GitHub", false);
    }
  });
}

main();