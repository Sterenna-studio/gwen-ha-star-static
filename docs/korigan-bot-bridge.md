# Korigan bot bridge

Objectif futur : brancher un bot Discord et un bot Twitch sur le cockpit Star,
en gardant Korigan comme frontière runtime.

## État actuel

- `js/star/korigan-bot-bridge.js` affiche une carte `KORIGAN · BOT BRIDGE`
  dans `/star/`.
- La carte tente de lire un endpoint de statut futur, puis retombe sur un état
  `PLAN` si aucun endpoint Korigan n'est disponible.
- Aucun token, secret, guild id, channel id ou valeur de configuration n'est lu
  ni affiché par `gwen-ha-star-static`.
- Le module ne connecte aucun provider réel : il prépare seulement la surface UI
  et le contrat de statut.

## Frontière de responsabilité

Korigan doit posséder :

- le process du bot Discord ;
- le process ou adapter du bot Twitch ;
- la lecture des variables d'environnement ;
- les clients réseau ;
- le filtrage 40 colonnes / Telnet-safe ;
- la file d'événements vers le chat bus.

Star doit seulement :

- afficher un statut safe ;
- afficher les commandes prévues ;
- permettre de pointer vers un endpoint de statut ;
- rester fonctionnel si Korigan est absent.

## Endpoint safe prévu

Endpoint par défaut côté Star :

```txt
GET /api/korigan/bots/status
```

Forme attendue :

```json
{
  "ok": true,
  "mode": "mock",
  "updatedAt": "2026-07-06T00:00:00.000Z",
  "providers": {
    "discord": {
      "configured": false,
      "enabled": false,
      "connected": false,
      "mode": "mock",
      "channels": 0,
      "lastEventAt": null,
      "commands": ["discord status", "discord channels"]
    },
    "twitch": {
      "configured": false,
      "enabled": false,
      "connected": false,
      "mode": "mock",
      "channels": 0,
      "lastEventAt": null,
      "commands": ["twitch status", "twitch chat"]
    }
  }
}
```

Contraintes :

- ne jamais renvoyer de token ou secret ;
- ne pas renvoyer de valeur brute de channel/guild si elle peut identifier un
  secret opérationnel ;
- préférer les booléens et compteurs : `configured`, `enabled`, `connected`,
  `channels`;
- garder `mode: "mock"` tant que les providers réels ne sont pas activés.

## Commandes futures côté Korigan

Commandes déjà prévues côté UI Star :

```txt
discord status
discord channels
twitch status
twitch chat
```

Ces commandes doivent rester côté Korigan. Star ne doit pas router directement
vers Discord ou Twitch.

## Phases d'activation

1. Garder le module Star en `PLAN`/`MOCK`.
2. Implémenter l'endpoint safe côté Korigan sans connecter les providers.
3. Ajouter les tests anti-fuite de secrets côté Korigan.
4. Activer Discord en environnement contrôlé.
5. Activer Twitch en environnement contrôlé.
6. Brancher les événements utiles vers le chat bus Korigan.
