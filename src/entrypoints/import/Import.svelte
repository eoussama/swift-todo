<!-- Firefox imports here, in a tab, because a file picker can close the popup. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "#i18n";
  import { useAppearance } from "@/lib/appearance.svelte";

  import ImportPanel from "@/lib/components/settings/ImportPanel.svelte";
  import { Toaster } from "@/lib/components/ui/sonner";
  import { errorMessage } from "@/lib/messages";
  import { toast } from "@/lib/toast";
  import { createTodoRepository } from "@/lib/todos/sync-repository";
  import { TodoStore } from "@/lib/todos/todos.svelte";



  const store = new TodoStore(createTodoRepository());

  const appearance = useAppearance(store);

  let done = $state(false);

  onMount(() => {
    let stop: (() => void) | undefined;

    void store.start().then((unsubscribe) => {
      stop = unsubscribe;
    });

    return () => stop?.();
  });

  $effect(() => {
    const error = store.error;

    if (error !== null) {
      toast.error(errorMessage(error));
      store.dismissError();
    }
  });
</script>

<div class="desk flex min-h-screen items-start justify-center p-6">
  <main class="bg-sheet w-full max-w-md rounded-lg border-2 border-border p-5 shadow-sticker">
    <h1 class="mb-3 font-hand text-[32px] leading-none font-bold">{i18n.t("settings.data.importTitle")}</h1>
    <ImportPanel {store} ondone={() => (done = true)} />
    {#if done}
      <p class="mt-3 text-[13px] font-bold" role="status">{i18n.t("settings.data.importDone")}</p>
    {/if}
  </main>
</div>

<Toaster position="bottom-center" theme={appearance.theme} />
