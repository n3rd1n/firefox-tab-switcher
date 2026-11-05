"use strict";

const searchEl = document.getElementById("search");
const listEl = document.getElementById("list");
const modeEl = document.getElementById("mode");
const msgEl = document.getElementById("msg");

const state = {
  windowId: Number(new URLSearchParams(location.search).get("win")), // browser window whose tabs we show
  selfWindowId: null,                                                // the switcher window itself
  tabs: [],        // order at open time (most recently used first), never re-sorted
  items: [],       // filtered entries: {tab, titlePos, urlPos}
  sel: 0,
  query: "",
  mode: "normal",  // "normal" | "search"
  pending: "",     // started key sequence: "d", "g", "m", "'"
  count: "",       // count before a command, e.g. 5j
  marks: {},       // letter -> tabId
  closing: false,
};

// ---------- Helpers ----------

function displayUrl(url) {
  return (url || "").replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function setMsg(text) {
  msgEl.textContent = text || "";
}

function selectedTab() {
  const item = state.items[state.sel];
  return item ? item.tab : null;
}

function focusSelf() {
  if (state.mode === "search") searchEl.focus();
  else listEl.focus();
}

function takeCount() {
  const n = parseInt(state.count, 10);
  state.count = "";
  return Number.isNaN(n) ? null : n;
}

async function closeSwitcher() {
  if (state.closing) return;
  state.closing = true;
  await browser.windows.update(state.windowId, { focused: true }).catch(() => {});
  await browser.windows.remove(state.selfWindowId).catch(() => {});
}

// ---------- Filtering & rendering ----------

function refilter(keepTabId) {
  const q = state.query.trim();
  if (!q) {
    state.items = state.tabs.map((tab) => ({ tab, titlePos: null, urlPos: null }));
  } else {
    const scored = [];
    for (const tab of state.tabs) {
      const m = matchTab(q, tab.title || "", displayUrl(tab.url));
      if (m) scored.push({ tab, score: m.score, titlePos: m.titlePos, urlPos: m.urlPos });
    }
    scored.sort((a, b) => b.score - a.score); // stable: ties keep MRU order
    state.items = scored;
  }
  const idx = keepTabId == null ? -1 : state.items.findIndex((it) => it.tab.id === keepTabId);
  state.sel = idx >= 0 ? idx : Math.min(state.sel, Math.max(0, state.items.length - 1));
  render();
}

function highlighted(text, positions) {
  const frag = document.createDocumentFragment();
  if (!positions || positions.size === 0) {
    frag.append(text);
    return frag;
  }
  let buf = "";
  let inMark = false;
  const flush = () => {
    if (!buf) return;
    if (inMark) {
      const m = document.createElement("mark");
      m.textContent = buf;
      frag.append(m);
    } else {
      frag.append(buf);
    }
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const hit = positions.has(i);
    if (hit !== inMark) {
      flush();
      inMark = hit;
    }
    buf += text[i];
  }
  flush();
  return frag;
}

function marksFor(tabId) {
  return Object.keys(state.marks).filter((k) => state.marks[k] === tabId).sort();
}

function render() {
  document.body.classList.toggle("search-mode", state.mode === "search");
  modeEl.textContent =
    (state.mode === "search" ? "SEARCH" : "NORMAL") + (state.count || state.pending ? " " + state.count + state.pending : "");

  listEl.textContent = "";
  if (!state.items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = state.query ? "No matches" : "No tabs";
    listEl.append(li);
    return;
  }

  state.items.forEach((item, i) => {
    const { tab } = item;
    const li = document.createElement("li");
    li.dataset.index = i;
    if (i === state.sel) li.classList.add("sel");
    if (tab.discarded) li.classList.add("discarded");

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = i === state.sel ? String(i + 1) : String(Math.abs(i - state.sel));

    const icon = document.createElement("span");
    icon.className = "favicon";
    if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
      const img = document.createElement("img");
      img.src = tab.favIconUrl;
      img.onerror = () => {
        img.remove();
        icon.classList.add("none");
      };
      icon.append(img);
    } else {
      icon.classList.add("none");
    }

    const title = document.createElement("div");
    title.className = "title";
    title.append(highlighted(tab.title || displayUrl(tab.url), item.titlePos));

    const badges = document.createElement("div");
    badges.className = "badges";
    if (tab.pinned) badges.append("📌");
    if (tab.audible) badges.append(tab.mutedInfo && tab.mutedInfo.muted ? "🔇" : "🔊");
    for (const k of marksFor(tab.id)) {
      const b = document.createElement("span");
      b.className = "mark";
      b.textContent = k;
      badges.append(b);
    }

    const url = document.createElement("div");
    url.className = "url";
    url.append(highlighted(displayUrl(tab.url), item.urlPos));

    li.append(num, icon, title, badges, url);
    listEl.append(li);
  });

  const selEl = listEl.children[state.sel];
  if (selEl) selEl.scrollIntoView({ block: "nearest" });
}

