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
  manifest: ({ browser }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    homepage_url: "https://github.com/eoussama/swift-todo",
    permissions: ["storage", "alarms"],
    commands: {
      _execute_action: {
        description: "__MSG_commandOpen__",
        suggested_key: { default: "Alt+Shift+T" },
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
