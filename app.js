/**
 * Basketball Stats Tracker - Application Logic
 */

// Keys for localStorage
const SETTINGS_KEY = 'bball_teams';
const GAME_STATE_KEY = 'bball_gameState';

// Base initial state structure
const state = {
    timer: {
        minutes: 6, // will be overridden by settings
        seconds: 0,
        isRunning: false,
        intervalId: null,
        quarter: 1, // 1,2,3,4, or 'OT1', 'OT2'...
        otPeriod: 0 // tracks OT number
    },
    teams: {
        A: { name: "Team A", score: 0, timeouts: 1, players: [], quarterFouls: 0 },
        B: { name: "Team B", score: 0, timeouts: 1, players: [], quarterFouls: 0 }
    },
    selectedPlayerId: null,
    selectedShotType: null,
    playLog: [],
    gameSettings: {
        quarterLength: 6 // 6 minutes by default
    }
};

// Default players if no settings exist
const defaultPlayers = {
    A: [
        { id: "a4", number: 4, name: "Player 4" },
        { id: "a5", number: 5, name: "Player 5" },
        { id: "a6", number: 6, name: "Player 6" },
        { id: "a7", number: 7, name: "Player 7" },
        { id: "a8", number: 8, name: "Player 8" }
    ],
    B: [
        { id: "b4", number: 4, name: "Player 4" },
        { id: "b5", number: 5, name: "Player 5" },
        { id: "b6", number: 6, name: "Player 6" },
        { id: "b7", number: 7, name: "Player 7" },
        { id: "b8", number: 8, name: "Player 8" }
    ]
};

function createEmptyStats() {
    return {
        MIN: 0, // Playing time in seconds
        PTS: 0, FGM: 0, FGA: 0, PM3: 0, PA3: 0, 
        FTM: 0, FTA: 0, OREB: 0, DREB: 0, 
        AST: 0, STL: 0, BLK: 0, TOV: 0, PF: 0
    };
}

// Helper: Find player by ID across both teams
function getPlayerById(id) {
    if (!id) return null;
    const teamKey = id.charAt(0).toUpperCase(); // 'A' or 'B'
    return state.teams[teamKey].players.find(p => p.id === id);
}

// Helper: Get Team Key ('A' or 'B') from player ID
function getTeamKeyFromPlayerId(id) {
    if(!id) return null;
    return id.charAt(0).toUpperCase();
}


