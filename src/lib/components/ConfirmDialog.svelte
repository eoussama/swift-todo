<script lang="ts">
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";



  type Props = {
    open: boolean;
    title: string;
    description: string;
    /** The button that goes ahead, named for what it does ("Erase all"). */
    confirm: string;
    /** Red, for what can't simply be taken back. */
    destructive?: boolean;
    onconfirm: () => void;
  };

  let { open = $bindable(false), title, description, confirm, destructive = false, onconfirm }: Props = $props();
</script>

<!-- Asks before doing something to many to-dos at once. Cancel has the focus, so Enter is safe. -->
<Dialog.Root bind:open>
  <Dialog.Content class="w-[320px] gap-3 bg-sheet p-3" showCloseButton={false}>
    <Dialog.Header class="gap-1 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{title}</Dialog.Title>
      <Dialog.Description class="text-[13px] font-semibold text-muted-foreground">{description}</Dialog.Description>
    </Dialog.Header>

    <Dialog.Footer class="-mx-3 -mb-3 flex-row justify-end gap-2 rounded-b-md p-3">
      <Dialog.Close>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" size="sm">{i18n.t("schedule.cancel")}</Button>
        {/snippet}
      </Dialog.Close>
      <Button
        variant={destructive ? "destructive" : "default"}
        size="sm"
        class={destructive ? "border-destructive bg-destructive-soft text-destructive" : ""}
        onclick={() => {
          open = false;
          onconfirm();
        }}
      >
        {confirm}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
