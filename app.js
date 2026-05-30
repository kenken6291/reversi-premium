/**
 * Reversi Premium - Game Logic & UI Orchestrator
 */

// --- Constants ---
const EMPTY = 0;
const BLACK = 1; // Player 1 (Classic starting)
const WHITE = 2; // Player 2 or AI

// Board Weights for AI Evaluation (Medium & Hard)
const BOARD_WEIGHTS = [
    [100, -35,  10,   5,   5,  10, -35, 100],
    [-35, -45,  -5,  -5,  -5,  -5, -45, -35],
    [ 10,  -5,  12,   3,   3,  12,  -5,  10],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [  5,  -5,   3,   3,   3,   3,  -5,   5],
    [ 10,  -5,  12,   3,   3,  12,  -5,  10],
    [-35, -45,  -5,  -5,  -5,  -5, -45, -35],
    [100, -35,  10,   5,   5,  10, -35, 100]
];

// --- Audio Synth (Web Audio API) ---
class SoundSynth {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, volume, delay = 0) {
        if (this.muted) return;
        this.init();
        
        setTimeout(() => {
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                
                gain.gain.setValueAtTime(volume, this.ctx.currentTime);
                // Smooth decay
                gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {
                console.error("Audio error", e);
            }
        }, delay * 1000);
    }

    playPlaceSound() {
        // High quality damp thud sound
        this.playTone(180, 'triangle', 0.15, 0.6);
        this.playTone(80, 'sine', 0.1, 0.4);
    }

    playFlipSound() {
        // Rustle/Flip effect
        this.playTone(320, 'sine', 0.08, 0.3);
        this.playTone(450, 'sine', 0.08, 0.2, 0.04);
        this.playTone(600, 'sine', 0.08, 0.1, 0.08);
    }

    playPassSound() {
        // Warning sound
        this.playTone(220, 'sawtooth', 0.2, 0.2);
        this.playTone(180, 'sawtooth', 0.2, 0.2, 0.1);
    }

    playWinSound() {
        const chord = [261.63, 329.63, 392.00, 523.25]; // C major
        chord.forEach((freq, idx) => {
            this.playTone(freq, 'sine', 0.5, 0.25, idx * 0.1);
        });
        this.playTone(659.25, 'sine', 0.8, 0.2, 0.5); // high E
    }

    playLoseSound() {
        const chord = [261.63, 311.13, 392.00, 466.16]; // C minor 7 down
        chord.reverse().forEach((freq, idx) => {
            this.playTone(freq, 'sine', 0.5, 0.2, idx * 0.12);
        });
    }

    playDrawSound() {
        this.playTone(349.23, 'sine', 0.3, 0.2); // F
        this.playTone(349.23, 'sine', 0.3, 0.2, 0.25);
    }
}

const synth = new SoundSynth();

// --- Game State Variables ---
let board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
let turn = BLACK;
let gameMode = 'pve'; // 'pvp' or 'pve'
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'
let playerColor = BLACK; // Black in AI game by default
let gameActive = true;
let moveHistory = []; // Stack of states for Undo
let gameRecord = []; // List of actual coordinates played (for replay)
let replayMode = false;
let replayIndex = -1;
let replayTimer = null;

// Timer properties
let timerInterval = null;
let timerBlack = 0;
let timerWhite = 0;

// Local stats structure
let gameStats = {
    pvp: { total: 0, blackWins: 0, whiteWins: 0, draws: 0 },
    pve: { total: 0, playerWins: 0, aiWins: 0, draws: 0 }
};

// --- DOM Elements ---
const boardEl = document.getElementById('board');
const statusMessageEl = document.getElementById('status-message');
const scoreBlackEl = document.getElementById('score-black');
const scoreWhiteEl = document.getElementById('score-white');
const nameBlackEl = document.getElementById('name-black');
const nameWhiteEl = document.getElementById('name-white');
const timerBlackEl = document.getElementById('timer-black');
const timerWhiteEl = document.getElementById('timer-white');
const playerBlackCard = document.getElementById('player-black-card');
const playerWhiteCard = document.getElementById('player-white-card');

