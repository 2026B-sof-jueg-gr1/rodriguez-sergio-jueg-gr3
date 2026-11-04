// ============================================================
// PIXEL DRUMS - 8-Bit Rhythm Game (Phaser 3)
// ============================================================
// Controles: Q, W, E, R para los 4 carriles de la batería
// Mecánica: Las notas caen por 4 carriles y el jugador debe
//           presionar la tecla correcta en la zona de acierto.
// ============================================================

// --------------- DATOS GLOBALES DEL JUEGO ---------------
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const LANE_COUNT = 4;
const LANE_KEYS = ['Q', 'W', 'E', 'R'];
const LANE_COLORS = [0xff4444, 0x44bbff, 0x44ff44, 0xffcc00];
const LANE_LABELS = ['Hi-Hat', 'Snare', 'Tom', 'Kick'];
const HIT_ZONE_Y = 530;
const NOTE_SPEED_BASE = 200;

// Estado persistente del jugador (entre escenas)
let playerData = {
    coins: 0,
    totalScore: 0,
    currentLevel: 1,
    maxLevelReached: 1,
    // Personalización
    drumColor: 0x886644,
    stickColor: 0xddcc88,
    outfitColor: 0x4444ff,
    skinColor: 0xffcc99,
    // Desbloqueables
    unlockedDrumColors: [0x886644],
    unlockedStickColors: [0xddcc88],
    unlockedOutfitColors: [0x4444ff],
    // Audio subido por el usuario
    uploadedAudioBuffer: null,
    uploadedAudioName: null
};

// ============================================================
// UTILIDADES PARA GENERAR TEXTURAS PIXEL ART
// ============================================================
class PixelArt {
    // Crea una textura pixel art para una nota de batería
    static createNoteTexture(scene, key, color) {
        const g = scene.make.graphics({ add: false });
        // Nota cuadrada 8-bit (28x28 con borde)
        g.fillStyle(0x000000);
        g.fillRect(0, 0, 28, 28);
        g.fillStyle(color);
        g.fillRect(2, 2, 24, 24);
        // Brillo pixel art
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(4, 4, 8, 4);
        g.fillRect(4, 4, 4, 8);
        g.generateTexture(key, 28, 28);
        g.destroy();
    }

    // Textura de la zona de acierto (rectángulo con borde brillante)
    static createHitZoneTexture(scene, key, color) {
        const g = scene.make.graphics({ add: false });
        g.fillStyle(color, 0.3);
        g.fillRect(0, 0, 80, 20);
        g.lineStyle(2, color, 1);
        g.strokeRect(0, 0, 80, 20);
        g.generateTexture(key, 80, 20);
        g.destroy();
    }

    // Efecto de acierto (explosión pixel art)
    static createHitEffect(scene, key) {
        const g = scene.make.graphics({ add: false });
        g.fillStyle(0xffffff);
        g.fillRect(12, 0, 8, 4);
        g.fillRect(0, 12, 4, 8);
        g.fillRect(28, 12, 4, 8);
        g.fillRect(12, 28, 8, 4);
        g.fillRect(4, 4, 4, 4);
        g.fillRect(24, 4, 4, 4);
        g.fillRect(4, 24, 4, 4);
        g.fillRect(24, 24, 4, 4);
        g.generateTexture(key, 32, 32);
        g.destroy();
    }

    // Baterista pixel art
    static createDrummer(scene, key, outfitColor, skinColor, drumColor, stickColor) {
        const g = scene.make.graphics({ add: false });
        const w = 120, h = 100;

        // Bombo (drum grande al centro)
        g.fillStyle(drumColor);
        g.fillRect(35, 55, 50, 35);
        g.fillStyle(0x000000);
        g.fillRect(35, 55, 50, 2);
        g.fillRect(35, 88, 50, 2);
        // Parche del bombo
        g.fillStyle(0xeeeecc);
        g.fillRect(45, 62, 30, 22);

        // Toms laterales
        g.fillStyle(drumColor);
        g.fillRect(10, 48, 30, 18);
        g.fillRect(80, 48, 30, 18);
        // Parches
        g.fillStyle(0xeeeecc);
        g.fillRect(14, 50, 22, 8);
        g.fillRect(84, 50, 22, 8);

        // Hi-hat (platillo izquierda)
        g.fillStyle(0xccaa44);
        g.fillRect(2, 38, 26, 4);
        g.fillStyle(0x666644);
        g.fillRect(14, 42, 2, 20);

        // Cuerpo del baterista
        g.fillStyle(outfitColor);
        g.fillRect(48, 28, 24, 26);

        // Cabeza
        g.fillStyle(skinColor);
        g.fillRect(52, 10, 16, 16);
        // Ojos
        g.fillStyle(0x000000);
        g.fillRect(55, 16, 3, 3);
        g.fillRect(62, 16, 3, 3);
        // Boca
        g.fillRect(57, 22, 6, 2);

        // Pelo/Gorro
        g.fillStyle(0x333333);
        g.fillRect(52, 8, 16, 4);

        // Brazos
        g.fillStyle(skinColor);
        g.fillRect(40, 30, 8, 4);
        g.fillRect(72, 30, 8, 4);

        // Baquetas
        g.fillStyle(stickColor);
        g.fillRect(30, 28, 12, 3);
        g.fillRect(78, 28, 12, 3);

        g.generateTexture(key, w, h);
        g.destroy();
    }

