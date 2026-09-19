(() => {
  const root = document.documentElement;
  const button = document.querySelector('.lang-toggle');
  const saved = localStorage.getItem('portfolio-language');
  const browser = navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const setLanguage = (language) => {
    const lang = language === 'en' ? 'en' : 'zh';
    root.dataset.lang = lang;
    root.lang = lang === 'en' ? 'en' : 'zh-Hant';
    localStorage.setItem('portfolio-language', lang);
    if (button) {
      button.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換至中文');
      button.setAttribute('title', lang === 'zh' ? 'English' : '中文');
    }
  };
  setLanguage(saved || browser);
  button?.addEventListener('click', () => setLanguage(root.dataset.lang === 'zh' ? 'en' : 'zh'));
})();
