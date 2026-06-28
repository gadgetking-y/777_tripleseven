# 777 Three Sevens

**777 Three Sevens** is a faithful web recreation of the classic retro action-puzzle game originally designed for Japanese pocket computers (Pocket PCs). Experience nostalgic falling-block puzzle action directly in your web browser!

---

## 🌟 Key Features

- **Classic Retro Puzzle Gameplay**: Strategic falling-block mechanics with a unique math twist.
- **Dynamic Chain Alterations**: Clearing blocks alters adjacent tiles, triggering satisfying multi-step chain reactions!
- **Pure Web Implementation**: Built with modern HTML, CSS, and vanilla JavaScript—no external frameworks or heavy assets required.
- **Synthesized Retro Sound Effects**: Authentically generated 8-bit sound effects created on the fly using the browser's Web Audio API.
- **Persistent High Scores**: High scores are automatically saved to your browser's local storage.

---

## 📜 Rules & Mechanics

- **Falling Pairs**: Blocks fall in attached pairs. Rotate them clockwise around the pivot block to fit into tight spaces.
- **Clearing Blocks (1–6)**: Align 3 or more blocks vertically or horizontally so that their sum equals exactly **7** to clear them.
- **Clearing 7s**: Align 3 or more **7** blocks vertically or horizontally to eliminate them from the board.
- **Neighbor Block Alterations (Chain Reactions)**:
  - When **1–6** blocks are cleared, adjacent tiles (numbered 2–6) decrease by **1**.
  - When **7** blocks are cleared, adjacent tiles (numbered 2–6) are halved (rounded up).
  - *Note: Blocks numbered 1 and 7 are immune to neighboring alterations.*
- **Splitting Blocks**: If one block of a falling pair lands on an obstacle, the other block detaches and continues falling to the lowest available space.

---

## 🕹️ Controls

| Action | Keyboard | On-Screen Button |
| :--- | :--- | :--- |
| **Move Left / Right** | `←` / `→` (Left / Right Arrows) | `←` / `→` |
| **Rotate Clockwise** | `Space` or `5` | `↻` |
| **Soft Drop** | `↓` (Down Arrow) | — |
| **Hard Drop** | `Enter` | `DROP` |
| **Pause / Resume** | `P` | `PAUSE` |
| **Restart Game** | — | `RESTART` |

---

## 🎮 Play Online

Play directly in your browser without any installation:

👉 **[https://gadgetking-y.github.io/777_tripleseven/](https://gadgetking-y.github.io/777_tripleseven/)**

---

## 🚀 Local Setup

Simply open `index.html` in any modern browser, or run a lightweight local server:

```sh
python3 -m http.server 5173
```
Then navigate to `http://localhost:5173`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
