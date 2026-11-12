(() => {
  const get = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let language = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  try { language = localStorage.getItem('portfolio-language') || language; } catch {}
  language = language === 'en' ? 'en' : 'zh';
  const say = (zh, en) => language === 'zh' ? zh : en;
  const canvas = get('view');
  let ctx = null;
  try {
    ctx = canvas.getContext('2d', { colorSpace: 'display-p3' }) || canvas.getContext('2d');
  } catch {
    ctx = canvas.getContext('2d');
  }
  const noise = get('noise').getContext('2d');

  // Core Game State
  let room = 'station';
  let currentAct = 1;
  let seenActs = new Set([1]);
  let hasFuse = false;
  let powered = false;
  let teaChecked = false;
  let lockerOpen = false;
  let suitcaseOpen = false;
  let pillarChecked = false;
  let hasPunch = false;
  let hasPhoto = false;
  let hasSideB = false;
  let ticketPunched = false;
  let sideBPlayed = false;
  let trainApproaching = false;
  let trainArrived = false;
  let ending = '';
  let puzzle = '';
  let input = [];
  let dials = [0, 0, 0];
  let activeDial = -1;
  let inspectedItem = '';
  let feedback = [];
  let caption = [];
  let effect = '';
  let effectStart = 0;
  let effectDuration = 0;
  let effectProgress = 1;
  const clues = new Set();

  // 5 Symbols for Locker Keypad (Pick 3 in order -> 60 combinations, never solvable by clicking 1-2-3)
  const symbolDefs = [
    ['彎月', 'Crescent'],
    ['圓圈', 'Circle'],
    ['水波', 'Wave'],
    ['星芒', 'Star'],
    ['山稜', 'Peak'],
  ];
  const stationDefs = [
    ['樟溪月台', 'Camphor Platform'],
    ['霧河岸', 'Misty Riverside'],
    ['望山隘口', 'Mountain Pass'],
  ];
  // 4 Circuits on Console (Engage 3 in order, avoiding Ground)
  const circuitDefs = [
    ['照明迴路', 'Lighting'],
    ['廣播迴路', 'Broadcast'],
    ['號誌迴路', 'Signal'],
    ['備用接地（勿動）', 'Ground (Idle)'],
  ];
  // 3 Suitcase Dials x 5 Options = 125 combinations (1 from Letter, 1 from Pillar, 1 from Ticket)
  const dialOptions = [
    [
      ['春霧', 'Spring Mist'],
      ['夏雷', 'Summer Thunder'],
      ['秋霜', 'Autumn Frost'],
      ['冬雪', 'Winter Snow'],
      ['梅雨', 'Plum Rain'],
    ],
    [
      ['110 cm', '110 cm'],
      ['125 cm', '125 cm'],
      ['140 cm', '140 cm'],
      ['155 cm', '155 cm'],
      ['168 cm', '168 cm'],
    ],
    [
      ['102 番', 'Track 102'],
      ['207 番', 'Track 207'],
      ['305 番', 'Track 305'],
      ['404 番', 'Track 404'],
      ['510 番', 'Track 510'],
    ],
  ];

  let stationToSymbol = [1, 2, 0];
  let stopOrder = [0, 1, 2];
  let lockerTarget = [1, 2, 0];
  let circuitTarget = [2, 0, 1];
  let dialTarget = [4, 2, 3];
  let punchTargets = [0.24, 0.52, 0.78];
  let punchStep = 0;
  let punchCursor = 0.24;
  let punchFlash = 0;

  let tunerFreq = 0;
  let tunerPhase = 0;
  let tunerTargetFreq = 3;
  let tunerTargetPhase = 2;

  let lanternStage = 0;
  let lanternPulse = 0;
  let lanternBeamTime = 0;

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function randomizePuzzles() {
    // 1. Pick 3 distinct symbols out of 5 for the 3 stations, ensuring target is never [0, 1, 2]
    do {
      const pool = shuffle([0, 1, 2, 3, 4]);
      stationToSymbol = [pool[0], pool[1], pool[2]];
      stopOrder = shuffle([0, 1, 2]);
      lockerTarget = stopOrder.map((stIdx) => stationToSymbol[stIdx]);
    } while (lockerTarget[0] === 0 && lockerTarget[1] === 1 && lockerTarget[2] === 2);

    // 2. Permute the 3 main circuits [0, 1, 2], ensuring target is never [0, 1, 2]
    do {
      circuitTarget = shuffle([0, 1, 2]);
    } while (circuitTarget[0] === 0 && circuitTarget[1] === 1 && circuitTarget[2] === 2);

    // 3. Randomize 3 suitcase dials across 5 options each
    dialTarget = [
      Math.floor(Math.random() * 5),
      Math.floor(Math.random() * 5),
      Math.floor(Math.random() * 5),
    ];
    dials = [
      (dialTarget[0] + 2) % 5,
      (dialTarget[1] + 3) % 5,
      (dialTarget[2] + 1) % 5,
    ];

    // 4. Randomize Ticket Punch target positions
    punchTargets = [
      Number((0.20 + Math.random() * 0.06).toFixed(2)),
      Number((0.48 + Math.random() * 0.06).toFixed(2)),
      Number((0.76 + Math.random() * 0.06).toFixed(2)),
    ];

    // 5. Randomize Radio Oscilloscope target frequency & phase (0..4)
    tunerTargetFreq = 1 + Math.floor(Math.random() * 4);
    tunerTargetPhase = 1 + Math.floor(Math.random() * 4);
    tunerFreq = (tunerTargetFreq + 2) % 5;
    tunerPhase = (tunerTargetPhase + 3) % 5;
  }

  randomizePuzzles();

  // =========================================================================
  // Procedural Web Audio Engine (BGM, Room Ambience & Interactive SFX)
  // =========================================================================
  let soundEnabled = true;
  try {
    const savedSound = localStorage.getItem('lost-signal-sound');
    if (savedSound === 'off') soundEnabled = false;
  } catch {}

  let audioCtx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let ambNoiseGain = null;
  let ambFilter = null;
  let ambHumOsc = null;
  let ambHumGain = null;
  let bgmTimer = 0;
  let bgmStep = 0;
  let railTimer = 0;

  function initAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended' && soundEnabled) {
        audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = soundEnabled ? 1 : 0;
      masterGain.connect(audioCtx.destination);

      const sampleRate = audioCtx.sampleRate;
      const length = sampleRate * 3;
      noiseBuffer = audioCtx.createBuffer(1, length, sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.04) * 0.35;
      }

      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      ambFilter = audioCtx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 160;
      ambNoiseGain = audioCtx.createGain();
      ambNoiseGain.gain.value = 0.001;
      noiseSource.connect(ambFilter);
      ambFilter.connect(ambNoiseGain);
      ambNoiseGain.connect(masterGain);
      noiseSource.start();

      ambHumOsc = audioCtx.createOscillator();
      ambHumOsc.type = 'sine';
      ambHumOsc.frequency.value = 110;
      ambHumGain = audioCtx.createGain();
      ambHumGain.gain.value = 0.0001;
      ambHumOsc.connect(ambHumGain);
      ambHumGain.connect(masterGain);
      ambHumOsc.start();

      updateAmbience();
      startBGM();
    } catch {}
  }

  function updateAmbience() {
    if (!audioCtx || !ambFilter || !ambNoiseGain || !ambHumGain) return;
    try {
      const now = audioCtx.currentTime;
      const inGame = document.body.dataset.phase === 'playing' || document.body.dataset.phase === 'opening';
      if (!inGame || !soundEnabled) {
        ambNoiseGain.gain.setTargetAtTime(0.0001, now, 0.3);
        ambHumGain.gain.setTargetAtTime(0.0001, now, 0.3);
        return;
      }
      if (room === 'lounge') {
        ambFilter.type = 'bandpass';
        ambFilter.frequency.setTargetAtTime(1050, now, 0.4);
        ambFilter.Q.setTargetAtTime(0.7, now, 0.4);
        ambNoiseGain.gain.setTargetAtTime(0.11, now, 0.5);
        ambHumGain.gain.setTargetAtTime(0.003, now, 0.4);
      } else if (room === 'radio') {
        ambFilter.type = 'bandpass';
        ambFilter.frequency.setTargetAtTime(1450, now, 0.4);
        ambFilter.Q.setTargetAtTime(1.1, now, 0.4);
        ambNoiseGain.gain.setTargetAtTime(sideBPlayed ? 0.03 : 0.065, now, 0.4);
        ambHumOsc.frequency.setTargetAtTime(120, now, 0.2);
        ambHumGain.gain.setTargetAtTime(0.008, now, 0.4);
      } else if (room === 'booth') {
        ambFilter.type = 'lowpass';
        ambFilter.frequency.setTargetAtTime(210, now, 0.4);
        ambNoiseGain.gain.setTargetAtTime(0.04, now, 0.4);
        ambHumOsc.frequency.setTargetAtTime(powered ? 120 : 60, now, 0.3);
        ambHumGain.gain.setTargetAtTime(powered ? 0.016 : 0.005, now, 0.4);
      } else if (room === 'carriage') {
        ambFilter.type = 'lowpass';
        ambFilter.frequency.setTargetAtTime(150, now, 0.4);
        ambNoiseGain.gain.setTargetAtTime(0.09, now, 0.5);
        ambHumOsc.frequency.setTargetAtTime(82.4, now, 0.3);
        ambHumGain.gain.setTargetAtTime(0.014, now, 0.5);
      } else if (room === 'outside') {
        ambFilter.type = 'bandpass';
        ambFilter.frequency.setTargetAtTime(460, now, 0.4);
        ambFilter.Q.setTargetAtTime(0.5, now, 0.4);
        ambNoiseGain.gain.setTargetAtTime(0.06, now, 0.5);
        ambHumGain.gain.setTargetAtTime(0.001, now, 0.4);
      } else {
        ambFilter.type = 'lowpass';
        ambFilter.frequency.setTargetAtTime(powered ? 240 : 140, now, 0.4);
        ambNoiseGain.gain.setTargetAtTime(0.045, now, 0.5);
        ambHumOsc.frequency.setTargetAtTime(trainArrived ? 98 : 120, now, 0.3);
        ambHumGain.gain.setTargetAtTime(trainArrived ? 0.014 : (powered ? 0.007 : 0.002), now, 0.5);
      }
    } catch {}
  }

  function playNote(freq, duration = 2.4, volume = 0.032, delay = 0, type = 'sine') {
    if (!audioCtx || !soundEnabled) return;
    try {
      const now = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const sub = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(freq * 0.5, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(920, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      sub.start(now);
      osc.stop(now + duration + 0.05);
      sub.stop(now + duration + 0.05);
    } catch {}
  }

  function startBGM() {
    if (bgmTimer) clearInterval(bgmTimer);
    const seqDark = [220.0, 261.63, 329.63, 293.66, 246.94, 196.0, 220.0, 164.81];
    const seqLit = [261.63, 329.63, 392.0, 493.88, 440.0, 349.23, 329.63, 293.66];
    const seqDawn = [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 440.0, 349.23];

    bgmTimer = setInterval(() => {
      if (!audioCtx || !soundEnabled || document.hidden) return;
      const phase = document.body.dataset.phase;
      if (phase !== 'playing' && phase !== 'opening') return;
      const palette = (room === 'carriage' || room === 'outside')
        ? seqDawn
        : (powered ? seqLit : seqDark);
      const note = palette[bgmStep % palette.length];
      playNote(note, powered ? 3.1 : 2.6, 0.026, 0, 'sine');
      if (bgmStep % 2 === 0 && powered) {
        playNote(note * 1.5, 2.8, 0.012, 0.18, 'triangle');
      }
      bgmStep += 1;
    }, 2400);

    if (railTimer) clearInterval(railTimer);
    railTimer = setInterval(() => {
      if (!audioCtx || !soundEnabled || document.hidden || room !== 'carriage') return;
      playSFX('railClick');
    }, 1800);
  }

  function playNoiseBurst(duration = 0.08, filterFreq = 1200, q = 2.0, volume = 0.06, delay = 0) {
    if (!audioCtx || !noiseBuffer || !soundEnabled) return;
    try {
      const now = audioCtx.currentTime + delay;
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.setValueAtTime(q, now);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      src.start(now, Math.random() * 2.0, duration + 0.02);
    } catch {}
  }

  function playSFX(type) {
    initAudio();
    if (!audioCtx || !soundEnabled) return;
    try {
      const now = audioCtx.currentTime;
      if (type === 'click') {
        playNoiseBurst(0.025, 1600, 3.0, 0.035);
      } else if (type === 'actCard') {
        playNote(196.0, 2.8, 0.04, 0, 'sine');
        playNote(293.66, 2.8, 0.035, 0.15, 'triangle');
        playNote(392.0, 3.0, 0.03, 0.35, 'sine');
      } else if (type === 'step') {
        playNoiseBurst(0.065, 320, 1.8, 0.09, 0);
        playNoiseBurst(0.06, 280, 1.8, 0.045, 0.19);
      } else if (type === 'paper') {
        playNoiseBurst(0.11, 2200, 1.2, 0.07, 0);
        playNoiseBurst(0.08, 2800, 1.4, 0.045, 0.06);
      } else if (type === 'dial') {
        playNote(880, 0.045, 0.04, 0, 'triangle');
        playNoiseBurst(0.02, 2400, 4.0, 0.05, 0);
      } else if (type === 'switch') {
        playNote(140, 0.09, 0.07, 0, 'sawtooth');
        playNoiseBurst(0.05, 680, 2.5, 0.08, 0.01);
      } else if (type === 'wrong') {
        playNote(110, 0.14, 0.06, 0, 'triangle');
        playNote(92, 0.18, 0.06, 0.12, 'triangle');
      } else if (type === 'unlock') {
        playNoiseBurst(0.05, 1900, 3.0, 0.08, 0);
        playNote(523.25, 0.9, 0.045, 0.06, 'sine');
        playNote(659.25, 1.3, 0.045, 0.18, 'sine');
      } else if (type === 'pickup') {
        playNote(587.33, 0.6, 0.04, 0, 'sine');
        playNote(880.0, 0.9, 0.035, 0.1, 'sine');
      } else if (type === 'power') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 1.2);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.45);
        [0.32, 0.68, 1.04].forEach((d, idx) => {
          playNoiseBurst(0.04, 1800 + idx * 300, 3.0, 0.07, d);
          playNote(261.63 * (1 + idx * 0.25), 0.7, 0.03, d + 0.02, 'sine');
        });
      } else if (type === 'punch') {
        playNoiseBurst(0.045, 2600, 3.5, 0.11, 0);
        playNote(620, 0.08, 0.05, 0.01, 'triangle');
      } else if (type === 'punchDone') {
        playNoiseBurst(0.05, 2600, 3.5, 0.11, 0);
        playNote(523.25, 1.0, 0.04, 0.08, 'sine');
        playNote(659.25, 1.1, 0.04, 0.20, 'sine');
        playNote(783.99, 1.4, 0.045, 0.32, 'sine');
      } else if (type === 'tune') {
        const carrier = 320 + tunerFreq * 95 + tunerPhase * 35;
        playNote(carrier, 0.18, 0.03, 0, 'sine');
        playNoiseBurst(0.09, 1400, 1.5, 0.05, 0);
      } else if (type === 'tapeB') {
        playNoiseBurst(0.06, 1200, 2.5, 0.07, 0);
        playNote(261.63, 2.0, 0.04, 0.08, 'sine');
        playNote(329.63, 2.2, 0.04, 0.22, 'sine');
        playNote(392.00, 2.4, 0.04, 0.36, 'sine');
        playNote(493.88, 2.8, 0.04, 0.50, 'sine');
      } else if (type === 'lantern') {
        playNote(1046.5, 0.3, 0.03, 0, 'sine');
        playNote(174.61, 1.3, 0.045, 0.22, 'sawtooth');
        playNote(220.00, 1.4, 0.045, 0.25, 'triangle');
      } else if (type === 'arrival') {
        playNote(196.00, 1.6, 0.055, 0.05, 'sawtooth');
        playNote(246.94, 1.7, 0.055, 0.08, 'triangle');
        playNoiseBurst(0.9, 950, 0.9, 0.09, 1.1);
        playNote(523.25, 0.9, 0.04, 1.65, 'sine');
        playNote(392.00, 1.2, 0.04, 1.95, 'sine');
      } else if (type === 'memory') {
        [523.25, 659.25, 783.99, 987.77].forEach((f, i) => {
          playNote(f, 1.6, 0.032, i * 0.18, 'sine');
        });
      } else if (type === 'railClick') {
        playNoiseBurst(0.03, 420, 2.5, 0.045, 0);
        playNoiseBurst(0.03, 380, 2.5, 0.04, 0.14);
        playNoiseBurst(0.03, 410, 2.5, 0.035, 0.48);
        playNoiseBurst(0.03, 370, 2.5, 0.03, 0.62);
      }
    } catch {}
  }

  window.addEventListener('pointerdown', () => initAudio(), { passive: true });
  window.addEventListener('keydown', () => initAudio(), { passive: true });

  // =========================================================================
  // Piano & Cursor-Following Ticket Punch State
  // =========================================================================
  const pianoNotes = [
    { key: '1', alt: 'a', label: ['1 (Do)', '1 (Do)'], freq: 261.63 },
    { key: '2', alt: 's', label: ['2 (Re)', '2 (Re)'], freq: 293.66 },
    { key: '3', alt: 'd', label: ['3 (Mi)', '3 (Mi)'], freq: 329.63 },
    { key: '4', alt: 'f', label: ['4 (Fa)', '4 (Fa)'], freq: 349.23 },
    { key: '5', alt: 'g', label: ['5 (Sol)', '5 (Sol)'], freq: 392.00 },
    { key: '6', alt: 'h', label: ['6 (La)', '6 (La)'], freq: 440.00 },
    { key: '7', alt: 'j', label: ['7 (Si)', '7 (Ti)'], freq: 493.88 },
  ];
  const pianoBlackNotes = [
    { slot: 0, key: 'w', label: ['♯1 (C♯)', '♯1 (C♯)'], freq: 277.18 },
    { slot: 1, key: 'e', label: ['♯2 (D♯)', '♯2 (D♯)'], freq: 311.13 },
    { slot: 3, key: 't', label: ['♯4 (F♯)', '♯4 (F♯)'], freq: 369.99 },
    { slot: 4, key: 'y', label: ['♯5 (G♯)', '♯5 (G♯)'], freq: 415.30 },
    { slot: 5, key: 'u', label: ['♯6 (A♯)', '♯6 (A♯)'], freq: 466.16 },
  ];
  let pianoTarget = [2, 4, 5, 4]; // Randomized 4-note melody indices (0..6)
  let pianoInput = [];
  let pianoActiveKey = -1;
  let pianoActiveBlackKey = -1;
  let pianoActiveTime = 0;
  let pianoSolved = false;

  // Cursor-Following Ticket Punch State (in 320x180 logical space)
  let mouseX = 160;
  let mouseY = 95;
  let punchedHoles = []; // Array of { x, y, stationIdx }
  // 5 Station Stamp Boxes on the Ticket (player must punch the 3 stops in stopOrder!)
  const ticketBoxes = [
    { x: 78, y: 92, stIdx: 0 },
    { x: 118, y: 92, stIdx: 1 },
    { x: 158, y: 92, stIdx: 2 },
    { x: 198, y: 92, stIdx: 3 },
    { x: 238, y: 92, stIdx: 4 },
  ];
  const allStationNames = [
    ['樟溪', 'Camphor'],
    ['霧河', 'Misty River'],
    ['望山', 'Mt. Pass'],
    ['海岬', 'Cape'],
    ['舊城', 'Old Town'],
  ];

  // Hands-Free Story Cutscene State
  let activeCutscene = ''; // 'cutscene-piano', 'cutscene-rain', 'cutscene-arrival'
  let cutsceneStart = 0;
  let cutsceneDuration = 13000;
  let cutsceneSubtitle = '';

  function randomizeExtras() {
    // Randomize 4-note childhood melody on the piano (never [0, 1, 2, 3])
    do {
      pianoTarget = [
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
      ];
    } while (
      (pianoTarget[0] === 0 && pianoTarget[1] === 1 && pianoTarget[2] === 2) ||
      (pianoTarget[0] === pianoTarget[1] && pianoTarget[1] === pianoTarget[2])
    );
    pianoInput = [];
    punchedHoles = [];
  }
  randomizeExtras();

  function playPianoKey(idx) {
    if (idx < 0 || idx >= pianoNotes.length) return;
    initAudio();
    pianoActiveKey = idx;
    pianoActiveBlackKey = -1;
    pianoActiveTime = performance.now();
    const note = pianoNotes[idx];
    // Felt upright piano synthesis (fundamental + warm 2nd & 3rd harmonics + key thump)
    playNote(note.freq, 2.2, 0.055, 0, 'triangle');
    playNote(note.freq * 2, 1.1, 0.018, 0, 'sine');
    playNoiseBurst(0.018, 900, 2.5, 0.025, 0);

    if (puzzle === 'pianoGame' && !pianoSolved) {
      pianoInput.push(idx);
      if (pianoInput.length > 4) pianoInput.shift();

      // Check if last 4 notes match pianoTarget
      if (
        pianoInput.length === 4 &&
        pianoInput.every((val, i) => val === pianoTarget[i])
      ) {
        pianoSolved = true;
        puzzle = '';
        setTimeout(() => {
          playSFX('unlock');
          startCutscene('cutscene-piano', 13500);
        }, 380);
      } else {
        feedback = [
          `琴音在空曠的大廳迴盪（目前已彈奏：${pianoInput.map((n) => n + 1).join(' - ')}）。照著琴譜上的四個音彈奏，就能解開譜架暗格。`,
          `The note echoes through the hall (Played: ${pianoInput.map((n) => n + 1).join(' - ')}). Play the four notes on the sheet music to unlock the music stand.`
        ];
      }
      render();
    } else {
      paint('', 1, performance.now());
    }
  }

  function playPianoBlackKey(bIdx) {
    if (bIdx < 0 || bIdx >= pianoBlackNotes.length) return;
    initAudio();
    pianoActiveKey = -1;
    pianoActiveBlackKey = bIdx;
    pianoActiveTime = performance.now();
    const note = pianoBlackNotes[bIdx];
    playNote(note.freq, 2.1, 0.052, 0, 'triangle');
    playNote(note.freq * 2, 1.0, 0.016, 0, 'sine');
    playNoiseBurst(0.018, 950, 2.5, 0.024, 0);
    if (puzzle === 'pianoGame' && !pianoSolved) {
      feedback = [
        `半音黑鍵（${note.label[0]}）在候車大廳裡輕輕迴響。你也可以自由結合白鍵（1–7 / A–J）與黑鍵（W E T Y U）彈奏。`,
        `The sharp black key (${note.label[1]}) resonates softly through the hall. Play freely with both white keys (1–7 / A–J) and black keys (W E T Y U).`
      ];
      render();
    } else {
      paint('', 1, performance.now());
    }
  }

  // Keyboard listener for playing the piano directly with 1-7 / A-J (white keys) and W E T Y U (black keys)!
  window.addEventListener('keydown', (e) => {
    if (puzzle !== 'pianoGame' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const bIdx = pianoBlackNotes.findIndex((n) => n.key === k);
    if (bIdx !== -1) {
      e.preventDefault();
      playPianoBlackKey(bIdx);
      return;
    }
    const idx = pianoNotes.findIndex((n) => n.key === k || n.alt === k);
    if (idx !== -1) {
      e.preventDefault();
      playPianoKey(idx);
    }
  });

  // =========================================================================
  // Full-Screen Black Act Intertitle Transition
  // =========================================================================
  const actCards = {
    1: {
      eyebrow: ['ACT I · 第一幕', 'ACT I'],
      title: ['微涼的餘溫', 'Still Warmth'],
      sub: [
        '「如果有人醒來，檔案室桌上有熱茶，別著涼了。」',
        '“If anyone wakes up, there is warm tea on the archive table.”'
      ],
    },
    2: {
      eyebrow: ['ACT II · 第二幕', 'ACT II'],
      title: ['未寄出的家書', 'The Unsent Letter'],
      sub: [
        '「桌上的茶還是溫熱的，壓在杯底的信籤已經等了你一整年。」',
        '“The tea on the desk is still warm, and the letter beneath it has waited all year.”'
      ],
    },
    3: {
      eyebrow: ['ACT III · 第三幕', 'ACT III'],
      title: ['穿過長夜的訊號', 'Signal Through the Night'],
      sub: [
        '「別怪自己回來得太晚，也別怪自己還不知道要找什麼。」',
        '“Don’t blame yourself for coming home late, or for not knowing what you seek.”'
      ],
    },
    4: {
      eyebrow: ['FINALE · 終章', 'FINALE'],
      title: ['破曉前的末班車', 'The Last Train Before Dawn'],
      sub: [
        '「天亮以後，別再回頭看這座舊車站了，好好往前走。」',
        '“When morning comes, don’t look back at this old station anymore.”'
      ],
    },
  };

  let actCardTimer = 0;
  function showActCard(actNumber) {
    const card = get('act-card');
    if (!card || !actCards[actNumber]) return;
    const info = actCards[actNumber];
    get('act-eyebrow').textContent = say(...info.eyebrow);
    get('act-title').textContent = say(...info.title);
    get('act-sub').textContent = say(...info.sub);
    card.hidden = false;
    playSFX('actCard');

    clearTimeout(actCardTimer);
    const hideCard = () => {
      card.hidden = true;
      get('location')?.focus({ preventScroll: true });
    };
    card.onclick = hideCard;
    actCardTimer = setTimeout(hideCard, reduced.matches ? 400 : 2750);
  }

  // =========================================================================
  // Hands-Free Cinematic Story Cutscenes
  // =========================================================================
  function getCutsceneStageText(name, progress) {
    if (name === 'cutscene-piano') {
      if (progress < 0.36) {
        return say(
          '很多年前的下雨午後，候車大廳的燈也是這樣暖黃。年幼的你坐在琴椅上夠不到踏板，老站長父親坐在身旁，寬厚的手掌輕輕覆在你的手背上。',
          'Many years ago on a rainy afternoon, the hall lamp glowed this same warm amber. Young you sat at the piano unable to reach the pedals, while your father gently guided your hands across the keys.'
        );
      }
      if (progress < 0.72) {
        return say(
          '彈完那首曲子，他拿著鉛筆蹲在磁磚柱前，在柱面上畫下一道刻痕，笑著說：「等你長到比這道刻痕高的時候，就能一個人搭車去很遠的地方了。」',
          'After the song, he knelt by the tile pillar with a pencil, marking a line on the column with a smile: “When you grow taller than this mark, you’ll be able to take the train anywhere on your own.”'
        );
      }
      return say(
        '往事的光影隨雨聲漸漸淡去。琴譜架下的暗格喀一聲彈開，露出裡面泛黃的舊信紙。',
        'The memory dissolves softly into the sound of rain. A hidden compartment beneath the music stand clicks open, revealing yellowed pages inside.'
      );
    }

    if (name === 'cutscene-rain') {
      if (progress < 0.35) {
        return say(
          '七年前的那個夜晚，傾盆大雨打在月台遮雨棚上。年輕氣盛的你提著行李走向列車，頭也沒有回地說：「這座小站太小了，我走了以後不會再回來。」',
          'Seven years ago, rain lashed the platform roof. Carrying your bag toward the train without looking back, you told him: “This station is too small. Once I leave, I’m not coming back.”'
        );
      }
      if (progress < 0.72) {
        return say(
          '老站長撐著一把黑傘追到月台邊，卻被緩緩關上的車門隔開。他隔著起霧的車窗大喊：「外面的路要是走累了，隨時回來！只要我還在，末班車就會等你！」',
          'Your father hurried to the platform edge holding out a black umbrella, separated from you by the closing doors. Through the fogged glass he called out: “If you ever get tired out there, come home! As long as I’m here, the last train will wait!”'
        );
      }
      return say(
        '列車駛進黑暗的隧道。年邁的他獨自站在空蕩蕩的月台燈下，舉著那把沒能送出去的黑傘，直到車尾燈徹底消失。而現在，這把傘終於回到了你手裡。',
        'The train vanished into the tunnel. He stood alone beneath the platform lamp holding the umbrella he couldn’t give you. Now, after seven years, that umbrella is finally in your hands.'
      );
    }

    if (name === 'cutscene-arrival') {
      if (progress < 0.38) {
        return say(
          '隧道深處的霧氣被兩道刺眼的暖白車頭燈劃破。鐵軌微微震動，銀灰色的末班列車伴隨著悠長的鳴笛，緩緩滑入第四〇四號月台。',
          'Twin warm headlights pierce the tunnel mist. The rails hum as the silver-gray last train sounds a long horn and glides into Platform 404.'
        );
      }
      if (progress < 0.75) {
        return say(
          '氣動車門輕輕向兩側滑開，車廂裡透出溫暖柔和的燈光，在潮濕的月台地磚上映出長長的光影。',
          'The pneumatic doors slide open, spilling warm light across the wet platform tiles.'
        );
      }
      return say(
        '老站長一生守候的最後一班車，已經停在你面前了。',
        'The final train your father waited his whole life to send off now rests before you.'
      );
    }
    return '';
  }

  function startCutscene(name, duration = 13000) {
    activeCutscene = name;
    cutsceneStart = performance.now();
    cutsceneDuration = reduced.matches ? 600 : duration;
    playSFX('memory');
    render();
  }

  // =========================================================================
  // Classical Poetic Clues (古詩線索，無括號直白劇透，與隨機謎題完全同步)
  // =========================================================================
  const roomMeta = {
    station: { code: ['01 / 第四〇四號月台', '01 / PLATFORM 404'] },
    service: { code: ['02 / 維修室', '02 / SERVICE ROOM'] },
    archive: { code: ['03 / 站務檔案室', '03 / ARCHIVE'] },
    booth: { code: ['04 / 配電控制室', '04 / CONTROL ROOM'] },
    lounge: { code: ['05 / 候車大廳', '05 / WAITING HALL'] },
    gate: { code: ['06 / 出口閘門', '06 / EXIT GATE'] },
    radio: { code: ['07 / 廣播室', '07 / BROADCAST ROOM'] },
    outside: { code: ['08 / 地面無名街口', '08 / STREET LEVEL'] },
    carriage: { code: ['09 / 末班車廂', '09 / LAST TRAIN'] },
  };

  const cnNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const heightPoeticWords = ['百一十', '百二五', '百四十', '百五五', '百六八'];
  const trackPoeticWords = ['一〇二', '二〇七', '三〇五', '四〇四', '五一〇'];

  function getNoteText(key) {
    if (key === 'schedule') {
      // Classical Poem 1: 〈夜車行〉encoding lockerTarget[0], lockerTarget[1], lockerTarget[2]
      // Symbols: 0=彎月, 1=圓圈, 2=水波, 3=星芒, 4=山稜
      const firstLines = [
        '初發蛾眉彎月下',
        '初發團團圓圈月',
        '初發盈盈水波畔',
        '初發熠熠星芒底',
        '初發蒼蒼山稜口',
      ];
      const midLines = [
        '中渡清輝彎月影',
        '中渡澄明圓圈影',
        '中渡迢遞水波聲',
        '中渡闌干星芒落',
        '中渡嶙峋山稜雪',
      ];
      const endLines = [
        '終歸一鉤彎月眠',
        '終歸萬里圓圈夢',
        '終歸淼淼水波間',
        '終歸耿耿星芒曉',
        '終歸巍巍山稜巔',
      ];
      const s1 = symbolDefs[lockerTarget[0]][1];
      const s2 = symbolDefs[lockerTarget[1]][1];
      const s3 = symbolDefs[lockerTarget[2]][1];
      return [
        `〈夜車行〉「夜雨孤燈四〇四，歸程三印莫相忘：${firstLines[lockerTarget[0]]}，${midLines[lockerTarget[1]]}，${endLines[lockerTarget[2]]}。」`,
        `[Verse of the Night Train] “Lonely lamp on Platform 404, remember the three emblems of the homeward journey: First departing beneath the ${s1}, crossing at mid-journey through the ${s2}, and finally coming home to rest beside the ${s3}.”`
      ];
    }
    if (key === 'manual') {
      // Classical Poem 2: 〈送電吟〉encoding circuitTarget[0], circuitTarget[1], circuitTarget[2]
      // Circuits: 0=照明迴路, 1=廣播迴路, 2=號誌迴路
      const cFirst = [
        '先引照明破夜台',
        '先傳廣播徹夜台',
        '先明號誌定夜台',
      ];
      const cSecond = [
        '繼燃照明暖塵埃',
        '繼開廣播入夢來',
        '繼舉號誌引車來',
      ];
      const cThird = [
        '終教萬盞照明合',
        '終教萬里廣播開',
        '終教萬里號誌開',
      ];
      const e1 = circuitDefs[circuitTarget[0]][1];
      const e2 = circuitDefs[circuitTarget[1]][1];
      const e3 = circuitDefs[circuitTarget[2]][1];
      return [
        `〈送電吟〉「${cFirst[circuitTarget[0]]}，${cSecond[circuitTarget[1]]}。${cThird[circuitTarget[2]]}，地脈沉雷莫妄動。」`,
        `[Verse of the Circuits] “First awaken ${e1} across the dark platform, next kindle ${e2} through the mist; finally let ${e3} open the way, and leave the grounded earth untouched.”`
      ];
    }
    if (key === 'letter') {
      // Classical Poem 3: 〈寄遠人〉encoding Piano 4 notes, Suitcase 3 wheels (Season, Height, Track), and Radio Freq/Phase
      const nStr = pianoTarget.map((n) => cnNums[n + 1]).join('');
      const nEn = pianoTarget.map((n) => n + 1).join('-');
      const seasonWords = ['春霧', '夏雷', '秋霜', '冬雪', '梅雨'];
      const sWord = seasonWords[dialTarget[0]];
      const hWord = heightPoeticWords[dialTarget[1]];
      const trWord = trackPoeticWords[dialTarget[2]];
      const chWord = cnNums[tunerTargetFreq + 1];
      const phWord = cnNums[tunerTargetPhase + 1];
      return [
        `〈寄遠人〉「舊譜輕彈${nStr}音，空堂聽雨憶兒時。猶記${sWord}別離夜，柱留${hWord}寸心知。票印${trWord}歸期遠，頻尋${chWord}道${phWord}相思。」`,
        `[Poem for the Traveler] “Lightly play the old score of ${nEn} as rain falls on the hall. I still remember the night of ${dialOptions[0][dialTarget[0]][1]} when you left; the pillar keeps your mark at ${dialOptions[1][dialTarget[1]][1]}, and your ticket bears ${dialOptions[2][dialTarget[2]][1]}. To hear my parting words, seek channel ${tunerTargetFreq + 1} and phase ${tunerTargetPhase + 1}.”`
      ];
    }
    return ['', ''];
  }

  function getRoomText(key) {
    if (key === 'station') {
      if (trainArrived) {
        return [
          ['第四〇四號月台', 'Platform 404'],
          [
            '銀灰色的末班列車靜靜停靠在月台邊，敞開的車門透出溫暖柔和的燈光，在潮濕的地磚上映出長長的光影。\n\n老站長守候了一整生的最後一班車，已經準備好發車了。',
            'The silver-gray last train rests beside the platform, warm light spilling from its open doors across the wet tiles.\n\nThe final train the old stationmaster waited his whole life to send off is ready for departure.'
          ]
        ];
      }
      if (trainApproaching) {
        return [
          ['第四〇四號月台', 'Platform 404'],
          [
            '隧道深處傳來低沉的鐵軌共鳴，兩道車頭燈光在濃霧裡若隱若現。\n\n月台柱旁掛著父親生前使用的黃銅手提號誌燈——需要有人站在月台邊舉燈打出三次進站號誌，引導末班車安全停靠。',
            'A deep rumble echoes from the tunnel as twin headlights glimmer through the mist.\n\nYour father’s brass signal lantern hangs by the pillar—someone must raise it three times at the platform edge to guide the last train in.'
          ]
        ];
      }
      if (powered) {
        return [
          ['第四〇四號月台', 'Platform 404'],
          [
            '頭頂的日光燈管一盞盞亮起，微涼的光束穿過地底薄霧灑在磨石子地磚上。月台對面的「候車大廳」毛玻璃門已經解鎖，透出溫暖的琥珀色燈光。\n\n你忽然想起，檔案室桌上還留著那杯溫熱的茶。',
            'Overhead fluorescent tubes hum softly, casting cool light shafts through the underground mist onto the terrazzo floor. Across the tracks, the frosted glass doors of the Waiting Hall glow with warm amber light.\n\nYou remember the cup of warm tea waiting on the desk in the Archive.'
          ]
        ];
      }
      return [
        ['第四〇四號月台', 'Platform 404'],
        [
          '你在微涼的地下月台長椅上醒來，肩上蓋著一件熟悉的舊站務大衣，口袋裡揣著一張七年前的回程票。廣播說到「末班車即將……」便斷了電。\n\n維修室門上貼著老站長熟悉的字跡：「又在車上睡著了吧？地底風涼，備用保險絲鎖在維修櫃裡。先把電接上，檔案室桌上有溫熱的茶。」',
          'You wake on a cool underground platform bench with a familiar old station coat draped over your shoulders and a seven-year-old return ticket in your pocket. The PA cuts out at “The last train will…”\n\nA note in the old stationmaster’s handwriting is taped to the service door: “Fell asleep on the train again? It’s cold underground—the spare fuse is in the service cabinet. Turn the power on first; there is warm tea on the archive table.”'
        ]
      ];
    }
    if (key === 'service') {
      return [
        ['維修室', 'Service Room'],
        lockerOpen
          ? [
              '工作台旁的鐵櫃已經打開，老舊的燈泡在牆面投下柔和的暗影。牆角整齊排著老站長保養了數十年的維修工具。',
              'The metal cabinet beside the workbench stands open beneath a dim work lamp. Tools maintained for decades line the corner neatly.'
            ]
          : [
              '機油與舊鐵器的氣味瀰漫在狹小的房間裡。備用保險絲鎖在牆角的鐵櫃中，鎖面嵌著五枚黃銅符號按鍵，旁邊刻著一行小字：「依月台題詩〈夜車行〉之三印順序開啟。」',
              'The scent of machine oil fills the small room. A spare fuse is locked inside the corner cabinet. Its brass keypad bears five symbols, inscribed: “Press the three emblems in the order of the platform poem.”'
            ]
      ];
    }
    if (key === 'archive') {
      return [
        ['站務檔案室', 'Station Archive'],
        teaChecked
          ? [
              '一排排值班日誌整齊停在去年冬天。木桌上那杯溫熱的茶散發著熟悉的清香，壓在杯底的家書背面題著一首老站長親筆寫下的〈寄遠人〉。\n\n他生前怕你在廢站這晚回來時面對一座冰冷黑暗的空車站，依然像從前一樣，替晚歸的你留了一盞燈與一杯溫熱的茶。',
              'Rows of shift journals end last winter. The cup of warm tea on the desk gives off a familiar fragrance, and on the back of the letter beneath it is a poem written in your father’s hand.\n\nAfraid you might return on the night the station closed to find it dark and cold, he left a lamp and a cup of warm tea waiting for you, just as he always did.'
            ]
          : [
              '高窗透進微弱的月光，照見一排排停在同一晚的值班日誌。前景木桌上放著一杯溫熱的茶，旁邊擺著一本題有〈送電吟〉的配電手札，讓人以為老站長才剛離開座位不久。',
              'Faint moonlight filters through the high window across rows of shift logs. On the wooden table sits a cup of warm tea beside a power manual, as if the stationmaster just stepped away.'
            ]
      ];
    }
    if (key === 'booth') {
      return [
        ['配電控制室', 'Control Room'],
        powered
          ? [
              '三支主迴路閘刀都已推至頂端，類比電壓表散發著溫暖的琥珀色背光，指針穩定停在中央。',
              'All three main circuit levers are engaged at the top. The analog voltage gauges glow with warm amber backlight.'
            ]
          : [
              '四支沉重的黃銅閘刀排在斷電的配電盤前。出口閘門、候車大廳與廣播室都仰賴這組備援電源。',
              'Four heavy brass breaker levers sit on the dead distribution board. The exit gate, waiting hall, and broadcast room all rely on this backup supply.'
            ]
      ];
    }
    if (key === 'lounge') {
      return [
        ['候車大廳', 'Waiting Hall'],
        suitcaseOpen
          ? [
              '氣窗外下著綿密的夜雨，琥珀色立燈將溫暖的光暈灑在木長椅與角落那台老立式鋼琴上。\n\n長椅上的舊皮箱已經打開，裡面放著父親留給你的黑傘、合照、站長驗票鉗與那捲 B 面錄音帶。大廳盡頭通往「廣播室」的側門正亮著微光，那裡有可以播放這捲磁帶的盤式錄音機。',
              'Night rain streaks down the high window while an amber floor lamp bathes the wooden bench and the old upright piano in warm light.\n\nThe leather suitcase on the bench lies open, holding the black umbrella, photo, ticket punch, and Side-B cassette tape. At the end of the hall, the side door to the Broadcast Room glows softly—its tape deck can play the cassette.'
            ]
          : [
              '氣窗外下著綿密的夜雨，雨滴在玻璃上折射出微光。琥珀色立燈照亮了木長椅上的舊皮箱，大廳角落靜靜擺著一台老舊的立式鋼琴，旁邊的磁磚柱上留著幾道鉛筆刻痕。',
              'Rain streaks down the high windowpane, catching the light. An amber floor lamp illuminates an old leather suitcase on the wooden bench, while a weathered upright piano stands quietly in the corner beside a tile pillar marked with pencil lines.'
            ]
      ];
    }
    if (key === 'gate') {
      return [
        ['出口閘門', 'Exit Gate'],
        powered
          ? [
              '鐵捲門已經升起，露出通往地面街口的長階梯。側邊是亮著暖紅「ON AIR」燈號的廣播室木門。',
              'The iron grille has risen, revealing the long stairs up to the street. Beside it stands the broadcast room door beneath a warm “ON AIR” lamp.'
            ]
          : [
              '沉重的鐵欄擋住了去路。門後有通往地面的樓梯與廣播室，但控制線路目前沒有電。',
              'A heavy iron grille blocks the way to the stairs and the broadcast room. The control line is currently unpowered.'
            ]
      ];
    }
    if (key === 'radio') {
      return [
        ['廣播室', 'Broadcast Room'],
        sideBPlayed
          ? [
              '盤式錄音機的捲軸安靜停下，真空管示波器還閃著柔和的餘暉。老站長留在人世的最後一段話已經播完了，窗外的月台正傳來末班車進站的震動聲。',
              'The tape reels have come to rest while the vacuum-tube oscilloscope glows softly. Your father’s final message has finished playing, and the vibration of the approaching last train echoes from the platform outside.'
            ]
          : [
              '隔音玻璃外就是無名月台。桌上的盤式錄音機緩緩轉動，真空管示波器泛著微光。耳機裡重複著老站長生前錄下的例行廣播：「我答應過，只要那孩子回來找這個地方，我就給他留一盞燈。」',
              'Beyond the glass lies the platform. On the desk, a tape deck spins slowly beside a glowing vacuum-tube oscilloscope. In the headphones, the attendant’s routine recording repeats: “I promised that if my child ever came back looking for this place, I would leave a light on.”'
            ]
      ];
    }
    if (key === 'carriage') {
      return [
        ['末班車廂 · 破曉', 'Last Train · Daybreak'],
        [
          '你坐在溫暖的木質車廂窗邊，父親留下的黑傘靠在膝旁，剪過孔的回程票靜靜放在窗台上。\n\n列車駛出幽暗的地底隧道，窗外依序掠過波光粼粼的霧河岸與雲海翻湧的望山隘口，破曉的第一道金白晨光正穿透車窗灑在你身上。',
          'You sit by the warm wooden carriage window with your father’s black umbrella beside your knee and your punched return ticket on the sill.\n\nThe train emerges from the underground tunnel, gliding past the shimmering Misty Riverside and the clouds of Mountain Pass as golden-white daybreak fills the car.'
        ]
      ];
    }
    return [
      ['地面無名街口', 'Street Level'],
      [
        '你走上最後一階。天快亮了，微涼的晨風吹過這條安靜的街道。',
        'You climb the final step. Dawn is breaking, and a cool morning breeze sweeps down the quiet street.'
      ]
    ];
  }

  function getPuzzleConfig(key) {
    if (key === 'locker') {
      return {
        title: ['維修櫃五鍵符號鎖', '5-Key Symbol Lock'],
        labels: symbolDefs,
        order: lockerTarget,
        prompt: [
          '五枚黃銅按鍵分別刻著「彎月、圓圈、水波、星芒、山稜」。請參照月台木牌上的古詩〈夜車行〉，依「初發、中渡、終歸」之序按下三枚印記。',
          'Five brass keys bear the Crescent, Circle, Wave, Star, and Peak. Follow the platform verse “Verse of the Night Train” and press the three emblems in order.'
        ],
        hint: clues.has('schedule')
          ? getNoteText('schedule')
          : ['月台牆上的木牌似乎題著一首關於行車印記的〈夜車行〉。', 'A wooden plaque on the platform bears a poem about the route’s emblems.'],
      };
    }
    if (key === 'circuits') {
      return {
        title: ['備援電源配電盤', 'Backup Power Board'],
        labels: circuitDefs,
        order: circuitTarget,
        prompt: [
          '四支沉重的黃銅閘刀排在配電盤上。請參照檔案室手札上的〈送電吟〉，避開地脈接地，依詩中「先、繼、終」之序推上三道迴路。',
          'Four brass levers line the breaker board. Follow the “Verse of the Circuits” from the Archive manual to engage the three main circuits in order.'
        ],
        hint: clues.has('manual')
          ? getNoteText('manual')
          : ['站務檔案室的木桌上有一本題著〈送電吟〉的手札。', 'A manual on the Archive desk contains the “Verse of the Circuits.”'],
      };
    }
    if (key === 'pianoGame') {
      return {
        title: ['候車大廳立式鋼琴（可點擊黑白鍵或按鍵盤彈奏）', 'Hall Upright Piano (Click keys or play with keyboard)'],
        prompt: [
          '你可以自由點擊白鍵與黑鍵（或按鍵盤 1～7 / A～J 與 W E T Y U）彈奏。若依序彈出父親家書題詩〈寄遠人〉首句所藏的四個音，就能解開譜架暗格。',
          'Click the white and black keys (or press 1–7 / A–J and W E T Y U) to play freely. Playing the four notes hidden in the first line of your father’s poem will unlock the music stand.'
        ],
        hint: clues.has('letter')
          ? getNoteText('letter')
          : ['接通電源後，去站務檔案室看看那杯溫熱的茶與壓在杯底的家書吧。', 'Once power is on, check the warm teacup and the letter beneath it in the Archive.'],
      };
    }
    if (key === 'suitcase') {
      return {
        title: ['舊皮箱三輪記憶鎖', 'Suitcase Memory Lock'],
        prompt: [
          '三組黃銅轉輪分別對應「別離季節 · 柱上刻痕 · 車票番號」。請吟味老站長家書背面的古詩〈寄遠人〉（或查看大廳柱面與隨身車票），對準三組轉輪後開鎖。',
          'The three brass wheels correspond to “Season · Pillar Mark · Ticket Track”. Read your father’s poem (or inspect the hall pillar and pocket ticket) to align the wheels.'
        ],
        hint: clues.has('letter')
          ? getNoteText('letter')
          : ['線索藏在檔案室家書背面的〈寄遠人〉詩中，亦可查看大廳磁磚柱與隨身車票。', 'Clues are woven into the poem on the back of the Archive letter, as well as the hall pillar and your ticket.'],
      };
    }
    if (key === 'punchGame') {
      return {
        title: ['手持站長驗票鉗（移動滑鼠對準印記格，點擊即可剪孔）', 'Holding Conductor’s Ticket Punch (Move cursor & click to punch)'],
        prompt: [
          '手上的黃銅驗票鉗會跟隨你的游標移動。車票上印著「彎月、圓圈、水波、星芒、山稜」五格印記，請依月台古詩〈夜車行〉中「初發、中渡、終歸」三印之序，移動驗票鉗至對應方格並點擊剪孔。',
          'The brass punch follows your cursor across the five emblem boxes on the ticket. Following the platform poem “Verse of the Night Train”, move the punch over the three emblems in order and click to clip each hole.'
        ],
        hint: clues.has('schedule')
          ? getNoteText('schedule')
          : ['月台木牌上的古詩〈夜車行〉記載了初發、中渡、終歸的三枚印記。', 'The poem on the platform plaque describes the three emblems in travel order.'],
      };
    }
    if (key === 'tunerGame') {
      return {
        title: ['廣播室真空管調頻台', 'Vacuum-Tube Wave Receiver'],
        prompt: [
          '轉動右側的「頻率波段」與「相位微調」兩顆旋鈕，參照家書〈寄遠人〉末句所藏的道數，讓亮白色的即時波形與基準波完全重合。',
          'Turn the Frequency and Phase knobs on the right, following the final line of your father’s poem until the live waveform locks onto the reference wave.'
        ],
        hint: clues.has('letter')
          ? getNoteText('letter')
          : ['家書背面的〈寄遠人〉末句「頻尋……道……相思」記載了波段與相位。', 'The final line of the poem in the Archive letter holds the channel and phase numbers.'],
      };
    }
    if (key === 'lanternGame') {
      return {
        title: ['月台手提號誌燈', 'Platform Signal Lantern'],
        prompt: [
          '凝視手提號誌燈的琥珀色光圈，當外圍收縮的光圈與中央燈框重疊時點擊畫面揮燈，向隧道裡的末班車發送三次進站號誌。',
          'Watch the lantern’s amber glow and click to raise the lantern when the converging ring overlaps the inner frame, sending three docking signals.'
        ],
        hint: [
          '當白色收縮圓環進入手提燈中央的雙線圓框時點擊即可。共需發送三次號誌引導列車停靠。',
          'Click when the shrinking ring enters the double circle at the center of the lantern. Three signals will dock the train.'
        ],
      };
    }
    return {};
  }

  function getInventoryList() {
    const items = [];
    const trWord = trackPoeticWords[dialTarget[2]];
    items.push({
      id: 'ticket',
      name: ticketPunched
        ? ['已剪孔的回程票', 'Punched Ticket']
        : ['七年前的回程票', 'Old Return Ticket'],
      desc: ticketPunched
        ? [
            '車票上已由你親手剪下三枚整齊的圓孔，背面浮現出老站長用鉛筆寫的一行小字：「無論走得多遠，這張車票永遠有效。」',
            'Three neat holes are clipped into the ticket, revealing pencil writing on the back: “No matter how far you go, this ticket is always valid.”'
          ]
        : [
            `七年前老站長塞進你大衣口袋的回程票。票面角落印著微小的「${trWord}番」字樣，五格印記欄還未剪上驗票孔。`,
            `The return ticket your father tucked into your coat seven years ago. The corner is faintly stamped “Track ${dialOptions[2][dialTarget[2]][1]}”, and its five emblem boxes are still unpunched.`
          ]
    });
    if (hasFuse) {
      items.push({
        id: 'fuse',
        name: ['備用保險絲', 'Spare Fuse'],
        desc: [
          '從維修櫃取出的玻璃管保險絲，鎢絲完好，可以裝進配電控制室的主電源槽。',
          'A heavy-duty glass fuse from the service cabinet. It fits the main socket in the Control Room.'
        ]
      });
    }
    if (hasPunch) {
      items.push({
        id: 'punch',
        name: ['站長驗票鉗', 'Ticket Punch'],
        desc: [
          '父親使用了四十年的黃銅驗票鉗，握柄被手掌摩挲得溫潤發亮。在候車大廳或點擊車票即可拿在手上替回程票剪孔。',
          'The brass ticket punch your father used for forty years, its handle worn smooth. Use it in the Waiting Hall or click your ticket to clip the route.'
        ]
      });
    }
    if (hasPhoto) {
      items.push({
        id: 'photo',
        name: ['父子合照與黑傘', 'Photo & Umbrella'],
        desc: [
          '皮箱裡留著七年前你賭氣沒拿的黑傘，以及小時候父親在候車廳柱子刻痕前替你拍下的合照。點擊可重溫當年的記憶。',
          'The black umbrella you refused seven years ago, alongside a photo taken by the height mark on the hall pillar. Click to revisit the memory.'
        ]
      });
    }
    if (hasSideB) {
      items.push({
        id: 'tapeB',
        name: ['父親的錄音帶', 'Father’s Tape'],
        desc: [
          '手寫標籤寫著：「B 面 · 給回家的你」。將它帶去「廣播室」放進盤式錄音機裡，就能聽見父親留下的聲音。',
          'Labeled in your father’s handwriting: “Side B · For You, Coming Home.” Take it to the Broadcast Room to play it on the reel-to-reel deck.'
        ]
      });
    }
    return items;
  }

  function computeProgress() {
    let score = 1;
    if (clues.has('schedule')) score += 1;
    if (lockerOpen) score += 2;
    if (powered) score += 2;
    if (teaChecked) score += 2;
    if (pianoSolved) score += 1;
    if (suitcaseOpen) score += 2;
    if (ticketPunched) score += 1;
    if (sideBPlayed) score += 1;
    if (trainArrived) score += 1;
    if (ending) score = 15;
    return Math.min(100, Math.round((score / 15) * 100));
  }

  // =========================================================================
  // HDR Volumetric & High-Definition 640x360 Renderer
  // =========================================================================
  function rect(color, x, y, width, height) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
  function strokeRect(color, x, y, width, height, lw = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }
  function shape(color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }
  function circle(color, cx, cy, r, hollow = false, lw = 1.6) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (hollow) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  function radialGlow(cx, cy, rInner, rOuter, colorStart, colorEnd = 'rgba(0,0,0,0)') {
    const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fill();
  }
  function linearRay(x0, y0, x1, y1, points, colorStart, colorEnd = 'rgba(0,0,0,0)') {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    shape(grad, points);
  }
  function grain(seed, count) {
    for (let i = 0; i < count; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = (seed % 640) * 0.5;
      const y = ((seed >>> 10) % 360) * 0.5;
      rect(i % 5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.16)', x, y, (i % 2) + 0.5, 0.5);
    }
  }

  function drawSymbolIcon(type, cx, cy, color = '#f0efed', bgColor = '#141416') {
    if (type === 0) {
      // Crescent Moon (彎月)
      circle(color, cx, cy, 7.5);
      circle(bgColor, cx + 3.5, cy - 2, 6.2);
    } else if (type === 1) {
      // Circle (圓圈)
      circle(color, cx, cy, 7.5, true, 1.8);
      circle(color, cx, cy, 2.2);
    } else if (type === 2) {
      // Wave (水波)
      for (let row = -4; row <= 4; row += 4) {
        for (let dx = -8; dx <= 6; dx += 4) {
          rect(color, cx + dx, cy + row, 2, 1.5);
          rect(color, cx + dx + 2, cy + row + 1.5, 2, 1.5);
        }
      }
    } else if (type === 3) {
      // Star (星芒)
      shape(color, [[cx, cy - 8], [cx + 2.2, cy - 2.2], [cx + 8, cy], [cx + 2.2, cy + 2.2], [cx, cy + 8], [cx - 2.2, cy + 2.2], [cx - 8, cy], [cx - 2.2, cy - 2.2]]);
    } else {
      // Mountain Peak (山稜)
      shape(color, [[cx - 9, cy + 6], [cx - 2, cy - 6], [cx + 3, cy + 1], [cx + 5, cy - 3], [cx + 9, cy + 6]]);
    }
  }

  function getTunerLockPercent() {
    const freqDiff = Math.abs(tunerFreq - tunerTargetFreq);
    const phaseDiff = Math.abs(tunerPhase - tunerTargetPhase);
    return Math.max(12, Math.round(100 - freqDiff * 24 - phaseDiff * 20));
  }

  // Render Hands-Free Cinematic Story Cutscenes (320x180 logical space scaled 2x to 640x360)
  function paintCutscene(name, progress, t) {
    rect('#07070a', 0, 0, 320, 180);

    if (name === 'cutscene-piano') {
      // Warm nostalgic sepia-amber & twilight vignette
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 180);
      bgGrad.addColorStop(0, '#121016');
      bgGrad.addColorStop(1, '#261e18');
      rect(bgGrad, 0, 0, 320, 180);

      if (progress < 0.36) {
        // Shot 1: Father & child sitting together at the upright piano in warm golden light
        radialGlow(160, 75, 10, 145, 'rgba(255, 224, 165, 0.32)');
        linearRay(90, 0, 180, 170, [[70, 0], [135, 0], [230, 180], [95, 180]], 'rgba(255, 236, 195, 0.22)');

        // Upright Piano body in profile/front-3/4
        rect('#231d1a', 92, 54, 96, 86);
        strokeRect('rgba(255, 225, 175, 0.45)', 92, 54, 96, 86);
        rect('#f5ebd6', 98, 94, 84, 8); // glowing keyboard
        for (let k = 1; k < 14; k++) rect('rgba(56, 48, 42, 0.35)', 98 + k * 6, 94, 0.8, 8);
        for (const bk of [0, 1, 3, 4, 5, 7, 8, 10, 11, 12]) {
          rect('#181412', 102 + bk * 6, 94, 3.5, 4.8);
        }
        // Father silhouette (tall, stationmaster cap)
        circle('#e6d4b8', 128, 72, 9);
        rect('#d8c3a5', 119, 64, 18, 3); // cap brim
        shape('#cbb292', [[114, 82], [142, 82], [146, 140], [110, 140]]);
        // Child silhouette beside him on bench, swinging legs
        circle('#f5e6cc', 158, 84, 6.5);
        shape('#e8d5b5', [[149, 92], [167, 92], [169, 126], [147, 126]]);
        // Floating musical notes / dust motes rising in the light beam
        for (let m = 0; m < 12; m++) {
          const mx = 105 + ((m * 19) % 85);
          const my = 88 - ((t * 18 + m * 11) % 62);
          circle('rgba(255, 242, 210, 0.75)', mx, my, 1.5);
        }
      } else if (progress < 0.72) {
        // Shot 2: Father kneeling by the tile pillar marking the child's height with a pencil
        radialGlow(160, 82, 12, 140, 'rgba(255, 228, 175, 0.30)');
        // Tile Pillar in center
        rect('#383432', 138, 18, 36, 148);
        strokeRect('rgba(255, 235, 200, 0.4)', 138, 18, 36, 148);
        for (let y = 30; y < 160; y += 16) rect('rgba(255,255,255,0.12)', 139, y, 34, 1);
        //Glowing height notch on pillar
        rect('#fff5dc', 162, 86, 12, 2);
        radialGlow(168, 87, 1, 18, 'rgba(255, 245, 215, 0.65)');
        // Child standing tall against the pillar
        circle('#f5e6cc', 184, 93, 6.5);
        rect('#e6d4b8', 178, 100, 12, 46);
        // Father kneeling on the left holding the pencil to the mark
        circle('#d8c3a5', 114, 84, 8.5);
        shape('#c4ad8d', [[102, 94], [128, 94], [134, 146], [98, 146]]);
        rect('#fff0c8', 128, 86, 34, 2.5); // arm reaching to mark
      } else {
        // Shot 3: Memory dissolving into the empty present-day hall with glowing open music stand
        const fade = (progress - 0.72) / 0.28;
        radialGlow(160, 90, 8, 130, `rgba(255, 230, 180, ${0.35 * (1 - fade * 0.4)})`);
        rect('#1d1918', 104, 58, 112, 82);
        strokeRect('rgba(255, 230, 185, 0.5)', 104, 58, 112, 82);
        // Open compartment glowing with the sheet music inside
        rect('#fff4d8', 142, 68, 36, 22);
        radialGlow(160, 79, 4, 38, 'rgba(255, 240, 200, 0.6)');
      }
    } else if (name === 'cutscene-rain') {
      // Cool blue-slate rainy night contrasted with solitary warm platform lamp
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 180);
      bgGrad.addColorStop(0, '#090d14');
      bgGrad.addColorStop(1, '#141c28');
      rect(bgGrad, 0, 0, 320, 180);

      // Falling rain streaks across the night
      for (let r = 0; r < 42; r++) {
        const rx = (r * 23 - Math.round(t * 28)) % 320;
        const ry = (r * 17 + Math.round(t * 110)) % 165;
        rect('rgba(185, 215, 255, 0.35)', (rx + 320) % 320, ry, 1, 7);
      }
      // Wet reflective platform floor
      rect('#0e131b', 0, 142, 320, 38);

      if (progress < 0.35) {
        // Shot 1: Young traveler walking away toward the train on the right
        const walkX = Math.round(135 + progress * 90);
        radialGlow(90, 52, 4, 95, 'rgba(255, 220, 155, 0.28)');
        // Platform lamp post
        rect('#586370', 88, 42, 3, 100);
        circle('#ffefc8', 89.5, 42, 5);
        // Young traveler walking right with suitcase
        circle('#dce6f2', walkX, 96, 6.5);
        rect('#c2d0e0', walkX - 6, 103, 12, 39);
        rect('#8fa0b5', walkX + 8, 120, 14, 10);
      } else if (progress < 0.72) {
        // Shot 2: Father running to the closing train doors holding out the black umbrella
        const p2 = (progress - 0.35) / 0.37;
        // Train car on right half of screen
        rect('#1d2633', 168, 46, 140, 96);
        strokeRect('#7a8ea8', 168, 46, 140, 96);
        // Warm lit train window with young traveler inside
        rect('#ffeed2', 192, 68, 42, 34);
        radialGlow(213, 85, 4, 48, 'rgba(255, 230, 180, 0.38)');
        circle('#2a3038', 213, 86, 6);
        rect('#2a3038', 207, 92, 12, 10);
        // Father outside on the platform holding out the black umbrella
        const fatherX = Math.round(112 + p2 * 24);
        circle('#d8e2ef', fatherX, 92, 7);
        rect('#b8c7d9', fatherX - 7, 100, 14, 42);
        // Extended arm holding the Black Umbrella toward the train
        rect('#e6eef8', fatherX + 7, 104, 22, 3);
        shape('#ffffff', [[fatherX + 26, 86], [fatherX + 34, 114], [fatherX + 22, 114]]);
      } else {
        // Shot 3: Train tail-lights receding into tunnel; Father standing alone under the lamp with the umbrella
        const p3 = (progress - 0.72) / 0.28;
        radialGlow(110, 50, 5, 110, 'rgba(255, 220, 160, 0.34)');
        rect('#586370', 108, 40, 3, 102);
        circle('#fff0cc', 109.5, 40, 5);
        // Father standing motionless beneath the open black umbrella
        shape('#e2eaf5', [[84, 78], [110, 62], [136, 78]]);
        rect('#c2d0e0', 104, 88, 12, 54);
        // Reflection on wet floor
        radialGlow(110, 156, 4, 45, 'rgba(255, 220, 160, 0.18)');
        // Receding red tail-lights in the dark tunnel on the right
        const tailR = Math.max(1.5, 5 * (1 - p3 * 0.7));
        const tailX = Math.round(235 + p3 * 35);
        radialGlow(tailX, 98, 1, 24, `rgba(255, 90, 70, ${0.65 * (1 - p3 * 0.5)})`);
        circle('#ff6b57', tailX - 6, 98, tailR);
        circle('#ff6b57', tailX + 6, 98, tailR);
      }
    } else if (name === 'cutscene-arrival') {
      // Dramatic HDR Headlight Volumetric Cutscene on Platform 404
      rect('#08090c', 0, 0, 320, 180);
      const beamReach = Math.min(1, progress * 1.35);
      linearRay(
        24, 96, 310, 110,
        [[20, 82], [320, Math.round(20 + (1 - beamReach) * 40)], [320, 175], [20, 116]],
        `rgba(255, 248, 228, ${0.48 * beamReach})`,
        'rgba(255, 240, 200, 0.02)'
      );
      // Train body gliding across the track
      const trainX = Math.round(-120 + Math.min(1, progress * 1.15) * 210);
      rect('#2a2d34', trainX, 54, 185, 78);
      strokeRect('#b8c2d0', trainX, 54, 185, 78);
      rect('#d8e0ec', trainX, 88, 185, 4); // silver trim stripe
      // Glowing carriage windows casting light onto the wet platform
      for (let w = 0; w < 4; w++) {
        const wx = trainX + 18 + w * 40;
        rect('#fff4da', wx, 66, 28, 20);
        radialGlow(wx + 14, 76, 2, 32, 'rgba(255, 240, 200, 0.28)');
        // Wet floor reflection below each window
        rect('rgba(255, 240, 200, 0.14)', wx + 2, 138, 24, 28);
      }
      // Twin HDR Headlights at front of train
      const frontX = trainX + 185;
      radialGlow(frontX, 96, 2, 42, 'rgba(255, 252, 240, 0.85)');
      circle('#ffffff', frontX - 3, 96, 5);
    }

    // Cinematic Letterbox Bars & Progress Bar at Bottom
    rect('#000000', 0, 0, 320, 18);
    rect('#000000', 0, 162, 320, 18);
    rect('rgba(255,255,255,0.18)', 40, 170, 240, 2);
    rect('#fff4dc', 40, 170, Math.round(240 * progress), 2);
    grain(31, 1200);
  }

  // Main Scene, HDR Lighting & Interactive Panel Painter
  function paint(sceneEffect = '', progress = 1, now = performance.now()) {
    if (!ctx) return;
    const t = reduced.matches ? 0 : now * 0.001;

    ctx.save();
    ctx.scale(canvas.width / 320, canvas.height / 180);

    // If a hands-free Story Cutscene is playing, render it full-frame
    if (activeCutscene) {
      const cProg = Math.min(1, (now - cutsceneStart) / cutsceneDuration);
      paintCutscene(activeCutscene, cProg, t);
      ctx.restore();
      return;
    }

    rect('#09090c', 0, 0, 320, 180);

    // 1. Street Level (Ending 1 & Ending 2)
    if (room === 'outside') {
      const isKeep = ending === 'keep';
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 114);
      if (isKeep) {
        skyGrad.addColorStop(0, '#0a0d16');
        skyGrad.addColorStop(1, '#1d2433');
      } else {
        skyGrad.addColorStop(0, '#2a3548');
        skyGrad.addColorStop(0.6, '#7a6860');
        skyGrad.addColorStop(1, '#e8cba8');
      }
      rect(skyGrad, 0, 0, 320, 114);

      // HDR Moon or Rising Dawn Sun
      radialGlow(225, 32, 4, isKeep ? 42 : 76, isKeep ? 'rgba(220,235,255,0.45)' : 'rgba(255,235,185,0.75)');
      circle('#fff9ec', 225, 32, 10);

      for (let i = 0; i < 12; i++) {
        const height = 18 + (i * 31) % 48;
        rect(i % 2 ? (isKeep ? '#1a1e28' : '#323742') : (isKeep ? '#13161f' : '#262a34'), i * 28, 114 - height, 25, height);
        if (i % 3 === 0) rect(isKeep ? '#ffe6b0' : '#ffefc8', i * 28 + 6, 114 - height + 8, 4, 5);
      }
      shape('#20232b', [[145, 112], [181, 112], [278, 180], [42, 180]]);
      shape('#7e8490', [[161, 119], [164, 119], [169, 180], [154, 180]]);

      if (isKeep) {
        rect('#111318', 52, 126, 62, 42);
        strokeRect('#7a8290', 52, 126, 62, 42);
        const pulse = 0.65 + 0.35 * Math.sin(t * 2.4);
        radialGlow(83, 148, 4, 48, `rgba(255, 224, 165, ${0.35 + 0.2 * pulse})`);
        rect('#ffe8b8', 62, 118, 42, 5);
      }

      if (ending === 'send') {
        const trainPos = sceneEffect === 'train' ? progress : 0.72;
        const trainX = Math.round(70 + 230 * trainPos);
        if (trainX < 320) {
          rect('#222630', trainX, 100, 86, 18);
          for (let i = 0; i < 5; i++) rect('#fff0cc', trainX + 8 + i * 15, 104, 10, 6);
          radialGlow(trainX + 43, 108, 4, 45, 'rgba(255, 235, 190, 0.28)');
        }
      }
      grain(41, 1400);
      ctx.restore();
      return;
    }

    // 2. Last Train Carriage (Ending 3 - HDR Daybreak Journey)
    if (room === 'carriage') {
      const scroll = sceneEffect === 'journey' ? progress * 120 : (t * 24) % 240;
      const skyGrad = ctx.createLinearGradient(0, 22, 0, 92);
      skyGrad.addColorStop(0, '#3a4c6e');
      skyGrad.addColorStop(0.55, '#c48d68');
      skyGrad.addColorStop(1, '#fff2d2');
      rect(skyGrad, 42, 22, 236, 70);

      // HDR Rising Sun & Mountain Pass
      radialGlow(218, 52, 6, 95, 'rgba(255, 245, 210, 0.85)');
      circle('#ffffff', 218, 52, 11);
      shape('#44495a', [[42, 88], [95, 50], [148, 88]]);
      shape('#323746', [[120, 88], [182, 42], [252, 88]]);
      shape('#52586c', [[210, 88], [255, 58], [278, 88]]);

      // Misty Riverside with shimmering golden-white water reflections
      const riverGrad = ctx.createLinearGradient(0, 88, 0, 114);
      riverGrad.addColorStop(0, '#5a6478');
      riverGrad.addColorStop(1, '#2c3340');
      rect(riverGrad, 42, 88, 236, 26);
      for (let i = 0; i < 18; i++) {
        const wx = 46 + ((i * 22 - Math.round(scroll * 1.4)) % 228 + 228) % 228;
        const wy = 92 + (i % 4) * 5;
        rect('#fff4d4', wx, wy, 10, 1.5);
      }

      // Interior Wooden Carriage Frame
      rect('#171516', 0, 0, 320, 22);
      rect('#171516', 0, 114, 320, 66);
      rect('#171516', 0, 22, 42, 92);
      rect('#171516', 278, 22, 42, 92);
      strokeRect('#8a7e72', 40, 20, 240, 96);
      shape('#332b26', [[28, 116], [292, 116], [310, 142], [10, 142]]);
      rect('#221d1a', 10, 142, 300, 38);

      // Punched Return Ticket & Father's Black Umbrella
      rect('#f5ebd8', 132, 122, 52, 14);
      rect('#2a2420', 136, 125, 26, 2);
      for (let p = 0; p < 3; p++) circle('#171516', 164 + p * 6, 129, 2);
      rect('#4a4440', 66, 98, 4, 68);
      rect('#cbb292', 60, 95, 10, 4);
      shape('#242226', [[63, 112], [73, 112], [76, 162], [60, 162]]);

      // Volumetric HDR Sunbeams pouring into the carriage
      linearRay(218, 52, 140, 175, [[140, 22], [278, 22], [240, 180], [65, 180]], 'rgba(255, 242, 204, 0.30)');
      grain(19, 1200);
      ctx.restore();
      return;
    }

    // 3. Base Underground Architecture with HDR Depth Shading (Rooms 01-07)
    const floorGrad = ctx.createLinearGradient(0, 114, 0, 180);
    floorGrad.addColorStop(0, '#18191e');
    floorGrad.addColorStop(1, '#262830');
    rect(floorGrad, 0, 96, 320, 84);
    // Perspective floor tile grid lines
    for (let f = 1; f < 6; f++) {
      const fy = 118 + f * 11;
      rect('rgba(255,255,255,0.035)', 0, fy, 320, 0.7);
    }

    shape('#23252c', [[0, 0], [114, 49], [114, 118], [0, 180]]);
    shape('#1c1e24', [[320, 0], [206, 49], [206, 118], [320, 180]]);
    rect('#14161b', 114, 49, 92, 70);
    shape('#383b44', [[0, 154], [114, 111], [114, 118], [0, 171]]);
    shape('#2c2f37', [[320, 154], [206, 111], [206, 118], [320, 171]]);

    // Ceiling Fluorescent Lights & Volumetric Light Cones
    for (const [i, [x, y, w]] of [[131, 5, 58], [140, 25, 40], [147, 41, 26]].entries()) {
      const lit = powered && (sceneEffect !== 'power' || progress > (i + 1) * 0.22);
      rect('#2a2c32', x - 3, y - 2, w + 6, 7);
      rect(lit ? '#fff9ee' : '#525560', x, y, w, 2.5);
      if (lit) {
        radialGlow(x + w / 2, y + 1, 2, w * 0.9, 'rgba(255, 248, 232, 0.28)');
        linearRay(
          x + w / 2, y + 3, x + w / 2, y + 72,
          [[x - 4, y + 3], [x + w + 4, y + 3], [x + w + 28, y + 72], [x - 28, y + 72]],
          'rgba(240, 246, 255, 0.08)'
        );
      }
    }

    if (room === 'station') {
      // Left Wall: Tunnel Portal
      shape('#08090c', [[19, 44], [72, 64], [72, 129], [19, 155]]);
      shape('#686d78', [[16, 42], [19, 44], [19, 155], [16, 158]]);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(19, 44);
      ctx.lineTo(72, 64);
      ctx.lineTo(72, 129);
      ctx.lineTo(19, 155);
      ctx.closePath();
      ctx.clip();

      if (trainApproaching && !trainArrived && puzzle !== 'lanternGame') {
        const glow = 0.5 + 0.35 * Math.sin(t * 3.5);
        radialGlow(48, 103, 1, 22, `rgba(255, 240, 200, ${glow * 0.65})`);
        circle('#fff8e6', 42, 102, 3.5);
        circle('#fff8e6', 56, 104, 3);
      }

      if (trainArrived || sceneEffect === 'arrival') {
        const slide = sceneEffect === 'arrival' ? Math.max(0, (progress - 0.15) / 0.85) : 1;
        const ease = 1 - Math.pow(1 - slide, 3);
        const offsetX = Math.round((1 - ease) * -55);
        rect('#3a3e48', 18 + offsetX, 52, 56, 96);
        rect('#7a8292', 18 + offsetX, 52, 56, 5);
        rect('#fff2d6', 24 + offsetX, 68, 16, 26);
        rect('#fff2d6', 46 + offsetX, 72, 18, 24);
      }
      ctx.restore();

      // Back Wall: Service Room Door & Schedule Board
      rect('#585c66', 143, 61, 34, 56);
      rect('#14161a', 146, 64, 28, 53);
      for (let x = 149; x < 174; x += 6) rect('#484c56', x, 65, 2, 51);
      rect('#e6dfd3', 156, 82, 7, 9);
      // Schedule plaque on back wall left of door
      rect('#282b32', 120, 74, 16, 22);
      strokeRect('#7a808c', 120, 74, 16, 22);

      // Right Wall: Waiting Hall Door with Warm Amber HDR Glow
      shape('#525660', [[245, 62], [295, 42], [295, 156], [245, 130]]);
      shape(powered ? '#ffebb8' : '#181a20', [[248, 65], [291, 47], [291, 151], [248, 128]]);
      shape('#32353d', [[268, 56], [271, 55], [271, 140], [268, 139]]);
      if (powered) {
        radialGlow(270, 98, 4, 56, 'rgba(255, 215, 140, 0.32)');
        linearRay(270, 128, 220, 175, [[248, 128], [291, 151], [255, 176], [198, 148]], 'rgba(255, 220, 150, 0.25)');
      }

      shape('#888d98', [[126, 121], [130, 121], [67, 180], [54, 180]]);
      shape('#888d98', [[191, 121], [195, 121], [266, 180], [253, 180]]);

      if (trainArrived) {
        linearRay(45, 130, 115, 175, [[19, 155], [72, 129], [128, 152], [68, 179]], 'rgba(255, 240, 200, 0.30)');
      }
    } else if (room === 'service') {
      rect('#454852', 81, 56, 158, 55);
      rect('#6e7380', 65, 111, 190, 10);
      rect('#32353d', 73, 121, 174, 9);
      rect('#525660', 76, 130, 9, 37);
      rect('#525660', 234, 130, 9, 37);
      // Warm work lamp glow over bench
      radialGlow(115, 86, 3, 62, 'rgba(255, 226, 170, 0.22)');

      // Wall Cabinet (188, 61, 47, 44) - Properly layered
      rect('#32353d', 188, 61, 47, 44);
      rect('#121317', 191, 64, 41, 38);
      rect('#2c2f36', 191, 89, 41, 2);
      if (!hasFuse && !powered) {
        rect('#fff4d8', 202, 82, 18, 6);
        rect('#7c8290', 205, 82, 12, 6);
        radialGlow(211, 85, 1, 14, 'rgba(255, 240, 200, 0.35)');
      }
      const openAmt = sceneEffect === 'unlock' ? progress : (lockerOpen ? 1 : 0);
      if (openAmt < 1) {
        const doorW = Math.max(4, Math.round(41 * (1 - openAmt * 0.9)));
        rect('#585d68', 191, 64, doorW, 38);
        if (doorW > 12) {
          rect('#d8c8a8', 191 + doorW - 8, 82, 5, 4);
        }
      } else {
        rect('#444852', 191, 64, 4, 38);
      }
    } else if (room === 'archive') {
      // Cool moonlight ray from high left window
      linearRay(60, 15, 155, 150, [[45, 20], [95, 20], [190, 165], [95, 165]], 'rgba(190, 215, 255, 0.10)');
      for (let i = 0; i < 3; i++) {
        const y = 53 + i * 26;
        rect('#3d404a', 51, y + 18, 216, 4);
        for (let j = 0; j < 19; j++) {
          const height = 8 + (i * 13 + j * 7) % 10;
          rect(j % 3 ? '#686e7c' : '#444854', 59 + j * 10, y + 18 - height, 7, height);
        }
      }
      // Foreground Reading Table
      shape('#3d3530', [[106, 144], [214, 144], [226, 154], [94, 154]]);
      rect('#28221f', 94, 154, 132, 6);
      rect('#1e1a18', 104, 160, 8, 20);
      rect('#1e1a18', 208, 160, 8, 20);
      // Warm glowing electric coaster & porcelain teacup
      radialGlow(174, 146, 2, 28, 'rgba(255, 200, 130, 0.34)');
      rect('#f0e6d2', 136, 147, 20, 4); // Father's letter
      rect('#d87a56', 166, 148, 16, 2); // Electric warming coaster
      rect('#fff9f0', 169, 141, 10, 7);
      rect('#fff9f0', 179, 143, 2, 3);
      for (let s = 0; s < 3; s++) {
        const phase = (t * 1.3 + s * 0.33) % 1;
        const sy = 138 - Math.round(phase * 14);
        const sx = 173 + Math.round(Math.sin(phase * 6 + s) * 2);
        ctx.fillStyle = `rgba(255, 248, 235, ${(1 - phase) * 0.55})`;
        ctx.fillRect(sx, sy, 2, 2.5);
      }
    } else if (room === 'lounge') {
      // High Window with cool silver-blue rain
      rect('#0d121c', 128, 52, 64, 28);
      strokeRect('#687282', 128, 52, 64, 28);
      ctx.save();
      ctx.beginPath();
      ctx.rect(129, 53, 62, 26);
      ctx.clip();
      for (let r = 0; r < 12; r++) {
        const rx = 132 + (r * 13) % 56;
        const ry = 53 + Math.round((t * 38 + r * 7) % 24);
        rect('rgba(195, 220, 255, 0.65)', rx, ry, 1, 4);
      }
      ctx.restore();
      rect('#454c58', 159, 52, 2, 28);
      rect('#454c58', 128, 65, 64, 2);

      // Upright Piano in Left Corner of the Waiting Hall (54..102, 74..142)
      rect('#241e1c', 56, 78, 42, 62);
      strokeRect('#7a6a58', 56, 78, 42, 62);
      rect('#181412', 60, 82, 34, 20); // upper panel
      rect('#f5ebd6', 58, 104, 38, 6); // piano keys
      for (let k = 1; k < 7; k++) rect('rgba(56, 48, 42, 0.35)', 58 + k * 5.4, 104, 0.6, 6);
      for (const bk of [0, 1, 3, 4, 5]) {
        rect('#181412', 61.8 + bk * 5.4, 104, 3, 3.6);
      }
      rect('#d8c398', 71, 92, 12, 8);  // sheet music on stand
      radialGlow(77, 102, 2, 34, 'rgba(255, 220, 155, 0.22)');

      // Tile Pillar with childhood height mark (202..218, 48..142)
      rect('#363840', 204, 50, 14, 92);
      rect('#ffe8b8', 206, 94, 8, 1.5); // Height mark notch

      // Vintage Amber Standing Lamp on Right casting HDR light cone
      rect('#9a8870', 234, 142, 18, 4);
      rect('#786a58', 242, 66, 2, 76);
      shape('#ffefc8', [[232, 66], [254, 66], [260, 78], [226, 78]]);
      radialGlow(243, 74, 3, 68, 'rgba(255, 215, 140, 0.42)');
      linearRay(243, 76, 175, 165, [[226, 78], [260, 78], [282, 168], [110, 168]], 'rgba(255, 218, 145, 0.18)');

      // Wooden Waiting Bench & Suitcase (114..198, 104..148)
      rect('#3d322c', 116, 102, 82, 16);
      rect('#54463e', 112, 118, 90, 8);
      rect('#2b231f', 120, 126, 6, 20);
      rect('#2b231f', 188, 126, 6, 20);

      const openAmt = suitcaseOpen ? 1 : 0;
      if (openAmt > 0) {
        rect('#2e2622', 135, 94, 44, 11);
        strokeRect('#8a7866', 135, 94, 44, 11);
      }
      rect('#221c19', 135, 105, 44, 15);
      strokeRect('#b09a82', 135, 105, 44, 15);
      if (openAmt > 0) {
        rect('#fff2d6', 140, 109, 10, 6);
        rect('#cbb292', 153, 110, 9, 5);
        rect('#9a8872', 165, 109, 10, 6);
      } else {
        for (let d = 0; d < 3; d++) rect('#e6d2b0', 143 + d * 11, 111, 5, 4);
      }
    } else if (room === 'booth' || room === 'radio') {
      rect('#383b44', 69, 56, 182, 78);
      rect('#121418', 80, 64, 160, 46);
      if (room === 'booth') {
        for (let i = 0; i < 3; i++) {
          const x = 98 + i * 55;
          const lit = powered && (sceneEffect !== 'power' || progress > (i + 1) * 0.22);
          rect(lit ? '#ffefc4' : '#585c66', x, 74, 11, 5);
          if (lit) radialGlow(x + 5.5, 76.5, 1, 18, 'rgba(255, 230, 170, 0.38)');
          rect('#888d98', x + 3, lit ? 81 : 87, 5, 16);
        }
      } else {
        const spin = (sideBPlayed ? 0 : t * 2.2) + (sceneEffect === 'tapeB' ? progress * 8 : 0);
        for (const [idx, x] of [104, 154].entries()) {
          rect('#484c56', x, 71, 27, 27);
          rect('#9a9fa8', x + 3, 74, 21, 21);
          rect('#1e2026', x + 10, 81, 7, 7);
          const angle = spin + idx * 1.2;
          const sx = x + 13 + Math.round(Math.cos(angle) * 6);
          const sy = 84 + Math.round(Math.sin(angle) * 6);
          rect('#1e2026', sx, sy, 2, 2);
        }
        rect('#b8bcc6', 131, 93, 23, 2);
        // Phosphor-warm Oscilloscope Monitor
        rect('#0a0d10', 194, 71, 38, 27);
        strokeRect('#78808e', 194, 71, 38, 27);
        radialGlow(213, 84, 2, 26, 'rgba(255, 230, 175, 0.24)');
        for (let wx = 0; wx < 32; wx += 2) {
          const amp = sceneEffect === 'tapeB' ? 8 : (sideBPlayed ? 2 : 5);
          const wy = 84 + Math.round(Math.sin(t * 7 + wx * 0.45) * amp * Math.sin((wx / 32) * Math.PI));
          rect('#fff0cc', 197 + wx, wy, 2, 2);
        }
      }
    } else if (room === 'gate') {
      rect('#525660', 94, 37, 130, 111);
      rect('#181a20', 99, 42, 120, 106);
      for (let y = 74; y < 143; y += 9) rect('#3e424c', 109, y, 100, 3);
      const gateHeight = powered ? Math.round(106 * (1 - progress)) : 106;
      if (gateHeight > 0) {
        for (let x = 106; x < 220; x += 13) rect('#888d98', x, 42, 4, gateHeight);
        rect('#888d98', 99, 42 + gateHeight - 4, 120, 4);
      }
      rect('#525660', 240, 76, 23, 31);
      rect('#16181d', 243, 79, 17, 25);
      rect(powered ? '#ffefc4' : '#585c66', 248, 85, 7, 4);
      if (powered) radialGlow(251.5, 87, 1, 16, 'rgba(255, 225, 160, 0.38)');
    }

    // =====================================================================
    // 4. Interactive Close-Up Panels (Piano, Cursor Ticket Punch, Locks)
    // =====================================================================
    if (puzzle === 'locker') {
      rect('rgba(5, 6, 8, 0.82)', 0, 0, 320, 180);
      rect('#18191e', 28, 26, 264, 128);
      strokeRect('#c8bca8', 28, 26, 264, 128);
      // 5 Brass Symbol Keys (Always in fixed positions, never disappearing!)
      for (let i = 0; i < 5; i++) {
        const bx = 42 + i * 48;
        const used = input.includes(i);
        const bg = used ? '#2e2b26' : '#111216';
        rect(bg, bx, 44, 42, 52);
        strokeRect(used ? '#fff0cc' : '#787268', bx, 44, 42, 52);
        if (used) radialGlow(bx + 21, 70, 2, 24, 'rgba(255, 230, 175, 0.25)');
        drawSymbolIcon(i, bx + 21, 70, used ? '#fff4d8' : '#d0ccc4', bg);
      }
      // 3 Entered Sequence Slots at Bottom
      for (let s = 0; s < 3; s++) {
        const sx = 88 + s * 52;
        rect('#0d0e11', sx, 110, 40, 30);
        strokeRect(input[s] !== undefined ? '#fff0cc' : '#52545c', sx, 110, 40, 30);
        if (input[s] !== undefined) drawSymbolIcon(input[s], sx + 20, 125, '#fff4d8', '#0d0e11');
      }
    } else if (puzzle === 'circuits') {
      rect('rgba(5, 6, 8, 0.82)', 0, 0, 320, 180);
      rect('#16181d', 30, 26, 260, 128);
      strokeRect('#b8c0cc', 30, 26, 260, 128);
      for (let i = 0; i < 4; i++) {
        const bx = 46 + i * 58;
        const engaged = input.includes(i);
        circle('#0e1014', bx + 22, 54, 13);
        circle(engaged ? '#ffefc4' : '#525660', bx + 22, 54, 13, true);
        if (engaged) radialGlow(bx + 22, 54, 2, 18, 'rgba(255, 230, 170, 0.3)');
        const needleX = bx + 22 + (engaged ? 6 : -5);
        rect(engaged ? '#fff6dc' : '#787c86', needleX, 46, 2, 9);

        rect('#22252c', bx + 6, 76, 32, 52);
        strokeRect('#626670', bx + 6, 76, 32, 52);
        rect(engaged ? '#ffefc4' : '#3e424a', bx + 18, 82, 8, 4);
        const handleY = engaged ? 92 : 112;
        rect('#888d98', bx + 20, 94, 4, 22);
        rect(engaged ? '#fff4d4' : '#9a9fa8', bx + 12, handleY, 20, 7);
      }
    } else if (puzzle === 'pianoGame') {
      // INTERACTIVE UPRIGHT PIANO KEYBOARD
      rect('rgba(6, 5, 5, 0.84)', 0, 0, 320, 180);
      rect('#201916', 32, 20, 256, 140);
      strokeRect('#cbb292', 32, 20, 256, 140);
      radialGlow(160, 50, 8, 125, 'rgba(255, 220, 155, 0.25)');

      // Music Stand at Top showing the 4-note progression slots
      rect('#15110f', 78, 28, 164, 34);
      strokeRect('#9a8468', 78, 28, 164, 34);
      for (let m = 0; m < 4; m++) {
        const mx = 96 + m * 36;
        const entered = pianoInput[m];
        rect('#241e1a', mx, 34, 24, 22);
        strokeRect(entered !== undefined ? '#ffefc4' : '#584c40', mx, 34, 24, 22);
        if (entered !== undefined) {
          circle('#fff4d8', mx + 12, 45, 4);
        }
      }

      // 7 White Ivory Keys (1 Do .. 7 Si)
      const isKeyRecent = (now - pianoActiveTime) < 300;
      for (let k = 0; k < 7; k++) {
        const kx = 50 + k * 31;
        const pressed = isKeyRecent && pianoActiveKey === k;
        const ky = pressed ? 72 : 70;
        rect(pressed ? '#ffe8b8' : '#f4ece0', kx, ky, 29, 76);
        strokeRect('#38302a', kx, ky, 29, 76);
        if (pressed) {
          radialGlow(kx + 14.5, ky + 50, 2, 28, 'rgba(255, 225, 160, 0.55)');
        }
        // Key number dot indicator near bottom of key
        circle('#584c40', kx + 14.5, ky + 64, 2);
      }
      // 5 Playable Black Ebony Sharp/Flat Keys (W, E, T, Y, U or direct click)
      pianoBlackNotes.forEach((bNote, bIdx) => {
        const bx = 72 + bNote.slot * 31;
        const bPressed = isKeyRecent && pianoActiveBlackKey === bIdx;
        const by = bPressed ? 72 : 70;
        rect(bPressed ? '#4a3d32' : '#181412', bx, by, 16, 44);
        strokeRect(bPressed ? '#ffefc4' : '#52463c', bx, by, 16, 44);
        rect(bPressed ? '#ffe8b8' : '#2e2622', bx + 2, by + 2, 12, 34);
        if (bPressed) {
          radialGlow(bx + 8, by + 26, 2, 22, 'rgba(255, 225, 160, 0.50)');
        }
      });
    } else if (puzzle === 'suitcase') {
      rect('rgba(6, 5, 5, 0.84)', 0, 0, 320, 180);
      rect('#1e1916', 44, 28, 232, 124);
      strokeRect('#cbb292', 44, 28, 232, 124);
      rect('#9a8468', 58, 22, 18, 10);
      rect('#9a8468', 244, 22, 18, 10);
      for (let i = 0; i < 3; i++) {
        const dx = 68 + i * 68;
        rect('#110e0c', dx, 50, 48, 76);
        strokeRect('#e6d2b0', dx, 50, 48, 76);
        radialGlow(dx + 24, 88, 2, 32, 'rgba(255, 225, 165, 0.18)');
        // 5-position scale indicator bar inside each brass wheel
        for (let p = 0; p < 5; p++) {
          const py = 60 + p * 13;
          const active = dials[i] === p;
          rect(active ? '#fff2d0' : '#3d342c', dx + 10, py, 28, active ? 7 : 4);
        }
      }
    } else if (puzzle === 'punchGame') {
      // CURSOR-FOLLOWING BRASS TICKET PUNCH
      rect('rgba(6, 6, 8, 0.84)', 0, 0, 320, 180);
      rect('#16181d', 26, 22, 268, 136);
      strokeRect('#c8bca8', 26, 22, 268, 136);

      // The Return Ticket Centered on Table (52..268, 56..126)
      rect('#f2eadc', 52, 56, 216, 70);
      strokeRect('#38322c', 56, 60, 208, 62);
      rect('#685e54', 66, 66, 96, 3);

      // 5 Emblem Boxes on the Ticket (0=彎月, 1=圓圈, 2=水波, 3=星芒, 4=山稜)
      ticketBoxes.forEach((box, idx) => {
        const isHovered = Math.hypot(mouseX - box.x, mouseY - box.y) <= 16;
        rect(isHovered ? '#e6d8be' : '#eae0d0', box.x - 16, box.y - 16, 32, 32);
        strokeRect(isHovered ? '#111111' : '#786e62', box.x - 16, box.y - 16, 32, 32);
        drawSymbolIcon(idx, box.x, box.y, '#2b2622', isHovered ? '#e6d8be' : '#eae0d0');
      });

      // Render all physical holes already punched by the player at exact (x, y)
      punchedHoles.forEach((h) => {
        circle('#16181d', h.x, h.y, 7);
        circle('#8a7e70', h.x, h.y, 7.5, true, 1);
      });

      // Hand-Held Brass Ticket Punch Following the Player's Cursor (mouseX, mouseY)!
      const px = Math.max(48, Math.min(272, mouseX));
      const py = Math.max(44, Math.min(138, mouseY));
      const clipAnim = Math.max(0, 1 - (now - punchFlash) / 240);
      const jawOffset = Math.round(clipAnim * 4);

      // Soft drop shadow of the punch tool on the ticket
      circle('rgba(0, 0, 0, 0.28)', px + 6, py + 8, 12);
      // Aiming reticle ring at punch head tip
      circle('#d85a40', px, py, 9 - jawOffset * 0.4, true, 1.5);
      // Brass Punch Jaws & Handle extending to bottom-right like held in right hand
      shape('#cbb28c', [
        [px - 6, py + 6 - jawOffset],
        [px + 8, py - 4 + jawOffset],
        [px + 58, py + 48],
        [px + 38, py + 62],
      ]);
      shape('#9e8664', [
        [px + 2, py + 12],
        [px + 14, py + 4],
        [px + 72, py + 38],
        [px + 62, py + 52],
      ]);
      circle('#383028', px + 16, py + 16, 3); // brass pivot screw

      // Flying paper chad when punched
      if (clipAnim > 0) {
        circle('#f2eadc', px + (1 - clipAnim) * 10, py + (1 - clipAnim) * 24, 4);
      }
    } else if (puzzle === 'tunerGame') {
      rect('rgba(5, 6, 8, 0.85)', 0, 0, 320, 180);
      rect('#15171c', 28, 18, 264, 144);
      strokeRect('#b8c0cc', 28, 18, 264, 144);

      const scrX = 42, scrY = 30, scrW = 158, scrH = 98;
      rect('#080b0e', scrX, scrY, scrW, scrH);
      strokeRect('#687280', scrX, scrY, scrW, scrH);
      radialGlow(scrX + scrW / 2, scrY + scrH / 2, 4, 80, 'rgba(255, 228, 170, 0.16)');

      for (let x = 4; x < scrW - 4; x += 4) {
        const norm = x / scrW;
        const env = Math.sin(norm * Math.PI);
        const yTarget = scrY + scrH / 2 + Math.sin(norm * (tunerTargetFreq + 1.5) * Math.PI * 2 + tunerTargetPhase * 0.9 + t * 2.2) * 30 * env;
        rect('rgba(255, 220, 160, 0.38)', scrX + x, yTarget, 2, 2);
      }

      const lockPct = getTunerLockPercent();
      const noiseAmt = (100 - lockPct) * 0.14;
      for (let x = 2; x < scrW - 2; x += 2) {
        const norm = x / scrW;
        const env = Math.sin(norm * Math.PI);
        const jitter = noiseAmt ? Math.sin(x * 13.7 + t * 35) * noiseAmt : 0;
        const yLive = scrY + scrH / 2 + Math.sin(norm * (tunerFreq + 1.5) * Math.PI * 2 + tunerPhase * 0.9 + t * 2.2) * 30 * env + jitter;
        rect(lockPct === 100 ? '#fff8e6' : '#e0dcd4', scrX + x, yLive, 2, lockPct === 100 ? 3 : 2);
      }

      rect('#22252c', scrX, 136, scrW, 10);
      rect(lockPct === 100 ? '#ffefc4' : '#9a9fa8', scrX + 2, 138, Math.round((scrW - 4) * (lockPct / 100)), 6);

      const knobs = [
        { cx: 244, cy: 58, val: tunerFreq, target: tunerTargetFreq },
        { cx: 244, cy: 118, val: tunerPhase, target: tunerTargetPhase },
      ];
      knobs.forEach(({ cx, cy, val, target }) => {
        const matched = val === target;
        circle('#0d0f13', cx, cy, 20);
        circle(matched ? '#ffefc4' : '#78808e', cx, cy, 20, true);
        if (matched) radialGlow(cx, cy, 2, 26, 'rgba(255, 230, 175, 0.3)');
        circle('#22262e', cx, cy, 14);
        const angle = (-0.75 + val * 0.375) * Math.PI;
        const ix = cx + Math.round(Math.cos(angle) * 11);
        const iy = cy + Math.round(Math.sin(angle) * 11);
        circle('#fff6dc', ix, iy, 2.5);
      });
    } else if (puzzle === 'lanternGame') {
      if (!reduced.matches) {
        lanternPulse = (t * 0.58) % 1;
      } else {
        lanternPulse = 0.62;
      }
      rect('rgba(5, 6, 9, 0.86)', 0, 0, 320, 180);

      const stageProgress = lanternStage / 3;
      const trainScale = 0.35 + stageProgress * 0.65;
      const trainCX = Math.round(68 + stageProgress * 38);
      const trainCY = Math.round(88 + stageProgress * 10);
      const w = Math.round(54 * trainScale);
      const h = Math.round(62 * trainScale);
      rect('#22252e', trainCX - Math.round(w / 2), trainCY - Math.round(h / 2), w, h);
      strokeRect('#98a0b0', trainCX - Math.round(w / 2), trainCY - Math.round(h / 2), w, h);
      rect('#e6ebf2', trainCX - Math.round(w * 0.36), trainCY - Math.round(h * 0.32), Math.round(w * 0.72), Math.round(h * 0.26));
      const hlRadius = Math.max(2, Math.round(5 * trainScale));
      radialGlow(trainCX, trainCY + Math.round(h * 0.18), 2, 32 * trainScale, 'rgba(255, 242, 200, 0.55)');
      circle('#ffffff', trainCX - Math.round(w * 0.26), trainCY + Math.round(h * 0.18), hlRadius);
      circle('#ffffff', trainCX + Math.round(w * 0.26), trainCY + Math.round(h * 0.18), hlRadius);

      const beamFade = Math.max(0, 1 - (now - lanternBeamTime) / 450);
      if (beamFade > 0) {
        linearRay(222, 92, trainCX, trainCY, [[222, 92], [trainCX - 22, trainCY - 30], [trainCX + 22, trainCY + 30]], `rgba(255, 235, 180, ${beamFade * 0.55})`);
        circle('#ffefc4', trainCX, trainCY, Math.round((1 - beamFade) * 48), true);
      }

      const lanX = 222, lanY = 92;
      circle('#9a8870', lanX, lanY - 42, 10, true);
      rect('#3d342c', lanX - 18, lanY - 34, 36, 8);
      rect('#2e2620', lanX - 24, lanY + 32, 48, 10);
      rect('#12100e', lanX - 20, lanY - 26, 40, 58);
      strokeRect('#cbb292', lanX - 20, lanY - 26, 40, 58);

      const inSweetSpot = lanternPulse >= 0.42 && lanternPulse <= 0.85;
      radialGlow(lanX, lanY + 2, 2, 36, inSweetSpot ? 'rgba(255, 225, 155, 0.55)' : 'rgba(255, 210, 135, 0.24)');
      circle(inSweetSpot ? '#fff4d4' : '#786c5e', lanX, lanY + 2, 14, true);
      circle('#484038', lanX, lanY + 2, 10, true);

      const ringRadius = Math.max(6, Math.round(36 * (1 - lanternPulse * 0.82)));
      circle(inSweetSpot ? '#ffffff' : '#cbb292', lanX, lanY + 2, ringRadius, true);
      circle('#fff6dc', lanX, lanY + 2, inSweetSpot ? 6 : 4);

      for (let s = 0; s < 3; s++) {
        const sx = 194 + s * 22;
        rect(s < lanternStage ? '#ffefc4' : '#242220', sx, 142, 14, 8);
        strokeRect('#9a8870', sx, 142, 14, 8);
      }
    }

    // 5. Centered Item Inspection Modal
    if (inspectedItem && !puzzle && !activeCutscene) {
      rect('rgba(5, 6, 8, 0.80)', 0, 0, 320, 180);
      rect('#16171b', 92, 42, 136, 96);
      strokeRect('#cbb292', 92, 42, 136, 96);
      radialGlow(160, 90, 4, 58, 'rgba(255, 230, 180, 0.18)');
      if (inspectedItem === 'ticket') {
        rect('#f2eadc', 112, 66, 96, 48);
        strokeRect('#38322c', 115, 69, 90, 42);
        rect('#222222', 124, 77, 52, 3);
        rect('#666666', 124, 85, 36, 2);
        if (ticketPunched) {
          for (let p = 0; p < 3; p++) circle('#16171b', 136 + p * 22, 101, 3.5);
        }
      } else if (inspectedItem === 'fuse') {
        rect('#999999', 122, 82, 14, 16);
        rect('#fff6e0', 136, 85, 48, 10);
        rect('#777777', 142, 89, 36, 2);
        rect('#999999', 184, 82, 14, 16);
      } else if (inspectedItem === 'punch') {
        shape('#cbb28c', [[142, 82], [156, 72], [184, 102], [172, 112]]);
      } else if (inspectedItem === 'photo') {
        rect('#e6dfd3', 124, 58, 72, 64);
        rect('#222226', 129, 63, 62, 48);
        circle('#dcd4c6', 150, 82, 5);
        rect('#dcd4c6', 145, 89, 10, 22);
        circle('#b8b0a2', 170, 85, 5);
        rect('#b8b0a2', 165, 92, 10, 19);
      } else if (inspectedItem === 'tapeB') {
        rect('#32302e', 116, 64, 88, 52);
        strokeRect('#d8c8b0', 116, 64, 88, 52);
        rect('#f0e6d2', 124, 71, 72, 12);
        circle('#111111', 140, 96, 8);
        circle('#111111', 180, 96, 8);
      }
    }

    grain(23, 1400);
    ctx.restore();
  }

  // =========================================================================
  // Animation Loop, Cutscene Progression & Interactive Puzzle Handlers
  // =========================================================================
  let frameId = 0;

  function needsContinuousLoop() {
    if (reduced.matches) return false;
    if (document.body.dataset.phase !== 'playing') return false;
    return Boolean(
      activeCutscene ||
      room === 'archive' ||
      room === 'lounge' ||
      room === 'radio' ||
      room === 'outside' ||
      room === 'carriage' ||
      (room === 'station' && (trainApproaching || trainArrived)) ||
      puzzle === 'pianoGame' ||
      puzzle === 'punchGame' ||
      puzzle === 'tunerGame' ||
      puzzle === 'lanternGame'
    );
  }

  function triggerEffect(name, nextCaption, duration = 900) {
    caption = nextCaption;
    if (reduced.matches) {
      effect = '';
      effectProgress = 1;
      paint('', 1, performance.now());
      scheduleAmbient();
      return;
    }
    effect = name;
    effectStart = performance.now();
    effectDuration = duration;
    effectProgress = 0;
    cancelAnimationFrame(frameId);
    frameId = 0;
    startLoop();
  }

  function startLoop() {
    if (frameId) return;
    const step = (now) => {
      frameId = 0;
      if (effect) {
        effectProgress = Math.min(1, (now - effectStart) / effectDuration);
        paint(effect, effectProgress, now);
        if (effectProgress < 1) {
          frameId = requestAnimationFrame(step);
          return;
        }
        effect = '';
        effectProgress = 1;
      }

      if (activeCutscene) {
        const cProg = Math.min(1, (now - cutsceneStart) / cutsceneDuration);
        const stageText = getCutsceneStageText(activeCutscene, cProg);
        if (stageText && stageText !== cutsceneSubtitle) {
          cutsceneSubtitle = stageText;
          get('description').textContent = stageText;
          get('scene-caption').hidden = true;
        }
        paint('', 1, now);
        if (cProg < 1) {
          frameId = requestAnimationFrame(step);
          return;
        }
        // Cutscene finished naturally
        finishCutscene();
        return;
      }

      paint('', 1, now);
      if (needsContinuousLoop()) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
  }

  function finishCutscene() {
    const finished = activeCutscene;
    activeCutscene = '';
    cutsceneSubtitle = '';
    if (finished === 'cutscene-piano') {
      pillarChecked = true;
      const heightText = dialOptions[1][dialTarget[1]][0];
      feedback = [
        `琴譜架下的暗格已經打開，泛黃的琴譜邊緣寫著老站長當年的筆跡：「你小時候在柱子上留下的身高刻痕是 ${heightText}。」`,
        `The hidden compartment under the music stand lies open. On the margin of the sheet music is your father’s handwriting: “Your childhood height mark on the pillar is ${heightText}.”`
      ];
    } else if (finished === 'cutscene-rain') {
      feedback = [
        '你握緊了皮箱裡的黑傘，還有驗票鉗、合照與那捲寫著你名字的《B 面》磁帶。大廳盡頭通往「廣播室」的側門已經亮起，可以去那裡播放這捲磁帶了。',
        'You hold fast to the black umbrella inside the suitcase, along with the punch, the photo, and the Side-B cassette. The side door to the Broadcast Room at the end of the hall is open—head there to play the tape.'
      ];
    } else if (finished === 'cutscene-arrival') {
      feedback = [
        '末班列車的車門敞開著，暖黃的燈光灑在月台上。站在車門與出口之間，你終於明白自己為什麼會醒在這裡了。',
        'The doors of the last train stand open, spilling warm light across the platform. Standing between the carriage and the exit, you finally understand why you woke here.'
      ];
    }
    render();
  }

  function scheduleAmbient() {
    if (!effect && needsContinuousLoop()) {
      startLoop();
    }
  }

  // Cursor-Following Ticket Punch Handler
  function attemptTicketPunchAt(x, y) {
    initAudio();
    punchFlash = performance.now();
    // Check if the player clicked inside one of the 5 emblem boxes on the ticket
    const hitBox = ticketBoxes.find((b) => Math.hypot(x - b.x, y - b.y) <= 17);
    if (!hitBox) {
      // Punched on blank paper margin -> still leaves a hole and plays sound, with gentle reminder
      punchedHoles.push({ x, y, stIdx: -1 });
      if (punchedHoles.length > 8) punchedHoles.shift();
      playSFX('click');
      feedback = [
        '驗票鉗在車票空白處剪下了一個小圓孔。請將驗票鉗移到車票中央的五格印記上方再點擊剪孔。',
        'The punch clipped a hole in the blank margin. Move the punch over one of the five emblem boxes on the ticket and click.'
      ];
      render();
      return;
    }

    const expectedSymbolIdx = lockerTarget[punchStep];
    if (hitBox.stIdx === expectedSymbolIdx) {
      punchedHoles.push({ x: hitBox.x, y: hitBox.y, stIdx: hitBox.stIdx });
      punchStep++;
      playSFX('punchHit');
      if (punchStep >= 3) {
        ticketPunched = true;
        puzzle = '';
        inspectedItem = '';
        feedback = [
          '第三聲清脆的「喀嚓」落定。三枚圓孔連成歸途的軌跡，車票背面浮現出老站長用鉛筆寫的一行小字：「無論走得多遠，這張車票永遠有效。」',
          'With a third crisp snap, the three holes align along your homeward route. Pencil writing appears on the back: “No matter how far you go, this ticket is always valid.”'
        ];
        triggerEffect('unlock', [
          '車票已打上完整的三枚歸途驗票孔',
          'Return ticket validated with all three station holes'
        ], 900);
      } else {
        feedback = [
          `清脆的「喀嚓」一聲，第 ${punchStep} 枚驗票孔已剪下（${punchStep} / 3）。請依〈夜車行〉詩意繼續剪下下一枚印記。`,
          `A crisp snap! Emblem ${punchStep} of 3 is punched. Continue to the next emblem in the poem.`
        ];
      }
    } else {
      playSFX('error');
      punchedHoles = [];
      punchStep = 0;
      feedback = [
        '剪下的印記與月台古詩〈夜車行〉所載的順序不符。你撫平票面，準備重新從初發之印開始剪孔。',
        'That emblem does not match the sequence in the platform poem. Start over from the first emblem.'
      ];
    }
    render();
  }

  function checkTunerSuccess() {
    if (tunerFreq === tunerTargetFreq && tunerPhase === tunerTargetPhase) {
      sideBPlayed = true;
      trainApproaching = true;
      puzzle = '';
      playSFX('tapeB');
      updateAmbience();
      feedback = [
        '兩道波形完全重合，嘶嘶的底噪瞬間退去。老站長溫厚卻微微沙啞的聲音從喇叭裡傳來：「小時候你總問我，為什麼這座小站叫四〇四。因為有些迷路的人，需要一個不會催他們離開的地方……每個起霧的夜裡，我都會在檔案室桌上泡好一杯溫熱的茶。別怪自己回來得太晚，末班車我已經替你調好號誌了，去月台吧。」',
        'As the waveforms lock together, the static melts away. Your father’s warm, slightly hoarse voice fills the room: “When you were little, you always asked why this station was called 404. Because some lost people need a place that won’t rush them away... Every misty night, I left a cup of warm tea waiting on the archive desk. Don’t blame yourself for coming back late. I’ve set the signal for the last train—head to the platform.”'
      ];
      triggerEffect('tapeB', [
        'B 面磁帶播放完畢 · 父親留下的最後訊號已送達',
        'Side B finished playing · Father’s final signal received'
      ], 1450);
      return true;
    }
    return false;
  }

  function attemptLanternFlash() {
    initAudio();
    const inSweetSpot = reduced.matches || (lanternPulse >= 0.40 && lanternPulse <= 0.88);
    lanternBeamTime = performance.now();
    if (inSweetSpot) {
      lanternStage++;
      if (lanternStage >= 3) {
        trainArrived = true;
        trainApproaching = false;
        puzzle = '';
        playSFX('arrival');
        updateAmbience();
        startCutscene('cutscene-arrival', 10500);
      } else {
        playSFX('lantern');
        feedback = [
          `你高舉提燈，金黃色的光束穿透濃霧！隧道深處傳來第 ${lanternStage} 聲低沉的鳴笛回應，車頭燈越來越近了（${lanternStage} / 3）。`,
          `You raise the lantern and golden light pierces the fog! A deep horn answers from the tunnel (${lanternStage} / 3).`
        ];
      }
    } else {
      playSFX('error');
      feedback = [
        '光束舉起的時機偏了一點，被濃霧吞沒了。等光圈收攏到提燈中央時再舉燈。',
        'The beam was raised slightly off-timing and swallowed by the fog. Wait until the ring converges on the lantern center.'
      ];
    }
    render();
  }

  // Track mouse/pointer coordinates in 320x180 logical space for the cursor-following ticket punch
  canvas.addEventListener('pointermove', (event) => {
    const rectBounds = canvas.getBoundingClientRect();
    if (!rectBounds.width || !rectBounds.height) return;
    mouseX = ((event.clientX - rectBounds.left) / rectBounds.width) * 320;
    mouseY = ((event.clientY - rectBounds.top) / rectBounds.height) * 180;
    if (puzzle === 'punchGame' && !effect) {
      paint('', 1, performance.now());
    }
  });

  // Direct Canvas Pointer Interaction
  canvas.addEventListener('pointerdown', (event) => {
    if (document.body.dataset.phase !== 'playing') return;
    initAudio();
    const rectBounds = canvas.getBoundingClientRect();
    if (!rectBounds.width || !rectBounds.height) return;
    const x = ((event.clientX - rectBounds.left) / rectBounds.width) * 320;
    const y = ((event.clientY - rectBounds.top) / rectBounds.height) * 180;
    mouseX = x;
    mouseY = y;

    // If a hands-free cutscene is playing, clicking skips/completes it gently
    if (activeCutscene) {
      finishCutscene();
      return;
    }

    if (puzzle === 'locker') {
      for (let i = 0; i < 5; i++) {
        const bx = 42 + i * 48;
        if (x >= bx && x <= bx + 42 && y >= 44 && y <= 96) {
          if (!input.includes(i) && input.length < 3) {
            input = [...input, i];
            if (input.length === 3) {
              if (input.every((v, idx) => v === lockerTarget[idx])) {
                lockerOpen = true;
                hasFuse = true;
                puzzle = '';
                input = [];
                playSFX('unlock');
                feedback = [
                  '三枚符號對準，鐵櫃鎖舌彈開。你取出了裡面的備用陶瓷保險絲。',
                  'With the three symbols aligned, the latch springs open. You take the spare ceramic fuse inside.'
                ];
                triggerEffect('unlock', [
                  '工具鐵櫃已解鎖 · 取得備用保險絲',
                  'Cabinet unlocked · Spare fuse acquired'
                ], 820);
              } else {
                input = [];
                playSFX('error');
                feedback = [
                  '鎖芯彈回原位。請對照筆記本裡的《發車時刻表》與《維修手冊》查出正確的三枚符號順序。',
                  'The pins reset. Cross-reference the Departure Schedule and Service Manual in your notebook.'
                ];
              }
            } else {
              playSFX('click');
            }
            render();
          }
          return;
        }
      }
    } else if (puzzle === 'circuits') {
      for (let i = 0; i < 4; i++) {
        const bx = 46 + i * 58;
        if (x >= bx && x <= bx + 44 && y >= 40 && y <= 134) {
          if (!input.includes(i) && input.length < 3) {
            input = [...input, i];
            if (input.length === 3) {
              if (input.every((v, idx) => v === circuitTarget[idx])) {
                powered = true;
                hasFuse = false;
                puzzle = '';
                input = [];
                playSFX('power');
                updateAmbience();
                feedback = [
                  '三道主迴路依序合上！整座車站的日光燈與候車大廳的暖黃立燈同時亮起，出口鐵捲門也緩緩升起。',
                  'All three main circuits engage! The station lights and the warm standing lamp in the Waiting Hall flare on, and the exit shutter rises.'
                ];
                triggerEffect('power', [
                  '全站電力恢復 · 候車大廳與出口閘門已開啟',
                  'Station power restored · Waiting Hall & Exit Gate open'
                ], 960);
              } else {
                input = [];
                playSFX('error');
                feedback = [
                  '過載保護跳脫，開關彈回原位。請檢查《維修手冊》記載的三道送電順序。',
                  'Overload protection tripped. Check the three-circuit startup order in the Service Manual.'
                ];
              }
            } else {
              playSFX('click');
            }
            render();
          }
          return;
        }
      }
    } else if (puzzle === 'pianoGame') {
      // First check if player clicked one of the 5 black keys on top (bx = 72 + slot * 31, y: 68..115)
      for (let bIdx = 0; bIdx < pianoBlackNotes.length; bIdx++) {
        const bx = 72 + pianoBlackNotes[bIdx].slot * 31;
        if (x >= bx && x <= bx + 16 && y >= 68 && y <= 115) {
          playPianoBlackKey(bIdx);
          return;
        }
      }
      // Then check if player clicked one of the 7 white keys (kx = 50 + k * 31, y: 68..148)
      for (let k = 0; k < 7; k++) {
        const kx = 50 + k * 31;
        if (x >= kx && x <= kx + 29 && y >= 68 && y <= 148) {
          playPianoKey(k);
          return;
        }
      }
    } else if (puzzle === 'suitcase') {
      for (let i = 0; i < 3; i++) {
        const dx = 68 + i * 68;
        if (x >= dx && x <= dx + 48 && y >= 48 && y <= 130) {
          dials[i] = (dials[i] + 1) % 5;
          activeDial = i;
          playSFX('click');
          feedback = [
            `第 ${i + 1} 轉輪已轉至「${say(...dialOptions[i][dials[i]])}」。`,
            `Wheel ${i + 1} turned to “${say(...dialOptions[i][dials[i]])}”.`
          ];
          render();
          return;
        }
      }
    } else if (puzzle === 'punchGame') {
      attemptTicketPunchAt(x, y);
    } else if (puzzle === 'tunerGame') {
      if (Math.hypot(x - 244, y - 58) <= 26) {
        tunerFreq = (tunerFreq + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `已轉動左旋鈕（頻率 CH-${tunerFreq + 1}），目前訊號契合度：${getTunerLockPercent()}%。`,
            `Turned left knob (Freq CH-${tunerFreq + 1}). Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      } else if (Math.hypot(x - 244, y - 118) <= 26) {
        tunerPhase = (tunerPhase + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `已轉動右旋鈕（相位 P-${tunerPhase + 1}），目前訊號契合度：${getTunerLockPercent()}%。`,
            `Turned right knob (Phase P-${tunerPhase + 1}). Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      }
    } else if (puzzle === 'lanternGame') {
      attemptLanternFlash();
    } else if (inspectedItem) {
      inspectedItem = '';
      feedback = [];
      playSFX('click');
      render();
    }
  });

  // =========================================================================
  // Scene Transitions with Full-Screen Black Act Intertitle Cards
  // =========================================================================
  function computeActForTransition(targetRoom) {
    if (sideBPlayed && (targetRoom === 'station' || targetRoom === 'carriage' || targetRoom === 'outside')) {
      return 4;
    }
    if (suitcaseOpen && targetRoom === 'radio') {
      return 3;
    }
    if (powered) {
      return 2;
    }
    return 1;
  }

  function travel(next) {
    const nextAct = computeActForTransition(next);
    room = next;
    puzzle = '';
    input = [];
    activeDial = -1;
    inspectedItem = '';
    feedback = [];
    playSFX('step');
    updateAmbience();

    if (nextAct > currentAct && !seenActs.has(nextAct)) {
      currentAct = nextAct;
      seenActs.add(nextAct);
      showActCard(nextAct);
    }
    render();
    get('location').focus({ preventScroll: true });
  }

  function resetAllState() {
    room = 'station';
    currentAct = 1;
    seenActs = new Set([1]);
    hasFuse = false;
    powered = false;
    teaChecked = false;
    lockerOpen = false;
    suitcaseOpen = false;
    pillarChecked = false;
    hasPunch = false;
    hasPhoto = false;
    hasSideB = false;
    ticketPunched = false;
    sideBPlayed = false;
    trainApproaching = false;
    trainArrived = false;
    ending = '';
    puzzle = '';
    input = [];
    activeDial = -1;
    inspectedItem = '';
    feedback = [];
    caption = [];
    effect = '';
    effectProgress = 1;
    punchStep = 0;
    lanternStage = 0;
    pianoSolved = false;
    activeCutscene = '';
    clues.clear();
    randomizePuzzles();
    randomizeExtras();
    updateAmbience();
  }

  function getTunerLockPercent() {
    const fDiff = Math.abs(tunerFreq - tunerTargetFreq);
    const pDiff = Math.abs(tunerPhase - tunerTargetPhase);
    return Math.max(10, 100 - fDiff * 22 - pDiff * 22);
  }

  function getRoomActions(key) {
    if (key === 'station') {
      const list = [
        {
          label: ['查看牆上的木牌題詩〈夜車行〉', 'Read Platform Poem “Verse of the Night Train”'],
          run() {
            clues.add('schedule');
            playSFX('click');
            feedback = getNoteText('schedule');
            render();
          },
        },
        {
          label: ['走進維修室', 'Enter Service Room'],
          run: () => travel('service'),
        },
      ];
      if (powered) {
        list.push({
          label: ['推門進入候車大廳', 'Enter Waiting Hall'],
          run: () => travel('lounge'),
        });
        if (suitcaseOpen) {
          list.push({
            label: ['前往廣播室', 'Go to Broadcast Room'],
            run: () => travel('radio'),
          });
        }
      }
      if (trainApproaching && !trainArrived) {
        list.unshift({
          label: ['拿起月台柱旁的號誌提燈', 'Pick Up Signal Lantern'],
          run() {
            puzzle = 'lanternGame';
            feedback = [];
            playSFX('click');
            render();
          },
        });
      }
      if (trainArrived) {
        if (ticketPunched) {
          list.unshift({
            label: ['持驗訖車票與黑傘，踏上末班列車', 'Board the Last Train with Ticket & Umbrella'],
            run() {
              ending = 'board';
              travel('carriage');
              triggerEffect('journey', [
                '末班列車駛離第四〇四號月台 · 迎向破曉',
                'The last train departs Platform 404 into daybreak'
              ], 1600);
            },
          });
        }
        list.push({
          label: ['站在月台目送列車，轉身走上地面街口', 'Send Off the Train & Walk Up to Street'],
          run() {
            ending = 'send';
            travel('outside');
            triggerEffect('train', [
              '目送父親最後一班列車遠去 · 黎明街口',
              'Sending off your father’s final train · Dawn Street'
            ], 1400);
          },
        });
      }
      return list;
    }

    if (key === 'service') {
      const list = [];
      if (!lockerOpen) {
        list.push({
          label: ['走近角落的工具鐵櫃（五鍵符號鎖）', 'Inspect Corner Tool Cabinet (Symbol Lock)'],
          run() {
            puzzle = 'locker';
            input = [];
            feedback = [];
            playSFX('click');
            render();
          },
        });
      }
      list.push(
        {
          label: ['進入站務檔案室', 'Enter Station Archive'],
          run: () => travel('archive'),
        },
        {
          label: ['前往配電控制室', 'Go to Control Room'],
          run: () => travel('booth'),
        },
        {
          label: ['返回第四〇四號月台', 'Return to Platform 404'],
          run: () => travel('station'),
        }
      );
      return list;
    }

    if (key === 'archive') {
      const list = [
        {
          label: ['翻閱桌上手札的題詩〈送電吟〉', 'Read Power Manual Poem “Verse of the Circuits”'],
          run() {
            clues.add('manual');
            playSFX('click');
            feedback = getNoteText('manual');
            render();
          },
        },
      ];
      if (powered) {
        list.unshift({
          label: teaChecked
            ? ['重讀家書背面的古詩〈寄遠人〉', 'Re-read Father’s Poem “Poem for the Traveler”']
            : ['端起那杯溫熱的茶，展讀壓在杯底的家書〈寄遠人〉', 'Touch the Warm Tea & Read the Letter Beneath'],
          run() {
            teaChecked = true;
            clues.add('letter');
            playSFX('memory');
            feedback = getNoteText('letter');
            render();
          },
        });
      } else {
        list.push({
          label: ['觸碰桌上的白瓷茶杯', 'Touch the Porcelain Teacup'],
          run() {
            playSFX('click');
            feedback = [
              '茶杯裡的水目前還是微涼的。先把車站的電源接通後再回來看看吧。',
              'The tea in the cup is still cool. Restore station power first and come back.'
            ];
            render();
          },
        });
      }
      list.push({
        label: ['返回維修室', 'Return to Service Room'],
        run: () => travel('service'),
      });
      return list;
    }

    if (key === 'booth') {
      const list = [];
      if (!powered) {
        if (hasFuse) {
          list.push({
            label: ['裝上備用保險絲，操作主配電盤', 'Insert Spare Fuse & Operate Breakers'],
            run() {
              puzzle = 'circuits';
              input = [];
              feedback = [];
              playSFX('click');
              render();
            },
          });
        } else {
          list.push({
            label: ['查看斷電的主配電盤', 'Inspect Unpowered Breaker Panel'],
            run() {
              playSFX('click');
              feedback = [
                '保險絲座空著。得先去維修室打開角落的工具櫃，取出備用陶瓷保險絲。',
                'The fuse socket is empty. Unlock the corner cabinet in the Service Room first to get the spare ceramic fuse.'
              ];
              render();
            },
          });
        }
      }
      list.push(
        {
          label: ['前往出口閘門', 'Go to Exit Gate'],
          run: () => travel('gate'),
        },
        {
          label: ['返回維修室', 'Return to Service Room'],
          run: () => travel('service'),
        }
      );
      return list;
    }

    if (key === 'lounge') {
      const list = [
        {
          label: pianoSolved
            ? ['再次彈奏角落的立式鋼琴', 'Play the Upright Piano Again']
            : ['走近角落的立式鋼琴（可點擊或按鍵盤彈奏）', 'Approach the Upright Piano (Click or Keyboard)'],
          run() {
            puzzle = 'pianoGame';
            pianoInput = [];
            feedback = [];
            playSFX('click');
            render();
          },
        },
        {
          label: ['查看磁磚柱上的童年身高刻痕', 'Inspect Childhood Height Mark on Pillar'],
          run() {
            pillarChecked = true;
            playSFX('click');
            const hStr = dialOptions[1][dialTarget[1]][0];
            feedback = [
              `你蹲下身，指尖撫過磁磚柱上的鉛筆刻痕——最清晰的那道刻在「${hStr}」，旁邊寫著：「等你長過這道線，就能自己搭車去遠方了。」`,
              `You trace the pencil notch on the tile pillar—marked clearly at “${hStr}”, beside your father’s note: “Once you grow past this line, you can ride the train anywhere.”`
            ];
            render();
          },
        },
      ];
      if (!suitcaseOpen) {
        list.unshift({
          label: ['查看長椅上的老站長舊皮箱（三輪密碼鎖）', 'Inspect Father’s Leather Suitcase (3-Wheel Lock)'],
          run() {
            puzzle = 'suitcase';
            feedback = [];
            playSFX('click');
            render();
          },
        });
      } else {
        // Direct navigation to Broadcast Room right at the top so the player never gets stuck!
        list.unshift({
          label: ['推開走廊側門，前往「廣播室」播放父親的錄音帶', 'Enter Broadcast Room to Play Father’s Tape'],
          run: () => travel('radio'),
        });
        if (!ticketPunched) {
          list.unshift({
            label: ['拿起黃銅驗票鉗，替口袋裡的回程票剪孔', 'Hold Brass Ticket Punch to Validate Return Ticket'],
            run() {
              puzzle = 'punchGame';
              punchStep = 0;
              punchedHoles = [];
              feedback = [];
              playSFX('click');
              render();
            },
          });
        }
        list.push({
          label: ['靜靜回想七年前那個雨夜', 'Recall the Rainy Night Seven Years Ago'],
          run() {
            startCutscene('cutscene-rain', 14000);
          },
        });
      }
      if (pianoSolved) {
        list.push({
          label: ['靜靜回想童年雨天的練琴午後', 'Recall the Rainy Afternoon Piano Lesson'],
          run() {
            startCutscene('cutscene-piano', 13500);
          },
        });
      }
      list.push({
        label: ['返回第四〇四號月台', 'Return to Platform 404'],
        run: () => travel('station'),
      });
      return list;
    }

    if (key === 'gate') {
      const list = [];
      if (powered) {
        list.push(
          {
            label: ['推門進入廣播室', 'Enter Broadcast Room'],
            run: () => travel('radio'),
          },
          {
            label: ['直接走上地面街口（不搭末班車離開）', 'Walk Up to Street Level Now'],
            run() {
              ending = 'early';
              travel('outside');
            },
          }
        );
      }
      list.push({
        label: ['返回配電控制室', 'Return to Control Room'],
        run: () => travel('booth'),
      });
      return list;
    }

    if (key === 'radio') {
      const list = [];
      if (!sideBPlayed) {
        if (hasSideB) {
          list.push({
            label: ['放入《B 面》磁帶，操作真空管示波器調頻', 'Insert Side B Tape & Tune Vacuum-Tube Receiver'],
            run() {
              puzzle = 'tunerGame';
              feedback = [];
              playSFX('click');
              render();
            },
          });
        } else {
          list.push({
            label: ['查看桌上的盤式錄音機', 'Inspect Reel-to-Reel Tape Deck'],
            run() {
              playSFX('click');
              feedback = [
                '機器裡只有例行廣播的 A 面。老站長留給你的《B 面》磁帶應該收在候車大廳長椅的舊皮箱裡。',
                'Only the routine Side A tape is loaded. The Side B tape your father recorded for you must be inside the suitcase in the Waiting Hall.'
              ];
              render();
            },
          });
        }
      } else {
        list.push({
          label: ['重聽老站長的《B 面》錄音', 'Replay Father’s Side B Recording'],
          run() {
            playSFX('tapeB');
            feedback = [
              '「小時候你總問我，為什麼這座小站叫四〇四。因為有些迷路的人，需要一個不會催他們離開的地方……每個起霧的夜裡，我都會在檔案室桌上泡好一杯溫熱的茶。別怪自己回來得太晚，末班車我已經替你調好號誌了，去月台吧。」',
              '“When you were little, you always asked why this station was called 404. Because some lost people need a place that won’t rush them away... Every misty night, I left a cup of warm tea waiting on the archive desk. Don’t blame yourself for coming back late. I’ve set the signal for the last train—head to the platform.”'
            ];
            render();
          },
        });
      }
      list.push(
        {
          label: ['返回第四〇四號月台', 'Return to Platform 404'],
          run: () => travel('station'),
        },
        {
          label: ['返回候車大廳', 'Return to Waiting Hall'],
          run: () => travel('lounge'),
        },
        {
          label: ['前往出口閘門', 'Go to Exit Gate'],
          run: () => travel('gate'),
        }
      );
      return list;
    }

    // Endings: outside or carriage
    return [
      {
        label: ['重新回到第四〇四號月台（新一輪隨機謎題）', 'Play Again on Platform 404 (New Randomized Run)'],
        run() {
          resetAllState();
          showActCard(1);
          render();
        },
      },
      {
        label: ['返回 MAKOTO LAB 首頁', 'Return to MAKOTO LAB Home'],
        run() {
          window.location.href = '/';
        },
      },
    ];
  }

  function render() {
    const [roomName, roomDesc] = getRoomText(room);
    const puzzleConfig = puzzle ? getPuzzleConfig(puzzle) : null;
    const pct = computeProgress();

    // Update Header & HUD
    get('language').textContent = language === 'zh' ? 'EN' : '中文';
    get('language').setAttribute('aria-label', say('切換為英文', 'Switch to Chinese'));
    if (get('sound')) {
      get('sound').textContent = soundEnabled
        ? say('聲音 · 開', 'SOUND · ON')
        : say('聲音 · 關', 'SOUND · OFF');
      get('sound').setAttribute('aria-pressed', String(soundEnabled));
    }

    const actInfo = actCards[currentAct] || actCards[1];
    get('chapter-hud').textContent = `${say(...actInfo.eyebrow)} · ${say(...actInfo.title)}`;
    get('status-hud').textContent = trainArrived
      ? say('末班車 · 已進站停靠', 'LAST TRAIN · DOCKED')
      : (trainApproaching
        ? say('末班車 · 進站號誌待發', 'LAST TRAIN · APPROACHING')
        : (powered
          ? say('全站電力 · 已恢復', 'POWER · ONLINE')
          : say('全站電力 · 待復電', 'POWER · OFFLINE')));

    get('room-code').textContent = say(...roomMeta[room].code);
    get('location').textContent = say(...roomName);
    get('progress-text').textContent = `${pct}%`;
    get('progress-fill').style.width = `${pct}%`;

    // Main Narrative Description & Feedback
    if (activeCutscene) {
      const cProg = Math.min(1, (performance.now() - cutsceneStart) / cutsceneDuration);
      get('description').textContent = getCutsceneStageText(activeCutscene, cProg);
      get('feedback').textContent = '';
    } else if (puzzleConfig && puzzleConfig.prompt) {
      get('description').textContent = say(...puzzleConfig.prompt);
      get('feedback').textContent = feedback.length
        ? say(...feedback)
        : (puzzleConfig.hint ? say(...puzzleConfig.hint) : '');
    } else {
      get('description').textContent = say(...roomDesc);
      get('feedback').textContent = feedback.length ? say(...feedback) : '';
    }

    // Sequence Display (for locker, circuits, piano, punch, tuner)
    const seqEl = get('sequence');
    if (puzzle === 'locker') {
      seqEl.textContent = input.length
        ? say(
          `已按下符號：${input.map((i) => symbolDefs[i][0]).join(' → ')}`,
          `Pressed: ${input.map((i) => symbolDefs[i][1]).join(' → ')}`
        )
        : '';
    } else if (puzzle === 'circuits') {
      seqEl.textContent = input.length
        ? say(
          `已推上閘刀：${input.map((i) => circuitDefs[i][0]).join(' → ')}`,
          `Engaged: ${input.map((i) => circuitDefs[i][1]).join(' → ')}`
        )
        : '';
    } else if (puzzle === 'pianoGame') {
      seqEl.textContent = pianoInput.length
        ? say(
          `目前彈奏音階：${pianoInput.map((n) => n + 1).join(' - ')}`,
          `Played notes: ${pianoInput.map((n) => n + 1).join(' - ')}`
        )
        : '';
    } else if (puzzle === 'punchGame') {
      seqEl.textContent = say(
        `已剪下驗票孔：${punchStep} / 3`,
        `Holes punched: ${punchStep} / 3`
      );
    } else {
      seqEl.textContent = '';
    }

    // Scene Caption Overlay (Hidden during cutscenes so no meta prompt blocks the art!)
    const capEl = get('scene-caption');
    if (activeCutscene) {
      capEl.hidden = true;
      capEl.textContent = '';
    } else if (puzzleConfig && puzzleConfig.title) {
      capEl.hidden = false;
      capEl.textContent = say(...puzzleConfig.title);
    } else if (caption.length) {
      capEl.hidden = false;
      capEl.textContent = say(...caption);
    } else {
      capEl.hidden = true;
      capEl.textContent = '';
    }

    // Render Interactive Inventory (#inventory & #inventory-items)
    const items = getInventoryList();
    get('inventory').textContent = say(
      `隨身物品（${items.length}）`,
      `INVENTORY (${items.length})`
    );
    const invContainer = get('inventory-items');
    invContainer.replaceChildren();
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inventory-chip';
      btn.dataset.active = String(inspectedItem === item.id);
      btn.textContent = say(...item.name);
      btn.addEventListener('click', () => {
        initAudio();
        playSFX('click');
        if (item.id === 'ticket' && hasPunch && !ticketPunched) {
          puzzle = 'punchGame';
          inspectedItem = '';
          punchStep = 0;
          punchedHoles = [];
          feedback = [
            '你把回程車票平鋪在桌面上，右手拿起父親留下的黃銅驗票鉗。移動滑鼠將驗票鉗對準車票上的印記方格，點擊即可剪下驗票孔。',
            'You lay the return ticket flat and hold your father’s brass punch. Move your cursor to aim the punch over an emblem box and click to punch.'
          ];
          render();
          return;
        }
        if (item.id === 'photo' && suitcaseOpen) {
          startCutscene('cutscene-rain', 14000);
          return;
        }
        if (inspectedItem === item.id) {
          inspectedItem = '';
          feedback = [];
        } else {
          inspectedItem = item.id;
          feedback = item.desc;
        }
        render();
      });
      invContainer.append(btn);
    });

    // Render Focused 3-Clue Notebook (#notebook, #note-count, #notes)
    const notebookEl = get('notebook');
    const notesEl = get('notes');
    notesEl.replaceChildren();
    const noteKeys = [...clues];
    if (!noteKeys.length) {
      notebookEl.hidden = true;
    } else {
      notebookEl.hidden = false;
      notebookEl.open = true;
      get('note-count').textContent = `${noteKeys.length} / 3`;
      noteKeys.forEach((key) => {
        const li = document.createElement('li');
        li.textContent = say(...getNoteText(key));
        notesEl.append(li);
      });
    }

    // Render Action / Puzzle Choices (#choices)
    const choicesEl = get('choices');
    choicesEl.replaceChildren();

    if (activeCutscene) {
      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.textContent = say('收起思緒，回到當下', 'Return to the Present');
      skipBtn.addEventListener('click', () => {
        initAudio();
        playSFX('click');
        finishCutscene();
      });
      choicesEl.append(skipBtn);
    } else if (puzzle === 'locker') {
      symbolDefs.forEach((sym, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        const pos = input.indexOf(index);
        button.textContent = pos !== -1
          ? `${say(...sym)} (${pos + 1})`
          : say(...sym);
        button.disabled = pos !== -1;
        button.addEventListener('click', () => {
          initAudio();
          if (input.includes(index)) return;
          input = [...input, index];
          if (input.length < 3) {
            playSFX('click');
            feedback = [
              `已按下第 ${input.length} 個符號：${say(...sym)}。`,
              `Pressed symbol ${input.length}: ${say(...sym)}.`
            ];
            render();
            return;
          }
          if (input.every((val, i) => val === lockerTarget[i])) {
            lockerOpen = true;
            hasFuse = true;
            puzzle = '';
            input = [];
            playSFX('unlock');
            feedback = [
              '三枚符號對準，鐵櫃鎖舌彈開。你取出了裡面的備用陶瓷保險絲。',
              'With the three symbols aligned, the latch springs open. You take the spare ceramic fuse inside.'
            ];
            triggerEffect('unlock', [
              '工具鐵櫃已解鎖 · 取得備用保險絲',
              'Cabinet unlocked · Spare fuse acquired'
            ], 820);
          } else {
            input = [];
            playSFX('error');
            feedback = [
              '鎖芯彈回原位。請對照筆記本裡的古詩〈夜車行〉查出初發、中渡、終歸的三枚印記。',
              'The pins reset. Cross-reference the platform poem in your notebook.'
            ];
          }
          render();
        });
        choicesEl.append(button);
      });
    } else if (puzzle === 'circuits') {
      circuitDefs.forEach((cDef, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        const pos = input.indexOf(index);
        button.textContent = pos !== -1
          ? `${say(...cDef)} (${pos + 1})`
          : say(...cDef);
        button.disabled = pos !== -1;
        button.addEventListener('click', () => {
          initAudio();
          if (input.includes(index)) return;
          input = [...input, index];
          if (input.length < 3) {
            playSFX('click');
            feedback = [
              `已推上第 ${input.length} 道開關：${say(...cDef)}。`,
              `Engaged switch ${input.length}: ${say(...cDef)}.`
            ];
            render();
            return;
          }
          if (input.every((val, i) => val === circuitTarget[i])) {
            powered = true;
            hasFuse = false;
            puzzle = '';
            input = [];
            playSFX('power');
            updateAmbience();
            feedback = [
              '三道主迴路依序合上！整座車站的日光燈與候車大廳的暖黃立燈同時亮起，出口鐵捲門也緩緩升起。',
              'All three main circuits engage! The station lights and the warm standing lamp in the Waiting Hall flare on, and the exit shutter rises.'
            ];
            triggerEffect('power', [
              '全站電力恢復 · 候車大廳與出口閘門已開啟',
              'Station power restored · Waiting Hall & Exit Gate open'
            ], 960);
          } else {
            input = [];
            playSFX('error');
            feedback = [
              '過載保護跳脫，開關彈回原位。請對照手札上的古詩〈送電吟〉查出先、繼、終三道迴路。',
              'Overload protection tripped. Check the startup order in the manual poem.'
            ];
          }
          render();
        });
        choicesEl.append(button);
      });
    } else if (puzzle === 'pianoGame') {
      pianoNotes.forEach((n, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = say(n.label[0], n.label[1]);
        btn.addEventListener('click', () => playPianoKey(idx));
        choicesEl.append(btn);
      });
      pianoBlackNotes.forEach((bNote, bIdx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = say(bNote.label[0], bNote.label[1]);
        btn.addEventListener('click', () => playPianoBlackKey(bIdx));
        choicesEl.append(btn);
      });
    } else if (puzzle === 'suitcase') {
      const wheelNames = [
        ['左輪（季節）', 'Left (Season)'],
        ['中輪（身高）', 'Middle (Height)'],
        ['右輪（番號）', 'Right (Track)'],
      ];
      for (let i = 0; i < 3; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${say(...wheelNames[i])}：${say(...dialOptions[i][dials[i]])}`;
        button.addEventListener('click', () => {
          initAudio();
          playSFX('click');
          dials[i] = (dials[i] + 1) % 5;
          activeDial = i;
          feedback = [
            `已將${say(...wheelNames[i])}轉至「${say(...dialOptions[i][dials[i]])}」。`,
            `Turned ${say(...wheelNames[i])} to “${say(...dialOptions[i][dials[i]])}”.`
          ];
          render();
        });
        choicesEl.append(button);
      }

      const unlockButton = document.createElement('button');
      unlockButton.type = 'button';
      unlockButton.textContent = say('壓下兩側銅扣開鎖', 'Press Brass Latches');
      unlockButton.addEventListener('click', () => {
        initAudio();
        if (dials.every((val, idx) => val === dialTarget[idx])) {
          suitcaseOpen = true;
          hasPunch = true;
          hasPhoto = true;
          hasSideB = true;
          puzzle = '';
          activeDial = -1;
          playSFX('unlock');
          startCutscene('cutscene-rain', 14000);
        } else {
          playSFX('error');
          feedback = [
            '銅扣紋絲不動。請參照家書背面的〈寄遠人〉詩句，對準季節、身高與車票番號三組轉輪。',
            'The latches hold fast. Consult your father’s poem to align the Season, Height, and Track wheels.'
          ];
          render();
        }
      });
      choicesEl.append(unlockButton);
    } else if (puzzle === 'punchGame') {
      ticketBoxes.forEach((box, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = say(
          `移至「${symbolDefs[idx][0]}」格剪孔`,
          `Punch “${symbolDefs[idx][1]}” Box`
        );
        btn.addEventListener('click', () => {
          mouseX = box.x;
          mouseY = box.y;
          attemptTicketPunchAt(box.x, box.y);
        });
        choicesEl.append(btn);
      });
    } else if (puzzle === 'tunerGame') {
      const freqBtn = document.createElement('button');
      freqBtn.type = 'button';
      freqBtn.textContent = say(
        `轉動左旋鈕（頻率：CH-${tunerFreq + 1}）`,
        `Turn Left Knob (Freq: CH-${tunerFreq + 1})`
      );
      freqBtn.addEventListener('click', () => {
        initAudio();
        tunerFreq = (tunerFreq + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `頻率已切換至 CH-${tunerFreq + 1}，目前訊號契合度：${getTunerLockPercent()}%。`,
            `Frequency set to CH-${tunerFreq + 1}. Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      });
      choicesEl.append(freqBtn);

      const phaseBtn = document.createElement('button');
      phaseBtn.type = 'button';
      phaseBtn.textContent = say(
        `轉動右旋鈕（相位：P-${tunerPhase + 1}）`,
        `Turn Right Knob (Phase: P-${tunerPhase + 1})`
      );
      phaseBtn.addEventListener('click', () => {
        initAudio();
        tunerPhase = (tunerPhase + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `相位已切換至 P-${tunerPhase + 1}，目前訊號契合度：${getTunerLockPercent()}%。`,
            `Phase set to P-${tunerPhase + 1}. Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      });
      choicesEl.append(phaseBtn);
    } else if (puzzle === 'lanternGame') {
      const flashBtn = document.createElement('button');
      flashBtn.type = 'button';
      flashBtn.textContent = say(
        `高舉號誌提燈閃光（已回應 ${lanternStage} / 3）`,
        `Raise Signal Lantern (${lanternStage} / 3)`
      );
      flashBtn.addEventListener('click', () => attemptLanternFlash());
      choicesEl.append(flashBtn);
    }

    if (puzzle && !activeCutscene) {
      const leaveButton = document.createElement('button');
      leaveButton.type = 'button';
      leaveButton.textContent = say('退開一步', 'Step Back');
      leaveButton.addEventListener('click', () => {
        initAudio();
        playSFX('click');
        puzzle = '';
        input = [];
        activeDial = -1;
        feedback = [];
        render();
      });
      choicesEl.append(leaveButton);
    } else if (!activeCutscene) {
      getRoomActions(room).forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = say(...action.label);
        button.addEventListener('click', () => {
          initAudio();
          action.run();
        });
        choicesEl.append(button);
      });
    }

    if (!effect) {
      paint('', 1, performance.now());
      scheduleAmbient();
    }
  }

  // =========================================================================
  // Confirmed 404 Opening Sequence (Preserved Unchanged)
  // =========================================================================
  let timer = 0;
  let noiseFrame = 0;
  let typingTimer = 0;

  function drawStatic() {
    const { width, height } = get('noise');
    const image = noise.createImageData(width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.random() > 0.72 ? 210 : Math.random() * 45;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    noise.putImageData(image, 0, 0);
    if (document.body.dataset.phase === 'static' && !reduced.matches) {
      noiseFrame = requestAnimationFrame(drawStatic);
    }
  }

  function typeText(element, text, done) {
    clearInterval(typingTimer);
    if (reduced.matches) {
      element.textContent = text;
      done?.();
      return;
    }
    element.textContent = '';
    let index = 0;
    typingTimer = window.setInterval(() => {
      index += 1;
      element.textContent = text.slice(0, index);
      if (index >= text.length) {
        clearInterval(typingTimer);
        done?.();
      }
    }, 85);
  }

  function showQuestion() {
    cancelAnimationFrame(noiseFrame);
    document.body.dataset.phase = 'question';
    get('static').hidden = true;
    get('error').hidden = true;
    get('question').hidden = false;
    get('answers').hidden = true;
    get('destinations').hidden = true;
    get('yes').textContent = say('是', 'Yes');
    get('unsure').textContent = say('不知道', "I don't know");
    get('back').textContent = say('返回', 'Back');
    typeText(get('prompt-title'), say('你在找什麼嗎？', 'Are you looking for something?'), () => {
      get('answers').hidden = false;
      get('yes').focus();
    });
  }

  function transition(next) {
    clearTimeout(timer);
    clearInterval(typingTimer);
    cancelAnimationFrame(noiseFrame);
    document.body.dataset.phase = 'static';
    get('static').hidden = false;
    drawStatic();
    timer = window.setTimeout(next, reduced.matches ? 80 : 520);
  }

  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'zh';
    document.documentElement.lang = language === 'zh' ? 'zh-Hant' : 'en';
    document.documentElement.dataset.lang = language;
    document.title = say('404 — 失落訊號 | MAKOTO LAB', '404 — Lost Signal | MAKOTO LAB');
    try { localStorage.setItem('portfolio-language', language); } catch {}
    document.querySelectorAll('[data-zh]').forEach((el) => {
      if (el.id === 'prompt-title' || el.id === 'sound') return;
      el.textContent = language === 'zh' ? el.dataset.zh : el.dataset.en;
    });
    render();
    if (!get('act-card').hidden && actCards[currentAct]) {
      const info = actCards[currentAct];
      get('act-eyebrow').textContent = say(...info.eyebrow);
      get('act-title').textContent = say(...info.title);
      get('act-sub').textContent = say(...info.sub);
    }
    if (document.body.dataset.phase === 'question') {
      get('prompt-title').textContent = get('answers').hidden && get('destinations').hidden
        ? say('那為什麼你會在這？', 'Then why are you here?')
        : say('你在找什麼嗎？', 'Are you looking for something?');
    }
  }

  get('yes').addEventListener('click', () => {
    initAudio();
    playSFX('click');
    get('answers').hidden = true;
    get('destinations').hidden = false;
    get('destinations').querySelector('a')?.focus();
  });

  get('back').addEventListener('click', () => {
    initAudio();
    playSFX('click');
    get('destinations').hidden = true;
    get('answers').hidden = false;
    get('yes').focus();
  });

  get('unsure').addEventListener('click', () => {
    initAudio();
    playSFX('click');
    get('answers').hidden = true;
    typeText(get('prompt-title'), say('那為什麼你會在這？', 'Then why are you here?'), () => {
      timer = window.setTimeout(() => {
        transition(() => {
          get('static').hidden = true;
          get('question').hidden = true;
          get('adventure').hidden = false;
          document.body.dataset.phase = 'opening';
          updateAmbience();
          render();
          timer = window.setTimeout(() => {
            document.body.dataset.phase = 'playing';
            updateAmbience();
            showActCard(1);
            scheduleAmbient();
          }, reduced.matches ? 40 : 2300);
        });
      }, reduced.matches ? 80 : 900);
    });
  });

  get('language').addEventListener('click', () => {
    initAudio();
    playSFX('click');
    setLanguage(language === 'zh' ? 'en' : 'zh');
  });

  if (get('sound')) {
    get('sound').addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      try {
        localStorage.setItem('lost-signal-sound', soundEnabled ? 'on' : 'off');
      } catch {}
      initAudio();
      if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(soundEnabled ? 1 : 0, audioCtx.currentTime, 0.08);
      }
      updateAmbience();
      if (soundEnabled) playSFX('click');
      render();
    });
  }

  setLanguage(language);
  timer = window.setTimeout(() => transition(showQuestion), reduced.matches ? 120 : 5000);
})();
