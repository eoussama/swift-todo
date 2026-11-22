<script lang="ts">
  import type { Snippet } from "svelte";
  import type { TTodo } from "@/lib/todos/model";

  import { i18n } from "#i18n";

  import * as Dialog from "@/lib/components/ui/dialog";
  import { truncate } from "@/lib/messages";
  import { shownText } from "@/lib/todos/model";



  type Props = {
    open: boolean;
    /** The to-do it's about, named in the description. */
    todo: TTodo | null;
    title: string;
    /** The description, given the to-do's text (cut short, and dots when it's hidden). */
    description: (text: string) => string;
    children: Snippet;
  };

  let { open = $bindable(false), todo, title, description, children }: Props = $props();
</script>

<!-- The frame of the small dialogs opened from a row: Schedule, Repeat and Link. -->
<Dialog.Root bind:open>
  <Dialog.Content class="w-[340px] gap-3 bg-sheet p-3" showCloseButton={false}>
    <Dialog.Header class="gap-1 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{title}</Dialog.Title>
      <Dialog.Description class="text-[13px] font-semibold text-muted-foreground">
        {description(truncate(todo === null ? "" : shownText(todo, i18n.t("item.hidden")), 36))}
      </Dialog.Description>
    </Dialog.Header>

    {@render children()}
  </Dialog.Content>
</Dialog.Root>
