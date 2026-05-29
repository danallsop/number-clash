# Number Clash

A hot-seat 2-player board game of hidden information and combat.

## Rules

- **Board:** 9×8 grid. Each player has 3 back rows for their 21 pieces.
- **Fog of war:** You see your own pieces' numbers. Enemy pieces show as `?` until revealed in combat.
- **Movement:** Pieces move one cell orthogonally (up/down/left/right). You cannot move onto your own pieces.
- **Combat:** When you move onto an enemy piece, higher number wins. The loser is removed; the winner survives.
- **Numbers (highest to lowest):** `14 13 12 11 10 9 8 7 6 5 4 3 2 1 0`
- **Joker (14):** Beats all numbered pieces except 1. Loses to 1. Ties with another Joker.
- **Flag:** Loses to any attacker. You win if you capture the enemy flag OR move your flag to the enemy back row.
- **Revealed pieces:** After a battle, both participants are permanently revealed to both players.

## Setup

Before the game starts, arrange your 21 pieces on your 3 back rows using the tray:

- **Drag & drop** pieces from the tray onto board cells, or between cells
- **Click** a piece in your tray, then click an empty cell in your zone to place it
- **Click** a piece on the board, then click another cell in your zone to move it during setup
- **Place All** (in each tray) — places remaining tray pieces onto empty cells; if all are placed, shuffles them randomly
- **Ready** — locks in your arrangement and starts the game

In **vs AI** mode, the computer auto-places its pieces (hidden under fog) while you arrange yours.

## Controls

| Button | Action |
|---|---|
| Human / AI toggle | Switch between PvP and Player-vs-Computer mode |
| Place All (in tray) | Place remaining pieces or shuffle placed ones |
| Rules | Open combat reference in a new tab |
| Ready | Start the game (setup phase only) |
| New Game | Restart |

## Project Structure

```
Game/
├── index.html     — Entry point
├── style.css      — All styles
├── rules.html     — Combat reference table
├── README.md      — This file
└── js/
    ├── defs.js    — Constants (board size, piece definitions, shuffle)
    ├── Game.js    — Game class (logic, rendering, AI)
    └── main.js    — Creates the game instance
```

## AI

The computer opponent uses **iterative deepening minimax with alpha-beta pruning** (up to 30 moves per search level, 1-second time budget). It searches at depth 1, 2, 3, … within the time limit, always committing to the best move from the deepest completed depth.

**Strategic setup:** The AI places its pieces using a fixed strategy rather than randomly — Flag in a back-row corner, `1`s flanking it as Joker traps, Jokers on the front flanks, and high-value pieces (`13`–`9`) across the front row.

**Fog of war:** The AI tracks a pool of all unrevealed enemy piece types, shrinking it as pieces are revealed in combat. When deciding whether to attack an unknown piece, it calculates a win probability against the actual remaining pool rather than using a flat average. Jokers are always favoured for attacks since they beat almost everything.

**Evaluation:** Positions are scored on multiple factors — material balance, positional advance toward the enemy back row, flag protection (bonus for friendly pieces adjacent to own flag), enemy proximity to own flag (penalty), and proximity to a revealed enemy flag. Terminal flag capture/loss scores ±9999 and immediately prunes irrelevant branches.

**Move ordering:** Candidates are scored and sorted before minimax evaluates them — guaranteed wins first, then probable wins, then advances, then retreats. This ensures the cap of 30 moves per node cuts the weakest candidates, and improves alpha-beta pruning efficiency.
