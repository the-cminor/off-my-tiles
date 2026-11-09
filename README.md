# Off My Tiles!

A Queens / Star Battle-style logic puzzle game. Play it at **https://the-cminor.github.io/off-my-tiles/**

- `index.html` — the whole game
- `supabase-adapter.js` — connects the game's save, leaderboard and daily challenge to Supabase

Data lives in the Supabase project `off-my-tiles`, table `docs`:

| collection | what |
|---|---|
| `board` | G.O.A.T. leaderboard, one row per player |
| `daily` | daily challenge results |
| `data/users/<id>` | each player's private progress |
| `profiles` | player profile / character (ready for later) |
| `themes` | Theme Lab themes (ready for later) |

Players sign in anonymously, so a save is tied to the browser they play in.
