(function () {
  function normalizeTextArrows() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
      node.nodeValue = node.nodeValue
        .replace(/↗(?!︎)/g, "↗︎")
        .replace(/←(?!︎)/g, "←︎")
        .replace(/→(?!︎)/g, "→︎");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", normalizeTextArrows, { once: true });
  } else {
    normalizeTextArrows();
  }
})();