// ---// DOM Elements
const els = {
    timerDisplay: document.getElementById('timer-display'),
    btnTimerMinusMin: document.getElementById('btn-timer-minus-min'),
    btnTimerMinus10Sec: document.getElementById('btn-timer-minus-10sec'),
    btnTimerMinusSec: document.getElementById('btn-timer-minus-sec'),
    btnTimerPlusSec: document.getElementById('btn-timer-plus-sec'),
    btnTimerPlus10Sec: document.getElementById('btn-timer-plus-10sec'),
    btnTimerPlusMin: document.getElementById('btn-timer-plus-min'),
    currentQuarter: document.getElementById('current-quarter'),
    scoreA: document.getElementById('score-a'),
    scoreB: document.getElementById('score-b'),
    teamFoulA: document.getElementById('team-foul-a'),
    teamFoulB: document.getElementById('team-foul-b'),
    timeoutA: document.getElementById('timeout-count-a'),
    timeoutB: document.getElementById('timeout-count-b'),
    btnTimeoutA: document.getElementById('btn-timeout-a'),
    btnTimeoutB: document.getElementById('btn-timeout-b'),
    gridA: document.getElementById('player-grid-a'),
    gridB: document.getElementById('player-grid-b'),
    shotButtons: document.querySelectorAll('.shot-btn'),
    outcomeButtons: document.querySelectorAll('.outcome-btn'),
    actionButtons: document.querySelectorAll('.btn-action[data-action]'),
    playLogList: document.getElementById('play-log-list'),
    btnCancelAction: document.getElementById('btn-cancel-action'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnSettings: document.getElementById('btn-settings'),
    btnEndMatch: document.getElementById('btn-end-match'),
    quarterModal: document.getElementById('quarter-sub-modal'),
    quarterListA: document.getElementById('quarter-list-a'),
    quarterListB: document.getElementById('quarter-list-b'),
    btnConfirmQuarter: document.getElementById('btn-confirm-quarter')
};

// --- INITIALIZATION ---
function init() {
    loadSettingsData(); // Note: inside this it will call loadGameState() which restores or resets time.
    renderPlayers('A');
    renderPlayers('B');
    updateScoreBoard();
    updateTeamNames();
    updateTimerDisplay();
    renderPlayLog(); // Initial render of play log
    setupEventListeners();

    if (state.playLog.length === 0) {
        openQuarterModal(true);
    }
}

function loadSettingsData() {
    // 1. Load the settings/names
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    let settingsData = null;
    
    if (savedSettings) {
        try {
            settingsData = JSON.parse(savedSettings);
        } catch(e) {
            console.error("Failed to parse settings", e);
        }
    }
    
    if (settingsData && settingsData.gameSettings) {
        state.gameSettings.quarterLength = settingsData.gameSettings.quarterLength;
    }

    // Initialize state with default or settings players, giving them empty stats
    ['A', 'B'].forEach(teamKey => {
        if (settingsData && settingsData.teams && settingsData.teams[teamKey]) {
            state.teams[teamKey].name = settingsData.teams[teamKey].name;
            state.teams[teamKey].players = settingsData.teams[teamKey].players.map((p, idx) => ({
                ...p,
                isOnCourt: idx < 5, // Top 5 start on court by default
                stats: createEmptyStats()
            }));
        } else {
            // Fallback to defaults
            state.teams[teamKey].players = defaultPlayers[teamKey].map((p, idx) => ({
                ...p,
                isOnCourt: idx < 5,
                stats: createEmptyStats()
            }));
        }
    });

    // 2. Load the actual in-progress game state if it exists
    loadGameState();
}

function loadGameState() {
    const savedState = localStorage.getItem(GAME_STATE_KEY);
    if (!savedState) {
        resetTimeForQuarter();
        return;
    }

    try {
        const parsedState = JSON.parse(savedState);
        
        // Restore timer and primitive stats
        state.timer.minutes = parsedState.timer.minutes;
        state.timer.seconds = parsedState.timer.seconds;
        state.timer.quarter = parsedState.timer.quarter;
        state.timer.otPeriod = parsedState.timer.otPeriod || 0;
        state.playLog = parsedState.playLog || [];
        
        ['A', 'B'].forEach(teamKey => {
            if (parsedState.teams && parsedState.teams[teamKey]) {
                state.teams[teamKey].score = parsedState.teams[teamKey].score;
                state.teams[teamKey].timeouts = parsedState.teams[teamKey].timeouts;
                state.teams[teamKey].quarterFouls = parsedState.teams[teamKey].quarterFouls || 0;
                
                // Merge player states (stats and court status) based on matching IDs
                // If a player ID exists in the game state, we take their stats.
                state.teams[teamKey].players.forEach(currentPlayer => {
                    const savedPlayer = parsedState.teams[teamKey].players.find(p => p.id === currentPlayer.id);
                    if (savedPlayer) {
                        currentPlayer.stats = { ...savedPlayer.stats };
                        currentPlayer.isOnCourt = savedPlayer.isOnCourt;
                    } else {
                        // Subbed out by default if newly added and not in state
                        currentPlayer.isOnCourt = false;
                    }
                });
            }
        });
    } catch(e) {
        console.error("Failed to parse saved game state, starting fresh", e);
        resetTimeForQuarter();
    }
}

function saveGameState() {
    // We only need to save the mutable game parts (timer, scores, playLog, and stats/court status)
    // We don't save player names because they are loaded from settings
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
        timer: {
            minutes: state.timer.minutes,
            seconds: state.timer.seconds,
            quarter: state.timer.quarter,
            otPeriod: state.timer.otPeriod
        },
        teams: {
            A: {
                score: state.teams.A.score,
                timeouts: state.teams.A.timeouts,
                quarterFouls: state.teams.A.quarterFouls,
                players: state.teams.A.players.map(p => ({ id: p.id, stats: p.stats, isOnCourt: p.isOnCourt }))
            },
            B: {
                score: state.teams.B.score,
                timeouts: state.teams.B.timeouts,
                quarterFouls: state.teams.B.quarterFouls,
                players: state.teams.B.players.map(p => ({ id: p.id, stats: p.stats, isOnCourt: p.isOnCourt }))
            }
        },
        playLog: state.playLog
    }));
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- RENDER FUNCTIONS ---

function renderPlayers(teamKey) {
    const grid = teamKey === 'A' ? els.gridA : els.gridB;
    const players = state.teams[teamKey].players.filter(p => p.isOnCourt);
    
    grid.innerHTML = '';
    
    players.forEach(player => {
        const btn = document.createElement('button');
        let classes = ['player-btn'];
        if (state.selectedPlayerId === player.id) classes.push('active');
        if (player.stats.PF >= 5) classes.push('foul-danger');
        else if (player.stats.PF === 4) classes.push('foul-warning');
        
        btn.className = classes.join(' ');
        btn.dataset.playerId = player.id;
        
        btn.innerHTML = `
            <span class="player-number">#${player.number}</span>
            <span class="player-name">${player.name || ''}</span>
            <span class="player-stats">${player.stats.PTS}pts / ${player.stats.PF}f</span>
            <span class="player-time">${formatTime(player.stats.MIN)}</span>
        `;
        
        btn.addEventListener('click', () => handlePlayerSelect(player.id));
        grid.appendChild(btn);
    });
}

