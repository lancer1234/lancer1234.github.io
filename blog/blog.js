document.getElementById('year').textContent = new Date().getFullYear();

const root = document.documentElement;
const languageButton = document.querySelector('.lang-toggle');
const savedLanguage = localStorage.getItem('portfolio-language');
const browserLanguage = navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';

function setLanguage(language) {
  const lang = language === 'en' ? 'en' : 'zh';
  root.dataset.lang = lang;
  root.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  localStorage.setItem('portfolio-language', lang);
  if (languageButton) {
    languageButton.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換至中文');
    languageButton.setAttribute('title', lang === 'zh' ? 'English' : '中文');
  }
}

async function loadGlassScreens() {
  const urls = Array.from({ length: 6 }, (_, index) => `/assets/blog/glass-ui-${index + 1}.txt?v=20260917-6`);
  return Promise.all(urls.map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    return `data:image/jpeg;base64,${(await response.text()).trim()}`;
  }));
}

async function replaceMakotoGlassScreens() {
  if (!location.pathname.startsWith('/blog/google-glass-too-early')) return;

  let screens;
  try {
    screens = await loadGlassScreens();
  } catch (error) {
    console.error(error);
    return;
  }

  const configs = [
    {
      selector: '.article-body > .lang-zh',
      heading: 'Makoto Glass 現在真的長什麼樣子',
      caption: 'Makoto Glass 實際運行畫面：Home、Now Playing、通知紀錄、Makoto Link、About 與 System Status。Google Glass Enterprise Edition 2 實機截圖。© MAKOTO LAB。'
    },
    {
      selector: '.article-body > .lang-en',
      heading: 'What Makoto Glass actually looks like',
      caption: 'Makoto Glass running on Google Glass Enterprise Edition 2: Home, Now Playing, notification history, Makoto Link, About and System Status. © MAKOTO LAB.'
    }
  ];

  configs.forEach(({ selector, heading, caption }) => {
    const block = document.querySelector(selector);
    if (!block) return;

    const targetHeading = [...block.querySelectorAll('h2')].find((h) => h.textContent.trim() === heading);
    if (!targetHeading) return;

    let existingFigure = targetHeading.nextElementSibling;
    while (existingFigure && existingFigure.tagName !== 'FIGURE') {
      existingFigure = existingFigure.nextElementSibling;
    }

    const figure = document.createElement('figure');
    figure.className = 'article-figure app-ui-figure';

    const grid = document.createElement('div');
    grid.className = 'app-ui-grid';

    screens.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `Makoto Glass interface screenshot ${index + 1}`;
      img.loading = 'eager';
      img.decoding = 'async';
      grid.appendChild(img);
    });

    const figcaption = document.createElement('figcaption');
    figcaption.textContent = caption;
    figure.append(grid, figcaption);

    if (existingFigure) {
      existingFigure.replaceWith(figure);
    } else {
      targetHeading.insertAdjacentElement('afterend', figure);
    }
  });
}

setLanguage(savedLanguage || browserLanguage);
replaceMakotoGlassScreens();

if (languageButton) {
  languageButton.addEventListener('click', () => {
    setLanguage(root.dataset.lang === 'zh' ? 'en' : 'zh');
  });
}
