// The redesigned site: anything marked [data-motion] gets `.paused` while it's off screen, and its CSS pauses its
// animations then, so nothing animates out of view. Without JavaScript the animations simply run.
const io = new IntersectionObserver((entries) => {
  for (const e of entries) e.target.classList.toggle("paused", !e.isIntersecting);
});
document.querySelectorAll("[data-motion]").forEach((el) => io.observe(el));