function updateScoreBoard() {
    els.scoreA.textContent = state.teams.A.score;
    els.scoreB.textContent = state.teams.B.score;
    els.timeoutA.textContent = state.teams.A.timeouts;
    els.timeoutB.textContent = state.teams.B.timeouts;
    
    // Team Fouls Update
    ['A', 'B'].forEach(key => {
        const fouls = state.teams[key].quarterFouls;
        const el = (key === 'A') ? els.teamFoulA : els.teamFoulB;
        if (el) {
            el.textContent = `チームファウル: ${fouls}/5回`;
            el.className = 'team-foul ' + (fouls >= 5 ? 'foul-danger' : (fouls === 4 ? 'foul-warning' : ''));
        }
    });
    
    // Display Q or OT
    if (state.timer.otPeriod > 0) {
        els.currentQuarter.textContent = `OT${state.timer.otPeriod}`;
    } else {
        els.currentQuarter.textContent = `${state.timer.quarter}Q`;
    }
}

function updateTeamNames() {
    document.getElementById('team-name-a').textContent = state.teams.A.name;
    document.getElementById('team-name-b').textContent = state.teams.B.name;
}

function renderPlayLog() {
    els.playLogList.innerHTML = '';
    
    // Most recent at bottom OR top? Usually scrolling systems put newest at bottom or top.
    // Let's put newest at the top for easy reading without scrolling.
    const reversedLog = [...state.playLog].reverse();
    
    if (reversedLog.length === 0) {
        els.playLogList.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding-top:10px;">記録がありません</div>';
        return;
    }

    reversedLog.forEach((logItem, displayIndex) => {
        // The display logic needs the *original* index before reversing
        // so we can delete the correct item from the array later
        const originalIndex = state.playLog.length - 1 - displayIndex;
        
        const row = document.createElement('div');
        row.className = 'play-log-item';
        
        const isTeamA = logItem.teamKey === 'A';
        const qtrLabel = String(logItem.quarter).startsWith('OT') ? logItem.quarter : `${logItem.quarter}Q`;
        
        const contentHTML = `
            <button class="btn-log-undo" title="この記録を消す">✕</button>
            <span class="log-text" style="text-align: ${isTeamA ? 'right' : 'left'}; margin: 0 5px;">${logItem.description}</span>
        `;
        
        row.innerHTML = `
            <div class="log-side log-side-a">
                ${isTeamA ? contentHTML : ''}
            </div>
            <div class="log-time">${qtrLabel} ${logItem.time}</div>
            <div class="log-side log-side-b" style="${!isTeamA ? 'flex-direction: row-reverse;' : ''}">
                ${!isTeamA ? contentHTML : ''}
            </div>
        `;
        
        // Find the correct button depending on the team since the other is empty
        const undoBtn = row.querySelector('.btn-log-undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (confirm(`この記録を削除しますか？\n「${logItem.description}」`)) {
                    deletePlayEvent(originalIndex);
                }
            });
        }
        
        els.playLogList.appendChild(row);
    });
}

function updateRecentPlay(text) {
    // We no longer just update text, we re-render the whole list
    renderPlayLog();
}

function updateTimerDisplay() {
    const min = String(state.timer.minutes).padStart(2, '0');
    const sec = String(state.timer.seconds).padStart(2, '0');
    els.timerDisplay.textContent = `${min}:${sec}`;
    
    if (state.timer.isRunning) {
        els.timerDisplay.classList.add('running');
    } else {
        els.timerDisplay.classList.remove('running');
    }
}

// --- TIMER LOGIC ---

function toggleTimer() {
    if (state.timer.isRunning) {
        clearInterval(state.timer.intervalId);
        state.timer.isRunning = false;
        saveGameState(); // Save when paused
    } else {
        if (state.timer.minutes === 0 && state.timer.seconds === 0) return;
        state.timer.isRunning = true;
        state.timer.intervalId = setInterval(tickTimer, 1000);
    }
    updateTimerDisplay();
}

function tickTimer() {
    if (state.timer.seconds === 0) {
        if (state.timer.minutes === 0) {
            // End of quarter
            toggleTimer();
            const qtrName = state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : `${state.timer.quarter}Q`;
            
            // Record quarter end
            state.playLog.push({
                timestamp: new Date().toISOString(),
                quarter: state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : state.timer.quarter,
                time: "00:00",
                teamKey: 'TEAM',
                playerId: 'TEAM',
                playerNumber: '-',
                playerName: '-',
                actionType: 'quarter_end',
                description: `${qtrName} 終了`,
                previousState: { teamScore: 0, timeouts: 0, isOnCourt: false }
            });
            renderPlayLog();
            saveGameState();
            alert(`${qtrName} 終了`);
            return;
        }
        state.timer.minutes--;
        state.timer.seconds = 59;
    } else {
        state.timer.seconds--;
    }
    
    // Add playing time to players on court
    ['A', 'B'].forEach(teamKey => {
        state.teams[teamKey].players.forEach(p => {
            if (p.isOnCourt) {
                p.stats.MIN += 1;
            }
        });
    });

    renderPlayers('A');
    renderPlayers('B');
    updateTimerDisplay();
}

