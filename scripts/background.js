const clientId = "Ov23lizXQ4RuA48H6K1B";
const clientSecret = "eb05ae5eee96e801635bd85d495a69193558d2b7";

function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function handleOauth() {
  const state = generateState();
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}`;

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    (redirectUri) => {
      const urlParams = new URL(redirectUri).searchParams;
      const code = urlParams.get("code");
      const receivedState = urlParams.get("state");

      if (state !== receivedState) {
        throw new Error("Potential CSRF attack detected.");
      }

      exchangeCodeForToken(code);
    }
  );
}

function exchangeCodeForToken(code) {
  fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.access_token) {
        chrome.storage.local.set({ accessToken: data.access_token });
        chrome.runtime.sendMessage({ action: "login_successful" });
      } else {
        console.error("Failed to retrieve access token:", data);
      }
    })
    .catch((error) => {
      console.error("Error exchanging code for token:", error);
    });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "handle_oauth") {
    handleOauth();
  }
});

const languages = ["python3", "node", "cpp", "java"];

chrome.webRequest.onCompleted.addListener(
  (details) => {
    for (const language of languages) {
      if (details.url.includes(`/runtimes/${language}`)) {
        chrome.storage.local.set({ language });
      }
    }

    if (
      details.url.includes("test-results") &&
      details.tabId >= 0 &&
      details.statusCode === 200
    ) {
      chrome.tabs.sendMessage(details.tabId, { action: "submitted" });
    }
  },
  { urls: ["https://api.structy.net/api/*"] }
);
