# firefox-tab-switcher

A Firefox add-on for switching tabs quickly: a slim window listing all tabs of the current window, with fuzzy search over title and URL and Vim keybindings.

Tabs are sorted by most recent use. While moving through the list, the highlighted tab is activated immediately; `Enter` closes the switcher.

> **Why a window and not a sidebar?** Firefox does not give keyboard focus to an extension sidebar when it is opened via a keyboard shortcut ([bug 1502713](https://bugzilla.mozilla.org/show_bug.cgi?id=1502713)). A separate popup window gets focus reliably.

## Installation (development)

1. Open `about:debugging#/runtime/this-firefox`
2. *Load Temporary Add-on…* → select `manifest.json`

Or with [web-ext](https://github.com/mozilla/web-ext): `npx web-ext run`

Requires Firefox 142 or newer.

## Usage

Open/close: `Alt+Space` (change it in `about:addons` → gear icon → *Manage Extension Shortcuts*)

| Key | Action |
|---|---|
| `j` / `k` | down / up (tab is activated immediately) |
| `Ctrl+J` / `Ctrl+K`, `Ctrl+N` / `Ctrl+P` | down / up, also while searching |
| `gg` / `G` | top / bottom |
| `5j`, `3G` … | count prefix |
| `/` | fuzzy search (multiple words separated by spaces) |
| `Esc` | leave search → clear filter → close switcher |
| `Enter` | confirm selection and close switcher |
| `q` | close switcher |
| `dd` | close tab |
| `z` | restore most recently closed tab |
| `m` + letter | mark tab |
| `'` + letter | jump to marked tab |

## Permissions

- `tabs`: read tab titles and URLs
- `sessions`: restore closed tabs
- `storage`: keep marks for the current session

No data is collected or transmitted.