function adjustTimer(secondsChange) {
    // Only adjust when paused
    if (state.timer.isRunning) return;
    
    let totalSeconds = state.timer.minutes * 60 + state.timer.seconds;
    totalSeconds += secondsChange;
    
    if (totalSeconds < 0) {
        totalSeconds = 0;
    }
    
    const maxSeconds = state.gameSettings.quarterLength * 60;
    if (totalSeconds > maxSeconds) { 
        totalSeconds = maxSeconds;
    }
    
    state.timer.minutes = Math.floor(totalSeconds / 60);
    state.timer.seconds = totalSeconds % 60;
    
    updateTimerDisplay();
    saveGameState();
}

function resetTimeForQuarter() {
    state.timer.minutes = state.gameSettings.quarterLength;
    state.timer.seconds = 0;
    
    // Per minibasketball (or FIBA logic often mapped locally), 1 timeout per quarter.
    state.teams.A.timeouts = 1;
    state.teams.B.timeouts = 1;
    state.teams.A.quarterFouls = 0;
    state.teams.B.quarterFouls = 0;
    saveGameState();
}

// --- SUBSTITUTION LOGIC (MODAL) ---

let subModalState = {
    teamKey: null,
    selectedOutIds: [],
    selectedInIds: []
};

function openSubModal(teamKey) {
    if (state.timer.isRunning) {
        alert("時計が動いている最中は交代できません。タイマーを止めてください。");
        return;
    }

    subModalState.teamKey = teamKey;
    subModalState.selectedOutIds = [];
    subModalState.selectedInIds = [];

    document.getElementById('sub-modal-title').textContent = `メンバーチェンジ (チーム${teamKey})`;
    renderSubModalLists();
    document.getElementById('sub-modal').style.display = 'flex';
}

function closeSubModal() {
    document.getElementById('sub-modal').style.display = 'none';
}

function renderSubModalLists() {
    const listCourt = document.getElementById('sub-list-court');
    const listBench = document.getElementById('sub-list-bench');
    listCourt.innerHTML = '';
    listBench.innerHTML = '';

    const players = state.teams[subModalState.teamKey].players;

    players.forEach(p => {
        const btn = document.createElement('button');
        const foulText = p.stats.PF > 0 ? ` (${p.stats.PF}f)` : '';
        btn.innerHTML = `<span style="font-weight:bold; width:30px; display:inline-block">#${p.number}</span> ${p.name || ''}${foulText}`;
        
        let classes = ['btn', 'sub-btn'];
        if (p.stats.PF >= 5) classes.push('foul-danger');
        else if (p.stats.PF === 4) classes.push('foul-warning');
        
        if (p.isOnCourt) {
            if (subModalState.selectedOutIds.includes(p.id)) classes.push('selected');
            else classes.push('btn-outline');
            btn.className = classes.join(' ');
            btn.onclick = () => {
                const idx = subModalState.selectedOutIds.indexOf(p.id);
                if (idx > -1) subModalState.selectedOutIds.splice(idx, 1);
                else subModalState.selectedOutIds.push(p.id);
                renderSubModalLists();
            };
            listCourt.appendChild(btn);
        } else {
            if (subModalState.selectedInIds.includes(p.id)) classes.push('selected');
            else classes.push('btn-outline');
            btn.className = classes.join(' ');
            btn.onclick = () => {
                const idx = subModalState.selectedInIds.indexOf(p.id);
                if (idx > -1) subModalState.selectedInIds.splice(idx, 1);
                else subModalState.selectedInIds.push(p.id);
                renderSubModalLists();
            };
            listBench.appendChild(btn);
        }
    });

    const btnConfirm = document.getElementById('btn-confirm-sub');
    if (subModalState.selectedOutIds.length > 0 && subModalState.selectedOutIds.length === subModalState.selectedInIds.length) {
        btnConfirm.disabled = false;
        btnConfirm.onclick = confirmSubstitution;
    } else {
        btnConfirm.disabled = true;
        btnConfirm.onclick = null;
    }
}

