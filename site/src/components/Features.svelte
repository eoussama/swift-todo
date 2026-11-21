<script lang="ts">
  import BellIcon from "@lucide/svelte/icons/bell";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import CloudCheckIcon from "@lucide/svelte/icons/cloud-check";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import KeyboardIcon from "@lucide/svelte/icons/keyboard";
  import MousePointerClickIcon from "@lucide/svelte/icons/mouse-pointer-click";
  import TagsIcon from "@lucide/svelte/icons/tags";
  import TargetIcon from "@lucide/svelte/icons/target";



  const NOTES = [
    { icon: TagsIcon, color: "yellow", title: "Lists and #tags", text: "Tabs for Work, Home, anything, each with an emoji. Tag with #words, and click a tag to see only those." },
    { icon: CalendarClockIcon, color: "mint", title: "Dates and repeats", text: "Every weekday at 9, every 3 days, every month. Check one off and it moves to its next date." },
    { icon: BellIcon, color: "pink", title: "Reminders", text: "A notification when something's due, a daily summary, and a toolbar badge counting what's left. All optional." },
    { icon: TargetIcon, color: "blue", title: "Today and focus", text: "Today gathers what's due. Focus mode shows one to-do at a time, with a timer that keeps going when the popup closes." },
    { icon: MousePointerClickIcon, color: "lilac", title: "From any page", text: "Select text, right-click, “Add to Swift TODO”. Each line becomes a to-do, linked back to its page." },
    { icon: DownloadIcon, color: "yellow", title: "Your data, your way", text: "Export a JSON backup, Markdown or CSV, or copy it as text. Import a backup whenever you like." },
    { icon: KeyboardIcon, color: "mint", title: "Keyboard first", text: "Every action has a key, and it all works with screen readers. Deleted something? Ctrl+Z." },
    { icon: CloudCheckIcon, color: "pink", title: "Synced, privately", text: "Through your browser account, across your devices. No sign-up, no servers, no tracking." },
  ] as const;
</script>

<section id="features" class="section" aria-labelledby="features-title">
  <div class="page">
    <h2 id="features-title" class="title">Small list, <span class="marker">no small features</span></h2>
    <p class="lead">Everything stays one click away, and nothing gets in the way of adding a to-do.</p>

    <ul class="board" role="list" data-reveal>
      {#each NOTES as note, i (note.title)}
        <li class="note {note.color}" style:--tilt="{[-2.2, 1.6, -1, 2.4, -1.8, 1.2, 2, -2.6][i]}deg">
          <note.icon aria-hidden="true" />
          <h3 class="hand">{note.title}</h3>
          <p>{note.text}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .lead {
    margin-top: 16px;
  }

  .board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
    gap: 34px 28px;
    margin-top: 52px;
  }

  .note {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 30px 22px 24px;
    background: var(--note);
    box-shadow: 0 6px 0 color-mix(in srgb, var(--shadow) 22%, transparent), 0 14px 22px -14px color-mix(in srgb, var(--shadow) 45%, transparent);
    transform: rotate(var(--tilt));
    transition: transform 0.25s cubic-bezier(0.2, 0.7, 0.3, 1);
  }

  .note:hover {
    transform: rotate(0deg) translateY(-4px);
  }

  /* A strip of tape holding it to the desk. */
  .note::before {
    position: absolute;
    top: -12px;
    left: calc(50% - 44px);
    width: 88px;
    height: 24px;
    content: "";
    background: var(--tape);
    border: 1px solid color-mix(in srgb, var(--line) 12%, transparent);
    transform: rotate(-3deg);
  }

  .yellow { --note: var(--note-yellow); }
  .mint { --note: var(--note-mint); }
  .pink { --note: var(--note-pink); }
  .blue { --note: var(--note-blue); }
  .lilac { --note: var(--note-lilac); }

  .note :global(svg) {
    width: 30px;
    height: 30px;
    stroke-width: 2.2;
  }

  h3 {
    font-size: 30px;
  }

  p {
    font-size: 16px;
    font-weight: 600;
  }
</style>
