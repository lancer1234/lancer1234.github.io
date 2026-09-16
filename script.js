document.getElementById('year').textContent = new Date().getFullYear();

const root = document.documentElement;
const languageButton = document.querySelector('.lang-toggle');
const savedLanguage = localStorage.getItem('portfolio-language');
const browserLanguage = navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';

// Add the blog as a first-class item in the main navigation.
const mainNav = document.querySelector('.topbar nav');
if (mainNav && !mainNav.querySelector('a[href="/blog/"]')) {
  const blogLink = document.createElement('a');
  blogLink.href = '/blog/';
  blogLink.innerHTML = '<span class="lang-en">BLOG</span><span class="lang-zh">文章</span>';
  const contactLink = mainNav.querySelector('a[href="#contact"]');
  mainNav.insertBefore(blogLink, contactLink || null);
}

// Correct Carrefour project scope: marketing activity/task planning, management and publishing.
const carrefourDescription = document.querySelector('#work .project .project-main > p:nth-of-type(2)');
if (carrefourDescription) {
  const en = carrefourDescription.querySelector('.lang-en');
  const zh = carrefourDescription.querySelector('.lang-zh');
  if (en) en.textContent = 'Owned the marketing campaign and task mechanics behind the event website, including campaign flow, mission design, project management, content publishing, and launch execution.';
  if (zh) zh.textContent = '負責活動網站背後的行銷活動與任務機制規劃，包含活動流程、任務設計、專案管理與內容上架，並統籌整體上線執行。';
}

// Privacy protection: do not expose source documents or folders for the Taiwan × Korea project.
// Some internal materials contain personal identification information, so all public links are removed.
const sensitiveKoreaTargets = [
  '1V8UKw-vjqHNS0yeq7G7Yl6dkprieC02l',
  '1cU_-ZEIBvKh9z_3mRYm-k2z0drFWeBAx',
  '1gCuCDqdClG4xFRYhRos6FYoN2CRYNjMZ',
  '1kSMHrxPC-flfDBlpjtT3tWWM8Z9P0XCq'
];

document.querySelectorAll('a[href]').forEach((link) => {
  if (sensitiveKoreaTargets.some((id) => link.href.includes(id))) {
    link.remove();
  }
});

// Remove the now-empty link container from the Korea case study so no placeholder remains.
const koreaProject = [...document.querySelectorAll('#work .project')].find((project) =>
  project.textContent.includes('Taiwan × Korea') || project.textContent.includes('台灣 × 韓國')
);
if (koreaProject) {
  koreaProject.querySelectorAll('.inline-links').forEach((container) => {
    if (!container.querySelector('a')) container.remove();
  });
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
const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];

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
