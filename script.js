document.getElementById('year').textContent = new Date().getFullYear();

if (!document.querySelector('link[href="/layout-fixes.css"]')) {
  const layoutFixes = document.createElement('link');
  layoutFixes.rel = 'stylesheet';
  layoutFixes.href = '/layout-fixes.css';
  document.head.appendChild(layoutFixes);
}

const root = document.documentElement;
const languageButton = document.querySelector('.lang-toggle');
const savedLanguage = localStorage.getItem('portfolio-language');
const browserLanguage = navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';

// Add ABOUT and BLOG as first-class items in the main navigation.
const mainNav = document.querySelector('.topbar nav');
if (mainNav) {
  const contactLink = mainNav.querySelector('a[href="#contact"]');

  if (!mainNav.querySelector('a[href="/about/"]')) {
    const aboutLink = document.createElement('a');
    aboutLink.href = '/about/';
    aboutLink.innerHTML = '<span class="lang-en">ABOUT</span><span class="lang-zh">關於我</span>';
    mainNav.insertBefore(aboutLink, contactLink || null);
  }

  if (!mainNav.querySelector('a[href="/blog/"]')) {
    const blogLink = document.createElement('a');
    blogLink.href = '/blog/';
    blogLink.innerHTML = '<span class="lang-en">BLOG</span><span class="lang-zh">文章</span>';
    mainNav.insertBefore(blogLink, contactLink || null);
  }
}

const currentFeaturePrimary = document.querySelector('.current-grid > div:first-child');
if (currentFeaturePrimary && !currentFeaturePrimary.querySelector('.current-company-brand')) {
  const brand = document.createElement('div');
  brand.className = 'current-company-brand';
  const logo = document.createElement('img');
  logo.src = '/assets/ocean-city-logo.webp';
  logo.alt = 'OCEAN CITY';
  logo.width = 280;
  logo.height = 90;
  brand.appendChild(logo);
  currentFeaturePrimary.insertBefore(brand, currentFeaturePrimary.firstChild);
}

const carrefourDescription = document.querySelector('#work .project .project-main > p:nth-of-type(2)');
if (carrefourDescription) {
  const en = carrefourDescription.querySelector('.lang-en');
  const zh = carrefourDescription.querySelector('.lang-zh');
  if (en) en.textContent = 'Owned the marketing campaign and task mechanics behind the event website, including campaign flow, mission design, project management, content publishing, and launch execution.';
  if (zh) zh.textContent = '負責活動網站背後的行銷活動與任務機制規劃，包含活動流程、任務設計、專案管理與內容上架，並統籌整體上線執行。';
}

const sensitiveKoreaTargets = [
  '1V8UKw-vjqHNS0yeq7G7Yl6dkprieC02l',
  '1cU_-ZEIBvKh9z_3mRYm-k2z0drFWeBAx',
  '1gCuCDqdClG4xFRYhRos6FYoN2CRYNjMZ',
  '1kSMHrxPC-flfDBlpjtT3tWWM8Z9P0XCq'
];

document.querySelectorAll('a[href]').forEach((link) => {
  if (sensitiveKoreaTargets.some((id) => link.href.includes(id))) link.remove();
});

const koreaProject = [...document.querySelectorAll('#work .project')].find((project) =>
  project.textContent.includes('Taiwan × Korea') || project.textContent.includes('台灣 × 韓國')
);
if (koreaProject) {
  koreaProject.querySelectorAll('.inline-links').forEach((container) => {
    if (!container.querySelector('a')) container.remove();
  });
}

const archivePanel = document.querySelector('.archive-panel');
if (archivePanel) {
  const archiveProject = archivePanel.closest('.project');
  archivePanel.remove();
  if (archiveProject) archiveProject.classList.add('no-side');
}