const selectGameMode = document.getElementById('game-mode');
const selectAiDifficulty = document.getElementById('ai-difficulty');
const selectPlayerColor = document.getElementById('player-color');
const selectTheme = document.getElementById('theme-select');

const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const btnHistory = document.getElementById('btn-history');
const btnMute = document.getElementById('btn-mute');
const svgSoundOn = document.getElementById('svg-sound-on');
const svgSoundOff = document.getElementById('svg-sound-off');

// Modals
const resultModal = document.getElementById('result-modal');
const winnerTextEl = document.getElementById('winnerText');
const finalScoreBlackEl = document.getElementById('final-score-black');
const finalScoreWhiteEl = document.getElementById('final-score-white');
const finalNameBlackEl = document.getElementById('final-name-black');
const finalNameWhiteEl = document.getElementById('final-name-white');
const gameEndReasonEl = document.getElementById('game-end-reason');
const btnModalRestart = document.getElementById('btn-modal-restart');
const btnModalClose = document.getElementById('btn-modal-close');

const historyModal = document.getElementById('history-modal');
const btnHistoryClose = document.getElementById('btn-history-close');
const btnClearStats = document.getElementById('btn-clear-stats');

// Replay panel
const replayPanel = document.getElementById('replay-panel');
const btnReplayPrev = document.getElementById('btn-replay-prev');
const btnReplayNext = document.getElementById('btn-replay-next');
const btnReplayAuto = document.getElementById('btn-replay-auto');
const replayStepsEl = document.getElementById('replay-steps');
const svgPlay = document.getElementById('svg-play');
const svgPause = document.getElementById('svg-pause');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    setupEventListeners();
    applyTheme(selectTheme.value);
    resetGame();
});

// --- Sound Mute handling ---
function toggleMute() {
    synth.muted = !synth.muted;
    if (synth.muted) {
        svgSoundOn.classList.add('hidden');
        svgSoundOff.classList.remove('hidden');
    } else {
        svgSoundOn.classList.remove('hidden');
        svgSoundOff.classList.add('hidden');
        synth.init();
    }
}

// --- Local Storage Stats ---
function loadStats() {
    const saved = localStorage.getItem('reversi_premium_stats');
    if (saved) {
        try {
            gameStats = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse saved stats", e);
        }
    }
    updateStatsDOM();
}

function saveStats() {
    localStorage.setItem('reversi_premium_stats', JSON.stringify(gameStats));
    updateStatsDOM();
}

function updateStatsDOM() {
    document.getElementById('stat-pvp-total').textContent = gameStats.pvp.total;
    document.getElementById('stat-pvp-black-wins').textContent = gameStats.pvp.blackWins;
    document.getElementById('stat-pvp-white-wins').textContent = gameStats.pvp.whiteWins;
    document.getElementById('stat-pvp-draws').textContent = gameStats.pvp.draws;

    document.getElementById('stat-pve-total').textContent = gameStats.pve.total;
    document.getElementById('stat-pve-player-wins').textContent = gameStats.pve.playerWins;
    document.getElementById('stat-pve-ai-wins').textContent = gameStats.pve.aiWins;
    document.getElementById('stat-pve-draws').textContent = gameStats.pve.draws;
}