function confirmSubstitution() {
    const outs = subModalState.selectedOutIds.map(getPlayerById);
    const ins = subModalState.selectedInIds.map(getPlayerById);

    if (outs.length > 0 && outs.length === ins.length) {
        outs.forEach(p => p.isOnCourt = false);
        ins.forEach(p => p.isOnCourt = true);
        
        // Deselect if active in main UI
        if (state.selectedPlayerId && subModalState.selectedOutIds.includes(state.selectedPlayerId)) {
            state.selectedPlayerId = null;
            state.selectedShotType = null;
            renderShotSelection();
        }

        const teamScore = state.teams[subModalState.teamKey].score;
        const qtrLabel = state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : state.timer.quarter;

        outs.forEach((pOut, idx) => {
            const pIn = ins[idx];

            // 1. Log Out
            state.playLog.push({
                timestamp: new Date().toISOString(),
                quarter: qtrLabel,
                time: els.timerDisplay.textContent,
                teamKey: subModalState.teamKey,
                playerId: pOut.id,
                playerNumber: pOut.number,
                playerName: pOut.name,
                actionType: 'sub_out',
                description: `${pOut.number}番 ${pOut.name || ''} 退場`,
                previousState: { playerStats: { ...pOut.stats }, teamScore: teamScore, isOnCourt: true }
            });

            // 2. Log In
            state.playLog.push({
                timestamp: new Date().toISOString(),
                quarter: qtrLabel,
                time: els.timerDisplay.textContent,
                teamKey: subModalState.teamKey,
                playerId: pIn.id,
                playerNumber: pIn.number,
                playerName: pIn.name,
                actionType: 'sub_in',
                description: `${pIn.number}番 ${pIn.name || ''} 出場`,
                previousState: { playerStats: { ...pIn.stats }, teamScore: teamScore, isOnCourt: false }
            });
            updateRecentPlay(`交代: #${pOut.number} OUT, #${pIn.number} IN`);
        });

        renderPlayers('A');
        renderPlayers('B');
        saveGameState();
    }
    closeSubModal();
}

// --- QUARTER MODAL LOGIC ---

let quarterModalState = {
    selectedIdsA: [],
    selectedIdsB: []
};

function openQuarterModal(isGameStart = false) {
    if (state.timer.isRunning) {
        alert("時計が動いている最中は操作できません。タイマーを止めてください。");
        return;
    }

    if (isGameStart) {
        quarterModalState.selectedIdsA = state.teams.A.players.slice(0, 5).map(p => p.id);
        quarterModalState.selectedIdsB = state.teams.B.players.slice(0, 5).map(p => p.id);
        document.getElementById('quarter-modal-title').textContent = "スターティングメンバーを選択 (各5名)";
    } else {
        // pre-select current players on court
        quarterModalState.selectedIdsA = state.teams.A.players.filter(p => p.isOnCourt).map(p => p.id);
        quarterModalState.selectedIdsB = state.teams.B.players.filter(p => p.isOnCourt).map(p => p.id);
        document.getElementById('quarter-modal-title').textContent = "次のクォーターの出場メンバーを選択 (各5名)";
    }

    els.btnConfirmQuarter.dataset.isGameStart = isGameStart;

    renderQuarterModalLists();
    els.quarterModal.style.display = 'flex';
}

function closeQuarterModal() {
    els.quarterModal.style.display = 'none';
}

function renderQuarterModalLists() {
    els.quarterListA.innerHTML = '';
    els.quarterListB.innerHTML = '';

    ['A', 'B'].forEach(teamKey => {
        const listEl = teamKey === 'A' ? els.quarterListA : els.quarterListB;
        const selectedIds = teamKey === 'A' ? quarterModalState.selectedIdsA : quarterModalState.selectedIdsB;
        
        state.teams[teamKey].players.forEach(p => {
            const btn = document.createElement('button');
            const foulText = p.stats.PF > 0 ? ` (${p.stats.PF}f)` : '';
            btn.innerHTML = `<span style="font-weight:bold; width:30px; display:inline-block">#${p.number}</span> ${p.name || ''}${foulText}`;
            
            let classes = ['btn', 'sub-btn'];
            if (p.stats.PF >= 5) classes.push('foul-danger');
            else if (p.stats.PF === 4) classes.push('foul-warning');
            
            if (selectedIds.includes(p.id)) {
                classes.push('selected');
            } else {
                classes.push('btn-outline');
            }
            btn.className = classes.join(' ');
            
            btn.onclick = () => {
                const idx = selectedIds.indexOf(p.id);
                if (idx > -1) {
                    selectedIds.splice(idx, 1);
                } else {
                    selectedIds.push(p.id);
                }
                renderQuarterModalLists();
            };
            
            listEl.appendChild(btn);
        });
    });

    if (quarterModalState.selectedIdsA.length === 5 && quarterModalState.selectedIdsB.length === 5) {
        els.btnConfirmQuarter.disabled = false;
        const isGameStart = els.btnConfirmQuarter.dataset.isGameStart === 'true';
        els.btnConfirmQuarter.textContent = isGameStart ? "試合を開始する" : "クォーターを開始する";
        els.btnConfirmQuarter.onclick = isGameStart ? startGameFromModal : startNextQuarter;
    } else {
        els.btnConfirmQuarter.disabled = true;
        els.btnConfirmQuarter.textContent = `A:${quarterModalState.selectedIdsA.length}名 / B:${quarterModalState.selectedIdsB.length}名 (各5名必須)`;
        els.btnConfirmQuarter.onclick = null;
    }
}

