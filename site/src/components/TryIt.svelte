<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";

  import { addDays, startOfDay, toDue } from "@/lib/time/date";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { parseTodo } from "@/lib/time/parse";
  import { nextOccurrence } from "@/lib/time/recur";
  import { segmentText } from "@/lib/todos/tags";

  import Logo from "./Logo.svelte";



  type TDemoTodo = { id: number; text: string; due: string | null; repeat: string | null; done: boolean };

  const EXAMPLES = [
    "Call Sam tomorrow 6pm",
    "Water the plants every 3 days #home",
    "Standup every weekday at 9am #work",
    "Gym every mon, wed, fri at 7am",
    "Take out the trash tonight",
  ];

  const MAX_TODOS = 7;

  // The moment the demo runs at; dates appear once the page knows it, so the built page and the browser agree.
  let now = $state<Date | null>(null);
  let todos = $state<Array<TDemoTodo>>(starters(null));
  let nextId = 10;
  let value = $state("");
  let input = $state<HTMLInputElement | null>(null);
  let typing: ReturnType<typeof setInterval> | undefined;
  let celebrations = $state(0);
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const parsed = $derived(now === null ? null : parseTodo(value, now));
  const understood = $derived(parsed !== null && value.trim() !== "" && (parsed.due !== null || parsed.repeat !== null));
  const ordered = $derived([...todos.filter(todo => !todo.done), ...todos.filter(todo => todo.done)]);
  const done = $derived(todos.filter(todo => todo.done).length);
  const allDone = $derived(todos.length > 0 && done === todos.length);
  const summary = $derived(todos.length === 0 ? "A fresh page" : allDone ? "All done!" : `${done} of ${todos.length} done`);

  function starters(today: Date | null): Array<TDemoTodo> {
    const day = today === null ? null : startOfDay(today);

    return [
      { id: 1, text: "Send the quarterly report #work", due: day === null ? null : toDue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 15), true), repeat: null, done: false },
      { id: 2, text: "Renew passport", due: day === null ? null : toDue(addDays(day, -2), false), repeat: null, done: false },
      { id: 3, text: "Read chapter 4 #reading", due: null, repeat: null, done: false },
    ];
  }

  onMount(() => {
    now = new Date();
    todos = starters(now);

    return () => {
      clearInterval(typing);
      clearTimeout(toastTimer);
    };
  });

  function reducedMotion(): boolean {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Types an example into the input, a letter at a time, so the chip can be seen reading it.
  function tryExample(text: string): void {
    clearInterval(typing);
    input?.focus();

    if (reducedMotion()) {
      value = text;

      return;
    }

    let length = 0;

    value = "";
    typing = setInterval(() => {
      length++;
      value = text.slice(0, length);

      if (length >= text.length) {
        clearInterval(typing);
      }
    }, 38);
  }

  function add(event: SubmitEvent): void {
    event.preventDefault();
    clearInterval(typing);

    if (parsed === null || value.trim() === "") {
      return;
    }

    const text = parsed.text.trim() === "" ? value.trim() : parsed.text.trim();
    const kept = todos.length < MAX_TODOS ? todos : dropOne(todos);

    todos = [{ id: nextId++, text, due: parsed.due, repeat: parsed.repeat, done: false }, ...kept];
    value = "";
  }

  // Makes room: the oldest done to-do goes first, else the oldest open one.
  function dropOne(list: Array<TDemoTodo>): Array<TDemoTodo> {
    const index = list.findLastIndex(todo => todo.done);

    return list.filter((_, i) => i !== (index === -1 ? list.length - 1 : index));
  }

  function toggle(todo: TDemoTodo, box: HTMLInputElement): void {
    if (now === null) {
      return;
    }

    // A repeating to-do moves to its next date instead, as in the extension, and stays open.
    if (!todo.done && todo.repeat !== null) {
      const next = nextOccurrence(todo.repeat, todo.due, new Date());

      if (next !== null) {
        todo.due = next;
        box.checked = false;
        showToast(`Next: ${formatDue(next, now).label}`);

        return;
      }
    }

    todo.done = !todo.done;

    if (allDone) {
      celebrations++;
    }
  }

  function showToast(message: string): void {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 2600);
  }

  function reset(): void {
    clearInterval(typing);
    value = "";
    todos = starters(now);
  }

  const COLORS = ["var(--mint)", "var(--pencil)", "var(--eraser)", "#7cc7f2"];
  const PIECES = 30;
  const confetti = Array.from({ length: PIECES }, (_, i) => {
    const angle = Math.PI * (0.06 + 0.88 * (i / (PIECES - 1))) + ((i % 3) - 1) * 0.06;
    const distance = 90 + ((i * 53) % 150);

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.9 + 20,
      r: ((i * 97) % 360) - 180,
      delay: (i % 6) * 30,
      color: COLORS[i % COLORS.length],
      round: i % 3 === 0,
    };
  });
