# Korigan · Chat State / Chat Bus

Cette documentation décrit le fonctionnement actuel du widget **KORIGAN · CHAT STATE** dans le cockpit Star statique, ainsi que le contrat attendu côté Korigan pour exposer l’état du **Chat Bus**.

Le dépôt `gwen-ha-star-static` ne contient pas le bus temps réel lui-même. Il contient uniquement la carte de supervision affichée dans `/star/`. Le runtime réel doit rester côté Korigan / Nitro.

---

## Résumé rapide

```txt
/star/ cockpit
  ↓ importe
js/star/nitro-app-renderer.js
  ↓ importe automatiquement
js/star/korigan-chat-state.js
  ↓ monte une carte dans la grille .bento
KORIGAN · CHAT STATE
  ↓ poll HTTP JSON toutes les 15s
/api/korigan/chat/state
/korigan/api/chat/state
https://nitro.sterenna.fr/api/korigan/chat/state
https://nitro.sterenna.fr/korigan/api/chat/state
```

Le widget affiche :

- état WebSocket ;
- nombre total de clients ;
- clients par famille : `PC`, `TEL`, `MINITEL` ;
- taille de queue/outbox ;
- dernier message / derniers messages ;
- endpoint utilisé ;
- état `ONLINE`, `DEGRADED`, `OFFLINE` ou `SCAN`.

---

## Fichiers concernés

```txt
js/star/nitro-app-renderer.js
js/star/korigan-chat-state.js
js/star/korigan-bot-bridge.js
```

### `nitro-app-renderer.js`

Le renderer Star importe directement les modules Korigan :

```js
import './korigan-chat-state.js';
import './korigan-bot-bridge.js';
```

Conséquence : dès que le renderer Star est chargé, le widget Chat State tente de s’installer automatiquement. Il n’y a pas d’appel manuel à faire dans `star/index.html`.

### `korigan-chat-state.js`

Responsabilités :

- injecter la carte `KORIGAN · CHAT STATE` dans la grille `.bento` ;
- chercher un endpoint d’état ;
- normaliser plusieurs formats de réponse JSON possibles ;
- afficher l’état du bus ;
- garder un dernier état connu en mémoire ;
- permettre un endpoint personnalisé via `localStorage`.

### `korigan-bot-bridge.js`

Ce module est voisin mais séparé. Il documente la logique future **SOCIAL BUS** pour Discord / Twitch. Il ne remplace pas le Chat Bus : il prépare seulement un pont providers sociaux côté Korigan.

---

## Cycle de vie du widget Chat State

### 1. Auto-installation

Le module appelle directement :

```js
installKoriganChatState();
```

Puis :

1. injecte son CSS runtime ;
2. attend `DOMContentLoaded` si besoin ;
3. cherche une grille `.bento` ;
4. crée une carte `#korigan-chat-state-card` ;
5. lance un premier `refreshState()` ;
6. crée un polling toutes les `15000 ms`.

### 2. Placement dans la page

La carte est insérée en priorité :

1. après `.bc.bc-radio` si la radio existe ;
2. avant `.bc.bc-pg` si PokéGang existe ;
3. sinon à la fin de `.bento`.

Le widget ne casse donc pas la page si une carte cible est absente.

### 3. Rafraîchissement

Le bouton `RESCAN` relance `refreshState(true)`.

Le bouton `ENDPOINT` ouvre un `prompt()` pour définir un endpoint personnalisé. La valeur est stockée dans :

```txt
localStorage.koriganChatStateEndpoint
```

Si la valeur est vide, le widget revient au mode `auto`.

---

## Endpoints testés par défaut

Ordre actuel :

```txt
/api/korigan/chat/state
/korigan/api/chat/state
https://nitro.sterenna.fr/api/korigan/chat/state
https://nitro.sterenna.fr/korigan/api/chat/state
```

Le widget ajoute automatiquement un query param anti-cache :

```txt
?t=<timestamp>
```

ou :

```txt
&t=<timestamp>
```

si l’URL contient déjà `?`.

Chaque requête utilise :

```js
fetch(target, { cache: force ? 'reload' : 'no-store' })
```

---