    // Botón pixel art
    static createButton(scene, key, width, height, color) {
        const g = scene.make.graphics({ add: false });
        g.fillStyle(0x000000);
        g.fillRect(0, 0, width, height);
        g.fillStyle(color);
        g.fillRect(2, 2, width - 4, height - 4);
        // Borde superior iluminado
        g.fillStyle(0xffffff, 0.2);
        g.fillRect(2, 2, width - 4, 3);
        g.generateTexture(key, width, height);
        g.destroy();
    }

    // Fondo con patrón pixel art
    static createBackground(scene, key) {
        const g = scene.make.graphics({ add: false });
        // Fondo degradado oscuro
        for (let y = 0; y < GAME_HEIGHT; y += 4) {
            const shade = Math.floor(0x15 + (y / GAME_HEIGHT) * 0x10);
            g.fillStyle((shade << 16) | (shade << 8) | (shade + 0x10));
            g.fillRect(0, y, GAME_WIDTH, 4);
        }
        // Patrón de puntos pixel art
        g.fillStyle(0xffffff, 0.03);
        for (let x = 0; x < GAME_WIDTH; x += 16) {
            for (let y = 0; y < GAME_HEIGHT; y += 16) {
                g.fillRect(x, y, 2, 2);
            }
        }
        g.generateTexture(key, GAME_WIDTH, GAME_HEIGHT);
        g.destroy();
    }

    // Fondo de escenario para la escena de juego
    static createStageBackground(scene, key) {
        const g = scene.make.graphics({ add: false });
        // Fondo oscuro
        g.fillStyle(0x111122);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Escenario / tarima
        g.fillStyle(0x332211);
        g.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);
        g.fillStyle(0x443322);
        g.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 4);

        // Luces del escenario
        const spotColors = [0xff4444, 0x44bbff, 0x44ff44, 0xffcc00];
        for (let i = 0; i < 4; i++) {
            g.fillStyle(spotColors[i], 0.08);
            const cx = 140 + i * 170;
            for (let r = 60; r > 0; r -= 4) {
                g.fillCircle(cx, 0, r);
            }
        }

        g.generateTexture(key, GAME_WIDTH, GAME_HEIGHT);
        g.destroy();
    }
}

// ============================================================
// ANÁLISIS DE AUDIO (Web Audio API) - Generador de niveles
// ============================================================
class AudioAnalyzer {
    /**
     * Analiza un AudioBuffer y extrae picos (beats) que se mapean a notas.
     * Retorna un array de { time: seconds, lane: 0-3 }
     */
    static analyzeBeatMap(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;

        // Tamaño de ventana para análisis de energía (~50ms)
        const windowSize = Math.floor(sampleRate * 0.05);
        const hopSize = Math.floor(windowSize / 2);

        // Calcular energía RMS por ventana
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

        // Detectar picos: energía local mayor que el promedio móvil * umbral
        const beats = [];
        const avgWindow = 20; // ventanas para promedio local
        const threshold = 1.4;
        const minBeatGap = 0.15; // segundos mínimos entre beats

        let lastBeatTime = -1;

        for (let i = avgWindow; i < energies.length - avgWindow; i++) {
            // Promedio local
            let localAvg = 0;
            for (let j = i - avgWindow; j < i + avgWindow; j++) {
                localAvg += energies[j].energy;
            }
            localAvg /= (avgWindow * 2);

            const current = energies[i].energy;
            const time = energies[i].time;

            if (current > localAvg * threshold && (time - lastBeatTime) > minBeatGap) {
                // Asignar carril basado en la frecuencia dominante en esa ventana
                const lane = AudioAnalyzer._getLaneFromFrequency(
                    channelData, Math.floor(time * sampleRate), windowSize, sampleRate
                );
                beats.push({ time: time, lane: lane });
                lastBeatTime = time;
            }
        }

        return beats;
    }

    /**
     * Analiza la frecuencia dominante en una ventana y la mapea a un carril.
     * Frecuencias bajas -> carriles derechos (kick), altas -> izquierdos (hi-hat)
     */
    static _getLaneFromFrequency(channelData, startSample, windowSize, sampleRate) {
        // DFT simplificada para 4 bandas de frecuencia
        const bands = [0, 0, 0, 0];
        const n = Math.min(windowSize, 512);

        // Banda 0: Frecuencias altas (hi-hat) ~4000-8000 Hz
        // Banda 1: Frecuencias medio-altas (snare) ~1000-4000 Hz
        // Banda 2: Frecuencias medias (tom) ~200-1000 Hz
        // Banda 3: Frecuencias bajas (kick) ~20-200 Hz
        const freqRanges = [
            [4000, 8000],
            [1000, 4000],
            [200, 1000],
            [20, 200]
        ];

        for (let b = 0; b < 4; b++) {
            const [fLow, fHigh] = freqRanges[b];
            const kLow = Math.floor(fLow * n / sampleRate);
            const kHigh = Math.min(Math.ceil(fHigh * n / sampleRate), n / 2);

            for (let k = kLow; k <= kHigh; k++) {
                let real = 0, imag = 0;
                for (let i = 0; i < n; i++) {
                    const idx = startSample + i;
                    if (idx < channelData.length) {
                        const angle = -2 * Math.PI * k * i / n;
                        real += channelData[idx] * Math.cos(angle);
                        imag += channelData[idx] * Math.sin(angle);
                    }
                }
                bands[b] += Math.sqrt(real * real + imag * imag);
            }
        }

        // Retornar la banda con mayor energía
        let maxBand = 0;
        for (let b = 1; b < 4; b++) {
            if (bands[b] > bands[maxBand]) maxBand = b;
        }
        return maxBand;
    }