function clearStats() {
    if (confirm("すべての対戦成績データを削除してもよろしいですか？")) {
        gameStats = {
            pvp: { total: 0, blackWins: 0, whiteWins: 0, draws: 0 },
            pve: { total: 0, playerWins: 0, aiWins: 0, draws: 0 }
        };
        saveStats();
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Buttons
    btnRestart.addEventListener('click', () => {
        synth.init();
        resetGame();
    });
    btnUndo.addEventListener('click', () => {
        synth.init();
        undoMove();
    });
    btnHistory.addEventListener('click', () => {
        historyModal.classList.remove('hidden');
    });
    btnMute.addEventListener('click', toggleMute);
    
    // Select options changes
    selectGameMode.addEventListener('change', (e) => {
        gameMode = e.target.value;
        const aiGroup = document.getElementById('ai-difficulty-group');
        const colorGroup = document.getElementById('player-color-group');
        
        if (gameMode === 'pvp') {
            aiGroup.classList.add('hidden');
            colorGroup.classList.add('hidden');
        } else {
            aiGroup.classList.remove('hidden');
            colorGroup.classList.remove('hidden');
        }
        resetGame();
    });
    
    selectAiDifficulty.addEventListener('change', (e) => {
        aiDifficulty = e.target.value;
        resetGame();
    });
    
    selectPlayerColor.addEventListener('change', (e) => {
        playerColor = e.target.value === 'black' ? BLACK : WHITE;
        resetGame();
    });

    selectTheme.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });

    // Modal buttons
    btnModalRestart.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetGame();
    });
    btnModalClose.addEventListener('click', () => {
        resultModal.classList.add('hidden');
    });
    btnHistoryClose.addEventListener('click', () => {
        historyModal.classList.add('hidden');
    });
    btnClearStats.addEventListener('click', clearStats);

    // Tab buttons in History Modal
    const tabBtns = historyModal.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetId = btn.dataset.tab;
            historyModal.querySelectorAll('.tab-content').forEach(content => {
                if (content.id === targetId) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });

    // Replay controls
    btnReplayPrev.addEventListener('click', () => replayStepTo(replayIndex - 1));
    btnReplayNext.addEventListener('click', () => replayStepTo(replayIndex + 1));
    btnReplayAuto.addEventListener('click', toggleReplayAuto);
}

function applyTheme(themeName) {
    document.body.className = '';
    document.body.classList.add(`theme-${themeName}`);
}

// --- Timer logic ---
function startTimers() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive || replayMode) return;
        
        if (turn === BLACK) {
            timerBlack++;
            updateTimerDOM(timerBlackEl, timerBlack);
        } else {
            timerWhite++;
            updateTimerDOM(timerWhiteEl, timerWhite);
        }
    }, 1000);
}

function updateTimerDOM(el, seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    el.textContent = `${mins}:${secs}`;
}

function resetTimers() {
    clearInterval(timerInterval);
    timerBlack = 0;
    timerWhite = 0;
    updateTimerDOM(timerBlackEl, 0);
    updateTimerDOM(timerWhiteEl, 0);
}

// --- Game Logic ---
function resetGame() {
    // Reset core states
    board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
    
    // Starting 4 discs
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    
    turn = BLACK;
    gameActive = true;
    moveHistory = [];
    gameRecord = [];
    replayMode = false;
    replayIndex = -1;
    clearInterval(replayTimer);
    
    // UI elements reset
    btnUndo.disabled = true;
    replayPanel.classList.add('hidden');
    
    gameMode = selectGameMode.value;
    aiDifficulty = selectAiDifficulty.value;
    playerColor = selectPlayerColor.value === 'black' ? BLACK : WHITE;

    // Set player names in DOM
    if (gameMode === 'pvp') {
        nameBlackEl.textContent = 'プレイヤー1 (黒)';
        nameWhiteEl.textContent = 'プレイヤー2 (白)';
    } else {
        if (playerColor === BLACK) {
            nameBlackEl.textContent = 'あなた (黒)';
            nameWhiteEl.textContent = 'AI (白)';
        } else {
            nameBlackEl.textContent = 'AI (黒)';
            nameWhiteEl.textContent = 'あなた (白)';
        }
    }

    resetTimers();
    renderBoard();
    updateUI();
    startTimers();
    
    // Trigger AI if it's AI's turn to start (if player chose White)
    if (gameMode === 'pve' && playerColor === WHITE) {
        triggerAiMove();
    }
}

