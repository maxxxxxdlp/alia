import { Quad } from './index.js';
import { Jmp } from '../../../instructions/amd/Jmp.js';
import { J } from '../../../instructions/mips/J.js';

export class GoToQuad extends Quad {
  public constructor(private readonly label: string) {
    super();
  }

  public toString() {
    return [`goto ${this.label}`];
  }

  public toMips() {
    return [new J(this.label)];
  }

  public toAmd() {
    return [new Jmp(this.label)];
  }
}
