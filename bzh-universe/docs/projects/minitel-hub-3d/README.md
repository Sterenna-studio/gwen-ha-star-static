# BZH PW PC HUB 3D

## Éléments évoqués
- Three.js
- `hub_ws.py`
- `telnet_ws_bridge.py`
- `vdt_archive`
- cockpit / console
- HUD triskel / sigil
- panneaux holographiques
- palette override
- data-dust

## Minitel Hub Beta — architecture retrouvée
Livraison historique :
- `minitel_hub_beta.zip`

Contenu listé :
- `hub_ws.py`
- `telnet_ws_bridge.py`
- `vdt_archive/`
- `clients/`
- `panel.html`
- `minitel_stub.py`
- `firmware_esp32/`

### Fonctionnement documenté
- bridge Telnet ↔ WebSocket ;
- envoi de vrais fichiers `.vdt` depuis `vdt_archive` ;
- commandes JSON telles que :
  - `show_page`
- fallback sur pages disponibles.

### Fonctions clés identifiées
- `find_vdt_for_page`
- `send_vdt_file`

## MINI-STAR v1.1 — éléments ajoutés
Livraison historique :
- `MINI-STAR_v1.1.zip`

Fonctions :
- sélection VDT corrigée ;
- bascule texte ⇄ VDT ;
- hub texte par défaut ;
- raccourcis `1..9` ;
- commandes :
  - `/hubtext`
  - `/hubvdt`
  - `/vdtlist`
  - `/vdt <num>`
  - `/mode text|vdt`

## Outil complémentaire
- `convert_img_to_vdt_tool.zip`

## Citations sources associées
Voir :
- `docs/sources/messages-originaux/06-projets-techniques.md`