function startGameFromModal() {
    closeQuarterModal();

    // Apply courts
    state.teams.A.players.forEach(p => p.isOnCourt = quarterModalState.selectedIdsA.includes(p.id));
    state.teams.B.players.forEach(p => p.isOnCourt = quarterModalState.selectedIdsB.includes(p.id));

    state.selectedPlayerId = null;
    state.selectedShotType = null;
    renderShotSelection();

    // Log Game Start
    state.playLog.push({
        timestamp: new Date().toISOString(),
        quarter: "1Q",
        time: els.timerDisplay.textContent,
        teamKey: 'TEAM',
        playerId: 'TEAM',
        playerNumber: '-',
        playerName: '-',
        actionType: 'game_start',
        description: `1Q 開始 (スタメン選出)`,
        previousState: { teamScore: 0, timeouts: 0, isOnCourt: false }
    });

    renderPlayers('A');
    renderPlayers('B');
    renderPlayLog();
    saveGameState();
}

function startNextQuarter() {
    closeQuarterModal();

    if (state.timer.quarter < 4 && state.timer.otPeriod === 0) {
        state.timer.quarter++;
    } else {
        state.timer.quarter = 4;
        state.timer.otPeriod++;
    }

    // Apply courts
    state.teams.A.players.forEach(p => p.isOnCourt = quarterModalState.selectedIdsA.includes(p.id));
    state.teams.B.players.forEach(p => p.isOnCourt = quarterModalState.selectedIdsB.includes(p.id));

    state.selectedPlayerId = null;
    state.selectedShotType = null;
    renderShotSelection();

    // Log Quarter Start
    const qtrName = state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : `${state.timer.quarter}Q`;
    state.playLog.push({
        timestamp: new Date().toISOString(),
        quarter: state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : state.timer.quarter, // Logic matches others
        time: "00:00",
        teamKey: 'TEAM',
        playerId: 'TEAM',
        playerNumber: '-',
        playerName: '-',
        actionType: 'quarter_start',
        description: `${qtrName} 開始 (メンバー更新)`,
        previousState: { teamScore: 0, timeouts: 0, isOnCourt: false }
    });

    resetTimeForQuarter();
    updateTimerDisplay();
    updateScoreBoard();
    renderPlayers('A');
    renderPlayers('B');
    renderPlayLog();
    saveGameState();
}

// --- EVENT HANDLERS ---

function handlePlayerSelect(playerId) {
    if (state.selectedPlayerId === playerId) {
        // Deselect
        state.selectedPlayerId = null;
        state.selectedShotType = null; // Clear shot type if player deselected
    } else {
        state.selectedPlayerId = playerId;
    }
    renderPlayers('A');
    renderPlayers('B');
    renderShotSelection();
}

function handleShotSelect(shotType) {
    if (!state.selectedPlayerId) {
        alert("先に選手を選択してください。");
        return;
    }
    if (state.selectedShotType === shotType) {
        state.selectedShotType = null; // Toggle off
    } else {
        state.selectedShotType = shotType; // Select
    }
    renderShotSelection();
}

function handleOutcomeSelect(outcome) {
    if (!state.selectedPlayerId) {
        alert("先に選手を選択してください。");
        return;
    }
    if (!state.selectedShotType) {
        alert("シュートの種類（FT, 2P, 3P）を選択してください。");
        return;
    }
    
    const player = getPlayerById(state.selectedPlayerId);
    const teamKey = getTeamKeyFromPlayerId(state.selectedPlayerId);
    let pointsToAdd = 0;
    let actionDescription = "";
    
    const previousStats = { ...player.stats };
    const previousScore = state.teams[teamKey].score;
    
    const isSuccess = outcome === 'success';

    switch(state.selectedShotType) {
        case '2p':
            player.stats.FGA += 1;
            if (isSuccess) {
                player.stats.FGM += 1;
                player.stats.PTS += 2;
                pointsToAdd = 2;
                actionDescription = `${player.number}番 2P成功`;
            } else {
                actionDescription = `${player.number}番 2P失敗`;
            }
            break;
        case '3p':
            player.stats.FGA += 1;
            player.stats.PA3 += 1;
            if (isSuccess) {
                player.stats.PM3 += 1;
                player.stats.PTS += 3;
                pointsToAdd = 3;
                actionDescription = `${player.number}番 3P成功`;
            } else {
                actionDescription = `${player.number}番 3P失敗`;
            }
            break;
        case 'ft':
            player.stats.FTA += 1;
            if (isSuccess) {
                player.stats.FTM += 1;
                player.stats.PTS += 1;
                pointsToAdd = 1;
                actionDescription = `${player.number}番 FT成功`;
            } else {
                actionDescription = `${player.number}番 FT失敗`;
            }
            break;
    }

    if (pointsToAdd > 0) {
        state.teams[teamKey].score += pointsToAdd;
    }

    recordEventAndRefresh(player, teamKey, state.selectedShotType + (isSuccess ? '_make' : '_miss'), actionDescription, previousStats, previousScore);
}

