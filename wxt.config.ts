import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";



export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  modules: [
    "@wxt-dev/module-svelte",
    "@wxt-dev/i18n/module",
    "@wxt-dev/auto-icons",
  ],
  autoIcons: {
    baseIconPath: "assets/icon.svg",
    sizes: [128, 96, 48, 32, 16],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  zip: {
    // The sources zip is for Firefox reviewers rebuilding the add-on; leave out local reports and the showcase screenshots.
    excludeSources: ["coverage/**", "playwright-report/**", "test-results/**", ".vscode/**", "reports/**", "showcase/**", "site/**", "tests/site/**"],
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
