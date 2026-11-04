// ============================================================================
// PIXEL DRUMS: GUITAR HERO 3D EDITION + MODO 1 VS 1 ONLINE P2P
// ============================================================================
// - Modo 1 vs 1 Multijugador en tiempo real por WebRTC (PeerJS, sin backend)
// - Sistema de Salas con Códigos únicos (Host genera código, Rival se une)
// - Cara a cara (Face-Off) con barra de balance de duelo y HUD de rival en vivo
// - Estética clásica Guitar Hero en perspectiva Pseudo-3D Pixel Art
// - Pantalla completa responsiva (Full viewport)
// - Controles: Q (Verde), W (Rojo), E (Amarillo), R (Azul)
// - Mecánica 1: Línea de acierto móvil (sube y baja dinámicamente)
// - Mecánica 2: Notas sostenidas (Hold / Sustain notes con rayos/láser)
// - Mecánica 3: Tablero rotatorio dinámico (Vertical <-> Horizontal)
// - Generador de niveles por Web Audio API (análisis de beats y sustain)
// - Sintetizador de audio 8-bit integrado (Hi-hat, Snare, Tom, Kick)
// - Rock Meter, Multiplicador x1/x2/x3/x4, Fuego y Chispas Pixel Art
// - Tienda de personalización con persistencia en LocalStorage
// ============================================================================

// ----------------------------------------------------------------------------
// DATOS GLOBALES Y ESTADO PERSISTENTE
// ----------------------------------------------------------------------------
const LANE_COUNT = 4;
const LANE_KEYS = ['Q', 'W', 'E', 'R'];
const LANE_COLORS = [0x00e676, 0xff1744, 0xffea00, 0x2979ff]; // Verde, Rojo, Amarillo, Azul (GH Style)
const LANE_HEX = ['#00e676', '#ff1744', '#ffea00', '#2979ff'];
const LANE_NAMES = ['Hi-Hat (Q)', 'Snare (W)', 'Tom (E)', 'Kick (R)'];

const STORAGE_KEY = 'pixel_drums_save_v2';
function loadSaveData() {
    const def = {
        coins: 100,
        totalScore: 0,
        currentLevel: 1,
        maxLevelReached: 1,
        drumColor: 0xcc2222,
        stickColor: 0xffea00,
        outfitColor: 0x111111,
        skinColor: 0xffcc99,
        highwayTheme: 'classic',
        unlockedDrums: [0x886644, 0xcc2222],
        unlockedSticks: [0xddcc88, 0xffea00],
        unlockedOutfits: [0x111111, 0x2244cc],
        unlockedThemes: ['classic']
    };
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return Object.assign(def, JSON.parse(saved));
    } catch (e) {
        console.warn('LocalStorage error:', e);
    }
    return def;
}

function saveUserData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(playerData));
    } catch (e) {
        console.warn('LocalStorage save error:', e);
    }
}

let playerData = loadSaveData();

let customAudioData = {
    buffer: null,
    name: null
};

// ----------------------------------------------------------------------------
// GESTOR MULTIJUGADOR 1 VS 1 P2P (PeerJS / WebRTC)
// ----------------------------------------------------------------------------
class MultiplayerManager {
    static init() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.roomCode = null;
        this.isConnected = false;
        this.currentScene = null;
        this.rivalStats = {
            score: 0,
            combo: 0,
            multiplier: 1,
            rockMeter: 0.65,
            hits: 0,
            misses: 0,
            lastHit: '',
            finalScore: 0,
            accuracy: 0
        };
    }

    static openLobby(scene) {
        this.currentScene = scene;
        const modal = document.getElementById('lobby-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.startHostMode();
        }
    }

    static closeLobby() {
        const modal = document.getElementById('lobby-modal');
        if (modal) modal.style.display = 'none';
    }

    static startHostMode() {
        this.isHost = true;
        this.cleanup();

        // Generar código de sala de 4 dígitos (Ej: ROCK-7429)
        const randNum = Math.floor(1000 + Math.random() * 9000);
        this.roomCode = `ROCK-${randNum}`;

        const codeDisplay = document.getElementById('my-room-code');
        const statusDisplay = document.getElementById('host-status');
        if (codeDisplay) codeDisplay.innerText = this.roomCode;
        if (statusDisplay) statusDisplay.innerText = 'Creando sala en la red...';

        try {
            // Inicializar PeerJS con ID público basado en el código
            const peerId = `pixeldrums-gh-${this.roomCode.toLowerCase()}`;
            this.peer = new Peer(peerId);

            this.peer.on('open', (id) => {
                if (statusDisplay) statusDisplay.innerText = 'Esperando a que el rival introduzca el código...';
            });

            this.peer.on('connection', (connection) => {
                this.conn = connection;
                this.setupConnectionHandlers();
                if (statusDisplay) statusDisplay.innerText = '¡Rival detectado! Conectando duelo...';
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (statusDisplay) statusDisplay.innerText = 'Error al crear sala. Intenta de nuevo.';
            });
        } catch (e) {
            console.error('PeerJS init failed:', e);
            if (statusDisplay) statusDisplay.innerText = 'Error cargando PeerJS. Revisa tu conexión.';
        }
    }

    static joinRoom(code) {
        this.isHost = false;
        this.cleanup();

        const cleanCode = code.trim().toUpperCase();
        this.roomCode = cleanCode;
        const statusDisplay = document.getElementById('join-status');
        if (statusDisplay) statusDisplay.innerText = `Conectando a la sala ${cleanCode}...`;

        try {
            this.peer = new Peer();

            this.peer.on('open', () => {
                const hostPeerId = `pixeldrums-gh-${cleanCode.toLowerCase()}`;
                this.conn = this.peer.connect(hostPeerId, { reliable: true });
                this.setupConnectionHandlers();
            });

            this.peer.on('error', (err) => {
                console.error('Peer join error:', err);
                if (statusDisplay) statusDisplay.innerText = 'Código no encontrado o sala inactiva.';
            });
        } catch (e) {
            console.error('Join failed:', e);
            if (statusDisplay) statusDisplay.innerText = 'Error de conexión P2P.';
        }
    }

    static setupConnectionHandlers() {
        if (!this.conn) return;

        this.conn.on('open', () => {
            this.isConnected = true;
            const statusDisplay = this.isHost ? document.getElementById('host-status') : document.getElementById('join-status');
            if (statusDisplay) statusDisplay.innerText = '¡CONECTADO! INICIANDO DUELO...';

            SoundSynth.playCheer();

            if (this.isHost) {
                // El anfitrión envía la configuración del nivel y arranca
                setTimeout(() => {
                    const levelToPlay = playerData.currentLevel;
                    this.send({ type: 'start_match', level: levelToPlay });
                    this.launchGame(levelToPlay);
                }, 1200);
            }
        });

        this.conn.on('data', (data) => {
            if (data.type === 'start_match') {
                this.launchGame(data.level);
            } else if (data.type === 'stats') {
                Object.assign(this.rivalStats, data.stats);
            } else if (data.type === 'game_over') {
                this.rivalStats.finalScore = data.finalScore;
                this.rivalStats.accuracy = data.accuracy;
            } else if (data.type === 'rematch_req') {
                if (this.currentScene) {
                    this.currentScene.scene.start('GameScene', { mode: '1v1', isHost: this.isHost, level: playerData.currentLevel });
                }
            }
        });

        this.conn.on('close', () => {
            this.isConnected = false;
        });
    }

    static send(data) {
        if (this.conn && this.conn.open) {
            try {
                this.conn.send(data);
            } catch (e) {
                console.warn('Send error:', e);
            }
        }
    }

    static sendStats(stats) {
        this.send({ type: 'stats', stats });
    }

    static launchGame(level) {
        this.closeLobby();
        if (this.currentScene) {
            this.currentScene.scene.start('GameScene', { mode: '1v1', isHost: this.isHost, level: level });
        }
    }

    static cleanup() {
        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
        this.isConnected = false;
    }
}
MultiplayerManager.init();

// Funciones globales vinculadas al HTML Modal de la sala
window.switchLobbyTab = function(tab) {
    const tabHost = document.getElementById('tab-host');
    const tabJoin = document.getElementById('tab-join');
    const btnHost = document.getElementById('tab-host-btn');
    const btnJoin = document.getElementById('tab-join-btn');

    if (tab === 'host') {
        tabHost.classList.add('active');
        tabJoin.classList.remove('active');
        btnHost.classList.add('active');
        btnJoin.classList.remove('active');
        MultiplayerManager.startHostMode();
    } else {
        tabJoin.classList.add('active');
        tabHost.classList.remove('active');
        btnJoin.classList.add('active');
        btnHost.classList.remove('active');
    }
};

