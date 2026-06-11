# Corebots: Red Protocol — V8

Version V8 : polish gameplay + interface.

## Nouveautés V8

### Interface / hub
- Mini-map dans la fenêtre latérale
- Best score local via `localStorage`
- Bouton Son ON/OFF
- Cartes d’upgrade catégorisées :
  - guardian
  - core
  - drone

### Sons WebAudio
- Attaque
- Hits
- Noyau touché
- Upgrade
- Tirs des drones
- Boss
- Victoire / défaite

Aucun fichier audio externe : tout est généré via WebAudio.

### Boss amélioré
- Le boss final lance maintenant une vague rouge vers le noyau / joueur
- Bonus score toujours présent
- Effet sonore dédié

### Lisibilité
- Mini-map avec :
  - joueur
  - noyau
  - ennemis
  - boss
  - murs
  - zone caméra

## Contrôles

- `WASD` ou `Flèches` : déplacement
- `Espace` : coup + vague d'énergie
- `Shift` : dash
- `R` : animation d'apparition
- `P` : pause

## Lancer

```bash
python -m http.server
```

Puis ouvre l’adresse locale dans le navigateur.

## Idées V9

- boss avec plusieurs patterns
- sauvegarde des options de couleur / module de départ
- vraie page de crédits/changelog
- musiques de fond synthétiques
- menus d’upgrade avec icônes
- équilibrage fin des vagues


## Vérification V8

Cette archive inclut `VERIFICATION_REPORT.md`.

Contrôles effectués :
- syntaxe JavaScript
- cohérence IDs HTML / références JS
- parsing du manifest
- présence de tous les sprites référencés
- absence de fonctions doublonnées
- vérification des marqueurs de features V8

Corrections appliquées :
- le boss final ne se déclenche maintenant que via l’entrée explicite `boss`
- suppression du bonus de score involontaire sur le module de départ `Vague amplifiée`
