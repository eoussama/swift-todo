import { afterEach, describe, expect, it } from "vitest";

import { atTime } from "~/lib/time/date";
import { parseTodo } from "~/lib/time/parse";
import { anchorRule, baseRule, encodeRule, nextOccurrence, parseRule } from "~/lib/time/recur";
import { TodoStore } from "~/lib/todos/todos.svelte";

import { createDevice } from "./helpers";



describe("monthly repeats on the 29th to the 31st", () => {
  it("reads and writes a rule with its day", () => {
    expect(parseRule("1M@31")).toEqual({ kind: "interval", every: 1, unit: "M", day: 31 });
    expect(parseRule("3M@29")).toEqual({ kind: "interval", every: 3, unit: "M", day: 29 });
    // Only months take a day, and only the days a short month can cut.
    expect(parseRule("12M@31")).toEqual({ kind: "interval", every: 12, unit: "M", day: 31 });
    for (const rule of ["1d@31", "1M@28", "1M@32", "1M@", "M@31", "x1M@31", "1M@31x"]) {
      expect(parseRule(rule)).toBeNull();
    }

    expect(encodeRule({ kind: "interval", every: 1, unit: "M", day: 30 })).toBe("1M@30");
    expect(encodeRule({ kind: "interval", every: 1, unit: "M", day: 15 })).toBe("1M");
    expect(encodeRule({ kind: "interval", every: 1, unit: "M", day: 32 })).toBe("1M");
    expect(encodeRule({ kind: "interval", every: 2, unit: "d", day: 31 })).toBe("2d");
  });

  it("comes back to the 31st after a short month, instead of staying on the 28th", () => {
    const dates: Array<string> = [];
    let due = "2026-01-31";

    for (let month = 0; month < 5; month++) {
      due = nextOccurrence("1M@31", due, new Date(2026, month, 31, 12))!;
      dates.push(due);
    }

    expect(dates).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"]);
    // Without a day, a short month moves it for good, as before.
    expect(nextOccurrence("1M", "2026-02-28", new Date(2026, 1, 28, 12))).toBe("2026-03-28");
    // The 30th in a leap year's February, two months at a time.
    expect(nextOccurrence("2M@30", "2027-12-30T08:15", new Date(2027, 11, 30, 9))).toBe("2028-02-29T08:15");
  });

  it("takes the day from the due date, and keeps it while neither changes", () => {
    expect(anchorRule("1M", "2026-01-31")).toBe("1M@31");
    expect(anchorRule("1M", "2026-01-29T10:00")).toBe("1M@29");
    expect(anchorRule("1M@31", "2026-01-15")).toBe("1M");
    expect(anchorRule("1M", null)).toBe("1M");
    // Other rules are left alone.
    expect(anchorRule("1d", "2026-01-31")).toBe("1d");
    expect(anchorRule(null, "2026-01-31")).toBeNull();
    // Saved again as it is (February's date with the 31st kept), or with the date moved.
    expect(anchorRule("1M", "2026-02-28", { repeat: "1M@31", due: "2026-02-28" })).toBe("1M@31");
    expect(anchorRule("1M", "2026-02-27", { repeat: "1M@31", due: "2026-02-28" })).toBe("1M");
    expect(anchorRule("2M", "2026-02-28", { repeat: "1M@31", due: "2026-02-28" })).toBe("2M");
    expect(baseRule("1M@31")).toBe("1M");
    expect(baseRule("wd")).toBe("wd");
    expect(baseRule(null)).toBeNull();
  });

  it("gets its day when typed, and from the popup's edits but not from checking off", async () => {
    expect(parseTodo("Pay rent every month on jan 31", new Date(2026, 0, 2, 10))).toMatchObject({ due: "2026-01-31", repeat: "1M@31" });

    const device = createDevice();
    const store = new TodoStore(device.repository, { now: () => new Date(2026, 0, 31, 12) });
    const stop = await store.start();
    const bills = (await store.add("Bills", { due: "2026-01-30" }))!;
    const rent = (await store.add("Rent", { due: "2026-01-31", repeat: "1M" }))!;
    const repeatOf = (id: string) => store.todos.find(todo => todo.id === id)!.repeat;

    expect(repeatOf(rent.id)).toBe("1M@31");

    // Without a date, there's no day to keep.
    const loose = (await store.add("Someday", { repeat: "1M" }))!;

    expect(repeatOf(loose.id)).toBe("1M");
    await store.remove(loose.id);

    // A repeat chosen later takes its day from the date already there.
    await store.update(bills.id, { repeat: "2M" });
    expect(repeatOf(bills.id)).toBe("2M@30");
    // Each to-do's own rule and date count, not another's.
    await store.update(rent.id, { due: "2026-01-29" });
    expect(repeatOf(rent.id)).toBe("1M@29");
    await store.update(rent.id, { due: "2026-01-31" });
    await store.remove(bills.id);

    // Checked off: February's last day, still remembering the 31st.
    // An unknown to-do is refused by the repository as usual.
    await store.update("missing", { due: "2026-01-31" });
    expect(store.error).toMatchObject({ code: "not-found" });
    await store.toggle(rent.id);
    expect(store.todos[0]).toMatchObject({ due: "2026-02-28", repeat: "1M@31" });

    // Edited without touching the date or the rule: the day stays.
    await store.update(rent.id, { text: "Pay rent", due: "2026-02-28", repeat: "1M" });
    expect(store.todos[0]).toMatchObject({ text: "Pay rent", repeat: "1M@31" });

    // Moved to the 10th by hand: it repeats on the 10th.
    await store.update(rent.id, { due: "2026-02-10" });
    expect(store.todos[0]!.repeat).toBe("1M");

    // A text edit alone doesn't touch the rule.
    await store.update(rent.id, { text: "Rent" });
    expect(store.todos[0]!.repeat).toBe("1M");
    stop();
  });
});

