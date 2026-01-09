const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("is-open")) return;
    const inside = nav.contains(e.target) || navToggle.contains(e.target);
    if (!inside) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}
