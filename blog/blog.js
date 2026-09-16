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

function insertMakotoGlassScreens() {
  if (!location.pathname.startsWith('/blog/google-glass-too-early')) return;

  const configs = [
    {
      selector: '.article-body > .lang-zh',
      marker: '後來我才開始做 companion app',
      caption: 'Makoto Glass 實際運行畫面：Home、AMS Now Playing、ANCS 通知紀錄、Makoto Link 連線狀態、About 與 System Status。截圖來自我目前在 Google Glass Enterprise Edition 2 上測試的版本。© MAKOTO LAB。',
      licensingHeading: '圖片授權',
      licensingNote: '本文中的 Makoto Glass 介面截圖則為我實際開發版本的畫面，© MAKOTO LAB。'
    },
    {
      selector: '.article-body > .lang-en',
      marker: 'I later began building',
      caption: 'Actual Makoto Glass interface captures: Home, AMS Now Playing, ANCS notification history, Makoto Link connection status, About, and System Status. Captured from the build I currently test on Google Glass Enterprise Edition 2. © MAKOTO LAB.',
      licensingHeading: 'Image licensing',
      licensingNote: 'The Makoto Glass interface captures are screenshots of my own current build and are © MAKOTO LAB.'
    }
  ];

  configs.forEach(({ selector, marker, caption, licensingHeading, licensingNote }) => {
    const block = document.querySelector(selector);
    if (!block || block.querySelector('.app-ui-figure')) return;

    const markerParagraph = [...block.querySelectorAll('p')].find((p) => p.textContent.includes(marker));
    if (markerParagraph) {
      const figure = document.createElement('figure');
      figure.className = 'article-figure article-figure-wide app-ui-figure';
      figure.innerHTML = `<img src="/assets/blog/makoto-glass-ui.svg" alt="Makoto Glass interface screenshots on Google Glass Enterprise Edition 2" loading="lazy"><figcaption>${caption}</figcaption>`;
      markerParagraph.before(figure);
    }

    const heading = [...block.querySelectorAll('h3')].find((h) => h.textContent.trim() === licensingHeading);
    const licensingParagraph = heading && heading.nextElementSibling;
    if (licensingParagraph && !licensingParagraph.textContent.includes('© MAKOTO LAB')) {
      licensingParagraph.append(` ${licensingNote}`);
    }
  });
}

setLanguage(savedLanguage || browserLanguage);
insertMakotoGlassScreens();

if (languageButton) {
  languageButton.addEventListener('click', () => {
    setLanguage(root.dataset.lang === 'zh' ? 'en' : 'zh');
  });
}
