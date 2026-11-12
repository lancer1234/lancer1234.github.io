(() => {
  document.querySelectorAll('.personal-page :is(.hero-links a,.strength-link,.lab-card a,a.lab-card,.project a:not(.project-image),.about-copy a,.about-side a,.profile-copy a,.contact-links a)').forEach(target => {
    if (target.matches('a') && !target.matches('.lab-card')) target.classList.add('personal-action');
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement.closest('.site-motion-arrow')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
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
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('personal-enter');
      observer.unobserve(entry.target);
    }
  }, { threshold: .12 });
  document.querySelectorAll('.personal-page :is(.strength-grid>a>h2,.project-main,.lab-card>h3,.about-facts,.about-copy h2,.side-block>p)').forEach(el => observer.observe(el));
})();
