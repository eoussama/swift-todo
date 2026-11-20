import { invariant } from "@eoussama/core";
import { mount } from "svelte";

import App from "./App.svelte";

import "~/assets/app.css";



const target = document.getElementById("app");

invariant(target, "Popup root element #app is missing.");

export default mount(App, { target });
