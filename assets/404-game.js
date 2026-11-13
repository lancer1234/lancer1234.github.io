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
    ['備用接地迴路', 'Ground Circuit'],
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
      } else if (type === 'wrong' || type === 'error') {
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
      } else if (type === 'punch' || type === 'punchHit') {
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
    { key: '1', alt: 'a', label: ['一音 · Do', '1 · Do'], freq: 261.63 },
    { key: '2', alt: 's', label: ['二音 · Re', '2 · Re'], freq: 293.66 },
    { key: '3', alt: 'd', label: ['三音 · Mi', '3 · Mi'], freq: 329.63 },
    { key: '4', alt: 'f', label: ['四音 · Fa', '4 · Fa'], freq: 349.23 },
    { key: '5', alt: 'g', label: ['五音 · Sol', '5 · Sol'], freq: 392.00 },
    { key: '6', alt: 'h', label: ['六音 · La', '6 · La'], freq: 440.00 },
    { key: '7', alt: 'j', label: ['七音 · Si', '7 · Ti'], freq: 493.88 },
  ];
  const pianoBlackNotes = [
    { slot: 0, key: 'w', label: ['升一音 · C♯', '♯1 · C♯'], freq: 277.18 },
    { slot: 1, key: 'e', label: ['升二音 · D♯', '♯2 · D♯'], freq: 311.13 },
    { slot: 3, key: 't', label: ['升四音 · F♯', '♯4 · F♯'], freq: 369.99 },
    { slot: 4, key: 'y', label: ['升五音 · G♯', '♯5 · G♯'], freq: 415.30 },
    { slot: 5, key: 'u', label: ['升六音 · A♯', '♯6 · A♯'], freq: 466.16 },
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
          `琴音在空曠的大廳裡輕輕迴盪。照著父親〈寄遠人〉詩中首句的四個音彈奏，就能解開譜架下的暗格。`,
          `The note echoes gently through the hall. Play the four notes from the first line of your father’s poem to unlock the music stand.`
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
        `半音黑鍵的餘韻在候車大廳裡靜靜散開。`,
        `The sharp black key resonates softly through the waiting hall.`
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
          '隧道深處的霧氣被兩道刺眼的暖白車頭燈劃破。鐵軌微微震動，銀灰色的末班列車伴隨著悠長的鳴笛，沿著枕木與鋼軌緩緩滑入第四〇四號月台。',
          'Twin warm headlights pierce the tunnel mist. The rails hum as the silver-gray last train sounds a long horn and glides along the tracks into Platform 404.'
        );
      }
      if (progress < 0.74) {
        return say(
          '列車在月台黃線旁平穩停妥，氣動雙扇車門輕輕向兩側滑開，溫暖的木質車廂燈光頃刻傾瀉而出，在潮濕的磨石子地磚上映出長長的光影。',
          'The train brakes smoothly beside the yellow platform line. Its pneumatic double doors slide apart, spilling warm golden light from the wooden carriage across the wet terrazzo tiles.'
        );
      }
      return say(
        '老站長一生守候的最後一班車，已經敞開車門停在你面前了。',
        'The final train your father waited his whole life to send off now stands open before you.'
      );
    }

    if (name === 'cutscene-ending-board') {
      if (progress < 0.34) {
        return say(
          '你提著那把遲到了七年的黑傘踏入溫暖的車廂。氣動車門在身後輕輕合攏，車窗外的月台燈下，彷彿佇立著老站長戴著制帽、微笑舉手敬禮的身影。',
          'Carrying the black umbrella seven years late, you step into the warm carriage. As the doors slide shut behind you, beneath the platform lamp outside stands the gentle silhouette of the old stationmaster raising his hand to his cap in farewell.'
        );
      }
      if (progress < 0.67) {
        return say(
          '列車在幽暗的地底隧道裡加速前行。父親的黑傘靜靜靠在膝旁，剪過三枚歸途印記的車票躺在木窗台上，隧道盡頭漸漸泛起一抹破曉的金光。',
          'The train gathers speed through the underground tunnel. Your father’s black umbrella rests by your knee and the punched return ticket lies on the wooden sill as a golden glimmer blooms at the tunnel’s end.'
        );
      }
      return say(
        '第一道金白色的晨光穿透車窗灑滿車廂。波光粼粼的霧河岸與雲海翻湧的望山隘口在窗外次第展開——這一次，你終於帶著他的祝福，真正踏上了歸途。',
        'The first golden-white rays of daybreak flood the carriage. As the shimmering Misty Riverside and the sea of clouds over Mountain Pass unfold outside, you are finally on your way home.'
      );
    }

    if (name === 'cutscene-ending-send') {
      if (progress < 0.35) {
        return say(
          '你握著父親留下的黑傘與黃銅號誌燈站在月台黃線後。氣動車門輕輕合上，一格格溫暖的車窗光影從你眼前緩緩滑過。',
          'Holding your father’s black umbrella and brass signal lantern behind the yellow line, you watch the doors close as the warm carriage windows glide past.'
        );
      }
      if (progress < 0.70) {
        return say(
          '兩盞紅色的車尾燈漸漸遠去，沒入隧道彼端的晨光裡。老站長掛念了一輩子的最後一班車，終於由你親手替他安全送出了第四〇四號月台。',
          'Twin red tail-lights recede into the morning light at the far end of the tunnel. You have safely sent off the final train your father watched over his whole life.'
        );
      }
      return say(
        '你合上值班日誌，帶著那把黑傘拾級走上長長的石階。無名街口的天空已經破曉，雨後初晴的晨風正溫柔地吹過整座城市。',
        'Closing the shift log, you carry the black umbrella up the long stone stairs. Dawn has broken over the street, and a gentle morning breeze sweeps across the rain-washed city.'
      );
    }

    if (name === 'cutscene-ending-early') {
      if (progress < 0.50) {
        return say(
          '你沒有等待那班尚未進站的列車，獨自穿過升起的鐵捲門，沿著長長的石階一步步走向地面。',
          'Without waiting for the train, you pass beneath the raised iron grille and climb the long stone stairs toward the surface.'
        );
      }
      return say(
        '微涼的夜風吹過黎明前的無名街口。身後的地底深處，那盞為晚歸旅人留著的燈火依然安靜地亮著。',
        'A cool night breeze drifts across the pre-dawn street. Deep underground behind you, the lamp left for a late traveler still glows quietly.'
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
        ['末班車廂 · 破曉歸途', 'Last Train · Homeward at Daybreak'],
        [
          '你坐在溫暖的木質車廂窗邊，父親留下的黑傘安靜靠在膝旁，親手剪下三枚歸途印記的回程票平放在窗台上。\n\n列車駛出幽暗的地底隧道，窗外依序掠過波光粼粼的霧河岸與雲海翻湧的望山隘口。破曉的第一道金白晨光穿透車窗灑在你肩上，彷彿那件舊站務大衣依然帶著父親掌心的溫度。\n\n第四〇四號月台不再是迷途者的滯留之地。那杯溫熱的茶、那首雨天的鋼琴曲、那把遲到了七年的黑傘，都在這個黎明化作了送你前行的力量。天亮以後，你終於可以不再回頭，好好地往前走了。',
          'You sit by the warm wooden carriage window with your father’s black umbrella resting against your knee and the return ticket—clipped with the three emblems of home—lying on the sill.\n\nEmerging from the underground tunnel, the train glides past the shimmering waters of Misty Riverside and the cloud-wreathed peaks of Mountain Pass. The first golden-white rays of daybreak warm your shoulders like the old station coat.\n\nPlatform 404 is no longer a limbo for the lost. The cup of warm tea, the rainy-day piano melody, and the umbrella that waited seven years have all become the strength carrying you forward into the morning.'
        ]
      ];
    }
    if (ending === 'send') {
      return [
        ['地面街口 · 目送黎明', 'Street Level · Sending Off the Dawn'],
        [
          '你在月台邊替老站長打完最後三次進站號誌，目送那班銀灰色的末班車載著溫暖的燈火駛向破曉，隨後撐起父親留下的黑傘，拾級走上地面的無名街口。\n\n雨已經停了，天邊浮起溫柔的金橘色朝霞。身後的地下車站完成了它最後一次發車，安靜地沉入晨光之中。\n\n你摸了摸口袋裡那張寫著「永遠有效」的回程車票。這一次，你替父親守完了最後一班夜車，也終於在黎明的微風裡與過去達成了和解。',
          'After raising the brass lantern three times on the platform to guide the final train into the dawn, you carry your father’s black umbrella up the stone steps to the street.\n\nThe night rain has cleared, and a rose-gold sunrise warms the city skyline. Beneath your feet, Platform 404 has completed its final departure and rests in peace.\n\nYour fingers brush the ticket in your pocket marked “Always Valid.” Having fulfilled your father’s final watch, you step forward into the morning breeze at peace with the past.'
        ]
      ];
    }
    return [
      ['地面街口 · 未竟之夜', 'Street Level · The Unfinished Night'],
      [
        '你穿過升起的鐵捲門，沿著長長的石階走上地面。黎明前的無名街口還籠罩在微涼的薄霧裡，遠處偶爾傳來一兩聲早班車的回音。\n\n身後的地下月台依然亮著剛恢復的燈火。你總覺得候車大廳的皮箱裡、或是廣播室緩緩轉動的磁帶上，還有老站長沒來得及對你說完的話。',
        'Passing through the raised iron gate, you climb the long stairs to the surface. The pre-dawn street lies wrapped in cool mist.\n\nDeep underground behind you, the restored lights of Platform 404 still hum softly—and you sense that in the Waiting Hall suitcase or the Broadcast Room tape deck, your father’s final words are still waiting to be heard.'
      ]
    ];
  }

  function getPuzzleConfig(key) {
    if (key === 'locker') {
      return {
        title: ['維修櫃 · 五鍵符號鎖', 'Service Cabinet · Symbol Lock'],
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
        title: ['配電控制室 · 備援配電盤', 'Control Room · Breaker Board'],
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
        title: ['候車大廳 · 立式鋼琴', 'Waiting Hall · Upright Piano'],
        prompt: [
          '指尖輕觸黑白琴鍵，琴聲便在空曠的候車大廳裡迴盪。若依序彈出父親家書題詩〈寄遠人〉首句所藏的四個音，就能解開譜架下的暗格。',
          'Touch the ivory and ebony keys to let the melody echo through the hall. Playing the four notes hidden in the first line of your father’s poem will unlock the compartment beneath the music stand.'
        ],
        hint: clues.has('letter')
          ? getNoteText('letter')
          : ['接通電源後，去站務檔案室看看那杯溫熱的茶與壓在杯底的家書吧。', 'Once power is on, check the warm teacup and the letter beneath it in the Archive.'],
      };
    }
    if (key === 'suitcase') {
      return {
        title: ['舊皮箱 · 三輪記憶鎖', 'Leather Suitcase · Memory Lock'],
        prompt: [
          '三組黃銅轉輪分別刻著季節、身高刻痕與車票番號。請吟味老站長家書背面的古詩〈寄遠人〉，對準三組轉輪後壓下銅扣開鎖。',
          'The three brass wheels bear the Season, Height Mark, and Ticket Track. Read your father’s poem to align the three wheels and press the brass latches.'
        ],
        hint: clues.has('letter')
          ? getNoteText('letter')
          : ['線索藏在檔案室家書背面的〈寄遠人〉詩中，亦可查看大廳磁磚柱與隨身車票。', 'Clues are woven into the poem on the back of the Archive letter, as well as the hall pillar and your ticket.'],
      };
    }
    if (key === 'punchGame') {
      return {
        title: ['站長驗票鉗 · 歸途車票', 'Conductor’s Ticket Punch · Return Ticket'],
        prompt: [
          '手上的黃銅驗票鉗跟隨著你的視線與手勢移動。車票上印著「彎月、圓圈、水波、星芒、山稜」五格印記，請依月台古詩〈夜車行〉中「初發、中渡、終歸」三印之序，將驗票鉗移至對應印記格上方並剪下圓孔。',
          'The brass ticket punch moves with your hand across the five emblem boxes on the ticket. Following the platform poem “Verse of the Night Train”, position the punch over each of the three emblems in order and clip the holes.'
        ],
        hint: clues.has('schedule')
          ? getNoteText('schedule')
          : ['月台木牌上的古詩〈夜車行〉記載了初發、中渡、終歸的三枚印記。', 'The poem on the platform plaque describes the three emblems in travel order.'],
      };
    }
    if (key === 'tunerGame') {
      return {
        title: ['廣播室 · 真空管調頻台', 'Broadcast Room · Wave Receiver'],
        prompt: [
          '轉動右側的頻率波段與相位微調旋鈕，參照家書〈寄遠人〉末句所藏的道數，讓亮白色的即時波形與基準波完全重合。',
          'Turn the Frequency and Phase knobs on the right, following the final line of your father’s poem until the live waveform locks onto the reference wave.'
        ],
        hint: clues.has('letter')
          ? getNoteText('letter')
          : ['家書背面的〈寄遠人〉末句「頻尋……道……相思」記載了波段與相位。', 'The final line of the poem in the Archive letter holds the channel and phase numbers.'],
      };
    }
    if (key === 'lanternGame') {
      return {
        title: ['第四〇四號月台 · 手提號誌燈', 'Platform 404 · Signal Lantern'],
        prompt: [
          '凝視手提號誌燈的琥珀色光圈，當外圍收縮的光環與中央燈框重疊時舉起提燈，向隧道裡的末班車發送三次進站號誌。',
          'Watch the lantern’s amber glow and raise the lantern when the converging ring overlaps the inner frame, sending three docking signals to the approaching train.'
        ],
        hint: [
          '待收縮的亮白光環進入提燈中央的雙線圓框時即可揮燈回應。',
          'Raise the lantern when the shrinking white ring enters the double circle at the center of the globe.'
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

  // =========================================================================
  // Detailed Character, Arched Umbrella & Commuter Train Drawing Helpers
  // =========================================================================
  function drawOpenUmbrella(cx, cy, rx, ry, shaftLen, t = 0, facing = 1) {
    // 1. Central steel shaft descending from canopy apex into the character's hand
    const handY = cy + shaftLen;
    ctx.strokeStyle = '#c4d2e2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry * 0.3);
    ctx.lineTo(cx, handY);
    ctx.stroke();

    // 2. Curved wooden J-handle at the bottom of the shaft
    ctx.strokeStyle = '#d8b688';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, handY - 3);
    ctx.lineTo(cx, handY + 1.5);
    ctx.arc(cx - facing * 2.6, handY + 1.5, 2.6, facing > 0 ? 0 : Math.PI, facing > 0 ? Math.PI : 0, false);
    ctx.stroke();

    // 3. Top metallic ferrule spike above the canopy dome
    ctx.strokeStyle = '#dce6f4';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry - 4.5);
    ctx.lineTo(cx, cy - ry + 1);
    ctx.stroke();
    circle('#eef4fc', cx, cy - ry - 4.5, 1.1);

    // 4. Arched 4-panel umbrella canopy with scalloped bottom rim
    const domeGrad = ctx.createLinearGradient(cx, cy - ry, cx, cy + 3);
    domeGrad.addColorStop(0, '#273142');
    domeGrad.addColorStop(0.55, '#141a24');
    domeGrad.addColorStop(1, '#0b0e14');

    const p0 = cx - rx;
    const p1 = cx - rx * 0.5;
    const p2 = cx;
    const p3 = cx + rx * 0.5;
    const p4 = cx + rx;

    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.moveTo(p0, cy);
    // Smooth arched dome top
    ctx.bezierCurveTo(cx - rx * 0.82, cy - ry * 0.98, cx - rx * 0.25, cy - ry, cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * 0.25, cy - ry, cx + rx * 0.82, cy - ry * 0.98, p4, cy);
    // 4 concave scalloped panels along bottom edge
    ctx.quadraticCurveTo((p3 + p4) * 0.5, cy - 3.4, p3, cy + 0.8);
    ctx.quadraticCurveTo((p2 + p3) * 0.5, cy - 3.2, p2, cy + 1.2);
    ctx.quadraticCurveTo((p1 + p2) * 0.5, cy - 3.2, p1, cy + 0.8);
    ctx.quadraticCurveTo((p0 + p1) * 0.5, cy - 3.4, p0, cy);
    ctx.closePath();
    ctx.fill();

    // 5. Crisp wet specular highlight along upper dome arch
    ctx.strokeStyle = 'rgba(218, 236, 255, 0.86)';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(p0, cy);
    ctx.bezierCurveTo(cx - rx * 0.82, cy - ry * 0.98, cx - rx * 0.25, cy - ry, cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * 0.25, cy - ry, cx + rx * 0.82, cy - ry * 0.98, p4, cy);
    ctx.stroke();

    // 6. Curved internal umbrella ribs & metallic rib tips
    ctx.strokeStyle = 'rgba(180, 206, 236, 0.42)';
    ctx.lineWidth = 0.9;
    for (const [rxPt, ryPt] of [[p1, cy + 0.8], [p2, cy + 1.2], [p3, cy + 0.8]]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry);
      ctx.quadraticCurveTo((cx + rxPt) * 0.5, cy - ry * 0.55, rxPt, ryPt);
      ctx.stroke();
    }
    for (const [tipX, tipY] of [[p0, cy], [p1, cy + 0.8], [p2, cy + 1.2], [p3, cy + 0.8], [p4, cy]]) {
      circle('#d8e4f2', tipX, tipY, 0.9);
    }

    // 7. Animated raindrop splashes bouncing off the dome & dripping from rib tips
    for (let s = 0; s < 5; s++) {
      const phase = (t * 3.2 + s * 0.21) % 1;
      const sx = cx + (s - 2) * (rx * 0.38);
      const baseArcY = cy - ry * (1 - Math.pow((s - 2) / 2.4, 2) * 0.78);
      const splashY = baseArcY - phase * 4.5;
      circle(`rgba(205, 232, 255, ${(1 - phase) * 0.85})`, sx + (phase - 0.5) * 3, splashY, 0.9);
    }
  }

  function drawFoldedUmbrella(handX, handY, tipX, tipY) {
    // Curved wooden J-handle held in the extended hand
    ctx.strokeStyle = '#e0be8e';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(handX - 2, handY - 1, 2.5, 0.2 * Math.PI, 1.25 * Math.PI, false);
    ctx.stroke();

    // Tapered black umbrella fabric body
    const dx = tipX - handX;
    const dy = tipY - handY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    shape('#141922', [
      [handX + nx * 2.2, handY + ny * 2.2],
      [handX - nx * 2.2, handY - ny * 2.2],
      [tipX - nx * 0.8, tipY - ny * 0.8],
      [tipX + nx * 0.8, tipY + ny * 0.8],
    ]);
    // Crisp wet silver edge along top of the folded umbrella
    ctx.strokeStyle = '#d4e2f4';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(handX + nx * 2.1, handY + ny * 2.1);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Brass collar ring & white button strap
    const midX = handX + dx * 0.45;
    const midY = handY + dy * 0.45;
    circle('#e6c882', handX + dx * 0.14, handY + dy * 0.14, 1.3);
    circle('#e8f0fa', midX, midY, 1.2);
    // Silver ferrule tip
    ctx.strokeStyle = '#eef4fc';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + (dx / len) * 4, tipY + (dy / len) * 4);
    ctx.stroke();
  }

  function drawStationmasterFigure(x, footY, scale = 1, opts = {}) {
    const {
      facing = 1,
      hasUmbrella = true,
      offerUmbrella = false,
      salute = false,
      sepia = false,
      t = 0,
    } = opts;
    const coatCol = sepia ? '#382f28' : '#222c3c';
    const coatEdge = sepia ? '#6e5c4e' : '#4e6078';
    const skinCol = sepia ? '#ebd8be' : '#dce6f2';
    const capCol = sepia ? '#28201b' : '#18202c';
    const goldCol = '#e8c67a';

    const headY = footY - 46 * scale;
    const shoulderY = footY - 38 * scale;
    const hemY = footY - 11 * scale;

    // 1. If holding open umbrella overhead, draw canopy & shaft behind/above head
    const umbX = x + facing * 2 * scale;
    const umbY = headY - 9 * scale;
    if (hasUmbrella) {
      drawOpenUmbrella(umbX, umbY, 24 * scale, 13.5 * scale, 22 * scale, t, facing);
    }

    // 2. Boots & trousers
    rect('#12161e', x - 5 * scale, hemY, 4 * scale, 11 * scale);
    rect('#1a202c', x + 1.5 * scale, hemY, 4 * scale, 11 * scale);
    rect('#0b0d12', x - 6 * scale, footY - 2.5 * scale, 6 * scale, 2.5 * scale);
    rect('#0b0d12', x + 1 * scale, footY - 2.5 * scale, 6 * scale, 2.5 * scale);

    // 3. Tailored long stationmaster overcoat
    shape(coatCol, [
      [x - 7.5 * scale, shoulderY],
      [x + 7.5 * scale, shoulderY],
      [x + 9.5 * scale, hemY],
      [x - 9.5 * scale, hemY],
    ]);
    ctx.strokeStyle = coatEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 7.5 * scale, shoulderY);
    ctx.lineTo(x - 9.5 * scale, hemY);
    ctx.moveTo(x + 7.5 * scale, shoulderY);
    ctx.lineTo(x + 9.5 * scale, hemY);
    ctx.stroke();

    // Brass coat buttons & warm scarf at collar
    rect('#c8a87e', x - 4.5 * scale, shoulderY - 1.5 * scale, 9 * scale, 3 * scale);
    for (let b = 0; b < 3; b++) {
      circle(goldCol, x + facing * 2 * scale, shoulderY + (6 + b * 6) * scale, 0.9 * scale);
    }

    // 4. Head & silver-gray hair
    circle(skinCol, x, headY, 5.8 * scale);
    rect('#c8d4e4', x - facing * 5.5 * scale, headY - 2 * scale, 3 * scale, 4 * scale);

    // 5. Peaked Stationmaster Cap (Crown, gold band, badge & visor brim)
    shape(capCol, [
      [x - 6.5 * scale, headY - 3 * scale],
      [x - 5.5 * scale, headY - 8.5 * scale],
      [x + 6.5 * scale, headY - 8.5 * scale],
      [x + 6.5 * scale, headY - 3 * scale],
    ]);
    rect(goldCol, x - 6 * scale, headY - 4.2 * scale, 12 * scale, 1.4 * scale);
    circle('#fff2c8', x + facing * 2 * scale, headY - 6 * scale, 1.1 * scale);
    // Visor brim
    shape('#0d1118', [
      [x + facing * 2 * scale, headY - 3.2 * scale],
      [x + facing * 10 * scale, headY - 1.8 * scale],
      [x + facing * 9 * scale, headY - 0.5 * scale],
      [x + facing * 1 * scale, headY - 1.8 * scale],
    ]);

    // 6. Arm gripping the open umbrella's J-handle
    if (hasUmbrella) {
      const handX = umbX;
      const handY = umbY + 21 * scale;
      ctx.strokeStyle = coatEdge;
      ctx.lineWidth = 3.2 * scale;
      ctx.beginPath();
      ctx.moveTo(x - facing * 2 * scale, shoulderY + 4 * scale);
      ctx.lineTo(handX, handY);
      ctx.stroke();
      circle(skinCol, handX, handY, 1.8 * scale);
    }

    // 7. Second arm: offering the spare folded umbrella OR saluting cap brim
    if (offerUmbrella) {
      const extX = x + facing * 16 * scale;
      const extY = shoulderY + 5 * scale;
      ctx.strokeStyle = coatCol;
      ctx.lineWidth = 3.4 * scale;
      ctx.beginPath();
      ctx.moveTo(x + facing * 4 * scale, shoulderY + 4 * scale);
      ctx.lineTo(extX, extY);
      ctx.stroke();
      circle(skinCol, extX, extY, 2 * scale);
      drawFoldedUmbrella(extX, extY, extX + facing * 18 * scale, extY - 9 * scale);
    } else if (salute) {
      ctx.strokeStyle = coatEdge;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(x + facing * 4 * scale, shoulderY + 4 * scale);
      ctx.lineTo(x + facing * 10 * scale, headY - 1 * scale);
      ctx.lineTo(x + facing * 7 * scale, headY - 3 * scale);
      ctx.stroke();
      circle(skinCol, x + facing * 7 * scale, headY - 3 * scale, 1.7 * scale);
    }
  }

  function drawTravelerFigure(x, footY, scale = 1, stride = 0) {
    const headY = footY - 43 * scale;
    const shoulderY = footY - 35 * scale;
    const hemY = footY - 12 * scale;
    const legSwing = Math.sin(stride) * 4 * scale;

    // Walking legs
    ctx.strokeStyle = '#1b222e';
    ctx.lineWidth = 3.2 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 2 * scale, hemY);
    ctx.lineTo(x - 2 * scale - legSwing, footY);
    ctx.moveTo(x + 2 * scale, hemY);
    ctx.lineTo(x + 2 * scale + legSwing, footY);
    ctx.stroke();

    // Coat silhouette
    shape('#38465c', [
      [x - 6.5 * scale, shoulderY],
      [x + 6.5 * scale, shoulderY],
      [x + 8.5 * scale, hemY],
      [x - 8.5 * scale, hemY],
    ]);
    // Scarf & head
    rect('#d8ba92', x - 4 * scale, shoulderY - 1.5 * scale, 8 * scale, 2.5 * scale);
    circle('#e6eef8', x, headY, 5.4 * scale);
    shape('#1c222c', [
      [x - 5.6 * scale, headY - 1 * scale],
      [x - 4 * scale, headY - 6.2 * scale],
      [x + 5.6 * scale, headY - 5 * scale],
      [x + 5.8 * scale, headY + 0.5 * scale],
    ]);

    // Arm carrying vintage leather suitcase
    const bagX = x + 7 * scale;
    const bagY = footY - 19 * scale;
    ctx.strokeStyle = '#4c5e78';
    ctx.lineWidth = 2.8 * scale;
    ctx.beginPath();
    ctx.moveTo(x + 3 * scale, shoulderY + 4 * scale);
    ctx.lineTo(bagX + 6 * scale, bagY);
    ctx.stroke();
    rect('#6e523c', bagX, bagY + 2 * scale, 13 * scale, 9 * scale);
    strokeRect('#cbb08e', bagX, bagY + 2 * scale, 13 * scale, 9 * scale);
    rect('#cbb08e', bagX + 4 * scale, bagY, 5 * scale, 2 * scale);
  }

  function drawFinBadge() {
    rect('rgba(8, 9, 12, 0.76)', 248, 152, 60, 18);
    strokeRect('rgba(255, 240, 205, 0.55)', 248, 152, 60, 18);
    ctx.fillStyle = '#fff4d8';
    ctx.font = '600 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIN · 404', 278, 164);
    ctx.textAlign = 'start';
  }

  // Render Hands-Free Cinematic Story Cutscenes (320x180 logical space scaled 2x to 640x360)
  function paintCutscene(name, progress, t) {
    rect('#07070a', 0, 0, 320, 180);

    if (name === 'cutscene-piano') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 180);
      bgGrad.addColorStop(0, '#121016');
      bgGrad.addColorStop(1, '#261e18');
      rect(bgGrad, 0, 0, 320, 180);

      if (progress < 0.36) {
        // Shot 1: Father & child sitting together at the upright piano in warm golden light
        radialGlow(160, 75, 10, 145, 'rgba(255, 224, 165, 0.34)');
        linearRay(90, 0, 180, 170, [[70, 0], [135, 0], [230, 180], [95, 180]], 'rgba(255, 236, 195, 0.22)');

        // Upright Piano body with warm wood paneling, brass pedals & music stand
        rect('#231d1a', 88, 48, 108, 92);
        strokeRect('rgba(255, 225, 175, 0.48)', 88, 48, 108, 92);
        rect('#181311', 96, 54, 92, 28);
        rect('#f2e6ce', 130, 66, 24, 14); // sheet music on stand
        rect('#f5ebd6', 94, 92, 96, 8); // ivory keyboard
        for (let k = 1; k < 16; k++) rect('rgba(56, 48, 42, 0.35)', 94 + k * 6, 92, 0.8, 8);
        for (const bk of [0, 1, 3, 4, 5, 7, 8, 10, 11, 12]) {
          rect('#181412', 98 + bk * 6, 92, 3.5, 4.8);
        }
        // Father in stationmaster cap seated on bench guiding the child's hands
        circle('#e6d4b8', 124, 68, 8);
        rect('#2b221c', 116, 59, 16, 5);
        rect('#e6c478', 116, 63, 16, 1.5);
        shape('#cbb292', [[111, 77], [137, 77], [141, 138], [107, 138]]);
        // Child seated beside him
        circle('#f5e6cc', 158, 80, 6.2);
        shape('#e8d5b5', [[149, 87], [167, 87], [169, 126], [147, 126]]);
        rect('#3a2e26', 102, 122, 74, 5); // piano bench
        for (let m = 0; m < 12; m++) {
          const mx = 100 + ((m * 19) % 92);
          const my = 86 - ((t * 18 + m * 11) % 58);
          circle('rgba(255, 242, 210, 0.78)', mx, my, 1.5);
        }
      } else if (progress < 0.72) {
        // Shot 2: Father kneeling by the tile pillar marking the child's height with a pencil
        radialGlow(160, 82, 12, 140, 'rgba(255, 228, 175, 0.32)');
        rect('#383432', 138, 18, 36, 144);
        strokeRect('rgba(255, 235, 200, 0.42)', 138, 18, 36, 144);
        for (let y = 30; y < 158; y += 16) rect('rgba(255,255,255,0.12)', 139, y, 34, 1);
        rect('#fff5dc', 162, 86, 12, 2);
        radialGlow(168, 87, 1, 18, 'rgba(255, 245, 215, 0.65)');
        // Child standing tall against the pillar
        circle('#f5e6cc', 184, 93, 6.2);
        shape('#e6d4b8', [[177, 100], [191, 100], [193, 144], [175, 144]]);
        // Father kneeling on the left holding the pencil to the mark
        circle('#d8c3a5', 114, 82, 7.8);
        rect('#2b221c', 106, 73, 16, 4.5);
        rect('#e6c478', 106, 77, 16, 1.3);
        shape('#c4ad8d', [[102, 91], [126, 91], [132, 144], [98, 144]]);
        rect('#fff0c8', 124, 86, 38, 2.5);
      } else {
        // Shot 3: Memory dissolving into the present-day hall with glowing open music stand
        const fade = (progress - 0.72) / 0.28;
        radialGlow(160, 90, 8, 130, `rgba(255, 230, 180, ${0.35 * (1 - fade * 0.4)})`);
        rect('#1d1918', 104, 58, 112, 82);
        strokeRect('rgba(255, 230, 185, 0.5)', 104, 58, 112, 82);
        rect('#fff4d8', 142, 68, 36, 22);
        radialGlow(160, 79, 4, 38, 'rgba(255, 240, 200, 0.6)');
      }
    } else if (name === 'cutscene-rain') {
      // Cool slate-blue rainy night on Platform 404 with detailed arched black umbrella
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 180);
      bgGrad.addColorStop(0, '#070b12');
      bgGrad.addColorStop(1, '#131c28');
      rect(bgGrad, 0, 0, 320, 180);

      // Slanted rain streaks falling across the night sky
      ctx.strokeStyle = 'rgba(185, 216, 255, 0.36)';
      ctx.lineWidth = 0.9;
      for (let r = 0; r < 46; r++) {
        const rx = ((r * 23 - Math.round(t * 36)) % 320 + 320) % 320;
        const ry = (r * 19 + Math.round(t * 118)) % 146;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2.5, ry + 7.5);
        ctx.stroke();
      }

      // Wet reflective platform floor & yellow safety line
      rect('#0d131c', 0, 140, 320, 24);
      rect('#d8b458', 0, 141, 320, 1.6);

      if (progress < 0.35) {
        // Shot 1: Young traveler walking toward the waiting train in the rain while Father hurries behind under his open black umbrella, offering a second umbrella!
        const p1 = progress / 0.35;
        // Station canopy shelter & warm lamp on the left
        shape('#161f2c', [[0, 18], [132, 18], [116, 34], [0, 34]]);
        rect('#465264', 76, 34, 3, 106);
        circle('#fff2ce', 77.5, 36, 4.5);
        radialGlow(77.5, 38, 3, 85, 'rgba(255, 220, 155, 0.30)');

        // Waiting commuter train on the right edge (x: 218..320)
        rect('#202836', 218, 44, 102, 96);
        strokeRect('#7e90a8', 218, 44, 102, 96);
        rect('#dce4f0', 218, 92, 102, 3.5);
        rect('#ffefd0', 230, 58, 30, 28); // open warm doorway
        rect('#ffefd0', 272, 62, 34, 22); // passenger window
        radialGlow(245, 76, 4, 48, 'rgba(255, 232, 180, 0.35)');

        // Young traveler walking right toward train carrying suitcase
        const walkX = Math.round(142 + p1 * 54);
        drawTravelerFigure(walkX, 141, 0.92, t * 8);

        // Stationmaster Father hurrying after the traveler under his open arched black umbrella + holding out the spare umbrella!
        const fatherX = Math.round(58 + p1 * 42);
        drawStationmasterFigure(fatherX, 141, 0.96, {
          facing: 1,
          hasUmbrella: true,
          offerUmbrella: true,
          t,
        });
      } else if (progress < 0.72) {
        // Shot 2: Close-up at the train door — doors sliding shut while Father stands under his arched black umbrella holding out the spare umbrella!
        const p2 = (progress - 0.35) / 0.37;
        // Detailed commuter carriage occupying right side (x: 162..320)
        rect('#3e4756', 162, 34, 158, 8); // corrugated roof
        rect('#1e2634', 162, 42, 158, 98);
        strokeRect('#8a9bb2', 162, 42, 158, 98);
        rect('#dce4f0', 162, 98, 158, 4);
        rect('#d8b464', 162, 103, 158, 2);

        // Pneumatic double doors closing (x: 174..218, y: 54..136)
        rect('#2c241e', 174, 54, 44, 82);
        const doorGap = Math.max(0, Math.round((1 - Math.min(1, p2 * 1.35)) * 18));
        const leafW = 22 - Math.round(doorGap * 0.5);
        rect('#323c4e', 174, 54, leafW, 82);
        strokeRect('#98a8be', 174, 54, leafW, 82);
        rect('#323c4e', 218 - leafW, 54, leafW, 82);
        strokeRect('#98a8be', 218 - leafW, 54, leafW, 82);

        // Warm lit carriage window with young traveler looking back inside (x: 234..296, y: 58..92)
        rect('#ffefd0', 234, 58, 62, 34);
        strokeRect('#98a8be', 234, 58, 62, 34);
        radialGlow(265, 75, 4, 54, 'rgba(255, 230, 180, 0.38)');
        circle('#262d38', 262, 73, 6);
        shape('#262d38', [[253, 80], [271, 80], [274, 92], [250, 92]]);

        // Father on the rain-swept platform under his large arched black umbrella, extending the spare umbrella toward the door
        const fatherX = Math.round(92 + Math.min(1, p2 * 1.2) * 26);
        radialGlow(72, 42, 4, 95, 'rgba(255, 220, 160, 0.25)');
        drawStationmasterFigure(fatherX, 141, 1.08, {
          facing: 1,
          hasUmbrella: true,
          offerUmbrella: true,
          t,
        });
      } else {
        // Shot 3: Train tail-lights receding down the tracks into the dark tunnel; Father standing alone under his arched black umbrella beneath the platform lamp
        const p3 = (progress - 0.72) / 0.28;
        // Tunnel portal & receding tracks on the right
        shape('#05070b', [[188, 52], [298, 52], [312, 140], [176, 140]]);
        ctx.strokeStyle = '#485466';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(176, 140);
        ctx.lineTo(188, 52);
        ctx.lineTo(298, 52);
        ctx.lineTo(312, 140);
        ctx.stroke();

        // Receding train car with twin red tail-lights
        const scaleT = Math.max(0.28, 1 - p3 * 0.65);
        const tx = Math.round(215 + p3 * 36);
        const ty = Math.round(96 - p3 * 6);
        const tw = Math.round(64 * scaleT);
        const th = Math.round(56 * scaleT);
        rect('#1c222e', tx - Math.round(tw / 2), ty - Math.round(th / 2), tw, th);
        strokeRect('#68788e', tx - Math.round(tw / 2), ty - Math.round(th / 2), tw, th);
        const tailR = Math.max(1.6, 3.8 * scaleT);
        radialGlow(tx, ty + Math.round(th * 0.15), 1, 28 * scaleT, `rgba(255, 85, 65, ${0.72 * (1 - p3 * 0.4)})`);
        circle('#ff6b57', tx - Math.round(tw * 0.28), ty + Math.round(th * 0.15), tailR);
        circle('#ff6b57', tx + Math.round(tw * 0.28), ty + Math.round(th * 0.15), tailR);

        // Warm platform lamp post on the left
        rect('#586370', 74, 32, 3, 109);
        circle('#fff0cc', 75.5, 32, 5);
        radialGlow(75.5, 36, 4, 108, 'rgba(255, 222, 160, 0.36)');
        radialGlow(98, 152, 4, 48, 'rgba(255, 220, 160, 0.20)');

        // Solitary Stationmaster standing motionless under his large arched black umbrella
        drawStationmasterFigure(98, 141, 1.06, {
          facing: 1,
          hasUmbrella: true,
          offerUmbrella: false,
          t,
        });
        // Puddle ripples around his boots
        circle('rgba(195, 224, 255, 0.35)', 98, 143, 10 + (t * 8) % 8, true, 0.8);
      }
    } else if (name === 'cutscene-arrival') {
      // Multi-shot architectural train arrival on Platform 404
      rect('#090b10', 0, 0, 320, 180);

      // Station back wall tiles & concrete pillars
      rect('#12151e', 0, 18, 320, 118);
      for (let ty = 32; ty < 132; ty += 16) {
        rect('rgba(255,255,255,0.03)', 0, ty, 320, 0.8);
      }
      for (let px = 48; px < 320; px += 84) {
        rect('#1a1e28', px, 18, 14, 118);
      }
      // Overhead catenary contact wire
      rect('#586274', 0, 35, 320, 1);

      if (progress < 0.38) {
        // Shot 1: Commuter train gliding out of the dark tunnel arch along steel rails with volumetric headlights
        const p1 = progress / 0.38;
        const ease1 = 1 - Math.pow(1 - p1, 2.4);

        // Tunnel portal arch on the left
        shape('#050609', [[0, 18], [82, 18], [82, 136], [0, 136]]);
        strokeRect('#4a5262', -2, 24, 84, 112);

        // Track bed, wooden sleepers & steel rails
        rect('#0b0d12', 0, 126, 320, 18);
        for (let sx = 8; sx < 320; sx += 14) {
          shape('#2a2420', [[sx, 132], [sx + 7, 132], [sx + 4, 140], [sx - 3, 140]]);
        }
        rect('#8a94a6', 0, 131, 320, 1.5);
        rect('#a8b2c4', 0, 137, 320, 1.8);

        // Train body advancing along the rails
        const frontX = Math.round(56 + ease1 * 178);
        const carLeft = frontX - 210;

        // Undercarriage bogies & steel wheels on rails
        for (const bx of [carLeft + 26, carLeft + 148]) {
          rect('#14171f', bx, 122, 38, 12);
          circle('#788294', bx + 8, 132, 4.5);
          circle('#788294', bx + 30, 132, 4.5);
        }

        // Main steel carriage body & sculpted aerodynamic front nose
        shape('#282f3d', [
          [carLeft, 46],
          [frontX - 14, 46],
          [frontX, 74],
          [frontX, 124],
          [carLeft, 124],
        ]);
        // Corrugated silver roof & pantograph
        shape('#525b6c', [
          [carLeft, 40],
          [frontX - 20, 40],
          [frontX - 14, 46],
          [carLeft, 46],
        ]);
        ctx.strokeStyle = '#8892a4';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(carLeft + 64, 40);
        ctx.lineTo(carLeft + 72, 35);
        ctx.lineTo(carLeft + 62, 35);
        ctx.stroke();

        // Silver & warm-amber waist stripes
        rect('#dce4f0', carLeft, 92, Math.max(0, frontX - carLeft - 2), 4);
        rect('#d8b05c', carLeft, 97, Math.max(0, frontX - carLeft - 2), 2);

        // Glowing passenger windows with interior seats & straps
        for (let w = 0; w < 4; w++) {
          const wx = carLeft + 16 + w * 40;
          if (wx + 28 < frontX - 18) {
            rect('#ffefd0', wx, 58, 28, 22);
            strokeRect('#9aa6ba', wx, 58, 28, 22);
            rect('#c89666', wx + 4, 73, 8, 7);
            rect('#c89666', wx + 16, 73, 8, 7);
            radialGlow(wx + 14, 69, 2, 26, 'rgba(255, 236, 190, 0.25)');
          }
        }

        // Sculpted front windshield, '404' destination headmark & cowcatcher skirt
        shape('#d8e6f5', [
          [frontX - 18, 54],
          [frontX - 6, 54],
          [frontX - 1, 74],
          [frontX - 18, 74],
        ]);
        rect('#fff2cc', frontX - 17, 47, 10, 5); // 404 headmark
        shape('#181c24', [
          [frontX - 12, 118],
          [frontX + 4, 124],
          [frontX - 4, 130],
          [frontX - 16, 130],
        ]);

        // Twin HDR Volumetric Headlights piercing the mist
        radialGlow(frontX, 96, 2, 46, 'rgba(255, 250, 232, 0.88)');
        linearRay(
          frontX, 96, 320, 118,
          [[frontX, 86], [320, 44], [320, 162], [frontX, 108]],
          'rgba(255, 248, 224, 0.42)',
          'rgba(255, 240, 200, 0.02)'
        );
        circle('#ffffff', frontX - 2, 92, 3.8);
        circle('#ffffff', frontX - 1, 102, 3.8);

        // Foreground platform edge & yellow tactile line
        rect('#1d212a', 0, 140, 320, 22);
        rect('#d8b458', 0, 142, 320, 2);
      } else if (progress < 0.74) {
        // Shot 2: Train braking beside Platform 404 & pneumatic double doors sliding open!
        const p2 = (progress - 0.38) / 0.36;
        const brakeOffset = Math.round(Math.pow(Math.max(0, 1 - p2 * 3.2), 2) * -18);
        const doorRaw = Math.max(0, Math.min(1, (p2 - 0.18) / 0.68));
        const doorOpen = 1 - Math.pow(1 - doorRaw, 3);

        // Corrugated roof & main steel body of the docked carriage
        rect('#4e586a', 0, 36, 320, 8);
        rect('#252c3a', 0, 44, 320, 90);
        rect('#dce4f0', 0, 98, 320, 4.5);
        rect('#d8b05c', 0, 104, 320, 2);

        // Left & Right passenger windows flanking the central double doors
        for (const wx of [22 + brakeOffset, 78 + brakeOffset, 204 + brakeOffset, 260 + brakeOffset]) {
          rect('#ffefd0', wx, 56, 42, 28);
          strokeRect('#9aa6ba', wx, 56, 42, 28);
          rect('#b87e52', wx + 6, 74, 12, 10);
          rect('#b87e52', wx + 24, 74, 12, 10);
          for (let s = 0; s < 3; s++) {
            circle('#d8c8b0', wx + 9 + s * 11, 62, 1.5, true, 0.9);
          }
        }

        // Central Double Doorway Recess (x: 134..186, y: 52..134)
        const doorX = 134 + brakeOffset;
        rect('#382b22', doorX, 52, 52, 82); // warm wooden interior background
        rect('#ffefd2', doorX + 4, 55, 44, 4); // warm interior ceiling light
        rect('#8c583a', doorX + 2, 92, 12, 18); // interior cushioned seats
        rect('#8c583a', doorX + 38, 92, 12, 18);
        rect('#e6cf9e', doorX + 14, 54, 1.8, 78); // vertical brass handrails
        rect('#e6cf9e', doorX + 36, 54, 1.8, 78);
        rect('#261d17', doorX, 124, 52, 10); // wooden carriage floor

        // Sliding Left & Right Pneumatic Door Leaves
        const slidePx = Math.round(doorOpen * 21);
        // Left door leaf
        rect('#323b4c', doorX - slidePx, 52, 26, 82);
        strokeRect('#9aa8be', doorX - slidePx, 52, 26, 82);
        rect('#cfe0f2', doorX - slidePx + 5, 58, 16, 26);
        // Right door leaf
        rect('#323b4c', doorX + 26 + slidePx, 52, 26, 82);
        strokeRect('#9aa8be', doorX + 26 + slidePx, 52, 26, 82);
        rect('#cfe0f2', doorX + 26 + slidePx + 5, 58, 16, 26);

        // Platform floor & expanding golden light spill from the opening doors
        rect('#181c24', 0, 134, 320, 28);
        rect('#d8b458', 0, 136, 320, 2);
        if (doorOpen > 0.02) {
          const halfGap = Math.round(doorOpen * 22);
          linearRay(
            doorX + 26, 134, doorX + 26, 162,
            [
              [doorX + 26 - halfGap, 134],
              [doorX + 26 + halfGap, 134],
              [doorX + 26 + halfGap + 34, 162],
              [doorX + 26 - halfGap - 34, 162],
            ],
            `rgba(255, 238, 192, ${0.46 * doorOpen})`,
            'rgba(255, 230, 175, 0.04)'
          );
        }
      } else {
        // Shot 3: Inviting close-up of the open carriage doorway waiting for the player
        const p3 = (progress - 0.74) / 0.26;
        rect('#222836', 0, 18, 320, 122);
        rect('#dce4f0', 0, 96, 320, 5);
        rect('#d8b05c', 0, 103, 320, 2.5);

        // Wide open warm wooden carriage doorway in center (x: 106..214, y: 28..140)
        rect('#3b2d23', 106, 28, 108, 112);
        strokeRect('#b8c4d8', 104, 28, 112, 112);
        radialGlow(160, 74, 8, 92, 'rgba(255, 232, 180, 0.44)');
        rect('#fff6de', 124, 32, 72, 5); // warm ceiling lamp
        // Cushioned benches & brass handrails inside
        rect('#8f5638', 110, 88, 26, 22);
        rect('#8f5638', 184, 88, 26, 22);
        rect('#ebd29e', 136, 32, 2.5, 104);
        rect('#ebd29e', 181, 32, 2.5, 104);
        for (let s = 0; s < 4; s++) {
          rect('#cbb698', 144 + s * 10, 32, 1, 12);
          circle('#f0e2c8', 144.5 + s * 10, 46, 2.5, true, 1.1);
        }
        rect('#281e18', 106, 126, 108, 14);

        // Platform floor with warm golden light beam & floating motes
        rect('#161922', 0, 140, 320, 22);
        rect('#d8b458', 0, 142, 320, 2);
        linearRay(
          160, 140, 160, 162,
          [[106, 140], [214, 140], [256, 162], [64, 162]],
          'rgba(255, 238, 192, 0.48)',
          'rgba(255, 230, 175, 0.06)'
        );
        for (let m = 0; m < 10; m++) {
          const mx = 116 + ((m * 17) % 88);
          const my = 128 - ((t * 14 + m * 13 + p3 * 12) % 82);
          circle('rgba(255, 245, 215, 0.75)', mx, my, 1.3);
        }
      }
    } else if (name === 'cutscene-ending-board') {
      // TRUE ENDING FINALE CUTSCENE: Boarding the Last Train into Daybreak
      if (progress < 0.34) {
        // Shot 1: Looking back through the closing carriage doors at Platform 404 as Father's memory salutes under the lamp
        const p1 = progress / 0.34;
        const doorClose = Math.min(1, p1 * 1.25);
        const scrollX = Math.round(Math.max(0, p1 - 0.3) * 65);

        rect('#0c1018', 0, 18, 320, 144);
        // Platform lamp & Father's warm memory silhouette saluting farewell outside
        const lampX = 160 - scrollX;
        rect('#586474', lampX - 22, 34, 3, 102);
        circle('#fff2cc', lampX - 20.5, 34, 5);
        radialGlow(lampX - 10, 62, 6, 96, 'rgba(255, 226, 165, 0.36)');
        drawStationmasterFigure(lampX + 4, 136, 0.96, {
          facing: -1,
          hasUmbrella: false,
          salute: true,
          sepia: true,
          t,
        });

        // Interior carriage door frame & closing pneumatic doors in foreground
        rect('#231b16', 0, 18, 76, 144);
        rect('#231b16', 244, 18, 76, 144);
        const leafW = Math.round(22 + doorClose * 62);
        rect('#342a22', 76, 24, leafW, 134);
        strokeRect('#9e8870', 76, 24, leafW, 134);
        rect('#bfe0ff', 86, 38, Math.max(8, leafW - 18), 46);
        rect('#342a22', 244 - leafW, 24, leafW, 134);
        strokeRect('#9e8870', 244 - leafW, 24, leafW, 134);
        rect('#bfe0ff', 244 - leafW + 10, 38, Math.max(8, leafW - 18), 46);
      } else if (progress < 0.67) {
        // Shot 2: Seated by the carriage window with Father's umbrella & punched ticket as tunnel lights streak toward dawn
        const p2 = (progress - 0.34) / 0.33;
        const dawnMix = Math.pow(p2, 2);
        const winGrad = ctx.createLinearGradient(42, 24, 278, 114);
        winGrad.addColorStop(0, '#0c101a');
        winGrad.addColorStop(1, dawnMix > 0.3 ? '#d89b6a' : '#1b2436');
        rect(winGrad, 42, 24, 236, 90);

        // Streaking tunnel lights & blooming sunrise at tunnel exit
        for (let l = 0; l < 6; l++) {
          const lx = 280 - ((Math.round(t * 220) + l * 48) % 250);
          rect('rgba(255, 230, 175, 0.55)', lx, 48, 18, 3);
        }
        radialGlow(248, 68, 4, 30 + dawnMix * 95, `rgba(255, 242, 200, ${0.25 + dawnMix * 0.65})`);

        // Carriage wooden window frame, punched ticket & Father's black umbrella
        rect('#171414', 0, 18, 42, 144);
        rect('#171414', 278, 18, 42, 144);
        rect('#171414', 42, 18, 236, 8);
        shape('#332b26', [[28, 114], [292, 114], [310, 142], [10, 142]]);
        rect('#221d1a', 10, 142, 300, 20);
        strokeRect('#8a7e72', 40, 24, 240, 92);

        // Ticket & Black Umbrella with curved J-handle resting beside knee
        rect('#f5ebd8', 132, 120, 52, 14);
        for (let p = 0; p < 3; p++) circle('#171516', 164 + p * 6, 127, 2);
        drawFoldedUmbrella(72, 98, 66, 158);
      } else {
        // Shot 3: Train emerging into golden-white daybreak over Misty Riverside & Mountain Pass
        const p3 = (progress - 0.67) / 0.33;
        const skyGrad = ctx.createLinearGradient(0, 24, 0, 90);
        skyGrad.addColorStop(0, '#3a4e72');
        skyGrad.addColorStop(0.55, '#d4966c');
        skyGrad.addColorStop(1, '#fff4d6');
        rect(skyGrad, 42, 24, 236, 66);

        radialGlow(218, 52, 6, 105, 'rgba(255, 246, 212, 0.88)');
        circle('#ffffff', 218, 52, 12);
        shape('#44495a', [[42, 88], [95, 50], [148, 88]]);
        shape('#323746', [[120, 88], [182, 42], [252, 88]]);
        shape('#52586c', [[210, 88], [255, 58], [278, 88]]);

        const riverGrad = ctx.createLinearGradient(0, 88, 0, 114);
        riverGrad.addColorStop(0, '#5e6a80');
        riverGrad.addColorStop(1, '#2c3442');
        rect(riverGrad, 42, 88, 236, 26);
        for (let i = 0; i < 18; i++) {
          const wx = 46 + ((i * 22 - Math.round((t * 32 + p3 * 40))) % 228 + 228) % 228;
          rect('#fff4d4', wx, 92 + (i % 4) * 5, 10, 1.5);
        }

        rect('#171516', 0, 18, 42, 144);
        rect('#171516', 278, 18, 42, 144);
        rect('#171516', 42, 18, 236, 8);
        shape('#332b26', [[28, 114], [292, 114], [310, 142], [10, 142]]);
        rect('#221d1a', 10, 142, 300, 20);
        strokeRect('#8a7e72', 40, 24, 240, 92);
        rect('#f5ebd8', 132, 120, 52, 14);
        for (let p = 0; p < 3; p++) circle('#171516', 164 + p * 6, 127, 2);
        drawFoldedUmbrella(72, 98, 66, 158);
        linearRay(218, 52, 140, 162, [[130, 24], [278, 24], [245, 162], [60, 162]], 'rgba(255, 244, 208, 0.34)');
      }
    } else if (name === 'cutscene-ending-send') {
      // ENDING 2 CUTSCENE: Sending Off the Final Train & Walking into Dawn
      if (progress < 0.35) {
        const p1 = progress / 0.35;
        rect('#0b0e15', 0, 18, 320, 144);
        const tx = Math.round(20 + p1 * 95);
        rect('#262e3c', tx, 42, 220, 92);
        strokeRect('#8896ac', tx, 42, 220, 92);
        rect('#dce4f0', tx, 94, 220, 4);
        for (let w = 0; w < 4; w++) {
          rect('#ffefd0', tx + 18 + w * 48, 56, 32, 24);
        }
        rect('#181c24', 0, 134, 320, 28);
        rect('#d8b458', 0, 136, 320, 2);
        // Player holding brass lantern & Father's umbrella in foreground
        circle('#fff2c8', 84, 118, 6);
        radialGlow(84, 118, 2, 38, 'rgba(255, 225, 160, 0.5)');
        drawFoldedUmbrella(64, 108, 56, 152);
      } else if (progress < 0.70) {
        const p2 = (progress - 0.35) / 0.35;
        rect('#090c12', 0, 18, 320, 144);
        radialGlow(248, 86, 4, 85, `rgba(255, 220, 165, ${0.25 + p2 * 0.45})`);
        const tx = Math.round(180 + p2 * 62);
        const s = Math.max(0.3, 1 - p2 * 0.6);
        rect('#1e2430', tx, 72, Math.round(52 * s), Math.round(46 * s));
        circle('#ff6b57', tx + 8, 96, 3 * s);
        circle('#ff6b57', tx + Math.round(44 * s), 96, 3 * s);
      } else {
        const skyGrad = ctx.createLinearGradient(0, 18, 0, 114);
        skyGrad.addColorStop(0, '#2a3548');
        skyGrad.addColorStop(0.6, '#8c6e62');
        skyGrad.addColorStop(1, '#f2d4ae');
        rect(skyGrad, 0, 18, 320, 96);
        radialGlow(225, 42, 4, 78, 'rgba(255, 236, 188, 0.78)');
        circle('#fff9ec', 225, 42, 10);
        shape('#20232b', [[145, 112], [181, 112], [278, 162], [42, 162]]);
      }
    } else if (name === 'cutscene-ending-early') {
      const skyGrad = ctx.createLinearGradient(0, 18, 0, 114);
      skyGrad.addColorStop(0, '#0a0d16');
      skyGrad.addColorStop(1, '#1d2433');
      rect(skyGrad, 0, 18, 320, 96);
      radialGlow(225, 38, 4, 42, 'rgba(220, 235, 255, 0.45)');
      circle('#fff9ec', 225, 38, 9);
      shape('#20232b', [[145, 112], [181, 112], [278, 162], [42, 162]]);
      rect('#111318', 52, 122, 62, 38);
      strokeRect('#7a8290', 52, 122, 62, 38);
      radialGlow(83, 142, 4, 48, 'rgba(255, 224, 165, 0.45)');
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

    // 1. Street Level (Ending: Send Off or Early Exit)
    if (room === 'outside') {
      const isEarly = ending === 'early' || ending === 'keep';
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 114);
      if (isEarly) {
        skyGrad.addColorStop(0, '#0a0d16');
        skyGrad.addColorStop(1, '#1d2433');
      } else {
        skyGrad.addColorStop(0, '#2a3548');
        skyGrad.addColorStop(0.6, '#7a6860');
        skyGrad.addColorStop(1, '#e8cba8');
      }
      rect(skyGrad, 0, 0, 320, 114);

      // HDR Moon or Rising Dawn Sun
      radialGlow(225, 32, 4, isEarly ? 42 : 76, isEarly ? 'rgba(220,235,255,0.45)' : 'rgba(255,235,185,0.75)');
      circle('#fff9ec', 225, 32, 10);

      for (let i = 0; i < 12; i++) {
        const height = 18 + (i * 31) % 48;
        rect(i % 2 ? (isEarly ? '#1a1e28' : '#323742') : (isEarly ? '#13161f' : '#262a34'), i * 28, 114 - height, 25, height);
        if (i % 3 === 0) rect(isEarly ? '#ffe6b0' : '#ffefc8', i * 28 + 6, 114 - height + 8, 4, 5);
      }
      shape('#20232b', [[145, 112], [181, 112], [278, 180], [42, 180]]);
      shape('#7e8490', [[161, 119], [164, 119], [169, 180], [154, 180]]);

      if (isEarly) {
        rect('#111318', 52, 126, 62, 42);
        strokeRect('#7a8290', 52, 126, 62, 42);
        const pulse = 0.65 + 0.35 * Math.sin(t * 2.4);
        radialGlow(83, 148, 4, 48, `rgba(255, 224, 165, ${0.35 + 0.2 * pulse})`);
        rect('#ffe8b8', 62, 118, 42, 5);
      }

      if (ending === 'send') {
        const trainPos = sceneEffect === 'train' ? progress : 0.72;
        const trainX = Math.round(70 + 185 * trainPos);
        if (trainX < 320) {
          rect('#222630', trainX, 98, 92, 18);
          strokeRect('#788498', trainX, 98, 92, 18);
          rect('#dce4f0', trainX, 110, 92, 2);
          for (let i = 0; i < 5; i++) rect('#fff0cc', trainX + 8 + i * 16, 102, 11, 6);
          radialGlow(trainX + 46, 107, 4, 45, 'rgba(255, 235, 190, 0.28)');
        }
      }
      drawFinBadge();
      grain(41, 1400);
      ctx.restore();
      return;
    }

    // 2. Last Train Carriage (True Ending - HDR Daybreak Journey)
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

      // Punched Return Ticket & Father's Black Umbrella with curved J-handle
      rect('#f5ebd8', 132, 122, 52, 14);
      rect('#2a2420', 136, 125, 26, 2);
      for (let p = 0; p < 3; p++) circle('#171516', 164 + p * 6, 129, 2);
      drawFoldedUmbrella(72, 100, 66, 164);

      // Volumetric HDR Sunbeams pouring into the carriage
      linearRay(218, 52, 140, 175, [[140, 22], [278, 22], [240, 180], [65, 180]], 'rgba(255, 242, 204, 0.30)');
      drawFinBadge();
      grain(19, 1200);
      ctx.restore();
      return;
    }

    // 3. Base Underground Architecture with HDR Depth Shading (Rooms 01-07)
    const floorGrad = ctx.createLinearGradient(0, 114, 0, 180);
    floorGrad.addColorStop(0, '#18191e');
    floorGrad.addColorStop(1, '#262830');
    rect(floorGrad, 0, 96, 320, 84);
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
      // Left Wall: Trackside Platform Recess & Tunnel Portal in True 1-Point Perspective
      shape('#07090e', [[12, 34], [104, 62], [104, 115], [12, 150]]);
      shape('#5c6270', [[9, 32], [12, 34], [12, 150], [9, 153]]);
      // Yellow tactile safety line along the left platform edge
      shape('#d8b458', [[6, 153], [112, 112], [114, 113], [8, 155]]);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(12, 34);
      ctx.lineTo(104, 62);
      ctx.lineTo(104, 115);
      ctx.lineTo(12, 150);
      ctx.closePath();
      ctx.clip();

      // Perspective rails inside the track recess
      shape('#485060', [[12, 146], [104, 113], [104, 114.5], [12, 148]]);
      shape('#363c48', [[12, 138], [104, 110], [104, 111], [12, 140]]);

      if (trainApproaching && !trainArrived && puzzle !== 'lanternGame') {
        const glow = 0.55 + 0.35 * Math.sin(t * 3.5);
        // Approaching locomotive silhouette deep in the tunnel portal
        rect('#1d2330', 74, 76, 24, 32);
        strokeRect('#6e7b90', 74, 76, 24, 32);
        rect('#cfe0f5', 77, 81, 18, 8);
        radialGlow(86, 98, 1, 28, `rgba(255, 242, 200, ${glow * 0.75})`);
        linearRay(86, 98, 12, 146, [[80, 96], [92, 98], [32, 150], [12, 138]], `rgba(255, 244, 210, ${glow * 0.32})`);
        circle('#fff9ec', 80, 98, 2.8);
        circle('#fff9ec', 92, 99, 2.5);
      }

      if (trainArrived || sceneEffect === 'arrival') {
        // True 1-Point Perspective Docked Commuter Train along Left Track Wall (x: 12..100)
        const pLerp = (x, yL, yR) => yL + ((x - 12) / 88) * (yR - yL);
        const pQuad = (color, x0, x1, yL0, yR0, yL1, yR1) => {
          shape(color, [
            [x0, pLerp(x0, yL0, yR0)],
            [x1, pLerp(x1, yL0, yR0)],
            [x1, pLerp(x1, yL1, yR1)],
            [x0, pLerp(x0, yL1, yR1)],
          ]);
        };

        // 1. Perspective corrugated silver roof & upper trim
        pQuad('#505868', 12, 100, 40, 65, 49, 69);
        pQuad('#9aa4b6', 12, 100, 49, 69, 51, 70);
        // 2. Perspective steel carriage body
        pQuad('#252c3a', 12, 100, 51, 70, 148, 114);
        // 3. Perspective silver & warm-gold waist stripes
        pQuad('#dce4f0', 12, 100, 96, 93, 101, 95);
        pQuad('#d8b05c', 12, 100, 102, 96, 104, 97);

        // 4. Perspective glowing passenger windows (front, mid-back, rear)
        for (const [wx0, wx1] of [[16, 34], [66, 80], [84, 96]]) {
          pQuad('#ffefd0', wx0, wx1, 58, 74, 88, 89);
          pQuad('#b87e52', wx0 + 2, wx1 - 2, 79, 84, 88, 89);
        }

        // 5. Perspective Open Double Doorway (x: 38..62) glowing with warm interior light
        pQuad('#3b2d23', 38, 62, 55, 72, 136, 121);
        pQuad('#fff6de', 40, 60, 56, 73, 60, 75); // interior ceiling light
        pQuad('#e6cf9e', 49, 51, 58, 74, 132, 122); // interior brass handrail pole
        pQuad('#281e18', 38, 62, 128, 118, 136, 121); // wooden carriage floor
      }
      ctx.restore();

      // Warm golden light spilling from the open train doorway across the platform floor
      if (trainArrived) {
        linearRay(
          48, 132, 128, 174,
          [[36, 140], [64, 129], [142, 162], [72, 179]],
          'rgba(255, 238, 192, 0.34)',
          'rgba(255, 230, 175, 0.02)'
        );
      }

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
      rect('rgba(5, 6, 9, 0.88)', 0, 0, 320, 180);

      // Tunnel Portal Arch & Perspective Steel Rails on the Left (x: 24..152)
      shape('#06080d', [[28, 148], [46, 36], [130, 36], [148, 148]]);
      ctx.strokeStyle = '#485264';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(28, 148);
      ctx.lineTo(46, 36);
      ctx.lineTo(130, 36);
      ctx.lineTo(148, 148);
      ctx.stroke();

      // Perspective rails & wooden sleepers approaching from the tunnel
      for (let r = 0; r < 5; r++) {
        const ry = 114 + r * 8;
        const spread = 14 + r * 7;
        rect('#28221e', 88 - spread, ry, spread * 2, 2);
      }
      shape('#788498', [[74, 108], [76, 108], [52, 148], [49, 148]]);
      shape('#788498', [[100, 108], [102, 108], [127, 148], [124, 148]]);

      // Detailed Front Profile of Approaching Commuter Train advancing with lanternStage
      const stageProgress = lanternStage / 3;
      const trainScale = 0.44 + stageProgress * 0.56;
      const trainCX = 88;
      const trainCY = Math.round(84 + stageProgress * 12);
      const w = Math.round(64 * trainScale);
      const h = Math.round(68 * trainScale);
      const tx0 = trainCX - Math.round(w / 2);
      const ty0 = trainCY - Math.round(h / 2);

      // Corrugated roof & main locomotive body
      shape('#4e586a', [
        [tx0 + Math.round(w * 0.1), ty0 - Math.round(5 * trainScale)],
        [tx0 + Math.round(w * 0.9), ty0 - Math.round(5 * trainScale)],
        [tx0 + w, ty0],
        [tx0, ty0],
      ]);
      rect('#222836', tx0, ty0, w, h);
      strokeRect('#98a6bc', tx0, ty0, w, h);
      // Illuminated '404' headmark box at top center
      rect('#fff2cc', trainCX - Math.round(w * 0.18), ty0 + Math.round(h * 0.06), Math.round(w * 0.36), Math.round(h * 0.1));
      // Dual front windshields with center pillar
      const winY = ty0 + Math.round(h * 0.20);
      const winW = Math.round(w * 0.38);
      const winH = Math.round(h * 0.26);
      rect('#cfe2f6', tx0 + Math.round(w * 0.08), winY, winW, winH);
      rect('#cfe2f6', tx0 + Math.round(w * 0.54), winY, winW, winH);
      // Silver & amber waist stripes
      rect('#dce4f0', tx0, ty0 + Math.round(h * 0.56), w, Math.max(1.5, Math.round(3.5 * trainScale)));
      rect('#d8b05c', tx0, ty0 + Math.round(h * 0.62), w, Math.max(1, Math.round(2 * trainScale)));
      // Lower skirt / cowcatcher
      shape('#151922', [
        [tx0 - 2, ty0 + h],
        [tx0 + w + 2, ty0 + h],
        [tx0 + w - 4, ty0 + h + Math.round(7 * trainScale)],
        [tx0 + 4, ty0 + h + Math.round(7 * trainScale)],
      ]);

      // Twin HDR Headlights & mist glow
      const hlY = ty0 + Math.round(h * 0.74);
      const hlRadius = Math.max(2.2, Math.round(4.5 * trainScale));
      radialGlow(trainCX, hlY, 2, 38 * trainScale, 'rgba(255, 244, 205, 0.65)');
      circle('#ffffff', trainCX - Math.round(w * 0.28), hlY, hlRadius);
      circle('#ffffff', trainCX + Math.round(w * 0.28), hlY, hlRadius);

      const beamFade = Math.max(0, 1 - (now - lanternBeamTime) / 450);
      if (beamFade > 0) {
        linearRay(222, 92, trainCX, trainCY, [[222, 92], [trainCX - 24, trainCY - 30], [trainCX + 24, trainCY + 30]], `rgba(255, 235, 180, ${beamFade * 0.55})`);
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
        rect('#e6dfd3', 112, 58, 66, 62);
        rect('#222226', 117, 63, 56, 46);
        circle('#dcd4c6', 136, 82, 5);
        rect('#dcd4c6', 131, 89, 10, 20);
        circle('#b8b0a2', 154, 85, 4.5);
        rect('#b8b0a2', 149, 91, 9, 18);
        drawFoldedUmbrella(192, 66, 204, 122);
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
    } else if (
      finished === 'cutscene-ending-board' ||
      finished === 'cutscene-ending-send' ||
      finished === 'cutscene-ending-early'
    ) {
      feedback = [
        '——《失落訊號 Lost Signal》 · 劇終 ——',
        '— LOST SIGNAL · FIN —'
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
    const hitBox = ticketBoxes.find((b) => Math.hypot(x - b.x, y - b.y) <= 17);
    if (!hitBox) {
      punchedHoles.push({ x, y, stIdx: -1 });
      if (punchedHoles.length > 8) punchedHoles.shift();
      playSFX('click');
      feedback = [
        '驗票鉗在車票空白處剪下了一個小圓孔。請將驗票鉗移到車票中央的五格印記上方再剪孔。',
        'The punch clipped a hole in the blank margin. Move the punch over one of the five emblem boxes on the ticket and clip.'
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
        playSFX('punchDone');
        feedback = [
          '第三聲清脆的「喀嚓」落定。三枚圓孔連成歸途的軌跡，車票背面浮現出老站長用鉛筆寫的一行小字：「無論走得多遠，這張車票永遠有效。」',
          'With a third crisp snap, the three holes align along your homeward route. Pencil writing appears on the back: “No matter how far you go, this ticket is always valid.”'
        ];
        triggerEffect('unlock', [
          '車票已剪下完整的三枚歸途印記',
          'Return ticket validated with all three route emblems'
        ], 900);
      } else {
        feedback = [
          `清脆的「喀嚓」一聲，第${cnNums[punchStep]}枚驗票孔已剪下。請依〈夜車行〉詩意繼續剪下下一枚印記。`,
          `A crisp snap! Emblem ${punchStep} is clipped. Continue to the next emblem in the poem.`
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
        startCutscene('cutscene-arrival', 11000);
      } else {
        playSFX('lantern');
        feedback = [
          `你高舉提燈，金黃色的光束穿透濃霧！隧道深處傳來第${cnNums[lanternStage]}聲低沉的鳴笛回應，車頭燈越來越近了。`,
          `You raise the lantern and golden light pierces the fog! A deep horn answers from the tunnel as the headlights draw closer.`
        ];
      }
    } else {
      playSFX('error');
      feedback = [
        '光束舉起的時機偏了一點，被濃霧吞沒了。等光環收攏到提燈中央時再舉燈。',
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
                  '鎖芯彈回原位。請對照筆記本裡的古詩〈夜車行〉查出初發、中渡、終歸的三枚印記。',
                  'The pins reset. Cross-reference the platform poem in your notebook.'
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
                  '過載保護跳脫，開關彈回原位。請對照手札上的古詩〈送電吟〉查出先、繼、終三道迴路。',
                  'Overload protection tripped. Check the startup order in the manual poem.'
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
      for (let bIdx = 0; bIdx < pianoBlackNotes.length; bIdx++) {
        const bx = 72 + pianoBlackNotes[bIdx].slot * 31;
        if (x >= bx && x <= bx + 16 && y >= 68 && y <= 115) {
          playPianoBlackKey(bIdx);
          return;
        }
      }
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
            `第${cnNums[i + 1]}轉輪已轉至「${say(...dialOptions[i][dials[i]])}」。`,
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
            `頻率波段已轉至第${cnNums[tunerFreq + 1]}道，目前訊號契合度為 ${getTunerLockPercent()}%。`,
            `Frequency channel set to ${tunerFreq + 1}. Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      } else if (Math.hypot(x - 244, y - 118) <= 26) {
        tunerPhase = (tunerPhase + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `相位微調已轉至第${cnNums[tunerPhase + 1]}相，目前訊號契合度為 ${getTunerLockPercent()}%。`,
            `Phase set to ${tunerPhase + 1}. Signal lock: ${getTunerLockPercent()}%.`
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
    delete document.body.dataset.ending;
    clues.clear();
    randomizePuzzles();
    randomizeExtras();
    updateAmbience();
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
              room = 'carriage';
              puzzle = '';
              inspectedItem = '';
              caption = [
                '終章 · 破曉歸途',
                'FINALE · HOMEWARD AT DAYBREAK'
              ];
              updateAmbience();
              startCutscene('cutscene-ending-board', 15000);
            },
          });
        }
        list.push({
          label: ['站在月台目送列車，轉身走上地面街口', 'Send Off the Train & Walk Up to Street'],
          run() {
            ending = 'send';
            room = 'outside';
            puzzle = '';
            inspectedItem = '';
            caption = [
              '終章 · 目送黎明',
              'FINALE · SENDING OFF THE DAWN'
            ];
            updateAmbience();
            startCutscene('cutscene-ending-send', 13500);
          },
        });
      }
      return list;
    }

    if (key === 'service') {
      const list = [];
      if (!lockerOpen) {
        list.push({
          label: ['走近角落的工具鐵櫃', 'Approach the Corner Tool Cabinet'],
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
            : ['走近角落的立式鋼琴', 'Approach the Upright Piano'],
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
          label: ['查看長椅上的老站長舊皮箱', 'Inspect Father’s Leather Suitcase'],
          run() {
            puzzle = 'suitcase';
            feedback = [];
            playSFX('click');
            render();
          },
        });
      } else {
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
            label: ['拾級走上地面無名街口', 'Walk Up the Stairs to the Street'],
            run() {
              ending = 'early';
              room = 'outside';
              puzzle = '';
              inspectedItem = '';
              caption = [
                '終章 · 未竟之夜',
                'EPILOGUE · THE UNFINISHED NIGHT'
              ];
              updateAmbience();
              startCutscene('cutscene-ending-early', 9500);
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
    const finaleCutsceneName = ending === 'board'
      ? 'cutscene-ending-board'
      : (ending === 'send' ? 'cutscene-ending-send' : 'cutscene-ending-early');
    return [
      {
        label: ['再次回到第四〇四號月台', 'Return to Platform 404'],
        run() {
          resetAllState();
          showActCard(1);
          render();
        },
      },
      {
        label: ['重溫終章畫面', 'Replay Finale'],
        run() {
          startCutscene(finaleCutsceneName, ending === 'board' ? 15000 : 12000);
        },
      },
      {
        label: ['返回 MAKOTO LAB 首頁', 'Return to MAKOTO LAB'],
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

    if (ending) {
      document.body.dataset.ending = ending;
    } else {
      delete document.body.dataset.ending;
    }

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
    get('chapter-hud').textContent = ending
      ? say('FINALE · 終章結局', 'FINALE · EPILOGUE')
      : `${say(...actInfo.eyebrow)} · ${say(...actInfo.title)}`;
    get('status-hud').textContent = ending
      ? say('第四〇四號月台 · 黎明破曉', 'PLATFORM 404 · DAYBREAK')
      : (trainArrived
        ? say('末班車 · 已進站停靠', 'LAST TRAIN · DOCKED')
        : (trainApproaching
          ? say('末班車 · 進站號誌待發', 'LAST TRAIN · APPROACHING')
          : (powered
            ? say('全站電力 · 已恢復', 'POWER · ONLINE')
            : say('全站電力 · 待復電', 'POWER · OFFLINE'))));

    get('room-code').textContent = ending
      ? say('FIN / 終章銘記', 'FIN / EPILOGUE')
      : say(...roomMeta[room].code);
    get('location').textContent = say(...roomName);
    get('progress-text').textContent = `${pct}%`;
    get('progress-fill').style.width = `${pct}%`;

    // Epilogue Banner in Narrative Panel when an Ending is active
    const epilogueBanner = get('epilogue-banner');
    if (epilogueBanner) {
      if (ending && !activeCutscene) {
        epilogueBanner.hidden = false;
        const epilogueMeta = ending === 'board'
          ? {
              eyebrow: ['TRUE ENDING · 終章結局', 'TRUE ENDING · EPILOGUE'],
              title: ['破曉歸途', 'Homeward at Daybreak'],
            }
          : (ending === 'send'
            ? {
                eyebrow: ['ENDING · 終章結局', 'ENDING · EPILOGUE'],
                title: ['目送黎明', 'Sending Off the Dawn'],
              }
            : {
                eyebrow: ['ENDING · 結局', 'ENDING · EPILOGUE'],
                title: ['未竟之夜', 'The Unfinished Night'],
              });
        get('epilogue-eyebrow').textContent = say(...epilogueMeta.eyebrow);
        get('epilogue-title').textContent = say(...epilogueMeta.title);
      } else {
        epilogueBanner.hidden = true;
      }
    }

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
      if (ending && !feedback.length) {
        get('feedback').textContent = say(
          '——《失落訊號 Lost Signal》 · 劇終 ——',
          '— LOST SIGNAL · FIN —'
        );
      } else {
        get('feedback').textContent = feedback.length ? say(...feedback) : '';
      }
    }

    // Sequence Display (for locker, circuits, piano, punch)
    const seqEl = get('sequence');
    if (puzzle === 'locker') {
      seqEl.textContent = input.length
        ? say(
          `已按下印記：${input.map((i) => symbolDefs[i][0]).join(' → ')}`,
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
          `目前彈奏音階：${pianoInput.map((n) => cnNums[n + 1]).join(' · ')}`,
          `Played notes: ${pianoInput.map((n) => n + 1).join(' - ')}`
        )
        : '';
    } else if (puzzle === 'punchGame') {
      seqEl.textContent = say(
        `已剪下驗票孔：第${cnNums[punchStep]}枚`,
        `Emblems clipped: ${punchStep} of 3`
      );
    } else {
      seqEl.textContent = '';
    }

    // Scene Caption Overlay
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
    get('inventory').textContent = ending
      ? say('旅途信物', 'KEEPSAKES')
      : say('隨身行囊', 'BELONGINGS');
    const invContainer = get('inventory-items');
    invContainer.replaceChildren();
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item-chip';
      btn.dataset.active = String(inspectedItem === item.id);
      btn.textContent = say(...item.name);
      btn.addEventListener('click', () => {
        initAudio();
        playSFX('click');
        if (item.id === 'ticket' && hasPunch && !ticketPunched && !ending) {
          puzzle = 'punchGame';
          inspectedItem = '';
          punchStep = 0;
          punchedHoles = [];
          feedback = [
            '你把回程車票平鋪在桌面上，右手拿起父親留下的黃銅驗票鉗。將驗票鉗移至車票上的印記方格上方，即可剪下驗票孔。',
            'You lay the return ticket flat and hold your father’s brass punch. Position the punch over an emblem box to clip a hole.'
          ];
          render();
          return;
        }
        if (item.id === 'photo' && suitcaseOpen && !ending) {
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
    if (!noteKeys.length || ending) {
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
          ? `${say(...sym)} · 第${cnNums[pos + 1]}印`
          : say(...sym);
        button.disabled = pos !== -1;
        button.addEventListener('click', () => {
          initAudio();
          if (input.includes(index)) return;
          input = [...input, index];
          if (input.length < 3) {
            playSFX('click');
            feedback = [
              `已按下第${cnNums[input.length]}枚印記：${say(...sym)}。`,
              `Pressed emblem ${input.length}: ${say(...sym)}.`
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
          ? `${say(...cDef)} · 第${cnNums[pos + 1]}道`
          : say(...cDef);
        button.disabled = pos !== -1;
        button.addEventListener('click', () => {
          initAudio();
          if (input.includes(index)) return;
          input = [...input, index];
          if (input.length < 3) {
            playSFX('click');
            feedback = [
              `已推上第${cnNums[input.length]}道閘刀：${say(...cDef)}。`,
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
        ['左輪 · 季節', 'Left Wheel · Season'],
        ['中輪 · 刻痕', 'Middle Wheel · Mark'],
        ['右輪 · 番號', 'Right Wheel · Track'],
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
          `Clip “${symbolDefs[idx][1]}” Emblem`
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
        `轉動頻率波段旋鈕 · 第${cnNums[tunerFreq + 1]}道`,
        `Turn Frequency Knob · Channel ${tunerFreq + 1}`
      );
      freqBtn.addEventListener('click', () => {
        initAudio();
        tunerFreq = (tunerFreq + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `頻率波段已切換至第${cnNums[tunerFreq + 1]}道，目前訊號契合度為 ${getTunerLockPercent()}%。`,
            `Frequency channel set to ${tunerFreq + 1}. Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      });
      choicesEl.append(freqBtn);

      const phaseBtn = document.createElement('button');
      phaseBtn.type = 'button';
      phaseBtn.textContent = say(
        `轉動相位微調旋鈕 · 第${cnNums[tunerPhase + 1]}相`,
        `Turn Phase Knob · Phase ${tunerPhase + 1}`
      );
      phaseBtn.addEventListener('click', () => {
        initAudio();
        tunerPhase = (tunerPhase + 1) % 5;
        playSFX('click');
        if (!checkTunerSuccess()) {
          feedback = [
            `相位微調已切換至第${cnNums[tunerPhase + 1]}相，目前訊號契合度為 ${getTunerLockPercent()}%。`,
            `Phase set to ${tunerPhase + 1}. Signal lock: ${getTunerLockPercent()}%.`
          ];
          render();
        }
      });
      choicesEl.append(phaseBtn);
    } else if (puzzle === 'lanternGame') {
      const flashBtn = document.createElement('button');
      flashBtn.type = 'button';
      flashBtn.textContent = say(
        '高舉號誌提燈揮動光束',
        'Raise Signal Lantern'
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
