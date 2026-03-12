/**
 * Basketball Stats Tracker - Settings Logic
 */

// Keys for localStorage
const STORAGE_KEY = 'bball_teams';

// Default struct if no data exists
const defaultData = {
    teams: {
        A: {
            name: "Team A",
            players: [
                { id: "a4", number: 4, name: "Player 4" },
                { id: "a5", number: 5, name: "Player 5" },
                { id: "a6", number: 6, name: "Player 6" },
                { id: "a7", number: 7, name: "Player 7" },
                { id: "a8", number: 8, name: "Player 8" }
            ]
        },
        B: {
            name: "Team B",
            players: [
                { id: "b4", number: 4, name: "Player 4" },
                { id: "b5", number: 5, name: "Player 5" },
                { id: "b6", number: 6, name: "Player 6" },
                { id: "b7", number: 7, name: "Player 7" },
                { id: "b8", number: 8, name: "Player 8" }
            ]
        }
    },
    gameSettings: {
        quarterLength: 6 // default to 6 min for minibasketball as requested
    }
};

let settingsData = null;

const els = {
    container: document.getElementById('settings-form'),
    btnStartGame: document.getElementById('btn-start-game'),
    btnResumeGame: document.getElementById('btn-resume-game')
};

function init() {
    loadData();
    renderForm();
    checkExistingGame();
    setupEventListeners();
}

function checkExistingGame() {
    const gameState = localStorage.getItem('bball_gameState');
    if (gameState) {
        els.btnResumeGame.style.display = 'inline-block';
    } else {
        els.btnResumeGame.style.display = 'none';
    }
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            settingsData = JSON.parse(saved);
        } catch(e) {
            console.error("Error parsing saved data", e);
            settingsData = JSON.parse(JSON.stringify(defaultData));
        }
    } else {
        settingsData = JSON.parse(JSON.stringify(defaultData)); // Deep copy
    }
}

function renderForm() {
    // Keep the game settings section untouched when clearing container
    // els.container.innerHTML = ''; // This would wipe the game-settings HTML 
    
    // Actually, because game-settings is in the HTML, we just want to remove 
    // any existing `.team-settings` that ARE NOT the game settings.
    document.querySelectorAll('.team-settings:not(#game-settings-section)').forEach(node => node.remove());

    // Update the game settings dropdown to reflect loaded data
    const qLengthSelect = document.getElementById('quarter-length');
    if (qLengthSelect && settingsData.gameSettings) {
        qLengthSelect.value = settingsData.gameSettings.quarterLength || 6;
    }

    renderTeamSection('A', 'チームA');
    renderTeamSection('B', 'チームB');
}

function renderTeamSection(teamKey, defaultHeading) {
    const team = settingsData.teams[teamKey];
    
    const section = document.createElement('section');
    section.className = 'team-settings';
    
    // Heading
    const title = document.createElement('h3');
    title.textContent = `${defaultHeading} 設定`;
    section.appendChild(title);

    // Team Name Input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'input-group';
    nameGroup.innerHTML = `
        <label>チームネーム</label>
        <input type="text" id="team-name-${teamKey}" value="${team.name}" placeholder="チーム名">
    `;
    section.appendChild(nameGroup);

    // Players Label
    const playersLabel = document.createElement('div');
    playersLabel.className = 'input-group';
    playersLabel.innerHTML = `<label>選手リスト (背番号 / 名前)</label>`;
    section.appendChild(playersLabel);

    // Player Rows Container
    const rowsContainer = document.createElement('div');
    rowsContainer.id = `players-${teamKey}`;
    
    // Render existing players
    team.players.forEach((player, index) => {
        rowsContainer.appendChild(createPlayerRow(teamKey, player, index));
    });
    
    section.appendChild(rowsContainer);

    // Add Player Button
    const addWrapper = document.createElement('div');
    addWrapper.className = 'add-player-wrapper';
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn btn-outline';
    btnAdd.textContent = '+ 選手を追加';
    btnAdd.type = 'button';
    btnAdd.addEventListener('click', () => {
        const newIndex = rowsContainer.children.length;
        // Generate a pseudo id
        const newPlayer = { id: `${teamKey.toLowerCase()}${Date.now()}`, number: "", name: "" };
        rowsContainer.appendChild(createPlayerRow(teamKey, newPlayer, newIndex));
    });
    addWrapper.appendChild(btnAdd);
    section.appendChild(addWrapper);

    els.container.appendChild(section);
}

