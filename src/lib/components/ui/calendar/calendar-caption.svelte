<script lang="ts">
  import type { DateValue } from "@internationalized/date";
  import { DateFormatter, getLocalTimeZone } from "@internationalized/date";



  const { month, locale }: { month: DateValue; locale: string } = $props();

  const label = $derived(new DateFormatter(locale, { month: "long", year: "numeric" }).format(month.toDate(getLocalTimeZone())));
</script>

<!-- The month shown, like "November 2026". The month and year dropdowns this came with were the browser's own selects, and unused, so they're gone. -->
{label}
