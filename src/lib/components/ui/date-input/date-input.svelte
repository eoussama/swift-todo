<script lang="ts">
  import type { DateValue } from "@internationalized/date";

  import { parseDate } from "@internationalized/date";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import { Popover } from "bits-ui";

  import { Calendar } from "@/lib/components/ui/calendar";
  import { cn } from "@/lib/utils.js";



  type Props = {
    /** The date as `YYYY-MM-DD`, or `""` for none. */
    value: string;
    /** Names the button for assistive tech, with the date chosen. */
    label: string;
    /** Shown when there's no date. */
    empty: string;
    /** The button that removes the date, like "Remove date". */
    clear: string;
    class?: string;
  };

  let { value = $bindable(), label, empty, clear, class: className }: Props = $props();

  let open = $state(false);
  const locale = navigator.language;

  const date = $derived.by(() => {
    try {
      return value === "" ? undefined : parseDate(value);
    }
    catch {
      return undefined;
    }
  });
  const shown = $derived(date === undefined ? empty : new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date.toDate("UTC")));
</script>

<!-- A date picked from the app's calendar (Bits UI), in a popover, in place of the browser's date input. -->
<Popover.Root bind:open>
  <Popover.Trigger
    class={cn(
      "flex h-8 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border-2 border-border bg-sheet px-2 text-left text-[13px] font-bold text-foreground normal-case outline-none transition-colors hover:border-primary focus-visible:focus-ring data-[state=open]:border-primary",
      className,
    )}
    aria-label={`${label}: ${shown}`}
  >
    <CalendarIcon class="size-4 shrink-0 opacity-70" aria-hidden="true" />
    <span class={["truncate", date === undefined && "text-muted-foreground"]}>{shown}</span>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      sideOffset={4}
      collisionPadding={8}
      class="z-50 flex max-h-(--bits-popover-content-available-height) w-[280px] flex-col gap-1 overflow-y-auto rounded-lg border-2 border-border bg-popover p-2 text-popover-foreground shadow-sticker duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
    >
      <Calendar
        type="single"
        preventDeselect
        bind:value={() => date as DateValue | undefined,
          (next) => {
            const text = next === undefined ? "" : next.toString();

            // The calendar reports its value as it opens; only a real pick closes it.
            if (text !== value) {
              value = text;
              open = false;
            }
          }}
        {locale}
        calendarLabel={label}
        class="w-full bg-transparent p-0 [--cell-size:2rem] [&_tr]:justify-between"
      />
      {#if date !== undefined}
        <button
          type="button"
          class="self-end rounded-md px-2 py-1 text-xs font-extrabold text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:focus-ring"
          onclick={() => {
            value = "";
            open = false;
          }}
        >{clear}</button>
      {/if}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
