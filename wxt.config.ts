import type { Plugin } from "vite";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";



/**
 * The drag-and-drop library clears its screen-reader announcer with
 * `innerHTML = ""`; `textContent` clears it the same way without innerHTML.
 *
 * @returns The Vite plugin.
 */
function noInnerHtml(): Plugin {
  return {
    name: "swift-todo:no-inner-html",
    transform(code, id) {
      return id.includes("svelte-dnd-action") ? code.replaceAll("alertsDiv.innerHTML = \"\";", "alertsDiv.textContent = \"\";") : null;
    },
  };
}

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  modules: [
    "@wxt-dev/module-svelte",
    "@wxt-dev/i18n/module",
    "@wxt-dev/auto-icons",
  ],
  // Components build their DOM node by node rather than through innerHTML, so
  // the add-on holds no innerHTML assignments (Mozilla's linter flags them).
  svelte: {
    vite: { compilerOptions: { fragments: "tree" } },
  },
  autoIcons: {
    baseIconPath: "assets/icon.svg",
    sizes: [128, 96, 48, 32, 16],
  },
  vite: () => ({
    plugins: [tailwindcss(), noInnerHtml()],
  }),
  zip: {
    // The sources zip is for Firefox reviewers rebuilding the add-on; leave out local reports, the showcase screenshots and the store images.
    excludeSources: ["coverage/**", "playwright-report/**", "test-results/**", ".vscode/**", "reports/**", "showcase/**", "branding/**", "site/**", "tests/site/**"],
  },
  manifest: ({ browser }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    homepage_url: "https://swift-todo.ouss.es",
    // None of these shows an install warning: contextMenus, and activeTab with scripting to read a selection on right-click.
    permissions: ["storage", "alarms", "contextMenus", "activeTab", "scripting"],
    // Asked for only when reminders, the digest or nudges are turned on, so updates install silently.
    optional_permissions: ["notifications"],
    commands: {
      _execute_action: {
        description: "__MSG_commandOpen__",
        // Alt+Shift+T is taken by Chrome and Edge (focus the toolbar), and their shortcuts win.
        suggested_key: { default: "Alt+Shift+L" },
      },
    },
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          id: "swift-todo@ouss.es",
          strict_min_version: "140.0",
          data_collection_permissions: { required: ["none"] },
        },
        gecko_android: {
          strict_min_version: "142.0",
        },
      },
    }),
  }),
});
