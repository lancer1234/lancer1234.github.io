(() => {
  const get = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let language = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  try { language = localStorage.getItem('portfolio-language') || language; } catch {}
  language = language === 'en' ? 'en' : 'zh';
  const say = (zh, en) => language === 'zh' ? zh : en;
  const canvas = get('view');
  const ctx = canvas.getContext('2d');
  const noise = get('noise').getContext('2d');
  let room = 'station';
  let hasFuse = false;
  let powered = false;
  let lockerOpen = false;
  let ending = '';
  let puzzle = '';
  let input = [];
  let feedback = [];
  let effect = '';
  const clues = new Set();
  const rooms = {
    station: [['無名月台', 'Nameless Platform'], ['你在空月台醒來。廣播說到「末班車即將……」就斷了。站務員把手寫字條貼在維修室門上：如果有人醒來，請幫我送完這一班。', 'You wake on an empty platform. The PA cuts out at “The last train will…” A handwritten note on the service door reads: If anyone wakes up, please send off this last train for me.']],
    service: [['維修室', 'Service Room'], ['備用保險絲鎖在櫃裡。鎖面刻著月亮、水波和圓圈。櫃門上的標籤寫著：按列車的停靠順序。', 'A spare fuse is locked in a cabinet. The lock shows a moon, a wave and a circle. Its label reads: Enter the stops in travel order.']],
    archive: [['站務檔案室', 'Station Archive'], ['一排值班紀錄停在同一晚。窗邊留著一杯沒喝完的茶。', 'The shift logs all end on the same night. A half-finished cup of tea sits by the window.']],
    booth: [['控制室', 'Control Room'], ['三個迴路開關排在斷電的控制台前。出口和廣播共用備援電源。', 'Three circuit switches sit in front of a dead console. The exit and the PA share backup power.']],
    gate: [['出口閘門', 'Exit Gate'], ['鐵欄後面有通往地面的樓梯，也有一扇通往廣播室的門。', 'Beyond the gate are the stairs to the street and a door to the broadcast room.']],
    radio: [['廣播室', 'Broadcast Room'], ['錄音機還在走。耳機裡，值班員輕聲說：「我答應過，有人回來找這個地方，就給他留一盞燈。」', 'The tape is still running. In the headphones, the attendant whispers: “I promised to leave a light on if anyone came back looking for this place.”']],
    outside: [['地面', 'Street Level'], ['你走上最後一階。天快亮了，這條街仍然沒有名字。', 'You climb the final step. Dawn is breaking, and the street still has no name.']],
  };
  const notes = {
    map: ['路線圖：月台是圓圈，河岸是水波，山口是月亮。', 'Route map: Platform = circle, Riverside = wave, Pass = moon.'],
    log: ['值班簿：末班車從月台出發，先到河岸，最後才穿過山口。', 'Shift log: The last train leaves the Platform, stops at Riverside, then crosses the Pass.'],
    manual: ['維修手冊：照明要等號誌就緒才能接通。廣播接通時，照明必須已經亮起。', 'Service manual: Lighting must wait until the signal is ready. The lights must already be on when the PA is connected.'],
    tape: ['錄音盒：「重播」會把這裡留在末班車抵達前的一刻。「送行」會播完廣播，讓列車離站。', 'Tape case: Replay holds the station in the moment before the last train arrives. Send Off finishes the announcement and lets the train leave.'],
  };
  const puzzles = {
    locker: {
      labels: [['月亮', 'Moon'], ['圓圈', 'Circle'], ['水波', 'Wave']],
      order: [1, 2, 0],
      prompt: ['把三個站的符號照停靠順序輸入。', 'Enter the symbols for all three stops in travel order.'],
      hint: ['用值班簿排順序，再用月台路線圖把站名換成符號。', 'Use the shift log for the order, then the platform map to turn stop names into symbols.'],
      solve() { lockerOpen = true; effect = 'unlock'; return ['櫃門喀一聲彈開，裡面躺著一枚保險絲。', 'The cabinet clicks open. A fuse lies inside.']; },
    },
    circuits: {
      labels: [['照明', 'Lights'], ['廣播', 'PA'], ['號誌', 'Signal']],
      order: [2, 0, 1],
      prompt: ['按啟動順序接通三個迴路。', 'Connect all three circuits in startup order.'],
      hint: ['先找出手冊裡唯一不必等其他迴路的開關。', 'Start with the only circuit that does not depend on another.'],
      solve() { powered = true; hasFuse = false; effect = 'power'; return ['遠處的燈一盞一盞亮起，出口傳來鐵鍊滑動的聲音。', 'Lights come on one by one. A chain rattles at the exit.']; },
    },
  };

  function paint(sceneEffect = '', progress = 1) {
    if (!ctx) return;
    function rect(color, x, y, width, height) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
    }
    function shape(color, points) {
      ctx.fillStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.fill();
    }
    function grain(seed, count) {
      for (let i = 0; i < count; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const x = seed % 320;
        const y = (seed >>> 10) % 180;
        rect(i % 5 ? '#ffffff12' : '#00000040', x, y, i % 3 + 1, 1);
      }
    }

    rect('#101010', 0, 0, 320, 180);
    if (room === 'outside') {
      rect('#aaa', 0, 0, 320, 112);
      rect('#e3e3e3', 214, 21, 23, 23);
      for (let i = 0; i < 12; i++) {
        const height = 16 + (i * 31) % 49;
        rect(i % 2 ? '#575757' : '#414141', i * 28, 114 - height, 24, height);
      }
      shape('#393939', [[145, 112], [181, 112], [278, 180], [42, 180]]);
      shape('#8e8e8e', [[161, 119], [164, 119], [169, 180], [154, 180]]);
      if (sceneEffect === 'train' && progress < 1) {
        const trainX = Math.round(104 + 218 * progress);
        rect('#282828', trainX, 106, 80, 18);
        rect('#171717', trainX + 4, 124, 72, 4);
        for (let i = 0; i < 5; i++) rect('#ccc', trainX + 8 + i * 14, 110, 9, 5);
      }
      grain(41, 1800);
      return;
    }

    rect('#292929', 0, 96, 320, 84);
    shape('#333', [[0, 0], [114, 49], [114, 118], [0, 180]]);
    shape('#252525', [[320, 0], [206, 49], [206, 118], [320, 180]]);
    rect('#1d1d1d', 114, 49, 92, 70);
    shape('#4a4a4a', [[0, 154], [114, 111], [114, 118], [0, 171]]);
    shape('#353535', [[320, 154], [206, 111], [206, 118], [320, 171]]);
    for (const [i, [x, y, w]] of [[131, 5, 58], [140, 25, 40], [147, 41, 26]].entries()) {
      const lit = powered && (sceneEffect !== 'power' || progress > (i + 1) * .22);
      rect('#323232', x - 3, y - 2, w + 6, 8);
      rect(lit ? '#eee' : '#636363', x, y, w, 2);
    }
    grain(23, 2400);

    if (room === 'station') {
      shape('#101010', [[19, 44], [72, 64], [72, 129], [19, 155]]);
      shape('#7b7b7b', [[16, 42], [19, 44], [19, 155], [16, 158]]);
      rect('#686868', 143, 61, 34, 56);
      rect('#161616', 146, 64, 28, 53);
      for (let x = 149; x < 174; x += 6) rect('#585858', x, 65, 2, 51);
      shape('#878787', [[126, 121], [130, 121], [67, 180], [54, 180]]);
      shape('#878787', [[191, 121], [195, 121], [266, 180], [253, 180]]);
    } else if (room === 'service') {
      rect('#545454', 81, 56, 158, 55);
      rect('#797979', 65, 111, 190, 10);
      rect('#373737', 73, 121, 174, 9);
      rect('#606060', 76, 130, 9, 37);
      rect('#606060', 234, 130, 9, 37);
      rect('#a2a2a2', 97, 104, 25, 3);
      rect('#6b6b6b', 119, 101, 4, 9);
      rect('#383838', 188, 61, 47, 44);
      rect(lockerOpen ? '#171717' : '#626262', 191, 64, 41, 38);
      if (!lockerOpen) rect('#bbb', 219, 82, 5, 4);
      if (lockerOpen && !hasFuse && !powered) {
        rect('#ddd', 151, 102, 18, 6);
        rect('#737373', 154, 102, 12, 6);
      }
    } else if (room === 'archive') {
      for (let i = 0; i < 3; i++) {
        const y = 53 + i * 28;
        rect('#474747', 51, y + 20, 216, 4);
        for (let j = 0; j < 19; j++) {
          const height = 9 + (i * 13 + j * 7) % 11;
          rect(j % 3 ? '#727272' : '#4c4c4c', 59 + j * 10, y + 20 - height, 7, height);
        }
      }
    } else if (room === 'booth' || room === 'radio') {
      rect('#414141', 69, 56, 182, 78);
      rect('#181818', 80, 64, 160, 46);
      if (room === 'booth') {
        for (let i = 0; i < 3; i++) {
          const x = 98 + i * 55;
          rect(powered && (sceneEffect !== 'power' || progress > (i + 1) * .22) ? '#eee' : '#686868', x, 74, 11, 5);
          rect('#888', x + 3, 87, 5, 16);
        }
      } else {
        for (const x of [110, 183]) {
          rect('#555', x, 71, 27, 27);
          rect('#999', x + 3, 74, 21, 21);
          rect('#252525', x + 10, 81, 7, 7);
        }
        rect('#aaa', 137, 93, 46, 2);
      }
    } else {
      rect('#595959', 94, 37, 130, 111);
      rect('#202020', 99, 42, 120, 106);
      for (let y = 74; y < 143; y += 9) rect('#454545', 109, y, 100, 3);
      const gateHeight = powered ? Math.round(106 * (1 - progress)) : 106;
      if (gateHeight > 0) {
        for (let x = 106; x < 220; x += 13) rect('#888', x, 42, 4, gateHeight);
        rect('#888', 99, 42 + gateHeight - 4, 120, 4);
      }
      rect('#5e5e5e', 240, 76, 23, 31);
      rect('#1b1b1b', 243, 79, 17, 25);
      rect(powered ? '#eee' : '#686868', 248, 85, 7, 4);
    }
  }

  let animationFrame = 0;
  let entrance;
  function animateScene(name) {
    cancelAnimationFrame(animationFrame);
    if (reduced.matches || !name) {
      paint();
      return;
    }

    if (name === 'arrive' || name === 'unlock') {
      paint();
      entrance?.cancel();
      entrance = canvas.animate([{ opacity: name === 'arrive' ? .35 : .78 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
      return;
    }

    const started = performance.now();
    const duration = name === 'train' ? 2400 : 1150;
    function tick(now) {
      const progress = Math.min(1, (now - started) / duration);
      paint(name, progress);
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    }
    paint(name, 0);
    animationFrame = requestAnimationFrame(tick);
  }

  function action(text, run) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = say(...text);
    button.addEventListener('click', () => {
      const previousRoom = room;
      const previousPuzzle = puzzle;
      run();
      render();
      if (room !== previousRoom) get('location').focus({ preventScroll: true });
      else if (puzzle !== previousPuzzle) get('feedback').focus({ preventScroll: true });
      else {
        const replacement = Array.from(get('choices').children).find((item) => item.textContent === button.textContent);
        (replacement || (get('feedback').textContent ? get('feedback') : get('choices').firstElementChild)).focus({ preventScroll: true });
      }
    });
    get('choices').append(button);
  }

  function travel(next) {
    room = next;
    feedback = [];
    effect = 'arrive';
    if (next === 'gate' && powered) effect = 'gate';
    if (next === 'outside' && ending === 'send') effect = 'train';
  }

  function read(key) {
    clues.add(key);
    feedback = notes[key];
  }

  function startPuzzle(key) {
    puzzle = key;
    input = [];
    feedback = puzzles[key].prompt;
  }

  function renderPuzzle() {
    const { labels, order, prompt, hint, solve } = puzzles[puzzle];
    get('sequence').textContent = order.map((_, i) => input[i] === undefined ? '＿' : say(...labels[input[i]])).join(' · ');
    labels.forEach((label, i) => {
      if (!input.includes(i)) action(label, () => { input.push(i); feedback = prompt; });
    });
    if (input.length === order.length) action(['確認順序', 'Confirm order'], () => {
      if (input.every((value, i) => value === order[i])) {
        feedback = solve();
        puzzle = '';
      } else {
        input = [];
        feedback = ['順序不對。面板跳回第一格。', 'Wrong order. The panel resets to the first slot.'];
      }
    });
    if (input.length) action(['清除輸入', 'Clear input'], () => { input = []; feedback = prompt; });
    action(['提示', 'Hint'], () => { feedback = hint; });
    action(['離開面板', 'Leave panel'], () => { puzzle = ''; feedback = []; });
  }

  function render() {
    const [title, description] = rooms[room];
    get('location').textContent = say(...title);
    get('description').textContent = say(...description);
    get('feedback').textContent = say(...feedback) || '';
    get('inventory').textContent = hasFuse ? say('背包 · 保險絲 × 1', 'INVENTORY · FUSE × 1') : say('背包 · 空', 'INVENTORY · EMPTY');
    canvas.setAttribute('aria-label', say(...description));
    get('choices').replaceChildren();
    get('sequence').textContent = '';
    get('notebook').hidden = clues.size === 0;
    get('notes').replaceChildren(...Array.from(clues, (key) => {
      const entry = document.createElement('li');
      entry.textContent = say(...notes[key]);
      return entry;
    }));
    if (puzzle) {
      renderPuzzle();
    } else if (room === 'station') {
      action(['查看路線圖', 'Read route map'], () => read('map'));
      action(['進入維修室', 'Enter service room'], () => travel('service'));
      action(['進入檔案室', 'Enter archive'], () => travel('archive'));
      action(['進入控制室', 'Enter control room'], () => travel('booth'));
      action(['走向閘門', 'Approach the gate'], () => travel('gate'));
    } else if (room === 'service') {
      if (!lockerOpen) action(['查看符號鎖', 'Inspect symbol lock'], () => startPuzzle('locker'));
      if (lockerOpen && !hasFuse && !powered) action(['拿起保險絲', 'Pick up the fuse'], () => {
        hasFuse = true;
        feedback = ['你把保險絲收進背包。', 'You put the fuse in your inventory.'];
      });
    } else if (room === 'archive') {
      action(['翻開值班簿', 'Open shift log'], () => read('log'));
      action(['閱讀維修手冊', 'Read service manual'], () => read('manual'));
      action(['查看最後一頁', 'Read the final page'], () => {
        feedback = ['最後一頁寫著：「明天起，地圖上就沒有這一站了。末班車還是照表開。我等到最後一位乘客上車。」', 'The final page reads: “Tomorrow this stop comes off the map. The last train still runs on time. I’ll stay until the last passenger gets on.”'];
      });
    } else if (room === 'booth') {
      if (!powered) action(['檢查控制台', 'Inspect control panel'], () => {
        if (hasFuse) startPuzzle('circuits');
        else feedback = ['保險絲槽是空的。', 'The fuse socket is empty.'];
      });
    } else if (room === 'gate') {
      if (powered) action(['進入廣播室', 'Enter broadcast room'], () => travel('radio'));
      else action(['檢查閘門', 'Inspect gate'], () => {
        feedback = ['閘門沒有電，控制線沿著牆通往控制室。', 'The gate has no power. A cable runs along the wall to the control room.'];
      });
    } else if (room === 'radio') {
      action(['查看錄音盒', 'Read tape case'], () => read('tape'));
      action(['重播廣播', 'Replay the announcement'], () => {
        ending = 'keep';
        travel('outside');
      });
      action(['播完廣播，送末班車離站', 'Finish the announcement and send off the train'], () => {
        ending = 'send';
        travel('outside');
      });
    } else {
      get('feedback').textContent = ending === 'send'
        ? say('你聽見車輪滑遠。這一次，廣播播到了最後一個字。', 'The wheels fade into the distance. This time the announcement reaches its last word.')
        : say('你回頭，階梯底下的燈還亮著。下次有人迷路，那段廣播會從頭開始。', 'You look back. The light at the bottom of the stairs is still on. The next time someone gets lost, the announcement will start again.');
      const home = document.createElement('a');
      home.href = '/';
      home.textContent = say('返回 MAKOTO LAB', 'Return to MAKOTO LAB');
      get('choices').append(home);
      action(['重新探索', 'Explore again'], () => {
        hasFuse = powered = lockerOpen = false;
        ending = '';
        clues.clear();
        get('notebook').open = false;
        travel('station');
      });
    }
    if (!puzzle && room !== 'station' && room !== 'outside') {
      action(['回月台', 'Back to platform'], () => travel('station'));
    }
    animateScene(effect);
    effect = '';
  }

  function setLanguage() {
    document.documentElement.lang = say('zh-Hant', 'en');
    document.querySelectorAll('[data-zh]').forEach((element) => {
      element.textContent = say(element.dataset.zh, element.dataset.en);
    });
    get('destinations').setAttribute('aria-label', say('網站頁面', 'Site pages'));
    get('language').textContent = say('EN', '中文');
    get('language').setAttribute('aria-label', say('Switch to English', '切換至中文'));
  }

  function showQuestion() {
    get('static').hidden = true;
    get('question').hidden = false;
    document.body.dataset.phase = 'question';
    const title = get('prompt-title');
    const fullText = title.textContent;
    title.setAttribute('aria-label', fullText);
    if (reduced.matches) {
      title.focus({ preventScroll: true });
      get('answers').hidden = false;
      return;
    }

    const letters = Array.from(fullText, (character) => {
      const letter = document.createElement('span');
      letter.textContent = character;
      letter.setAttribute('aria-hidden', 'true');
      return letter;
    });
    title.replaceChildren(...letters);
    title.focus({ preventScroll: true });
    let index = 0;
    function typeNext() {
      letters[index].dataset.typed = '';
      index += 1;
      if (index < letters.length) {
        setTimeout(typeNext, language === 'zh' ? 155 : 58);
      } else {
        setTimeout(() => { get('answers').hidden = false; }, 300);
      }
    }
    typeNext();
  }

  function transition() {
    get('error').hidden = true;
    if (reduced.matches || !noise) {
      showQuestion();
      return;
    }
    get('static').hidden = false;
    const { canvas: grain } = noise;
    const scale = Math.min(1 / 1.5, 1280 / innerWidth, 900 / innerHeight);
    grain.width = Math.max(1, Math.round(innerWidth * scale));
    grain.height = Math.max(1, Math.round(innerHeight * scale));
    const image = noise.createImageData(grain.width, grain.height);
    function frame() {
      for (let i = 0; i < image.data.length; i += 4) {
        const shade = 45 + Math.floor(Math.random() * 110);
        image.data[i] = image.data[i + 1] = image.data[i + 2] = shade;
        image.data[i + 3] = 255;
      }
      noise.putImageData(image, 0, 0);
    }
    frame();
    const timer = setInterval(frame, 75);
    setTimeout(() => {
      clearInterval(timer);
      get('static').hidden = true;
      setTimeout(showQuestion, 420);
    }, 480);
  }

  get('yes').addEventListener('click', () => {
    get('answers').hidden = true;
    get('destinations').hidden = false;
    get('destinations').querySelector('a').focus();
  });
  get('back').addEventListener('click', () => {
    get('destinations').hidden = true;
    get('answers').hidden = false;
    get('yes').focus();
  });
  get('unsure').addEventListener('click', () => {
    get('question').hidden = true;
    get('adventure').hidden = false;
    document.body.dataset.phase = reduced.matches ? 'playing' : 'opening';
    render();
    setTimeout(() => {
      document.body.dataset.phase = 'playing';
      get('location').focus({ preventScroll: true });
    }, reduced.matches ? 0 : 1800);
  });
  get('language').addEventListener('click', () => {
    language = say('en', 'zh');
    try { localStorage.setItem('portfolio-language', language); } catch {}
    setLanguage();
    render();
  });

  setLanguage();
  setTimeout(transition, 5000);
})();
