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

const koreaProject = [...document.querySelectorAll('#work .project')].find((project) =>
  project.textContent.includes('Taiwan × Korea') || project.textContent.includes('台灣 × 韓國')
);
if (koreaProject) {
  koreaProject.querySelectorAll('.inline-links').forEach((container) => {
    if (!container.querySelector('a')) container.remove();
  });
}

// The archive count block duplicated information already visible as direct project links.
const archivePanel = document.querySelector('.archive-panel');
if (archivePanel) {
  const archiveProject = archivePanel.closest('.project');
  archivePanel.remove();
  if (archiveProject) archiveProject.classList.add('no-side');
}

// Job titles are translated with the site language.
// Company names only switch to English where an established/official English name is publicly documented.
const experienceEntries = [
  { companyZh: '洲際聯合有限公司', companyEn: '洲際聯合有限公司', roleZh: '公關副理', roleEn: 'Assistant PR Manager' },
  { companyZh: 'One Rule_規則王股份有限公司', companyEn: 'One Rule_規則王股份有限公司', roleZh: '行銷企劃 / 專案合作', roleEn: 'Marketing Planner / Project Contractor' },
  { companyZh: '隔壁老王數位行銷有限公司', companyEn: '隔壁老王數位行銷有限公司', roleZh: '行銷企劃 / 專案執行', roleEn: 'Marketing Planner / Project Specialist' },
  { companyZh: '殿梵聲研有限公司', companyEn: '殿梵聲研有限公司', roleZh: '營運企劃 / 專案合作', roleEn: 'Operations Planner / Project Collaboration' },
  { companyZh: '社團法人台北市美僑協會', companyEn: 'American Club Taipei', roleZh: '調酒師', roleEn: 'Bartender' },
  { companyZh: '果子電影有限公司', companyEn: 'ARS FILM PRODUCTIONS CO., LTD.', roleZh: '製片助理 / 實習', roleEn: 'Production Assistant / Intern' },
  { companyZh: '積木影像', companyEn: 'BIT Production Co., Ltd.', roleZh: '攝影助理 / 實習', roleEn: 'Camera Assistant / Intern' }
];

function updateExperienceLanguage(lang) {
  const isEnglish = lang === 'en';

  const currentRoleTitle = document.querySelector('.current-role strong');
  if (currentRoleTitle) currentRoleTitle.textContent = isEnglish ? 'Assistant PR Manager' : '公關副理';

  const currentRoleCompany = document.querySelector('.current-role b');
  if (currentRoleCompany) currentRoleCompany.textContent = '洲際聯合有限公司';

  const currentFeatureCompany = document.querySelector('.current-grid h2');
  if (currentFeatureCompany) currentFeatureCompany.textContent = '洲際聯合有限公司';

  const currentFeatureRole = document.querySelector('.role-title');
  if (currentFeatureRole) currentFeatureRole.textContent = isEnglish ? 'Assistant PR Manager' : '公關副理';

  const rows = [...document.querySelectorAll('.exp-list .exp')];
  rows.forEach((row, index) => {
    const entry = experienceEntries[index];
    if (!entry) return;
    const company = row.querySelector('h3');
    const role = row.querySelector('p');
    if (company) company.textContent = isEnglish ? entry.companyEn : entry.companyZh;
    if (role) role.textContent = isEnglish ? entry.roleEn : entry.roleZh;
  });
}

function updateEducationLanguage(lang) {
  const education = [...document.querySelectorAll('.profile-copy p')].find((p) => p.textContent.includes('銘傳大學') || p.textContent.includes('Ming Chuan University'));
  if (!education) return;

  const lineBreaks = education.querySelectorAll('br');
  if (!lineBreaks.length) return;

  let node = lineBreaks[0].nextSibling;
  while (node && node !== lineBreaks[1]) {
    const next = node.nextSibling;
    if (node.nodeType === Node.TEXT_NODE) node.remove();
    node = next;
  }
  lineBreaks[0].after(document.createTextNode(
    lang === 'en'
      ? 'Ming Chuan University — Department of New Media and Communication Administration'
      : '銘傳大學 新媒體暨傳播管理學系'
  ));
}

function setLanguage(language) {
  const lang = language === 'en' ? 'en' : 'zh';
  root.dataset.lang = lang;
  root.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  localStorage.setItem('portfolio-language', lang);
  updateExperienceLanguage(lang);
  updateEducationLanguage(lang);
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
