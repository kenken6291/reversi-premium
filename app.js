/**
 * Gomoku Premium - Game Logic & UI Orchestrator
 */

// --- Firebase Config (ユーザー設定エリア) ---
const firebaseConfig = {
  apiKey: "AIzaSyCILp9Mz5-AUKfR_b42SCjv9pkO93kUC08",
  authDomain: "reversi-premium.firebaseapp.com",
  databaseURL: "https://reversi-premium-default-rtdb.firebaseio.com",
  projectId: "reversi-premium",
  storageBucket: "reversi-premium.firebasestorage.app",
  messagingSenderId: "328739106410",
  appId: "1:328739106410:web:610c1af903d6e27eb4e413",
  measurementId: "G-B0VLLZTBGV"
};

// --- Constants ---
const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1; // Player 1 (先手)
const WHITE = 2; // Player 2 or AI (後手)

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
        // 石を置く「パチッ」という乾いた良い打音
        this.playTone(400, 'triangle', 0.08, 0.5);
        this.playTone(150, 'sine', 0.05, 0.4, 0.01);
    }

    playPlaceSoundOnline() {
        // オンライン対戦相手の打音（少し異なる音）
        this.playTone(450, 'triangle', 0.08, 0.5);
        this.playTone(180, 'sine', 0.05, 0.4, 0.01);
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
let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
let turn = BLACK;
let gameMode = 'pve'; // 'pvp', 'pve', or 'online'
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'
let playerColor = BLACK; // Black (先手) by default
let gameActive = true;
let moveHistory = []; // Undo用のスタック
let gameRecord = []; // 棋譜記録用
let replayMode = false;
let replayIndex = -1;
let replayTimer = null;

// Firebase Online Multiplayer States
let database = null;
let roomRef = null;
let roomId = null;
let myRole = null; // BLACK or WHITE
let isOnlineActive = false;
let oppConnected = false;

// Timer properties
let timerInterval = null;
let timerBlack = 0;
let timerWhite = 0;

// Local stats structure
let gameStats = {
    pvp: { total: 0, blackWins: 0, whiteWins: 0, draws: 0 },
    pve: { total: 0, playerWins: 0, aiWins: 0, draws: 0 },
    online: { total: 0, wins: 0, losses: 0, draws: 0 }
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

// Online DOM Elements
const onlineRoomGroup = document.getElementById('online-room-group');
const onlineInitView = document.getElementById('online-init-view');
const onlineWaitingView = document.getElementById('online-waiting-view');
const onlineActiveView = document.getElementById('online-active-view');
const displayRoomId = document.getElementById('display-room-id');
const inputRoomId = document.getElementById('input-room-id');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnCopyRoom = document.getElementById('btn-copy-room');
const btnCancelRoom = document.getElementById('btn-cancel-room');
const btnLeaveRoom = document.getElementById('btn-leave-room');

// Modals
const resultModal = document.getElementById('result-modal');
const winnerTextEl = document.getElementById('winner-text');
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
    const saved = localStorage.getItem('gomoku_premium_stats');
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
    localStorage.setItem('gomoku_premium_stats', JSON.stringify(gameStats));
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

    if (!gameStats.online) {
        gameStats.online = { total: 0, wins: 0, losses: 0, draws: 0 };
    }
    document.getElementById('stat-online-total').textContent = gameStats.online.total;
    document.getElementById('stat-online-wins').textContent = gameStats.online.wins;
    document.getElementById('stat-online-losses').textContent = gameStats.online.losses;
    document.getElementById('stat-online-draws').textContent = gameStats.online.draws;
}

function clearStats() {
    if (confirm("すべての対戦成績データを削除してもよろしいですか？")) {
        gameStats = {
            pvp: { total: 0, blackWins: 0, whiteWins: 0, draws: 0 },
            pve: { total: 0, playerWins: 0, aiWins: 0, draws: 0 },
            online: { total: 0, wins: 0, losses: 0, draws: 0 }
        };
        saveStats();
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    btnRestart.addEventListener('click', () => {
        synth.init();
        if (gameMode === 'online') {
            alert("オンライン対戦中は退出してからリセットしてください。");
            return;
        }
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
    
    selectGameMode.addEventListener('change', (e) => {
        if (gameMode === 'online' && roomRef) {
            if (!confirm("オンライン対戦中の部屋から退出しますか？")) {
                selectGameMode.value = 'online';
                return;
            }
            cleanUpOnlineRoom();
        }

        gameMode = e.target.value;
        const aiGroup = document.getElementById('ai-difficulty-group');
        const colorGroup = document.getElementById('player-color-group');
        
        if (gameMode === 'pvp') {
            aiGroup.classList.add('hidden');
            colorGroup.classList.add('hidden');
            onlineRoomGroup.classList.add('hidden');
            resetGame();
        } else if (gameMode === 'pve') {
            aiGroup.classList.remove('hidden');
            colorGroup.classList.remove('hidden');
            onlineRoomGroup.classList.add('hidden');
            resetGame();
        } else if (gameMode === 'online') {
            aiGroup.classList.add('hidden');
            colorGroup.classList.add('hidden');
            
            if (!initFirebase()) {
                alert("Firebase接続情報が設定されていません。FIREBASE_SETUP.md を読み、app.js の先頭で設定を行ってください。");
                selectGameMode.value = 'pve';
                gameMode = 'pve';
                aiGroup.classList.remove('hidden');
                colorGroup.classList.remove('hidden');
                return;
            }
            
            onlineRoomGroup.classList.remove('hidden');
            showOnlineView('init');
            resetGame();
        }
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

    btnModalRestart.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        if (gameMode === 'online') {
            alert("対戦を新しく始めるには「退出する」を押して、新しくルームを作成・参加してください。");
            return;
        }
        resetGame();
    });
    btnModalClose.addEventListener('click', () => {
        resultModal.classList.add('hidden');
    });
    btnHistoryClose.addEventListener('click', () => {
        historyModal.classList.add('hidden');
    });
    btnClearStats.addEventListener('click', clearStats);

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

    btnReplayPrev.addEventListener('click', () => replayStepTo(replayIndex - 1));
    btnReplayNext.addEventListener('click', () => replayStepTo(replayIndex + 1));
    btnReplayAuto.addEventListener('click', toggleReplayAuto);

    btnCreateRoom.addEventListener('click', createOnlineRoom);
    btnJoinRoom.addEventListener('click', () => {
        const rId = inputRoomId.value.trim().toUpperCase();
        if (rId.length !== 6) {
            alert("正しい6桁のルームIDを入力してください。");
            return;
        }
        joinOnlineRoom(rId);
    });
    btnCopyRoom.addEventListener('click', copyRoomIdToClipboard);
    btnCancelRoom.addEventListener('click', cleanUpOnlineRoom);
    btnLeaveRoom.addEventListener('click', cleanUpOnlineRoom);
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
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    turn = BLACK;
    gameActive = true;
    moveHistory = [];
    gameRecord = [];
    replayMode = false;
    replayIndex = -1;
    clearInterval(replayTimer);
    
    btnUndo.disabled = true;
    replayPanel.classList.add('hidden');
    
    gameMode = selectGameMode.value;
    aiDifficulty = selectAiDifficulty.value;
    playerColor = selectPlayerColor.value === 'black' ? BLACK : WHITE;

    if (gameMode === 'pvp') {
        nameBlackEl.textContent = 'プレイヤー1 (黒)';
        nameWhiteEl.textContent = 'プレイヤー2 (白)';
        resetTimers();
        startTimers();
    } else if (gameMode === 'pve') {
        if (playerColor === BLACK) {
            nameBlackEl.textContent = 'あなた (黒)';
            nameWhiteEl.textContent = 'AI (白)';
        } else {
            nameBlackEl.textContent = 'AI (黒)';
            nameWhiteEl.textContent = 'あなた (白)';
        }
        resetTimers();
        startTimers();
    } else if (gameMode === 'online') {
        if (myRole === BLACK) {
            nameBlackEl.textContent = 'あなた (黒)';
            nameWhiteEl.textContent = oppConnected ? '対戦相手 (白)' : '待機中... (白)';
        } else if (myRole === WHITE) {
            nameBlackEl.textContent = '対戦相手 (黒)';
            nameWhiteEl.textContent = 'あなた (白)';
        } else {
            nameBlackEl.textContent = 'プレイヤー1 (黒)';
            nameWhiteEl.textContent = 'プレイヤー2 (白)';
        }
        
        resetTimers();
        if (isOnlineActive) {
            startTimers();
        }
    }

    renderBoard();
    updateUI();
    
    // 先手AIの初手を打つ
    if (gameMode === 'pve' && playerColor === WHITE) {
        triggerAiMove();
    }
}

function cloneBoard(src) {
    return src.map(arr => [...arr]);
}

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
    const canPlay = gameActive && (!replayMode);
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            // 五目並べ盤の星（黒点）の位置: 3, 7, 11
            if ((r === 3 || r === 7 || r === 11) && (c === 3 || c === 7 || c === 11)) {
                cell.classList.add('marker');
            }
            
            const state = board[r][c];
            if (state !== EMPTY) {
                const wrapper = document.createElement('div');
                wrapper.className = 'disc-wrapper';
                
                const container = document.createElement('div');
                container.className = `disc-container ${state === WHITE ? 'white' : ''}`;
                
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
            
            // 空いているマスなら置くことが可能
            if (state === EMPTY && canPlay) {
                const isAiTurn = gameMode === 'pve' && turn !== playerColor;
                const isOnlineTurnLocked = gameMode === 'online' && (!isOnlineActive || turn !== myRole);
                
                if (!isAiTurn && !isOnlineTurnLocked) {
                    cell.classList.add('hint');
                    cell.classList.add(turn === BLACK ? 'player-black-turn' : 'player-white-turn');
                    cell.addEventListener('click', () => handleCellClick(r, c));
                }
            }

            boardEl.appendChild(cell);
        }
    }
}

function updateUI() {
    // 置かれている石の数をカウントしてスコアボードに表示
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) blackCount++;
            if (board[r][c] === WHITE) whiteCount++;
        }
    }
    
    scoreBlackEl.textContent = blackCount;
    scoreWhiteEl.textContent = whiteCount;
    
    if (turn === BLACK) {
        playerBlackCard.classList.add('active');
        playerWhiteCard.classList.remove('active');
        statusMessageEl.textContent = `${nameBlackEl.textContent}のターンです (黒)`;
    } else {
        playerBlackCard.classList.remove('active');
        playerWhiteCard.classList.add('active');
        statusMessageEl.textContent = `${nameWhiteEl.textContent}のターンです (白)`;
    }
    
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
    
    if (gameMode === 'pve' && turn !== playerColor) return;
    
    if (gameMode === 'online') {
        if (!isOnlineActive) {
            alert("対戦相手を待っています...");
            return;
        }
        if (turn !== myRole) return;
    }
    
    executeMove(row, col);
}