    /**
     * Genera un mapa de beats predeterminado para los niveles integrados.
     * Retorna array de { time, lane } según el nivel y dificultad.
     */
    static generateDefaultBeatMap(level, durationSec) {
        const beats = [];
        // BPM base que aumenta con el nivel
        const bpm = 90 + (level - 1) * 15;
        const beatInterval = 60 / bpm;

        // Patrones de batería predefinidos por nivel
        const patterns = AudioAnalyzer._getDrumPattern(level);
        const patternLen = patterns.length;

        let time = 2.0; // Empezar 2 segundos después
        let patIdx = 0;

        while (time < durationSec - 1) {
            const lanes = patterns[patIdx % patternLen];
            for (const lane of lanes) {
                beats.push({ time: time, lane: lane });
            }
            time += beatInterval;
            patIdx++;
        }

        return beats;
    }

    /** Patrones rítmicos que se vuelven más complejos por nivel */
    static _getDrumPattern(level) {
        const patterns = {
            1: [ // Ritmo básico rock
                [3], [], [1], [],
                [3, 0], [], [1], [],
            ],
            2: [ // Ritmo con toms
                [3], [0], [1], [0],
                [3, 2], [0], [1, 2], [0],
            ],
            3: [ // Ritmo funk
                [3, 0], [], [1], [0],
                [3], [0], [1, 0], [2],
            ],
            4: [ // Ritmo complejo
                [3, 0], [2], [1, 0], [],
                [3], [0, 2], [1], [0, 3],
            ],
            5: [ // Ritmo avanzado
                [3, 0], [2], [1, 0], [2],
                [3, 0], [1, 2], [0, 1], [3, 0],
            ]
        };
        const lvl = Math.min(level, 5);
        return patterns[lvl] || patterns[1];
    }
}

// ============================================================
// ESCENA: MENÚ PRINCIPAL
// ============================================================
class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        // Generar todas las texturas pixel art
        PixelArt.createBackground(this, 'menu-bg');
        PixelArt.createButton(this, 'btn-large', 260, 50, 0x4466aa);
        PixelArt.createButton(this, 'btn-medium', 200, 40, 0x44aa66);
        PixelArt.createButton(this, 'btn-small', 160, 36, 0xaa6644);

        PixelArt.createDrummer(
            this, 'drummer-preview',
            playerData.outfitColor, playerData.skinColor,
            playerData.drumColor, playerData.stickColor
        );
    }

    create() {
        this.add.image(400, 300, 'menu-bg');

        // Título
        this.add.text(400, 60, 'PIXEL DRUMS', {
            fontSize: '48px',
            fontFamily: 'Courier New, monospace',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(400, 100, '8-BIT RHYTHM GAME', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#88aacc'
        }).setOrigin(0.5);

        // Baterista animado
        this.drummer = this.add.image(400, 200, 'drummer-preview').setScale(1.5);
        this.tweens.add({
            targets: this.drummer,
            y: 205,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Info del jugador
        this.add.text(400, 280, `Monedas: ${playerData.coins}  |  Nivel: ${playerData.currentLevel}`, {
            fontSize: '14px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc'
        }).setOrigin(0.5);

        // Botón JUGAR
        this._createButton(400, 340, 'btn-large', `JUGAR NIVEL ${playerData.currentLevel}`, () => {
            this.scene.start('GameScene', { mode: 'default', level: playerData.currentLevel });
        });

        // Botón SUBIR AUDIO
        this._createButton(400, 400, 'btn-large', 'SUBIR AUDIO (MP3/WAV)', () => {
            this._handleAudioUpload();
        });

        // Botón TIENDA
        this._createButton(400, 460, 'btn-medium', 'TIENDA', () => {
            this.scene.start('ShopScene');
        });

        // Indicador de audio cargado
        if (playerData.uploadedAudioName) {
            this.add.text(400, 440, `Audio: ${playerData.uploadedAudioName}`, {
                fontSize: '11px',
                fontFamily: 'Courier New, monospace',
                color: '#66ff66'
            }).setOrigin(0.5);
        }

        // Instrucciones
        this.add.text(400, 540, 'Controles: Q  W  E  R', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff'
        }).setOrigin(0.5);

        const labels = ['Hi-Hat', 'Snare', 'Tom', 'Kick'];
        const colors = ['#ff4444', '#44bbff', '#44ff44', '#ffcc00'];
        for (let i = 0; i < 4; i++) {
            this.add.text(260 + i * 80, 568, `${LANE_KEYS[i]}:${labels[i]}`, {
                fontSize: '10px',
                fontFamily: 'Courier New, monospace',
                color: colors[i]
            }).setOrigin(0.5);
        }
    }

    _createButton(x, y, textureKey, label, callback) {
        const btn = this.add.image(x, y, textureKey).setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, label, {
            fontSize: '14px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff'
        }).setOrigin(0.5);

        btn.on('pointerover', () => {
            btn.setTint(0xcccccc);
            txt.setColor('#ffcc00');
        });
        btn.on('pointerout', () => {
            btn.clearTint();
            txt.setColor('#ffffff');
        });
        btn.on('pointerdown', callback);
    }

    _handleAudioUpload() {
        const fileInput = document.getElementById('audio-upload');
        fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                audioContext.decodeAudioData(event.target.result, (buffer) => {
                    playerData.uploadedAudioBuffer = buffer;
                    playerData.uploadedAudioName = file.name;

                    // Iniciar juego con audio personalizado
                    this.scene.start('GameScene', { mode: 'custom-audio', level: playerData.currentLevel });
                }, (err) => {
                    console.error('Error decodificando audio:', err);
                    alert('No se pudo decodificar el archivo de audio. Prueba con otro formato.');
                });
            };
            reader.readAsArrayBuffer(file);
            // Resetear input para poder subir el mismo archivo de nuevo
            fileInput.value = '';
        };
    }
}