window.copyRoomCode = function() {
    if (MultiplayerManager.roomCode) {
        navigator.clipboard.writeText(MultiplayerManager.roomCode);
        const status = document.getElementById('host-status');
        if (status) status.innerText = '¡Código copiado al portapapeles!';
    }
};

window.joinRoomFromInput = function() {
    const input = document.getElementById('join-room-input');
    if (input && input.value.trim().length > 0) {
        MultiplayerManager.joinRoom(input.value.trim());
    } else {
        alert('Por favor ingresa un código de sala válido.');
    }
};

window.closeLobbyModal = function() {
    MultiplayerManager.closeLobby();
    MultiplayerManager.cleanup();
};

// ----------------------------------------------------------------------------
// SINTETIZADOR DE AUDIO 8-BIT (Web Audio API)
// ----------------------------------------------------------------------------
class SoundSynth {
    static init() {
        if (!SoundSynth.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            SoundSynth.ctx = new AudioCtx();
        }
        if (SoundSynth.ctx.state === 'suspended') {
            SoundSynth.ctx.resume();
        }
    }

    static playHiHat() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    static playSnare() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        const bufferSize = ctx.sampleRate * 0.12;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        oscGain.gain.setValueAtTime(0.7, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    static playTom() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.18);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
    }

    static playKick() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
    }

    static playLane(lane) {
        if (lane === 0) SoundSynth.playHiHat();
        else if (lane === 1) SoundSynth.playSnare();
        else if (lane === 2) SoundSynth.playTom();
        else if (lane === 3) SoundSynth.playKick();
    }

    static playSustainTone(lane) {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freqs = [330, 220, 165, 110];
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqs[lane], now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    static playMiss() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.12);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    static playCheer() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        for (let j = 0; j < 3; j++) {
            const bufSize = ctx.sampleRate * 0.4;
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const filt = ctx.createBiquadFilter();
            filt.frequency.setValueAtTime(800 + j * 400, now);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.15, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            src.connect(filt);
            filt.connect(g);
            g.connect(ctx.destination);
            src.start(now + j * 0.08);
        }
    }
}

// ----------------------------------------------------------------------------
// GENERADOR DE TEXTURAS PIXEL ART
// ----------------------------------------------------------------------------
class PixelFactory {
    static createNoteTexture(scene, key, color, hasRing = false) {
        const g = scene.make.graphics({ add: false });
        const w = 48, h = 32;

        g.fillStyle(0x000000, 0.7);
        g.fillEllipse(w / 2, h / 2 + 5, 42, 22);

        g.fillStyle(0x1a1a1a);
        g.fillEllipse(w / 2, h / 2, 42, 24);

        g.fillStyle(0x777777);
        g.fillEllipse(w / 2, h / 2 - 2, 38, 20);

        g.fillStyle(color);
        g.fillEllipse(w / 2, h / 2 - 3, 34, 16);

        g.fillStyle(0xffffff, 0.7);
        g.fillEllipse(w / 2 - 4, h / 2 - 6, 16, 6);

        if (hasRing) {
            g.fillStyle(0xffffff, 0.9);
            g.fillCircle(w / 2, h / 2 - 3, 3);
        }

        g.generateTexture(key, w, h);
        g.destroy();
    }

    static createReceptorTexture(scene, key, color) {
        const g = scene.make.graphics({ add: false });
        const w = 56, h = 36;

        g.fillStyle(0x0a0a0a);
        g.fillEllipse(w / 2, h / 2, 54, 32);

        g.lineStyle(3, 0xaaaaaa, 1);
        g.strokeEllipse(w / 2, h / 2, 50, 28);

        g.lineStyle(2, color, 0.8);
        g.strokeEllipse(w / 2, h / 2, 42, 22);

        g.fillStyle(0x151515);
        g.fillEllipse(w / 2, h / 2, 34, 16);

        g.fillStyle(color, 0.5);
        g.fillCircle(w / 2, h / 2, 4);

        g.generateTexture(key, w, h);
        g.destroy();
    }

    static createSparksTexture(scene, key) {
        const g = scene.make.graphics({ add: false });
        g.fillStyle(0xffffff);
        g.fillRect(10, 2, 4, 20);
        g.fillRect(2, 10, 20, 4);
        g.fillRect(6, 6, 12, 12);
        g.generateTexture(key, 24, 24);
        g.destroy();
    }

    static createDrummerTexture(scene, key, outfitCol, skinCol, drumCol, stickCol) {
        const g = scene.make.graphics({ add: false });
        const w = 120, h = 100;

        g.fillStyle(0xffcc00);
        g.fillEllipse(18, 30, 30, 8);
        g.fillEllipse(102, 30, 30, 8);
        g.fillStyle(0x888844);
        g.fillRect(17, 34, 3, 25);
        g.fillRect(101, 34, 3, 25);

        g.fillStyle(drumCol);
        g.fillCircle(60, 70, 26);
        g.fillStyle(0x222222);
        g.fillCircle(60, 70, 24);
        g.fillStyle(0xeeeeee);
        g.fillCircle(60, 70, 20);
        g.fillStyle(0xff1744);
        g.fillRect(52, 66, 16, 4);
        g.fillRect(58, 62, 4, 14);

        g.fillStyle(drumCol);
        g.fillRect(28, 48, 20, 16);
        g.fillRect(72, 48, 20, 16);
        g.fillStyle(0xddddcc);
        g.fillRect(30, 46, 16, 4);
        g.fillRect(74, 46, 16, 4);

        g.fillStyle(0xbbbbbb);
        g.fillRect(14, 58, 18, 12);
        g.fillStyle(0xffffff);
        g.fillRect(16, 56, 14, 3);

        g.fillStyle(outfitCol);
        g.fillRect(52, 28, 16, 20);

        g.fillStyle(skinCol);
        g.fillRect(54, 12, 12, 14);
        g.fillStyle(0x111111);
        g.fillRect(52, 8, 16, 7);
        g.fillRect(50, 12, 4, 16);
        g.fillRect(66, 12, 4, 16);
        g.fillStyle(0x000000);
        g.fillRect(54, 16, 12, 3);

        g.fillStyle(skinCol);
        g.fillRect(44, 30, 8, 4);
        g.fillRect(68, 30, 8, 4);

        g.fillStyle(stickCol);
        g.fillRect(34, 26, 14, 3);
        g.fillRect(72, 26, 14, 3);

        g.generateTexture(key, w, h);
        g.destroy();
    }

    static createAmpTexture(scene, key) {
        const g = scene.make.graphics({ add: false });
        const w = 70, h = 130;

        g.fillStyle(0x111111);
        g.fillRect(0, 0, w, h);
        g.lineStyle(2, 0xd4af37, 1);
        g.strokeRect(1, 1, w - 2, h - 2);

        g.fillStyle(0x282828);
        g.fillRect(6, 26, w - 12, h - 34);

        g.fillStyle(0x181818);
        g.fillCircle(w / 2, 50, 18);
        g.fillCircle(w / 2, 92, 18);
        g.fillStyle(0xd4af37);
        g.fillCircle(w / 2, 50, 5);
        g.fillCircle(w / 2, 92, 5);

        g.fillStyle(0xd4af37);
        g.fillRect(6, 6, w - 12, 14);
        g.fillStyle(0x000000);
        for (let i = 0; i < 5; i++) {
            g.fillCircle(14 + i * 10, 13, 2);
        }

        g.generateTexture(key, w, h);
        g.destroy();
    }
}