function executeMove(row, col, isFromOnlineSync = false) {
    if (!isFromOnlineSync) {
        saveHistory();
    }
    
    board[row][col] = turn;
    gameRecord.push({ r: row, c: col, t: turn });
    
    if (isFromOnlineSync) {
        synth.playPlaceSoundOnline();
    } else {
        synth.playPlaceSound();
    }
    
    renderBoard();
    updateUI();
    
    // 勝敗判定
    if (checkWin(board, row, col)) {
        setTimeout(() => {
            endGame(turn);
        }, 300);
        return;
    }
    
    // 引き分け判定（満杯）
    const emptyCells = board.flat().filter(cell => cell === EMPTY).length;
    if (emptyCells === 0) {
        setTimeout(() => {
            endGame(null);
        }, 300);
        return;
    }
    
    if (gameMode === 'online' && !isFromOnlineSync) {
        // オンライン対戦の場合、手番を交代してFirebaseへ送信
        setTimeout(() => {
            const nextTurnColor = turn === BLACK ? WHITE : BLACK;
            sendMoveToFirebase(row, col, nextTurnColor);
        }, 400);
    } else if (gameMode !== 'online') {
        // 通常の交代
        setTimeout(() => {
            advanceTurn();
        }, 300);
    }
}

function advanceTurn() {
    if (!gameActive) return;
    
    turn = turn === BLACK ? WHITE : BLACK;
    renderBoard();
    updateUI();
    
    if (gameMode === 'pve' && turn !== playerColor) {
        triggerAiMove();
    }
}

