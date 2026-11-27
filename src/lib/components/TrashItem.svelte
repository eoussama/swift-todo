<script lang="ts">
  import type { TTrashedTodo } from "@/lib/todos/model";

  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import XIcon from "@lucide/svelte/icons/x";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { oneLine } from "@/lib/messages";
  import { shownText } from "@/lib/todos/model";

  import Scribble from "./Scribble.svelte";



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
  data-trash-row
  aria-label={i18n.t("item.trashedLabel", [oneLine(shownText(todo, i18n.t("item.hidden")))])}
>
  <span class="w-10 shrink-0"></span>

  <!-- One line, cut short, like a to-do's (`data-todo-line` in app.css). -->
  <p data-todo-line class="min-w-0 flex-1 py-[11px] pr-2 pl-3 text-[length:calc(14.5px*1.08)] leading-[22px] written text-muted-foreground [overflow-wrap:anywhere]">
    <span data-todo-text>{#if todo.hidden}<Scribble />{:else}{todo.text}{/if}</span>
  </p>

  <div class="flex shrink-0 items-center gap-px pt-[7px] pr-1">
    <Button variant="ghost" size="icon-xs" tooltip={i18n.t("item.restore")} tooltipSide="left" onclick={onrestore}>
      <Undo2Icon />
    </Button>
    <Button variant="destructive" size="icon-xs" tooltip={i18n.t("item.deleteForever")} tooltipSide="left" onclick={ondelete}>
      <XIcon strokeWidth={3} />
    </Button>
  </div>
</div>
