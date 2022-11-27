import { MipsInstruction } from './index.js';

export class Xori extends MipsInstruction {
  public constructor(
    public readonly destination: string,
    public readonly source: string,
    public readonly immediate: number
  ) {
    super();
  }

  public toString(): string {
    return `xori ${this.destination}, ${this.source}, ${this.immediate}`;
  }
}
