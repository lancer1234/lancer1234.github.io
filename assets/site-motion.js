(() => {
  const root = document.documentElement;
  const header = document.querySelector('body > header');
  if (!header) return;

  header.classList.add('site-motion-nav');
  if (location.pathname === '/app/' || location.pathname === '/app/index.html') header.classList.add('site-motion-dark');
  root.classList.add('site-motion-ready');
  const updateClearance = () => root.style.setProperty('--site-nav-clearance', `${Math.ceil(header.getBoundingClientRect().height) + 8}px`);
  let pending = false;
  function updateNav() {
    pending = false;
    root.classList.toggle('site-motion-compact', scrollY > (root.classList.contains('site-motion-compact') ? 24 : 72));
  }
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(updateNav);
  }, { passive: true });
  window.addEventListener('pageshow', updateNav);
  if ('ResizeObserver' in window) new ResizeObserver(updateClearance).observe(header);
  else window.addEventListener('resize', updateClearance);
  updateNav();
  updateClearance();

  document.querySelectorAll('.lang-toggle').forEach(button => {
    button.addEventListener('click', () => root.classList.add('site-motion-language'));
  });

  document.querySelectorAll('.lab-project-links a, a.lab-project .lab-project-top > span:last-child, .post-arrow, header a, .project .inline-links a').forEach(target => {
    if (target.classList.contains('post-arrow')) {
      target.classList.add('site-motion-arrow');
      return;
    }
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const match = /↗\uFE0E?/.exec(node.data);
      if (!match) continue;
      const arrow = document.createElement('span');
      arrow.className = 'site-motion-arrow';
      arrow.textContent = match[0];
      node.replaceWith(node.data.slice(0, match.index), arrow, node.data.slice(match.index + match[0].length));
    }
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('site-motion-enter');
        observer.unobserve(entry.target);
      }
    }, { threshold: .16 });
    document.querySelectorAll('.lab-project').forEach(card => observer.observe(card));
  }
})();