function handleAction(actionType) {
    if (!state.selectedPlayerId) {
        alert("先に選手を選択してください。");
        return;
    }

    const player = getPlayerById(state.selectedPlayerId);
    const teamKey = getTeamKeyFromPlayerId(state.selectedPlayerId);
    let actionDescription = "";
    
    // We clone the current stats to save in playLog for easy Undo
    const previousStats = { ...player.stats };
    const previousScore = state.teams[teamKey].score;
    const previousTeamFouls = state.teams[teamKey].quarterFouls;

    switch(actionType) {
        case 'foul':
            player.stats.PF += 1;
            state.teams[teamKey].quarterFouls += 1;
            actionDescription = `${player.number}番 ファウル`;
            break;
        case 'oreb':
            player.stats.OREB += 1;
            actionDescription = `${player.number}番 OR`;
            break;
        case 'dreb':
            player.stats.DREB += 1;
            actionDescription = `${player.number}番 DR`;
            break;
        case 'ast':
            player.stats.AST += 1;
            actionDescription = `${player.number}番 アシスト`;
            break;
        case 'stl':
            player.stats.STL += 1;
            actionDescription = `${player.number}番 スティール`;
            break;
        case 'blk':
            player.stats.BLK += 1;
            actionDescription = `${player.number}番 ブロック`;
            break;
        case 'to':
            player.stats.TOV += 1;
            actionDescription = `${player.number}番 TO`;
            break;
        default:
            return;
    }

    recordEventAndRefresh(player, teamKey, actionType, actionDescription, previousStats, previousScore);
}

function recordEventAndRefresh(player, teamKey, actionTypeStr, actionDescription, previousStats, previousScore) {
    // Record Event
    const playEvent = {
        timestamp: new Date().toISOString(),
        quarter: state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : state.timer.quarter,
        time: els.timerDisplay.textContent,
        teamKey: teamKey,
        playerId: player.id,
        playerNumber: player.number,
        playerName: player.name,
        actionType: actionTypeStr,
        description: actionDescription,
        // State before mutation for easy Undo
        previousState: {
            playerStats: previousStats,
            teamScore: previousScore
        }
    };
    
    state.playLog.push(playEvent);
    
    const qtrLabel = state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : `${state.timer.quarter}Q`;
    updateRecentPlay(`[${qtrLabel}] ${els.timerDisplay.textContent} - ${actionDescription}`);

    // タイマーが停止中で、かつ残り時間が0ではない場合は自動スタートする
    if (!state.timer.isRunning && (state.timer.minutes > 0 || state.timer.seconds > 0)) {
        toggleTimer();
    }

    // Clean up
    state.selectedPlayerId = null; 
    state.selectedShotType = null;
    renderPlayers('A'); // re-render to clear selection & update points on button
    renderPlayers('B');
    renderShotSelection();
    updateScoreBoard();
    saveGameState();
}

function handleTimeout(teamKey) {
    if (state.teams[teamKey].timeouts > 0) {
        state.teams[teamKey].timeouts--;
        
        // Auto-pause timer
        if(state.timer.isRunning) {
            toggleTimer();
        }
        
        // Log event
        const playEvent = {
            timestamp: new Date().toISOString(),
            quarter: state.timer.otPeriod > 0 ? `OT${state.timer.otPeriod}` : state.timer.quarter,
            time: els.timerDisplay.textContent,
            teamKey: teamKey,
            playerId: 'TEAM',
            playerNumber: '-',
            playerName: '-',
            actionType: 'timeout',
            description: `チーム${teamKey} タイムアウト`,
            previousState: {
                teamScore: state.teams[teamKey].score,
                timeouts: state.teams[teamKey].timeouts + 1 
            }
        };
        state.playLog.push(playEvent);
        updateRecentPlay(playEvent.description);
        updateScoreBoard();
        saveGameState();
    }
}

function deletePlayEvent(index) {
    if (index < 0 || index >= state.playLog.length) return;
    
    const eventToUndo = state.playLog[index];
    
    // Apply the reverse of the event's effect to the current state
    undoEventByDelta(eventToUndo);
    
    // Remove the event from the log
    state.playLog.splice(index, 1);
    
    // Re-render UI
    updateScoreBoard();
    renderPlayers('A');
    renderPlayers('B');
    renderPlayLog();
    renderShotSelection(); // Ensure shot selection state is correct
    saveGameState();
}

