<script lang="ts">
  import icon from "@/assets/icon.svg";



  type Props = { size?: number };

  const { size = 40 }: Props = $props();
</script>

<img src={icon} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" />

<style>
  img {
    flex: none;
    transform: rotate(-6deg);
    filter: drop-shadow(0 2px 0 var(--shadow));
  }
</style>
