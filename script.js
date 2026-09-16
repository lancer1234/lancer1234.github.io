document.getElementById('year').textContent = new Date().getFullYear();

const root = document.documentElement;
const languageButton = document.querySelector('.lang-toggle');
const savedLanguage = localStorage.getItem('portfolio-language');
const browserLanguage = navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';

// Correct Carrefour project scope: marketing activity/task planning, management and publishing.
const carrefourDescription = document.querySelector('#work .project .project-main > p:nth-of-type(2)');
if (carrefourDescription) {
  const en = carrefourDescription.querySelector('.lang-en');
  const zh = carrefourDescription.querySelector('.lang-zh');
  if (en) en.textContent = 'Owned the marketing campaign and task mechanics behind the event website, including campaign flow, mission design, project management, content publishing, and launch execution.';
  if (zh) zh.textContent = '負責活動網站背後的行銷活動與任務機制規劃，包含活動流程、任務設計、專案管理與內容上架，並統籌整體上線執行。';
}

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

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.topbar nav a')];

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${entry.target.id}`;
      link.style.opacity = active ? '1' : '.62';
    });
  });
}, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });

sections.forEach((section) => observer.observe(section));
