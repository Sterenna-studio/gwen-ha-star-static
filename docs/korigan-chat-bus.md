# Korigan · Chat State / Chat Bus

Cette documentation décrit le raccord entre le cockpit Star statique (`gwen-ha-star-static`) et le runtime actif Korigan côté `services/3615-gateways`.

Point important : le dépôt `gwen-ha-star-static` ne contient pas le bus temps réel. Il contient uniquement une carte de supervision dans `/star/`. Le bus réel, les transports, les sessions, les messages et les providers live appartiennent à Korigan.

---

## État vérifié côté Korigan

La documentation Korigan place le runtime actif dans :

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

Le service expose actuellement :

```txt
GET /                         service status
GET /minitel/status           runtime details
GET /minitel/nitro-feed       terminal-safe Korigan/Nitro feed
GET /minitel/avatar-state     Lemegeton/avatar state
GET /minitel/messages         short PC/Minitel message history
POST /minitel/messages        append an operator message
GET /minitel/operator         lightweight operator panel
GET /minitel/operator/events  live operator event stream
GET /minitel/providers        redacted provider/tool status
POST /minitel/providers/:provider/:action
POST /minitel/sessions/:id/disconnect
GET /minitel/vdt              VDT catalog/state metadata
POST /minitel/vdt/send        broadcast allowlisted VDT to Telnet clients
WS  /minitel/ws               WebSocket transport
TCP :3615                     Telnet/Minitel entrypoint
```

Donc le nom **Chat Bus** dans Star correspond aujourd’hui surtout au couple :

```txt
GET /minitel/messages
GET /minitel/status
```

et au flux live :

```txt
GET /minitel/operator/events
WS /minitel/ws
TCP :3615
```

---

## Écart actuel avec le widget Star statique

Le widget `KORIGAN · CHAT STATE` actuel dans `gwen-ha-star-static` teste encore ces endpoints de compatibilité :

```txt
/api/korigan/chat/state
/korigan/api/chat/state
https://nitro.sterenna.fr/api/korigan/chat/state
https://nitro.sterenna.fr/korigan/api/chat/state
```

Ces routes ne sont pas les routes principales documentées dans `services/3615-gateways`.

Conclusion : la doc précédente décrivait un **contrat cible** utile, mais pas l’état réel strict de Korigan. Le contrat correct doit être formulé comme une couche d’adaptation entre :

```txt
Star widget attendu
  GET /api/korigan/chat/state

Korigan runtime existant
  GET /minitel/status
  GET /minitel/messages
```

---

## Recommandation d’architecture

Deux options propres existent.

### Option A — ajouter un endpoint d’adaptation côté Korigan

Ajouter dans Korigan :

```txt
GET /api/korigan/chat/state
```

ou :

```txt
GET /korigan/api/chat/state
```

Cette route agrège les données déjà présentes dans :

```txt
/minitel/status
/minitel/messages
```

et renvoie le format attendu par la carte Star.

Avantage : `gwen-ha-star-static` reste simple et lit un endpoint unique.

### Option B — adapter le widget Star aux routes existantes

Modifier `js/star/korigan-chat-state.js` pour interroger :

```txt
/minitel/messages
```

puis lire :

```txt
stats.wsClients
stats.telnetClients
messages
sessions
providers
localConfig
```

Avantage : pas besoin d’ajouter une route côté Korigan.

Inconvénient : le widget Star connaît davantage les détails internes du runtime 3615.

### Choix conseillé

Préférer **Option A** : Korigan expose un endpoint de synthèse safe, et Star reste un observateur.

---

## Flux recommandé

```txt
/star/ cockpit statique
  ↓
js/star/nitro-app-renderer.js
  ↓ importe automatiquement
js/star/korigan-chat-state.js
  ↓ poll HTTP JSON toutes les 15s
GET /api/korigan/chat/state
  ↓ côté Korigan : adaptateur safe
lit / agrège l’état interne 3615
  ↓
renvoie un JSON stable au cockpit
```

---

## Fichiers côté Star statique

```txt
js/star/nitro-app-renderer.js
js/star/korigan-chat-state.js
js/star/korigan-bot-bridge.js
```

`nitro-app-renderer.js` importe automatiquement :

```js
import './korigan-chat-state.js';
import './korigan-bot-bridge.js';
```

Conséquence : dès que le renderer Star est chargé, le widget tente de monter sa carte dans `.bento`.

---

## Cycle de vie du widget `KORIGAN · CHAT STATE`

