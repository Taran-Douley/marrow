import type { Level, Timing } from '../level';
import type { Speed } from '../types';

export interface ProofResult {
  /** Number in tech.md's property list. Your own properties should use 100 or more. */
  id: number;
  name: string;
  pass: boolean;
  /** How many places broke this property. */
  failures: number;
  /** Plain-English reason for the first failure. Present only when pass is false. */
  counterexample?: string;
  /** Every failure, in the same plain English, for tools and reports. Present only when pass is false. */
  counterexamples?: string[];
}

/** What the proof needs to know about an object type. Registry entries fit this. */
export interface ObjectInfo {
  name: string;
  say?: string;
  caption?: string;
  sound?: { hz: number; wave: string };
}

export interface ObjectSource {
  get(name: string): ObjectInfo | undefined;
  names(): string[];
}

/** Your own rule for your own game. Return a ProofResult, built with `proofResult`. */
export type ProofProperty = (level: Level, input: ProofInput) => ProofResult;

export interface ProofInput {
  objects: ObjectSource;
  /** How the level is named in counterexamples. Defaults to "Level <seed>". */
  label?: string;
  /** Your game's timing. Anything you leave out uses the defaults in tech.md. */
  timing?: Partial<Timing>;
  /** Your own minimum take-off window per speed, in ms. Defaults: Slow 650, Fast 400. */
  floorsMs?: Partial<Record<Speed, number>>;
  /** Extra properties, run after the built-in ones. */
  extra?: readonly ProofProperty[];
}
