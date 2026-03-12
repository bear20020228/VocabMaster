const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE_SIZE = 64;

// --- 遊戲狀態資料庫 (將被存入 localStorage) ---
let currentUser = "";
let gameState = {
    coins: 100,
    energy: 100,
    pigExp: 0,
    pigLv: 1,
    inventory: { carrot: 0, tomato: 0, radish: 0 },
    farmTiles: []
};

let currentSeed = 'carrot';
let currentWord = {};

// --- 新的植物資產庫 ---
const SEED_DATA = {
    carrot: { id: 'carrot', name: '🥕 蘿蔔', cost: 20, unlockLv: 1, exp: 35 },
    tomato: { id: 'tomato', name: '🍅 番茄', cost: 50, unlockLv: 3, exp: 100 },
    radish: { id: 'radish', name: '🧅 甜菜', cost: 120, unlockLv: 5, exp: 300 }
};

const assets = {
    grass: 'assets/Terrain/Grass_Light.png',
    soil: 'assets/Objects/GardenBed_Blank.png',
    // 蘿蔔
    carrot_01: 'assets/Objects/GardenBed_Carrots_01.png',
    carrot_02: 'assets/Objects/GardenBed_Carrots_02.png',
    // 番茄
    tomato_01: 'assets/Objects/GardenBed_Tomatoes_01.png',
    tomato_02: 'assets/Objects/GardenBed_Tomatoes_02.png',
    // 甜菜
    radish_01: 'assets/Objects/GardenBed_Radish_01.png',
    radish_02: 'assets/Objects/GardenBed_Radish_02.png',
    // 豬豬
    pig_down: 'assets/Characters/Pig_Down.png',
    pig_left: 'assets/Characters/Pig_Left.png',
    pig_right: 'assets/Characters/Pig_Right.png',
    pig_dead: 'assets/Characters/Pig_Dead.png'
};

const images = {};
let loaded = 0;

function loadAssets() {
    const keys = Object.keys(assets);
    keys.forEach(k => {
        images[k] = new Image();
        images[k].src = assets[k];
        images[k].onload = () => { if (++loaded === keys.length) console.log("圖片載入完成"); };
        images[k].onerror = () => { if (++loaded === keys.length) console.log("圖片載入有缺"); };
    });
}

// --- 登入與存檔系統 ---
function login() {
    const input = document.getElementById('username-input').value.trim();
    if (!input) return alert("請輸入帳號！");
    currentUser = input;

    // 讀取存檔
    const savedData = localStorage.getItem('vocabMaster_' + currentUser);
    if (savedData) {
        gameState = JSON.parse(savedData);
        alert(`歡迎回來，${currentUser}！已載入你的農場進度。`);
    } else {
        alert(`你好，${currentUser}！為你創建了全新農場。`);
        initFarmTiles(); // 初始化空農場
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    initGameEngine();
}

function saveGame() {
    if (currentUser) {
        localStorage.setItem('vocabMaster_' + currentUser, JSON.stringify(gameState));
    }
}

// 自動存檔設定：每 5 秒存一次
setInterval(saveGame, 5000); 

function initFarmTiles() {
    const cols = Math.ceil(1000 / TILE_SIZE);
    const rows = Math.ceil(650 / TILE_SIZE);
    gameState.farmTiles = [];
    for (let y = 0; y < rows; y++) {
        gameState.farmTiles[y] = [];
        for (let x = 0; x < cols; x++) gameState.farmTiles[y][x] = { plant: false, type: null, progress: 0 };
    }
}

function initGameEngine() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height;
    loadQuestion();
    requestAnimationFrame(tick);
}

// --- 餵食與智能種植 ---
function feedPig(type) {
    if (gameState.inventory[type] > 0) {
        if (gameState.energy <= 0) gameState.energy = 20; 
        gameState.inventory[type]--;
        gameState.pigExp += SEED_DATA[type].exp;
        
        const pigImg = document.getElementById('pig-img');
        pigImg.src = assets.pig_left;
        setTimeout(() => pigImg.src = assets.pig_right, 150);
        setTimeout(() => pigImg.src = assets.pig_left, 300);
        setTimeout(() => { pigImg.src = (gameState.energy <= 0) ? assets.pig_dead : assets.pig_down; }, 450);

        checkLevelUp();
        updateUI();
        saveGame(); // 關鍵動作立刻存檔
    }
}

function checkLevelUp() {
    let expNeeded = gameState.pigLv * 100;
    while (gameState.pigExp >= expNeeded) {
        gameState.pigLv++;
        gameState.pigExp -= expNeeded;
        gameState.energy = 100;
        alert("🐷 豬豬進化了！目前 Lv." + gameState.pigLv);
        expNeeded = gameState.pigLv * 100;
    }
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    
    if(gameState.farmTiles[y] && gameState.farmTiles[y][x]) {
        let t = gameState.farmTiles[y][x];
        if (t.plant && t.progress >= 100) {
            gameState.inventory[t.type] = (gameState.inventory[t.type] || 0) + 1; 
            t.plant = false; t.type = null; t.progress = 0;
        } else if (!t.plant && gameState.coins >= SEED_DATA[currentSeed].cost) {
            gameState.coins -= SEED_DATA[currentSeed].cost; 
            t.plant = true; t.type = currentSeed; t.progress = 0;
        }
        updateUI();
        togglePanel(); 
        saveGame(); // 種植或收成也立刻存檔
    }
});

