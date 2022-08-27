import type { RA } from '../utils/types.js';
import type { Tokens } from './tokens.js';

export type Token<T extends keyof Tokens = keyof Tokens> = {
  readonly type: T;
  readonly data: Tokens[T];
  readonly simplePosition: number;
};

export type Position = {
  readonly lineNumber: number;
  readonly columnNumber: number;
};

export type MatcherResult<T extends keyof Tokens> = {
  readonly type: T | undefined;
  readonly data: Tokens[T] | undefined;
  readonly tokenLength: number;
  readonly errors: RA<ParseError>;
};

export type ParseError = {
  readonly start: number;
  readonly end: number;
  readonly message: string;
};