function undoEventByDelta(event) {
    const player = getPlayerById(event.playerId);
    const team = state.teams[event.teamKey];

    switch (event.actionType) {
        case 'ft_make':
            if (player) { player.stats.PTS -= 1; player.stats.FTM -= 1; player.stats.FTA -= 1; }
            team.score -= 1;
            break;
        case 'ft_miss':
            if (player) { player.stats.FTA -= 1; }
            break;
        case '2p_make':
            if (player) { player.stats.PTS -= 2; player.stats.FGM -= 1; player.stats.FGA -= 1; }
            team.score -= 2;
            break;
        case '2p_miss':
            if (player) { player.stats.FGA -= 1; }
            break;
        case '3p_make':
            if (player) { player.stats.PTS -= 3; player.stats.PM3 -= 1; player.stats.PA3 -= 1; }
            team.score -= 3;
            break;
        case '3p_miss':
            if (player) { player.stats.PA3 -= 1; }
            break;
        case 'oreb':
            if (player) { player.stats.OREB -= 1; }
            break;
        case 'dreb':
            if (player) { player.stats.DREB -= 1; }
            break;
        case 'ast':
            if (player) { player.stats.AST -= 1; }
            break;
        case 'stl':
            if (player) { player.stats.STL -= 1; }
            break;
        case 'blk':
            if (player) { player.stats.BLK -= 1; }
            break;
        case 'to': // Note: actionType was 'tov' in the diff, but 'to' in handleAction
            if (player) { player.stats.TOV -= 1; }
            break;
        case 'foul': // Note: actionType was 'pf' in the diff, but 'foul' in handleAction
            if (player) { player.stats.PF -= 1; }
            team.quarterFouls = Math.max(0, team.quarterFouls - 1);
            break;
        case 'timeout':
            team.timeouts = event.previousState.timeouts; // Restore previous timeout count
            break;
        case 'sub_out':
            if (player) player.isOnCourt = event.previousState.isOnCourt; // Should be true
            break;
        case 'sub_in':
            if (player) player.isOnCourt = event.previousState.isOnCourt; // Should be false
            break;
    }
}

// Ensure renderShotSelection exists even if unused heavily
function renderShotSelection() {
    els.shotButtons.forEach(btn => {
        if (state.selectedShotType === btn.dataset.shot) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (state.selectedShotType) {
        els.outcomeButtons.forEach(btn => btn.disabled = false);
    } else {
        els.outcomeButtons.forEach(btn => btn.disabled = true);
    }
}

function exportCsv() {
    if(state.playLog.length === 0) {
         alert("エクスポートするデータがありません。");
         return;
    }

    let csvContent = "Timestamp,Quarter,Time,Team,PlayerNum,PlayerName,ActionType,Description\n";
    
    // Rows
    state.playLog.forEach(row => {
        const pNum = (row.playerId !== 'TEAM') ? `#${row.playerNumber}` : '-';
        const pName = row.playerName || '-';
        csvContent += `"${row.timestamp}","${row.quarter}","${row.time}","${row.teamKey}","${pNum}","${pName}","${row.actionType}","${row.description}"\n`;
    });

    // Create a Blob with UTF-8 BOM so Excel opens it correctly with Japanese characters
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // Add date to filename
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `bball_stats_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


// --- ATTACH LISTENERS ---
function setupEventListeners() {
    els.timerDisplay.addEventListener('click', toggleTimer);
    els.btnTimerMinusMin.addEventListener('click', () => adjustTimer(-60));
    els.btnTimerMinus10Sec.addEventListener('click', () => adjustTimer(-10));
    els.btnTimerMinusSec.addEventListener('click', () => adjustTimer(-1));
    els.btnTimerPlusSec.addEventListener('click', () => adjustTimer(1));
    els.btnTimerPlus10Sec.addEventListener('click', () => adjustTimer(10));
    els.btnTimerPlusMin.addEventListener('click', () => adjustTimer(60));
    
    // Quarter selector (Advance Quarter / OT)
    els.currentQuarter.parentElement.addEventListener('click', openQuarterModal);

    els.btnTimeoutA.addEventListener('click', () => handleTimeout('A'));
    els.btnTimeoutB.addEventListener('click', () => handleTimeout('B'));
    
    els.btnSettings.addEventListener('click', () => {
        saveGameState();
        window.location.href = 'index.html';
    });
    
    // Feature: End match and go to top screen
    els.btnEndMatch.addEventListener('click', () => {
        if(confirm("この試合のデータを終了してトップへ戻りますか？\n（後からトップページで「再開」することも可能です）")) {
            saveGameState();
            window.location.href = 'index.html';
        }
    });
    // Cancel selection button (clears UI selection state)
    els.btnCancelAction.addEventListener('click', () => {
        state.selectedPlayerId = null;
        state.selectedShotType = null;
        renderPlayers('A');
        renderPlayers('B');
        renderShotSelection();
    });

    els.btnExportCsv.addEventListener('click', exportCsv);
    
    // Global delegation for member change buttons isn't needed since
    // they are wired with onclick="openSubModal('A')" in HTML,
    // but ensured through those tags directly.
    
    els.shotButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('button');
            handleShotSelect(btnEl.dataset.shot);
        });
    });

    els.outcomeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('button');
            handleOutcomeSelect(btnEl.dataset.outcome);
        });
    });

    els.actionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('button');
            handleAction(btnEl.dataset.action);
        });
    });
}

// Boot
window.document.addEventListener('DOMContentLoaded', init);