// Deep clone board state
function cloneBoard(src) {
    return src.map(arr => [...arr]);
}

// Save current state for Undo
function saveHistory() {
    moveHistory.push({
        board: cloneBoard(board),
        turn: turn,
        timerBlack: timerBlack,
        timerWhite: timerWhite,
        gameActive: gameActive
    });
    btnUndo.disabled = false;
}

function renderBoard() {
    boardEl.innerHTML = '';
    const validMoves = gameActive && (!replayMode) ? getValidMoves(board, turn) : [];
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            // Add specific marker dots for Othello grid (usually D3, D6, F3, F6 points)
            if ((r === 2 || r === 6) && (c === 2 || c === 6)) {
                cell.classList.add('marker');
            }
            
            // Disc representation
            const state = board[r][c];
            if (state !== EMPTY) {
                const wrapper = document.createElement('div');
                wrapper.className = 'disc-wrapper';
                
                const container = document.createElement('div');
                container.className = `disc-container ${state === WHITE ? 'white' : ''}`;
                
                // Add pop-in animation on the very last move (non-replay)
                const isLastMove = gameRecord.length > 0 && 
                                   gameRecord[gameRecord.length - 1].r === r && 
                                   gameRecord[gameRecord.length - 1].c === c;
                if (isLastMove && !replayMode) {
                    container.classList.add('new-placement');
                }
                
                const blackFace = document.createElement('div');
                blackFace.className = 'disc-face black';
                
                const whiteFace = document.createElement('div');
                whiteFace.className = 'disc-face white';
                
                container.appendChild(blackFace);
                container.appendChild(whiteFace);
                wrapper.appendChild(container);
                cell.appendChild(wrapper);
            }
            
            // Interactive hint dots for current active player
            const isValid = validMoves.some(mv => mv[0] === r && mv[1] === c);
            if (isValid && !replayMode) {
                // If it is AI's turn, do not show visual hints to human
                const isAiTurn = gameMode === 'pve' && turn !== playerColor;
                if (!isAiTurn) {
                    cell.classList.add('hint');
                    cell.classList.add(turn === BLACK ? 'player-black-turn' : 'player-white-turn');
                    cell.addEventListener('click', () => handleCellClick(r, c));
                }
            }
            
            // Prevent click on already placed cells
            if (state === EMPTY && !isValid) {
                // Clicking on empty invalid cells does nothing
            } else if (state !== EMPTY) {
                // Clicking on full cells does nothing
            }

            boardEl.appendChild(cell);
        }
    }
}

function updateUI() {
    // Count scores
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === BLACK) blackCount++;
            if (board[r][c] === WHITE) whiteCount++;
        }
    }
    
    scoreBlackEl.textContent = blackCount;
    scoreWhiteEl.textContent = whiteCount;
    
    // Toggle active classes
    if (turn === BLACK) {
        playerBlackCard.classList.add('active');
        playerWhiteCard.classList.remove('active');
        statusMessageEl.textContent = `${nameBlackEl.textContent}のターンです (黒)`;
    } else {
        playerBlackCard.classList.remove('active');
        playerWhiteCard.classList.add('active');
        statusMessageEl.textContent = `${nameWhiteEl.textContent}のターンです (白)`;
    }
    
    // AI Thinking indicator spinner
    const isAiThinking = gameActive && gameMode === 'pve' && turn !== playerColor && !replayMode;
    if (isAiThinking) {
        if (turn === BLACK) {
            playerBlackCard.querySelector('.thinking-spinner').classList.remove('hidden');
        } else {
            playerWhiteCard.querySelector('.thinking-spinner').classList.remove('hidden');
        }
        statusMessageEl.textContent = "AI思考中...";
    } else {
        playerBlackCard.querySelector('.thinking-spinner').classList.add('hidden');
        playerWhiteCard.querySelector('.thinking-spinner').classList.add('hidden');
    }
}