1. Injection CSS runtime.
2. Attente de `DOMContentLoaded` si nécessaire.
3. Recherche de la grille `.bento`.
4. Création de la carte `#korigan-chat-state-card`.
5. Premier `refreshState()`.
6. Polling toutes les `15000 ms`.

La carte est insérée en priorité :

1. après `.bc.bc-radio` si la radio existe ;
2. avant `.bc.bc-pg` si PokéGang existe ;
3. sinon à la fin de `.bento`.

Le bouton `RESCAN` relance un scan forcé.

Le bouton `ENDPOINT` stocke un endpoint personnalisé dans :

```txt
localStorage.koriganChatStateEndpoint
```

---

## Contrat JSON recommandé pour l’adaptateur Korigan

Endpoint recommandé :

```txt
GET /api/korigan/chat/state
```

Réponse minimale :

```json
{
  "ok": true,
  "status": "online",
  "updatedAt": "2026-07-09T12:34:56.000Z",
  "ws": {
    "connected": true
  },
  "clients": {
    "pc": {
      "count": 1,
      "items": []
    },
    "phone": {
      "count": 0,
      "items": []
    },
    "minitel": {
      "count": 1,
      "items": []
    },
    "count": 2
  },
  "queue": {
    "pending": 0
  },
  "lastMessage": {
    "from": "MINITEL",
    "text": "READY"
  },
  "messages": [
    {
      "from": "OPERATEUR",
      "text": "HELLO"
    }
  ]
}
```

---

## Mapping depuis le runtime Korigan actuel

### Depuis `GET /minitel/status`

Korigan renvoie notamment :

```txt
ok
gateway
node
mode
transports
modules
providers
localConfig
nitroFeedVersion
avatarStateVersion
wsClients
telnetClients
```

Mapping conseillé :

```js
const chatState = {
  ok: status.ok,
  status: status.ok ? 'online' : 'degraded',
  updatedAt: new Date().toISOString(),
  ws: {
    connected: Number(status.wsClients || 0) > 0,
  },
  clients: {
    pc: { count: 1 },
    phone: { count: 0 },
    minitel: { count: Number(status.telnetClients || 0) },
    count: Number(status.wsClients || 0) + Number(status.telnetClients || 0),
  },
  queue: { pending: 0 },
};
```

Note : `wsClients` désigne les clients WebSocket du runtime 3615, pas forcément uniquement un PC. Pour un affichage plus juste, l’adaptateur peut appeler ce groupe `pc` tant qu’il s’agit du cockpit opérateur / client web.

### Depuis `GET /minitel/messages`

Korigan renvoie notamment :

```txt
ok
stats
messages
sessions
vdtAssets
vdtState
providers
localConfig
```

Les messages sont déjà formatés côté serveur avec :

```txt
nick
transport
kind
text
targetSessionId
createdAt
```

Mapping conseillé :

```js
const messages = raw.messages || [];
const normalizedMessages = messages.slice(-6).map((message) => ({
  from: message.nick || message.transport || 'agent',
  text: message.kind === 'action'
    ? `* ${message.text}`
    : message.text,
  createdAt: message.createdAt,
}));

chatState.messages = normalizedMessages;
chatState.lastMessage = normalizedMessages.at(-1) || null;
```

---

## Exemple d’adaptateur Express côté Korigan

```js
app.get('/api/korigan/chat/state', (req, res) => {
  const stats = getRuntimeStats();
  const messages = getOperatorMessages(consoleState);
  const sessions = getOperatorSessions(consoleState);

  const normalizedMessages = messages.slice(-6).map((message) => ({
    from: message.nick || message.transport || 'agent',
    text: String(message.text || '').slice(0, 120),
    createdAt: message.createdAt,
  }));

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    status: 'online',
    updatedAt: new Date().toISOString(),
    ws: {
      connected: Number(stats.wsClients || 0) > 0,
    },
    clients: {
      pc: { count: Number(stats.wsClients || 0) },
      phone: { count: 0 },
      minitel: { count: Number(stats.telnetClients || 0) },
      count: Number(stats.wsClients || 0) + Number(stats.telnetClients || 0),
    },
    queue: {
      pending: 0,
    },
    sessions,
    lastMessage: normalizedMessages.at(-1) || null,
    messages: normalizedMessages,
  });
});
```

---

## Chat Bus fonctionnel côté 3615

Le runtime 3615 permet déjà :