## Contrat JSON recommandé côté Korigan

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
      "count": 1,
      "items": []
    },
    "minitel": {
      "count": 1,
      "items": []
    }
  },
  "queue": {
    "pending": 0
  },
  "lastMessage": {
    "from": "minitel",
    "text": "READY"
  },
  "messages": [
    {
      "from": "pc",
      "text": "ping"
    },
    {
      "from": "minitel",
      "text": "pong"
    }
  ]
}
```

Réponse complète conseillée :

```json
{
  "ok": true,
  "status": "online",
  "state": "online",
  "updatedAt": "2026-07-09T12:34:56.000Z",
  "timestamp": "2026-07-09T12:34:56.000Z",
  "ws": {
    "connected": true,
    "url": "ws://127.0.0.1:30000",
    "uptimeMs": 123456,
    "lastEventAt": "2026-07-09T12:34:50.000Z"
  },
  "clients": {
    "pc": {
      "count": 1,
      "items": [
        {
          "id": "pc-dashboard",
          "label": "PC cockpit",
          "connected": true,
          "lastSeenAt": "2026-07-09T12:34:50.000Z"
        }
      ]
    },
    "phone": {
      "count": 1,
      "items": [
        {
          "id": "phone-android",
          "label": "Android phone",
          "connected": true,
          "lastSeenAt": "2026-07-09T12:34:48.000Z"
        }
      ]
    },
    "minitel": {
      "count": 1,
      "items": [
        {
          "id": "minitel-vdt",
          "label": "Minitel VDT",
          "connected": true,
          "lastSeenAt": "2026-07-09T12:34:42.000Z"
        }
      ]
    },
    "count": 3
  },
  "queue": {
    "pending": 0,
    "length": 0,
    "failed": 0
  },
  "messages": [
    {
      "id": "msg_001",
      "from": "pc",
      "to": "minitel",
      "text": "ping",
      "createdAt": "2026-07-09T12:34:40.000Z"
    }
  ],
  "lastMessage": {
    "id": "msg_001",
    "from": "pc",
    "to": "minitel",
    "text": "ping",
    "createdAt": "2026-07-09T12:34:40.000Z"
  }
}
```

---

## Champs acceptés par le normalizer actuel

Le module accepte volontairement plusieurs alias pour rester compatible avec des prototypes.

### Clients

Source principale :

```txt
raw.clients
```

Alias acceptés :

```txt
raw.connectedClients
```

Groupes acceptés :

```txt
clients.pc
clients.desktop
raw.pcClients

clients.phone
clients.mobile
clients.tel
raw.phoneClients

