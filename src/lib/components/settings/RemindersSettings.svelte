<script lang="ts">
  import type { TBadgeMode, TPrefs } from "@/lib/prefs/prefs";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Switch } from "@/lib/components/ui/switch";
  import { hasNotifications, requestNotifications } from "@/lib/permissions";
  import { LEAD_OPTIONS } from "@/lib/prefs/prefs";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  let granted = $state(true);

  onMount(() => {
    void hasNotifications().then(value => (granted = value));
  });

  const wantsNotifications = $derived(store.prefs.reminders || store.prefs.digest !== null || store.prefs.nudges);

  // Turning on anything that notifies asks for the permission first (it must happen in the click).
  async function enable(patch: Partial<TPrefs>): Promise<void> {
    granted = await requestNotifications();

    if (granted) {
      await store.savePrefs(patch);
    }
    else {
      toast.error(i18n.t("settings.reminders.denied"));
    }
  }

  function toggle(key: "reminders" | "nudges", on: boolean): void {
    void (on ? enable({ [key]: true }) : store.savePrefs({ [key]: false }));
  }

  function toggleDigest(on: boolean): void {
    void (on ? enable({ digest: "09:00" }) : store.savePrefs({ digest: null }));
  }

  function leadLabel(minutes: number): string {
    if (minutes === 0) {
      return i18n.t("settings.reminders.atDue");
    }

    return minutes === 60 ? i18n.t("settings.reminders.hourBefore") : i18n.t("settings.reminders.before", minutes);
  }

  const BADGES: Array<{ id: TBadgeMode; label: string }> = [
    { id: "due", label: i18n.t("settings.reminders.badgeDue") },
    { id: "open", label: i18n.t("settings.reminders.badgeOpen") },
    { id: "off", label: i18n.t("settings.reminders.badgeOff") },
  ];

  const fieldClass = "h-8 rounded-md border-2 border-border bg-sheet px-2 text-[13px] font-bold outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)] disabled:opacity-50";
  const rowClass = "flex items-center gap-2 text-[13px] font-bold";
</script>

<div class="flex flex-col gap-2.5">
  {#if wantsNotifications && !granted}
    <div class="flex items-center gap-2 rounded-md border-2 border-dashed border-destructive/60 bg-destructive-soft p-2 text-xs font-bold" role="status">
      <span class="flex-1">{i18n.t("settings.reminders.blocked")}</span>
      <Button size="sm" variant="outline" onclick={() => void enable({})}>{i18n.t("settings.reminders.allow")}</Button>
    </div>
  {/if}

  <div class={rowClass}>
    <Switch id="pref-reminders" checked={store.prefs.reminders} onCheckedChange={on => toggle("reminders", on)} />
    <label for="pref-reminders" class="flex-1">{i18n.t("settings.reminders.due")}</label>
  </div>

  <div class={[rowClass, "pl-12"]}>
    <label for="pref-lead" class="text-muted-foreground">{i18n.t("settings.reminders.when")}</label>
    <select
      id="pref-lead"
      class={[fieldClass, "flex-1"]}
      value={store.prefs.lead}
      disabled={!store.prefs.reminders}
      onchange={event => void store.savePrefs({ lead: Number(event.currentTarget.value) })}
    >
      {#each LEAD_OPTIONS as minutes (minutes)}
        <option value={minutes}>{leadLabel(minutes)}</option>
      {/each}
    </select>
  </div>

  <div class={rowClass}>
    <Switch id="pref-digest" checked={store.prefs.digest !== null} onCheckedChange={toggleDigest} />
    <label for="pref-digest" class="flex-1">{i18n.t("settings.reminders.digest")}</label>
    <input
      type="time"
      class={fieldClass}
      aria-label={i18n.t("settings.reminders.digestTime")}
      value={store.prefs.digest ?? "09:00"}
      disabled={store.prefs.digest === null}
      onchange={(event) => {
        if (/^\d{2}:\d{2}$/.test(event.currentTarget.value)) {
          void store.savePrefs({ digest: event.currentTarget.value });
        }
      }}
    />
  </div>

  <div class={rowClass}>
    <Switch id="pref-nudges" checked={store.prefs.nudges} onCheckedChange={on => toggle("nudges", on)} aria-describedby="pref-nudges-hint" />
    <div class="flex-1">
      <label for="pref-nudges">{i18n.t("settings.reminders.nudges")}</label>
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
