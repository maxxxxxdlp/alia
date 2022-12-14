import type { IR, RA } from '../../utils/types.js';
import { AssignQuad } from './AssignQuad.js';
import { LlvmContext, Quad, quadsToAmd, quadsToMips } from './index.js';
import { QuadsContext } from '../index.js';
import { LoadQuad } from './LoadQuad.js';
import { Register } from './Register.js';
import { MovQ } from '../../instructions/definitions/amd/MovQ.js';
import { SubQ } from '../../instructions/definitions/amd/SubQ.js';
import { AddQ } from '../../instructions/definitions/amd/AddQ.js';
import { ImulQ } from '../../instructions/definitions/amd/ImulQ.js';
import { IdivQ } from '../../instructions/definitions/amd/IdivQ.js';
import { OrQ } from '../../instructions/definitions/amd/OrQ.js';
import { AndQ } from '../../instructions/definitions/amd/AndQ.js';
import { SetL } from '../../instructions/definitions/amd/SetL.js';
import { SetG } from '../../instructions/definitions/amd/SetG.js';
import { SetLe } from '../../instructions/definitions/amd/SetLe.js';
import { SetGe } from '../../instructions/definitions/amd/SetGe.js';
import { SetE } from '../../instructions/definitions/amd/SetE.js';
import { SetNe } from '../../instructions/definitions/amd/SetNe.js';
import { Not } from '../../instructions/definitions/amd/Not.js';
import { Neg } from '../../instructions/definitions/amd/Neg.js';
import { NextComment } from '../../instructions/definitions/NextComment.js';
import { Sub } from '../../instructions/definitions/mips/Sub.js';
import { Add } from '../../instructions/definitions/mips/Add.js';
import { Mult } from '../../instructions/definitions/mips/Mult.js';
import { Mflo } from '../../instructions/definitions/mips/Mflo.js';
import { Div } from '../../instructions/definitions/mips/Div.js';
import { Or } from '../../instructions/definitions/mips/Or.js';
import { And } from '../../instructions/definitions/mips/And.js';
import { Xori } from '../../instructions/definitions/mips/Xori.js';
import { Slt } from '../../instructions/definitions/mips/Slt.js';
import { SltiU } from '../../instructions/definitions/mips/SltiU.js';
import { Xor } from '../../instructions/definitions/mips/Xor.js';
import { Andi } from '../../instructions/definitions/mips/Andi.js';
import { CmpQ } from '../../instructions/definitions/amd/CmpQ.js';
import llvm from 'llvm-bindings';

const operationTranslations = {
  '--': 'SUB64',
  '++': 'ADD64',
  '+': 'ADD64',
  '-': 'SUB64',
  '*': 'MULT64',
  '/': 'DIV64',
  or: 'OR64',
  and: 'AND64',
  '<': 'LT64',
  '>': 'GT64',
  '<=': 'LTE64',
  '>=': 'GTE64',
  '==': 'EQ64',
  '!=': 'NEQ64',
  '!': 'NOT64',
  neg: 'NEG64',
} as const;

export class OpQuad extends Quad {
  public constructor(
    private readonly left: Quad | undefined,
    private readonly type: keyof typeof operationTranslations,
    private readonly right: Quad,
    private readonly tempRegister: Register
  ) {
    super();
  }

  public toString() {
    return [];
  }

  public toValue() {
    return `${this.left === undefined ? '' : `${this.left.toValue()} `}${
      operationTranslations[this.type]
    } ${this.right.toValue()}`;
  }