describe("times that daylight saving skips", () => {
  const zone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = zone;
  });

  it("keeps 2:30 on the night clocks go forward, and the night after", () => {
    process.env.TZ = "America/New_York";

    // Clocks went from 2:00 to 3:00 on 2026-03-08 there.
    expect(atTime(new Date(2026, 2, 8), 2, 30)).toBe("2026-03-08T02:30");
    expect(nextOccurrence("1d", "2026-03-07T02:30", new Date(2026, 2, 7, 12))).toBe("2026-03-08T02:30");
    expect(nextOccurrence("1d", "2026-03-08T02:30", new Date(2026, 2, 8, 12))).toBe("2026-03-09T02:30");
    expect(nextOccurrence("w:1", "2026-03-02T02:30", new Date(2026, 2, 2, 12))).toBe("2026-03-09T02:30");
    expect(parseTodo("Feed the cat tomorrow at 2:30am", new Date(2026, 2, 7, 10)).due).toBe("2026-03-08T02:30");
    expect(parseTodo("Feed the cat at 2:30am", new Date(2026, 2, 7, 10)).due).toBe("2026-03-08T02:30");
  });
});

describe("keeping a monthly repeat's day through undo and edits", () => {
  it("keeps the day when the date stands for it, and takes the date's own day otherwise", () => {
    // Undo of a check-off: back to February's last day, still the 31st.
    expect(anchorRule("1M@31", "2027-02-28", { repeat: "1M@31", due: "2027-03-31" })).toBe("1M@31");
    // A time added on February's last day.
    expect(anchorRule("1M", "2027-02-28T09:00", { repeat: "1M@31", due: "2027-02-28" })).toBe("1M@31");
    expect(anchorRule("1M@30", "2028-02-29")).toBe("1M@30");
    // Moved by hand to another day: that day.
    expect(anchorRule("1M", "2027-02-27", { repeat: "1M@31", due: "2027-02-28" })).toBe("1M");
    expect(anchorRule("1M", "2027-03-28", { repeat: "1M@31", due: "2027-02-28" })).toBe("1M");
    expect(anchorRule("1M@31", "2027-03-30")).toBe("1M@30");
    // Another rule doesn't inherit the day.
    expect(anchorRule("2M", "2027-02-28T09:00", { repeat: "1M@31", due: "2027-02-28" })).toBe("2M");
    expect(anchorRule("1M@31", null, { repeat: "1M@31", due: "2027-02-28" })).toBe("1M");
    expect(anchorRule("1M", "2027-02-28", { repeat: null, due: null })).toBe("1M");
  });

  it("leaves a rule changed on another device alone when only the text or the date is edited", async () => {
    const laptop = createDevice();
    const phone = createDevice({ sync: laptop.sync });
    const plants = await laptop.repository.add("Water plants", { due: "2027-01-10", repeat: "1d" });

    await laptop.repository.flush();

    const store = new TodoStore(laptop.repository);
    const stop = await store.start();

    // The phone stops the repeat; the laptop's popup hasn't caught up yet.
    phone.clock.now += 1_000;
    await phone.repository.update(plants.id, { repeat: null });
    await phone.repository.flush();
    laptop.clock.now += 2_000;
    await store.update(plants.id, { text: "Water the plants" });

    expect((await laptop.repository.load()).todos[0]).toMatchObject({ text: "Water the plants", repeat: null });

    // Nor when only the date is moved and the rule's day doesn't change.
    await laptop.repository.flush();
    phone.clock.now = laptop.clock.now + 10_000;
    await phone.repository.update(plants.id, { repeat: "2d" });
    await phone.repository.flush();
    laptop.clock.now = phone.clock.now + 1_000;
    await store.update(plants.id, { due: "2027-01-12" });
    expect((await laptop.repository.load()).todos[0]).toMatchObject({ due: "2027-01-12", repeat: "2d" });
    stop();
  });

  it("keeps a stored day when only the text is edited, even off its date", async () => {
    const { repository } = createDevice();
    // As another device may leave it: the 31st, due on the 15th.
    const rent = await repository.add("Pay rent", { due: "2027-03-15", repeat: "1M@31" });
    const store = new TodoStore(repository);
    const stop = await store.start();

    await store.update(rent.id, { text: "Pay the rent" });

    expect((await repository.load()).todos[0]).toMatchObject({ text: "Pay the rent", repeat: "1M@31" });
    stop();
  });
});

