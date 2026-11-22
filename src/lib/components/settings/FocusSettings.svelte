<script lang="ts">
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import { i18n } from "#i18n";

  import { timerLengths } from "@/lib/prefs/prefs";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  // A length set elsewhere (an imported backup) still shows as chosen.
  const lengths = $derived(timerLengths(store.prefs.timer));
</script>

<fieldset class="flex flex-col">
  <legend class="mb-1 text-[13px] font-bold">{i18n.t("settings.focus.timer")}</legend>
  {#each lengths as length (length)}
    <label class="flex min-h-7 items-center gap-2 text-[13px] font-semibold">
      <input
        type="radio"
        name="pref-timer"
        class="size-4 accent-(--primary)"
        value={length}
        checked={store.prefs.timer === length}
        onchange={() => void store.savePrefs({ timer: length })}
      />
      {i18n.t("focus.minutes", [String(length)])}
    </label>
  {/each}
</fieldset>