// ----------------------------------------------------------------------------
// ANALIZADOR DE AUDIO (Web Audio API)
// ----------------------------------------------------------------------------
class AudioAnalyzer {
    static analyze(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;

        const windowSize = Math.floor(sampleRate * 0.04);
        const hopSize = Math.floor(windowSize / 2);
        const energies = [];

        for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                sum += channelData[i + j] * channelData[i + j];
            }
            energies.push({
                energy: Math.sqrt(sum / windowSize),
                time: i / sampleRate
            });
        }

        const notes = [];
        const avgWindow = 18;
        const threshold = 1.35;
        const minGap = 0.16;
        let lastTime = -1;

        for (let i = avgWindow; i < energies.length - avgWindow; i++) {
            let localAvg = 0;
            for (let j = i - avgWindow; j < i + avgWindow; j++) {
                localAvg += energies[j].energy;
            }
            localAvg /= (avgWindow * 2);

            const curr = energies[i].energy;
            const time = energies[i].time;

            if (curr > localAvg * threshold && (time - lastTime) > minGap) {
                const lane = AudioAnalyzer._getLane(channelData, Math.floor(time * sampleRate), windowSize, sampleRate);
                let sustainDur = 0;
                let lookAhead = i + 1;
                while (lookAhead < energies.length && lookAhead < i + 25 && energies[lookAhead].energy > localAvg * 1.1) {
                    lookAhead++;
                }
                const sustainedLength = (lookAhead - i) * (hopSize / sampleRate);
                if (sustainedLength >= 0.5) {
                    sustainDur = Math.min(sustainedLength, 2.0);
                }

                notes.push({
                    time: time,
                    lane: lane,
                    duration: sustainDur
                });
                lastTime = time + sustainDur;
            }
        }

        return { notes, duration };
    }

    static _getLane(data, start, size, rate) {
        const n = Math.min(size, 256);
        const bands = [0, 0, 0, 0];
        const freqs = [[4000, 8000], [1200, 3500], [300, 1000], [40, 250]];

        for (let b = 0; b < 4; b++) {
            const [fL, fH] = freqs[b];
            const kL = Math.floor(fL * n / rate);
            const kH = Math.min(Math.ceil(fH * n / rate), n / 2);
            for (let k = kL; k <= kH; k++) {
                let re = 0, im = 0;
                for (let i = 0; i < n; i++) {
                    const idx = start + i;
                    if (idx < data.length) {
                        const ang = -2 * Math.PI * k * i / n;
                        re += data[idx] * Math.cos(ang);
                        im += data[idx] * Math.sin(ang);
                    }
                }
                bands[b] += Math.sqrt(re * re + im * im);
            }
        }
        let maxB = 0;
        for (let b = 1; b < 4; b++) if (bands[b] > bands[maxB]) maxB = b;
        return maxB;
    }

    static generateLevelSong(level) {
        const duration = 35 + (level - 1) * 8;
        const bpm = 110 + (level - 1) * 15;
        const beatStep = 60 / bpm;
        const notes = [];

        let t = 2.0;
        let stepCount = 0;

        while (t < duration - 2.0) {
            stepCount++;
            const beatInBar = stepCount % 16;
            let spawnLanes = [];
            let isSustain = false;
            let sustainDur = 0;

            if (level === 1) {
                if (beatInBar % 4 === 0) spawnLanes = [3];
                else if (beatInBar % 4 === 2) spawnLanes = [1];
                if (beatInBar % 2 === 0) spawnLanes.push(0);
            } else if (level === 2) {
                if (beatInBar === 0 || beatInBar === 8) {
                    spawnLanes = [3];
                    isSustain = true;
                    sustainDur = beatStep * 2.2;
                } else if (beatInBar === 4 || beatInBar === 12) {
                    spawnLanes = [1];
                } else if (beatInBar % 2 === 1) {
                    spawnLanes = [beatInBar % 4 === 1 ? 0 : 2];
                }
            } else if (level === 3) {
                if (beatInBar % 4 === 0) spawnLanes = [3];
                if (beatInBar % 4 === 2) spawnLanes = [1];
                if (beatInBar % 3 === 0) spawnLanes.push(2);
                if (beatInBar % 2 === 1 && Math.random() > 0.4) spawnLanes.push(0);
                if (beatInBar === 14) {
                    isSustain = true;
                    sustainDur = beatStep * 2;
                }
            } else if (level === 4) {
                spawnLanes = [stepCount % 4];
                if (stepCount % 2 === 0) spawnLanes.push(3);
                if (beatInBar === 0 || beatInBar === 8) {
                    isSustain = true;
                    sustainDur = beatStep * 1.8;
                }
            } else {
                spawnLanes = [stepCount % 4];
                if (stepCount % 3 === 0) spawnLanes.push((stepCount + 2) % 4);
                if (beatInBar === 0 || beatInBar === 6 || beatInBar === 12) {
                    isSustain = true;
                    sustainDur = beatStep * 2.5;
                }
            }

            for (const lane of spawnLanes) {
                notes.push({
                    time: t,
                    lane: lane,
                    duration: isSustain ? sustainDur : 0
                });
            }

            t += beatStep;
        }

        return { notes, duration };
    }
}

// ----------------------------------------------------------------------------
// ESCENA: BOOT
// ----------------------------------------------------------------------------
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        for (let i = 0; i < LANE_COUNT; i++) {
            PixelFactory.createNoteTexture(this, `note-gem-${i}`, LANE_COLORS[i], true);
            PixelFactory.createReceptorTexture(this, `receptor-${i}`, LANE_COLORS[i]);
        }
        PixelFactory.createSparksTexture(this, 'sparks');
        PixelFactory.createAmpTexture(this, 'amp-tower');
        PixelFactory.createDrummerTexture(
            this, 'drummer-base',
            playerData.outfitColor, playerData.skinColor,
            playerData.drumColor, playerData.stickColor
        );

        this.scene.start('MenuScene');
    }
}

