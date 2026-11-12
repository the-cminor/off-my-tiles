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

## Versioning

The game uses [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`, e.g. `1.4.2`.

- **MAJOR** (`2.0.0`): breaking change, such as old saves, themes or scores no longer fitting, or a big redesign
- **MINOR** (`1.1.0`): new feature that doesn't break anything
- **PATCH** (`1.0.1`): bug fix or small tweak

Bumping one number resets the numbers to its right (`1.3.4` → `1.4.0`).

To release:
1. Add a new entry at the top of `CHANGELOG` in `index.html` with the new version, date and player-facing notes (EN + TH). The newest entry is the game's version: it shows in Settings and in What's new, and players see the red dot on **?** until they read it.
2. Commit, then tag it: `git tag v1.1.0 && git push --tags`

History: v2–v18 (the Claude artifact versions) are now `0.2.0`–`0.18.0`, and v19 (the game's own website) is `1.0.0`.

## License

© 2026 Cin. All rights reserved. The code is public to view, but may not be copied, hosted or reused without permission. See [LICENSE](LICENSE).
