# ⚽ TOTO AI — Voetbal Analyse PWA

AI-gestuurde voetbal analyse app met echte wedstrijddata en fictieve wallet.

**Made by Rob Borghouts**

---

## Functies
- Live wedstrijddata via API-Football (Eredivisie, KKD, Bundesliga, Premier League, KNVB Beker, Champions League)
- 6 AI analyse-entiteiten per wedstrijd (Anthropic Claude)
- Dagelijkse combi tip van de dag
- Fictieve wallet om inzetten te testen
- Volledig PWA — installeerbaar op Android homescreen

---

## GitHub Pages Setup (stap voor stap)

### 1. Maak een GitHub repository aan
- Ga naar github.com → New repository
- Naam: `toto-ai` (of naar keuze)
- Public repository
- Klik Create repository

### 2. Upload de bestanden
Upload alle bestanden uit deze map naar de repository:
- `index.html`
- `manifest.json`
- `sw.js`
- `.github/workflows/deploy.yml`
- `icon-192.png` en `icon-512.png` (zelf toevoegen, zie hieronder)

### 3. Icons aanmaken
Maak twee vierkante PNG icoontjes:
- `icon-192.png` → 192×192 pixels
- `icon-512.png` → 512×512 pixels

Gebruik bijv. https://favicon.io of maak ze zelf met een voetbal emoji op donkere achtergrond.

### 4. GitHub Pages inschakelen
- Ga naar je repository → Settings → Pages
- Source: **GitHub Actions**
- De workflow draait automatisch bij elke push naar `main`

### 5. API Keys instellen
De API keys sla je LOKAAL op in de app (localStorage op je telefoon).
Ze worden nooit naar GitHub gestuurd.

- Open de app → tabblad ⚙️ Instellingen
- Vul in:
  - **Anthropic API Key**: `sk-ant-api03-...` (van console.anthropic.com)
  - **API-Football Key**: jouw RapidAPI key (van rapidapi.com/api-sports)

### 6. Installeren op Android
- Open de GitHub Pages URL in Chrome op je Android
- Chrome toont automatisch "Toevoegen aan startscherm"
- Of: menu (⋮) → "Toevoegen aan startscherm"

---

## API-Football instellen

1. Ga naar https://rapidapi.com/api-sports/api/api-football
2. Maak een gratis account aan
3. Kopieer je API key
4. Vul in bij Instellingen in de app

Gratis tier: 100 requests/dag — voldoende voor dagelijks gebruik.

---

## Competitie IDs (API-Football)

| Competitie | League ID | Seizoen |
|---|---|---|
| Eredivisie | 88 | 2024 |
| Keuken Kampioen Div. | 89 | 2024 |
| Bundesliga | 78 | 2024 |
| Premier League | 39 | 2024 |
| KNVB Beker | 90 | 2024 |
| Champions League | 2 | 2024 |

---

## Disclaimer
Deze app is uitsluitend voor educatieve en entertainmentdoeleinden.
Alle analyses zijn AI-gegenereerd. Geen echte gokadviezen.
Gebruik nooit echt geld op basis van AI-analyses.