// --- 勝敗判定ロジック ---
function checkWin(boardState, row, col) {
    const color = boardState[row][col];
    if (color === EMPTY) return false;
    
    const directions = [
        [0, 1],   // 横
        [1, 0],   // 縦
        [1, 1],   // 斜め右下
        [1, -1]   // 斜め右上
    ];
    
    for (const [dr, dc] of directions) {
        let count = 1;
        
        // 正方向のスキャン
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && boardState[r][c] === color) {
            count++;
            r += dr;
            c += dc;
        }
        
        // 逆方向のスキャン
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && boardState[r][c] === color) {
            count++;
            r -= dr;
            c -= dc;
        }
        
        // 5つ以上並んでいれば勝利
        if (count >= 5) {
            return true;
        }
    }
    
    return false;
}

// --- Undo Logic ---
function undoMove() {
    if (moveHistory.length === 0 || replayMode) return;
    
    if (gameMode === 'pve' && moveHistory.length >= 2) {
        moveHistory.pop(); // AIの直前の状態
        gameRecord.pop();
        const prevState = moveHistory.pop(); // プレイヤーの直前の状態
        gameRecord.pop();
        restoreState(prevState);
    } else {
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
    const delay = 500 + Math.random() * 600; // organicな思考時間演出
    
    setTimeout(() => {
        if (!gameActive || turn === playerColor) return;
        
        let selectedMove = null;
        if (aiDifficulty === 'easy') {
            selectedMove = getEasyAiMove(board);
        } else if (aiDifficulty === 'medium') {
            selectedMove = getMediumAiMove(board, turn);
        } else {
            selectedMove = getHardAiMove(board, turn);
        }
        
        if (selectedMove) {
            executeMove(selectedMove[0], selectedMove[1]);
        }
    }, delay);
}

// 周囲2マス以内の空いている候補マスを抽出（全マス評価によるパフォーマンス低下防止）
function getCandidateMoves(boardState) {
    const candidates = [];
    const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
    let hasStones = false;
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (boardState[r][c] !== EMPTY) {
                hasStones = true;
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                            if (boardState[nr][nc] === EMPTY && !visited[nr][nc]) {
                                visited[nr][nc] = true;
                                candidates.push([nr, nc]);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 石がまだ置かれていない場合は天元（中央）を候補にする
    if (!hasStones) {
        const center = Math.floor(BOARD_SIZE / 2);
        candidates.push([center, center]);
    }
    
    return candidates;
}

// 簡単AI：候補からランダムに選択
function getEasyAiMove(boardState) {
    const candidates = getCandidateMoves(boardState);
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
}

// 普通AI：1手評価値の最も高い場所を選択
function getMediumAiMove(boardState, aiColor) {
    const candidates = getCandidateMoves(boardState);
    let bestMove = null;
    let bestScore = -Infinity;
    
    // ランダム要素を追加するためシャッフル
    candidates.sort(() => Math.random() - 0.5);
    
    for (const [r, c] of candidates) {
        const score = evaluateCell(boardState, r, c, aiColor);
        if (score > bestScore) {
            bestScore = score;
            bestMove = [r, c];
        }
    }
    
    return bestMove;
}

// 難しいAI：1手先読み（自分の一手の後、相手がとる最善手まで想定したミニマックス評価）
function getHardAiMove(boardState, aiColor) {
    const candidates = getCandidateMoves(boardState);
    const oppColor = aiColor === BLACK ? WHITE : BLACK;
    
    let bestMove = null;
    let bestScore = -Infinity;
    
    candidates.sort(() => Math.random() - 0.5);
    
    for (const [r, c] of candidates) {
        // シミュレーション: 自分が (r, c) に置く
        const nextBoard = cloneBoard(boardState);
        nextBoard[r][c] = aiColor;
        
        // 自分が置いた手で即勝利できるならそれを選ぶ
        if (checkWin(nextBoard, r, c)) {
            return [r, c];
        }
        
        // 相手の反応をシミュレート
        const oppCandidates = getCandidateMoves(nextBoard);
        let minOppScore = Infinity;
        
        for (const [or, oc] of oppCandidates) {
            const oppBoard = cloneBoard(nextBoard);
            oppBoard[or][oc] = oppColor;
            
            // 相手が即座に勝利できるマスなら、自分がそこに置くことでブロックすべき
            if (checkWin(oppBoard, or, oc)) {
                minOppScore = -1000000; // 極めて低いスコアにしてこの手を避ける / ブロック優先
                break;
            }
            
            // 自分にとっての評価値を算出（自分の手の価値 - 相手の手の価値）
            const myEvalScore = evaluateCell(oppBoard, r, c, aiColor) - evaluateCell(oppBoard, or, oc, oppColor) * 1.1;
            if (myEvalScore < minOppScore) {
                minOppScore = myEvalScore;
            }
        }
        
        // 相手が最善の対抗策（自分にとって最小評価値になる手）をとったときでも、
        // 自分の最終評価が最大になる手を選択
        if (minOppScore > bestScore) {
            bestScore = minOppScore;
            bestMove = [r, c];
        }
    }
    
    if (!bestMove && candidates.length > 0) {
        bestMove = candidates[0];
    }
    return bestMove;
}

// 特定のセルに石を置いたときのスコア評価（4方向ラインスキャン）
function evaluateCell(boardState, r, c, color) {
    const oppColor = color === BLACK ? WHITE : BLACK;
    let score = 0;
    
    const directions = [
        [0, 1],   // 横
        [1, 0],   // 縦
        [1, 1],   // 斜め右下
        [1, -1]   // 斜め右上
    ];
    
    for (const [dr, dc] of directions) {
        // 攻撃的な手（自分の石の並び）の評価
        score += evaluateLine(boardState, r, c, dr, dc, color);
        // 防御的な手（相手の石の並びを妨害）の評価、ブロックの重要性に応じて0.9倍
        score += evaluateLine(boardState, r, c, dr, dc, oppColor) * 0.9;
    }
    
    return score;
}

// 注目マスの前後5マスの計11マスのパターン評価
function evaluateLine(boardState, r, c, dr, dc, color) {
    const line = [];
    const oppColor = color === BLACK ? WHITE : BLACK;
    
    for (let i = -5; i <= 5; i++) {
        if (i === 0) {
            line.push(color);
        } else {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                line.push(boardState[nr][nc]);
            } else {
                line.push(oppColor); // 盤外は相手の石と同様（ブロック）
            }
        }
    }
    
    // スライド窓で評価
    // 注目点（インデックス5）を含む長さ5の窓は5個
    let maxPatternScore = 0;
    
    for (let start = 1; start <= 5; start++) {
        let count = 0;
        let emptyCount = 0;
        let hasOpp = false;
        
        for (let j = 0; j < 5; j++) {
            const val = line[start + j];
            if (val === color) {
                count++;
            } else if (val === EMPTY) {
                emptyCount++;
            } else {
                hasOpp = true;
                break;
            }
        }
        
        if (hasOpp) continue; // 相手の石があれば5連は不可能
        
        const leftEmpty = (line[start - 1] === EMPTY);
        const rightEmpty = (line[start + 5] === EMPTY);
        
        let windowScore = 0;
        if (count === 5) {
            windowScore = 100000; // 5連
        } else if (count === 4) {
            if (leftEmpty && rightEmpty) {
                windowScore = 20000; // 活4
            } else if (leftEmpty || rightEmpty) {
                windowScore = 4000;  // 棒4
            } else {
                windowScore = 400;   // 閉じ4
            }
        } else if (count === 3) {
            if (leftEmpty && rightEmpty) {
                windowScore = 3000;  // 活3
            } else if (leftEmpty || rightEmpty) {
                windowScore = 500;   // 棒3
            } else {
                windowScore = 50;
            }
        } else if (count === 2) {
            if (leftEmpty && rightEmpty) {
                windowScore = 300;   // 活2
            } else {
                windowScore = 30;
            }
        } else if (count === 1) {
            windowScore = 5;
        }
        
        maxPatternScore = Math.max(maxPatternScore, windowScore);
    }
    
    return maxPatternScore;
}

// --- End Game Handler ---
function endGame(winnerColor) {
    gameActive = false;
    clearInterval(timerInterval);
    
    // 石の総数を数える
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) blackCount++;
            if (board[r][c] === WHITE) whiteCount++;
        }
    }
    
    finalScoreBlackEl.textContent = blackCount;
    finalScoreWhiteEl.textContent = whiteCount;
    
    if (gameMode === 'pvp') {
        finalNameBlackEl.textContent = "黒 (P1)";
        finalNameWhiteEl.textContent = "白 (P2)";
        
        gameStats.pvp.total++;
        if (winnerColor === BLACK) {
            winnerTextEl.textContent = "プレイヤー1 (黒) の勝ち！";
            gameStats.pvp.blackWins++;
            synth.playWinSound();
        } else if (winnerColor === WHITE) {
            winnerTextEl.textContent = "プレイヤー2 (白) の勝ち！";
            gameStats.pvp.whiteWins++;
            synth.playWinSound();
        } else {
            winnerTextEl.textContent = "引き分け！";
            gameStats.pvp.draws++;
            synth.playDrawSound();
        }
    } else if (gameMode === 'pve') {
        finalNameBlackEl.textContent = playerColor === BLACK ? "あなた (黒)" : "AI (黒)";
        finalNameWhiteEl.textContent = playerColor === WHITE ? "あなた (白)" : "AI (白)";
        
        gameStats.pve.total++;
        if (winnerColor === playerColor) {
            winnerTextEl.textContent = "あなたの勝利！";
            gameStats.pve.playerWins++;
            synth.playWinSound();
        } else if (winnerColor !== null) {
            winnerTextEl.textContent = "AI (コンピュータ) の勝利！";
            gameStats.pve.aiWins++;
            synth.playLoseSound();
        } else {
            winnerTextEl.textContent = "引き分け！";
            gameStats.pve.draws++;
            synth.playDrawSound();
        }
    } else if (gameMode === 'online') {
        finalNameBlackEl.textContent = myRole === BLACK ? "あなた (黒)" : "対戦相手 (黒)";
        finalNameWhiteEl.textContent = myRole === WHITE ? "あなた (白)" : "対戦相手 (白)";
        
        gameStats.online.total++;
        if (winnerColor === myRole) {
            winnerTextEl.textContent = "あなたの勝利！";
            gameStats.online.wins++;
            synth.playWinSound();
        } else if (winnerColor !== null) {
            winnerTextEl.textContent = "対戦相手の勝利！";
            gameStats.online.losses++;
            synth.playLoseSound();
        } else {
            winnerTextEl.textContent = "引き分け！";
            gameStats.online.draws++;
            synth.playDrawSound();
        }
    }
    
    saveStats();
    
    // 終了理由
    if (winnerColor !== null) {
        gameEndReasonEl.textContent = `${winnerColor === BLACK ? '黒' : '白'}が5つ連続で石を並べました。`;
    } else {
        gameEndReasonEl.textContent = "盤面がすべて埋まりました（引き分け）。";
    }
    
    replayMode = false;
    btnUndo.disabled = true;
    
    setTimeout(() => {
        resultModal.classList.remove('hidden');
        statusMessageEl.textContent = "ゲーム終了。棋譜レビューが可能です。";
        setupReplayPanel();
    }, 1000);
}