function tick() {
    let multiplier = (gameState.energy < 20) ? 0.1 : (gameState.energy > 80 ? 2 : 1);
    if (gameState.energy <= 0) multiplier = 0;
    gameState.energy = Math.max(0, gameState.energy - 0.015);

    gameState.farmTiles.forEach(r => r.forEach(t => { 
        if(t.plant && t.progress < 100) t.progress += 0.05 * multiplier; 
    }));
    draw();
    updateUI();
    requestAnimationFrame(tick);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gameState.farmTiles.forEach((row, y) => row.forEach((tile, x) => {
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        if(images.grass && images.grass.complete) ctx.drawImage(images.grass, px, py, TILE_SIZE, TILE_SIZE);
        if(images.soil && images.soil.complete) ctx.drawImage(images.soil, px, py, TILE_SIZE, TILE_SIZE);
        
        if(tile.plant) {
            // 根據類型選擇圖片
            let sproutImg = images[tile.type + '_01'] || images.carrot_01;
            let matureImg = images[tile.type + '_02'] || images.carrot_02;

            if (tile.progress < 100) {
                if(sproutImg && sproutImg.complete) ctx.drawImage(sproutImg, px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = gameState.energy > 80 ? "#f1c40f" : "#4caf50";
                ctx.fillRect(px + 12, py + 52, (tile.progress/100)*40, 5);
            } else {
                if(matureImg && matureImg.complete) ctx.drawImage(matureImg, px, py, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = "rgba(255,255,255,0.8)";
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            }
        }
    }));
}

// 測驗系統
function getNextWord() {
    let totalWeight = globalVocab.reduce((sum, word) => sum + word.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let word of globalVocab) {
        if (randomNum < word.weight) return word;
        randomNum -= word.weight;
    }
    return globalVocab[0];
}

function loadQuestion() {
    currentWord = getNextWord();
    document.getElementById('word-display').innerText = currentWord.w;
    const grid = document.getElementById('options-grid'); grid.innerHTML = '';
    
    let opts = [currentWord.c];
    let safetyCounter = 0; 
    while(opts.length < 4 && safetyCounter < 100) {
        let r = globalVocab[Math.floor(Math.random() * globalVocab.length)].c;
        if(!opts.includes(r)) opts.push(r);
        safetyCounter++;
    }
    
    opts.sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button');
        b.innerText = o;
        b.onclick = () => {
            if(o === currentWord.c) {
                gameState.coins += 10; gameState.energy = Math.min(100, gameState.energy + 20);
                currentWord.weight = Math.max(1, currentWord.weight - 3); 
                gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant) t.progress = Math.min(100, t.progress + 10); }));
                saveGame();
                loadQuestion();
            } else {
                gameState.energy = Math.max(0, gameState.energy - 25);
                currentWord.weight += 10; 
                gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant) t.progress = Math.max(0, t.progress - 10); }));
            }
        };
        grid.appendChild(b);
    });
}

function equipSeed(type) {
    currentSeed = type; updateUI(); togglePanel();
}

function togglePanel(type) {
    const p = document.getElementById('floating-panel');
    if (!type) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    document.getElementById('panel-title').innerText = type === 'shop' ? '種子商城' : '背包與餵食';
    
    if (type === 'inventory') {
        let invHTML = "";
        for (let key in SEED_DATA) {
            let count = gameState.inventory[key] || 0;
            if (count > 0 || key === 'carrot') { // 蘿蔔預設顯示
                invHTML += `<div class="shop-item">
                    <span>${SEED_DATA[key].name} x ${count}</span>
                    <button onclick="feedPig('${key}')" ${count===0?'disabled':''}>餵食 (+${SEED_DATA[key].exp} Exp)</button>
                </div>`;
            }
        }
        document.getElementById('panel-body').innerHTML = invHTML || "<p>背包空空的</p>";
    } else {
        let shopHTML = "";
        for (let key in SEED_DATA) {
            let seed = SEED_DATA[key];
            let isUnlocked = gameState.pigLv >= seed.unlockLv;
            shopHTML += `<div class="shop-item">
                <span>${seed.name} (💰${seed.cost}) <br><small>${isUnlocked ? '' : `Lv.${seed.unlockLv} 解鎖`}</small></span>
                <button onclick="equipSeed('${seed.id}')" ${!isUnlocked?'disabled':''}>${isUnlocked ? '裝備種子' : '未解鎖'}</button>
            </div>`;
        }
        document.getElementById('panel-body').innerHTML = shopHTML;
    }
}

function updateUI() {
    document.getElementById('coin-count').innerText = Math.floor(gameState.coins);
    document.getElementById('energy-fill').style.width = gameState.energy + "%";
    document.getElementById('energy-num').innerText = Math.floor(gameState.energy);
    
    let expNeeded = gameState.pigLv * 100;
    document.getElementById('exp-fill').style.width = (gameState.pigExp / expNeeded * 100) + "%";
    document.getElementById('pig-lv').innerText = gameState.pigLv;

    document.getElementById('current-seed-name').innerText = SEED_DATA[currentSeed].name;

    const pigImg = document.getElementById('pig-img');
    if (gameState.energy <= 0) {
        pigImg.src = assets.pig_dead; 
    } else if (pigImg.src.includes('Pig_Dead')) {
        pigImg.src = assets.pig_down;
    }
}

loadAssets();