- chat local PC ↔ Minitel ;
- console opérateur web sur `/minitel/operator` ;
- flux live SSE `/minitel/operator/events` ;
- envoi opérateur via `POST /minitel/messages` ;
- réception côté Minitel / WebSocket ;
- commandes `pc`, `messages`, `who`, `nick`, `say`, `me`, `pc ping`, `pc status` ;
- historique court en mémoire ;
- sessions connectées ;
- déconnexion contrôlée d’une session ;
- diffusion VDT allowlistée vers Telnet.

Les messages sont :

- sanitizés ;
- limités à 120 caractères ;
- gardés en mémoire seulement ;
- jamais transformés en commande système.

---

## WebSocket et Telnet

Le transport WebSocket réel est :

```txt
WS /minitel/ws
```

Le transport Telnet/Minitel réel est :

```txt
TCP :3615
```

À la connexion WebSocket, Korigan renvoie un message `welcome` avec :

```txt
type: welcome
service
node
menu
session
nitroFeedVersion
avatarStateVersion
```

Quand un message opérateur est diffusé vers WebSocket :

```txt
type: operator-message
message: { nick, transport, kind, text, targetSessionId, createdAt }
```

Quand un utilisateur console envoie `say`, `me` ou du texte dans l’écran console, Korigan diffuse :

```txt
type: console-message
message: { nick, transport, kind, text, createdAt }
```

---

## Providers live

Korigan documente des providers live opt-in :

```txt
Ollama
Home Assistant
Twitch
Discord
```

Chaque provider exige :

```txt
*_PROVIDER_ENABLED=true
```

et les clés/config nécessaires.

Les actions documentées :

```txt
POST /minitel/providers/ollama/ask
POST /minitel/providers/ollama/models
POST /minitel/providers/home-assistant/service
POST /minitel/providers/twitch/send
POST /minitel/providers/discord/send
```

Règle importante : les secrets ne doivent jamais être renvoyés au cockpit Star. Le statut provider doit être redacted.

---

## Sécurité et limites à respecter

Côté Korigan, la documentation impose notamment :

- pas de secrets, IP locales, device IDs ou tokens dans les docs, logs, écrans Minitel, réponses HTTP, payloads WebSocket ou commits ;
- pas d’exécution de commande shell depuis une entrée Minitel ;
- pas de dépendance hardware/serial dans le service principal ;
- pas d’upload ni conversion arbitraire de fichiers VDT dans le MVP ;
- providers live désactivés par défaut ;
- actions live à durcir avant exposition hors LAN.

Pour Star, cela veut dire :

- lire uniquement un endpoint d’état safe ;
- ne pas envoyer de secrets ;
- ne pas piloter directement Discord, Twitch, Home Assistant ou Ollama ;
- ne pas exposer de payload brut non filtré.

---

## CORS / déploiement

Korigan possède déjà une politique CORS côté serveur via :

```txt
GATEWAY_CORS_ORIGINS
PUBLIC_ORIGIN
```

Si le cockpit Star statique appelle Korigan depuis un origin différent, il faut autoriser explicitement l’origin Nitro.

Exemple :

```txt
GATEWAY_CORS_ORIGINS=https://nitro.sterenna.fr
```

Réponses recommandées pour les endpoints d’état :

```txt
Content-Type: application/json
Cache-Control: no-store
Access-Control-Allow-Origin: https://nitro.sterenna.fr
```

---

## Checklist de raccord réel

- [ ] Décider : adaptateur côté Korigan ou widget Star qui lit `/minitel/messages`.
- [ ] Si adaptateur : créer `GET /api/korigan/chat/state` dans Korigan.
- [ ] Mapper `stats.wsClients` vers `clients.pc.count` ou `ws.connected`.
- [ ] Mapper `stats.telnetClients` vers `clients.minitel.count`.
- [ ] Mapper `messages` vers `lastMessage` + `messages` tronqués.
- [ ] Renvoyer `Cache-Control: no-store`.
- [ ] Ne renvoyer aucun secret ni config complète sensible.
- [ ] Tester depuis `/star/` avec `ENDPOINT` puis `RESCAN`.
- [ ] Vérifier CORS si Star et Korigan ne partagent pas le même origin.
- [ ] Garder Star comme observateur, pas comme runtime du bus.

---

## Prochaine amélioration côté Star

Le widget actuel devrait évoluer pour accepter aussi directement le format Korigan actuel :

```txt
/minitel/messages
```

En particulier :

```txt
raw.stats.wsClients
raw.stats.telnetClients
raw.messages
raw.sessions
```

Cela permettrait de tester immédiatement le Chat Bus sans attendre l’adaptateur `/api/korigan/chat/state`.

La meilleure version long terme reste néanmoins un endpoint d’adaptation unique côté Korigan.
