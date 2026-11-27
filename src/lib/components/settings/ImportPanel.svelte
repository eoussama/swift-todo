<script lang="ts">
  import type { TBackupPreview } from "@/lib/export/backup";
  import type { TImportMode } from "@/lib/todos/repository";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import UploadIcon from "@lucide/svelte/icons/upload";
  import { i18n } from "#i18n";
  import { Button } from "@/lib/components/ui/button";

  import { MAX_BACKUP_SIZE, parseBackup } from "@/lib/export/backup";
  import { errorMessage } from "@/lib/messages";
  import { toast } from "@/lib/toast";
  import { TodoError } from "@/lib/todos/errors";



  type Props = {
    store: TodoStore;
    /** Called after a successful import. */
    ondone?: () => void;
  };

  const { store, ondone }: Props = $props();

  let preview = $state<TBackupPreview | null>(null);
  let input = $state<HTMLInputElement | null>(null);

  async function read(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];

    preview = null;

    if (file === undefined) {
      return;
    }

    try {
      // Refuse huge files before reading them into memory (the limit is in
      // characters, and a character takes up to 4 bytes).
      if (file.size > MAX_BACKUP_SIZE * 4) {
        throw new TodoError("invalid-backup");
      }

      preview = parseBackup(await file.text());
    }
    catch (error) {
      toast.error(errorMessage(error as Error));
    }
    finally {
      // Let the same file be picked again.
      if (input !== null) {
        input.value = "";
      }
    }
  }

  async function apply(mode: TImportMode): Promise<void> {
    if (preview === null) {
      return;
    }

    const result = await store.importData(preview.data, mode);

    if (result !== undefined) {
      toast.success(i18n.t("settings.data.imported", result.added));
      preview = null;
      ondone?.();
    }
  }
</script>

<div class="flex flex-col gap-2">
  <p class="text-xs font-semibold text-muted-foreground">{i18n.t("settings.data.importHint")}</p>

  <input bind:this={input} type="file" accept=".json,application/json" hidden id="import-file" onchange={event => void read(event)} />
  <Button variant="outline" size="sm" class="self-start" onclick={() => input?.click()}>
    <UploadIcon />
    {i18n.t("settings.data.chooseFile")}
  </Button>

  {#if preview !== null}
    <div class="flex flex-col gap-2 rounded-md border-2 border-dashed border-border/50 p-2" role="status">
      <p class="text-[13px] font-bold">{i18n.t("settings.data.preview", [i18n.t("settings.data.backupTodos", preview.todos), i18n.t("settings.data.backupLists", preview.lists)])}</p>
      <div class="flex flex-wrap gap-1.5">
        <Button size="sm" onclick={() => void apply("merge")}>{i18n.t("settings.data.merge")}</Button>
        <Button size="sm" variant="outline" onclick={() => void apply("replace")}>{i18n.t("settings.data.replace")}</Button>
      </div>
      <p class="text-xs font-semibold text-muted-foreground">{i18n.t("settings.data.replaceHint")}</p>
    </div>
  {/if}
</div>
