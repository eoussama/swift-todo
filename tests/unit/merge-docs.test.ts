import { describe, expect, it } from "vitest";

import { mergeDoc } from "~/lib/todos/merge-docs";

import { createDevice } from "./helpers";



const list = (i: string, n: string) => ({ i, n });

describe("merging lists and settings changed on two devices", () => {
  it("takes this device's value when nothing changed elsewhere or the start isn't known, and merges when sync had nothing at first", () => {
    const mine = [list("a", "Work")];

    expect(mergeDoc("lists", mine, [], [])).toBe(mine);
    expect(mergeDoc("lists", mine, [], undefined)).toBe(mine);
    // Saved while sync was off: this device's lists go over the older copy.
    expect(mergeDoc("lists", mine, undefined, [list("b", "Home")])).toBe(mine);
    // Sync had no lists when this began, and another device has added one since.
    expect(mergeDoc("lists", mine, [], [list("b", "Home")])).toEqual([list("a", "Work"), list("b", "Home")]);
  });

  it("keeps lists added on either side, and drops lists deleted on either side", () => {
    const base = [list("a", "Work"), list("b", "Home"), list("c", "Gym")];
    // Here: renamed Work, deleted Home, added Books.
    const mine = [list("a", "Office"), list("c", "Gym"), list("d", "Books")];
    // There: deleted Gym, renamed Home, added Trips.
    const theirs = [list("a", "Work"), list("b", "House"), list("e", "Trips")];

    expect(mergeDoc("lists", mine, base, theirs)).toEqual([list("a", "Office"), list("d", "Books"), list("e", "Trips")]);
    // A list unchanged here takes the other device's edit.
    expect(mergeDoc("lists", [list("a", "Work")], [list("a", "Work")], [list("a", "Job")])).toEqual([list("a", "Job")]);
    // Malformed entries are skipped.
    expect(mergeDoc("lists", [list("a", "Work"), "junk"], "junk", [{ n: "x" }, list("b", "Home")])).toEqual([list("a", "Work"), list("b", "Home")]);
  });

  it("merges settings key by key, this device's changes first", () => {
    const base = { skin: "notepad", accent: "mint", lead: 0, theme: "system" };
    const mine = { skin: "chalk", accent: "mint", lead: 0 };
    const theirs = { skin: "notepad", accent: "rose", lead: 0, theme: "dark", future: 1 };

    expect(mergeDoc("prefs", mine, base, theirs)).toStrictEqual({ skin: "chalk", accent: "rose", lead: 0, future: 1 });
    // Dropped here (theme back to its default): gone from the result, not set to undefined.
    expect(Object.keys(mergeDoc("prefs", mine, base, theirs) as object)).not.toContain("theme");
    // Sync had no settings when this began: every one saved here counts as changed here.
    expect(mergeDoc("prefs", mine, {}, theirs)).toEqual({ ...theirs, ...mine });
    expect(mergeDoc("prefs", mine, "garbage", theirs)).toEqual({ ...theirs, ...mine });
    expect(mergeDoc("prefs", "garbage", base, theirs)).toBe("garbage");
    expect(mergeDoc("prefs", mine, base, "garbage")).toBe(mine);
  });

  it("keeps a list added on each of two devices before either synced", async () => {
    const laptop = createDevice();
    const phone = createDevice({ sync: laptop.sync });

    await laptop.repository.saveLists([{ id: "work01", name: "Work", emoji: null }]);
    await laptop.repository.flush();

    await laptop.repository.saveLists([{ id: "work01", name: "Work", emoji: null }, { id: "home01", name: "Home", emoji: null }]);
    await phone.repository.saveLists([{ id: "work01", name: "Work", emoji: null }, { id: "trip01", name: "Trips", emoji: "✈️" }]);
    await laptop.repository.flush();
    await phone.repository.flush();

    expect((await laptop.repository.load()).lists.map(item => item.name)).toEqual(["Work", "Trips", "Home"]);
    expect((await phone.repository.load()).lists.map(item => item.name)).toEqual(["Work", "Trips", "Home"]);

    // Two settings changed on two devices both stay.
    await laptop.repository.savePrefs({ skin: "chalk" });
    await phone.repository.savePrefs({ accent: "rose" });
    await laptop.repository.flush();
    await phone.repository.flush();
    expect((await laptop.repository.load()).prefs).toMatchObject({ skin: "chalk", accent: "rose" });
  });
});
