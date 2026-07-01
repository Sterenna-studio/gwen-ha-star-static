# audio/ — Assets sonores Gwen-Ha-Star

Répertoire centralisé de tous les fichiers audio du projet.

```
audio/
  fx/       → Sons FX courts : UI, radio, transitions
  leme/     → Voix Lemegeton · Chronicœur (TTS / enregistrements)
```

## Conventions

- Format : **MP3** (compatibilité maximale) ou OGG en fallback
- Bitrate : 64–128 kbps mono pour les voix, 128–192 kbps stéréo pour les FX
- Normalisation : **-3 dB peak**, -16 LUFS pour les voix
- Nommage : `[module]-[type]-[index].mp3` (kebab-case, index 2 chiffres)

## Intégration widget

Le widget Chronicles FM (`js/chronicles-fm-widget.js`) cherchera les fichiers sous :
- `/audio/leme/leme-[type]-[n].mp3` — voix Lemegeton
- `/audio/fx/cfm-[event].mp3` — FX radio

Voir les README dans chaque sous-dossier pour la liste complète.
