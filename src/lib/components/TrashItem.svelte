<script lang="ts">
  import type { TTrashedTodo } from "@/lib/todos/model";

  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import XIcon from "@lucide/svelte/icons/x";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Tooltip from "@/lib/components/ui/tooltip";



  type Props = {
    todo: TTrashedTodo;
    onrestore: () => void;
    ondelete: () => void;
  };

  const { todo, onrestore, ondelete }: Props = $props();
</script>

<!-- A deleted to-do: faded on its line, with Restore and Delete forever always at hand. -->
<div
  class="group/row margin-line relative flex min-h-11 items-start border-b border-rule bg-sheet transition-colors hover:bg-(--row-hover) animate-in fade-in-0 duration-200"
  role="group"
  aria-label={i18n.t("item.trashedLabel", [todo.text])}
>
  <span class="w-10 shrink-0"></span>

  <p class="min-w-0 flex-1 py-[11px] pr-2 pl-3 text-[14.5px] leading-[22px] font-bold text-muted-foreground [overflow-wrap:anywhere]">
    {todo.text}
  </p>

  <div class="flex shrink-0 items-center gap-px pt-[7px] pr-1">
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" size="icon-xs" aria-label={i18n.t("item.restore")} onclick={onrestore}>
            <Undo2Icon />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="left">{i18n.t("item.restore")}</Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="destructive" size="icon-xs" aria-label={i18n.t("item.deleteForever")} onclick={ondelete}>
            <XIcon strokeWidth={3} />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="left">{i18n.t("item.deleteForever")}</Tooltip.Content>
    </Tooltip.Root>
  </div>
</div>