// ---------- Actions ----------

function activate(tab) {
  if (!tab) return;
  browser.tabs.update(tab.id, { active: true }).catch(() => {});
}

function moveTo(index) {
  if (!state.items.length) return;
  state.sel = Math.max(0, Math.min(state.items.length - 1, index));
  render();
  activate(selectedTab());
}

function move(delta) {
  moveTo(state.sel + delta);
}

async function confirmSelection() {
  const tab = selectedTab();
  if (tab) await browser.tabs.update(tab.id, { active: true }).catch(() => {});
  closeSwitcher();
}

function closeSelected() {
  const tab = selectedTab();
  if (!tab) return;
  const next = state.items[state.sel + 1] || state.items[state.sel - 1];
  if (next) activate(next.tab);
  browser.tabs.remove(tab.id);
  setMsg(`Closed: ${tab.title || displayUrl(tab.url)}`);
}

async function restoreClosed() {
  const recent = await browser.sessions.getRecentlyClosed({ maxResults: 25 });
  const entry = recent.find((e) => e.tab);
  if (!entry) {
    setMsg("No closed tab to restore");
    return;
  }
  await browser.sessions.restore(entry.tab.sessionId);
  // Restoring brings the browser window to the front – take focus back
  await browser.windows.update(state.selfWindowId, { focused: true }).catch(() => {});
  setMsg(`Restored: ${entry.tab.title || displayUrl(entry.tab.url)}`);
}

function setMark(letter) {
  const tab = selectedTab();
  if (!tab) return;
  state.marks[letter] = tab.id;
  browser.storage.session.set({ marks: state.marks });
  setMsg(`Mark ${letter} set`);
  render();
}

async function jumpToMark(letter) {
  const id = state.marks[letter];
  let tab = null;
  if (id != null) tab = await browser.tabs.get(id).catch(() => null);
  if (!tab) {
    setMsg(`Mark ${letter} not set`);
    return;
  }
  if (tab.windowId !== state.windowId) {
    // Tab in another window: switch there and close the switcher
    await browser.tabs.update(tab.id, { active: true });
    state.windowId = tab.windowId;
    closeSwitcher();
    return;
  }
  if (!state.items.some((it) => it.tab.id === tab.id)) {
    state.query = "";
    searchEl.value = "";
  }
  refilter(tab.id);
  activate(tab);
  setMsg(`Mark ${letter}`);
}

function enterSearch() {
  state.mode = "search";
  state.pending = "";
  state.count = "";
  searchEl.focus();
  searchEl.select();
  render();
}

function leaveSearch() {
  state.mode = "normal";
  listEl.focus();
  render();
}

// ---------- Keyboard ----------

function handleCtrlNav(e) {
  if (!e.ctrlKey || e.altKey || e.metaKey) return false;
  const k = e.key.toLowerCase();
  if (k === "j" || k === "n") move(1);
  else if (k === "k" || k === "p") move(-1);
  else return false;
  e.preventDefault();
  return true;
}

function onNormalKey(e) {
  if (handleCtrlNav(e)) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return; // let browser shortcuts through

  const key = e.key;
  if (key === "Shift") return;

  if (state.pending) {
    const p = state.pending;
    state.pending = "";
    state.count = "";
    e.preventDefault();
    if (p === "d" && key === "d") closeSelected();
    else if (p === "g" && key === "g") moveTo(0);
    else if (p === "m" && /^[a-zA-Z]$/.test(key)) setMark(key);
    else if (p === "'" && /^[a-zA-Z]$/.test(key)) jumpToMark(key);
    render();
    return;
  }

  if (/^[0-9]$/.test(key) && (state.count || key !== "0")) {
    state.count += key;
    render();
    e.preventDefault();
    return;
  }

  switch (key) {
    case "j":
    case "ArrowDown":
      move(takeCount() || 1);
      break;
    case "k":
    case "ArrowUp":
      move(-(takeCount() || 1));
      break;
    case "G": {
      const n = takeCount(); // 5G = line 5, G = last line
      moveTo(n ? n - 1 : state.items.length - 1);
      break;
    }
    case "g":
    case "d":
    case "m":
    case "'":
      state.pending = key;
      render();
      break;
    case "/":
    case "ö":
      enterSearch();
      break;
    case "z":
      restoreClosed();
      break;
    case "Enter":
      confirmSelection();
      break;
    case "q":
      closeSwitcher();
      break;
    case "Escape":
      if (state.count) {
        state.count = "";
        render();
      } else if (state.query) {
        state.query = "";
        searchEl.value = "";
        const tab = selectedTab();
        refilter(tab && tab.id);
      } else {
        closeSwitcher();
      }
      setMsg("");
      break;
    default:
      return;
  }
  e.preventDefault();
}

