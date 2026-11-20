import { describe, expect, it } from "vitest";

import { planMove, positionAfter } from "~/lib/todos/ordering";



type TItem = { id: string; position: string };

function apply(list: Array<TItem>, moves: Map<string, string>): Array<string> {
  return list
    .map(item => ({ ...item, position: moves.get(item.id) ?? item.position }))
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
    .map(item => item.id);
}

function build(ids: Array<string>): Array<TItem> {
  const list: Array<TItem> = [];

  for (const id of ids) {
    list.push({ id, position: positionAfter(list.at(-1)?.position ?? null) });
  }

  return list;
}

describe("planMove", () => {
  const list = build(["a", "b", "c", "d"]);

  it.each([
    ["a", 3, ["b", "c", "d", "a"]],
    ["d", 0, ["d", "a", "b", "c"]],
    ["b", 2, ["a", "c", "b", "d"]],
    ["c", 1, ["a", "c", "b", "d"]],
  ])("moves %s to index %i with a single change", (id, to, expected) => {
    const moves = planMove(list, id, to);

    expect(moves.size).toBe(1);
    expect(apply(list, moves)).toEqual(expected);
  });

  it("does nothing when the item stays put or doesn't exist", () => {
    expect(planMove(list, "b", 1).size).toBe(0);
    expect(planMove(list, "z", 0).size).toBe(0);
  });

  it("clamps the target index", () => {
    expect(apply(list, planMove(list, "a", 99))).toEqual(["b", "c", "d", "a"]);
  });

  it("spreads out tied positions when moving between them", () => {
    const tied: Array<TItem> = [
      { id: "a", position: "a0" },
      { id: "b", position: "a1" },
      { id: "c", position: "a1" },
      { id: "d", position: "a2" },
    ];
    // Index 1 lands between "b" and "c", which share a position.
    const moves = planMove(tied, "a", 1);
    const order = apply(tied, moves);

    expect(moves.size).toBeGreaterThan(1);
    expect(order).toEqual(["b", "a", "c", "d"]);
    expect(new Set(order.map(id => moves.get(id) ?? tied.find(item => item.id === id)!.position)).size).toBe(4);
  });
});
