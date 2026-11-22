<script lang="ts">
  import type { DateValue } from "@internationalized/date";
  import type { TTodo } from "@/lib/todos/model";

  import { parseDate } from "@internationalized/date";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Calendar } from "@/lib/components/ui/calendar";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { Switch } from "@/lib/components/ui/switch";
  import { TimeInput } from "@/lib/components/ui/time-input";
  import { addDays, isClockTime, toDateString } from "@/lib/time/date";

  import TodoDialog from "./TodoDialog.svelte";



  type Props = {
    open: boolean;
    todo: TTodo | null;
    /** Saves the new due value, or `null` to remove the date. */
    onsave: (due: string | null) => void;
  };

  let { open = $bindable(false), todo, onsave }: Props = $props();

  let date = $state<DateValue | undefined>(undefined);
  let withTime = $state(false);
  let time = $state("09:00");

  // Start from the to-do's current date each time the dialog opens.
  $effect.pre(() => {
    if (!open || todo === null) {
      return;
    }

    if (todo.due === null) {
      date = parseDate(toDateString(new Date()));
      withTime = false;
      time = "09:00";
    }
    else {
      const [day = "", clock] = todo.due.split("T");

      date = parseDate(day);
      withTime = clock !== undefined;
      time = clock ?? "09:00";
    }
  });

  const locale = navigator.language;

  function quick(days: number): void {
    date = parseDate(toDateString(addDays(new Date(), days)));
  }

  // With "Add a time" on, Save waits for the whole time rather than quietly dropping it.
  let timePartial = $state(false);
  const ready = $derived(date !== undefined && (!withTime || (!timePartial && isClockTime(time))));

  function save(): void {
    if (date === undefined || !ready) {
      return;
    }

    onsave(withTime ? `${date.toString()}T${time}` : date.toString());
    open = false;
  }

  function clear(): void {
    onsave(null);
    open = false;
  }

  const scheduled = $derived(todo?.due != null);
</script>

<TodoDialog bind:open {todo} title={i18n.t("schedule.title")} description={text => i18n.t("schedule.description", [text])}>
  <div class="grid grid-cols-3 gap-1.5">
    <Button variant="outline" size="sm" onclick={() => quick(0)}>{i18n.t("schedule.today")}</Button>
    <Button variant="outline" size="sm" onclick={() => quick(1)}>{i18n.t("schedule.tomorrow")}</Button>
    <Button variant="outline" size="sm" onclick={() => quick(7)}>{i18n.t("schedule.nextWeek")}</Button>
  </div>

  <!-- The week's seven days spread across the whole box. -->
  <Calendar type="single" preventDeselect bind:value={date} {locale} calendarLabel={i18n.t("schedule.date")} class="w-full rounded-md border-2 border-border p-2 [--cell-size:2rem] [&_tr]:justify-between" />

  <div class="flex items-center gap-2">
    <Switch id="schedule-with-time" bind:checked={withTime} />
    <label for="schedule-with-time" class="cursor-pointer text-[13px] font-bold">{i18n.t("schedule.addTime")}</label>
    {#if withTime}
      <TimeInput bind:value={time} bind:partial={timePartial} label={i18n.t("schedule.time")} class="ml-auto" />
    {/if}
  </div>
  <!-- Always there (and empty while the time is whole), so the reason Save waits is announced when it appears. -->
  <p class="-mt-1 text-right text-xs font-bold text-muted-foreground empty:hidden" id="schedule-time-hint" role="status">{withTime && !ready && date !== undefined ? i18n.t("schedule.timeIncomplete") : ""}</p>

  <!-- Sized to this dialog's padding, so the band lines up with the edges. -->
  <Dialog.Footer class="-mx-3 -mb-3 flex-row justify-between gap-2 rounded-b-md p-3">
    {#if scheduled}
      <Button variant="destructive" size="sm" onclick={clear}>{i18n.t("schedule.remove")}</Button>
    {:else}
      <span></span>
    {/if}
    <div class="flex gap-2">
      <Button variant="ghost" size="sm" onclick={() => (open = false)}>{i18n.t("schedule.cancel")}</Button>
      <Button size="sm" disabled={!ready} aria-describedby={withTime && !ready ? "schedule-time-hint" : undefined} onclick={save}>{i18n.t("schedule.save")}</Button>
    </div>
  </Dialog.Footer>
</TodoDialog>