function handleCellClick(row, col) {
    if (!gameActive || replayMode) return;
    
    // In AI mode, block human clicks if it's AI's turn
    if (gameMode === 'pve' && turn !== playerColor) {
        return;
    }
    
    executeMove(row, col);
}

function executeMove(row, col) {
    saveHistory();
    
    const flippedDiscs = applyMove(board, row, col, turn);
    gameRecord.push({ r: row, c: col, t: turn });
    
    synth.playPlaceSound();
    
    // Animate flip of adjacent discs
    renderBoard();
    updateUI();
    
    // Trigger CSS animation delay simulation for flips
    if (flippedDiscs.length > 0) {
        setTimeout(() => {
            synth.playFlipSound();
        }, 150);
    }
    
    // Proceed to next turn
    setTimeout(() => {
        advanceTurn();
    }, 600);
}

function advanceTurn() {
    if (!gameActive) return;
    
    const nextTurn = turn === BLACK ? WHITE : BLACK;
    const nextMoves = getValidMoves(board, nextTurn);
    
    if (nextMoves.length > 0) {
        turn = nextTurn;
        renderBoard();
        updateUI();
        
        // If AI's turn, trigger it
        if (gameMode === 'pve' && turn !== playerColor) {
            triggerAiMove();
        }
    } else {
        // Next player has no moves, must pass
        const currentMoves = getValidMoves(board, turn);
        if (currentMoves.length > 0) {
            // Pass and back to current player
            synth.playPassSound();
            statusMessageEl.textContent = `${nextTurn === BLACK ? '黒' : '白'}に置ける場所がないためパスします。`;
            
            setTimeout(() => {
                renderBoard();
                updateUI();
                if (gameMode === 'pve' && turn !== playerColor) {
                    triggerAiMove();
                }
            }, 1200);
        } else {
            // Both players have no valid moves: End Game
            endGame();
        }
    }
}

// Core Reversi Rule engine: Place disc and flip matching discs. Mutates the board array.
function applyMove(targetBoard, row, col, playerColor) {
    const oppColor = playerColor === BLACK ? WHITE : BLACK;
    targetBoard[row][col] = playerColor;
    
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    
    let flippedCells = [];
    
    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        let potentialFlips = [];
        
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && targetBoard[r][c] === oppColor) {
            potentialFlips.push([r, c]);
            r += dr;
            c += dc;
        }
        
        // If ends with our own color, flip all in between
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && targetBoard[r][c] === playerColor) {
            for (const [fr, fc] of potentialFlips) {
                targetBoard[fr][fc] = playerColor;
                flippedCells.push([fr, fc]);
            }
        }
    }
    
    return flippedCells;
}

// Return array of valid coordinate pairs [row, col]
function getValidMoves(targetBoard, playerColor) {
    const oppColor = playerColor === BLACK ? WHITE : BLACK;
    const moves = [];
    
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (targetBoard[r][c] !== EMPTY) continue;
            
            let isValid = false;
            for (const [dr, dc] of directions) {
                let checkR = r + dr;
                let checkC = c + dc;
                let count = 0;
                
                while (checkR >= 0 && checkR < 8 && checkC >= 0 && checkC < 8 && targetBoard[checkR][checkC] === oppColor) {
                    checkR += dr;
                    checkC += dc;
                    count++;
                }
                
                if (count > 0 && checkR >= 0 && checkR < 8 && checkC >= 0 && checkC < 8 && targetBoard[checkR][checkC] === playerColor) {
                    isValid = true;
                    break;
                }
            }
            
            if (isValid) {
                moves.push([r, c]);
            }
        }
    }
    
    return moves;
}

