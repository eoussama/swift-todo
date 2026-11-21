import { invariant } from "@eoussama/core";
import { mount } from "svelte";

import { paintCachedAppearance } from "~/lib/appearance.svelte";

import Import from "./Import.svelte";

import "~/assets/app.css";



const target = document.getElementById("app");

invariant(target, "Import root element #app is missing.");

// The last skin and theme, painted before the first frame so the popup doesn't flash.
paintCachedAppearance();

export default mount(Import, { target });
