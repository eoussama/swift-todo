<script lang="ts">
  import type { TBadgeMode, TPrefs } from "@/lib/prefs/prefs";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Select } from "@/lib/components/ui/select";
  import { Switch } from "@/lib/components/ui/switch";
  import { TimeInput } from "@/lib/components/ui/time-input";
  import { hasNotifications, requestNotifications } from "@/lib/permissions";
  import { leadChoices } from "@/lib/prefs/prefs";
  import { isClockTime } from "@/lib/time/date";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  let granted = $state(true);

  onMount(() => {
    void hasNotifications().then(value => (granted = value));
  });

  const wantsNotifications = $derived(store.prefs.reminders || store.prefs.digest !== null || store.prefs.nudges);

  // Asks for the permission, in the click itself (browsers require it).
  async function ask(): Promise<boolean> {
    granted = await requestNotifications();

    if (!granted) {
      toast.error(i18n.t("settings.reminders.denied"));
    }

    return granted;
  }

  // Turning on anything that notifies asks first, and saves at once alongside: in Firefox the
  // prompt can close the popup, and what's turned on stays on. Refused, it's turned back off;
  // the background only notifies with the permission anyway, and the Allow banner asks again.
  async function turn(on: boolean, onPatch: Partial<TPrefs>, offPatch: Partial<TPrefs>): Promise<void> {
    if (!on) {
      await store.savePrefs(offPatch);

      return;
    }

    const asked = ask();

    await store.savePrefs(onPatch);

    if (!(await asked)) {
      await store.savePrefs(offPatch);
    }
  }

  function toggle(key: "reminders" | "nudges", on: boolean): void {
    void turn(on, { [key]: true }, { [key]: false });
  }

  function toggleDigest(on: boolean): void {
    void turn(on, { digest: "09:00" }, { digest: null });
  }

  function leadLabel(minutes: number): string {
    if (minutes === 0) {
      return i18n.t("settings.reminders.atDue");
    }

    return minutes % 60 === 0 ? i18n.t("settings.reminders.hoursBefore", minutes / 60) : i18n.t("settings.reminders.before", minutes);
  }

  const BADGES: Array<{ id: TBadgeMode; label: string }> = [
    { id: "due", label: i18n.t("settings.reminders.badgeDue") },
    { id: "open", label: i18n.t("settings.reminders.badgeOpen") },
    { id: "off", label: i18n.t("settings.reminders.badgeOff") },
  ];

  const rowClass = "flex items-center gap-2 text-[13px] font-bold";
</script>

<div class="flex flex-col gap-2.5">
  {#if wantsNotifications && !granted}
    <div class="flex items-center gap-2 rounded-md border-2 border-dashed border-destructive/60 bg-destructive-soft p-2 text-xs font-bold" role="status">
      <span class="flex-1">{i18n.t("settings.reminders.blocked")}</span>
      <Button size="sm" variant="outline" onclick={() => void ask()}>{i18n.t("settings.reminders.allow")}</Button>
    </div>
  {/if}

  <div class={rowClass}>
    <Switch id="pref-reminders" checked={store.prefs.reminders} onCheckedChange={on => toggle("reminders", on)} />
    <label for="pref-reminders" class="flex-1 cursor-pointer">{i18n.t("settings.reminders.due")}</label>
  </div>

  <div class={[rowClass, "pl-12"]}>
    <span class="text-muted-foreground" aria-hidden="true">{i18n.t("settings.reminders.when")}</span>
    <Select
      value={String(store.prefs.lead)}
      options={leadChoices(store.prefs.lead).map(minutes => ({ value: String(minutes), label: leadLabel(minutes) }))}
      aria-label={i18n.t("settings.reminders.when")}
      disabled={!store.prefs.reminders}
      class="flex-1"
      onValueChange={value => void store.savePrefs({ lead: Number(value) })}
    />
  </div>

  <div class={rowClass}>
    <Switch id="pref-digest" checked={store.prefs.digest !== null} onCheckedChange={toggleDigest} />
    <label for="pref-digest" class="flex-1 cursor-pointer">{i18n.t("settings.reminders.digest")}</label>
    <TimeInput
      value={store.prefs.digest ?? "09:00"}
      label={i18n.t("settings.reminders.digestTime")}
      disabled={store.prefs.digest === null}
      onValueChange={(value) => {
        if (isClockTime(value)) {
          void store.savePrefs({ digest: value });
        }
      }}
    />
  </div>

  <div class={rowClass}>
    <Switch id="pref-nudges" checked={store.prefs.nudges} onCheckedChange={on => toggle("nudges", on)} aria-describedby="pref-nudges-hint" />
    <div class="flex-1">
      <label for="pref-nudges" class="cursor-pointer">{i18n.t("settings.reminders.nudges")}</label>
      <p id="pref-nudges-hint" class="text-xs font-semibold text-muted-foreground">{i18n.t("settings.reminders.nudgesHint")}</p>
    </div>
  </div>

  <fieldset class="flex flex-col">
    <legend class="mb-1 text-[13px] font-bold">{i18n.t("settings.reminders.badge")}</legend>
    {#each BADGES as badge (badge.id)}
      <label class="flex min-h-7 items-center gap-2 text-[13px] font-semibold">
        <input
          type="radio"
          name="pref-badge"
          class="size-4 accent-(--primary)"
          value={badge.id}
          checked={store.prefs.badge === badge.id}
          onchange={() => void store.savePrefs({ badge: badge.id })}
        />
        {badge.label}
      </label>
    {/each}
  </fieldset>
</div>
