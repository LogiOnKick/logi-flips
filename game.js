// --- Game State & Configuration ---
let state = {
    coins: 0,
    baseChance: 0.10, 
    baseCoinValue: 2,
    flipDuration: 2000, 
    streak: 0,
    goal: 10,
    consecutiveTails: 0,
    flipCount: 0, 
    muted: false,
    purchasedUpgrades: {} 
};

let isFlipping = false;
let devMode = false;
let hideMaxed = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const banterLines = [
    "Surely the next flip will be heads... right?",
    "It's human nature to believe previous rolls affect the next.",
    "Someone won this game in their first 10 spins... probably.",
    "Some may never win. Only time will tell.",
    "Are you feeling lucky?",
    "Did you know the coin has no memory?",
    "Statistically, you have to hit it eventually.",
    "Maybe you should try blowing on the coin?",
    "Just one more flip.",
    "The house always wins... wait, there is no house.",
    "Is the coin weighted? Maybe.",
    "I've seen worse luck. Not much worse, but still.",
    "You can stop anytime. But you won't.",
    "Flipping... flipping... flipping...",
    "What if I told you the odds are an illusion?",
    "Patience is a virtue. Or so they say.",
    "Don't worry, the RNG gods are watching.",
    "Another tails? Astonishing.",
    "Have you considered asking the coin nicely?",
    "I bet your finger is getting tired."
];

// Upgrades
const upgradeConfig = [
    { id: "chance_up", name: "Weighted Edge", desc: "Adds +5% base chance to hit heads.", baseCost: 10, costMultiplier: 2.5, maxLevel: 10, applyEffect: (level) => { state.baseChance += (level * 0.05); } },
    { id: "coin_value", name: "Exalted Value", desc: "Increases the base coins gained from heads by 1.", baseCost: 25, costMultiplier: 1.8, maxLevel: 15, applyEffect: (level) => { state.baseCoinValue += level; } },
    { id: "flip_speed", name: "Quick Fingers", desc: "Reduces flip time by 0.15s.", baseCost: 40, costMultiplier: 2, maxLevel: 10, applyEffect: (level) => { state.flipDuration -= (level * 150); } },
    { id: "streak_multi", name: "Momentum", desc: "Bonus coins based on your current streak.", baseCost: 100, costMultiplier: 4, maxLevel: 5 },
    { id: "tails_refund", name: "Loot Filter", desc: "Tails have a 5% chance per level to refund 1 coin.", baseCost: 150, costMultiplier: 2.2, maxLevel: 10 },
    { id: "pity_timer", name: "Gambler's Fallacy", desc: "+1% heads chance for every consecutive Tails you currently have.", baseCost: 300, costMultiplier: 3.5, maxLevel: 5 },
    { id: "streak_shield", name: "Tavern Bribe", desc: "Tails has a 4% chance per level to NOT break your streak.", baseCost: 500, costMultiplier: 5, maxLevel: 5 },
    { id: "double_payout", name: "Kalandra's Reflection", desc: "1% chance per level to magically double the entire flip payout.", baseCost: 1000, costMultiplier: 4, maxLevel: 5 }
];

// --- Core Logic ---
function initGame() {
    loadGame();
    recalculateStats();
    updateUI();
    
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.innerText = `Sound: ${state.muted ? 'OFF' : 'ON'}`;
    muteBtn.classList.toggle('active', !state.muted);
}