// Undo Logic
function undoMove() {
    if (moveHistory.length === 0 || replayMode) return;
    
    // In AI Mode, we need to undo both AI and Player moves to get back to player's turn
    if (gameMode === 'pve' && moveHistory.length >= 2) {
        // Pop last AI turn state
        moveHistory.pop();
        gameRecord.pop();
        // Pop last Player turn state
        const prevState = moveHistory.pop();
        gameRecord.pop();
        
        restoreState(prevState);
    } else {
        // Standard PvP single move undo
        const prevState = moveHistory.pop();
        gameRecord.pop();
        
        restoreState(prevState);
    }
    
    if (moveHistory.length === 0) {
        btnUndo.disabled = true;
    }
    
    renderBoard();
    updateUI();
}

function restoreState(state) {
    board = cloneBoard(state.board);
    turn = state.turn;
    timerBlack = state.timerBlack;
    timerWhite = state.timerWhite;
    gameActive = state.gameActive;
    
    updateTimerDOM(timerBlackEl, timerBlack);
    updateTimerDOM(timerWhiteEl, timerWhite);
}

// --- AI Engine ---
function triggerAiMove() {
    updateUI();
    const delay = 600 + Math.random() * 800; // Simulated thinking time for UI organic feel
    
    setTimeout(() => {
        if (!gameActive || turn === playerColor) return;
        
        const moves = getValidMoves(board, turn);
        if (moves.length === 0) {
            advanceTurn();
            return;
        }
        
        let selectedMove = null;
        if (aiDifficulty === 'easy') {
            selectedMove = getEasyAiMove(moves);
        } else if (aiDifficulty === 'medium') {
            selectedMove = getMediumAiMove(board, moves, turn);
        } else {
            selectedMove = getHardAiMove(board, moves, turn);
        }
        
        if (selectedMove) {
            executeMove(selectedMove[0], selectedMove[1]);
        }
    }, delay);
}

// Easy Mode: Pick completely random valid cell
function getEasyAiMove(validMoves) {
    const idx = Math.floor(Math.random() * validMoves.length);
    return validMoves[idx];
}

// Medium Mode: Simple positional utility weight lookup
function getMediumAiMove(currentBoard, validMoves, aiColor) {
    let bestScore = -Infinity;
    let bestMoves = [];
    
    for (const [r, c] of validMoves) {
        const score = BOARD_WEIGHTS[r][c];
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [[r, c]];
        } else if (score === bestScore) {
            bestMoves.push([r, c]);
        }
    }
    
    // Pick randomly from equivalent scoring moves
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Hard Mode: Minimax with Alpha-Beta Pruning (4 plies depth search)
function getHardAiMove(currentBoard, validMoves, aiColor) {
    let bestScore = -Infinity;
    let bestMoves = [];
    const depth = 4; // High response rate, reasonable lookahead
    
    for (const [r, c] of validMoves) {
        // Simulate move
        const simulatedBoard = cloneBoard(currentBoard);
        applyMove(simulatedBoard, r, c, aiColor);
        
        // Evaluate subsequent outcome branch
        const score = minimax(simulatedBoard, depth - 1, -Infinity, Infinity, false, aiColor);
        
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [[r, c]];
        } else if (score === bestScore) {
            bestMoves.push([r, c]);
        }
    }
    
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Minimax node expansion with Alpha-Beta pruning
function minimax(tempBoard, depth, alpha, beta, isMaxBranch, aiColor) {
    const oppColor = aiColor === BLACK ? WHITE : BLACK;
    const currentColor = isMaxBranch ? aiColor : oppColor;
    const moves = getValidMoves(tempBoard, currentColor);
    
    // End tree evaluation
    if (depth === 0 || moves.length === 0) {
        return evaluateBoardState(tempBoard, aiColor);
    }
    
    if (isMaxBranch) {
        let maxVal = -Infinity;
        for (const [r, c] of moves) {
            const nextBoard = cloneBoard(tempBoard);
            applyMove(nextBoard, r, c, aiColor);
            
            const val = minimax(nextBoard, depth - 1, alpha, beta, false, aiColor);
            maxVal = Math.max(maxVal, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break; // Beta cut-off
        }
        return maxVal;
    } else {
        let minVal = Infinity;
        for (const [r, c] of moves) {
            const nextBoard = cloneBoard(tempBoard);
            applyMove(nextBoard, r, c, oppColor);
            
            const val = minimax(nextBoard, depth - 1, alpha, beta, true, aiColor);
            minVal = Math.min(minVal, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break; // Alpha cut-off
        }
        return minVal;
    }
}

// Advanced evaluation heuristic function
function evaluateBoardState(evalBoard, aiColor) {
    const oppColor = aiColor === BLACK ? WHITE : BLACK;
    let score = 0;
    
    let aiDiscs = 0;
    let oppDiscs = 0;
    
    // Phase calculation: early, middle or late game
    let totalDiscs = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const disc = evalBoard[r][c];
            if (disc === EMPTY) continue;
            
            totalDiscs++;
            
            if (disc === aiColor) {
                aiDiscs++;
                score += BOARD_WEIGHTS[r][c];
            } else {
                oppDiscs++;
                score -= BOARD_WEIGHTS[r][c];
            }
        }
    }
    
    // Dynamic weights depending on the game phase
    const isEndGame = totalDiscs > 48;
    
    if (isEndGame) {
        // Enforce disc quantity over positional structures
        score += (aiDiscs - oppDiscs) * 15;
    } else {
        // Mobility assessment: prioritize limiting opponent moves while maximizing our choices
        const aiMobility = getValidMoves(evalBoard, aiColor).length;
        const oppMobility = getValidMoves(evalBoard, oppColor).length;
        score += (aiMobility - oppMobility) * 8;
    }
    
    return score;
}

