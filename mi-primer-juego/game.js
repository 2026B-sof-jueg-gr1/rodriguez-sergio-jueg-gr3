// ============================================================================
// PIXEL DRUMS: GUITAR HERO 3D EDITION (Phaser 3)
// ============================================================================
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

// Guardado persistente
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

// Estado temporal para audio subido
let customAudioData = {
    buffer: null,
    name: null
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

    // Hi-Hat metálico (Q)
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

    // Snare / Tarola crujiente (W)
    static playSnare() {
        SoundSynth.init();
        const ctx = SoundSynth.ctx;
        const now = ctx.currentTime;
        // Ruido blanco
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

        // Tono grave del parche
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

    // Tom resonante (E)
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

    // Kick / Bombo potente (R)
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

    // Zumbido eléctrico para notas sostenidas
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

    // Sonido de fallo
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

    // Sonido de ovación del público
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
    // Nota 3D tipo gema de Guitar Hero (beveled oval pixel art)
    static createNoteTexture(scene, key, color, hasRing = false) {
        const g = scene.make.graphics({ add: false });
        const w = 48, h = 32;

        // Sombra oscura inferior
        g.fillStyle(0x000000, 0.7);
        g.fillEllipse(w / 2, h / 2 + 5, 42, 22);

        // Borde exterior biselado
        g.fillStyle(0x1a1a1a);
        g.fillEllipse(w / 2, h / 2, 42, 24);

        // Borde metálico
        g.fillStyle(0x777777);
        g.fillEllipse(w / 2, h / 2 - 2, 38, 20);

        // Cuerpo coloreado de la gema
        g.fillStyle(color);
        g.fillEllipse(w / 2, h / 2 - 3, 34, 16);

        // Brillo superior 3D (reflejo blanco/claro)
        g.fillStyle(0xffffff, 0.7);
        g.fillEllipse(w / 2 - 4, h / 2 - 6, 16, 6);

        // Detalle de núcleo
        if (hasRing) {
            g.fillStyle(0xffffff, 0.9);
            g.fillCircle(w / 2, h / 2 - 3, 3);
        }

        g.generateTexture(key, w, h);
        g.destroy();
    }

    // Receptor / Pulsador de la zona de acierto
    static createReceptorTexture(scene, key, color) {
        const g = scene.make.graphics({ add: false });
        const w = 56, h = 36;

        // Base oscura
        g.fillStyle(0x0a0a0a);
        g.fillEllipse(w / 2, h / 2, 54, 32);

        // Anillo de metal exterior
        g.lineStyle(3, 0xaaaaaa, 1);
        g.strokeEllipse(w / 2, h / 2, 50, 28);

        // Anillo de color neón
        g.lineStyle(2, color, 0.8);
        g.strokeEllipse(w / 2, h / 2, 42, 22);

        // Centro oscurecido
        g.fillStyle(0x151515);
        g.fillEllipse(w / 2, h / 2, 34, 16);

        // Punto de referencia central
        g.fillStyle(color, 0.5);
        g.fillCircle(w / 2, h / 2, 4);

        g.generateTexture(key, w, h);
        g.destroy();
    }

    // Efecto de chispa / llama al golpear la nota
    static createSparksTexture(scene, key) {
        const g = scene.make.graphics({ add: false });
        g.fillStyle(0xffffff);
        // Cruz pixel art
        g.fillRect(10, 2, 4, 20);
        g.fillRect(2, 10, 20, 4);
        g.fillRect(6, 6, 12, 12);
        g.generateTexture(key, 24, 24);
        g.destroy();
    }

    // Baterista pixel art animable
    static createDrummerTexture(scene, key, outfitCol, skinCol, drumCol, stickCol) {
        const g = scene.make.graphics({ add: false });
        const w = 120, h = 100;

        // Platillos Crash & Ride
        g.fillStyle(0xffcc00);
        g.fillEllipse(18, 30, 30, 8);
        g.fillEllipse(102, 30, 30, 8);
        g.fillStyle(0x888844);
        g.fillRect(17, 34, 3, 25);
        g.fillRect(101, 34, 3, 25);

        // Bombo gigante central
        g.fillStyle(drumCol);
        g.fillCircle(60, 70, 26);
        g.fillStyle(0x222222);
        g.fillCircle(60, 70, 24);
        g.fillStyle(0xeeeeee);
        g.fillCircle(60, 70, 20);
        // Logo en el bombo
        g.fillStyle(0xff1744);
        g.fillRect(52, 66, 16, 4);
        g.fillRect(58, 62, 4, 14);

        // Toms
        g.fillStyle(drumCol);
        g.fillRect(28, 48, 20, 16);
        g.fillRect(72, 48, 20, 16);
        g.fillStyle(0xddddcc);
        g.fillRect(30, 46, 16, 4);
        g.fillRect(74, 46, 16, 4);

        // Tarola (Snare)
        g.fillStyle(0xbbbbbb);
        g.fillRect(14, 58, 18, 12);
        g.fillStyle(0xffffff);
        g.fillRect(16, 56, 14, 3);

        // Cuerpo y ropa del baterista
        g.fillStyle(outfitCol);
        g.fillRect(52, 28, 16, 20);

        // Cabeza & Pelo Rocker
        g.fillStyle(skinCol);
        g.fillRect(54, 12, 12, 14);
        // Pelo negro largo
        g.fillStyle(0x111111);
        g.fillRect(52, 8, 16, 7);
        g.fillRect(50, 12, 4, 16);
        g.fillRect(66, 12, 4, 16);
        // Gafas de sol oscuras
        g.fillStyle(0x000000);
        g.fillRect(54, 16, 12, 3);

        // Brazos y baquetas
        g.fillStyle(skinCol);
        g.fillRect(44, 30, 8, 4);
        g.fillRect(68, 30, 8, 4);

        g.fillStyle(stickCol);
        g.fillRect(34, 26, 14, 3);
        g.fillRect(72, 26, 14, 3);

        g.generateTexture(key, w, h);
        g.destroy();
    }

    // Amplificador Marshall pixel art (para los lados del escenario)
    static createAmpTexture(scene, key) {
        const g = scene.make.graphics({ add: false });
        const w = 70, h = 130;

        // Gabinete negro con bordes metálicos
        g.fillStyle(0x111111);
        g.fillRect(0, 0, w, h);
        g.lineStyle(2, 0xd4af37, 1);
        g.strokeRect(1, 1, w - 2, h - 2);

        // Rejilla de bocinas
        g.fillStyle(0x282828);
        g.fillRect(6, 26, w - 12, h - 34);

        // Dos conos de altavoces
        g.fillStyle(0x181818);
        g.fillCircle(w / 2, 50, 18);
        g.fillCircle(w / 2, 92, 18);
        g.fillStyle(0xd4af37);
        g.fillCircle(w / 2, 50, 5);
        g.fillCircle(w / 2, 92, 5);

        // Panel de control superior dorado
        g.fillStyle(0xd4af37);
        g.fillRect(6, 6, w - 12, 14);
        // Perillas
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

        const windowSize = Math.floor(sampleRate * 0.04); // 40ms
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
                // Detectar carril por espectro
                const lane = AudioAnalyzer._getLane(channelData, Math.floor(time * sampleRate), windowSize, sampleRate);
                
                // Detectar si la energía se mantiene para convertirla en nota sostenida (Hold Note)
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
                lastTime = time + sustainDur; // Evitar superposición inmediata
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

    // Generador de partituras para los niveles integrados (con notas normales y sostenidas)
    static generateLevelSong(level) {
        const duration = 35 + (level - 1) * 8;
        const bpm = 110 + (level - 1) * 15;
        const beatStep = 60 / bpm;
        const notes = [];

        let t = 2.0; // Iniciar tras 2s
        let stepCount = 0;

        while (t < duration - 2.0) {
            stepCount++;
            const beatInBar = stepCount % 16;
            
            // Patrones rítmicos variados según nivel
            let spawnLanes = [];
            let isSustain = false;
            let sustainDur = 0;

            if (level === 1) {
                // Nivel 1: Ritmo clásico Rock 4/4
                if (beatInBar % 4 === 0) spawnLanes = [3]; // Kick
                else if (beatInBar % 4 === 2) spawnLanes = [1]; // Snare
                if (beatInBar % 2 === 0) spawnLanes.push(0); // Hi-hat
            } else if (level === 2) {
                // Nivel 2: Introduce Notas Sostenidas
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
                // Nivel 3: Ritmo sincopado (la línea de acierto se moverá)
                if (beatInBar % 4 === 0) spawnLanes = [3];
                if (beatInBar % 4 === 2) spawnLanes = [1];
                if (beatInBar % 3 === 0) spawnLanes.push(2);
                if (beatInBar % 2 === 1 && Math.random() > 0.4) spawnLanes.push(0);
                if (beatInBar === 14) {
                    isSustain = true;
                    sustainDur = beatStep * 2;
                }
            } else if (level === 4) {
                // Nivel 4: Metal frenético (el tablero rotará)
                spawnLanes = [stepCount % 4];
                if (stepCount % 2 === 0) spawnLanes.push(3);
                if (beatInBar === 0 || beatInBar === 8) {
                    isSustain = true;
                    sustainDur = beatStep * 1.8;
                }
            } else {
                // Nivel 5: Guitar God (Solos, polirritmia, sostenidas, rotaciones y línea móvil)
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
        // Generar texturas de notas para cada carril
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
// ESCENA: MENÚ PRINCIPAL (ESTILO GUITAR HERO CLÁSICO)
// ----------------------------------------------------------------------------
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        SoundSynth.init();

        // Fondo de concierto pixel art con focos dinámicos
        this.bgGraphics = this.add.graphics();
        this._drawMenuBackground(w, h);

        // Luces de concierto animadas
        this.spotlights = [];
        for (let i = 0; i < 4; i++) {
            const spot = this.add.graphics();
            this.spotlights.push({ g: spot, baseAngle: i * 0.8, color: LANE_COLORS[i] });
        }

        // Título clásico estilo Guitar Hero
        const titleY = Math.max(50, h * 0.12);
        const titleText = this.add.text(w / 2, titleY, 'PIXEL HERO', {
            fontSize: `${Math.min(w * 0.08, 64)}px`,
            fontFamily: 'Impact, "Trebuchet MS", sans-serif',
            fontStyle: 'bold',
            color: '#ffea00',
            stroke: '#000000',
            strokeThickness: 10,
            shadow: { offsetX: 4, offsetY: 4, color: '#ff1744', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.add.text(w / 2, titleY + 45, '★ 8-BIT DRUM HIGHWAY ★', {
            fontSize: `${Math.min(w * 0.025, 18)}px`,
            fontFamily: 'Courier New, monospace',
            fontStyle: 'bold',
            color: '#00e676',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Baterista animado al centro
        this.drummer = this.add.image(w / 2, h * 0.38, 'drummer-base').setScale(Math.min(w, h) / 450);
        this.tweens.add({
            targets: this.drummer,
            y: this.drummer.y - 8,
            duration: 350,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Amplificadores a los costados
        const ampScale = Math.min(w, h) / 600;
        this.add.image(w * 0.15, h * 0.45, 'amp-tower').setScale(ampScale);
        this.add.image(w * 0.85, h * 0.45, 'amp-tower').setScale(ampScale).setFlipX(true);

        // Monedas y nivel actual
        this.add.text(w / 2, h * 0.52, `MONEDAS: ${playerData.coins} ¢  |  NIVEL MÁXIMO: ${playerData.maxLevelReached}`, {
            fontSize: `${Math.min(w * 0.022, 16)}px`,
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#111111aa',
            padding: { x: 12, y: 6 }
        }).setOrigin(0.5);

        // Botones de acción principales
        const btnStartY = h * 0.60;
        const btnSpacing = Math.min(h * 0.09, 58);

        this._createRockButton(w / 2, btnStartY, `JUGAR NIVEL ${playerData.currentLevel}`, 0x00e676, () => {
            this.scene.start('GameScene', { mode: 'default', level: playerData.currentLevel });
        });

        this._createRockButton(w / 2, btnStartY + btnSpacing, 'SUBIR TU MÚSICA (MP3/WAV)', 0xff1744, () => {
            this._handleAudioUpload();
        });

        this._createRockButton(w / 2, btnStartY + btnSpacing * 2, 'TIENDA & PERSONALIZACIÓN', 0xffea00, () => {
            this.scene.start('ShopScene');
        });

        // Selección rápida de niveles
        this._createLevelSelector(w / 2, btnStartY + btnSpacing * 3);

        // Controles en el pie
        const footerY = h - 25;
        this.add.text(w / 2, footerY, 'CONTROLES: [Q] Hi-Hat  [W] Snare  [E] Tom  [R] Kick  |  MANTÉN EN NOTAS LARGAS', {
            fontSize: `${Math.min(w * 0.016, 12)}px`,
            fontFamily: 'Courier New, monospace',
            color: '#aaaaaa'
        }).setOrigin(0.5);

        // Manejar redimensionamiento
        this.scale.on('resize', this._onResize, this);
    }

    _drawMenuBackground(w, h) {
        this.bgGraphics.clear();
        // Escenario oscuro con gradiente
        this.bgGraphics.fillStyle(0x0a0914);
        this.bgGraphics.fillRect(0, 0, w, h);

        // Tarima de madera
        this.bgGraphics.fillStyle(0x2d1a0e);
        this.bgGraphics.fillRect(0, h * 0.48, w, h * 0.52);
        this.bgGraphics.fillStyle(0xd4af37, 0.4);
        this.bgGraphics.fillRect(0, h * 0.48, w, 4);

        // Siluetas del público rockero en la parte inferior
        this.bgGraphics.fillStyle(0x05040a);
        const crowdCount = Math.floor(w / 25);
        for (let i = 0; i < crowdCount; i++) {
            const cx = i * 25 + 12;
            const ch = 40 + Math.sin(i * 1.5) * 15;
            this.bgGraphics.fillCircle(cx, h - ch, 14); // Cabezas
            this.bgGraphics.fillRect(cx - 14, h - ch + 8, 28, ch); // Hombros
            // Manos con señal de rock (\m/)
            if (i % 3 === 0) {
                this.bgGraphics.fillRect(cx - 18, h - ch - 12, 5, 14);
                this.bgGraphics.fillRect(cx - 10, h - ch - 12, 5, 14);
            }
        }
    }

    _createRockButton(x, y, text, color, callback) {
        const w = Math.min(this.scale.width * 0.65, 360);
        const h = 42;

        const container = this.add.container(x, y);

        const shadow = this.add.rectangle(4, 4, w, h, 0x000000, 0.8);
        const bg = this.add.rectangle(0, 0, w, h, 0x1e1e1e);
        bg.setStrokeStyle(3, color);

        const label = this.add.text(0, 0, text, {
            fontSize: `${Math.min(this.scale.width * 0.022, 16)}px`,
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
        this.add.text(x, y - 22, 'SELECCIONAR NIVEL:', {
            fontSize: '12px', fontFamily: 'Courier New, monospace', color: '#ffea00'
        }).setOrigin(0.5);

        for (let i = 1; i <= 5; i++) {
            const lx = (i - 3) * 65;
            const isUnlocked = i <= playerData.maxLevelReached;
            const isSelected = i === playerData.currentLevel;

            const box = this.add.rectangle(lx, 0, 50, 28, isSelected ? 0x00e676 : (isUnlocked ? 0x333333 : 0x151515));
            box.setStrokeStyle(2, isUnlocked ? 0xffea00 : 0x555555);

            const txt = this.add.text(lx, 0, `N${i}`, {
                fontSize: '13px', fontFamily: 'Impact, sans-serif',
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
        // Mover focos de escenario
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
// ESCENA: GAMEPLAY (HIGHWAY 3D PSEUDO, ROTACIÓN, LÍNEA MÓVIL, HOLD NOTES)
// ----------------------------------------------------------------------------
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        this.mode = data.mode || 'default';
        this.level = data.level || 1;

        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.hits = 0;
        this.misses = 0;
        this.rockMeter = 0.65; // 0 (Fail) a 1 (Rock God)

        // Mecánicas avanzadas según nivel
        this.enableMovingHitLine = this.level >= 3;
        this.enableBoardRotation = this.level >= 4;

        // Estado del tablero 3D
        this.boardAngle = 0; // 0 = Vertical, Math.PI/2 = Horizontal
        this.targetBoardAngle = 0;
        this.isRotating = false;

        // Estado de la línea de acierto (Z normalizado entre 0 y 1)
        this.baseHitZ = 0.85;
        this.currentHitZ = 0.85;

        // Notas activas y sostén
        this.notes = [];
        this.holdingLanes = [false, false, false, false];
        this.activeHoldNotes = [null, null, null, null];

        this.isPlaying = false;
        this.gameStartTime = 0;
        this.songTime = 0;
        this.duration = 40;

        this.customAudioSource = null;
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Teclas Q, W, E, R con addKey según especificación
        this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.laneKeys = [this.keyQ, this.keyW, this.keyE, this.keyR];

        // ESC para salir o pausar
        this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Gráficos del escenario y la carretera 3D
        this.stageGraphics = this.add.graphics();
        this.highwayGraphics = this.add.graphics();
        this.sustainGraphics = this.add.graphics();
        this.effectsGraphics = this.add.graphics();

        // Receptores / Botones de acierto (4 carriles)
        this.receptors = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            const r = this.add.image(0, 0, `receptor-${i}`).setOrigin(0.5);
            this.receptors.push(r);
        }

        // Baterista de escenario en el horizonte 3D
        this.drummer = this.add.image(w / 2, h * 0.22, 'drummer-base').setScale(0.85);

        // UI: Score, Multiplier, Rock Meter, Combo
        this._createRockHUD();

        // Generar o cargar canciones
        this._loadSong();

        // Cuenta regresiva
        this._startCountdown();

        // Manejar redimensionamiento de pantalla completa
        this.scale.on('resize', () => {
            this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
        });
    }

    _createRockHUD() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Panel de puntuación superior izquierdo
        this.scoreText = this.add.text(30, 25, 'SCORE: 0', {
            fontSize: '24px', fontFamily: 'Impact, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 5
        });

        this.multiplierText = this.add.text(30, 60, '1X', {
            fontSize: '32px', fontFamily: 'Impact, sans-serif',
            color: '#ffea00', stroke: '#000000', strokeThickness: 6
        });

        // Combo central
        this.comboText = this.add.text(w / 2, 80, '', {
            fontSize: '28px', fontFamily: 'Impact, sans-serif',
            color: '#00e676', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        // Feedback de acierto (PERFECT / GREAT / GOOD)
        this.ratingText = this.add.text(w / 2, h * 0.65, '', {
            fontSize: '36px', fontFamily: 'Impact, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);

        // Banner de Alerta para eventos de dificultad (Línea móvil / Rotación)
        this.alertBanner = this.add.text(w / 2, h * 0.35, '', {
            fontSize: '26px', fontFamily: 'Impact, sans-serif',
            color: '#ff1744', stroke: '#000000', strokeThickness: 6,
            backgroundColor: '#000000cc', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setAlpha(0);

        // Rock Meter (Medidor de energía estilo Guitar Hero clásico en la derecha)
        this.rockMeterGraphics = this.add.graphics();
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

        // Crear objetos de notas activas
        this.notes = this.notesData.map(nd => ({
            time: nd.time,
            lane: nd.lane,
            duration: nd.duration || 0,
            sprite: this.add.image(-100, -100, `note-gem-${nd.lane}`).setVisible(false),
            state: 'pending', // pending, hit, holding, missed
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
                    countText.setText('¡ROCK!');
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

        // Iniciar audio si es personalizado
        if (this.mode === 'custom-audio' && customAudioData.buffer) {
            SoundSynth.init();
            this.customAudioSource = SoundSynth.ctx.createBufferSource();
            this.customAudioSource.buffer = customAudioData.buffer;
            this.customAudioSource.connect(SoundSynth.ctx.destination);
            this.customAudioSource.start(0);
        }

        // Eventos periódicos de dificultad (Rotación y advertencias)
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
        // Alternar entre 0 (Vertical) y Math.PI/2 (Horizontal)
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

    // ------------------------------------------------------------------------
    // MATEMÁTICA DE PERSPECTIVA 3D PSEUDO-ROTATORIA
    // ------------------------------------------------------------------------
    /**
     * Calcula la posición de pantalla (x, y), ancho y escala para una profundidad Z
     * con orientación de tablero rotatoria en ángulo theta.
     */
    _getPerspectivePoint(lane, z, theta = this.boardAngle) {
        const w = this.scale.width;
        const h = this.scale.height;
        const cx = w / 2;
        const cy = h / 2;

        const highwayLength = Math.min(w, h) * 0.82;
        const topWidth = Math.min(w, h) * 0.16;
        const bottomWidth = Math.min(w, h) * 0.58;

        // Curva de perspectiva (t acelera hacia la cámara)
        const t = Math.pow(Math.max(0, Math.min(1, z)), 1.6);

        // Vector axial de la carretera y vector transversal
        const uX = Math.sin(theta);
        const uY = Math.cos(theta);
        const vX = Math.cos(theta);
        const vY = -Math.sin(theta);

        // Origen lejano (horizonte) y destino cercano
        const horizDist = highwayLength * 0.45;
        const nearDist = highwayLength * 0.45;

        const hx = cx - uX * horizDist;
        const hy = cy - uY * horizDist;
        const nx = cx + uX * nearDist;
        const ny = cy + uY * nearDist;

        // Centro en profundidad z
        const curX = hx + (nx - hx) * t;
        const curY = hy + (ny - hy) * t;

        // Ancho de la carretera en profundidad z
        const curW = topWidth + (bottomWidth - topWidth) * t;

        // Desplazamiento del carril (-1.5 a +1.5)
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

        // Salir con ESC
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this._endGame();
            return;
        }

        // 1. Dinámica de la línea de acierto (sube y baja si está habilitada)
        if (this.enableMovingHitLine) {
            // Oscilación suave senoidal
            this.currentHitZ = this.baseHitZ + Math.sin(this.songTime * 2.5) * 0.10;
        } else {
            this.currentHitZ = this.baseHitZ;
        }

        // 2. Renderizar escenario de fondo y focos
        this._renderStage(w, h, time);

        // 3. Renderizar carretera 3D y divisores de carriles
        this._render3DHighway();

        // 4. Actualizar receptores según la línea de acierto actual
        this._updateReceptors();

        // 5. Procesar entradas de teclas Q, W, E, R
        this._handleKeyInputs(delta);

        // 6. Actualizar y proyectar notas
        this._updateNotes();

        // 7. Actualizar Rock Meter y HUD
        this._updateHUD();

        // 8. Verificar fin de canción
        if (this.songTime > this.duration + 2.5) {
            this._endGame();
        }
    }

    _renderStage(w, h, time) {
        this.stageGraphics.clear();
        // Fondo negro profundo
        this.stageGraphics.fillStyle(0x06060c);
        this.stageGraphics.fillRect(0, 0, w, h);

        // Tarima
        this.stageGraphics.fillStyle(0x1a110a);
        this.stageGraphics.fillRect(0, h * 0.45, w, h * 0.55);

        // Focos de luces cruzadas
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

        // Baterista tocando en el horizonte
        const horiz = this._getPerspectivePoint(1.5, 0.05);
        this.drummer.setPosition(horiz.centerX, horiz.centerY - 25);
    }

    _render3DHighway() {
        this.highwayGraphics.clear();

        // Dibujar cuerpo trapezoidal de la carretera
        const pTopLeft = this._getPerspectivePoint(0, 0);
        const pTopRight = this._getPerspectivePoint(3, 0);
        const pBotLeft = this._getPerspectivePoint(0, 1);
        const pBotRight = this._getPerspectivePoint(3, 1);

        // Asfalto / Madera de la carretera Guitar Hero
        const themeColor = playerData.highwayTheme === 'neon' ? 0x051b2c : 0x18181c;
        this.highwayGraphics.fillStyle(themeColor, 0.95);
        this.highwayGraphics.beginPath();
        this.highwayGraphics.moveTo(pTopLeft.x - pTopLeft.vX * 25, pTopLeft.y - pTopLeft.vY * 25);
        this.highwayGraphics.lineTo(pTopRight.x + pTopRight.vX * 25, pTopRight.y + pTopRight.vY * 25);
        this.highwayGraphics.lineTo(pBotRight.x + pBotRight.vX * 55, pBotRight.y + pBotRight.vY * 55);
        this.highwayGraphics.lineTo(pBotLeft.x - pBotLeft.vX * 55, pBotLeft.y - pBotLeft.vY * 55);
        this.highwayGraphics.closePath();
        this.highwayGraphics.fillPath();

        // Rieles metálicos laterales
        this.highwayGraphics.lineStyle(4, 0xd4af37, 1);
        this.highwayGraphics.lineBetween(
            pTopLeft.x - pTopLeft.vX * 25, pTopLeft.y - pTopLeft.vY * 25,
            pBotLeft.x - pBotLeft.vX * 55, pBotLeft.y - pBotLeft.vY * 55
        );
        this.highwayGraphics.lineBetween(
            pTopRight.x + pTopRight.vX * 25, pTopRight.y + pTopRight.vY * 25,
            pBotRight.x + pBotRight.vX * 55, pBotRight.y + pBotRight.vY * 55
        );

        // Divisores de carriles en 3D
        this.highwayGraphics.lineStyle(2, 0x444455, 0.6);
        for (let i = 0.5; i <= 2.5; i += 1.0) {
            const pStart = this._getPerspectivePoint(i, 0);
            const pEnd = this._getPerspectivePoint(i, 1);
            this.highwayGraphics.lineBetween(pStart.x, pStart.y, pEnd.x, pEnd.y);
        }

        // Barras de compás rítmicas viajando hacia el jugador
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

        // Línea de acierto móvil (conecta los 4 receptores)
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

            // Resplandor si está presionada la tecla correspondiente
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

            // 1. Detección de pulsación inicial (JustDown)
            if (Phaser.Input.Keyboard.JustDown(key)) {
                this._onLaneHit(i);
            }

            // 2. Manejo de nota sostenida (Hold) mientras la tecla sigue presionada
            if (key.isDown && this.activeHoldNotes[i]) {
                const holdNote = this.activeHoldNotes[i];
                const dtSec = delta / 1000;
                holdNote.holdProgress += dtSec;

                // Sumar puntos continuos y sonido
                this.score += Math.floor(25 * this.multiplier);
                this.rockMeter = Math.min(1.0, this.rockMeter + 0.003);

                // Efecto de rayos / chispas en el receptor
                this._spawnHoldSparks(i);

                if (Math.random() < 0.25) {
                    SoundSynth.playSustainTone(i);
                }

                // Completar nota sostenida
                if (holdNote.holdProgress >= holdNote.duration) {
                    this._onHoldComplete(i, holdNote);
                }
            } else if (!key.isDown && this.activeHoldNotes[i]) {
                // Se soltó la tecla antes de tiempo (Rotura de hold)
                this._onHoldBreak(i);
            }
        }
    }

    _onLaneHit(lane) {
        SoundSynth.playLane(lane);

        // Buscar nota pendiente más cercana a la línea de acierto actual
        let bestNote = null;
        let minDiff = Infinity;
        const approachTime = 1.6; // Segundos que tarda la nota desde el horizonte hasta la línea de acierto

        for (const n of this.notes) {
            if (n.lane === lane && n.state === 'pending') {
                const diff = Math.abs(this.songTime - n.time);
                if (diff < minDiff && diff < 0.28) { // Ventana de tolerancia
                    minDiff = diff;
                    bestNote = n;
                }
            }
        }

        if (bestNote) {
            // Evaluar precisión del impacto
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

            // Multiplicador estilo Guitar Hero (1x -> 2x -> 3x -> 4x)
            this.multiplier = Math.min(4, 1 + Math.floor(this.combo / 10));

            // Mejorar Rock Meter
            this.rockMeter = Math.min(1.0, this.rockMeter + 0.05);

            this._showRating(rating, ratingColor);
            this._spawnHitParticles(lane);

            if (bestNote.duration > 0) {
                // Iniciar nota sostenida
                bestNote.state = 'holding';
                this.activeHoldNotes[lane] = bestNote;
            } else {
                bestNote.state = 'hit';
                bestNote.sprite.setVisible(false);
            }
        } else {
            // Golpe al aire: penalización en Rock Meter
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

        // Bonus por completar el hold
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

            // Progreso Z de la nota hacia la línea de acierto
            const timeDiff = n.time - this.songTime;
            // z va de 0 (horizonte) a currentHitZ (en el momento de impacto)
            const z = this.currentHitZ - (timeDiff / approachTime) * this.currentHitZ;

            // 1. Comprobar si se perdió la nota (Miss)
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

            // 2. Renderizar si está visible en la carretera
            if (z >= 0.0 && z <= 1.05) {
                const pt = this._getPerspectivePoint(n.lane, z);
                n.sprite.setPosition(pt.x, pt.y);
                n.sprite.setScale(pt.scale);
                n.sprite.setRotation(this.boardAngle);
                n.sprite.setVisible(true);

                // 3. Dibujar estela / rayo para notas sostenidas (Hold Notes)
                if (n.duration > 0 && n.state !== 'missed') {
                    const tailDurationRemaining = n.state === 'holding' ? (n.duration - n.holdProgress) : n.duration;
                    const zTailEnd = z - (tailDurationRemaining / approachTime) * this.currentHitZ;

                    const pHead = pt;
                    const pTail = this._getPerspectivePoint(n.lane, Math.max(0, zTailEnd));

                    // Dibujar rayo láser eléctrico pixel art en perspectiva
                    const col = LANE_COLORS[n.lane];
                    this.sustainGraphics.lineStyle(Math.max(3, pt.scale * 12), col, 0.85);
                    this.sustainGraphics.lineBetween(pHead.x, pHead.y, pTail.x, pTail.y);

                    // Núcleo blanco brillante del rayo
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

        // Dibujar Rock Meter estilo Guitar Hero en el costado derecho
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

        // Borde oscuro del medidor
        g.fillStyle(0x000000, 0.8);
        g.fillRect(mx - 2, my - 2, mW + 4, mH + 4);
        g.lineStyle(2, 0xd4af37, 1);
        g.strokeRect(mx - 2, my - 2, mW + 4, mH + 4);

        // Zonas del medidor (Rojo abajo, Amarillo al centro, Verde arriba)
        g.fillStyle(0x220000);
        g.fillRect(mx, my + mH * 0.66, mW, mH * 0.34);
        g.fillStyle(0x222200);
        g.fillRect(mx, my + mH * 0.33, mW, mH * 0.33);
        g.fillStyle(0x002200);
        g.fillRect(mx, my, mW, mH * 0.33);

        // Barra de nivel del jugador
        const fillHeight = mH * this.rockMeter;
        let fillColor = 0x00e676; // Verde
        if (this.rockMeter < 0.33) fillColor = 0xff1744; // Rojo
        else if (this.rockMeter < 0.66) fillColor = 0xffea00; // Amarillo

        g.fillStyle(fillColor, 1.0);
        g.fillRect(mx + 2, my + mH - fillHeight, mW - 4, fillHeight);
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

        // Calcular recompensa de monedas
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
// ESCENA: RESULTADOS DEL RECITAL
// ----------------------------------------------------------------------------
class ResultScene extends Phaser.Scene {
    constructor() { super('ResultScene'); }

    init(data) { this.res = data; }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        // Fondo oscuro
        const g = this.add.graphics();
        g.fillStyle(0x0a0914, 1);
        g.fillRect(0, 0, w, h);

        const titleText = this.res.passed ? '¡CONCIERTO LEGENDARIO!' : '¡ABUCHEO EN EL ESCENARIO!';
        const titleColor = this.res.passed ? '#00e676' : '#ff1744';

        this.add.text(w / 2, h * 0.12, titleText, {
            fontSize: `${Math.min(w * 0.06, 44)}px`,
            fontFamily: 'Impact, sans-serif',
            color: titleColor,
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // Estrellas doradas Guitar Hero
        const stars = this.res.accuracy >= 95 ? '★★★★★' : this.res.accuracy >= 80 ? '★★★★☆' : this.res.accuracy >= 65 ? '★★★☆☆' : '★★☆☆☆';
        this.add.text(w / 2, h * 0.22, stars, {
            fontSize: '52px', fontFamily: 'Impact, sans-serif',
            color: '#ffea00', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        // Resumen de estadísticas
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

        // Botones
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

        // Preview del baterista a la derecha
        this._updatePreview();

        // Secciones de compra
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

        // Botón Volver
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
