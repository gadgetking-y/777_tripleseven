const ROWS = 13;
const COLS = 7;
const START_COL = Math.floor(COLS / 2);
const BEST_KEY = "triple-seven-best";
const ROTATION_ORDER = ["down", "left", "up", "right"];
const ROTATION_OFFSETS = {
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
};

const gridElement = document.getElementById("gameGrid");
const nextElement = document.getElementById("nextStack");
const levelElement = document.getElementById("levelValue");
const scoreElement = document.getElementById("scoreValue");
const bestElement = document.getElementById("bestValue");
const messageElement = document.getElementById("messageLine");

const buttons = {
  left: document.getElementById("leftButton"),
  right: document.getElementById("rightButton"),
  rotate: document.getElementById("swapButton"),
  drop: document.getElementById("dropButton"),
  pause: document.getElementById("pauseButton"),
  restart: document.getElementById("restartButton"),
};

let board;
let activePair;
let nextPair;
let score;
let best;
let level;
let fallDelay;
let lastFall;
let isPaused;
let isGameOver;
let isResolving;
let animationFrame;
let clearingCells = new Set();
let audioContext;
let soundEnabled = true;
let currentResolveId = 0;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomBlock() {
  return Math.floor(Math.random() * 7) + 1;
}

function randomPair() {
  return [randomBlock(), randomBlock()];
}

function startGame() {
  currentResolveId += 1;
  board = emptyBoard();
  score = 0;
  level = 1;
  fallDelay = 850;
  lastFall = performance.now();
  isPaused = false;
  isGameOver = false;
  isResolving = false;
  clearingCells = new Set();
  best = Number(localStorage.getItem(BEST_KEY) || 0);
  nextPair = randomPair();
  spawnPair();
  messageElement.textContent = "777 <FOR WEB>";
  render();
}

function spawnPair() {
  activePair = {
    row: 0,
    col: START_COL,
    orientation: "down",
    values: nextPair,
  };
  nextPair = randomPair();

  if (!canOccupy(activePair.row, activePair.col, activePair.orientation)) {
    endGame();
  }
}

function getPairCells(
  row = activePair.row,
  col = activePair.col,
  orientation = activePair.orientation,
  values = activePair.values,
) {
  const offset = ROTATION_OFFSETS[orientation];

  return [
    { row, col, value: values[0] },
    { row: row + offset.row, col: col + offset.col, value: values[1] },
  ];
}

function canOccupy(row, col, orientation = activePair.orientation) {
  return getPairCells(row, col, orientation).every((cell) => {
    if (cell.col < 0 || cell.col >= COLS || cell.row >= ROWS) return false;
    if (cell.row < 0) return true;
    return board[cell.row][cell.col] === null;
  });
}

function movePair(deltaCol) {
  if (!canControl()) return;
  const nextCol = activePair.col + deltaCol;
  if (canOccupy(activePair.row, nextCol, activePair.orientation)) {
    activePair.col = nextCol;
    playSound("move");
    render();
  }
}

function rotatePair() {
  if (!canControl()) return;
  const currentIndex = ROTATION_ORDER.indexOf(activePair.orientation);
  const nextOrientation = ROTATION_ORDER[(currentIndex + 1) % ROTATION_ORDER.length];
  const candidates = [
    { row: activePair.row, col: activePair.col },
    { row: activePair.row, col: activePair.col - 1 },
    { row: activePair.row, col: activePair.col + 1 },
    { row: activePair.row - 1, col: activePair.col },
    { row: activePair.row + 1, col: activePair.col },
  ];

  for (const candidate of candidates) {
    if (canOccupy(candidate.row, candidate.col, nextOrientation)) {
      activePair.row = candidate.row;
      activePair.col = candidate.col;
      activePair.orientation = nextOrientation;
      playSound("rotate");
      render();
      return;
    }
  }
}

function softDrop() {
  if (!canControl()) return;
  if (canOccupy(activePair.row + 1, activePair.col, activePair.orientation)) {
    activePair.row += 1;
    lastFall = performance.now();
    playSound("drop");
    render();
    return;
  }
  lockPair();
}

function hardDrop() {
  if (!canControl()) return;
  while (canOccupy(activePair.row + 1, activePair.col, activePair.orientation)) {
    activePair.row += 1;
  }
  playSound("drop");
  lockPair();
}

