<script lang="ts">
  import FileIcon from "@lucide/svelte/icons/file";
  import ImageIcon from "@lucide/svelte/icons/image";
  import XIcon from "@lucide/svelte/icons/x";
  import { i18n } from "#i18n";

  import { formatSize, isPicture } from "@/lib/attachments/attachments";



  type Props = {
    /** Files to attach once the to-do is added. */
    files: Array<File>;
    class?: string;
  };

  let { files = $bindable(), class: className = "" }: Props = $props();
</script>

<!-- Files pasted or dropped on a to-do still being written, attached once it's added. -->
{#if files.length > 0}
  <ul class={["flex flex-wrap gap-1", className]} aria-label={i18n.t("attach.pending")} data-pending-files>
    {#each files as file, index (index)}
      {@const Icon = isPicture(file.type) ? ImageIcon : FileIcon}
      <li class="flex max-w-full min-w-0 items-center gap-1 rounded-full border-2 border-border/60 bg-sheet py-px pr-0.5 pl-1.5 text-[11.5px] font-bold" title="{file.name} · {formatSize(file.size)}">
        <Icon class="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="max-w-36 truncate">{file.name || i18n.t("attach.title")}</span>
        <button
          type="button"
          class="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={i18n.t("attach.unpend", [file.name])}
          onmousedown={event => event.preventDefault()}
          onclick={() => (files = files.filter((_, i) => i !== index))}
        >
          <XIcon class="size-3" strokeWidth={3} />
        </button>
      </li>
    {/each}
  </ul>
{/if}
