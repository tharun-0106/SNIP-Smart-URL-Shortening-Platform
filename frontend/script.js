/**
 * script.js — SNIP URL Shortener Frontend Logic
 *
 * Handles:
 *   - Shortening URLs via POST /shorten
 *   - Displaying results and short links
 *   - Fetching analytics via GET /stats/{short_id}
 *   - Persisting a local history of snipped URLs
 *   - Copy-to-clipboard functionality
 */

"use strict";

// ── Configuration ───────────────────────────────────────────────────────────
// Change this to your deployed backend URL in production
const API_BASE = "http://localhost:8000";

// ── State ────────────────────────────────────────────────────────────────────
let currentShortId = null;     // The active short ID for analytics polling
let history = loadHistory();   // Array of { shortId, shortUrl, originalUrl }

// ── DOM Refs ─────────────────────────────────────────────────────────────────
const urlInput          = document.getElementById("urlInput");
const shortenBtn        = document.getElementById("shortenBtn");
const btnLoader         = document.getElementById("btnLoader");
const errorMsg          = document.getElementById("errorMsg");

const resultCard        = document.getElementById("resultCard");
const shortLinkDisplay  = document.getElementById("shortLinkDisplay");
const originalUrlDisplay = document.getElementById("originalUrlDisplay");
const copyBtn           = document.getElementById("copyBtn");
const copyLabel         = document.getElementById("copyLabel");

const analyticsCard     = document.getElementById("analyticsCard");
const clickCount        = document.getElementById("clickCount");
const shortIdDisplay    = document.getElementById("shortIdDisplay");
const createdAtDisplay  = document.getElementById("createdAtDisplay");

const historyCard       = document.getElementById("historyCard");
const historyList       = document.getElementById("historyList");

// ── Event Listeners ───────────────────────────────────────────────────────────

// Allow pressing Enter in the input to trigger shortening
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") shortenURL();
});

// Clear error when user starts typing
urlInput.addEventListener("input", () => {
  errorMsg.textContent = "";
});

// ── Core: Shorten URL ─────────────────────────────────────────────────────────

/**
 * Reads the URL input, calls POST /shorten, and displays the result.
 * Handles loading state, errors, and history persistence.
 */