// --- End Game Handler ---
function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    
    // Count scores
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === BLACK) blackCount++;
            if (board[r][c] === WHITE) whiteCount++;
        }
    }
    
    let winner = null;
    if (blackCount > whiteCount) {
        winner = BLACK;
    } else if (whiteCount > blackCount) {
        winner = WHITE;
    }
    
    // Display results in Modal
    finalScoreBlackEl.textContent = blackCount;
    finalScoreWhiteEl.textContent = whiteCount;
    
    if (gameMode === 'pvp') {
        finalNameBlackEl.textContent = "黒 (P1)";
        finalNameWhiteEl.textContent = "白 (P2)";
        
        gameStats.pvp.total++;
        if (winner === BLACK) {
            winnerTextEl.textContent = "プレイヤー1 (黒) の勝ち！";
            gameStats.pvp.blackWins++;
            synth.playWinSound();
        } else if (winner === WHITE) {
            winnerTextEl.textContent = "プレイヤー2 (白) の勝ち！";
            gameStats.pvp.whiteWins++;
            synth.playWinSound();
        } else {
            winnerTextEl.textContent = "引き分け！";
            gameStats.pvp.draws++;
            synth.playDrawSound();
        }
    } else {
        finalNameBlackEl.textContent = playerColor === BLACK ? "あなた (黒)" : "AI (黒)";
        finalNameWhiteEl.textContent = playerColor === WHITE ? "あなた (白)" : "AI (白)";
        
        gameStats.pve.total++;
        if (winner === playerColor) {
            winnerTextEl.textContent = "あなたの勝利！";
            gameStats.pve.playerWins++;
            synth.playWinSound();
        } else if (winner !== null) {
            winnerTextEl.textContent = "AI (コンピュータ) の勝利！";
            gameStats.pve.aiWins++;
            synth.playLoseSound();
        } else {
            winnerTextEl.textContent = "引き分け！";
            gameStats.pve.draws++;
            synth.playDrawSound();
        }
    }
    
    // Save updated stats
    saveStats();
    
    // Reason determination
    const emptyCount = board.flat().filter(cell => cell === EMPTY).length;
    if (emptyCount === 0) {
        gameEndReasonEl.textContent = "すべてのマスが埋まりました。";
    } else if (blackCount === 0 || whiteCount === 0) {
        gameEndReasonEl.textContent = "片方のプレイヤーの石が全滅しました。";
    } else {
        gameEndReasonEl.textContent = "両者とも置ける場所がなくなりました。";
    }
    
    // Activate Replay Review Mode
    replayMode = false;
    btnUndo.disabled = true;
    
    // Show Modal with slight delay
    setTimeout(() => {
        resultModal.classList.remove('hidden');
        statusMessageEl.textContent = "ゲーム終了。棋譜レビューが可能です。";
        setupReplayPanel();
    }, 1000);
}