// --- Replay Review Mode Logic ---
function setupReplayPanel() {
    replayMode = true;
    replayIndex = gameRecord.length;
    replayPanel.classList.remove('hidden');
    updateReplayUI();
}

function updateReplayUI() {
    replayStepsEl.textContent = `${replayIndex} / ${gameRecord.length}`;
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

function reconstructBoardAtStep(stepCount) {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    
    for (let i = 0; i < stepCount; i++) {
        const move = gameRecord[i];
        board[move.r][move.c] = move.t;
    }
    
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) blackCount++;
            if (board[r][c] === WHITE) whiteCount++;
        }
    }
    scoreBlackEl.textContent = blackCount;
    scoreWhiteEl.textContent = whiteCount;
    
    if (stepCount < gameRecord.length) {
        turn = gameRecord[stepCount].t;
    } else {
        turn = gameRecord[gameRecord.length - 1].t === BLACK ? WHITE : BLACK;
    }
    
    renderBoard();
    
    // 直前の手をハイライト
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
        clearInterval(replayTimer);
        replayTimer = null;
        setReplayPlayIconState(false);
    } else {
        if (replayIndex >= gameRecord.length) {
            replayIndex = 0;
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
        playNextReplayFrame();
    }, 800);
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

// --- Online Multiplayer Utility Functions ---