function canControl() {
  return !isPaused && !isGameOver && !isResolving && activePair;
}

function lockPair() {
  const cells = getPairCells().sort((a, b) => b.row - a.row);
  let overflow = false;

  for (const cell of cells) {
    let targetRow = cell.row;
    while (targetRow < ROWS - 1 && board[Math.max(0, targetRow + 1)][cell.col] === null) {
      targetRow += 1;
    }
    if (targetRow < 0) {
      overflow = true;
    } else {
      board[targetRow][cell.col] = cell.value;
    }
  }

  activePair = null;

  if (overflow) {
    endGame();
    return;
  }

  addScore(1);
  playSound("lock");
  resolveBoard();
}

async function resolveBoard() {
  isResolving = true;
  const resolveId = ++currentResolveId;
  let chain = 1;

  while (!isGameOver && resolveId === currentResolveId) {
    const matches = findMatches();
    if (matches.size === 0) break;

    clearingCells = matches;
    playSound("clear", chain);
    render();
    await wait(160);
    if (resolveId !== currentResolveId || isGameOver) return;

    applyNeighborChanges(matches);
    clearMatchedCells(matches);
    applyGravity();
    addScore((matches.size - 2) * 20 * chain);
    chain += 1;
    clearingCells = new Set();
    render();
    await wait(110);
    if (resolveId !== currentResolveId || isGameOver) return;
  }

  if (resolveId !== currentResolveId || isGameOver) return;

  isResolving = false;
  spawnPair();
  lastFall = performance.now();
  render();
}

function findMatches() {
  const matches = new Map();

  for (let row = 0; row < ROWS; row += 1) {
    scanLine(Array.from({ length: COLS }, (_, col) => ({ row, col })));
  }

  for (let col = 0; col < COLS; col += 1) {
    scanLine(Array.from({ length: ROWS }, (_, row) => ({ row, col })));
  }

  function mark(cells) {
    for (const cell of cells) {
      matches.set(cellKey(cell.row, cell.col), true);
    }
  }

  function scanLine(cells) {
    for (let start = 0; start < cells.length; start += 1) {
      const startValue = valueAt(cells[start]);
      if (startValue === null) continue;

      if (startValue === 7) {
        const run = [];
        for (let index = start; index < cells.length && valueAt(cells[index]) === 7; index += 1) {
          run.push(cells[index]);
        }
        if (run.length >= 3) mark(run);
        start += Math.max(run.length - 1, 0);
        continue;
      }

      let sum = 0;
      const run = [];
      for (let index = start; index < cells.length; index += 1) {
        const value = valueAt(cells[index]);
        if (value === null || value === 7) break;
        sum += value;
        run.push(cells[index]);
        if (run.length >= 3 && sum === 7) mark(run);
        if (sum >= 7) break;
      }
    }
  }

  return new Set(matches.keys());
}

function applyNeighborChanges(matches) {
  const changes = new Map();
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const key of matches) {
    const { row, col } = parseCellKey(key);
    const clearedValue = board[row][col];

    for (const [rowDelta, colDelta] of directions) {
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      const nextKey = cellKey(nextRow, nextCol);
      if (!inBounds(nextRow, nextCol) || matches.has(nextKey)) continue;

      const value = board[nextRow][nextCol];
      if (value === null || value === 1 || value === 7) continue;

      const current = changes.get(nextKey) || { row: nextRow, col: nextCol, seven: false };
      if (clearedValue === 7) current.seven = true;
      changes.set(nextKey, current);
    }
  }

  for (const change of changes.values()) {
    const value = board[change.row][change.col];
    board[change.row][change.col] = change.seven ? Math.ceil(value / 2) : value - 1;
  }
}

function clearMatchedCells(matches) {
  for (const key of matches) {
    const { row, col } = parseCellKey(key);
    board[row][col] = null;
  }
}

function applyGravity() {
  for (let col = 0; col < COLS; col += 1) {
    const stack = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (board[row][col] !== null) stack.push(board[row][col]);
    }
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      board[row][col] = stack[ROWS - 1 - row] ?? null;
    }
  }
}