  public toMips() {
    const left = this.left?.toMipsValue() ?? '';
    const right = this.right.toMipsValue();
    const temp = this.tempRegister.toMipsValue();
    if (this.type === '--' || this.type === '-')
      return [new Sub(temp, left, right)];
    else if (this.type === '++' || this.type === '+')
      return [new Add(temp, left, right)];
    else if (this.type === '*')
      return [
        new Mult(left, right),
        // Note: this does not check for overflow
        new Mflo(temp),
      ];
    else if (this.type === '/')
      return [
        new Div(left, right),
        // Note: this discards the remainder
        new Mflo(temp),
      ];
    else if (this.type === 'or') return [new Or(temp, left, right)];
    else if (this.type === 'and') return [new And(temp, left, right)];
    else if (this.type === '<') return [new Slt(temp, left, right)];
    else if (this.type === '>') return [new Slt(temp, right, left)];
    else if (this.type === '<=')
      return [new Slt(temp, right, left), new Xori(temp, temp, 1)];
    else if (this.type === '>=')
      return [new Slt(temp, left, right), new Xori(temp, temp, 1)];
    else if (this.type === '==')
      return [new Xor(temp, left, right), new SltiU(temp, temp, 1)];
    else if (this.type === '!=')
      return [new Xor(temp, left, right), new Slt(temp, '$zero', temp)];
    else if (this.type === '!')
      return [new SltiU(temp, right, 1), new Andi(temp, temp, '0x00ff')];
    else if (this.type === 'neg') return [new Sub(temp, '$zero', right)];
    else throw new Error(`Unknown operation ${this.type}`);
  }

  public toMipsValue() {
    return this.tempRegister.toMipsValue();
  }

  public toAmd() {
    const left = this.left?.toAmdValue() ?? '';
    const right = this.right.toAmdValue();
    const temp = this.tempRegister.toAmdValue();
    const lowTemp = lowRegisterMapping[temp];
    if (lowTemp === undefined)
      throw new Error(`Using a register with no 8-bit mapping: ${temp}`);
    if (this.type === '--' || this.type === '-')
      return [new MovQ(left, temp), new SubQ(right, temp)];
    else if (this.type === '++' || this.type === '+')
      return [new MovQ(left, temp), new AddQ(right, temp)];
    else if (this.type === '*')
      return [
        new MovQ(right, '%rax'),
        new ImulQ(left),
        // Note: this does not check for overflow
        new MovQ('%rax', temp),
      ];
    else if (this.type === '/')
      return [
        new MovQ('$0', '%rdx'),
        new MovQ(left, '%rax'),
        new IdivQ(right),
        // Note: this discards the remainder
        new MovQ('%rax', temp),
      ];
    else if (this.type === 'or')
      return [new MovQ(left, temp), new OrQ(right, temp)];
    else if (this.type === 'and')
      return [new MovQ(left, temp), new AndQ(right, temp)];
    else if (this.type === '<')
      return [new CmpQ(right, left), new SetL(lowTemp), new AndQ('$1', temp)];
    else if (this.type === '>')
      return [new CmpQ(right, left), new SetG(lowTemp), new AndQ('$1', temp)];
    else if (this.type === '<=')
      return [new CmpQ(right, left), new SetLe(lowTemp), new AndQ('$1', temp)];
    else if (this.type === '>=')
      return [new CmpQ(right, left), new SetGe(lowTemp), new AndQ('$1', temp)];
    else if (this.type === '==')
      return [new CmpQ(right, left), new SetE(lowTemp), new AndQ('$1', temp)];
    else if (this.type === '!=')
      return [new CmpQ(right, left), new SetNe(lowTemp), new AndQ('$1', temp)];
    else if (this.type === '!') return [new MovQ(right, temp), new Not(temp)];
    else if (this.type === 'neg') return [new MovQ(right, temp), new Neg(temp)];
    else throw new TypeError(`Unknown operation ${this.type}`);
  }

  public toAmdValue() {
    return this.tempRegister.toAmdValue();
  }

  public toLlvm(context: LlvmContext) {
    const { builder } = context;
    const left = this.left?.toLlvm(context)!;
    const right = this.right.toLlvm(context);

    const toQuad = (value: llvm.Value): llvm.Value =>
      builder.CreateIntCast(value, builder.getInt64Ty(), true);

    if (this.type === '--' || this.type === '-')
      return builder.CreateSub(left, right, 'subtmp');
    else if (this.type === '++' || this.type === '+')
      return builder.CreateAdd(left, right, 'addtmp');
    else if (this.type === '*')
      return builder.CreateMul(left, right, 'multtmp');
    else if (this.type === '/')
      return builder.CreateSDiv(left, right, 'divtmp');
    else if (this.type === 'or') return builder.CreateOr(left, right, 'ortmp');
    else if (this.type === 'and')
      return builder.CreateAnd(left, right, 'andtmp');
    else if (this.type === '<')
      return toQuad(builder.CreateICmpSLT(left, right, 'slttmp'));
    else if (this.type === '>')
      return toQuad(builder.CreateICmpSGT(left, right, 'sgttmp'));
    else if (this.type === '<=')
      return toQuad(builder.CreateICmpSLE(left, right, 'sletmp'));
    else if (this.type === '>=')
      return toQuad(builder.CreateICmpSGE(left, right, 'sgetmp'));
    else if (this.type === '==')
      return toQuad(builder.CreateICmpEQ(left, right, 'seteq'));
    else if (this.type === '!=')
      return toQuad(builder.CreateICmpNE(left, right, 'setne'));
    else if (this.type === '!')
      return toQuad(
        builder.CreateTrunc(
          builder.CreateNot(right, 'nottmp'),
          builder.getInt1Ty(),
          'booltmp'
        )
      );
    else if (this.type === 'neg') return builder.CreateNeg(right, 'negtmp');
    else throw new TypeError(`Unknown operation ${this.type}`);
  }
}