function initFirebase() {
    if (database) return true;
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
        return false;
    }
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        return true;
    } catch (e) {
        console.error("Firebase Initialization Failed", e);
        return false;
    }
}

function showOnlineView(viewType) {
    onlineInitView.classList.add('hidden');
    onlineWaitingView.classList.add('hidden');
    onlineActiveView.classList.add('hidden');
    
    if (viewType === 'init') {
        onlineInitView.classList.remove('hidden');
    } else if (viewType === 'waiting') {
        onlineWaitingView.classList.remove('hidden');
    } else if (viewType === 'active') {
        onlineActiveView.classList.remove('hidden');
    }
}

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function createOnlineRoom() {
    if (!initFirebase()) return;
    
    roomId = generateRoomId();
    myRole = BLACK;
    playerColor = BLACK;
    oppConnected = false;
    isOnlineActive = false;
    
    displayRoomId.textContent = roomId;
    showOnlineView('waiting');
    
    const initialBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    roomRef = database.ref(`rooms/${roomId}`);
    
    roomRef.set({
        state: 'waiting',
        board: initialBoard,
        turn: BLACK,
        blackActive: true,
        whiteActive: false,
        lastMove: null
    }).then(() => {
        roomRef.onDisconnect().remove();
        listenToRoomChanges();
    }).catch(err => {
        alert("部屋の作成に失敗しました。");
        cleanUpOnlineRoom();
    });
}