function createPlayerRow(teamKey, player, index) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.id = player.id;

    row.innerHTML = `
        <input type="number" class="player-num-input" value="${player.number}" placeholder="No." min="0" max="999">
        <input type="text" class="player-name-input" value="${player.name}" placeholder="選手名 (任意)">
        <button type="button" class="btn btn-remove-player" title="削除">✕</button>
    `;

    row.querySelector('.btn-remove-player').addEventListener('click', () => {
        row.remove();
    });

    return row;
}

function saveDataAndRedirect(isNewGame) {
    // Reconstruct data object from DOM
    const newData = { 
        teams: { A: { players: [] }, B: { players: [] } },
        gameSettings: {
            quarterLength: parseInt(document.getElementById('quarter-length').value, 10) || 6
        }
    };

    ['A', 'B'].forEach(teamKey => {
        newData.teams[teamKey].name = document.getElementById(`team-name-${teamKey}`).value || `Team ${teamKey}`;
        
        const rows = document.querySelectorAll(`#players-${teamKey} .player-row`);
        rows.forEach(row => {
            const numVal = row.querySelector('.player-num-input').value;
            const nameVal = row.querySelector('.player-name-input').value;
            // Only save if number is provided
            if (numVal.trim() !== '') {
                newData.teams[teamKey].players.push({
                    id: row.dataset.id,
                    number: parseInt(numVal, 10),
                    name: nameVal
                });
            }
        });
    });

    if (isNewGame) {
        // If they click 'Start New Game', we wipe the ongoing game state unconditionally
        if(confirm("以前の試合データがすべてリセットされます。新しく試合を始めますか？")) {
            localStorage.removeItem('bball_gameState');
        } else {
            return; // Abort navigation
        }
    } else {
        // --- Destructive Change Detection for Resumes ---
        let isDestructive = false;
        
        if (settingsData && settingsData.gameSettings) {
            if (settingsData.gameSettings.quarterLength !== newData.gameSettings.quarterLength) {
                isDestructive = true;
            }
        }
        
        ['A', 'B'].forEach(teamKey => {
            const oldPlayers = settingsData.teams[teamKey].players || [];
            const newPlayers = newData.teams[teamKey].players || [];
            
            // Count or ID changes
            if (oldPlayers.length !== newPlayers.length) {
                isDestructive = true;
            } else {
                // Check if numbers or IDs fundamentally changed (names are safe)
                for(let i=0; i<newPlayers.length; i++) {
                    if (oldPlayers[i].id !== newPlayers[i].id || oldPlayers[i].number !== newPlayers[i].number) {
                        isDestructive = true;
                    }
                }
            }
        });

        if (isDestructive) {
            const confirmReset = confirm("試合時間や選手の構成（追加・削除・背番号）が変更されました。\n現在の試合データ（スコアやログ）と矛盾が生じるため、履歴をリセットして新しく始めますか？\n\n[キャンセル] 変更を保存せずに戻る");
            if (!confirmReset) {
                return; // Abort save
            }
            localStorage.removeItem('bball_gameState');
        }
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    settingsData = JSON.parse(JSON.stringify(newData)); // Update memory
    
    // Redirect to the actual game dashboard
    window.location.href = 'game.html';
}

function setupEventListeners() {
    els.btnStartGame.addEventListener('click', () => {
        saveDataAndRedirect(true);
    });

    if (els.btnResumeGame) {
        els.btnResumeGame.addEventListener('click', () => {
            saveDataAndRedirect(false);
        });
    }
}

window.document.addEventListener('DOMContentLoaded', init);
