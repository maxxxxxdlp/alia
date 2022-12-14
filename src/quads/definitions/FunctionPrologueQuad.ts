import { MovQ } from '../../instructions/definitions/amd/MovQ.js';
import { PushQ } from '../../instructions/definitions/amd/PushQ.js';
import { Label } from '../../instructions/definitions/Label.js';
import { Move } from '../../instructions/definitions/mips/Move.js';
import { Sw } from '../../instructions/definitions/mips/Sw.js';
import { NextComment } from '../../instructions/definitions/NextComment.js';
import { PrevComment } from '../../instructions/definitions/PrevComment.js';
import type { QuadsContext } from '../index.js';
import { AssignQuad } from './AssignQuad.js';
import { mainFunction } from './GlobalQuad.js';
import { formatFunctionName, formatGlobalVariable } from './GlobalVarQuad.js';
import { mipsSize, Quad } from './index.js';
import { Register } from './Register.js';

export class FunctionPrologueQuad extends Quad {
  private readonly entryQuad: Label;

  private readonly entryMips: Label;

  private readonly entryAmd: Label;

  private readonly setRa: Quad;

  public constructor(private readonly id: string, context: QuadsContext) {
    super();

    this.entryQuad = new Label(formatFunctionName(this.id));
    this.entryMips = new Label(formatGlobalVariable(this.id));
    this.entryAmd = new Label(
      this.id === mainFunction ? mainFunction : formatGlobalVariable(this.id)
    );

    // Allocate stack space for the function pointer
    context.requestTemp();
    this.setRa = new AssignQuad(undefined, context.requestTemp(), [
      new Register('$ra'),
    ]);
  }

  public toString() {
    return [this.entryQuad, `enter ${this.id}`];
  }

  public toMips() {
    return [
      this.entryMips,
      new NextComment('Save frame pointer'),
      new Sw('$fp', `-${mipsSize}($sp)`),
      new NextComment('Set new frame pointer'),
      new Move('$fp', '$sp'),
      new NextComment('Save return address'),
      ...this.setRa.toMips(),
      new PrevComment('BEGIN Function body'),
    ];
  }

  public toAmd() {
    return [
      this.entryAmd,
      new PushQ('%rbp'),
      new MovQ('%rsp', '%rbp'),
      new PrevComment('BEGIN Function body'),
    ];
  }
}
