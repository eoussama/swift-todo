<script lang="ts">
  import type { TTodo, TTodoSource } from "@/lib/todos/model";

  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { parseLink } from "@/lib/todos/model";

  import TodoDialog from "./TodoDialog.svelte";



  type Props = {
    open: boolean;
    todo: TTodo | null;
    /** Saves the link, or `null` to remove it. */
    onsave: (source: TTodoSource | null) => void;
  };

  let { open = $bindable(false), todo, onsave }: Props = $props();

  let value = $state("");
  let tried = $state(false);

  // Start from the to-do's current link each time the dialog opens.
  $effect.pre(() => {
    if (open && todo !== null) {
      value = todo.source?.url ?? "";
      tried = false;
    }
  });

  const parsed = $derived(parseLink(value));

  function save(event: SubmitEvent): void {
    event.preventDefault();
    tried = true;

    if (parsed === null || todo === null) {
      return;
    }

    // The same page keeps the title it was saved with.
    onsave(parsed.url === todo.source?.url ? todo.source : parsed);
    open = false;
  }

  function remove(): void {
    onsave(null);
    open = false;
  }
</script>

<TodoDialog bind:open {todo} title={i18n.t("link.title")} description={text => i18n.t("link.description", [text])}>
  <form class="flex flex-col gap-2" onsubmit={save} novalidate>
    <label class="flex flex-col gap-1 text-[13px] font-bold">
      {i18n.t("link.label")}
      <input
        bind:value
        type="url"
        inputmode="url"
        autocomplete="url"
        spellcheck="false"
        placeholder={i18n.t("link.placeholder")}
        class="h-9 rounded-md border-2 border-border bg-sheet px-2.5 text-sm font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive"
        aria-invalid={tried && parsed === null}
        aria-describedby={tried && parsed === null ? "link-error" : undefined}
      />
    </label>
    {#if tried && parsed === null}
      <p id="link-error" class="text-[12.5px] font-bold text-destructive" role="alert">{i18n.t("link.invalid")}</p>
    {/if}

    <div class="flex flex-wrap items-center gap-2 pt-1">
      {#if todo?.source != null}
        <Button variant="destructive" size="sm" onclick={remove}>{i18n.t("link.remove")}</Button>
      {/if}
      <Button variant="ghost" size="sm" class="ml-auto" onclick={() => (open = false)}>{i18n.t("schedule.cancel")}</Button>
      <Button type="submit" size="sm">{i18n.t("schedule.save")}</Button>
    </div>
  </form>
</TodoDialog>
