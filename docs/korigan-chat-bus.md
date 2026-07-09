# Korigan · Chat State / Chat Bus

Cette documentation décrit le raccord entre le cockpit Star statique (`gwen-ha-star-static`) et le runtime actif Korigan côté `services/3615-gateways`.

Point important : `gwen-ha-star-static` ne contient pas le bus temps réel. Il contient la carte de supervision dans `/star/`. Le bus réel, les transports, les sessions, les messages et les providers live appartiennent à Korigan.

---

## État réel vérifié côté Korigan

Le runtime actif est :

```txt
MutenRock/Korigan/services/3615-gateways
```

Le service est séparé de la Next app Korigan :

```txt
Korigan Next app
  -> /star/3615 wrapper page

services/3615-gateways
  -> HTTP status API
  -> WebSocket /minitel/ws
  -> Telnet :3615
  -> terminal-native Gwen Ha Star and Lemegeton screens
```

Endpoints réels principaux :

```txt
GET /                         service status
GET /minitel/status           runtime details
GET /minitel/messages         short PC/Minitel message history
POST /minitel/messages        append an operator message
GET /minitel/operator         lightweight operator panel
GET /minitel/operator/events  live operator event stream
GET /minitel/providers        redacted provider/tool status
POST /minitel/providers/:provider/:action
GET /minitel/vdt              VDT catalog/state metadata
POST /minitel/vdt/send        broadcast allowlisted VDT to Telnet clients
WS  /minitel/ws               WebSocket transport
TCP :3615                     Telnet/Minitel entrypoint
```

Le nom **Chat Bus** dans Star correspond donc aujourd’hui à :

```txt
GET /minitel/messages
GET /minitel/status
GET /minitel/operator/events
WS /minitel/ws
TCP :3615
```

---

## État Star après correction

`js/star/korigan-chat-state.js` se connecte maintenant directement au runtime Korigan réel.

Ordre d’auto-détection :

```txt
/minitel/messages
/korigan/minitel/messages
https://nitro.sterenna.fr/minitel/messages
https://nitro.sterenna.fr/korigan/minitel/messages
/minitel/status
/korigan/minitel/status
https://nitro.sterenna.fr/minitel/status
https://nitro.sterenna.fr/korigan/minitel/status
/api/korigan/chat/state
/korigan/api/chat/state
https://nitro.sterenna.fr/api/korigan/chat/state
https://nitro.sterenna.fr/korigan/api/chat/state
```

Les anciens endpoints `/api/korigan/chat/state` restent supportés comme compatibilité, mais Star tente d’abord les endpoints réels `/minitel/*`.

---

## Flux actuel

```txt
/star/ cockpit statique
  ↓
js/star/nitro-app-renderer.js
  ↓ importe automatiquement
js/star/korigan-chat-state.js
  ↓ poll HTTP JSON toutes les 15s
GET /minitel/messages
  ↓ si indisponible
GET /minitel/status
  ↓ si indisponible
endpoints de compatibilité /api/korigan/chat/state
```

Le bouton `ENDPOINT` permet toujours de forcer une URL manuelle, stockée dans :

```txt
localStorage.koriganChatStateEndpoint
```

Le bouton `RESCAN` relance un scan forcé.

---

## Formats acceptés par Star

Le widget sait désormais normaliser trois formats.

### 1. Format Korigan réel — `/minitel/messages`

Payload attendu côté Korigan :

```json
{
  "ok": true,
  "stats": {
    "wsClients": 1,
    "telnetClients": 1
  },
  "messages": [
    {
      "nick": "OPERATEUR",
      "transport": "operator",
      "kind": "message",
      "text": "HELLO",
      "targetSessionId": "",
      "createdAt": 1783600000000
    }
  ],
  "sessions": [
    {
      "id": "s0001",
      "nick": "ANONYME",
      "transport": "telnet",
      "connectedAt": 1783600000000,
      "lastSeenAt": 1783600010000
    }
  ],
  "providers": {},
  "localConfig": {}
}
```

Mapping Star :

```txt
stats.wsClients      -> clients.pc.count + ws.count
stats.telnetClients  -> clients.minitel.count
messages[-6:]        -> log visible
messages.at(-1)      -> lastMessage
sessions             -> items clients si transport connu
```

### 2. Format Korigan réel — `/minitel/status`

Payload utile :

```json
{
  "ok": true,
  "gateway": "3615 GATEWAYS",
  "node": "ZYRA",
  "mode": "v0.2-modules",
  "transports": ["telnet", "websocket", "http"],
  "wsClients": 1,
  "telnetClients": 1
}
```

Mapping Star :

```txt
wsClients      -> clients.pc.count + ws.count
telnetClients  -> clients.minitel.count
mode           -> status affiché dans le log
```

### 3. Format compatibilité — `/api/korigan/chat/state`

Toujours accepté :

```json
{
  "ok": true,
  "status": "online",
  "updatedAt": "2026-07-09T12:34:56.000Z",
  "ws": { "connected": true },
  "clients": {
    "pc": { "count": 1 },
    "phone": { "count": 0 },
    "minitel": { "count": 1 },
    "count": 2
  },
  "queue": { "pending": 0 },
  "lastMessage": { "from": "MINITEL", "text": "READY" },
  "messages": []
}
```

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
source=korigan-minitel-messages
source=korigan-minitel-status
source=korigan-compat-chat-state
```

---

## CORS / déploiement

Si Star et Korigan sont sur des origins différents, Korigan doit autoriser l’origin Nitro.

Exemple :

```txt
GATEWAY_CORS_ORIGINS=https://nitro.sterenna.fr
```

Réponses recommandées :

```txt
Content-Type: application/json
Cache-Control: no-store
Access-Control-Allow-Origin: https://nitro.sterenna.fr
```

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

Le runtime Korigan sanitise déjà les messages courts et garde l’historique en mémoire seulement. Star ne doit pas devenir le runtime du bus, ni piloter directement les providers live.

---

## Prochaine amélioration propre

Le lien réel fonctionne maintenant via `/minitel/messages` / `/minitel/status`.

À terme, il reste préférable d’ajouter un endpoint de synthèse côté Korigan :

```txt
GET /api/korigan/chat/state
```

Cet endpoint permettrait de garder Star totalement découplé du détail interne `3615-gateways`, mais il n’est plus bloquant pour afficher un état réel.