function onSearchKey(e) {
  if (handleCtrlNav(e)) return;
  if (e.key === "Enter") {
    e.preventDefault();
    confirmSelection();
  } else if (e.key === "Escape") {
    e.preventDefault();
    leaveSearch();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    move(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    move(-1);
  }
}

document.addEventListener("keydown", (e) => {
  if (state.mode === "search") onSearchKey(e);
  else onNormalKey(e);
});

searchEl.addEventListener("input", () => {
  state.query = searchEl.value;
  state.sel = 0;
  refilter(null);
});

searchEl.addEventListener("focus", () => {
  if (state.mode !== "search") {
    state.mode = "search";
    render();
  }
});

listEl.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-index]");
  if (!li) return;
  if (state.mode === "search") leaveSearch();
  moveTo(Number(li.dataset.index));
});

listEl.addEventListener("dblclick", (e) => {
  if (e.target.closest("li[data-index]")) confirmSelection();
});

// Clicking into the browser window dismisses the switcher (like Spotlight).
window.addEventListener("blur", () => {
  setTimeout(() => {
    if (!document.hasFocus()) closeSwitcher();
  }, 150);
});

// ---------- Tab events ----------

function upsertTab(tab) {
  const i = state.tabs.findIndex((t) => t.id === tab.id);
  if (i >= 0) state.tabs[i] = tab;
  else state.tabs.unshift(tab);
}

function removeTab(tabId) {
  const keep = selectedTab();
  state.tabs = state.tabs.filter((t) => t.id !== tabId);
  for (const k of Object.keys(state.marks)) {
    if (state.marks[k] === tabId) delete state.marks[k];
  }
  browser.storage.session.set({ marks: state.marks });
  refilter(keep && keep.id !== tabId ? keep.id : null);
}

function registerListeners() {
  browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
    if (windowId !== state.windowId) return;
    const idx = state.items.findIndex((it) => it.tab.id === tabId);
    if (idx >= 0 && idx !== state.sel) {
      state.sel = idx;
      render();
    }
  });

  browser.tabs.onCreated.addListener((tab) => {
    if (tab.windowId !== state.windowId || tab.hidden) return;
    const keep = selectedTab();
    upsertTab(tab);
    refilter(keep && keep.id);
  });

  browser.tabs.onRemoved.addListener((tabId) => removeTab(tabId));

  browser.tabs.onUpdated.addListener(
    (tabId, changeInfo, tab) => {
      if (tab.hidden) {
        removeTab(tabId);
        return;
      }
      const keep = selectedTab();
      upsertTab(tab);
      refilter(keep && keep.id);
    },
    {
      windowId: state.windowId,
      properties: ["title", "url", "favIconUrl", "pinned", "audible", "mutedInfo", "discarded", "hidden"],
    }
  );

  browser.tabs.onAttached.addListener(async (tabId, { newWindowId }) => {
    if (newWindowId !== state.windowId) return;
    const keep = selectedTab();
    upsertTab(await browser.tabs.get(tabId));
    refilter(keep && keep.id);
  });

  browser.tabs.onDetached.addListener((tabId, { oldWindowId }) => {
    if (oldWindowId === state.windowId) removeTab(tabId);
  });

  browser.windows.onRemoved.addListener((windowId) => {
    if (windowId === state.windowId) closeSwitcher();
  });
}

// ---------- Start ----------

async function init() {
  state.selfWindowId = (await browser.windows.getCurrent()).id;

  const tabs = await browser.tabs.query({ windowId: state.windowId, hidden: false });
  tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
  state.tabs = tabs;

  const stored = await browser.storage.session.get("marks");
  state.marks = stored.marks || {};

  registerListeners();

  const active = tabs.find((t) => t.active);
  refilter(active && active.id);
  focusSelf();
}

init();
