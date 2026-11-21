<script lang="ts">
  import type { TTodo, TTodoSource } from "@/lib/todos/model";

  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { truncate } from "@/lib/messages";
  import { parseLink, shownText } from "@/lib/todos/model";



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

<Dialog.Root bind:open>
  <Dialog.Content class="w-[340px] gap-3 bg-sheet p-3" showCloseButton={false}>
    <Dialog.Header class="gap-1 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{i18n.t("link.title")}</Dialog.Title>
      <Dialog.Description class="text-[13px] font-semibold text-muted-foreground">
        {i18n.t("link.description", [truncate(todo === null ? "" : shownText(todo, i18n.t("item.hidden")), 36)])}
      </Dialog.Description>
    </Dialog.Header>

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
          class="h-9 rounded-md border-2 border-border bg-sheet px-2.5 text-sm font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)] aria-invalid:border-destructive"
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
  </Dialog.Content>
</Dialog.Root>
