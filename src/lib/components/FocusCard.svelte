<script lang="ts">
  import type { TTimer } from "@/lib/time/timer";
  import type { TTodo } from "@/lib/todos/model";

  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckIcon from "@lucide/svelte/icons/check";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import TargetIcon from "@lucide/svelte/icons/target";
  import TimerIcon from "@lucide/svelte/icons/timer";
  import TimerOffIcon from "@lucide/svelte/icons/timer-off";
  import { tick } from "svelte";
  import { i18n } from "#i18n";

  import icon from "@/assets/icon.svg";
  import { Button } from "@/lib/components/ui/button";
  import { NumberInput } from "@/lib/components/ui/number-input";
  import { MAX_TIMER_MINUTES, TIMER_OPTIONS } from "@/lib/prefs/prefs";
  import { formatDue } from "@/lib/time/format";
  import { formatClock, remainingMs } from "@/lib/time/timer";

  import Scribble from "./Scribble.svelte";



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
  // The settings' length until another is picked here, or a custom one typed.
  let picked = $state<number | null>(null);
  let custom = $state(false);
  let customMinutes = $state<number | null>(null);
  const minutes = $derived(custom ? customMinutes : picked ?? defaultMinutes);
  const valid = $derived(minutes !== null && Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_TIMER_MINUTES);
  let customInput = $state<HTMLInputElement | null>(null);

  async function chooseCustom(): Promise<void> {
    custom = true;
    customMinutes ??= picked ?? defaultMinutes;
    await tick();
    customInput?.select();
  }

  const due = $derived(todo?.due == null ? null : formatDue(todo.due, now));
  // A hidden to-do shows dots until revealed, here as on its row; the next to-do starts hidden again.
  let revealed = $state(false);
  // By ID: the queue is rebuilt every minute, and that's still the same to-do.
  const todoId = $derived(todo?.id);

  $effect.pre(() => {
    void todoId;
    revealed = false;
  });

  // When the focused control goes away (Start becomes Stop and back, the last Done becomes "All clear"),
  // focus moves to what replaced it instead of falling back to the page.
  let stopButton = $state<HTMLElement | null>(null);
  let startButton = $state<HTMLElement | null>(null);
  let clearHeading = $state<HTMLElement | null>(null);

  $effect(() => {
    if (stopButton !== null && document.activeElement === document.body) {
      stopButton.focus();
    }
  });

  // Stopped, or run out: Start is back where Stop was.
  $effect(() => {
    if (startButton !== null && document.activeElement === document.body) {
      startButton.focus();
    }
  });

  $effect(() => {
    if (clearHeading !== null && document.activeElement === document.body) {
      clearHeading.focus();
    }
  });
  const chip = "inline-flex h-6 items-center rounded-full border-2 border-border/70 px-2 text-xs font-extrabold";
</script>

<!-- Focus mode says so up top, with the way back right there, so it never looks like the list vanished. -->
<div class="flex shrink-0 items-center gap-2 border-b-2 border-border bg-(--row-focus) py-1.5 pr-1.5 pl-3 animate-in fade-in-0 slide-in-from-top-2 duration-300" data-focus-banner>
  <TargetIcon class="size-4 shrink-0" aria-hidden="true" />
  <p class="min-w-0 text-[13px] leading-tight font-extrabold">
    {i18n.t("focus.banner")}
    <span class="font-semibold text-muted-foreground">· {i18n.t("focus.bannerHint")}</span>
  </p>
  <Button variant="outline" size="sm" class="ml-auto h-7 shrink-0 px-2 text-[12.5px]" onclick={onexit}>
    <ArrowLeftIcon />
    {i18n.t("focus.exit")}
  </Button>
</div>