// ----------------------------------------------------------------------------
// ESCENA: MENÚ PRINCIPAL
// ----------------------------------------------------------------------------
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        SoundSynth.init();

        this.bgGraphics = this.add.graphics();
        this._drawMenuBackground(w, h);

        this.spotlights = [];
        for (let i = 0; i < 4; i++) {
            const spot = this.add.graphics();
            this.spotlights.push({ g: spot, baseAngle: i * 0.8, color: LANE_COLORS[i] });
        }

        const titleY = Math.max(45, h * 0.10);
        this.add.text(w / 2, titleY, 'PIXEL HERO', {
            fontSize: `${Math.min(w * 0.08, 62)}px`,
            fontFamily: 'Impact, "Trebuchet MS", sans-serif',
            fontStyle: 'bold',
            color: '#ffea00',
            stroke: '#000000',
            strokeThickness: 10,
            shadow: { offsetX: 4, offsetY: 4, color: '#ff1744', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.add.text(w / 2, titleY + 42, '★ 8-BIT DRUM HIGHWAY ★', {
            fontSize: `${Math.min(w * 0.024, 17)}px`,
            fontFamily: 'Courier New, monospace',
            fontStyle: 'bold',
            color: '#00e676',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.drummer = this.add.image(w / 2, h * 0.33, 'drummer-base').setScale(Math.min(w, h) / 480);
        this.tweens.add({
            targets: this.drummer,
            y: this.drummer.y - 8,
            duration: 350,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const ampScale = Math.min(w, h) / 620;
        this.add.image(w * 0.14, h * 0.40, 'amp-tower').setScale(ampScale);
        this.add.image(w * 0.86, h * 0.40, 'amp-tower').setScale(ampScale).setFlipX(true);

        this.add.text(w / 2, h * 0.48, `MONEDAS: ${playerData.coins} ¢  |  NIVEL: ${playerData.currentLevel}`, {
            fontSize: `${Math.min(w * 0.022, 15)}px`,
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#111111aa',
            padding: { x: 12, y: 5 }
        }).setOrigin(0.5);

        // Botones de acción principales
        const btnStartY = h * 0.54;
        const btnSpacing = Math.min(h * 0.08, 48);

        this._createRockButton(w / 2, btnStartY, `JUGAR NIVEL ${playerData.currentLevel}`, 0x00e676, () => {
            this.scene.start('GameScene', { mode: 'default', level: playerData.currentLevel });
        });

        // BOTÓN 1 VS 1 ONLINE
        this._createRockButton(w / 2, btnStartY + btnSpacing, '⚔ DUELO 1 VS 1 ONLINE ⚔', 0xff1744, () => {
            MultiplayerManager.openLobby(this);
        });

        this._createRockButton(w / 2, btnStartY + btnSpacing * 2, 'SUBIR TU MÚSICA (MP3/WAV)', 0x2979ff, () => {
            this._handleAudioUpload();
        });

        this._createRockButton(w / 2, btnStartY + btnSpacing * 3, 'TIENDA & PERSONALIZACIÓN', 0xffea00, () => {
            this.scene.start('ShopScene');
        });

        this._createLevelSelector(w / 2, btnStartY + btnSpacing * 4);

        const footerY = h - 22;
        this.add.text(w / 2, footerY, 'CONTROLES: [Q] Hi-Hat  [W] Snare  [E] Tom  [R] Kick  |  MANTÉN EN NOTAS LARGAS', {
            fontSize: `${Math.min(w * 0.016, 12)}px`,
            fontFamily: 'Courier New, monospace',
            color: '#888888'
        }).setOrigin(0.5);

        this.scale.on('resize', this._onResize, this);
    }

    _drawMenuBackground(w, h) {
        this.bgGraphics.clear();
        this.bgGraphics.fillStyle(0x0a0914);
        this.bgGraphics.fillRect(0, 0, w, h);

        this.bgGraphics.fillStyle(0x2d1a0e);
        this.bgGraphics.fillRect(0, h * 0.44, w, h * 0.56);
        this.bgGraphics.fillStyle(0xd4af37, 0.4);
        this.bgGraphics.fillRect(0, h * 0.44, w, 4);

        this.bgGraphics.fillStyle(0x05040a);
        const crowdCount = Math.floor(w / 25);
        for (let i = 0; i < crowdCount; i++) {
            const cx = i * 25 + 12;
            const ch = 40 + Math.sin(i * 1.5) * 15;
            this.bgGraphics.fillCircle(cx, h - ch, 14);
            this.bgGraphics.fillRect(cx - 14, h - ch + 8, 28, ch);
            if (i % 3 === 0) {
                this.bgGraphics.fillRect(cx - 18, h - ch - 12, 5, 14);
                this.bgGraphics.fillRect(cx - 10, h - ch - 12, 5, 14);
            }
        }
    }

    _createRockButton(x, y, text, color, callback) {
        const w = Math.min(this.scale.width * 0.65, 340);
        const h = 38;

        const container = this.add.container(x, y);
        const shadow = this.add.rectangle(4, 4, w, h, 0x000000, 0.8);
        const bg = this.add.rectangle(0, 0, w, h, 0x1e1e1e);
        bg.setStrokeStyle(3, color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${Math.min(this.scale.width * 0.021, 15)}px`,
            fontFamily: 'Impact, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);

        container.add([shadow, bg, label]);
        bg.setInteractive({ useHandCursor: true });

        bg.on('pointerover', () => {
            bg.setFillStyle(color);
            label.setColor('#000000');
            SoundSynth.playHiHat();
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(0x1e1e1e);
            label.setColor('#ffffff');
        });
        bg.on('pointerdown', () => {
            SoundSynth.playKick();
            callback();
        });

        return container;
    }

    _createLevelSelector(x, y) {
        const container = this.add.container(x, y);
        this.add.text(x, y - 20, 'NIVEL:', {
            fontSize: '11px', fontFamily: 'Courier New, monospace', color: '#ffea00'
        }).setOrigin(0.5);

        for (let i = 1; i <= 5; i++) {
            const lx = (i - 3) * 60;
            const isUnlocked = i <= playerData.maxLevelReached;
            const isSelected = i === playerData.currentLevel;

            const box = this.add.rectangle(lx, 0, 46, 26, isSelected ? 0x00e676 : (isUnlocked ? 0x333333 : 0x151515));
            box.setStrokeStyle(2, isUnlocked ? 0xffea00 : 0x555555);

            const txt = this.add.text(lx, 0, `N${i}`, {
                fontSize: '12px', fontFamily: 'Impact, sans-serif',
                color: isSelected ? '#000000' : (isUnlocked ? '#ffffff' : '#666666')
            }).setOrigin(0.5);

            container.add([box, txt]);

            if (isUnlocked) {
                box.setInteractive({ useHandCursor: true });
                box.on('pointerdown', () => {
                    playerData.currentLevel = i;
                    saveUserData();
                    this.scene.restart();
                });
            }
        }
    }

    _handleAudioUpload() {
        const fileInput = document.getElementById('audio-upload');
        fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                SoundSynth.init();
                SoundSynth.ctx.decodeAudioData(event.target.result, (decoded) => {
                    customAudioData.buffer = decoded;
                    customAudioData.name = file.name;
                    this.scene.start('GameScene', { mode: 'custom-audio', level: playerData.currentLevel });
                }, (err) => {
                    alert('Error al procesar el archivo de audio. Prueba con formato MP3 o WAV estándar.');
                });
            };
            reader.readAsArrayBuffer(file);
            fileInput.value = '';
        };
    }

    _onResize(gameSize) {
        this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
        this.scene.restart();
    }

    update(time) {
        for (let i = 0; i < this.spotlights.length; i++) {
            const s = this.spotlights[i];
            s.g.clear();
            const angle = s.baseAngle + Math.sin(time * 0.0015 + i) * 0.4;
            const w = this.scale.width;
            const originX = (i + 1) * (w / 5);
            s.g.fillStyle(s.color, 0.06);
            s.g.beginPath();
            s.g.moveTo(originX, 0);
            s.g.lineTo(originX + Math.cos(angle - 0.2) * 500, Math.sin(angle - 0.2) * 500);
            s.g.lineTo(originX + Math.cos(angle + 0.2) * 500, Math.sin(angle + 0.2) * 500);
            s.g.closePath();
            s.g.fillPath();
        }
    }
}

// ----------------------------------------------------------------------------
// ESCENA: GAMEPLAY (HIGHWAY 3D + MODO 1 VS 1 EN VIVO)
// ----------------------------------------------------------------------------
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        this.mode = data.mode || 'default';
        this.level = data.level || 1;
        this.is1v1 = (this.mode === '1v1');

        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.hits = 0;
        this.misses = 0;
        this.rockMeter = 0.65;

        // Dificultades mecánicas
        this.enableMovingHitLine = this.level >= 3;
        this.enableBoardRotation = this.level >= 4;

        this.boardAngle = 0;
        this.targetBoardAngle = 0;

        this.baseHitZ = 0.85;
        this.currentHitZ = 0.85;

        this.notes = [];
        this.holdingLanes = [false, false, false, false];
        this.activeHoldNotes = [null, null, null, null];

        this.isPlaying = false;
        this.gameStartTime = 0;
        this.songTime = 0;
        this.duration = 40;

        this.customAudioSource = null;
        this.lastStatsSync = 0;
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.laneKeys = [this.keyQ, this.keyW, this.keyE, this.keyR];
        this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        this.stageGraphics = this.add.graphics();
        this.highwayGraphics = this.add.graphics();
        this.sustainGraphics = this.add.graphics();
        this.effectsGraphics = this.add.graphics();
        this.rivalGraphics = this.add.graphics();

        this.receptors = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            const r = this.add.image(0, 0, `receptor-${i}`).setOrigin(0.5);
            this.receptors.push(r);
        }

        this.drummer = this.add.image(w / 2, h * 0.22, 'drummer-base').setScale(0.85);

        this._createRockHUD();

        this._loadSong();

        this._startCountdown();

        this.scale.on('resize', () => {
            this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
        });
    }

    _createRockHUD() {
        const w = this.scale.width;
        const h = this.scale.height;

        this.scoreText = this.add.text(30, 25, 'SCORE: 0', {
            fontSize: '24px', fontFamily: 'Impact, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 5
        });

        this.multiplierText = this.add.text(30, 60, '1X', {
            fontSize: '32px', fontFamily: 'Impact, sans-serif',
            color: '#ffea00', stroke: '#000000', strokeThickness: 6
        });

        this.comboText = this.add.text(w / 2, 80, '', {
            fontSize: '28px', fontFamily: 'Impact, sans-serif',
            color: '#00e676', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.ratingText = this.add.text(w / 2, h * 0.65, '', {
            fontSize: '36px', fontFamily: 'Impact, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);

        this.alertBanner = this.add.text(w / 2, h * 0.35, '', {
            fontSize: '26px', fontFamily: 'Impact, sans-serif',
            color: '#ff1744', stroke: '#000000', strokeThickness: 6,
            backgroundColor: '#000000cc', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setAlpha(0);

        this.rockMeterGraphics = this.add.graphics();

        // HUD ESPECIAL PARA MODO 1 VS 1 (FACE-OFF)
        if (this.is1v1) {
            this.rivalScoreText = this.add.text(w - 30, 25, 'RIVAL: 0', {
                fontSize: '24px', fontFamily: 'Impact, sans-serif',
                color: '#ff1744', stroke: '#000000', strokeThickness: 5
            }).setOrigin(1, 0);

            this.rivalComboText = this.add.text(w - 30, 60, 'COMBO: 0', {
                fontSize: '20px', fontFamily: 'Impact, sans-serif',
                color: '#ffea00', stroke: '#000000', strokeThickness: 4
            }).setOrigin(1, 0);

            // Barra superior de balance del duelo (Tug-of-war)
            this.duelBalanceText = this.add.text(w / 2, 22, '⚔ DUELO EN VIVO ⚔', {
                fontSize: '15px', fontFamily: 'Impact, sans-serif',
                color: '#ffea00', stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5);
        }
    }

    _loadSong() {
        if (this.mode === 'custom-audio' && customAudioData.buffer) {
            const res = AudioAnalyzer.analyze(customAudioData.buffer);
            this.notesData = res.notes;
            this.duration = res.duration;
        } else {
            const res = AudioAnalyzer.generateLevelSong(this.level);
            this.notesData = res.notes;
            this.duration = res.duration;
        }

        this.notes = this.notesData.map(nd => ({
            time: nd.time,
            lane: nd.lane,
            duration: nd.duration || 0,
            sprite: this.add.image(-100, -100, `note-gem-${nd.lane}`).setVisible(false),
            state: 'pending',
            holdProgress: 0,
            scored: false
        }));
    }

    _startCountdown() {
        const w = this.scale.width;
        const h = this.scale.height;
        let count = 3;

        const countText = this.add.text(w / 2, h / 2, '3', {
            fontSize: '90px', fontFamily: 'Impact, sans-serif',
            color: '#ffea00', stroke: '#000000', strokeThickness: 10
        }).setOrigin(0.5);

        this.time.addEvent({
            delay: 700,
            repeat: 3,
            callback: () => {
                count--;
                if (count > 0) {
                    countText.setText(count.toString());
                    SoundSynth.playHiHat();
                } else if (count === 0) {
                    countText.setText(this.is1v1 ? '¡DUELO!' : '¡ROCK!');
                    countText.setColor('#00e676');
                    SoundSynth.playSnare();
                } else {
                    countText.destroy();
                    this._beginPlay();
                }
            }
        });
    }

    _beginPlay() {
        this.isPlaying = true;
        this.gameStartTime = this.time.now;

        if (this.mode === 'custom-audio' && customAudioData.buffer) {
            SoundSynth.init();
            this.customAudioSource = SoundSynth.ctx.createBufferSource();
            this.customAudioSource.buffer = customAudioData.buffer;
            this.customAudioSource.connect(SoundSynth.ctx.destination);
            this.customAudioSource.start(0);
        }

        if (this.enableBoardRotation) {
            this.time.addEvent({
                delay: 11000,
                loop: true,
                callback: () => this._triggerBoardRotation()
            });
        }
    }

    _triggerBoardRotation() {
        if (!this.isPlaying) return;
        const nextAngle = this.targetBoardAngle === 0 ? Math.PI / 2 : 0;
        const textMsg = nextAngle === 0 ? '⬇ TABLERO VERTICAL ⬇' : '➡ ¡ROTACIÓN HORIZONTAL! ➡';

        this._showAlert(textMsg, 0xffea00);

        this.tweens.add({
            targets: this,
            boardAngle: nextAngle,
            duration: 1800,
            ease: 'Cubic.easeInOut',
            onStart: () => { SoundSynth.playTom(); },
            onComplete: () => { this.targetBoardAngle = nextAngle; }
        });
    }

    _showAlert(text, color) {
        this.alertBanner.setText(text);
        this.alertBanner.setColor('#' + color.toString(16).padStart(6, '0'));
        this.alertBanner.setAlpha(1);
        this.tweens.add({
            targets: this.alertBanner,
            alpha: 0,
            duration: 1600,
            delay: 1200
        });
    }

    _getPerspectivePoint(lane, z, theta = this.boardAngle) {
        const w = this.scale.width;
        const h = this.scale.height;
        const cx = w / 2;
        const cy = h / 2;

        const highwayLength = Math.min(w, h) * 0.82;
        const topWidth = Math.min(w, h) * 0.16;
        const bottomWidth = Math.min(w, h) * 0.58;

        const t = Math.pow(Math.max(0, Math.min(1, z)), 1.6);

        const uX = Math.sin(theta);
        const uY = Math.cos(theta);
        const vX = Math.cos(theta);
        const vY = -Math.sin(theta);

        const horizDist = highwayLength * 0.45;
        const nearDist = highwayLength * 0.45;

        const hx = cx - uX * horizDist;
        const hy = cy - uY * horizDist;
        const nx = cx + uX * nearDist;
        const ny = cy + uY * nearDist;

        const curX = hx + (nx - hx) * t;
        const curY = hy + (ny - hy) * t;

        const curW = topWidth + (bottomWidth - topWidth) * t;

        const laneOffset = (lane - 1.5) / 2.0;
        const px = curX + vX * (laneOffset * curW);
        const py = curY + vY * (laneOffset * curW);

        const scale = 0.3 + 0.85 * t;

        return { x: px, y: py, width: curW, scale: scale, centerX: curX, centerY: curY, vX, vY };
    }

    update(time, delta) {
        if (!this.isPlaying) return;

        const w = this.scale.width;
        const h = this.scale.height;
        this.songTime = (time - this.gameStartTime) / 1000;

        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this._endGame();
            return;
        }

        if (this.enableMovingHitLine) {
            this.currentHitZ = this.baseHitZ + Math.sin(this.songTime * 2.5) * 0.10;
        } else {
            this.currentHitZ = this.baseHitZ;
        }

        this._renderStage(w, h, time);
        this._render3DHighway();
        this._updateReceptors();
        this._handleKeyInputs(delta);
        this._updateNotes();
        this._updateHUD();

        // Enviar estadísticas en tiempo real por WebRTC si es 1 vs 1
        if (this.is1v1 && time - this.lastStatsSync > 80) {
            this.lastStatsSync = time;
            MultiplayerManager.sendStats({
                score: this.score,
                combo: this.combo,
                multiplier: this.multiplier,
                rockMeter: this.rockMeter,
                hits: this.hits,
                misses: this.misses
            });
            this._render1v1Balance(w);
        }

        if (this.songTime > this.duration + 2.5) {
            this._endGame();
        }
    }

    _renderStage(w, h, time) {
        this.stageGraphics.clear();
        this.stageGraphics.fillStyle(0x06060c);
        this.stageGraphics.fillRect(0, 0, w, h);

        this.stageGraphics.fillStyle(0x1a110a);
        this.stageGraphics.fillRect(0, h * 0.45, w, h * 0.55);

        for (let i = 0; i < 4; i++) {
            const col = LANE_COLORS[i];
            const pulse = 0.05 + 0.03 * Math.sin(time * 0.005 + i);
            this.stageGraphics.fillStyle(col, pulse);
            const sx = (i + 1) * (w / 5);
            this.stageGraphics.beginPath();
            this.stageGraphics.moveTo(sx, 0);
            this.stageGraphics.lineTo(sx - 120, h);
            this.stageGraphics.lineTo(sx + 120, h);
            this.stageGraphics.closePath();
            this.stageGraphics.fillPath();
        }

        const horiz = this._getPerspectivePoint(1.5, 0.05);
        this.drummer.setPosition(horiz.centerX, horiz.centerY - 25);
    }

    _render3DHighway() {
        this.highwayGraphics.clear();

        const pTopLeft = this._getPerspectivePoint(0, 0);
        const pTopRight = this._getPerspectivePoint(3, 0);
        const pBotLeft = this._getPerspectivePoint(0, 1);
        const pBotRight = this._getPerspectivePoint(3, 1);

        const themeColor = playerData.highwayTheme === 'neon' ? 0x051b2c : 0x18181c;
        this.highwayGraphics.fillStyle(themeColor, 0.95);
        this.highwayGraphics.beginPath();
        this.highwayGraphics.moveTo(pTopLeft.x - pTopLeft.vX * 25, pTopLeft.y - pTopLeft.vY * 25);
        this.highwayGraphics.lineTo(pTopRight.x + pTopRight.vX * 25, pTopRight.y + pTopRight.vY * 25);
        this.highwayGraphics.lineTo(pBotRight.x + pBotRight.vX * 55, pBotRight.y + pBotRight.vY * 55);
        this.highwayGraphics.lineTo(pBotLeft.x - pBotLeft.vX * 55, pBotLeft.y - pBotLeft.vY * 55);
        this.highwayGraphics.closePath();
        this.highwayGraphics.fillPath();

        this.highwayGraphics.lineStyle(4, 0xd4af37, 1);
        this.highwayGraphics.lineBetween(
            pTopLeft.x - pTopLeft.vX * 25, pTopLeft.y - pTopLeft.vY * 25,
            pBotLeft.x - pBotLeft.vX * 55, pBotLeft.y - pBotLeft.vY * 55
        );
        this.highwayGraphics.lineBetween(
            pTopRight.x + pTopRight.vX * 25, pTopRight.y + pTopRight.vY * 25,
            pBotRight.x + pBotRight.vX * 55, pBotRight.y + pBotRight.vY * 55
        );

        this.highwayGraphics.lineStyle(2, 0x444455, 0.6);
        for (let i = 0.5; i <= 2.5; i += 1.0) {
            const pStart = this._getPerspectivePoint(i, 0);
            const pEnd = this._getPerspectivePoint(i, 1);
            this.highwayGraphics.lineBetween(pStart.x, pStart.y, pEnd.x, pEnd.y);
        }

        const beatOffset = (this.songTime * 2.0) % 1.0;
        for (let b = 0; b < 6; b++) {
            const zBar = (b + beatOffset) / 6.0;
            if (zBar > 0.05 && zBar < 0.98) {
                const bL = this._getPerspectivePoint(0, zBar);
                const bR = this._getPerspectivePoint(3, zBar);
                this.highwayGraphics.lineStyle(1.5, 0x666677, 0.4);
                this.highwayGraphics.lineBetween(bL.x, bL.y, bR.x, bR.y);
            }
        }

        const hitL = this._getPerspectivePoint(0, this.currentHitZ);
        const hitR = this._getPerspectivePoint(3, this.currentHitZ);
        this.highwayGraphics.lineStyle(4, 0xffffff, 0.8);
        this.highwayGraphics.lineBetween(hitL.x - hitL.vX * 30, hitL.y - hitL.vY * 30, hitR.x + hitR.vX * 30, hitR.y + hitR.vY * 30);
    }

    _updateReceptors() {
        for (let i = 0; i < LANE_COUNT; i++) {
            const pt = this._getPerspectivePoint(i, this.currentHitZ);
            const rec = this.receptors[i];
            rec.setPosition(pt.x, pt.y);
            rec.setScale(pt.scale * 1.1);
            rec.setRotation(this.boardAngle);

            const isDown = this.laneKeys[i].isDown;
            if (isDown) {
                rec.setTint(0xffffff);
                rec.setScale(pt.scale * 1.25);
            } else {
                rec.clearTint();
            }
        }
    }

    _handleKeyInputs(delta) {
        for (let i = 0; i < LANE_COUNT; i++) {
            const key = this.laneKeys[i];

            if (Phaser.Input.Keyboard.JustDown(key)) {
                this._onLaneHit(i);
            }

            if (key.isDown && this.activeHoldNotes[i]) {
                const holdNote = this.activeHoldNotes[i];
                const dtSec = delta / 1000;
                holdNote.holdProgress += dtSec;

                this.score += Math.floor(25 * this.multiplier);
                this.rockMeter = Math.min(1.0, this.rockMeter + 0.003);

                this._spawnHoldSparks(i);

                if (Math.random() < 0.25) {
                    SoundSynth.playSustainTone(i);
                }

                if (holdNote.holdProgress >= holdNote.duration) {
                    this._onHoldComplete(i, holdNote);
                }
            } else if (!key.isDown && this.activeHoldNotes[i]) {
                this._onHoldBreak(i);
            }
        }
    }

    _onLaneHit(lane) {
        SoundSynth.playLane(lane);

        let bestNote = null;
        let minDiff = Infinity;
        const approachTime = 1.6;

        for (const n of this.notes) {
            if (n.lane === lane && n.state === 'pending') {
                const diff = Math.abs(this.songTime - n.time);
                if (diff < minDiff && diff < 0.28) {
                    minDiff = diff;
                    bestNote = n;
                }
            }
        }

        if (bestNote) {
            let rating = 'GOOD';
            let pts = 50;
            let ratingColor = '#2979ff';

            if (minDiff < 0.06) {
                rating = 'PERFECT!';
                pts = 100;
                ratingColor = '#ffea00';
            } else if (minDiff < 0.14) {
                rating = 'GREAT!';
                pts = 75;
                ratingColor = '#00e676';
            }

            this.score += pts * this.multiplier;
            this.combo++;
            this.hits++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            this.multiplier = Math.min(4, 1 + Math.floor(this.combo / 10));
            this.rockMeter = Math.min(1.0, this.rockMeter + 0.05);

            this._showRating(rating, ratingColor);
            this._spawnHitParticles(lane);

            if (bestNote.duration > 0) {
                bestNote.state = 'holding';
                this.activeHoldNotes[lane] = bestNote;
            } else {
                bestNote.state = 'hit';
                bestNote.sprite.setVisible(false);
            }
        } else {
            this.rockMeter = Math.max(0, this.rockMeter - 0.04);
            if (this.combo > 5) {
                this.combo = 0;
                this.multiplier = 1;
            }
        }
    }

    _onHoldComplete(lane, note) {
        note.state = 'hit';
        note.sprite.setVisible(false);
        this.activeHoldNotes[lane] = null;

        this.score += 200 * this.multiplier;
        playerData.coins += 2;
        this._showRating('HOLD MAX!', '#ffea00');
        this._spawnHitParticles(lane);
    }

    _onHoldBreak(lane) {
        const note = this.activeHoldNotes[lane];
        if (note) {
            note.state = 'missed';
            note.sprite.setVisible(false);
            this.activeHoldNotes[lane] = null;
            this.combo = 0;
            this.multiplier = 1;
            this.rockMeter = Math.max(0, this.rockMeter - 0.08);
            this._showRating('RELEASE!', '#ff1744');
            SoundSynth.playMiss();
        }
    }

    _updateNotes() {
        this.sustainGraphics.clear();
        const approachTime = 1.6;

        for (const n of this.notes) {
            if (n.state === 'hit' || n.state === 'missed') {
                n.sprite.setVisible(false);
                continue;
            }

            const timeDiff = n.time - this.songTime;
            const z = this.currentHitZ - (timeDiff / approachTime) * this.currentHitZ;

            if (timeDiff < -0.22 && n.state === 'pending') {
                n.state = 'missed';
                n.sprite.setVisible(false);
                this.misses++;
                this.combo = 0;
                this.multiplier = 1;
                this.rockMeter = Math.max(0, this.rockMeter - 0.12);
                this._showRating('MISS', '#ff1744');
                SoundSynth.playMiss();
                continue;
            }

            if (z >= 0.0 && z <= 1.05) {
                const pt = this._getPerspectivePoint(n.lane, z);
                n.sprite.setPosition(pt.x, pt.y);
                n.sprite.setScale(pt.scale);
                n.sprite.setRotation(this.boardAngle);
                n.sprite.setVisible(true);

                if (n.duration > 0 && n.state !== 'missed') {
                    const tailDurationRemaining = n.state === 'holding' ? (n.duration - n.holdProgress) : n.duration;
                    const zTailEnd = z - (tailDurationRemaining / approachTime) * this.currentHitZ;

                    const pHead = pt;
                    const pTail = this._getPerspectivePoint(n.lane, Math.max(0, zTailEnd));

                    const col = LANE_COLORS[n.lane];
                    this.sustainGraphics.lineStyle(Math.max(3, pt.scale * 12), col, 0.85);
                    this.sustainGraphics.lineBetween(pHead.x, pHead.y, pTail.x, pTail.y);

                    this.sustainGraphics.lineStyle(Math.max(1.5, pt.scale * 4), 0xffffff, 0.95);
                    this.sustainGraphics.lineBetween(pHead.x, pHead.y, pTail.x, pTail.y);
                }
            } else {
                n.sprite.setVisible(false);
            }
        }
    }

    _spawnHitParticles(lane) {
        const pt = this._getPerspectivePoint(lane, this.currentHitZ);
        for (let i = 0; i < 6; i++) {
            const spark = this.add.image(pt.x, pt.y, 'sparks').setTint(LANE_COLORS[lane]);
            spark.setScale(0.8);
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            this.tweens.add({
                targets: spark,
                x: pt.x + Math.cos(angle) * dist,
                y: pt.y + Math.sin(angle) * dist,
                alpha: 0,
                scale: 0.1,
                duration: 250,
                onComplete: () => spark.destroy()
            });
        }
    }

    _spawnHoldSparks(lane) {
        const pt = this._getPerspectivePoint(lane, this.currentHitZ);
        const spark = this.add.image(
            pt.x + (Math.random() * 20 - 10),
            pt.y + (Math.random() * 20 - 10),
            'sparks'
        ).setTint(LANE_COLORS[lane]).setScale(0.5);

        this.tweens.add({
            targets: spark,
            y: spark.y - 25,
            alpha: 0,
            duration: 180,
            onComplete: () => spark.destroy()
        });
    }

    _showRating(text, color) {
        this.ratingText.setText(text);
        this.ratingText.setColor(color);
        this.ratingText.setAlpha(1);
        this.ratingText.setScale(1.4);

        this.tweens.add({
            targets: this.ratingText,
            scaleX: 1.0,
            scaleY: 1.0,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.easeOut'
        });
    }

    _updateHUD() {
        this.scoreText.setText(`SCORE: ${this.score}`);
        this.multiplierText.setText(`${this.multiplier}X`);
        this.multiplierText.setColor(this.multiplier === 4 ? '#ff1744' : '#ffea00');

        if (this.combo > 1) {
            this.comboText.setText(`COMBO ${this.combo}`);
        } else {
            this.comboText.setText('');
        }

        if (this.is1v1) {
            const r = MultiplayerManager.rivalStats;
            this.rivalScoreText.setText(`RIVAL: ${r.score}`);
            this.rivalComboText.setText(`COMBO: ${r.combo} (${r.multiplier}X)`);
        }

        this._renderRockMeter();
    }

    _renderRockMeter() {
        const w = this.scale.width;
        const g = this.rockMeterGraphics;
        g.clear();

        const mx = w - 45;
        const my = 120;
        const mH = 140;
        const mW = 20;

        g.fillStyle(0x000000, 0.8);
        g.fillRect(mx - 2, my - 2, mW + 4, mH + 4);
        g.lineStyle(2, 0xd4af37, 1);
        g.strokeRect(mx - 2, my - 2, mW + 4, mH + 4);

        g.fillStyle(0x220000);
        g.fillRect(mx, my + mH * 0.66, mW, mH * 0.34);
        g.fillStyle(0x222200);
        g.fillRect(mx, my + mH * 0.33, mW, mH * 0.33);
        g.fillStyle(0x002200);
        g.fillRect(mx, my, mW, mH * 0.33);

        const fillHeight = mH * this.rockMeter;
        let fillColor = 0x00e676;
        if (this.rockMeter < 0.33) fillColor = 0xff1744;
        else if (this.rockMeter < 0.66) fillColor = 0xffea00;

        g.fillStyle(fillColor, 1.0);
        g.fillRect(mx + 2, my + mH - fillHeight, mW - 4, fillHeight);
    }

    _render1v1Balance(w) {
        const g = this.rivalGraphics;
        g.clear();

        // Barra de balance de duelo Guitar Hero Face-Off (Tug-of-war)
        const barW = Math.min(w * 0.4, 280);
        const barH = 10;
        const bx = (w - barW) / 2;
        const by = 45;

        g.fillStyle(0x000000, 0.8);
        g.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

        // Lado TÚ (Verde) vs Lado RIVAL (Rojo)
        const total = Math.max(1, this.score + MultiplayerManager.rivalStats.score);
        const myRatio = this.score / total;

        g.fillStyle(0x00e676, 1);
        g.fillRect(bx, by, barW * myRatio, barH);

        g.fillStyle(0xff1744, 1);
        g.fillRect(bx + barW * myRatio, by, barW * (1 - myRatio), barH);

        // Indicador central
        g.fillStyle(0xffffff, 1);
        g.fillRect(bx + barW * myRatio - 2, by - 4, 4, barH + 8);
    }

    _endGame() {
        if (!this.isPlaying) return;
        this.isPlaying = false;

        if (this.customAudioSource) {
            try { this.customAudioSource.stop(); } catch (e) {}
        }

        const totalNotes = this.notesData.length;
        const accuracy = totalNotes > 0 ? Math.round((this.hits / totalNotes) * 100) : 0;
        const passed = accuracy >= 50 && this.rockMeter > 0.15;

        // Avisar fin al rival por P2P si es 1v1
        if (this.is1v1) {
            MultiplayerManager.send({
                type: 'game_over',
                finalScore: this.score,
                accuracy: accuracy
            });
        }

        const coinsEarned = Math.floor(this.score / 60) + (passed ? 30 : 5);
        playerData.coins += coinsEarned;
        playerData.totalScore += this.score;

        if (passed && this.level >= playerData.maxLevelReached && this.level < 5) {
            playerData.maxLevelReached = this.level + 1;
            playerData.currentLevel = this.level + 1;
        }
        saveUserData();

        if (passed) SoundSynth.playCheer();

        this.scene.start('ResultScene', {
            is1v1: this.is1v1,
            score: this.score,
            combo: this.maxCombo,
            hits: this.hits,
            misses: this.misses,
            totalNotes: totalNotes,
            accuracy: accuracy,
            passed: passed,
            coinsEarned: coinsEarned,
            level: this.level
        });
    }
}

// ----------------------------------------------------------------------------
// ESCENA: RESULTADOS (INDIVIDUAL & DUELO 1 VS 1)
// ----------------------------------------------------------------------------
class ResultScene extends Phaser.Scene {
    constructor() { super('ResultScene'); }

    init(data) { this.res = data; }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        const g = this.add.graphics();
        g.fillStyle(0x0a0914, 1);
        g.fillRect(0, 0, w, h);

        if (this.res.is1v1) {
            this._render1v1Results(w, h);
        } else {
            this._renderSingleResults(w, h);
        }
    }

    _render1v1Results(w, h) {
        const rivalScore = MultiplayerManager.rivalStats.score || MultiplayerManager.rivalStats.finalScore || 0;
        const myScore = this.res.score;

        const iWon = myScore > rivalScore;
        const isTie = myScore === rivalScore;

        const titleText = isTie ? '⚡ ¡EMPATE DE LEYENDAS! ⚡' : (iWon ? '👑 ¡VICTORIA! ¡ERES EL REY DEL ROCK!' : '💀 ¡DERROTA! EL RIVAL TE VENCIÓ');
        const titleColor = isTie ? '#ffea00' : (iWon ? '#00e676' : '#ff1744');

        this.add.text(w / 2, h * 0.12, titleText, {
            fontSize: `${Math.min(w * 0.055, 38)}px`,
            fontFamily: 'Impact, sans-serif',
            color: titleColor,
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // Comparativa Cara a Cara
        const colW = w * 0.35;
        const myX = w * 0.30;
        const rivalX = w * 0.70;

        // Tarjeta Tuya
        this.add.rectangle(myX, h * 0.42, colW, 200, 0x12101e).setStrokeStyle(3, 0x00e676);
        this.add.text(myX, h * 0.42 - 70, '🎸 TÚ', {
            fontSize: '22px', fontFamily: 'Impact, sans-serif', color: '#00e676'
        }).setOrigin(0.5);
        this.add.text(myX, h * 0.42 - 30, `SCORE: ${myScore}`, {
            fontSize: '20px', fontFamily: 'Impact, sans-serif', color: '#ffffff'
        }).setOrigin(0.5);
        this.add.text(myX, h * 0.42 + 5, `PRECISIÓN: ${this.res.accuracy}%`, {
            fontSize: '15px', fontFamily: 'Courier New, monospace', color: '#aaaaaa'
        }).setOrigin(0.5);
        this.add.text(myX, h * 0.42 + 35, `MAX COMBO: ${this.res.combo}`, {
            fontSize: '15px', fontFamily: 'Courier New, monospace', color: '#aaaaaa'
        }).setOrigin(0.5);

        // Tarjeta Rival
        this.add.rectangle(rivalX, h * 0.42, colW, 200, 0x12101e).setStrokeStyle(3, 0xff1744);
        this.add.text(rivalX, h * 0.42 - 70, '🔥 RIVAL', {
            fontSize: '22px', fontFamily: 'Impact, sans-serif', color: '#ff1744'
        }).setOrigin(0.5);
        this.add.text(rivalX, h * 0.42 - 30, `SCORE: ${rivalScore}`, {
            fontSize: '20px', fontFamily: 'Impact, sans-serif', color: '#ffffff'
        }).setOrigin(0.5);
        this.add.text(rivalX, h * 0.42 + 5, `ACERTADAS: ${MultiplayerManager.rivalStats.hits || 0}`, {
            fontSize: '15px', fontFamily: 'Courier New, monospace', color: '#aaaaaa'
        }).setOrigin(0.5);
        this.add.text(rivalX, h * 0.42 + 35, `FALLADAS: ${MultiplayerManager.rivalStats.misses || 0}`, {
            fontSize: '15px', fontFamily: 'Courier New, monospace', color: '#aaaaaa'
        }).setOrigin(0.5);

        // Botones
        const btnY = h * 0.78;
        this._createButton(w * 0.32, btnY, 'MENÚ PRINCIPAL', 0x333333, () => {
            MultiplayerManager.cleanup();
            this.scene.start('MenuScene');
        });

        this._createButton(w * 0.68, btnY, '🔄 REVANCHA', 0xffea00, () => {
            MultiplayerManager.send({ type: 'rematch_req' });
            this.scene.start('GameScene', { mode: '1v1', isHost: MultiplayerManager.isHost, level: this.res.level });
        });
    }

    _renderSingleResults(w, h) {
        const titleText = this.res.passed ? '¡CONCIERTO LEGENDARIO!' : '¡ABUCHEO EN EL ESCENARIO!';
        const titleColor = this.res.passed ? '#00e676' : '#ff1744';

        this.add.text(w / 2, h * 0.12, titleText, {
            fontSize: `${Math.min(w * 0.06, 44)}px`,
            fontFamily: 'Impact, sans-serif',
            color: titleColor,
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        const stars = this.res.accuracy >= 95 ? '★★★★★' : this.res.accuracy >= 80 ? '★★★★☆' : this.res.accuracy >= 65 ? '★★★☆☆' : '★★☆☆☆';
        this.add.text(w / 2, h * 0.22, stars, {
            fontSize: '52px', fontFamily: 'Impact, sans-serif',
            color: '#ffea00', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        const stats = [
            `PUNTUACIÓN FINAL: ${this.res.score}`,
            `MÁXIMO COMBO: ${this.res.combo}`,
            `NOTAS ACERTADAS: ${this.res.hits} / ${this.res.totalNotes}`,
            `NOTAS FALLADAS: ${this.res.misses}`,
            `PRECISIÓN: ${this.res.accuracy}%`,
            `MONEDAS GANADAS: +${this.res.coinsEarned} ¢`,
            `TOTAL DE MONEDAS: ${playerData.coins} ¢`
        ];

        stats.forEach((s, idx) => {
            this.add.text(w / 2, h * 0.32 + idx * 30, s, {
                fontSize: `${Math.min(w * 0.024, 16)}px`,
                fontFamily: 'Courier New, monospace',
                color: '#ffffff'
            }).setOrigin(0.5);
        });

        const btnY = h * 0.75;
        this._createButton(w * 0.32, btnY, 'MENÚ PRINCIPAL', 0x333333, () => {
            this.scene.start('MenuScene');
        });

        if (this.res.passed) {
            this._createButton(w * 0.68, btnY, 'TIENDA & MEJORAS', 0xffea00, () => {
                this.scene.start('ShopScene');
            });
        } else {
            this._createButton(w * 0.68, btnY, 'REINTENTAR', 0xff1744, () => {
                this.scene.start('GameScene', { mode: 'default', level: this.res.level });
            });
        }
    }

    _createButton(x, y, text, color, cb) {
        const bg = this.add.rectangle(x, y, 220, 46, 0x1e1e1e).setStrokeStyle(3, color);
        const txt = this.add.text(x, y, text, {
            fontSize: '15px', fontFamily: 'Impact, sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(color); txt.setColor('#000000'); SoundSynth.playHiHat(); });
        bg.on('pointerout', () => { bg.setFillStyle(0x1e1e1e); txt.setColor('#ffffff'); });
        bg.on('pointerdown', () => { SoundSynth.playKick(); cb(); });
    }
}

// ----------------------------------------------------------------------------
// ESCENA: TIENDA & PERSONALIZACIÓN
// ----------------------------------------------------------------------------
class ShopScene extends Phaser.Scene {
    constructor() { super('ShopScene'); }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        this.add.text(w / 2, 35, 'TIENDA ROCK: PERSONALIZACIÓN', {
            fontSize: `${Math.min(w * 0.05, 34)}px`,
            fontFamily: 'Impact, sans-serif',
            color: '#ffea00', stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5);

        this.coinsText = this.add.text(w / 2, 70, `TUS MONEDAS: ${playerData.coins} ¢`, {
            fontSize: '18px', fontFamily: 'Courier New, monospace', color: '#00e676'
        }).setOrigin(0.5);

        this._updatePreview();

        this._createSection('COLOR DE BATERÍA', h * 0.22, [
            { col: 0x886644, name: 'Madera', price: 0, prop: 'drumColor', list: 'unlockedDrums' },
            { col: 0xcc2222, name: 'Rojo Fuego', price: 40, prop: 'drumColor', list: 'unlockedDrums' },
            { col: 0x2244cc, name: 'Azul Rayo', price: 40, prop: 'drumColor', list: 'unlockedDrums' },
            { col: 0x22cc22, name: 'Verde Tóxico', price: 50, prop: 'drumColor', list: 'unlockedDrums' },
            { col: 0xffea00, name: 'Oro Real', price: 100, prop: 'drumColor', list: 'unlockedDrums' }
        ]);

        this._createSection('COLOR DE BAQUETAS', h * 0.42, [
            { col: 0xddcc88, name: 'Roble', price: 0, prop: 'stickColor', list: 'unlockedSticks' },
            { col: 0xffea00, name: 'Láser Amarillo', price: 30, prop: 'stickColor', list: 'unlockedSticks' },
            { col: 0x00e676, name: 'Neón Verde', price: 40, prop: 'stickColor', list: 'unlockedSticks' },
            { col: 0xff1744, name: 'Rubí Carmesí', price: 60, prop: 'stickColor', list: 'unlockedSticks' }
        ]);

        this._createSection('ROPA DEL BATERISTA', h * 0.62, [
            { col: 0x111111, name: 'Cuero Negro', price: 0, prop: 'outfitColor', list: 'unlockedOutfits' },
            { col: 0x2244cc, name: 'Chaleco Mezclilla', price: 35, prop: 'outfitColor', list: 'unlockedOutfits' },
            { col: 0xff1744, name: 'Rocker Sangre', price: 50, prop: 'outfitColor', list: 'unlockedOutfits' },
            { col: 0xffea00, name: 'Chaqueta Dorada', price: 90, prop: 'outfitColor', list: 'unlockedOutfits' }
        ]);

        const backBtn = this.add.rectangle(w / 2, h - 45, 200, 40, 0x1e1e1e).setStrokeStyle(3, 0xff1744);
        const backTxt = this.add.text(w / 2, h - 45, 'VOLVER AL MENÚ', {
            fontSize: '15px', fontFamily: 'Impact, sans-serif', color: '#ffffff'
        }).setOrigin(0.5);

        backBtn.setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    _createSection(title, startY, items) {
        const w = this.scale.width;
        this.add.text(w * 0.12, startY, title, {
            fontSize: '14px', fontFamily: 'Impact, sans-serif', color: '#ffea00'
        });

        items.forEach((item, idx) => {
            const x = w * 0.12 + idx * 85 + 30;
            const y = startY + 45;

            const isUnlocked = playerData[item.list].includes(item.col);
            const isEquipped = playerData[item.prop] === item.col;

            const box = this.add.rectangle(x, y, 40, 40, item.col)
                .setStrokeStyle(3, isEquipped ? 0x00e676 : (isUnlocked ? 0xffffff : 0x555555))
                .setInteractive({ useHandCursor: true });

            const statusText = isEquipped ? '✓ EQUIP' : isUnlocked ? 'USAR' : `${item.price}¢`;
            this.add.text(x, y + 30, statusText, {
                fontSize: '10px', fontFamily: 'Courier New, monospace',
                color: isEquipped ? '#00e676' : isUnlocked ? '#ffffff' : '#ffea00'
            }).setOrigin(0.5);

            box.on('pointerdown', () => {
                if (isEquipped) return;
                if (isUnlocked) {
                    playerData[item.prop] = item.col;
                    saveUserData();
                    this._refreshTextures();
                    this.scene.restart();
                } else if (playerData.coins >= item.price) {
                    playerData.coins -= item.price;
                    playerData[item.list].push(item.col);
                    playerData[item.prop] = item.col;
                    saveUserData();
                    this._refreshTextures();
                    SoundSynth.playCheer();
                    this.scene.restart();
                } else {
                    SoundSynth.playMiss();
                    alert('¡No tienes suficientes monedas para desbloquear este artículo!');
                }
            });
        });
    }

    _refreshTextures() {
        PixelFactory.createDrummerTexture(
            this, 'drummer-base',
            playerData.outfitColor, playerData.skinColor,
            playerData.drumColor, playerData.stickColor
        );
    }

    _updatePreview() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.add.image(w * 0.82, h * 0.48, 'drummer-base').setScale(1.8);
        this.add.text(w * 0.82, h * 0.32, 'VISTA PREVIA', {
            fontSize: '14px', fontFamily: 'Impact, sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);
    }
}

// ----------------------------------------------------------------------------
// INICIALIZACIÓN Y CONFIGURACIÓN PHASER
// ----------------------------------------------------------------------------
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-container',
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    pixelArt: true,
    roundPixels: true,
    scene: [BootScene, MenuScene, GameScene, ResultScene, ShopScene]
};

const game = new Phaser.Game(config);
