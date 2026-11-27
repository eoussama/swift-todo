<script lang="ts">
  import { prefersReducedMotion } from "svelte/motion";

  import { ISSUES } from "../links";



  const QUESTIONS = [
    ["Is it really free?", "Yes. Swift TODO is open source under the MIT license, with no ads, no paid tier and nothing to sign up for."],
    ["Where are my to-dos kept?", "In your browser's extension storage, synced by the browser through your account (your Google account in Chrome, Microsoft account in Edge, Mozilla account in Firefox). Files and screenshots you attach stay on the device they were added on, and aren't synced. Nothing is sent anywhere else."],
    ["Can I move my list from one browser to another?", "Browser sync stays within one browser, so Chrome and Firefox don't share a list. Export a JSON backup in Settings, then import it in the other browser. Attachments stay behind: backups hold to-dos, lists and settings, not files."],
    ["How many to-dos can I have?", "As many as you like. Browser sync holds a few hundred; past that, new to-dos stay on the device, and you choose which ones sync."],
    ["Why does it ask to show notifications?", "Only if you turn on reminders, the daily summary or nudges. Until then it never asks, and the rest works without it."],
    ["Does it work in Brave, Vivaldi or Opera?", "They run Chrome extensions, so the Chrome version should work there too. Firefox needs version 140 or later."],
    ["Can I change the keyboard shortcut?", "Yes: in chrome://extensions/shortcuts, edge://extensions/shortcuts, or in Firefox under Add-ons and themes → ⚙ → Manage Extension Shortcuts."],
  ] as const;

  const DURATION = 280;
  const EASING = "cubic-bezier(0.2, 0.7, 0.3, 1)";

  /**
   * Opens and closes a question by sliding its height, instead of snapping.
   * Without JavaScript, or with reduced motion, it toggles as usual.
   *
   * @param details The question.
   * @returns The action's cleanup.
   */
  function slide(details: HTMLDetailsElement): { destroy: () => void } {
    const summary = details.querySelector("summary")!;
    let running: Animation | null = null;

    const onclick = (event: MouseEvent): void => {
      if (prefersReducedMotion.current) {
        return;
      }

      event.preventDefault();

      // From wherever it is now, even mid-slide.
      const from = details.getBoundingClientRect().height;
      const closing = details.open && !details.classList.contains("closing");

      running?.cancel();
      details.classList.toggle("closing", closing);
      details.open = true;

      const borders = details.offsetHeight - details.clientHeight;
      const to = closing ? summary.offsetHeight + borders : details.scrollHeight + borders;

      details.style.overflow = "hidden";
      running = details.animate({ height: [`${from}px`, `${to}px`] }, { duration: DURATION, easing: EASING });
      running.onfinish = () => {
        running = null;
        details.style.overflow = "";
        details.open = !closing;
        details.classList.remove("closing");
      };
    };

    summary.addEventListener("click", onclick);

    return { destroy: () => summary.removeEventListener("click", onclick) };
  }
</script>

<section id="faq" class="section" aria-labelledby="faq-title">
  <div class="page narrow">
    <h2 id="faq-title" class="title">Questions, <span class="marker">answered</span></h2>

    <div class="list" data-reveal="group">
      {#each QUESTIONS as [question, answer], i (question)}
        <details style:--i={i} use:slide>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      {/each}
    </div>

    <p class="more">Something else? <a href={ISSUES} target="_blank" rel="noopener noreferrer">Ask on GitHub</a>.</p>
  </div>
</section>

<style>
  .narrow {
    max-width: 820px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 40px;
  }

  details {
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 4px 0 var(--shadow);
  }

  :global(.js) .list:global([data-shown]) details {
    animation: rise 0.6s calc(var(--i) * 0.07s) cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
  }


  summary {
    position: relative;
    padding: 16px 52px 16px 20px;
    font-size: 18px;
    font-weight: 800;
    list-style: none;
    border-radius: 12px;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  /* A plus that turns into a cross. */
  summary::after {
    position: absolute;
    top: 50%;
    right: 18px;
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    content: "+";
    transform: translateY(-50%);
    transition: transform 0.2s;
  }

  details[open]:not(:global(.closing)) summary::after {
    transform: translateY(-50%) rotate(45deg);
  }

  details p {
    padding: 0 20px 18px;
    font-weight: 600;
    color: var(--muted);
  }

  .more {
    margin-top: 28px;
    font-weight: 700;
  }

  .more a {
    font-weight: 800;
  }
</style>
