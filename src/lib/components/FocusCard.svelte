<script lang="ts">
  import type { TTimer } from "@/lib/time/timer";
  import type { TTodo } from "@/lib/todos/model";

  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckIcon from "@lucide/svelte/icons/check";
  import TimerIcon from "@lucide/svelte/icons/timer";
  import TimerOffIcon from "@lucide/svelte/icons/timer-off";
  import { i18n } from "#i18n";

  import icon from "@/assets/icon.svg";
  import { Button } from "@/lib/components/ui/button";
  import { TIMER_OPTIONS } from "@/lib/prefs/prefs";
  import { formatDue } from "@/lib/time/format";
  import { formatClock, remainingMs } from "@/lib/time/timer";



  type Props = {
    /** The to-do to work on now, or `undefined` when nothing is left. */
    todo: TTodo | undefined;
    /** How many are left, this one included. */
    left: number;
    /** Whether the queue comes from Today, or from the current view. */
    fromToday: boolean;
    timer: TTimer | null;
    /** The current moment, ticking every second while a timer runs. */
    now: Date;
    /** The timer length from settings. */
    defaultMinutes: number;
    ondone: () => void;
    onskip: () => void;
    onstart: (minutes: number) => void;
    onstop: () => void;
    onexit: () => void;
  };

  const { todo, left, fromToday, timer, now, defaultMinutes, ondone, onskip, onstart, onstop, onexit }: Props = $props();

  // The settings' length is offered next to the usual ones, in order.
  const lengths = $derived([...new Set<number>([...TIMER_OPTIONS, defaultMinutes])].sort((a, b) => a - b));
  // The settings' length until another is picked here.
  let picked = $state<number | null>(null);
  const minutes = $derived(picked ?? defaultMinutes);

  const due = $derived(todo?.due == null ? null : formatDue(todo.due, now));
  const chip = "inline-flex h-6 items-center rounded-full border-2 border-border/40 px-2 text-xs font-extrabold";
</script>

<section class="ruled margin-line flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-4 pr-4 pb-4 pl-[52px]" aria-label={i18n.t("focus.label")}>
  {#if todo === undefined}
    <div class="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <div class="flex flex-col items-center gap-1 rounded-xl bg-sheet/85 px-4 py-3">
        <img src={icon} alt="" class="mb-1.5 size-16 rotate-6 drop-shadow-[0_3px_0_var(--sticker)]" />
        <h2 class="font-hand text-[28px] leading-none font-bold">{i18n.t("focus.allClear")}</h2>
        <p class="text-[13px] font-semibold text-balance text-muted-foreground">{i18n.t("focus.allClearHint")}</p>
        <Button variant="outline" size="sm" class="mt-2" onclick={onexit}>{i18n.t("focus.exit")}</Button>
      </div>
    </div>
  {:else}
    <p class="self-start rounded-sm bg-sheet/85 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
      {fromToday ? i18n.t("focus.fromToday", left) : i18n.t("focus.fromList", left)}
    </p>

    <div class="rounded-md bg-sheet/85" aria-live="polite">
      <h2 class="font-hand text-[30px] leading-[1.05] font-bold break-words">{todo.text}</h2>
      {#if due !== null}
        <p class={[chip, "mt-2", due.overdue ? "border-destructive/60 text-destructive" : ""]}>{due.label}</p>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      <Button onclick={ondone}>
        <CheckIcon />
        {i18n.t("focus.done")}
      </Button>
      <Button variant="outline" onclick={onskip} disabled={left < 2}>
        {i18n.t("focus.skip")}
        <ArrowRightIcon />
      </Button>
    </div>

    <div class="mt-auto flex flex-col gap-2 rounded-md border-2 border-dashed border-border/50 bg-sheet p-3">
      {#if timer !== null}
        <div class="flex items-center gap-3">
          <p class="font-hand text-[44px] leading-none font-bold tabular-nums" role="timer" aria-label={i18n.t("focus.timerLabel")}>
            {formatClock(remainingMs(timer, now))}
          </p>
          <Button variant="outline" size="sm" class="ml-auto" onclick={onstop}>
            <TimerOffIcon />
            {i18n.t("focus.stop")}
          </Button>
        </div>
      {:else}
        <fieldset class="flex flex-wrap items-center gap-1.5">
          <legend class="sr-only">{i18n.t("focus.length")}</legend>
          {#each lengths as length (length)}
            <label class="relative">
              <input class="peer sr-only" type="radio" name="focus-length" value={length} checked={minutes === length} onchange={() => (picked = length)} />
              <span class="flex h-7 cursor-pointer items-center rounded-full border-2 border-border/40 px-2.5 text-xs font-extrabold peer-checked:border-border peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:focus-ring">
                {i18n.t("focus.minutes", [String(length)])}
              </span>
            </label>
          {/each}
        </fieldset>
        <Button variant="outline" class="self-start" onclick={() => onstart(minutes)}>
          <TimerIcon />
          {i18n.t("focus.start", [String(minutes)])}
        </Button>
      {/if}
    </div>
  {/if}
</section>
