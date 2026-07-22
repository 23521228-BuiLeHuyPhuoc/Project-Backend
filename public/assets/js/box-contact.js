const floatingContact = document.querySelector("[floating-contact]");

if (floatingContact) {
  const toggle = floatingContact.querySelector("[floating-contact-toggle]");
  const menu = floatingContact.querySelector(".inner-list");
  const items = Array.from(floatingContact.querySelectorAll(".inner-item"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let isOpen = false;
  let animationId = 0;
  let motionApi = null;

  import("https://cdn.jsdelivr.net/npm/motion@12.23.24/+esm")
    .then(api => {
      motionApi = api;

      if (!reduceMotion) {
        api.animate(
          toggle,
          { opacity: [0, 1], scale: [0.65, 1], y: [20, 0] },
          { type: "spring", stiffness: 460, damping: 26 }
        );
      }
    })
    .catch(() => {
      // CSS transitions keep the control functional if the CDN is unavailable.
    });

  const animateItems = async (open, currentAnimationId) => {
    if (!motionApi || reduceMotion) {
      if (!open) {
        floatingContact.classList.remove("is-open");
      }
      return;
    }

    const { animate, stagger } = motionApi;
    const animation = open
      ? animate(
          items,
          { opacity: [0, 1], scale: [0.72, 1], y: [18, 0] },
          {
            delay: stagger(0.055, { from: "last" }),
            type: "spring",
            stiffness: 500,
            damping: 28
          }
        )
      : animate(
          items,
          { opacity: [1, 0], scale: [1, 0.72], y: [0, 18] },
          {
            delay: stagger(0.03),
            duration: 0.18,
            ease: "easeIn"
          }
        );

    await animation;

    if (!open && currentAnimationId === animationId) {
      floatingContact.classList.remove("is-open");
    }
  };

  const setExpanded = open => {
    if (open === isOpen) {
      return;
    }

    isOpen = open;
    const currentAnimationId = ++animationId;

    floatingContact.classList.toggle("is-expanded", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Đóng menu liên hệ" : "Mở menu liên hệ");
    menu.setAttribute("aria-hidden", String(!open));

    if (open) {
      floatingContact.classList.add("is-open");
      menu.style.pointerEvents = "auto";
    } else {
      menu.style.pointerEvents = "none";
    }

    if (motionApi && !reduceMotion) {
      motionApi.animate(toggle, { scale: [1, 0.86, 1] }, { duration: 0.24 });
    }

    animateItems(open, currentAnimationId);
  };

  toggle.addEventListener("click", event => {
    event.stopPropagation();
    setExpanded(!isOpen);
  });

  document.addEventListener("click", event => {
    if (isOpen && !floatingContact.contains(event.target)) {
      setExpanded(false);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isOpen) {
      setExpanded(false);
      toggle.focus();
    }
  });
}