clients.minitel
clients.vdt
raw.minitelClients
```

Chaque groupe peut être :

```js
3
```

ou :

```json
[
  { "id": "client-a" },
  { "id": "client-b" }
]
```

ou :

```json
{
  "count": 2,
  "items": []
}
```

Le total clients est lu via :

```txt
raw.clientCount
raw.clientsCount
```

Sinon il est calculé par addition des groupes `pc + phone + minitel`.

### Queue

Source principale :

```txt
raw.queue
```

Alias acceptés :

```txt
raw.messagesQueue
raw.outbox
```

Nombre pending lu via :

```txt
queue.pending
queue.length
raw.pendingMessages
```

### Messages

Sources acceptées :

```txt
raw.messages
raw.recentMessages
raw.log
```

Le widget n’affiche que les 6 premiers messages.

Dernier message :

```txt
raw.lastMessage
```

Sinon :

```txt
messages[0]
```

### WebSocket

Sources acceptées :

```txt
raw.ws
raw.websocket
```

Affichage :

```txt
ws.connected === false → OFF
sinon → ON
```

Cela veut dire qu’une absence de `connected` est considérée comme `ON` côté affichage actuel. Pour éviter toute ambiguïté, Korigan devrait renvoyer explicitement :

```json
"ws": { "connected": true }
```

ou :

```json
"ws": { "connected": false }
```

---

## États affichés

### Scan

Avant chaque requête :

```txt
SCAN
```

### Online

Si la réponse est récupérée et que :

```txt
raw.ok !== false
```

le badge devient :

```txt
ONLINE
```

### Degraded

Si la réponse est récupérée mais que :

```txt
raw.ok === false
```

le badge devient :

```txt
DEGRADED
```

### Offline

Si tous les endpoints échouent :

```txt
OFFLINE
```

Le log affiche :

```txt
[korigan] endpoint indisponible
reason: <erreur>
hint: clique ENDPOINT pour renseigner /api/korigan/chat/state
last-known: <dernier état si disponible>
```

---

## Responsabilités frontend / backend

### Côté `gwen-ha-star-static`

Le widget doit seulement :

- afficher un état synthétique ;
- interroger un endpoint JSON safe ;
- normaliser les réponses ;
- ne jamais contenir de secrets ;
- ne jamais piloter directement un bot, un token ou un service local sensible.

### Côté Korigan

Korigan doit :

- agréger l’état réel du bus ;
- exposer un endpoint HTTP JSON safe ;
- gérer les WebSockets / clients / queue ;
- masquer les secrets ;
- éventuellement proxifier le runtime local vers Nitro ;
- fournir des timestamps cohérents.

---

## Sécurité

À ne pas exposer côté endpoint public :

- tokens Discord / Twitch / Supabase ;
- clés API ;
- IP locales privées détaillées si non nécessaires ;
- contenu complet d’un chat privé ;
- payloads bruts de clients non filtrés ;
- erreurs serveur verbeuses avec chemins système.

Champs sûrs à exposer :

```txt
ok
status
updatedAt
ws.connected
clients.*.count
queue.pending
lastMessage.from
lastMessage.text tronqué / filtré
messages récents tronqués / filtrés
```

Si le Chat Bus devient public ou semi-public, prévoir :

- authentification ;
- CORS limité ;
- rate limit ;
- logs sans secrets ;
- option pour masquer `messages` et garder uniquement les compteurs.

---

## CORS / déploiement

Si `/star/` et Korigan ne sont pas servis depuis le même origin, l’endpoint doit autoriser l’origine du cockpit.

Exemple minimal côté réponse :

```txt
Access-Control-Allow-Origin: https://nitro.sterenna.fr
Content-Type: application/json
Cache-Control: no-store
```

Ne pas utiliser `*` si l’endpoint finit par exposer des données agent ou des messages non publics.

---

## Test rapide avec un mock local

Créer un fichier temporaire ou une route locale qui renvoie :

```json
{
  "ok": true,
  "status": "online",
  "updatedAt": "2026-07-09T12:34:56.000Z",
  "ws": { "connected": true },
  "clients": {
    "pc": { "count": 1 },
    "phone": { "count": 1 },
    "minitel": { "count": 1 },
    "count": 3
  },
  "queue": { "pending": 2 },
  "lastMessage": { "from": "minitel", "text": "READY" },
  "messages": [
    { "from": "pc", "text": "HELLO" },
    { "from": "minitel", "text": "READY" }
  ]
}
```

Puis dans le cockpit Star :

1. ouvrir `/star/` ;
2. trouver la carte `KORIGAN · CHAT STATE` ;
3. cliquer `ENDPOINT` ;
4. renseigner l’URL du mock ;
5. cliquer `RESCAN`.

---

## Exemple d’endpoint Express côté Korigan

```js
app.get('/api/korigan/chat/state', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    status: chatBus.ws.connected ? 'online' : 'degraded',
    updatedAt: new Date().toISOString(),
    ws: {
      connected: chatBus.ws.connected,
      uptimeMs: chatBus.ws.uptimeMs,
      lastEventAt: chatBus.ws.lastEventAt,
    },
    clients: {
      pc: { count: chatBus.clients.pc.size },
      phone: { count: chatBus.clients.phone.size },
      minitel: { count: chatBus.clients.minitel.size },
      count: chatBus.clientCount,
    },
    queue: {
      pending: chatBus.queue.pending,
      failed: chatBus.queue.failed,
    },
    lastMessage: chatBus.lastMessage
      ? {
          from: chatBus.lastMessage.from,
          text: String(chatBus.lastMessage.text || '').slice(0, 120),
        }
      : null,
    messages: chatBus.recentMessages.slice(0, 6).map(message => ({
      from: message.from,
      text: String(message.text || '').slice(0, 120),
    })),
  });
});
```

---

## Points faibles actuels / TODO

1. **CSS injecté par JS**  
   `korigan-chat-state.js` injecte encore un `<style>` runtime. Pour une intégration plus propre, migrer ce CSS vers un fichier dédié, par exemple :

   ```txt
   css/star-korigan-chat.css
   ```

2. **Heuristique WebSocket trop optimiste**  
   Actuellement, `ws.connected` absent est affiché comme `ON`. Il faudrait idéalement afficher `?` ou `UNKNOWN` si le champ est absent.

3. **Pas de schéma partagé**  
   Ajouter un petit JSON Schema ou un TypeScript type côté Korigan permettrait d’éviter les dérives de payload.

4. **Messages récents potentiellement sensibles**  
   Garder par défaut des messages tronqués, ou exposer uniquement `lastMessage` en environnement public.

5. **Endpoint manuel via prompt**  
   Pour une UX plus propre, remplacer `prompt()` par un mini formulaire dans la carte.

---

## Checklist d’implémentation côté Korigan

- [ ] Créer `GET /api/korigan/chat/state`.
- [ ] Renvoyer `Cache-Control: no-store`.
- [ ] Renvoyer `Content-Type: application/json`.
- [ ] Renvoyer explicitement `ws.connected`.
- [ ] Renvoyer les compteurs `clients.pc`, `clients.phone`, `clients.minitel`.
- [ ] Renvoyer `clients.count`.
- [ ] Renvoyer `queue.pending`.
- [ ] Tronquer / filtrer `lastMessage` et `messages`.
- [ ] Ne jamais exposer de secrets.
- [ ] Tester depuis `/star/` avec `ENDPOINT` puis `RESCAN`.
- [ ] Vérifier les CORS si origin différent.

---

## Règle d’architecture

Le **Chat Bus** appartient à Korigan.

Le cockpit Star statique doit rester un **observateur** : il lit l’état, affiche les compteurs, aide au debug, mais ne devient pas le serveur de chat ni le détenteur des secrets.