export class OperationQuad extends Quad {
  private readonly assignQuad: AssignQuad;
  private readonly assignUniversal: AssignQuad;
  private readonly leftLoad: LoadQuad | undefined;
  private readonly rightLoad: LoadQuad;

  public constructor(
    private readonly left: RA<Quad> | undefined,
    private readonly type: keyof typeof operationTranslations,
    private readonly right: RA<Quad>,
    context: QuadsContext
  ) {
    super();

    const tempVariable = context.requestTemp();
    const tempRegister = context.requestTempRegister();
    const leftValue = this.left?.at(-1)!.toValue() ?? '';
    const opQuad = new OpQuad(
      leftValue === '' ? undefined : new Register(leftValue),
      this.type,
      new Register(this.right.at(-1)!.toValue()),
      tempRegister
    );
    this.assignQuad = new AssignQuad(undefined, tempVariable, [opQuad]);

    const leftTemp = context.requestTempRegister();
    const leftRegister =
      this.left === undefined
        ? this.left
        : new Register(
            this.left?.at(-1)!.toMipsValue(),
            this.left?.at(-1)!.toAmdValue()
          );
    this.leftLoad =
      leftRegister === undefined
        ? undefined
        : new LoadQuad(leftTemp, leftRegister);

    this.rightLoad = new LoadQuad(
      context.requestTempRegister(),
      new Register(
        this.right.at(-1)!.toMipsValue(),
        this.right.at(-1)!.toAmdValue()
      )
    );

    const opMips = new OpQuad(
      this.leftLoad,
      this.type,
      this.rightLoad,
      tempRegister
    );
    this.assignUniversal = new AssignQuad(undefined, tempVariable, [opMips]);
  }

  public toString() {
    return [
      ...(this.left ?? []).flatMap((quad) => quad.toString()),
      ...this.right.flatMap((quad) => quad.toString()),
      ...this.assignQuad.toString(),
    ];
  }

  public toValue() {
    return this.assignQuad.toValue();
  }

  public toMips() {
    return [
      new NextComment(`Operation: ${operationTranslations[this.type]}`),
      ...quadsToMips([
        ...(this.left ?? []),
        ...this.right,
        ...(this.leftLoad?.toMips() ?? []),
        this.rightLoad,
        this.assignUniversal,
      ]),
    ];
  }

  public toMipsValue() {
    return this.assignUniversal.toMipsValue();
  }

  public toAmd() {
    return quadsToAmd([
      new NextComment(`Operation: ${operationTranslations[this.type]}`),
      ...(this.left ?? []),
      ...this.right,
      ...(this.leftLoad?.toAmd() ?? []),
      this.rightLoad,
      this.assignUniversal,
    ]);
  }

  public toAmdValue() {
    return this.assignUniversal.toAmdValue();
  }

  public toLlvm(context: LlvmContext) {
    this.left?.slice(0, -1).forEach((quad) => quad.toLlvm(context));
    this.right?.slice(0, -1).forEach((quad) => quad.toLlvm(context));
    return new OpQuad(
      this.left?.at(-1),
      this.type,
      this.right.at(-1)!,
      new Register('none')
    ).toLlvm(context);
  }
}

const lowRegisterMapping: IR<string> = {
  '%rax': '%al',
  '%rbx': '%bl',
  '%r12': '%r12b',
  '%r13': '%r13b',
  '%r14': '%r14b',
  '%r15': '%r15b',
};