function playSound(type) {
    if (state.muted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

function checkMilestones() {
    const milestones = {
        100: "100 flips... is your finger tired yet?",
        500: "500 flips! You are dedicated.",
        1000: "1000 flips. Welcome to the grind.",
        2500: "2500 flips? The coin is practically glowing from friction.",
        5000: "5000 flips! Have you considered a career in coin flipping?",
        10000: "10000 flips. Absolute madness."
    };
    
    if (milestones[state.flipCount]) {
        logEvent(`🏆 MILESTONE: ${milestones[state.flipCount]}`, 'milestone-text');
    }
}

function flipCoin() {
    if (isFlipping) return;
    
    if (audioCtx.state === 'suspended') audioCtx.resume();

    isFlipping = true;
    document.getElementById('flip-btn').disabled = true;

    let currentChance = state.baseChance;
    const pityLevel = state.purchasedUpgrades["pity_timer"] || 0;
    if (pityLevel > 0) {
        currentChance += (state.consecutiveTails * pityLevel * 0.01);
    }

    const isHeads = Math.random() < currentChance;
    const duration = devMode ? 0 : Math.max(500, state.flipDuration);

    const coinInner = document.getElementById('coin-inner');
    coinInner.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    
    state.flipCount++;
    const rotations = (state.flipCount * 1440) + (isHeads ? 0 : 180); 
    coinInner.style.transform = `rotateY(${rotations}deg)`;

    setTimeout(() => {
        resolveFlip(isHeads);
        isFlipping = false;
        document.getElementById('flip-btn').disabled = false;
    }, duration);
}

function resolveFlip(isHeads) {
    if (isHeads) {
        playSound('coin');
        state.consecutiveTails = 0;
        state.streak++;
        
        const multiLevel = state.purchasedUpgrades["streak_multi"] || 0;
        const streakBonus = multiLevel > 0 ? (state.streak * multiLevel) : 0;
        
        let wonCoins = state.baseCoinValue + streakBonus;

        const reflectLevel = state.purchasedUpgrades["double_payout"] || 0;
        let doubled = false;
        if (reflectLevel > 0 && Math.random() < (reflectLevel * 0.01)) {
            wonCoins *= 2;
            doubled = true;
        }

        state.coins += wonCoins;
        
        const exclamations = "!".repeat(state.streak);
        
        let msg = `HEADS${exclamations} +${wonCoins}`;
        if (doubled) {
            msg += " (REFLECTED!)";
            showFloatingText("DOUBLE PULL!", 'bonus-text');
        }
        
        logEvent(msg, 'heads-text');
        showFloatingText(`HEADS${exclamations}`, 'heads-text');
        
        if (state.streak >= state.goal) { 
            showWinModal(); 
            state.streak = 0; 
        }

    } else {
        playSound('fail');
        state.consecutiveTails++;
        
        const hadStreak = state.streak > 0; // Check before it resets!

        const shieldLevel = state.purchasedUpgrades["streak_shield"] || 0;
        const shieldProcced = shieldLevel > 0 && Math.random() < (shieldLevel * 0.04);
        
        if (!shieldProcced) {
            state.streak = 0;
        }

        const filterLevel = state.purchasedUpgrades["tails_refund"] || 0;
        let refunded = false;
        if (filterLevel > 0 && Math.random() < (filterLevel * 0.05)) {
            state.coins += 1;
            refunded = true;
        }

        let msg = `TAILS!`;
        if (shieldProcced) msg += ` (Streak Shielded!)`;
        else if (hadStreak) msg += ` Streak lost.`; // Only append if they actually had a streak
        
        if (refunded) {
            msg += ` +1 coin refunded.`;
            showFloatingText("REFUND", 'bonus-text');
        }

        logEvent(msg, 'tails-text');
        showFloatingText("TAILS!", 'tails-text');
    }
    
    checkMilestones();

    // Random Banter System (5% chance, skip if it's already a milestone flip)
    const milestoneNumbers = [100, 500, 1000, 2500, 5000, 10000];
    if (!milestoneNumbers.includes(state.flipCount) && Math.random() < 0.05) {
        const randomLine = banterLines[Math.floor(Math.random() * banterLines.length)];
        logEvent(`"${randomLine}"`, 'banter-text');
    }
    
    saveGame();
    updateUI();
}

function purchaseUpgrade(id) {
    if (isFlipping) return; 

    const upgrade = upgradeConfig.find(u => u.id === id);
    const currentLevel = state.purchasedUpgrades[id] || 0;
    
    if (currentLevel >= upgrade.maxLevel) return;
    
    const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
    
    if (state.coins >= cost) {
        state.coins -= cost;
        state.purchasedUpgrades[id] = currentLevel + 1;
        recalculateStats();
        saveGame();
        updateUI();
    }
}

function recalculateStats() {
    state.baseChance = 0.10; 
    state.baseCoinValue = 2;
    state.flipDuration = 2000;

    upgradeConfig.forEach(upg => {
        const level = state.purchasedUpgrades[upg.id] || 0;
        if (level > 0 && upg.applyEffect) {
            upg.applyEffect(level);
        }
    });
}

// --- UI & Rendering ---
function updateUI() {
    document.getElementById('coin-count').innerText = state.coins;
    document.getElementById('coin-value-display').innerText = state.baseCoinValue;
    
    const pityLevel = state.purchasedUpgrades["pity_timer"] || 0;
    const displayChance = state.baseChance + (state.consecutiveTails * pityLevel * 0.01);
    document.getElementById('chance-display').innerText = (displayChance * 100).toFixed(0);
    
    document.getElementById('streak-count').innerText = state.streak;
    document.getElementById('streak-goal').innerText = state.goal;
    document.getElementById('speed-display').innerText = (state.flipDuration / 1000).toFixed(2);
    
    renderUpgrades();
}

function renderUpgrades() {
    const container = document.getElementById('upgrade-list');
    container.innerHTML = '';

    upgradeConfig.forEach(upg => {
        const level = state.purchasedUpgrades[upg.id] || 0;
        const isMaxed = level >= upg.maxLevel;
        
        if (hideMaxed && isMaxed) return;

        const cost = Math.floor(upg.baseCost * Math.pow(upg.costMultiplier, level));
        const canAfford = state.coins >= cost;

        const div = document.createElement('div');
        div.className = 'upgrade-item';
        div.innerHTML = `
            <div class="upgrade-info">
                <div class="upgrade-title-row">
                    <span class="level-badge">Lv ${level}/${upg.maxLevel}</span>
                    <strong>${upg.name}</strong>
                </div>
                <p>${upg.desc}</p>
            </div>
            <button class="purchase-btn" ${(!canAfford || isMaxed) ? 'disabled' : ''} 
                    onclick="purchaseUpgrade('${upg.id}')">
                ${isMaxed ? 'MAX' : `${cost}<br><span class="coin-label">COINS</span>`}
            </button>
        `;
        container.appendChild(div);
    });
}

function logEvent(msg, className) {
    const logList = document.getElementById('log-list');
    const entry = document.createElement('div');
    entry.className = className;
    entry.innerText = msg;
    
    logList.prepend(entry); 
    if (logList.children.length > 25) { // Increased to 25 to accommodate banter
        logList.removeChild(logList.lastChild);
    }
}

function showFloatingText(text, className) {
    const container = document.querySelector('.coin-container');
    const el = document.createElement('div');
    el.className = `floating-text ${className}`;
    el.innerText = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// --- Modals & Dev Tools ---
function showWinModal() {
    document.getElementById('win-streak-display').innerText = state.goal;
    document.getElementById('next-goal-display').innerText = state.goal + 2;
    
    // Only show total flip count stat on the very first 10-streak win
    const flipsTakenContainer = document.getElementById('win-flips-taken-container');
    if (state.goal === 10) {
        document.getElementById('win-flips-taken').innerText = state.flipCount;
        flipsTakenContainer.classList.remove('hidden');
    } else {
        flipsTakenContainer.classList.add('hidden');
    }

    document.getElementById('win-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('continue-btn').addEventListener('click', () => {
    state.goal += 2;
    saveGame();
    updateUI();
    document.getElementById('win-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
});

// Password & Dev Menu Logic
document.getElementById('dev-menu-btn').addEventListener('click', () => {
    document.getElementById('dev-login-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
});

document.getElementById('dev-cancel-btn').addEventListener('click', () => {
    document.getElementById('dev-login-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('dev-password-input').value = '';
    document.getElementById('dev-error-msg').classList.add('hidden');
});

document.getElementById('dev-submit-btn').addEventListener('click', () => {
    const pw = document.getElementById('dev-password-input').value;
    if (pw === 'hax0re') {
        document.getElementById('dev-login-modal').classList.add('hidden');
        document.getElementById('dev-modal').classList.remove('hidden');
        document.getElementById('dev-password-input').value = '';
        document.getElementById('dev-error-msg').classList.add('hidden');
    } else {
        document.getElementById('dev-error-msg').classList.remove('hidden');
    }
});

// Let enter key work on password field
document.getElementById('dev-password-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') document.getElementById('dev-submit-btn').click();
});

document.getElementById('close-dev-btn').addEventListener('click', () => {
    document.getElementById('dev-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
});

function addDevCoins(amount) {
    state.coins += amount;
    saveGame();
    updateUI();
}

// --- Storage & Toggles ---
function saveGame() { localStorage.setItem('unfairFlipsSave', JSON.stringify(state)); }

function loadGame() {
    const saved = localStorage.getItem('unfairFlipsSave');
    if (saved) {
        state = { ...state, ...JSON.parse(saved) }; 
        if (!state.goal) state.goal = 10; 
    }
}

function resetGame() {
    if (confirm("Are you sure you want to delete all progress? This cannot be undone.")) {
        localStorage.removeItem('unfairFlipsSave');
        location.reload();
    }
}

document.getElementById('flip-btn').addEventListener('click', flipCoin);
document.getElementById('reset-btn').addEventListener('click', resetGame);

const hideBtn = document.getElementById('hide-maxed-btn');
hideBtn.addEventListener('click', () => {
    hideMaxed = !hideMaxed;
    hideBtn.innerText = `Hide Maxed: ${hideMaxed ? 'ON' : 'OFF'}`;
    hideBtn.classList.toggle('active', hideMaxed);
    renderUpgrades();
});

const devInstaBtn = document.getElementById('dev-insta-btn');
devInstaBtn.addEventListener('click', () => {
    devMode = !devMode;
    devInstaBtn.innerText = `Insta-Flip: ${devMode ? 'ON' : 'OFF'}`;
    devInstaBtn.classList.toggle('active', devMode);
});

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.innerText = `Sound: ${state.muted ? 'OFF' : 'ON'}`;
    muteBtn.classList.toggle('active', !state.muted);
    saveGame();
});

// Start game
initGame();
