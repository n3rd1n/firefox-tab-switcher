# firefox-tab-switcher

Firefox-Add-on zum schnellen Wechseln zwischen Tabs: ein schmales Fenster mit allen Tabs des aktuellen Fensters, Fuzzy-Suche über Titel und URL und Vim-Keybindings.

Die Tabs sind nach letzter Benutzung sortiert. Beim Durchblättern wird der markierte Tab sofort aktiviert, `Enter` schliesst den Switcher.

> **Warum ein Fenster und keine Sidebar?** Firefox gibt einer Extension-Sidebar beim Öffnen per Tastenkürzel keinen Tastaturfokus ([Bug 1502713](https://bugzilla.mozilla.org/show_bug.cgi?id=1502713)). Ein eigenes Popup-Fenster bekommt den Fokus zuverlässig.

## Installation (Entwicklung)

1. `about:debugging#/runtime/this-firefox` öffnen
2. *Temporäres Add-on laden…* → `manifest.json` wählen

Oder mit [web-ext](https://github.com/mozilla/web-ext): `npx web-ext run`

Benötigt Firefox 142 oder neuer.

## Bedienung

Öffnen/Schliessen: `Alt+Space` (änderbar unter `about:addons` → Zahnrad → *Erweiterungs-Tastenkürzel verwalten*)

| Taste | Aktion |
|---|---|
| `j` / `k` | runter / rauf (Tab wird sofort aktiviert) |
| `Ctrl+J` / `Ctrl+K`, `Ctrl+N` / `Ctrl+P` | runter / rauf, auch in der Suche |
| `gg` / `G` | ganz oben / ganz unten |
| `5j`, `3G` … | Zahl vor dem Befehl |
| `/` | Fuzzy-Suche (mehrere Wörter mit Leerzeichen) |
| `Esc` | Suche verlassen → Filter löschen → Switcher schliessen |
| `Enter` | Auswahl bestätigen und Switcher schliessen |
| `q` | Switcher schliessen |
| `dd` | Tab schliessen |
| `z` | zuletzt geschlossenen Tab wiederherstellen |
| `m` + Buchstabe | Tab markieren |
| `'` + Buchstabe | zum markierten Tab springen |

## Berechtigungen

- `tabs`: Titel und URLs der Tabs lesen
- `sessions`: geschlossene Tabs wiederherstellen
- `storage`: Markierungen für die laufende Sitzung speichern

Es werden keine Daten gesammelt oder übertragen.
