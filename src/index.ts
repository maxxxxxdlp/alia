import { program } from 'commander';
import fs from 'node:fs';

import { toQuads } from './ast/quads/index.js';
import { nameParse, run, typeCheckAst } from './process.js';

program.name('dgc').description('The ultimate Drewgon compiler');

let input = '';

program
  .argument('<input>', 'path to input file')
  .action((inputString: string) => {
    input = inputString;
  })
  .option('-t, --tokensOutput <string>', 'path to output file for tokens')
  .option(
    '-p, --parser <string>',
    'the parser to use. Allowed values include CYK and SLR. Note, unparser is only available for the SLR parser',
    'SLR'
  )
  .option(
    '--unparseMode <string>',
    'parseTree - prettify directly from the parse tree (faster). ast - convert to AST and prettify that (better results)',
    'ast'
  )
  .option(
    '-n, --namedUnparse <string>',
    'the file to which the augmented unparse output will be written. Ignored if unparseMode is not "ast"'
  )
  .option(
    '-c, --typeCheck',
    'run a type checker and print errors to stderr',
    false
  )
  .option(
    '-a, --assemble <string>',
    'generate a 3AC representation of the program'
  )
  .option('-d, --debug', 'output debug information', false)
  .option(
    '-d, --diagramPath <string>',
    'path to the output diagram for the grammar in the DOT format'
  )
  .option('-m, --mips <string>', 'compile the program down to MIPS')
  .option(
    '-u, --unparse <string>',
    'path to output file that would include preety-printed program'
  );

program.parse();

const {
  tokensOutput,
  parser: rawParser,
  unparse: unparseOutput,
  typeCheck,
  debug,
  namedUnparse,
  assemble,
  unparseMode = 'parseTree',
  diagramPath,
  mips,
} = program.opts<{
  readonly tokensOutput?: string;
  readonly parser: string;
  readonly unparse?: string;
  readonly debug: boolean;
  readonly typeCheck: boolean;
  readonly namedUnparse?: string;
  readonly unparseMode: string;
  readonly assemble?: string;
  readonly diagramPath?: string;
  readonly mips?: string;
}>();

const parser = rawParser.toUpperCase().trim();
if (parser !== 'CYK' && parser !== 'SLR')
  throw new Error(
    `Unknown parser "${parser}". Allowed values include CYK and SLR.`
  );
if (unparseMode !== 'ast' && unparseMode !== 'parseTree')
  throw new Error(
    `Unknown unparse mode "${unparseMode}". Allowed values include ast and parseTree.`
  );

const readFile = async (): Promise<string> =>
  fs.promises.readFile(input).then((data) => data.toString());

readFile()
  .then(async (rawText) => {
    const ast = await run({
      rawText,
      tokensOutput,
      unparseOutput,
      debug,
      parser,
      unparseMode,
      diagramPath,
    });

    if (ast === undefined) return;

    const namedUnparseResults = nameParse(ast, debug);
    if (namedUnparseResults === undefined) return;
    if (Array.isArray(namedUnparseResults)) {
      namedUnparseResults.forEach((errorMessage) =>
        console.error(errorMessage)
      );
      console.error('Name Analysis Failed');
      return;
    } else if (typeof namedUnparse === 'string')
      await fs.promises.writeFile(namedUnparse, namedUnparseResults);

    const errors = typeCheckAst(ast, rawText);
    if (typeCheck) {
      errors.forEach((errorMessage) => console.error(errorMessage));
      if (errors.length > 0) console.error('Type Analysis Failed');
    }

    const quads = toQuads(ast);
    if (assemble !== undefined)
      await fs.promises.writeFile(
        assemble,
        quads.flatMap((quad) => quad.toString()).join('\n')
      );

    if (mips !== undefined)
      await fs.promises.writeFile(
        mips,
        quads.flatMap((quad) => quad.toMips()).join('\n')
      );
  })
  .catch(console.error);
