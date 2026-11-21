<script lang="ts">
  import type { TRule } from "@/lib/time/recur";
  import type { TTodo } from "@/lib/todos/model";

  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { truncate } from "@/lib/messages";
  import { weekdayNames } from "@/lib/time/format";
  import { encodeRule, MAX_INTERVAL, parseRule } from "@/lib/time/recur";



  type Props = {
    open: boolean;
    todo: TTodo | null;
    /** Saves the stored rule, or `null` to stop repeating. */
    onsave: (repeat: string | null) => void;
  };

  let { open = $bindable(false), todo, onsave }: Props = $props();

  type TChoice = "none" | "1d" | "wd" | "1w" | "1M" | "custom";

  const PRESETS: Array<{ id: TChoice; label: string }> = [
    { id: "none", label: i18n.t("repeatDialog.none") },
    { id: "1d", label: i18n.t("repeatDialog.daily") },
    { id: "wd", label: i18n.t("repeatDialog.weekdays") },
    { id: "1w", label: i18n.t("repeatDialog.weekly") },
    { id: "1M", label: i18n.t("repeatDialog.monthly") },
    { id: "custom", label: i18n.t("repeatDialog.custom") },
  ];

  const UNITS = [
    { id: "m", label: i18n.t("repeatDialog.minutes") },
    { id: "h", label: i18n.t("repeatDialog.hours") },
    { id: "d", label: i18n.t("repeatDialog.days") },
    { id: "w", label: i18n.t("repeatDialog.weeks") },
    { id: "M", label: i18n.t("repeatDialog.months") },
  ] as const;

  const days = weekdayNames(navigator.language);
  // Monday first, which reads more naturally in most of the world.
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  let choice = $state<TChoice>("none");
  let every = $state(2);
  let unit = $state<"m" | "h" | "d" | "w" | "M">("d");
  let picked = $state<Array<number>>([]);

  // Start from the to-do's current rule each time the dialog opens.
  $effect.pre(() => {
    if (!open || todo === null) {
      return;
    }

    const rule = todo.repeat === null ? null : parseRule(todo.repeat);

    every = 2;
    unit = "d";
    picked = [];

    if (rule === null) {
      choice = "none";
    }
    else if (["1d", "wd", "1w", "1M"].includes(todo.repeat!)) {
      choice = todo.repeat as TChoice;
    }
    else {
      choice = "custom";

      if (rule.kind === "interval") {
        every = rule.every;
        unit = rule.unit;
      }
      else {
        picked = [...rule.days];
      }
    }
  });

  function toggleDay(day: number): void {
    picked = picked.includes(day) ? picked.filter(d => d !== day) : [...picked, day];
  }

  const custom = $derived<TRule>(picked.length > 0
    ? { kind: "weekdays", days: picked }
    : { kind: "interval", every: Number.isFinite(every) ? every : 1, unit });

  function save(): void {
    if (choice === "none") {
      onsave(null);
    }
    else {
      onsave(choice === "custom" ? encodeRule(custom) : choice);
    }

    open = false;
  }

  const fieldClass = "h-8 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]";
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="w-[340px] gap-3 bg-sheet p-3" showCloseButton={false}>
    <Dialog.Header class="gap-1 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{i18n.t("repeatDialog.title")}</Dialog.Title>
      <Dialog.Description class="text-[13px] font-semibold text-muted-foreground">
        {i18n.t("repeatDialog.description", [truncate(todo?.text ?? "", 36)])}
      </Dialog.Description>
    </Dialog.Header>

    <div role="radiogroup" aria-label={i18n.t("repeatDialog.title")} class="grid grid-cols-2 gap-1.5">
      {#each PRESETS as preset (preset.id)}
        <button
          type="button"
          role="radio"
          aria-checked={choice === preset.id}
          class={[
            "rounded-md border-2 border-border px-2 py-1.5 text-left text-[13px] font-bold outline-none focus-visible:focus-ring",
            choice === preset.id ? "bg-primary text-primary-foreground" : "bg-sheet hover:bg-muted",
          ]}
          onclick={() => (choice = preset.id)}
        >
          {preset.label}
        </button>
      {/each}
    </div>

    {#if choice === "custom"}
      <div class="flex flex-col gap-2 rounded-md border-2 border-dashed border-border/50 p-2">
        <div class="flex items-center gap-2 text-[13px] font-bold">
          <label for="repeat-every">{i18n.t("repeatDialog.every")}</label>
          <input id="repeat-every" type="number" min="1" max={MAX_INTERVAL} bind:value={every} disabled={picked.length > 0} class={[fieldClass, "w-16"]} />
          <select bind:value={unit} aria-label={i18n.t("repeatDialog.unit")} disabled={picked.length > 0} class={[fieldClass, "flex-1"]}>
            {#each UNITS as option (option.id)}
              <option value={option.id}>{option.label}</option>
            {/each}
          </select>
        </div>

        <fieldset>
          <legend class="mb-1 text-xs font-bold text-muted-foreground">{i18n.t("repeatDialog.onDays")}</legend>
          <div class="flex gap-1">
            {#each dayOrder as day (day)}
              <button
                type="button"
                aria-pressed={picked.includes(day)}
                class={[
                  "h-8 min-w-0 flex-1 rounded-md border-2 border-border text-xs font-bold outline-none focus-visible:focus-ring",
                  picked.includes(day) ? "bg-primary text-primary-foreground" : "bg-sheet hover:bg-muted",
                ]}
                onclick={() => toggleDay(day)}
              >
                {days[day]}
              </button>
            {/each}
          </div>
        </fieldset>
      </div>
    {/if}

    <p class="text-xs font-semibold text-muted-foreground">{i18n.t("repeatDialog.hint")}</p>

    <Dialog.Footer class="flex-row justify-end gap-2">
      <Button variant="ghost" size="sm" onclick={() => (open = false)}>{i18n.t("schedule.cancel")}</Button>
      <Button size="sm" onclick={save}>{i18n.t("schedule.save")}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
