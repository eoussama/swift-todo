<script lang="ts" module>
  import type { TAttachment, TRefusal } from "@/lib/attachments/attachments";

  import { i18n } from "#i18n";

  import { ATTACHMENT_LIMITS, formatSize } from "@/lib/attachments/attachments";
  import { attachments } from "@/lib/attachments/attachments.svelte";
  import { toast } from "@/lib/toast";


  /** Refusals beyond this many are left unsaid, so a big drop doesn't bury the popup in toasts. */
  const MAX_REFUSALS_SHOWN = 3;

  function refusalMessage({ name, reason }: TRefusal): string {
    switch (reason) {
      case "empty":
        return i18n.t("attach.refused.empty", [name]);

      case "too-big":
        return i18n.t("attach.refused.tooBig", [name, formatSize(ATTACHMENT_LIMITS.fileBytes)]);

      case "too-many":
        return i18n.t("attach.refused.tooMany", [name, String(ATTACHMENT_LIMITS.perTodo)]);

      case "full":
        return i18n.t("attach.refused.full", [name]);

      default:
        return i18n.t("attach.refused.failed", [name]);
    }
  }

  /**
   * Attaches files to a to-do, saying what was attached and what wasn't.
   *
   * @param todo The to-do's ID.
   * @param files The files.
   * @returns Once attached.
   */
  export async function attachFiles(todo: string, files: ReadonlyArray<File>): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const refused = await attachments.add(todo, files);
    const added = files.length - refused.length;

    if (added > 0) {
      toast.success(i18n.t("attach.added", added));
    }

    for (const refusal of refused.slice(0, MAX_REFUSALS_SHOWN)) {
      toast.error(refusalMessage(refusal));
    }
  }

  /**
   * Asks for files with the browser's file picker.
   *
   * @returns The files picked; none when cancelled.
   */
  export function pickFiles(): Promise<Array<File>> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      const finish = (files: Array<File>): void => {
        input.remove();
        resolve(files);
      };

      input.type = "file";
      input.multiple = true;
      input.hidden = true;
      input.addEventListener("change", () => finish(Array.from(input.files ?? [])));
      input.addEventListener("cancel", () => finish([]));
      document.body.append(input);
      input.click();
    });
  }

  /**
   * Saves an attachment with the browser's downloads.
   *
   * @param item The attachment.
   * @returns Once the download has started.
   */
  export async function download(item: TAttachment): Promise<void> {
    const blob = await attachments.read(item);

    if (blob === null) {
      toast.error(i18n.t("errors.unknown"));

      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = item.name;
    link.click();
    // Long enough for the download to have read it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // The clipboard takes pictures as PNG only.
  async function asPng(blob: Blob): Promise<Blob> {
    if (blob.type === "image/png") {
      return blob;
    }

    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);

    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();

    return canvas.convertToBlob({ type: "image/png" });
  }

  /**
   * Copies a picture to the clipboard, to paste somewhere else.
   *
   * @param item The attachment, a picture.
   * @returns Once copied, or said it couldn't be.
   */
  export async function copyImage(item: TAttachment): Promise<void> {
    try {
      const blob = await attachments.read(item);

      await navigator.clipboard.write([new ClipboardItem({ "image/png": asPng(blob!) })]);
      toast.success(i18n.t("attach.copied"));
    }
    catch {
      toast.error(i18n.t("errors.unknown"));
    }
  }
</script>

<script lang="ts">
  import CopyIcon from "@lucide/svelte/icons/copy";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileIcon from "@lucide/svelte/icons/file";
  import PaperclipIcon from "@lucide/svelte/icons/paperclip";
  import XIcon from "@lucide/svelte/icons/x";
  import { onDestroy, untrack } from "svelte";

  import { isPicture } from "@/lib/attachments/attachments";
  import { ConfirmTwice } from "@/lib/components/confirm.svelte";
  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";



  type Props = {
    /** The to-do's ID, for its stored files; left out for one not added yet, whose files are `files`. */
    todo?: string;
    /** Files to attach to a to-do not added yet, once it is. */
    files?: Array<File>;
    /** The to-do's text is hidden: so are its files' names and pictures. */
    concealed?: boolean;
  };

  let { todo, files = $bindable([]), concealed = false }: Props = $props();

  const uid = $props.id();

  /** A file shown: stored already, or waiting for its to-do to be added. */
  type TItem = { key: string; name: string; size: number; type: string; stored: TAttachment | null; file: File | null };

  // Files waiting have no ID: each gets a key for as long as it's shown.
  const keys = new WeakMap<File, string>();
  let nextKey = 0;

  function keyOf(file: File): string {
    if (!keys.has(file)) {
      keys.set(file, `pending-${nextKey++}`);
    }

    return keys.get(file)!;
  }

  const items = $derived<Array<TItem>>(todo === undefined
    ? files.map(file => ({ key: keyOf(file), name: file.name || i18n.t("attach.title"), size: file.size, type: file.type, stored: null, file }))
    : attachments.of(todo).map(stored => ({ key: stored.id, name: stored.name, size: stored.size, type: stored.type, stored, file: null })));

  // Pictures' thumbnails, read once each, and let go when the list goes.
  let urls = $state<Record<string, string>>({});

  $effect(() => {
    for (const item of items) {
      if (!isPicture(item.type) || item.key in untrack(() => urls)) {
        continue;
      }

      if (item.file !== null) {
        urls = { ...untrack(() => urls), [item.key]: URL.createObjectURL(item.file) };
        continue;
      }

      // Taken, so it isn't read twice while the first read is under way.
      urls = { ...untrack(() => urls), [item.key]: "" };
      void attachments.read(item.stored!).then((blob) => {
        if (blob !== null) {
          urls = { ...urls, [item.key]: URL.createObjectURL(blob) };
        }
      });
    }
  });

  onDestroy(() => {
    for (const url of Object.values(urls)) {
      if (url !== "") {
        URL.revokeObjectURL(url);
      }
    }
  });

  async function add(): Promise<void> {
    const picked = await pickFiles();

    if (todo === undefined) {
      files = [...files, ...picked];
    }
    else {
      await attachFiles(todo, picked);
    }
  }

  // Removing a stored file is for good, so it takes a second click on the same file; one waiting just goes.
  const removing = new ConfirmTwice();
  let armedId = $state<string | null>(null);

  $effect(() => () => removing.dispose());

  async function remove(item: TItem): Promise<void> {
    if (item.stored === null) {
      files = files.filter(file => file !== item.file);

      return;
    }

    if (armedId !== item.key && removing.armed) {
      // A first click on another file starts over.
      removing.press();
    }

    armedId = item.key;

    if (removing.press()) {
      armedId = null;
      await attachments.remove(item.key);
    }
  }

  let previewing = $state<TItem | null>(null);

  const termClass = "flex items-center gap-1.5 text-[12.5px] font-extrabold text-muted-foreground uppercase";
</script>

<!-- A to-do's files: pictures as thumbnails (a click shows them big), the rest by name. -->
<section class="flex flex-col gap-1.5" aria-labelledby="{uid}-title" data-attachments>
  <div class="flex items-center justify-between gap-2">
    <h3 id="{uid}-title" class={termClass}>
      <PaperclipIcon class="size-4" aria-hidden="true" />
      {i18n.t("attach.title")}{#if items.length > 0}<span class="font-bold">· {items.length}</span>{/if}
    </h3>
    <Button variant="outline" size="sm" class="h-7 px-2 text-[12px] [&_svg]:size-3.5" aria-label={i18n.t("attach.addLabel")} onclick={() => void add()}>
      <PaperclipIcon />{i18n.t("attach.add")}
    </Button>
  </div>

  {#if concealed && items.length > 0}
    <p class="rounded-md bg-(--row-hover) px-2.5 py-2 text-[13px] font-bold text-muted-foreground">{i18n.t("attach.hidden", items.length)}</p>
  {:else if items.length > 0}
    <ul class="flex max-h-44 flex-col gap-1 overflow-y-auto" aria-label={i18n.t("attach.title")}>
      {#each items as item (item.key)}
        {@const armed = removing.armed && armedId === item.key}
        {@const stored = item.stored}
        <li class="flex items-center gap-2 rounded-md bg-(--row-hover) p-1 pr-1.5" data-attachment={item.name}>
          {#if isPicture(item.type)}
            <button
              type="button"
              class="size-10 shrink-0 overflow-hidden rounded-[4px] border-2 border-border bg-sheet outline-none focus-visible:focus-ring"
              aria-label={i18n.t("attach.preview", [item.name])}
              onclick={() => (previewing = item)}
            >
              {#if urls[item.key]}<img src={urls[item.key]} alt="" class="size-full object-cover" />{/if}
            </button>
          {:else}
            <span class="grid size-10 shrink-0 place-items-center rounded-[4px] border-2 border-border/50 bg-sheet text-muted-foreground" aria-hidden="true">
              <FileIcon class="size-4" />
            </span>
          {/if}
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] leading-tight font-bold" title={item.name}>{item.name}</p>
            <p class="text-[11.5px] font-semibold text-muted-foreground">{formatSize(item.size)}</p>
          </div>
          {#if stored !== null}
            {#if isPicture(item.type)}
              <Button variant="ghost" size="icon-xs" tooltip={i18n.t("attach.copy")} aria-label={i18n.t("attach.copy")} onclick={() => void copyImage(stored)}>
                <CopyIcon />
              </Button>
            {/if}
            <Button variant="ghost" size="icon-xs" tooltip={i18n.t("attach.download")} aria-label={i18n.t("attach.download")} onclick={() => void download(stored)}>
              <DownloadIcon />
            </Button>
          {/if}
          <Button
            variant="ghost"
            size={armed ? "sm" : "icon-xs"}
            class={armed ? "h-7 bg-destructive-soft px-2 text-[12px] text-destructive [&_svg]:size-3.5" : "hover:text-destructive"}
            tooltip={armed ? undefined : i18n.t("attach.remove")}
            aria-label={armed ? i18n.t("attach.removeConfirm") : i18n.t("attach.remove")}
            onclick={() => void remove(item)}
          >
            <XIcon />{#if armed}{i18n.t("attach.removeConfirm")}{/if}
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="text-[11.5px] leading-snug font-semibold text-muted-foreground">{i18n.t("attach.hint")}</p>
</section>

<!-- A picture, big. -->
<Dialog.Root open={previewing !== null} onOpenChange={open => !open && (previewing = null)}>
  <Dialog.Content class="flex max-h-[calc(100%-24px)] w-[348px] flex-col gap-3 bg-sheet p-3" showCloseButton={false}>
    {#if previewing !== null}
      {@const item = previewing}
      <Dialog.Title class="truncate pr-2 text-[14px] font-extrabold" title={item.name}>{item.name}</Dialog.Title>
      <Dialog.Description class="sr-only">{formatSize(item.size)}</Dialog.Description>
      <img src={urls[item.key]} alt={item.name} class="max-h-[340px] min-h-0 w-full rounded-md border-2 border-border bg-(--row-hover) object-contain" data-preview />
      <div class="flex items-center gap-2">
        {#if item.stored !== null}
          {@const stored = item.stored}
          <Button variant="outline" size="sm" onclick={() => void copyImage(stored)}><CopyIcon />{i18n.t("attach.copy")}</Button>
          <Button variant="outline" size="sm" onclick={() => void download(stored)}><DownloadIcon />{i18n.t("attach.download")}</Button>
        {/if}
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} size="sm" class="ml-auto">{i18n.t("view.close")}</Button>
          {/snippet}
        </Dialog.Close>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
