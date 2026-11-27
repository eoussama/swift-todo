import type { TTodo } from "./model";

import { isObject } from "@eoussama/core";
import { customAlphabet } from "nanoid";

import { isOneOf } from "../values";



/** Where a to-do stands: not started, under way, or finished. */
export const STATUSES = ["todo", "doing", "done"] as const;
export type TStatus = (typeof STATUSES)[number];

/** A stage of one's own (like "Review" or "Waiting"), under one of the three statuses. */
export type TStage = {
  id: string;
  name: string;
  status: TStatus;
};

/** Most stages of one's own under each status. */
export const MAX_STAGES_PER_STATUS = 6;
export const MAX_STAGE_NAME_LENGTH = 24;

/** Creates a stage ID, short since every to-do at that stage stores it. */
export const createStageId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

const STAGE_ID_PATTERN = /^[0-9a-z]{1,12}$/;

/**
 * A to-do's stage, as stored: its status, and the stage of one's own it's at,
 * if any (`"doing"`, `"done:k3x9q1"`). The status is written out, so a to-do at
 * a stage deleted since (maybe on another device) still has its status.
 */
const STAGE_VALUE_PATTERN = /^(todo|doing|done)(?::([0-9a-z]{1,12}))?$/;

/**
 * Checks a stored stage value.
 *
 * @param value The value.
 * @returns Whether it is one.
 */
export function isStageValue(value: unknown): value is string {
  return typeof value === "string" && STAGE_VALUE_PATTERN.test(value);
}

function parseValue(stage: string | null): { status: TStatus; id: string | null } | null {
  const match = stage === null ? null : STAGE_VALUE_PATTERN.exec(stage);

  return match === null ? null : { status: match[1] as TStatus, id: match[2] ?? null };
}

/**
 * Tells a to-do's status. Being done wins: a version without stages checks a
 * to-do off (or back on) without touching its stage, which then no longer counts.
 *
 * @param todo The to-do.
 * @returns Its status.
 */
export function statusOf(todo: Pick<TTodo, "done" | "stage">): TStatus {
  const status = parseValue(todo.stage)?.status ?? "todo";

  return todo.done ? "done" : status === "done" ? "todo" : status;
}

/**
 * Finds the stage of one's own a to-do is at.
 *
 * @param todo The to-do.
 * @param stages The stages there are.
 * @returns The stage, or `null` when it's at none (or one that's gone, or no longer fits its status).
 */
export function stageOf(todo: Pick<TTodo, "done" | "stage">, stages: ReadonlyArray<TStage>): TStage | null {
  const value = parseValue(todo.stage);
  const status = statusOf(todo);

  if (value?.id == null || value.status !== status) {
    return null;
  }

  return stages.find(stage => stage.id === value.id && stage.status === status) ?? null;
}

/**
 * Says what to store for a status, and maybe a stage under it.
 *
 * @param status The status.
 * @param stage A stage of one's own under it, or nothing.
 * @returns The fields to save: whether it's done, and its stage.
 */
export function statusFields(status: TStatus, stage: Pick<TStage, "id"> | null = null): Pick<TTodo, "done" | "stage"> {
  // To do and Done, plainly, need no stage: being done (or not) says it.
  return {
    done: status === "done",
    stage: stage !== null ? `${status}:${stage.id}` : status === "doing" ? "doing" : null,
  };
}

/**
 * Cleans up a stage name: single spaces, trimmed and cut to the maximum length.
 *
 * @param name The name as typed.
 * @returns The name; empty when nothing is left.
 */
export function normalizeStageName(name: string): string {
  return Array.from(name.replace(/\s+/gu, " ").trim()).slice(0, MAX_STAGE_NAME_LENGTH).join("").trim();
}

/**
 * Reads the stored stages, skipping malformed or duplicate ones, and any past
 * the limit under a status.
 *
 * @param value The stored value.
 * @returns The stages, in order.
 */
export function parseStages(value: unknown): Array<TStage> {
  const stages: Array<TStage> = [];

  for (const entry of Array.isArray(value) ? value : []) {
    if (!isObject(entry) || typeof entry.id !== "string" || !STAGE_ID_PATTERN.test(entry.id) || !isOneOf(STATUSES, entry.status) || typeof entry.name !== "string") {
      continue;
    }

    const name = normalizeStageName(entry.name);
    const status = entry.status;

    if (name.length > 0 && !stages.some(stage => stage.id === entry.id) && stages.filter(stage => stage.status === status).length < MAX_STAGES_PER_STATUS) {
      stages.push({ id: entry.id, name, status });
    }
  }

  return stages;
}

/**
 * Lists the stages under a status, in order.
 *
 * @param stages Every stage.
 * @param status The status.
 * @returns Its stages.
 */
export function stagesUnder(stages: ReadonlyArray<TStage>, status: TStatus): Array<TStage> {
  return stages.filter(stage => stage.status === status);
}