describe("tonight, typed after midnight", () => {
  it("is the night still going on for the small hours, and the coming one for the rest", () => {
    const late = new Date(2026, 10, 22, 0, 30);

    expect(parseTodo("Sleep tonight at 2", late).due).toBe("2026-11-22T02:00");
    expect(parseTodo("Sleep tonight at 1am", late).due).toBe("2026-11-22T01:00");
    expect(parseTodo("Party tonight at 11pm", late).due).toBe("2026-11-22T23:00");
    // Midnight is the end of the coming night.
    expect(parseTodo("Party tonight at midnight", late).due).toBe("2026-11-23T00:00");
    // Already gone this night: the coming one.
    expect(parseTodo("Party tonight at 2", new Date(2026, 10, 22, 2, 30)).due).toBe("2026-11-23T02:00");
    expect(parseTodo("Party tonight at 1am", new Date(2026, 10, 22, 3, 0)).due).toBe("2026-11-23T01:00");
    // Another day's time typed early isn't moved to the night before.
    expect(parseTodo("Call tomorrow at 9:30", new Date(2026, 10, 21, 8, 0)).due).toBe("2026-11-22T09:30");
    // On the 24-hour clock, the hour says which half of the day it is.
    expect(parseTodo("Flight tonight at 04:30", new Date(2026, 10, 21, 20, 0)).due).toBe("2026-11-22T04:30");
    expect(parseTodo("Flight tonight at 16:30", new Date(2026, 10, 21, 12, 0)).due).toBe("2026-11-21T16:30");
    // From 6 on, it's the evening ahead again.
    expect(parseTodo("Sleep tonight at 2", new Date(2026, 10, 22, 6, 0)).due).toBe("2026-11-23T02:00");
  });
});
