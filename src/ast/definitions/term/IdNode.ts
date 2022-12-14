import type { Tokens } from '../../../tokenize/tokens.js';
import type { EvalContext } from '../../eval.js';
import type { NameAnalysisContext } from '../../nameAnalysis.js';
import { findDeclaration } from '../../nameAnalysis.js';
import { IdQuad, TempVariable } from '../../../quads/definitions/IdQuad.js';
import type { TypeCheckContext } from '../../typing.js';
import { BoolType, IntType } from '../../typing.js';
import type { PrintContext } from '../../unparse.js';
import { FunctionDeclaration } from '../FunctionDeclaration.js';
import { VariableDeclaration } from '../statement/VariableDeclaration.js';
import type { TokenNode } from '../TokenNode.js';
import { token } from '../TokenNode.js';
import { FunctionTypeNode } from '../types/FunctionTypeNode.js';
import { PrimaryTypeNode } from '../types/PrimaryTypeNode.js';
import { Term } from './index.js';

export class IdNode extends Term {
  public constructor(public readonly token: TokenNode) {
    super([token]);
  }

  private declaration: FunctionDeclaration | VariableDeclaration | undefined;

  public getName(): string {
    return (this.token.token.data as Tokens['ID']).literal.toString();
  }

  public getToken() {
    return this.token.getToken();
  }

  public typeCheck(_context: TypeCheckContext) {
    const declaration = this.getDeclaration();
    if (declaration === undefined)
      throw new Error(`Unable to find ${this.getName()} variable declaration`);
    else if (declaration instanceof FunctionDeclaration)
      return declaration.typeNode;
    else if (declaration.type instanceof FunctionTypeNode)
      return declaration.type.typeNode;
    else if (declaration.type instanceof PrimaryTypeNode) {
      const type = declaration.type.token.token.type;
      if (type === 'INT') return new IntType();
      else if (type === 'BOOL') return new BoolType();
      else
        throw new Error(`Variable ${this.getName()} has invalid type ${type}`);
    } else throw new Error(`Variable ${this.getName()} has unknown type`);
  }

  public nameAnalysis(context: NameAnalysisContext) {
    super.nameAnalysis(context);
    if (context.isDeclaration) return;
    if (this.getDeclaration() === undefined)
      this.nameAnalysisContext.reportError(this, 'Undeclared identifier');
  }

  public getDeclaration():
    | FunctionDeclaration
    | VariableDeclaration
    | undefined {
    if (typeof this.declaration === 'object') return this.declaration;
    this.declaration = findDeclaration(
      this.getName(),
      this.nameAnalysisContext
    );
    return this.declaration;
  }

  public pretty(printContext: PrintContext) {
    return [
      this.getName(),
      printContext.mode === 'nameAnalysis' ? this.printType(printContext) : '',
    ];
  }

  public printType(printContext: PrintContext): string {
    return [
      token('LPAREN'),
      this.getDeclaration()!.type.printType(printContext),
      token('RPAREN'),
    ].join('');
  }

  public async evaluate(_context: EvalContext) {
    const declaration = this.getDeclaration();
    if (declaration === undefined) return undefined;
    else if (declaration instanceof VariableDeclaration)
      return declaration.value;
    else return declaration;
  }

  public getTempVariable(): TempVariable {
    const variable = this.getDeclaration()!;
    return variable instanceof FunctionDeclaration ||
      variable.tempVariable.variable === -1
      ? new TempVariable(this.getName())
      : variable.tempVariable;
  }

  public toQuads() {
    return [
      new IdQuad(
        this.getName(),
        this.getTempVariable(),
        this.getDeclaration()!,
        this.getDeclaration()! instanceof FunctionDeclaration,
        this.getDeclaration()!.type.children[0].toString()
      ),
    ];
  }
}