// ============================================================
// ESCENA: JUEGO PRINCIPAL (GAMEPLAY)
// ============================================================
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.gameMode = data.mode || 'default';
        this.level = data.level || 1;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.misses = 0;
        this.totalNotes = 0;
        this.noteSpeed = NOTE_SPEED_BASE + (this.level - 1) * 30;
        this.beatMap = [];
        this.beatIndex = 0;
        this.gameStartTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.gameDuration = 0;
        this.audioSource = null;
        this.audioContext = null;
    }

    preload() {
        // Texturas de notas para cada carril
        for (let i = 0; i < LANE_COUNT; i++) {
            PixelArt.createNoteTexture(this, `note-${i}`, LANE_COLORS[i]);
            PixelArt.createHitZoneTexture(this, `hitzone-${i}`, LANE_COLORS[i]);
        }
        PixelArt.createHitEffect(this, 'hit-effect');
        PixelArt.createStageBackground(this, 'stage-bg');
        PixelArt.createDrummer(
            this, 'drummer-game',
            playerData.outfitColor, playerData.skinColor,
            playerData.drumColor, playerData.stickColor
        );
    }

    create() {
        // Fondo
        this.add.image(400, 300, 'stage-bg');

        // ---- Configurar teclas Q, W, E, R ----
        this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.laneKeys = [this.keyQ, this.keyW, this.keyE, this.keyR];

        // Tecla ESC para pausar
        this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // ---- Layout de carriles ----
        // Carriles centrados con separación
        this.laneWidth = 80;
        this.laneGap = 10;
        this.totalLanesWidth = LANE_COUNT * this.laneWidth + (LANE_COUNT - 1) * this.laneGap;
        this.lanesStartX = (GAME_WIDTH - this.totalLanesWidth) / 2;

        this._drawLanes();
        this._createHitZones();

        // ---- Grupo de física para las notas ----
        this.notesGroup = this.physics.add.group();

        // ---- Baterista ----
        this.drummer = this.add.image(660, 480, 'drummer-game').setScale(1.2);

        // ---- UI: Score, Combo, etc. ----
        this._createUI();

        // ---- Generar o cargar beatmap ----
        this._setupBeatMap();

        // ---- Iniciar juego con cuenta regresiva ----
        this._startCountdown();
    }

    _getLaneX(laneIndex) {
        return this.lanesStartX + laneIndex * (this.laneWidth + this.laneGap) + this.laneWidth / 2;
    }

    _drawLanes() {
        const g = this.add.graphics();
        for (let i = 0; i < LANE_COUNT; i++) {
            const x = this.lanesStartX + i * (this.laneWidth + this.laneGap);
            // Fondo del carril (semitransparente)
            g.fillStyle(LANE_COLORS[i], 0.08);
            g.fillRect(x, 0, this.laneWidth, GAME_HEIGHT);
            // Bordes del carril
            g.lineStyle(1, LANE_COLORS[i], 0.3);
            g.strokeRect(x, 0, this.laneWidth, GAME_HEIGHT);
        }

        // Línea de acierto
        g.lineStyle(3, 0xffffff, 0.6);
        g.lineBetween(this.lanesStartX - 5, HIT_ZONE_Y, this.lanesStartX + this.totalLanesWidth + 5, HIT_ZONE_Y);
        g.lineStyle(1, 0xffffff, 0.2);
        g.lineBetween(this.lanesStartX - 5, HIT_ZONE_Y + 20, this.lanesStartX + this.totalLanesWidth + 5, HIT_ZONE_Y + 20);
        g.lineBetween(this.lanesStartX - 5, HIT_ZONE_Y - 20, this.lanesStartX + this.totalLanesWidth + 5, HIT_ZONE_Y - 20);

        // Etiquetas de teclas debajo de la hit zone
        for (let i = 0; i < LANE_COUNT; i++) {
            this.add.text(this._getLaneX(i), HIT_ZONE_Y + 40, LANE_KEYS[i], {
                fontSize: '24px',
                fontFamily: 'Courier New, monospace',
                color: '#' + LANE_COLORS[i].toString(16).padStart(6, '0'),
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
        }
    }

    _createHitZones() {
        // Zonas de acierto como sensores de física
        this.hitZones = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            const zone = this.physics.add.staticImage(this._getLaneX(i), HIT_ZONE_Y, `hitzone-${i}`);
            zone.setData('lane', i);
            zone.refreshBody();
            this.hitZones.push(zone);
        }

        // Indicadores visuales de presión de tecla
        this.keyIndicators = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            const indicator = this.add.rectangle(
                this._getLaneX(i), HIT_ZONE_Y, this.laneWidth - 4, 20,
                LANE_COLORS[i], 0
            );
            this.keyIndicators.push(indicator);
        }
    }

    _createUI() {
        // Panel de puntuación (lado derecho)
        const panelX = 700;

        this.add.text(panelX, 20, 'SCORE', {
            fontSize: '12px', fontFamily: 'Courier New, monospace', color: '#888888'
        }).setOrigin(0.5);

        this.scoreText = this.add.text(panelX, 40, '0', {
            fontSize: '24px', fontFamily: 'Courier New, monospace', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(panelX, 75, 'COMBO', {
            fontSize: '12px', fontFamily: 'Courier New, monospace', color: '#888888'
        }).setOrigin(0.5);

        this.comboText = this.add.text(panelX, 95, '0', {
            fontSize: '20px', fontFamily: 'Courier New, monospace', color: '#ffcc00',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // Nivel
        this.add.text(panelX, 130, `LVL ${this.level}`, {
            fontSize: '14px', fontFamily: 'Courier New, monospace', color: '#66aaff'
        }).setOrigin(0.5);

        // Barra de progreso
        this.progressBg = this.add.rectangle(panelX, 160, 80, 8, 0x333333);
        this.progressBar = this.add.rectangle(panelX - 40, 160, 0, 8, 0x44ff44).setOrigin(0, 0.5);

        // Feedback de acierto
        this.feedbackText = this.add.text(400, 280, '', {
            fontSize: '28px', fontFamily: 'Courier New, monospace', color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0);

        // Texto central (para countdown y mensajes)
        this.centerText = this.add.text(400, 250, '', {
            fontSize: '64px', fontFamily: 'Courier New, monospace', color: '#ffcc00',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);
    }

    _setupBeatMap() {
        if (this.gameMode === 'custom-audio' && playerData.uploadedAudioBuffer) {
            // Analizar audio subido
            this.beatMap = AudioAnalyzer.analyzeBeatMap(playerData.uploadedAudioBuffer);
            this.gameDuration = playerData.uploadedAudioBuffer.duration;
        } else {
            // Generar beatmap predeterminado (30-60 seg según nivel)
            this.gameDuration = 30 + (this.level - 1) * 5;
            this.beatMap = AudioAnalyzer.generateDefaultBeatMap(this.level, this.gameDuration);
        }
        this.totalNotes = this.beatMap.length;
    }

    _startCountdown() {
        let count = 3;
        this.centerText.setText(count.toString());

        this.time.addEvent({
            delay: 800,
            repeat: 2,
            callback: () => {
                count--;
                if (count > 0) {
                    this.centerText.setText(count.toString());
                    // Efecto de escala
                    this.tweens.add({
                        targets: this.centerText,
                        scaleX: 1.3, scaleY: 1.3,
                        duration: 200,
                        yoyo: true
                    });
                } else {
                    this.centerText.setText('GO!');
                    this.tweens.add({
                        targets: this.centerText,
                        alpha: 0,
                        duration: 500,
                        delay: 300
                    });
                    this._startPlaying();
                }
            }
        });
    }

    _startPlaying() {
        this.isPlaying = true;
        this.gameStartTime = this.time.now;
        this.beatIndex = 0;

        // Reproducir audio si es modo custom
        if (this.gameMode === 'custom-audio' && playerData.uploadedAudioBuffer) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = playerData.uploadedAudioBuffer;
            this.audioSource.connect(this.audioContext.destination);
            this.audioSource.start(0);

            this.audioSource.onended = () => {
                if (this.isPlaying) {
                    this.time.delayedCall(1500, () => this._endGame());
                }
            };
        }
    }

    update(time, delta) {
        if (!this.isPlaying || this.isPaused) return;

        const elapsed = (time - this.gameStartTime) / 1000;

        // ---- Generar notas según el beatmap ----
        // Las notas se generan con anticipación para que caigan a tiempo
        const fallTime = (HIT_ZONE_Y / this.noteSpeed); // Tiempo que tarda en caer

        while (this.beatIndex < this.beatMap.length) {
            const beat = this.beatMap[this.beatIndex];
            if (beat.time <= elapsed + fallTime) {
                this._spawnNote(beat.lane);
                this.beatIndex++;
            } else {
                break;
            }
        }

        // ---- Detectar pulsaciones de teclas ----
        for (let i = 0; i < LANE_COUNT; i++) {
            if (Phaser.Input.Keyboard.JustDown(this.laneKeys[i])) {
                this._onKeyPress(i);
            }
            // Indicador visual de tecla presionada
            this.keyIndicators[i].fillAlpha = this.laneKeys[i].isDown ? 0.5 : 0;
        }

        // ---- Verificar notas que pasaron la zona de acierto (miss) ----
        this.notesGroup.getChildren().forEach(note => {
            if (note.active && note.y > HIT_ZONE_Y + 60) {
                this._onMiss(note);
            }
        });

        // ---- Actualizar progreso ----
        const progress = Math.min(elapsed / this.gameDuration, 1);
        this.progressBar.width = 80 * progress;

        // ---- Fin del juego (modo default) ----
        if (this.gameMode === 'default' && elapsed >= this.gameDuration + 2) {
            this._endGame();
        }
        // Fin para custom audio si todas las notas ya pasaron
        if (this.gameMode === 'custom-audio' && this.beatIndex >= this.beatMap.length) {
            const remaining = this.notesGroup.getChildren().filter(n => n.active);
            if (remaining.length === 0) {
                this.time.delayedCall(1500, () => this._endGame());
                this.isPlaying = false; // Evitar múltiples llamadas
            }
        }

        // ---- Pausa ----
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this._togglePause();
        }
    }

    _spawnNote(lane) {
        const x = this._getLaneX(lane);
        const note = this.notesGroup.create(x, -20, `note-${lane}`);
        note.setData('lane', lane);
        note.setData('scored', false);
        note.setVelocityY(this.noteSpeed);
        note.setGravityY(0);
        // Hacer que la nota no sea afectada por la gravedad general
        note.body.allowGravity = false;
    }

    _onKeyPress(lane) {
        // Buscar la nota más cercana en este carril dentro de la zona de acierto
        let closestNote = null;
        let closestDist = Infinity;

        this.notesGroup.getChildren().forEach(note => {
            if (note.active && note.getData('lane') === lane && !note.getData('scored')) {
                const dist = Math.abs(note.y - HIT_ZONE_Y);
                if (dist < closestDist && dist < 50) { // 50px de tolerancia
                    closestDist = dist;
                    closestNote = note;
                }
            }
        });

        if (closestNote) {
            closestNote.setData('scored', true);
            this._onHit(closestNote, closestDist);
        } else {
            // Presionó tecla sin nota cercana: penalización leve
            this.combo = 0;
            this.comboText.setText('0');
        }

        // Animar el baterista
        this._animateDrummerHit(lane);
    }

    _onHit(note, distance) {
        // Evaluar precisión
        let rating, points, color;
        if (distance < 10) {
            rating = 'PERFECT!';
            points = 100;
            color = '#ffcc00';
        } else if (distance < 25) {
            rating = 'GREAT!';
            points = 75;
            color = '#44ff44';
        } else if (distance < 40) {
            rating = 'GOOD';
            points = 50;
            color = '#44bbff';
        } else {
            rating = 'OK';
            points = 25;
            color = '#aaaaaa';
        }

        // Multiplicador por combo
        const multiplier = 1 + Math.floor(this.combo / 10) * 0.5;
        points = Math.floor(points * multiplier);

        this.score += points;
        this.combo++;
        this.hits++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        // Actualizar UI
        this.scoreText.setText(this.score.toString());
        this.comboText.setText(this.combo.toString());

        // Feedback visual
        this._showFeedback(rating, color);

        // Efecto de acierto (explosión pixel art)
        const fx = this.add.image(note.x, note.y, 'hit-effect').setTint(LANE_COLORS[note.getData('lane')]);
        this.tweens.add({
            targets: fx,
            scaleX: 2, scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => fx.destroy()
        });

        // Eliminar nota
        note.destroy();
    }

    _onMiss(note) {
        this.misses++;
        this.combo = 0;
        this.comboText.setText('0');

        // Feedback de fallo
        this._showFeedback('MISS', '#ff4444');

        // Nota se desvanece
        this.tweens.add({
            targets: note,
            alpha: 0,
            duration: 200,
            onComplete: () => note.destroy()
        });
    }

    _showFeedback(text, color) {
        this.feedbackText.setText(text);
        this.feedbackText.setColor(color);
        this.feedbackText.setAlpha(1);
        this.feedbackText.setScale(0.5);

        this.tweens.add({
            targets: this.feedbackText,
            scaleX: 1, scaleY: 1,
            alpha: 0,
            duration: 600,
            ease: 'Back.easeOut'
        });
    }

    _animateDrummerHit(lane) {
        // Sacudida rápida del baterista al golpear
        const origX = this.drummer.x;
        const offset = (lane < 2) ? -3 : 3;
        this.tweens.add({
            targets: this.drummer,
            x: origX + offset,
            duration: 50,
            yoyo: true
        });
    }

    _togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.physics.pause();
            this.centerText.setText('PAUSA').setAlpha(1);
            if (this.audioContext && this.audioContext.state === 'running') {
                this.audioContext.suspend();
            }
        } else {
            this.physics.resume();
            this.centerText.setAlpha(0);
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }
    }

    _endGame() {
        if (!this.isPlaying && !this.isPaused) return; // Ya terminó
        this.isPlaying = false;

        // Detener audio si existe
        if (this.audioSource) {
            try { this.audioSource.stop(); } catch (e) { /* ya terminó */ }
        }

        // Calcular resultados
        const accuracy = this.totalNotes > 0 ? Math.round((this.hits / this.totalNotes) * 100) : 0;
        const passed = accuracy >= 60; // 60% para pasar

        // Calcular monedas ganadas
        const coinsEarned = Math.floor(this.score / 50) + (passed ? 20 : 5);
        playerData.coins += coinsEarned;
        playerData.totalScore += this.score;

        if (passed && this.level >= playerData.maxLevelReached) {
            playerData.maxLevelReached = this.level + 1;
            playerData.currentLevel = this.level + 1;
        }

        // Pasar a escena de resultados
        this.scene.start('ResultScene', {
            score: this.score,
            combo: this.maxCombo,
            hits: this.hits,
            misses: this.misses,
            totalNotes: this.totalNotes,
            accuracy: accuracy,
            passed: passed,
            coinsEarned: coinsEarned,
            level: this.level
        });
    }
}

// ============================================================
// ESCENA: RESULTADOS
// ============================================================
class ResultScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ResultScene' });
    }

    init(data) {
        this.results = data;
    }

    preload() {
        PixelArt.createBackground(this, 'result-bg');
        PixelArt.createButton(this, 'btn-result', 220, 45, 0x4466aa);
        PixelArt.createButton(this, 'btn-result-shop', 220, 45, 0xaa8844);
    }

    create() {
        this.add.image(400, 300, 'result-bg');

        const r = this.results;
        const titleColor = r.passed ? '#44ff44' : '#ff4444';
        const titleText = r.passed ? '¡NIVEL COMPLETADO!' : 'NIVEL FALLIDO';

        this.add.text(400, 50, titleText, {
            fontSize: '36px', fontFamily: 'Courier New, monospace',
            color: titleColor, stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        // Estadísticas
        const stats = [
            `Nivel: ${r.level}`,
            `Puntuación: ${r.score}`,
            `Max Combo: ${r.combo}`,
            `Aciertos: ${r.hits} / ${r.totalNotes}`,
            `Fallos: ${r.misses}`,
            `Precisión: ${r.accuracy}%`,
            `Monedas ganadas: +${r.coinsEarned}`,
            `Monedas totales: ${playerData.coins}`
        ];

        stats.forEach((stat, i) => {
            this.add.text(400, 120 + i * 32, stat, {
                fontSize: '16px', fontFamily: 'Courier New, monospace',
                color: '#cccccc'
            }).setOrigin(0.5);
        });

        // Calificación con estrellas pixel art
        const stars = r.accuracy >= 95 ? '★★★' : r.accuracy >= 80 ? '★★☆' : r.accuracy >= 60 ? '★☆☆' : '☆☆☆';
        this.add.text(400, 400, stars, {
            fontSize: '48px', fontFamily: 'Courier New, monospace',
            color: '#ffcc00', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        // Botones
        this._createButton(300, 480, 'btn-result', 'MENÚ PRINCIPAL', () => {
            this.scene.start('MenuScene');
        });

        if (r.passed) {
            this._createButton(530, 480, 'btn-result-shop', 'IR A TIENDA', () => {
                this.scene.start('ShopScene');
            });
        } else {
            this._createButton(530, 480, 'btn-result', 'REINTENTAR', () => {
                this.scene.start('GameScene', { mode: 'default', level: r.level });
            });
        }

        // Texto animado de entrada
        this.children.list.forEach((child, i) => {
            child.setAlpha(0);
            this.tweens.add({
                targets: child,
                alpha: 1,
                duration: 400,
                delay: i * 50
            });
        });
    }

    _createButton(x, y, textureKey, label, callback) {
        const btn = this.add.image(x, y, textureKey).setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, label, {
            fontSize: '13px', fontFamily: 'Courier New, monospace', color: '#ffffff'
        }).setOrigin(0.5);
        btn.on('pointerover', () => { btn.setTint(0xcccccc); txt.setColor('#ffcc00'); });
        btn.on('pointerout', () => { btn.clearTint(); txt.setColor('#ffffff'); });
        btn.on('pointerdown', callback);
    }
}

// ============================================================
// ESCENA: TIENDA / PERSONALIZACIÓN
// ============================================================
class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    preload() {
        PixelArt.createBackground(this, 'shop-bg');
        PixelArt.createButton(this, 'btn-shop', 160, 36, 0x555555);
        PixelArt.createButton(this, 'btn-back', 140, 36, 0x664444);
    }

    create() {
        this.add.image(400, 300, 'shop-bg');

        this.add.text(400, 30, 'TIENDA / PERSONALIZACIÓN', {
            fontSize: '28px', fontFamily: 'Courier New, monospace',
            color: '#ffcc00', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.coinsText = this.add.text(400, 65, `Monedas: ${playerData.coins}`, {
            fontSize: '16px', fontFamily: 'Courier New, monospace', color: '#ffcc00'
        }).setOrigin(0.5);

        // Preview del baterista
        this._updateDrummerPreview();

        // Categorías de personalización
        this._createShopSection('COLOR BATERÍA', 130, [
            { color: 0x886644, label: 'Madera', price: 0, prop: 'drumColor', list: 'unlockedDrumColors' },
            { color: 0xcc2222, label: 'Rojo', price: 30, prop: 'drumColor', list: 'unlockedDrumColors' },
            { color: 0x2244cc, label: 'Azul', price: 30, prop: 'drumColor', list: 'unlockedDrumColors' },
            { color: 0x22cc22, label: 'Verde', price: 30, prop: 'drumColor', list: 'unlockedDrumColors' },
            { color: 0xcc22cc, label: 'Morado', price: 50, prop: 'drumColor', list: 'unlockedDrumColors' },
            { color: 0x111111, label: 'Negro', price: 75, prop: 'drumColor', list: 'unlockedDrumColors' },
            { color: 0xffcc00, label: 'Dorado', price: 100, prop: 'drumColor', list: 'unlockedDrumColors' },
        ]);

        this._createShopSection('COLOR BAQUETAS', 230, [
            { color: 0xddcc88, label: 'Natural', price: 0, prop: 'stickColor', list: 'unlockedStickColors' },
            { color: 0xff4444, label: 'Rojo', price: 25, prop: 'stickColor', list: 'unlockedStickColors' },
            { color: 0x44ccff, label: 'Cyan', price: 25, prop: 'stickColor', list: 'unlockedStickColors' },
            { color: 0xffffff, label: 'Blanco', price: 40, prop: 'stickColor', list: 'unlockedStickColors' },
            { color: 0xff44ff, label: 'Neón', price: 60, prop: 'stickColor', list: 'unlockedStickColors' },
        ]);

        this._createShopSection('ROPA', 330, [
            { color: 0x4444ff, label: 'Azul', price: 0, prop: 'outfitColor', list: 'unlockedOutfitColors' },
            { color: 0xff2222, label: 'Rojo', price: 30, prop: 'outfitColor', list: 'unlockedOutfitColors' },
            { color: 0x22ff22, label: 'Verde', price: 30, prop: 'outfitColor', list: 'unlockedOutfitColors' },
            { color: 0xff8800, label: 'Naranja', price: 40, prop: 'outfitColor', list: 'unlockedOutfitColors' },
            { color: 0x222222, label: 'Negro', price: 50, prop: 'outfitColor', list: 'unlockedOutfitColors' },
            { color: 0xffcc00, label: 'Dorado', price: 80, prop: 'outfitColor', list: 'unlockedOutfitColors' },
            { color: 0xff44ff, label: 'Rosa', price: 60, prop: 'outfitColor', list: 'unlockedOutfitColors' },
        ]);

        // Botón volver
        const backBtn = this.add.image(400, 560, 'btn-back').setInteractive({ useHandCursor: true });
        const backTxt = this.add.text(400, 560, 'VOLVER AL MENÚ', {
            fontSize: '12px', fontFamily: 'Courier New, monospace', color: '#ffffff'
        }).setOrigin(0.5);
        backBtn.on('pointerover', () => { backBtn.setTint(0xcccccc); backTxt.setColor('#ffcc00'); });
        backBtn.on('pointerout', () => { backBtn.clearTint(); backTxt.setColor('#ffffff'); });
        backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    _createShopSection(title, y, items) {
        this.add.text(80, y, title, {
            fontSize: '13px', fontFamily: 'Courier New, monospace', color: '#aaaaaa'
        });

        items.forEach((item, idx) => {
            const x = 80 + idx * 90;
            const itemY = y + 35;

            // Cuadro de color
            const colorBox = this.add.rectangle(x + 20, itemY, 30, 30, item.color)
                .setStrokeStyle(2, 0xffffff, 0.5)
                .setInteractive({ useHandCursor: true });

            // Verificar si ya está desbloqueado
            const isUnlocked = playerData[item.list].includes(item.color);
            const isEquipped = playerData[item.prop] === item.color;

            let labelText;
            if (isEquipped) {
                labelText = '✓EQUIP';
            } else if (isUnlocked) {
                labelText = 'USAR';
            } else {
                labelText = `${item.price}¢`;
            }

            const label = this.add.text(x + 20, itemY + 24, labelText, {
                fontSize: '9px', fontFamily: 'Courier New, monospace',
                color: isEquipped ? '#44ff44' : (isUnlocked ? '#ffffff' : '#ffcc00')
            }).setOrigin(0.5);

            const nameLabel = this.add.text(x + 20, itemY - 24, item.label, {
                fontSize: '8px', fontFamily: 'Courier New, monospace', color: '#888888'
            }).setOrigin(0.5);

            if (isEquipped) {
                colorBox.setStrokeStyle(3, 0x44ff44, 1);
            }

            colorBox.on('pointerdown', () => {
                if (isEquipped) return;

                if (isUnlocked) {
                    // Equipar
                    playerData[item.prop] = item.color;
                    this.scene.restart();
                } else if (playerData.coins >= item.price) {
                    // Comprar y equipar
                    playerData.coins -= item.price;
                    playerData[item.list].push(item.color);
                    playerData[item.prop] = item.color;
                    this.scene.restart();
                } else {
                    // No hay suficientes monedas
                    this._showMessage('¡Monedas insuficientes!', '#ff4444');
                }
            });

            colorBox.on('pointerover', () => colorBox.setStrokeStyle(3, 0xffcc00, 1));
            colorBox.on('pointerout', () => {
                if (isEquipped) {
                    colorBox.setStrokeStyle(3, 0x44ff44, 1);
                } else {
                    colorBox.setStrokeStyle(2, 0xffffff, 0.5);
                }
            });
        });
    }

    _updateDrummerPreview() {
        // Regenerar textura del baterista con colores actuales
        PixelArt.createDrummer(
            this, 'drummer-shop',
            playerData.outfitColor, playerData.skinColor,
            playerData.drumColor, playerData.stickColor
        );

        if (this.drummerPreview) this.drummerPreview.destroy();
        this.drummerPreview = this.add.image(680, 460, 'drummer-shop').setScale(2);

        this.add.text(680, 390, 'PREVIEW', {
            fontSize: '11px', fontFamily: 'Courier New, monospace', color: '#888888'
        }).setOrigin(0.5);
    }

    _showMessage(text, color) {
        const msg = this.add.text(400, 500, text, {
            fontSize: '16px', fontFamily: 'Courier New, monospace',
            color: color, stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: msg,
            alpha: 0,
            y: 480,
            duration: 1500,
            onComplete: () => msg.destroy()
        });
    }
}

// ============================================================
// CONFIGURACIÓN DE PHASER Y ARRANQUE
// ============================================================
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1a1a2e',
    parent: document.body,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene, ResultScene, ShopScene],
    pixelArt: true,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);