const labDemos = {
  'RED FLAG DETECTOR': {
    live: 'https://lancer1234.github.io/RED-FLAG-DETECTOR/',
    repo: 'https://github.com/lancer1234/RED-FLAG-DETECTOR'
  },
  'P2P Chat': {
    live: 'https://lancer1234.github.io/p2p-chat/',
    repo: 'https://github.com/lancer1234/p2p-chat'
  },
  'Y2K Cam': {
    live: 'https://lancer1234.github.io/y2k-cam/',
    repo: 'https://github.com/lancer1234/y2k-cam'
  },
  'Online Warmer': {
    live: 'https://lancer1234.github.io/online-warmer/',
    repo: 'https://github.com/lancer1234/online-warmer'
  }
};

document.querySelectorAll('#lab a.lab-card').forEach((card) => {
  const title = card.querySelector('h3')?.textContent.trim();
  const demo = labDemos[title];
  if (!demo) return;

  const replacement = document.createElement('article');
  replacement.className = `${card.className} lab-card-demo`;
  replacement.innerHTML = card.innerHTML;

  const oldMeta = replacement.querySelector('small');
  if (oldMeta) oldMeta.remove();

  const actions = document.createElement('div');
  actions.className = 'lab-actions';
  actions.innerHTML = `
    <a class="lab-live" href="${demo.live}" target="_blank" rel="noreferrer"><span class="lang-en">OPEN LIVE APP ↗</span><span class="lang-zh">開啟實際程式 ↗</span></a>
    <a class="lab-source" href="${demo.repo}" target="_blank" rel="noreferrer"><span class="lang-en">SOURCE / GITHUB ↗</span><span class="lang-zh">原始碼 / GITHUB ↗</span></a>
  `;

  replacement.appendChild(actions);
  card.replaceWith(replacement);
});

const profileQuote = document.querySelector('.profile .big-copy');
if (profileQuote) {
  profileQuote.innerHTML = '<span class="lang-en">I believe data provides direction, while human insight and on-the-ground details bring warmth to strategy.</span><span class="lang-zh">我相信數據提供方向，而人性與現場細節讓策略更有溫度。</span>';
}

const profileCopy = document.querySelector('.profile .profile-copy');
if (profileCopy && !profileCopy.querySelector('.profile-tagline')) {
  const tagline = document.createElement('p');
  tagline.className = 'profile-tagline';
  tagline.innerHTML = '<span class="lang-en">“See the direction through data insight, and tell brand stories through on-the-ground detail and imagery.”</span><span class="lang-zh">「以數據洞察看清方向，用現場細節與影像說好品牌故事。」</span>';
  profileCopy.insertBefore(tagline, profileCopy.firstChild);
}

if (profileCopy && !profileCopy.querySelector('a[href="/about/"]')) {
  const aboutLink = document.createElement('a');
  aboutLink.className = 'text-link profile-about-link';
  aboutLink.href = '/about/';
  aboutLink.innerHTML = '<span class="lang-en">READ FULL BIO ↗</span><span class="lang-zh">閱讀完整自傳 ↗</span>';
  profileCopy.appendChild(aboutLink);
}

const experienceEntries = [
  { companyZh: '洲際聯合有限公司', companyEn: 'OCEAN CITY', roleZh: '公關副理', roleEn: 'Assistant PR Manager' },
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
  if (currentRoleCompany) currentRoleCompany.textContent = isEnglish ? 'OCEAN CITY' : '洲際聯合有限公司';
  const currentFeatureCompany = document.querySelector('.current-grid h2');
  if (currentFeatureCompany) currentFeatureCompany.textContent = isEnglish ? 'OCEAN CITY' : '洲際聯合有限公司';
  const currentFeatureRole = document.querySelector('.role-title');
  if (currentFeatureRole) currentFeatureRole.textContent = isEnglish ? 'Assistant PR Manager' : '公關副理';

  [...document.querySelectorAll('.exp-list .exp')].forEach((row, index) => {
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
  languageButton.addEventListener('click', () => setLanguage(root.dataset.lang === 'zh' ? 'en' : 'zh'));
}

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => {
      link.style.opacity = link.getAttribute('href') === `#${entry.target.id}` ? '1' : '.62';
    });
  });
}, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
sections.forEach((section) => observer.observe(section));