function joinOnlineRoom(targetRoomId) {
    if (!initFirebase()) return;
    
    roomId = targetRoomId;
    myRole = WHITE;
    playerColor = WHITE;
    
    database.ref(`rooms/${roomId}`).once('value').then(snapshot => {
        const data = snapshot.val();
        if (!data) {
            alert("指定されたルームIDが存在しません。");
            return;
        }
        if (data.whiteActive) {
            alert("この部屋は既に満員です。");
            return;
        }
        
        roomRef = database.ref(`rooms/${roomId}`);
        
        roomRef.update({
            whiteActive: true,
            state: 'playing'
        }).then(() => {
            roomRef.child('whiteActive').onDisconnect().set(false);
            isOnlineActive = true;
            oppConnected = true;
            showOnlineView('active');
            listenToRoomChanges();
        });
    }).catch(err => {
        alert("入室に失敗しました。");
    });
}

function listenToRoomChanges() {
    if (!roomRef) return;
    
    roomRef.on('value', snapshot => {
        const data = snapshot.val();
        if (!data) {
            if (isOnlineActive && gameActive) {
                handleOpponentLeave("対戦相手が退出、または切断されました。");
            }
            return;
        }
        
        if (data.state === 'closed') {
            handleOpponentLeave("対戦相手がゲームを退出しました。");
            return;
        }
        
        if (myRole === BLACK && !isOnlineActive) {
            if (data.whiteActive) {
                isOnlineActive = true;
                oppConnected = true;
                showOnlineView('active');
                
                roomRef.onDisconnect().update({ state: 'closed' });
                resetGame();
            }
        }
        
        if (isOnlineActive) {
            const incomingBoard = data.board;
            const incomingTurn = data.turn;
            
            if (incomingTurn === EMPTY && gameActive) {
                // 対戦相手が勝敗を決めたときの処理
                board = incomingBoard;
                renderBoard();
                
                if (data.lastMove) {
                    const lastMoveR = data.lastMove.r;
                    const lastMoveC = data.lastMove.c;
                    const lastMoveT = myRole === BLACK ? WHITE : BLACK;
                    
                    if (checkWin(board, lastMoveR, lastMoveC)) {
                        endGame(lastMoveT);
                    } else {
                        endGame(null); // 引き分け
                    }
                } else {
                    endGame(null);
                }
                return;
            }
            
            if (incomingTurn !== turn) {
                if (data.lastMove && data.lastMove.t !== (myRole === BLACK ? 'black' : 'white')) {
                    board = data.board;
                    turn = incomingTurn;
                    
                    const oppColor = myRole === BLACK ? WHITE : BLACK;
                    gameRecord.push({ r: data.lastMove.r, c: data.lastMove.c, t: oppColor });
                    
                    synth.playPlaceSoundOnline();
                    renderBoard();
                    updateUI();
                    
                    // 相手の打点によって自分が負けた（相手が勝った）かチェック
                    if (checkWin(board, data.lastMove.r, data.lastMove.c)) {
                        setTimeout(() => {
                            endGame(oppColor);
                            // Firebaseに終局（turn = EMPTY）を通知
                            roomRef.update({ turn: EMPTY });
                        }, 300);
                    }
                    
                    // 引き分けチェック
                    const emptyCells = board.flat().filter(cell => cell === EMPTY).length;
                    if (emptyCells === 0) {
                        setTimeout(() => {
                            endGame(null);
                            roomRef.update({ turn: EMPTY });
                        }, 300);
                    }
                } else {
                    board = incomingBoard;
                    turn = incomingTurn;
                    renderBoard();
                    updateUI();
                }
            }
        }
    });
}

