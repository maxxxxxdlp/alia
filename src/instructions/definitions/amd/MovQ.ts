import {AmdInstruction} from './index.js';

export class MovQ extends AmdInstruction {
  public constructor(
    public readonly source: string,
    public readonly destination: string
  ) {
    super();
  }

  public toString(): string {
    return `movq ${this.source}, ${this.destination}`;
  }
}