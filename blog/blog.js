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

async function useEmbeddedScreenshotRaster(img) {
  try {
    const response = await fetch('/assets/blog/makoto-glass-ui.svg?v=20260917-3', { cache: 'no-store' });
    if (!response.ok) return;
    const svg = await response.text();
    const match = svg.match(/href=["'](data:image\/(?:webp|png|jpeg);base64,[^"']+)["']/i);
    if (match && match[1]) img.src = match[1];
  } catch (_) {
    // Keep the SVG fallback if the embedded raster cannot be extracted.
  }
}

function insertMakotoGlassScreens() {
  if (!location.pathname.startsWith('/blog/google-glass-too-early')) return;

  const configs = [
    {
      selector: '.article-body > .lang-zh',
      marker: '後來我才開始做 companion app',
      caption: 'Makoto Glass 實際運行畫面：Home、Now Playing、通知紀錄、Makoto Link、About 與 System Status。Google Glass Enterprise Edition 2 實機截圖。© MAKOTO LAB。'
    },
    {
      selector: '.article-body > .lang-en',
      marker: 'I later began building',
      caption: 'Makoto Glass running on Google Glass Enterprise Edition 2: Home, Now Playing, notification history, Makoto Link, About and System Status. © MAKOTO LAB.'
    }
  ];

  configs.forEach(({ selector, marker, caption }) => {
    const block = document.querySelector(selector);
    if (!block || block.querySelector('.app-ui-figure')) return;

    const markerParagraph = [...block.querySelectorAll('p')].find((p) => p.textContent.includes(marker));
    if (!markerParagraph) return;

    const figure = document.createElement('figure');
    figure.className = 'article-figure article-figure-wide app-ui-figure';
    figure.innerHTML = `<img src="/assets/blog/makoto-glass-ui.svg?v=20260917-3" alt="Makoto Glass interface screenshots on Google Glass Enterprise Edition 2" loading="eager"><figcaption>${caption}</figcaption>`;
    markerParagraph.before(figure);

    const img = figure.querySelector('img');
    if (img) useEmbeddedScreenshotRaster(img);
  });
}

setLanguage(savedLanguage || browserLanguage);
insertMakotoGlassScreens();

if (languageButton) {
  languageButton.addEventListener('click', () => {
    setLanguage(root.dataset.lang === 'zh' ? 'en' : 'zh');
  });
}
