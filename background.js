"use strict";

const SWITCHER_URL = browser.runtime.getURL("switcher/switcher.html");
const WIDTH = 440;

async function findSwitcherWindow() {
  const wins = await browser.windows.getAll({ windowTypes: ["popup"], populate: true });
  return wins.find((w) => w.tabs.some((t) => t.url && t.url.startsWith(SWITCHER_URL)));
}

async function toggleSwitcher() {
  const existing = await findSwitcherWindow();
  if (existing) {
    await browser.windows.remove(existing.id);
    return;
  }
  const target = await browser.windows.getLastFocused({ windowTypes: ["normal"] });
  await browser.windows.create({
    type: "popup",
    url: `${SWITCHER_URL}?win=${target.id}`,
    left: target.left,
    top: target.top,
    width: Math.min(WIDTH, target.width),
    height: target.height,
  });
}

browser.commands.onCommand.addListener((command) => {
  if (command === "toggle-switcher") toggleSwitcher();
});
