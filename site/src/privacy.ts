import { hydrate, mount } from "svelte";

import { markNewTabs } from "./new-tabs";
import Privacy from "./Privacy.svelte";

import "./app.css";



const target = document.getElementById("app")!;

if (import.meta.env.DEV) {
  mount(Privacy, { target });
}
else {
  hydrate(Privacy, { target });
}

markNewTabs();
