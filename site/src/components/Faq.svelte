<script lang="ts">
  import { ISSUES } from "../links";



  const QUESTIONS = [
    ["Is it really free?", "Yes. Swift TODO is open source under the MIT license, with no ads, no paid tier and nothing to sign up for."],
    ["Where are my to-dos kept?", "In your browser's extension storage, synced by the browser through your account (your Google account in Chrome, Microsoft account in Edge, Mozilla account in Firefox). Nothing is sent anywhere else."],
    ["Can I move my list from one browser to another?", "Browser sync stays within one browser, so Chrome and Firefox don't share a list. Export a JSON backup in Settings, then import it in the other browser."],
    ["How many to-dos can I have?", "As many as you like. Browser sync holds a few hundred; past that, new to-dos stay on the device, and you choose which ones sync."],
    ["Why does it ask to show notifications?", "Only if you turn on reminders, the daily summary or nudges. Until then it never asks, and the rest works without it."],
    ["Does it work in Brave, Vivaldi or Opera?", "They run Chrome extensions, so the Chrome version should work there too. Firefox needs version 140 or later."],
    ["Can I change the keyboard shortcut?", "Yes: in chrome://extensions/shortcuts, edge://extensions/shortcuts, or in Firefox under Add-ons and themes → ⚙ → Manage Extension Shortcuts."],
  ] as const;
</script>

<section id="faq" class="section" aria-labelledby="faq-title">
  <div class="page narrow">
    <h2 id="faq-title" class="title">Questions, <span class="marker">answered</span></h2>

    <div class="list" data-reveal="group">
      {#each QUESTIONS as [question, answer], i (question)}
        <details style:--i={i}>
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

  :global(.js) .list:not([data-shown]) details {
    opacity: 0;
  }

  :global(.js) .list:global([data-shown]) details {
    animation: rise 0.6s calc(var(--i) * 0.07s) cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
  }

  details[open] p {
    animation: rise 0.35s ease-out;
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

  details[open] summary::after {
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