</script>

<section id="try" class="section" aria-labelledby="try-title">
  <div class="page grid">
    <div class="copy" data-reveal="left">
      <h2 id="try-title" class="title">Just <span class="marker">type it</span></h2>
      <p class="lead">
        Dates and repeats are read as you type, and a chip shows what was understood before you press <kbd>Enter</kbd>.
        This is the extension's own parser. Try one:
      </p>

      <ul class="examples" role="list">
        {#each EXAMPLES as example, i (example)}
          <li style:--i={i}><button type="button" class="example" onclick={() => tryExample(example)}>{example}</button></li>
        {/each}
      </ul>

      <p class="hint">Then check them all off. Something might happen.</p>
    </div>

    <div class="stage" data-reveal="right">
      <div class="popup" role="region" aria-label="Swift TODO demo">
        <div class="head">
          <Logo size={30} />
          <span class="hand app">Swift TODO</span>
          <span class={["hand", "summary", allDone && "cheer"]} aria-live="polite">{summary}</span>
        </div>

        <div class="progress" aria-hidden="true">
          <span class="eraser"></span>
          <span class="band"></span>
          <span class="track">
            <span class="body" style:width="calc(18px + (100% - 18px) * {todos.length === 0 ? 0 : done / todos.length})">
              <span class="wood"></span>
            </span>
          </span>
        </div>

        <div class="sheet">
          <form class="new" onsubmit={add}>
            <PencilLineIcon class="pen" aria-hidden="true" />
            <label class="visually-hidden" for="demo-input">New to-do</label>
            <input
              id="demo-input"
              bind:this={input}
              bind:value
              class="hand"
              placeholder="Write a to-do…"
              autocomplete="off"
              maxlength="120"
              oninput={() => clearInterval(typing)}
            />
            <button type="submit" class="add" disabled={value.trim() === ""} aria-label="Add" title="Add">
              <PlusIcon strokeWidth={3} />
            </button>

            {#if understood && parsed !== null && now !== null}
              <div class="chip understood" role="status">
                <span class="visually-hidden">Understood as</span>
                {#if parsed.due !== null}
                  <CalendarIcon aria-hidden="true" />
                  <span>{formatDue(parsed.due, now).label}</span>
                {/if}
                {#if parsed.repeat !== null}
                  <RepeatIcon aria-hidden="true" />
                  <span>{formatRule(parsed.repeat)}</span>
                {/if}
              </div>
            {/if}
          </form>

          <ul class="rows" role="list" aria-label="To-dos">
            {#each ordered as todo (todo.id)}
              {@const due = todo.due === null || now === null ? null : formatDue(todo.due, now)}
              <li class={["row", todo.done && "done"]} animate:flip={{ duration: 260 }}>
                <label class="box">
                  <input type="checkbox" checked={todo.done} onchange={event => toggle(todo, event.currentTarget)} aria-labelledby="demo-{todo.id}" />
                  <span class="fake" aria-hidden="true">
                    {#if todo.done}
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12.8l4.3 4.2L19.2 7" pathLength="1" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    {/if}
                  </span>
                </label>

                <div class="text">
                  <span id="demo-{todo.id}" class="words">
                    {#each segmentText(todo.text) as segment, i (i)}
                      {#if segment.kind === "tag"}
                        <span class="tag">{segment.value}</span>
                      {:else}
                        {segment.value}
                      {/if}
                    {/each}
                  </span>
                  {#if due !== null && !todo.done}
                    <span class={["chip", "due", due.overdue ? "overdue" : due.soon && "soon"]}>
                      <CalendarIcon aria-hidden="true" />
                      {due.label}
                      {#if todo.repeat !== null}
                        <RepeatIcon aria-label={formatRule(todo.repeat)} />
                      {/if}
                    </span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>

          {#if toast !== null}
            <p class="toast" role="status">{toast}</p>
          {/if}
        </div>

        <div class="foot">
          <button type="button" class="reset" onclick={reset}>
            <RotateCcwIcon aria-hidden="true" />
            Start over
          </button>
        </div>

        {#key celebrations}
          {#if celebrations > 0}
            <div class="confetti" aria-hidden="true">
              {#each confetti as piece, i (i)}
                <span
                  class={["piece", piece.round && "round"]}
                  style:background={piece.color}
                  style:--x="{piece.x}px"
                  style:--y="{piece.y}px"
                  style:--r="{piece.r}deg"
                  style:animation-delay="{piece.delay}ms"
                ></span>
              {/each}
            </div>
          {/if}
        {/key}
      </div>
    </div>
  </div>
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 440px);
    gap: clamp(32px, 6vw, 88px);
    align-items: center;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .example {
    padding: 8px 14px;
    font-size: 15px;
    font-weight: 800;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 999px;
    box-shadow: 0 3px 0 var(--shadow);
    transition: transform 0.12s, box-shadow 0.12s, background-color 0.12s;
  }

  :global(.js) .copy:global([data-shown]) .examples li {
    animation: pop 0.45s calc(0.3s + var(--i) * 0.07s) backwards;
  }

  .example:hover {
    background: var(--chip);
  }

  .example:active {
    transform: translateY(3px);
    box-shadow: 0 0 0 var(--shadow);
  }

  .hint {
    font-family: var(--font-hand);
    font-size: 26px;
    font-weight: 700;
    color: var(--muted);
    transform: rotate(-1.5deg);
  }

  /* The popup, as the Notepad skin draws it. */
  .popup {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 14px 10px;
    background: var(--desk) radial-gradient(var(--desk-dots) 1px, transparent 1.2px) 0 0 / 14px 14px;
    border: 3px solid var(--line);
    border-radius: 20px;
    box-shadow: 0 10px 0 var(--shadow);
    transform: rotate(1.2deg);
  }

  .head {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-inline: 4px;
  }

  .app {
    font-size: 25px;
  }

  .summary {
    margin-left: auto;
    font-size: 21px;
    white-space: nowrap;
  }

  .summary.cheer {
    color: color-mix(in srgb, var(--mint) 55%, var(--fg));
    animation: pop 0.5s both;
  }

  .progress {
    display: flex;
    align-items: center;
    height: 18px;
    padding-inline: 4px;
  }

  .eraser {
    width: 12px;
    height: 100%;
    background: var(--eraser);
    border: 2px solid var(--line);
    border-right: 0;
    border-radius: 6px 0 0 6px;
  }

  .band {
    width: 8px;
    height: 100%;
    background: var(--ferrule);
    border: 2px solid var(--line);
  }

  .track {
    position: relative;
    flex: 1;
    height: 100%;
    background: linear-gradient(to right, color-mix(in srgb, var(--line) 30%, transparent) 50%, transparent 50%) 0 50% / 10px 2px repeat-x;
  }

  .body {
    position: absolute;
    inset-block: 0;
    left: 0;
    display: flex;
    justify-content: flex-end;
    background: var(--pencil) linear-gradient(transparent 38%, rgb(0 0 0 / 0.09) 38% 62%, transparent 62%);
    border-block: 2px solid var(--line);
    transition: width 0.5s ease-out;
  }

  .wood {
    width: 0;
    height: 0;
    margin-top: -2px;
    margin-right: -16px;
    border-block: 9px solid transparent;
    border-left: 16px solid var(--wood);
    filter: drop-shadow(1px 0 0 var(--line));
  }

  .sheet {
    position: relative;
    min-height: 330px;
    overflow: hidden;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 6px;
    box-shadow: 4px 4px 0 var(--shadow);
  }

  /* The red margin line. */
  .sheet::before {
    position: absolute;
    inset-block: 0;
    left: 44px;
    z-index: 1;
    width: 2px;
    content: "";
    background: var(--margin-line);
  }

  .new {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 52px;
    padding: 6px 8px 6px 12px;
    background: var(--note-yellow);
    border-bottom: 2px solid var(--line);
  }

  .new :global(.pen) {
    width: 20px;
    height: 20px;
    flex: none;
    color: var(--muted);
  }

  .new input {
    flex: 1;
    min-width: 0;
    padding: 4px 0 4px 16px;
    font-size: 23px;
    background: transparent;
    border: 0;
  }

  .new input::placeholder {
    color: var(--muted);
  }

  .new input:focus-visible {
    border-radius: 6px;
  }

  .add {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    color: #242c88;
    background: var(--pencil);
    border: 2px solid var(--line);
    border-radius: 50%;
    box-shadow: 0 2px 0 var(--shadow);
    transition: opacity 0.2s, transform 0.2s;
  }

  .add:disabled {
    opacity: 0.45;
    transform: scale(0.9);
    cursor: default;
  }

  .add :global(svg) {
    width: 18px;
    height: 18px;
  }

  .chip {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 1px 8px;
    font-size: 12.5px;
    font-weight: 800;
    line-height: 20px;
    white-space: nowrap;
    border-radius: 999px;
  }

  .chip :global(svg) {
    width: 13px;
    height: 13px;
  }

  .understood {
    position: absolute;
    top: calc(100% + 6px);
    left: 52px;
    z-index: 3;
    background: var(--sheet);
    border: 2px solid var(--line);
    box-shadow: 0 2px 0 var(--shadow);
    animation: pop 0.3s both;
  }

  .rows {
    position: relative;
  }

  .row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    min-height: 46px;
    padding: 11px 12px 9px 10px;
    background: var(--sheet);
    border-bottom: 1px solid var(--rule);
  }

  .box {
    position: relative;
    flex: none;
    width: 22px;
    height: 22px;
  }

  .box input {
    position: absolute;
    inset: -8px;
    width: calc(100% + 16px);
    height: calc(100% + 16px);
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .fake {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    color: #242c88;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 5px;
    pointer-events: none;
    transition: background-color 0.15s, transform 0.15s;
  }

  .row:not(.done) .box:hover .fake {
    background: var(--tag);
  }

  .box:active .fake {
    transform: scale(0.9);
  }

  .box input:focus-visible + .fake {
    outline: 2px solid var(--line);
    outline-offset: 2px;
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--pencil-deep) 70%, transparent);
  }

  .done .fake {
    background: var(--mint);
  }

  .fake svg {
    width: 16px;
    height: 16px;
  }

  .fake path {
    stroke-dasharray: 1;
    animation: draw 0.3s ease-out both;
  }

  .text {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
    min-width: 0;
    padding-left: 12px;
    font-size: 15px;
    font-weight: 700;
    line-height: 22px;
    overflow-wrap: anywhere;
  }

  .done .words {
    color: var(--muted);
    text-decoration: line-through 2px color-mix(in srgb, var(--line) 70%, transparent);
  }

  .tag {
    padding: 0 6px;
    font-size: 13px;
    font-weight: 800;
    background: var(--tag);
    border-radius: 6px;
  }

  .due {
    background: var(--tag);
    animation: pop 0.3s both;
  }

  .due.soon {
    background: var(--chip);
  }

  .due.overdue {
    color: var(--overdue-fg);
    background: var(--overdue);
  }

  .toast {
    position: absolute;
    bottom: 12px;
    left: 50%;
    z-index: 3;
    padding: 6px 14px;
    font-size: 14px;
    font-weight: 800;
    white-space: nowrap;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 999px;
    box-shadow: 0 3px 0 var(--shadow);
    transform: translateX(-50%);
    animation: pop 0.3s both;
  }

  .foot {
    display: flex;
    justify-content: flex-end;
  }

  .reset {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 4px 10px;
    font-size: 14px;
    font-weight: 800;
    background: transparent;
    border: 0;
    border-radius: 8px;
  }

  .reset:hover {
    background: color-mix(in srgb, var(--sheet) 60%, transparent);
  }

  .reset :global(svg) {
    width: 15px;
    height: 15px;
  }

  .confetti {
    position: absolute;
    top: 40px;
    left: 50%;
    z-index: 5;
    pointer-events: none;
  }

  .piece {
    position: absolute;
    width: 7px;
    height: 11px;
    border: 1.5px solid var(--line);
    border-radius: 1px;
    animation: burst 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both;
  }

  .piece.round {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .stage {
      width: 100%;
      max-width: 440px;
      margin-inline: auto;
    }

    .popup {
      transform: none;
    }
  }
</style>
