import type { RA } from '../../utils/types.js';
import { Quad } from './index.js';
import { StringQuad } from './StringQuad.js';
import { IdQuad } from './IdQuad.js';
import { NextComment } from '../../instructions/definitions/NextComment.js';
import { CallQ } from '../../instructions/definitions/amd/CallQ.js';
import { MovQ } from '../../instructions/definitions/amd/MovQ.js';
import { La } from '../../instructions/definitions/mips/La.js';
import { Addi } from '../../instructions/definitions/mips/Addi.js';
import { Syscall } from '../../instructions/definitions/Syscall.js';
import { PrevComment } from '../../instructions/definitions/PrevComment.js';
import { Lw } from '../../instructions/definitions/mips/Lw.js';

export class ReportQuad extends Quad {
  public constructor(private readonly quads: RA<Quad>) {
    super();
  }

  public toString() {
    return [
      ...this.quads.flatMap((quad) => quad.toString()),
      `REPORT ${this.quads.at(-1)!.toValue()}`,
    ];
  }

  public toMips() {
    const isString = this.quads.at(-1) instanceof StringQuad;
    const value = this.quads.at(-1)!.toMipsValue();
    return [
      new NextComment('BEGIN Output'),
      ...this.quads.flatMap((quad) => quad.toMips()),
      new (isString ? La : Lw)('$a0', value),
      new Addi('$v0', '$zero', isString ? 4 : 1),
      new Syscall(),
      new PrevComment('BEGIN Output'),
    ];
  }

  public toAmd() {
    const quad = this.quads.at(-1)!;
    const isString = quad instanceof StringQuad;
    const isBool = quad instanceof IdQuad && quad.type === 'bool';
    const value = quad.toAmdValue();
    return [
      new NextComment('Output'),
      new MovQ(value, '%rdi'),
      new CallQ(isString ? 'printString' : isBool ? 'printBool' : 'printInt'),
    ];
  }
}