function valueAt(cell) {
  return board[cell.row][cell.col];
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function cellKey(row, col) {
  return `${row}:${col}`;
}

function parseCellKey(key) {
  const [row, col] = key.split(":").map(Number);
  return { row, col };
}

function addScore(points) {
  score += points;
  level = Math.min(9, Math.floor(score / 250) + 1);
  fallDelay = Math.max(220, 900 - level * 70);

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
}

function endGame() {
  currentResolveId += 1;
  isGameOver = true;
  activePair = null;
  messageElement.textContent = "GAME OVER - RESTART";
  playSound("gameOver");
  render();
}

function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;
  messageElement.textContent = isPaused ? "PAUSE" : "777 <FOR WEB>";
  lastFall = performance.now();
  render();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ensureAudioContext() {
  if (!soundEnabled) return null;
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      soundEnabled = false;
      return null;
    }
    audioContext = new AudioCtor();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency, duration, volume = 0.035, type = "sine", delay = 0) {
  const context = ensureAudioContext();
  if (!context) return;

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSound(name, detail = 1) {
  switch (name) {
    case "move":
      playTone(360, 0.035, 0.018, "triangle");
      break;
    case "rotate":
      playTone(460, 0.045, 0.024, "triangle");
      playTone(620, 0.035, 0.018, "triangle", 0.025);
      break;
    case "drop":
      playTone(220, 0.03, 0.014, "sine");
      break;
    case "lock":
      playTone(150, 0.055, 0.025, "triangle");
      break;
    case "clear":
      playTone(520 + detail * 35, 0.07, 0.032, "sine");
      playTone(760 + detail * 35, 0.08, 0.025, "sine", 0.04);
      break;
    case "gameOver":
      playTone(240, 0.12, 0.028, "triangle");
      playTone(170, 0.16, 0.024, "triangle", 0.1);
      break;
    default:
      break;
  }
}

function render() {
  const activeCells = new Map();
  if (activePair) {
    for (const cell of getPairCells()) {
      if (cell.row >= 0) activeCells.set(cellKey(cell.row, cell.col), cell.value);
    }
  }

  gridElement.innerHTML = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = cellKey(row, col);
      const value = activeCells.get(key) ?? board[row][col];
      const cell = document.createElement("div");
      cell.className = "cell";
      if (value !== null && value !== undefined) {
        cell.classList.add("filled");
        cell.textContent = value;
        cell.dataset.value = String(value);
      }
      if (activeCells.has(key)) cell.classList.add("active");
      if (clearingCells.has(key)) cell.classList.add("clearing");
      gridElement.appendChild(cell);
    }
  }

  nextElement.innerHTML = "";
  for (const value of nextPair || []) {
    const cell = document.createElement("div");
    cell.className = "next-cell filled";
    cell.textContent = value;
    cell.dataset.value = String(value);
    nextElement.appendChild(cell);
  }

  scoreElement.textContent = String(score).padStart(6, "0");
  bestElement.textContent = String(best).padStart(6, "0");
  levelElement.textContent = String(level);
}

function tick(now) {
  if (!isPaused && !isGameOver && !isResolving && now - lastFall >= fallDelay) {
    softDrop();
    lastFall = now;
  }
  animationFrame = requestAnimationFrame(tick);
}

function bindInputs() {
  const handleUserAction = () => {
    ensureAudioContext();
  };

  document.addEventListener("keydown", (event) => {
    handleUserAction();
    if (["ArrowLeft", "ArrowRight", "ArrowDown", " ", "Enter"].includes(event.key)) {
      event.preventDefault();
    }

    switch (event.key) {
      case "ArrowLeft":
        movePair(-1);
        break;
      case "ArrowRight":
        movePair(1);
        break;
      case "ArrowDown":
        softDrop();
        break;
      case " ":
      case "5":
        rotatePair();
        break;
      case "Enter":
        hardDrop();
        break;
      case "p":
      case "P":
        togglePause();
        break;
      default:
        break;
    }
  });

  const attachButtonListener = (button, action) => {
    button.addEventListener("click", () => {
      handleUserAction();
      action();
    });
  };

  attachButtonListener(buttons.left, () => movePair(-1));
  attachButtonListener(buttons.right, () => movePair(1));
  attachButtonListener(buttons.rotate, rotatePair);
  attachButtonListener(buttons.drop, hardDrop);
  attachButtonListener(buttons.pause, togglePause);
  attachButtonListener(buttons.restart, startGame);
}

bindInputs();
startGame();
cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);