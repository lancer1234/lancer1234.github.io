(function () {
  const measurementId = "G-TT6H7W0SH6";

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;
  gtag("js", new Date());
  gtag("config", measurementId, { anonymize_ip: true });

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
  document.head.appendChild(tag);

  function cleanLabel(link) {
    return (link.getAttribute("aria-label") || link.textContent || "link")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  function linkDetails(link) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return null;
    if (href.startsWith("mailto:")) {
      return { link_type: "email", link_destination: "mailto", link_label: "contact_email" };
    }
    if (href.startsWith("tel:")) {
      return { link_type: "phone", link_destination: "tel", link_label: "contact_phone" };
    }

    const target = new URL(href, window.location.href);
    const isInternal = target.origin === window.location.origin;
    return {
      link_type: isInternal ? "internal" : "external",
      link_destination: isInternal ? target.pathname : target.origin + target.pathname,
      link_label: cleanLabel(link),
    };
  }

  document.addEventListener(
    "click",
    function (event) {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const details = linkDetails(link);
      if (!details) return;
      gtag("event", "site_link_click", {
        ...details,
        page_path: window.location.pathname,
      });
    },
    { capture: true }
  );
})();
