<script lang="ts">
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import { toast } from "svelte-sonner";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { downloadText, exportName } from "@/lib/export/download";
  import { toBackup, toCsv, toMarkdown, toPlainText } from "@/lib/export/formats";

  import ImportPanel from "./ImportPanel.svelte";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  const inbox = i18n.t("lists.inbox");

  function exportAs(kind: "json" | "md" | "csv"): void {
    const now = new Date();

    if (kind === "json") {
      downloadText(exportName(now, "json"), `${JSON.stringify(toBackup(store, now), null, 2)}\n`, "application/json");
    }
    else if (kind === "md") {
      downloadText(exportName(now, "md"), toMarkdown(store.todos, store.lists, inbox, i18n.t("item.hidden")), "text/markdown");
    }
    else {
      downloadText(exportName(now, "csv"), toCsv(store.todos, store.lists, inbox, i18n.t("item.hidden")), "text/csv");
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(toPlainText(store.visible, i18n.t("item.hidden")));
      toast.success(i18n.t("settings.data.copied"));
    }
    catch {
      toast.error(i18n.t("errors.unknown"));
    }
  }

  // Firefox can close the popup when a file picker opens, so it imports from a tab.
  const importInTab = import.meta.env.FIREFOX;
</script>

<div class="flex flex-col gap-3">
  <div>
    <h4 class="mb-1.5 text-[13px] font-extrabold">{i18n.t("settings.data.export")}</h4>
    <div class="flex flex-wrap gap-1.5">
      <Button variant="outline" size="sm" onclick={() => exportAs("json")}><DownloadIcon />{i18n.t("settings.data.json")}</Button>
      <Button variant="outline" size="sm" onclick={() => exportAs("md")}><DownloadIcon />{i18n.t("settings.data.markdown")}</Button>
      <Button variant="outline" size="sm" onclick={() => exportAs("csv")}><DownloadIcon />{i18n.t("settings.data.csv")}</Button>
      <Button variant="outline" size="sm" onclick={() => void copy()}><ClipboardIcon />{i18n.t("settings.data.copy")}</Button>
    </div>
    <p class="mt-1.5 text-xs font-semibold text-muted-foreground">{i18n.t("settings.data.exportHint")}</p>
  </div>

  <div>
    <h4 class="mb-1.5 text-[13px] font-extrabold">{i18n.t("settings.data.import")}</h4>
    {#if importInTab}
      <Button variant="outline" size="sm" onclick={() => void browser.tabs.create({ url: browser.runtime.getURL("/import.html") })}>
        <ExternalLinkIcon />
        {i18n.t("settings.data.openImport")}
      </Button>
    {:else}
      <ImportPanel {store} />
    {/if}
  </div>
</div>
