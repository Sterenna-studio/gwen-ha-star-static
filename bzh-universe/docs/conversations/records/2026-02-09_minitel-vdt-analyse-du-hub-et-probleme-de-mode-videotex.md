# Minitel / VDT : analyse du hub et problème de mode Vidéotex

- **Date / période :** 2026-02-09
- **Niveau de récupération :** résumé fiable
- **Thèmes :** Minitel, VDT, hub, technique

## Citations originales ou fragments exacts

_Aucune citation originale complète n’a été récupérée pour cette entrée dans le contexte disponible._

## Contenu de la conversation

- Pierre signale un bug : après l’envoi d’une image `.VDT`, le terminal reste en mode Vidéotex et l’ASCII brut ne s’affiche plus.
- Une analyse de MinitDev_Files.zip identifie l’architecture : `hub_ws.py`, `telnet_ws_bridge.py`, clients panel et hub3d, duplication de `vdt_archive`, packaging à rationaliser.
- Même si cette conversation est surtout technique, elle prolonge directement le fil du BZH PC HUB 3D.

## Livrables / résultats associés

- Diagnostic VDT
- ZIP WebSocket Vidéotex complet

## Liens vers le HUB

- `docs/projects/minitel-hub-3d/README.md`
