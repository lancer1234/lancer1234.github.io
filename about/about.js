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

setLanguage(savedLanguage || browserLanguage);

if (languageButton) {
  languageButton.addEventListener('click', () => {
    setLanguage(root.dataset.lang === 'zh' ? 'en' : 'zh');
  });
}
