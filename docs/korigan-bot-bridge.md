# Korigan bot bridge

Cette documentation décrit la carte `KORIGAN · BOT BRIDGE` côté Star statique et son contrat avec Korigan.

Depuis les nouvelles docs Korigan `docs/3615/GWEN_HA_STAR_STATIC_INTEGRATION.md`, l’endpoint n’est plus seulement prévu : il est implémenté côté runtime 3615.

---

## Frontière de responsabilité

Korigan possède :

- le process ou adapter Discord ;
- le process ou adapter Twitch ;
- la lecture des variables d’environnement ;
- les clients réseau ;
- la redaction des statuts ;
- les providers live réels ;
- le raccord éventuel vers le Chat Bus.

Star doit seulement :

- afficher un statut safe ;
- afficher les commandes disponibles ;
- permettre de pointer vers un endpoint de statut ;
- rester fonctionnel si Korigan est absent ;
- ne jamais lire ou stocker de secret.

---

## Endpoint officiel

Endpoint par défaut côté Star :

```txt
GET /api/korigan/bots/status
```

En local côté runtime Korigan :

```txt
http://127.0.0.1:8085/api/korigan/bots/status
```

Sur Nitro, même chemin public via proxy Nginx :

```txt
https://nitro.sterenna.fr/api/korigan/bots/status
```

---

## Forme attendue

```json
{
  "ok": true,
  "mode": "mock",
  "updatedAt": "2026-07-09T01:23:19.420Z",
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

`mode` devient `live` uniquement si au moins un provider est activé et complètement configuré côté Korigan.

---

## Contraintes de sécurité

L’endpoint ne doit jamais renvoyer :

- token Discord ;
- token Twitch ;
- channel ID privé ;
- guild ID privé ;
- bot nick opérationnel sensible ;
- payload brut provider ;
- valeur brute d’environnement.

Il peut renvoyer :

```txt
configured
enabled
connected
mode
channels
lastEventAt
commands
```

---

## Commandes affichées côté Star

```txt
discord status
discord channels
twitch status
twitch chat
```

Ces commandes restent côté Korigan. Star n’envoie rien directement vers Discord ou Twitch.

---

## Tests de fumée

Runtime local :

```bash
curl --fail http://127.0.0.1:8085/api/korigan/bots/status
```

Public Nitro :

```bash
curl --fail https://nitro.sterenna.fr/api/korigan/bots/status
```

Cockpit :

```txt
https://nitro.sterenna.fr/star/
→ KORIGAN · BOT BRIDGE
→ RESCAN
```

La carte doit afficher `MOCK` tant que les providers réels ne sont pas activés.
