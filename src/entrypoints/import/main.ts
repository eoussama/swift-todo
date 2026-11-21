import { invariant } from "@eoussama/core";
import { mount } from "svelte";

import Import from "./Import.svelte";

import "~/assets/app.css";



const target = document.getElementById("app");

invariant(target, "Import root element #app is missing.");

export default mount(Import, { target });