<section class="ruled margin-line flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-4 pr-4 pb-4 pl-[52px]" aria-label={i18n.t("focus.label")}>
  {#if todo === undefined}
    <div class="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <div class="flex flex-col items-center gap-1 px-4 py-3">
        <img src={icon} alt="" class="mb-1.5 size-16 rotate-6 drop-shadow-[0_3px_0_var(--sticker)]" />
        <h2 bind:this={clearHeading} tabindex="-1" class="font-hand text-[28px] leading-none font-bold outline-none">{i18n.t("focus.allClear")}</h2>
        <p class="text-[13px] font-semibold text-balance text-muted-foreground">{i18n.t("focus.allClearHint")}</p>
      </div>
    </div>
  {:else}
    <p class="self-start text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
      {fromToday ? i18n.t("focus.fromToday", left) : i18n.t("focus.fromList", left)}
    </p>

    <div aria-live="polite">
      {#if todo.hidden && !revealed}
        <h2 class="font-hand text-[30px] leading-[1.05] font-bold">
          <Scribble /><span class="sr-only">{i18n.t("item.hidden")}</span>
        </h2>
      {:else}
        <h2 class="font-hand text-[30px] leading-[1.05] font-bold break-words">{todo.text}</h2>
      {/if}
      {#if todo.hidden}
        <Button variant="ghost" size="sm" class="mt-1 -ml-2 h-7 px-2 text-xs" onclick={() => (revealed = !revealed)}>
          {#if revealed}<EyeOffIcon />{i18n.t("item.hide")}{:else}<EyeIcon />{i18n.t("item.show")}{/if}
        </Button>
      {/if}
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

    <!-- Centered; the lengths stay on one line unless they really don't fit. -->
    <div class="mt-auto flex flex-col items-center gap-2.5 rounded-md border-2 border-dashed border-border/50 bg-sheet p-3">
      {#if timer !== null}
        <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <p class="font-hand text-[44px] leading-none font-bold tabular-nums" role="timer" aria-label={i18n.t("focus.timerLabel")}>
            {formatClock(remainingMs(timer, now))}
          </p>
          <Button bind:ref={stopButton} variant="outline" size="sm" onclick={onstop}>
            <TimerOffIcon />
            {i18n.t("focus.stop")}
          </Button>
        </div>
      {:else}
        <fieldset class="flex flex-wrap items-center justify-center gap-1">
          <legend class="sr-only">{i18n.t("focus.length")}</legend>
          {#each lengths as length (length)}
            <label class="relative">
              <input class="peer sr-only" type="radio" name="focus-length" value={length} checked={!custom && minutes === length} aria-label={i18n.t("focus.minutes", [String(length)])} onchange={() => {
                picked = length;
                custom = false;
              }} />
              <span class="flex h-7 min-w-8 cursor-pointer items-center justify-center rounded-full border-2 border-border/70 px-2 text-xs font-extrabold tabular-nums peer-checked:border-border peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:focus-ring">{length}</span>
            </label>
          {/each}
          <label class="relative">
            <input class="peer sr-only" type="radio" name="focus-length" value="custom" checked={custom} onchange={() => void chooseCustom()} />
            <span class="flex h-7 cursor-pointer items-center gap-1 rounded-full border-2 border-border/70 px-2 text-xs font-extrabold peer-checked:border-border peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:focus-ring">
              <PencilIcon class="size-3" aria-hidden="true" />{i18n.t("focus.custom")}
            </span>
          </label>
        </fieldset>
        {#if custom}
          <div class="flex items-center gap-1.5 text-xs font-extrabold">
            <NumberInput
              bind:value={customMinutes}
              bind:ref={customInput}
              min={1}
              max={MAX_TIMER_MINUTES}
              label={i18n.t("focus.customMinutes")}
              less={i18n.t("focus.fewer")}
              more={i18n.t("focus.more")}
              onenter={onstart}
            />
            <span aria-hidden="true">{i18n.t("focus.minutesUnit")}</span>
          </div>
        {/if}
        <Button bind:ref={startButton} variant="outline" disabled={!valid} onclick={() => minutes !== null && onstart(minutes)}>
          <TimerIcon />
          {valid && minutes !== null ? i18n.t("focus.start", [String(minutes)]) : i18n.t("focus.startAny", [String(MAX_TIMER_MINUTES)])}
        </Button>
      {/if}
    </div>
  {/if}
</section>
