/* main.js — small, dependency-free progressive enhancement.
   Every page works without it: content is visible, links work, videos open
   on their host. Each feature below is isolated, so one failing can never
   blank the page or break the others. */

(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safely(name, fn) {
    try { fn(); } catch (err) { if (window.console) console.warn("[site] " + name + " failed:", err); }
  }
  function ready(fn) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    safely("reveal", reveal);
    safely("nav", nav);
    safely("filters", filters);
    safely("video", videoFacades);
    safely("copy", copyButtons);
    safely("lightbox", lightbox);
  });

  /* ── Scroll-in reveal ──────────────────────────────────────────────
     Elements with .reveal start hidden (CSS, only when html.js is set) and
     fade up as they enter the viewport. If anything goes wrong we add
     html.no-reveal, which shows everything at once. */
  function reveal() {
    var items = doc.querySelectorAll(".reveal");
    if (!items.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) { root.classList.add("no-reveal"); return; }

    var io = new IntersectionObserver(function (entries) {
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        // stagger items that arrive together (a row of cards)
        entry.target.style.setProperty("--reveal-delay", Math.min(shown++, 5) * 0.07 + "s");
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });

    items.forEach(function (el) { io.observe(el); });

    // belt and braces: never leave content hidden if the observer stalls
    window.setTimeout(function () {
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
      });
    }, 1500);
  }

  /* ── Mobile navigation drawer ────────────────────────────────────── */
  function nav() {
    var toggle = doc.querySelector(".nav-toggle");
    var menu = doc.getElementById("site-nav");
    if (!toggle || !menu) return;
    var main = doc.querySelector("main");

    function set(open, restoreFocus) {
      menu.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      doc.body.classList.toggle("nav-open", open);
      // keep keyboard and screen-reader focus inside the open drawer
      [main, doc.getElementById("contact"), doc.querySelector(".site-footer")].forEach(function (el) {
        if (el) el.inert = open;
      });
      if (!open && restoreFocus) toggle.focus();
    }

    toggle.addEventListener("click", function () {
      set(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) set(false);
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") set(false, true);
    });
    // leaving the phone layout (rotate / resize) closes the drawer
    var wide = window.matchMedia("(min-width: 761px)");
    var onChange = function () { if (wide.matches) set(false); };
    if (wide.addEventListener) wide.addEventListener("change", onChange);
    else if (wide.addListener) wide.addListener(onChange);
  }

  /* ── Film filters ────────────────────────────────────────────────── */
  function filters() {
    var bar = doc.querySelector(".filters");
    if (!bar) return;
    var chips = bar.querySelectorAll(".chip");
    var grid = bar.parentElement.querySelector(".work-grid");
    if (!grid) return;
    var cards = grid.querySelectorAll(".work-card");
    var status = doc.createElement("p");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    bar.appendChild(status);

    function apply(filter, announce) {
      var n = 0;
      cards.forEach(function (card) {
        var show = filter === "all" || card.getAttribute("data-category") === filter;
        card.hidden = !show;
        if (show) { n++; card.classList.add("is-in"); }
      });
      chips.forEach(function (chip) {
        chip.setAttribute("aria-pressed", String(chip.getAttribute("data-filter") === filter));
      });
      if (announce) status.textContent = "Showing " + n + (n === 1 ? " film" : " films");
    }

    bar.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var filter = chip.getAttribute("data-filter");
      apply(filter, true);
      // remember the choice in the address, so Back and shared links keep it
      try {
        var url = new URL(window.location.href);
        if (filter === "all") url.searchParams.delete("type"); else url.searchParams.set("type", filter);
        window.history.replaceState(null, "", url);
      } catch (err) { /* file:// or old browser — the filter still works */ }
    });

    try {
      var wanted = new URL(window.location.href).searchParams.get("type");
      if (wanted && bar.querySelector('[data-filter="' + wanted.replace(/[^a-z0-9-]/g, "") + '"]')) apply(wanted, false);
    } catch (err) { /* ignore */ }
  }

  /* ── Click-to-load video ─────────────────────────────────────────────
     The page ships a poster + play link. Nothing is requested from YouTube,
     Google Drive, Vimeo or Instagram until the visitor presses play. */
  function videoFacades() {
    doc.addEventListener("click", function (e) {
      var play = e.target.closest(".video-play");
      if (!play) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return; // let "open in new tab" through
      var frame = play.closest(".video-frame");
      var src = frame && frame.getAttribute("data-embed");
      if (!src) return;
      e.preventDefault();

      var provider = frame.getAttribute("data-provider");
      var title = frame.getAttribute("data-title") || "Video";
      var player;

      if (provider === "instagram") {
        player = doc.createElement("blockquote");
        player.className = "instagram-media";
        player.setAttribute("data-instgrm-permalink", src);
        player.setAttribute("data-instgrm-version", "14");
        var link = doc.createElement("a");
        link.href = src;
        link.textContent = "View this post on Instagram";
        player.appendChild(link);
      } else {
        player = doc.createElement("iframe");
        player.src = src;
        player.title = title;
        player.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
        player.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        player.tabIndex = 0;
      }

      frame.textContent = "";
      frame.appendChild(player);
      frame.classList.add("is-live");

      if (provider === "instagram") {
        if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
        else {
          var s = doc.createElement("script");
          s.async = true;
          s.src = "https://www.instagram.com/embed.js";
          doc.body.appendChild(s);
        }
      } else {
        player.focus();
      }

      var note = frame.parentElement.querySelector(".video-note");
      if (note) note.hidden = true;
    });
  }

  /* ── Copy email ──────────────────────────────────────────────────── */
  function copyButtons() {
    doc.querySelectorAll(".copy-btn").forEach(function (btn) {
      if (!navigator.clipboard) { btn.hidden = true; return; }
      var status = btn.parentElement.querySelector('[role="status"]');
      var label = btn.textContent;
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(function () {
          btn.textContent = "Copied";
          btn.classList.add("is-done");
          if (status) status.textContent = "Email address copied";
          window.setTimeout(function () {
            btn.textContent = label;
            btn.classList.remove("is-done");
            if (status) status.textContent = "";
          }, 2200);
        }).catch(function () { btn.hidden = true; });
      });
    });
  }

  /* ── Lightbox for [data-zoom] images ─────────────────────────────────
     Uses the native <dialog>: focus is trapped, Esc closes, and the page
     behind is inert, all handled by the browser. Arrow keys / swipe move
     between images. */
  function lightbox() {
    var shots = Array.prototype.slice.call(doc.querySelectorAll("img[data-zoom]"));
    if (!shots.length || !("HTMLDialogElement" in window)) return;

    var box = doc.createElement("dialog");
    box.className = "lightbox";
    box.setAttribute("aria-label", "Image viewer");
    box.innerHTML =
      '<img class="lightbox-img" alt="" />' +
      '<p class="lightbox-caption" aria-live="polite"></p>' +
      '<button type="button" class="lightbox-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lightbox-prev" aria-label="Previous image">&larr;</button>' +
      '<button type="button" class="lightbox-next" aria-label="Next image">&rarr;</button>';
    doc.body.appendChild(box);

    var img = box.querySelector(".lightbox-img");
    var caption = box.querySelector(".lightbox-caption");
    var prev = box.querySelector(".lightbox-prev");
    var next = box.querySelector(".lightbox-next");
    var index = 0;
    var opener = null;

    function show(i) {
      index = (i + shots.length) % shots.length;
      var el = shots[index];
      var fig = el.closest("figure");
      var cap = fig && fig.querySelector("figcaption");
      img.src = el.getAttribute("data-full") || el.currentSrc || el.src;
      img.alt = el.alt || "";
      caption.textContent = (cap ? cap.textContent + "  " : "") + (shots.length > 1 ? (index + 1) + " / " + shots.length : "");
      prev.hidden = next.hidden = shots.length < 2;
    }
    function close() { box.close(); }

    shots.forEach(function (el, i) {
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", (el.alt ? el.alt + " — " : "") + "view larger");
      function open() { opener = el; show(i); box.showModal(); }
      el.addEventListener("click", open);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    box.querySelector(".lightbox-close").addEventListener("click", close);
    prev.addEventListener("click", function () { show(index - 1); });
    next.addEventListener("click", function () { show(index + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
    box.addEventListener("close", function () {
      img.removeAttribute("src");
      if (opener) opener.focus();
    });

    // swipe left / right on touch screens
    var startX = null;
    box.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 48) show(index + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
})();