// --- Replay Review Mode Logic ---
function setupReplayPanel() {
    replayMode = true;
    replayIndex = gameRecord.length; // Pointing to the final board position
    replayPanel.classList.remove('hidden');
    updateReplayUI();
}

function updateReplayUI() {
    replayStepsEl.textContent = `${replayIndex} / ${gameRecord.length}`;
    
    // Disable prev/next according to boundaries
    btnReplayPrev.disabled = replayIndex <= 0;
    btnReplayNext.disabled = replayIndex >= gameRecord.length;
}

function replayStepTo(index) {
    if (!replayMode || index < 0 || index > gameRecord.length) return;
    
    clearInterval(replayTimer);
    setReplayPlayIconState(false);
    
    replayIndex = index;
    reconstructBoardAtStep(replayIndex);
    updateReplayUI();
}

// Rebuild board DYNAMICALLY from move list record
function reconstructBoardAtStep(stepCount) {
    // Start from default initial state
    board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    
    // Replay moves up to stepCount
    for (let i = 0; i < stepCount; i++) {
        const move = gameRecord[i];
        applyMove(board, move.r, move.c, move.t);
    }
    
    // Update active visual scores based on step count
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === BLACK) blackCount++;
            if (board[r][c] === WHITE) whiteCount++;
        }
    }
    scoreBlackEl.textContent = blackCount;
    scoreWhiteEl.textContent = whiteCount;
    
    // Active turn indicator
    if (stepCount < gameRecord.length) {
        turn = gameRecord[stepCount].t;
    } else {
        turn = gameRecord[gameRecord.length - 1].t === BLACK ? WHITE : BLACK;
    }
    
    renderBoard();
    
    // Visually highlight last played cell in replay mode
    if (stepCount > 0) {
        const lastMove = gameRecord[stepCount - 1];
        const cellEl = boardEl.querySelector(`[data-row="${lastMove.r}"][data-col="${lastMove.c}"]`);
        if (cellEl) {
            cellEl.style.backgroundColor = 'var(--cell-hover)';
        }
    }
}

function toggleReplayAuto() {
    if (replayTimer) {
        // Pause
        clearInterval(replayTimer);
        replayTimer = null;
        setReplayPlayIconState(false);
    } else {
        // Start auto play
        if (replayIndex >= gameRecord.length) {
            replayIndex = 0; // wrap around
        }
        setReplayPlayIconState(true);
        playNextReplayFrame();
    }
}

function playNextReplayFrame() {
    if (replayIndex >= gameRecord.length) {
        clearInterval(replayTimer);
        replayTimer = null;
        setReplayPlayIconState(false);
        return;
    }
    
    replayTimer = setTimeout(() => {
        replayIndex++;
        reconstructBoardAtStep(replayIndex);
        updateReplayUI();
        synth.playPlaceSound();
        synth.playFlipSound();
        playNextReplayFrame();
    }, 1000);
}

function setReplayPlayIconState(isPlaying) {
    if (isPlaying) {
        svgPlay.classList.add('hidden');
        svgPause.classList.remove('hidden');
    } else {
        svgPlay.classList.remove('hidden');
        svgPause.classList.add('hidden');
    }
}
