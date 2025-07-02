function chromeStorageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result[key]);
    });
  });
}

/*      *** Dark-Light Mode Toggle ***       */

document.querySelectorAll(".color_mode_button").forEach((button) => {
  button.addEventListener("click", (event) => {
    const targetElement = /** @type {HTMLElement} */ (event.currentTarget);
    const elementId = targetElement.id;
    if (elementId === "enable_light_mode") {
      document.documentElement.setAttribute("data-color-mode", "light");
      localStorage.setItem("structyhub-data-color-mode", "light");
    } else if (elementId === "enable_dark_mode") {
      document.documentElement.setAttribute("data-color-mode", "dark");
      localStorage.setItem("structyhub-data-color-mode", "dark");
    } else {
      throw new Error(`unrecognized color mode button id ${elementId}.`);
    }
  });
});

if (localStorage.getItem("structyhub-data-color-mode") === "dark") {
  document.documentElement.setAttribute("data-color-mode", "dark");
}

/*     *** Login Handler ***       */

const loginButton = document.getElementById("loginButton");
const btnTxt = document.getElementById("btn-text");
const loginSpinner = document.getElementById("loginSpinner");
const toast = document.getElementById("toast");

function showSpinner() {
  if (loginSpinner) loginSpinner.classList.remove("hidden");
}

function hideSpinner() {
  if (loginSpinner) loginSpinner.classList.add("hidden");
}

function showToast(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.style.backgroundColor = isError
    ? "var(--red-bold)"
    : "var(--gh-button-background)";
  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 3000);
}

function applyLoggedInStyles() {
  btnTxt.innerText = "Authorized";
  loginButton.style.cursor = "text";
  loginButton.removeEventListener("click", handleOauth);
  hideSpinner();
}

function applyCheckingLoginStyles() {
  btnTxt.innerText = "Verifying Token";
  showSpinner();
  loginButton.style.cursor = "progress";
}

function applyLoggedOutStyles() {
  btnTxt.innerText = "Sign in with GitHub";
  hideSpinner();
  loginButton.style.cursor = "pointer";
}

async function checkLoginStatus() {
  applyCheckingLoginStyles();
  const token = await chromeStorageGet("accessToken");
  if (await validateToken(token)) {
    applyLoggedInStyles();
  } else {
    applyLoggedOutStyles();
  }
}

async function validateToken(token) {
  try {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function showPreferencesMenu() {
  const loginView = document.getElementById("loginView");
  const preferencesMenu = document.getElementById("preferencesMenu");
  const titleContainer = document.getElementById("title-container");
  const repoInput = document.getElementById("repoName");
  const repoName = await chromeStorageGet("repoName");
  repoInput.value = repoName ?? "Structy-Hub";

  if (loginView && preferencesMenu) {
    loginView.classList.remove("active");
    preferencesMenu.classList.add("active");
    // Hide the title when showing preferences
    if (titleContainer) {
      titleContainer.classList.add("hidden");
    }
  }
}

const preferencesStartButton = document.getElementById("preferences-start");
if (preferencesStartButton) {
  preferencesStartButton.addEventListener("click", showPreferencesMenu);
}

function showLoginView() {
  const loginView = document.getElementById("loginView");
  const preferencesMenu = document.getElementById("preferencesMenu");
  const titleContainer = document.getElementById("title-container");

  if (loginView && preferencesMenu) {
    preferencesMenu.classList.remove("active");
    loginView.classList.add("active");
    // Show the title when returning to login view
    if (titleContainer) {
      titleContainer.classList.remove("hidden");
    }
  }
}

function validatePreferences() {
  const repoName = document.getElementById("repoName").value;
  const errorRepoName = document.getElementById("errorRepoName");
  const repoNameRegex = /^[a-zA-Z0-9]+[a-zA-Z0-9-_]*[a-zA-Z0-9]+$/;
  errorRepoName.textContent = "";

  if (repoName.length > 100 || !repoNameRegex.test(repoName)) {
    errorRepoName.textContent = "Invalid repository name";
    return false;
  }

  return true;
}

const preferencesForm = document.getElementById("preferencesForm");
if (preferencesForm) {
  preferencesForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (validatePreferences()) {
      const repoName = document.getElementById("repoName").value;
      const submitButton = preferencesForm.querySelector(
        'button[type="submit"]'
      );

      // Save the preferences
      chrome.storage.local.set({ repoName });

      // Change button to show success state
      submitButton.textContent = "Saved!";
      submitButton.classList.add("saved");
      submitButton.disabled = true;

      // Revert button
      setTimeout(() => {
        submitButton.textContent = "Save Preferences";
        submitButton.classList.remove("saved");
        submitButton.disabled = false;
        showLoginView();
      }, 1000);
    }
  });
}

const cancelPreferencesButton = document.getElementById("cancelPreferences");

if (cancelPreferencesButton) {
  cancelPreferencesButton.addEventListener("click", function () {
    showLoginView();
  });
}

/*     *** Event Listeners ***       */

function handleOauth() {
  btnTxt.innerText = "Authorizing...";
  showSpinner();
  chrome.runtime.sendMessage({ action: "handle_oauth" });
}

loginButton.addEventListener("click", handleOauth);
document.addEventListener("DOMContentLoaded", checkLoginStatus);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.action) {
    case "login_successful": {
      applyLoggedInStyles();
      showToast("Successfully logged in!");
      break;
    }
    default:
      break;
  }
});