# Star Arcade — Mini-games

Each arcade mini-game lives in its own folder.

```txt
games/
├── whack-a-mole/
│   ├── README.md
│   └── whack-a-mole.js
├── crash/
│   ├── README.md
│   └── crash.js
├── slot-machine/
│   ├── README.md
│   └── slot-machine.js
└── neon-racer/
    ├── README.md
    └── neon-racer.js
```

`../star-arcade-core.js` owns the lobby, wallet, bet panel, shared history and routing.

Mini-games receive a small dependency object from the core:

```js
{
  mountId,
  getBet,
  debit,
  credit,
  addHistory,
  backToLobby
}
```

The goal is to keep games isolated and easy to rebalance without touching the arcade shell.