function sendMoveToFirebase(row, col, nextTurn) {
    if (!roomRef) return;
    
    // もし自分が打った手で勝利したなら、turnをEMPTYにしてゲームオーバーを伝える
    let finalNextTurn = nextTurn;
    if (checkWin(board, row, col)) {
        finalNextTurn = EMPTY;
    } else {
        const emptyCells = board.flat().filter(cell => cell === EMPTY).length;
        if (emptyCells === 0) {
            finalNextTurn = EMPTY;
        }
    }
    
    roomRef.update({
        board: board,
        turn: finalNextTurn,
        lastMove: {
            r: row,
            c: col,
            t: myRole === BLACK ? 'black' : 'white'
        }
    });
}

function cleanUpOnlineRoom() {
    if (roomRef) {
        if (myRole === BLACK) {
            roomRef.remove();
        } else {
            roomRef.update({
                whiteActive: false,
                state: 'closed'
            });
        }
        roomRef.off();
    }
    cleanUpOnlineState();
}

function cleanUpOnlineState() {
    roomRef = null;
    roomId = null;
    myRole = null;
    isOnlineActive = false;
    oppConnected = false;
    
    if (gameMode === 'online') {
        showOnlineView('init');
        resetGame();
    }
}

function handleOpponentLeave(message) {
    alert(message);
    if (roomRef) {
        roomRef.off();
    }
    cleanUpOnlineState();
}

function copyRoomIdToClipboard() {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
        alert("ルームIDをクリップボードにコピーしました！対戦相手に送ってください。");
    }).catch(err => {
        console.error("Failed to copy", err);
    });
}
