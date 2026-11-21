import { hydrate, mount } from "svelte";

import App from "./App.svelte";

import "./app.css";



const target = document.getElementById("app")!;

// The built page comes rendered (see `build.ts`); the dev server's doesn't.
if (import.meta.env.DEV) {
  mount(App, { target });
}
else {
  hydrate(App, { target });
}

// Sections lift into place as they scroll into view. What's already on screen shows at once, so nothing blinks.
const hidden = [...document.querySelectorAll("[data-reveal]")].filter(element => element.getBoundingClientRect().top > innerHeight);
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("shown");
      observer.unobserve(entry.target);
    }
  }
}, { rootMargin: "0px 0px -8% 0px" });

for (const element of document.querySelectorAll("[data-reveal]")) {
  if (hidden.includes(element)) {
    observer.observe(element);
  }
  else {
    element.classList.add("shown");
  }
}

document.documentElement.classList.add("js");
