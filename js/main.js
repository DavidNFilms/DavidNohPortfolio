// main.js — safe on every page, never blanks navigation
document.addEventListener("DOMContentLoaded", () => {
  // Fade in on load (next frame so the transition runs)
  window.requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
    document.body.classList.remove("is-fading");
  });

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
    card.style.transition = "opacity 800ms ease";
  });

  function reveal() {
    const y = window.scrollY;

    if (y > 200) projectsTitle.style.opacity = "1";

    if (y > 350 && cards.length) {
      cards[0] && (cards[0].style.opacity = "1");
      setTimeout(() => cards[1] && (cards[1].style.opacity = "1"), 250);
      setTimeout(() => cards[2] && (cards[2].style.opacity = "1"), 500);
    }
  }

  window.addEventListener("scroll", reveal, { passive: true });
  reveal(); // run once on load
});
