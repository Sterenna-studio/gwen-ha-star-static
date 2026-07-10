# Korigan · Chat State / Chat Bus

Cette documentation décrit le raccord entre le cockpit Star statique (`gwen-ha-star-static`) et le runtime actif Korigan côté `services/3615-gateways`.

Point important : `gwen-ha-star-static` ne contient pas le bus temps réel. Il contient la carte de supervision dans `/star/`. Le bus réel, les transports, les sessions, les messages et les providers live appartiennent à Korigan.

---

## Source d’autorité

Le nouveau guide Korigan côté runtime est :

```txt
MutenRock/Korigan/docs/3615/GWEN_HA_STAR_STATIC_INTEGRATION.md
```

Il indique que `gwen-ha-star-static` reste un site public statique et ne doit pas posséder les secrets, bots, sockets Telnet ou l’état du Chat Bus. Korigan possède la frontière runtime.

---

## Endpoints officiels consommés par Star

Korigan expose maintenant les contrats safe suivants :

```txt
GET /api/korigan/chat/state
GET /api/korigan/bots/status
```

## Feed public Nitro pour le Minitel

Le déploiement génère aussi un manifeste public terminal-safe depuis
`shared/nitro-apps.js`, `radio/live.json` et `jukebox/chronicles-fm.json` :

```txt
GET /data/3615-feed.json
```

Korigan peut le mettre en cache et conserver son feed local comme fallback.
Le manifeste ne contient aucun profil privé, token Supabase ou secret runtime.

En local côté runtime :

```txt
http://127.0.0.1:8085/api/korigan/chat/state
http://127.0.0.1:8085/api/korigan/bots/status
```

Sur Nitro, les mêmes chemins doivent être exposés en same-origin :

```txt
https://nitro.sterenna.fr/api/korigan/chat/state
https://nitro.sterenna.fr/api/korigan/bots/status
```

---

## État Star après alignement

`js/star/korigan-chat-state.js` priorise maintenant le contrat officiel :

```txt
/api/korigan/chat/state
https://nitro.sterenna.fr/api/korigan/chat/state
```

Puis garde les endpoints `/minitel/*` comme fallback de debug :

```txt
/minitel/messages
/minitel/status
```

Le but : en production Nitro, le widget doit fonctionner sans override manuel `localStorage` si Nginx proxy correctement `/api/korigan/` vers le runtime 3615.

---

## Flux attendu en production

```txt
/star/ cockpit statique
  ↓
js/star/nitro-app-renderer.js
  ↓ importe automatiquement
js/star/korigan-chat-state.js
  ↓ poll HTTP JSON toutes les 15s
GET /api/korigan/chat/state
  ↓ proxy Nginx
http://127.0.0.1:8085/api/korigan/chat/state
  ↓
Korigan / services/3615-gateways
```

Le bouton `ENDPOINT` permet toujours de forcer une URL manuelle, stockée dans :

```txt
localStorage.koriganChatStateEndpoint
```

Le bouton `RESCAN` relance un scan forcé.

---

## Contrat `GET /api/korigan/chat/state`

Réponse safe attendue :

```json
{
  "ok": true,
  "status": "online",
  "state": "online",
  "updatedAt": "2026-07-09T01:23:19.268Z",
  "timestamp": "2026-07-09T01:23:19.268Z",
  "ws": {
    "connected": true,
    "url": "/minitel/ws"
  },
  "clients": {
    "pc": {
      "count": 0,
      "items": []
    },
    "phone": {
      "count": 0,
      "items": []
    },
    "minitel": {
      "count": 0,
      "items": []
    },
    "count": 0
  },
  "queue": {
    "pending": 0,
    "length": 0,
    "failed": 0
  },
  "lastMessage": null,
  "messages": []
}
```

Notes de mapping côté Korigan :

```txt
clients.pc.count       -> clients WebSocket actifs
clients.minitel.count  -> sessions Telnet actives
clients.phone.count    -> réservé, actuellement 0
messages               -> messages console récents, safe, tronqués
queue                  -> file/outbox, actuellement 0 si non utilisée
```

---

## Fallbacks acceptés par Star

Le widget sait encore normaliser les formats historiques/debug :

```txt
GET /minitel/messages
GET /minitel/status
```

`/minitel/messages` fournit :

```txt
stats.wsClients
stats.telnetClients
messages
sessions
providers
localConfig
```

`/minitel/status` fournit :

```txt
wsClients
telnetClients
mode
transports
modules
```

Ces fallbacks sont utiles en local ou en diagnostic, mais le contrat officiel Star ↔ Korigan reste `/api/korigan/chat/state`.

---

## Affichage dans la carte Star

La carte `KORIGAN · CHAT STATE` affiche :

```txt
WS        ON / IDLE / OFF
CLIENTS   total PC + TEL + MINITEL
QUEUE     pending ou 0
LAST      heure de dernière activité connue
```

Badges :

```txt
SCAN      requête en cours
ONLINE    payload récupéré et ok !== false
DEGRADED  payload récupéré mais ok === false
OFFLINE   aucun endpoint disponible
```

Le log indique aussi la source normalisée :

```txt
source=korigan-compat-chat-state
source=korigan-minitel-messages
source=korigan-minitel-status
```

---

## Nginx Nitro

Dans le bloc HTTP de `nitro.sterenna.fr`, Korigan recommande :

```nginx
location /minitel/ {
    proxy_pass http://127.0.0.1:8085/minitel/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

location /api/korigan/ {
    proxy_pass http://127.0.0.1:8085/api/korigan/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Cache-Control "no-store";
}
```

Same-origin proxying est préféré à un appel direct cross-origin.

---

## Tests de fumée

Sur le host runtime :

```bash
curl --fail http://127.0.0.1:8085/api/korigan/chat/state
curl --fail http://127.0.0.1:8085/api/korigan/bots/status
```

Depuis Nitro public après reload Nginx :

```bash
curl --fail https://nitro.sterenna.fr/api/korigan/chat/state
curl --fail https://nitro.sterenna.fr/api/korigan/bots/status
curl --fail https://nitro.sterenna.fr/minitel/status
```

Dans le cockpit :

```txt
https://nitro.sterenna.fr/star/
→ KORIGAN · CHAT STATE
→ RESCAN
```

Le widget devrait résoudre l’endpoint sans override manuel.

---

## Sécurité

Star doit rester observateur.

À ne jamais exposer au widget :

- tokens Discord / Twitch / Supabase ;
- clés API ;
- IP locales ou device IDs sensibles ;
- payload brut non filtré ;
- stack traces serveur ;
- provider config complète.

Les endpoints publics peuvent exposer uniquement :

```txt
booléens
compteurs
timestamps
messages courts sanitizés
statuts redacted
```

---

## Fichiers liés

```txt
js/star/korigan-chat-state.js
js/star/korigan-bot-bridge.js
docs/korigan-bot-bridge.md
```

Le contrat Bot Bridge est documenté séparément dans :

```txt
docs/korigan-bot-bridge.md
```