async function shortenURL() {
  const url = urlInput.value.trim();

  // Basic client-side guard
  if (!url) {
    showError("Please enter a URL to shorten.");
    shakeInput();
    return;
  }

  // Show loading state
  setLoading(true);
  clearError();

  try {
    const response = await fetch(`${API_BASE}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      // FastAPI returns { detail: "..." } on errors
      throw new Error(data.detail || "Failed to shorten URL.");
    }

    // ── Success: display result ──
    currentShortId = data.short_id;
    displayResult(data);
    await fetchAndDisplayStats(data.short_id);
    addToHistory(data);
    renderHistory();

    // Smooth scroll to result
    setTimeout(() => resultCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// ── Display Result ─────────────────────────────────────────────────────────────

/**
 * Populates and reveals the result card with the shortened URL data.
 * @param {{ short_url: string, original_url: string }} data
 */
function displayResult(data) {
  shortLinkDisplay.href = data.short_url;
  shortLinkDisplay.textContent = data.short_url;
  originalUrlDisplay.textContent = data.original_url;

  // Reveal card with entrance animation
  resultCard.style.display = "block";
  resultCard.style.animation = "none";
  void resultCard.offsetWidth; // Reflow to restart animation
  resultCard.style.animation = "cardReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both";

  // Reset copy button
  copyLabel.textContent = "COPY";
  copyBtn.classList.remove("copied");
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * Fetch stats from GET /stats/{short_id} and update the analytics card.
 * @param {string} shortId
 */
async function fetchAndDisplayStats(shortId) {
  try {
    const response = await fetch(`${API_BASE}/stats/${shortId}`);

    if (!response.ok) return;

    const stats = await response.json();

    // Animate counter from current value to new value
    animateCounter(clickCount, parseInt(clickCount.textContent) || 0, stats.click_count);

    shortIdDisplay.textContent = stats.short_id;
    createdAtDisplay.textContent = formatDate(stats.created_at);

    // Reveal analytics card
    analyticsCard.style.display = "block";
    analyticsCard.style.animation = "none";
    void analyticsCard.offsetWidth;
    analyticsCard.style.animation = "cardReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both";

  } catch (err) {
    console.warn("Could not fetch stats:", err.message);
  }
}

/**
 * Refresh stats for the currently active short link.
 * Called by the "Refresh Stats" button.
 */
async function refreshStats() {
  if (!currentShortId) return;

  const refreshIcon = document.getElementById("refreshIcon");
  refreshIcon.style.animation = "spin 0.7s linear infinite";

  await fetchAndDisplayStats(currentShortId);

  // Pulse the click count to draw attention
  clickCount.classList.remove("pop");
  void clickCount.offsetWidth;
  clickCount.classList.add("pop");

  refreshIcon.style.animation = "";
}

// ── Copy to Clipboard ─────────────────────────────────────────────────────────

/**
 * Copies the short URL to the clipboard and gives visual feedback.
 */
async function copyLink() {
  const shortUrl = shortLinkDisplay.textContent;
  if (!shortUrl) return;

  try {
    await navigator.clipboard.writeText(shortUrl);
    copyLabel.textContent = "✓ COPIED";
    copyBtn.classList.add("copied");

    // Reset after 2 seconds
    setTimeout(() => {
      copyLabel.textContent = "COPY";
      copyBtn.classList.remove("copied");
    }, 2000);
  } catch {
    // Fallback for browsers that block clipboard without HTTPS
    selectText(shortLinkDisplay);
    copyLabel.textContent = "SELECTED";
    setTimeout(() => { copyLabel.textContent = "COPY"; }, 2000);
  }
}

/**
 * Fallback: selects the text content of an element.
 * @param {HTMLElement} el
 */
function selectText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── History ───────────────────────────────────────────────────────────────────

/**
 * Adds a new snip to the in-memory and localStorage history (max 10 entries).
 * @param {{ short_id: string, short_url: string, original_url: string }} data
 */
function addToHistory(data) {
  // Avoid duplicates
  history = history.filter(item => item.shortId !== data.short_id);

  history.unshift({
    shortId:     data.short_id,
    shortUrl:    data.short_url,
    originalUrl: data.original_url,
    clicks:      0,
  });

  // Keep only the last 10 entries
  if (history.length > 10) history = history.slice(0, 10);

  saveHistory();
}

/**
 * Renders all history items into the history card.
 */
function renderHistory() {
  if (history.length === 0) {
    historyCard.style.display = "none";
    return;
  }

  historyCard.style.display = "block";
  historyList.innerHTML = "";

  history.forEach((item, index) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.style.animationDelay = `${index * 0.05}s`;
    el.innerHTML = `
      <span class="history-short">${item.shortUrl.replace("http://", "")}</span>
      <span class="history-orig">${item.originalUrl}</span>
      <span class="history-clicks">${item.clicks} clicks</span>
    `;

    // Clicking a history item loads its stats
    el.addEventListener("click", () => loadHistoryItem(item));
    historyList.appendChild(el);
  });
}

/**
 * Loads a history item into the main view.
 * @param {{ shortId: string, shortUrl: string, originalUrl: string }} item
 */
async function loadHistoryItem(item) {
  currentShortId = item.shortId;

  displayResult({
    short_url:    item.shortUrl,
    original_url: item.originalUrl,
  });

  await fetchAndDisplayStats(item.shortId);
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveHistory() {
  try {
    localStorage.setItem("snip_history", JSON.stringify(history));
  } catch { /* Ignore storage errors */ }
}

function loadHistory() {
  try {
    const stored = localStorage.getItem("snip_history");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

/**
 * Toggles the loading state of the shorten button.
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
  if (isLoading) {
    shortenBtn.classList.add("loading");
    shortenBtn.disabled = true;
    urlInput.disabled = true;
  } else {
    shortenBtn.classList.remove("loading");
    shortenBtn.disabled = false;
    urlInput.disabled = false;
  }
}

/** Displays an error message below the input. */
function showError(msg) {
  errorMsg.textContent = msg;
}

/** Clears the error message. */
function clearError() {
  errorMsg.textContent = "";
}

/** Shakes the input field to signal invalid input. */
function shakeInput() {
  urlInput.style.animation = "none";
  void urlInput.offsetWidth;
  urlInput.style.animation = "shakeInput 0.4s ease";
}

/**
 * Animates a numeric counter from `from` to `to`.
 * @param {HTMLElement} el  - The element to update
 * @param {number} from     - Starting value
 * @param {number} to       - Target value
 */
function animateCounter(el, from, to) {
  const duration = 600;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);

    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = to;
  }

  requestAnimationFrame(update);
}

/**
 * Formats an ISO-8601 timestamp into a human-readable local time.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month:  "short",
      day:    "numeric",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

// ── CSS Animation for shake ───────────────────────────────────────────────────
const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shakeInput {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-8px); }
    40%       { transform: translateX(8px); }
    60%       { transform: translateX(-6px); }
    80%       { transform: translateX(6px); }
  }
`;
document.head.appendChild(shakeStyle);

// ── Init ──────────────────────────────────────────────────────────────────────

// Render any persisted history on page load
if (history.length > 0) renderHistory();

// Expose globals for onclick handlers in HTML
window.shortenURL   = shortenURL;
window.copyLink     = copyLink;
window.refreshStats = refreshStats;
