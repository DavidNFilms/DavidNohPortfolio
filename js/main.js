// main.js — safe on every page, never blanks navigation
document.addEventListener("DOMContentLoaded", () => {
  // Fade in on load (next frame so the transition runs)
  window.requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
    document.body.classList.remove("is-fading");
  });

  // Mobile nav toggle
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    // Close nav when any link is tapped
    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });

    // Close on resize back to desktop
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
  }

  // Smooth page fade-out on internal navigation
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    if (link.hasAttribute("download")) return;
    if (link.target && link.target !== "_self") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    document.body.classList.remove("is-loaded");
    document.body.classList.add("is-fading");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 500);
  });

  // Ensure visibility when restoring from bfcache
  window.addEventListener("pageshow", () => {
    document.body.classList.add("is-loaded");
    document.body.classList.remove("is-fading");
  });

  // Only run Projects animation on pages that actually have #projects
  const projectsSection = document.querySelector("#projects");
  if (!projectsSection) return;
  if (document.body.classList.contains("smi")) return;

  const projectsTitle = projectsSection.querySelector(".section-title");
  const cards = projectsSection.querySelectorAll(".project-card");

  if (!projectsTitle) return;

  // Optional: if you want fades, start hidden (only on pages with projects)
  projectsTitle.style.opacity = "0";
  projectsTitle.style.transition = "opacity 600ms ease";

  cards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transition = "opacity 800ms ease, transform 0.28s ease, box-shadow 0.28s ease";
  });

  function reveal() {
    const y = window.scrollY;

    if (y > 200) projectsTitle.style.opacity = "1";

    if (y > 350 && cards.length) {
      // reveal all cards with a small stagger rather than only the first three
      cards.forEach((card, i) => {
        setTimeout(() => {
          card.style.opacity = "1";
        }, i * 150);
      });
    }
  }

  window.addEventListener("scroll", reveal, { passive: true });
  reveal(); // run once on load
});
