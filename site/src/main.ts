import { prefersReducedMotion } from "svelte/motion";

import App from "./App.svelte";
import { perFrame } from "./frame";
import { start } from "./start";



start(App);

/**
 * Brings sections in as they scroll into view. What's already on screen shows
 * at once, so nothing blinks while the page starts.
 */
function reveal(): void {
  const elements = [...document.querySelectorAll<HTMLElement>("[data-reveal], .section .title, .section .title + .lead")];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.shown = "";
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -10% 0px" });

  for (const element of elements) {
    if (element.getBoundingClientRect().top < innerHeight * 0.9) {
      element.dataset.shown = "";
    }
    else {
      observer.observe(element);
    }
  }

  document.documentElement.classList.add("js");
}

/**
 * Moves `[data-parallax]` elements at their own pace as the page scrolls: a
 * positive speed lags behind (far away), a negative one runs ahead (close).
 * They sit where they were laid out while in the first screen, or when their
 * middle crosses the middle of the window.
 */
function parallax(): void {
  const items = [...document.querySelectorAll<HTMLElement>("[data-parallax]")].map(element => ({ element, speed: Number(element.dataset.parallax), middle: 0, shown: true }));
  const desk = document.querySelector<HTMLElement>("[data-desk]");

  const update = (): void => {
    const view = scrollY + innerHeight / 2;

    for (const item of items) {
      // Hidden ones (the doodles, on narrow screens) aren't moved.
      if (!item.shown) {
        continue;
      }

      const settled = Math.max(item.middle, innerHeight / 2);

      item.element.style.translate = `0 ${((view - settled) * item.speed).toFixed(1)}px`;
    }

    // The dotted desk drifts at a third of the scroll; its dots repeat every 22 pixels.
    if (desk !== null) {
      desk.style.translate = `0 ${(-((scrollY / 3) % 22)).toFixed(1)}px`;
    }
  };

  // From the layout, so the elements' own transforms and entrances don't count.
  const measure = (): void => {
    for (const item of items) {
      item.shown = item.element.getClientRects().length > 0;

      let top = 0;

      for (let element: HTMLElement | null = item.element; element !== null; element = element.offsetParent as HTMLElement | null) {
        top += element.offsetTop;
      }

      item.middle = top + item.element.offsetHeight / 2;
    }

    update();
  };

  measure();
  addEventListener("scroll", perFrame(update), { passive: true });
  addEventListener("resize", perFrame(measure));
  void document.fonts.ready.then(measure);
}

reveal();

if (!prefersReducedMotion.current) {
  parallax();
}
