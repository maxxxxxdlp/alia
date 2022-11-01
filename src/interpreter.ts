import chalk from 'chalk';
import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';

import type { AstNode, Scope } from './ast/definitions.js';
import { handleInput, nameParse, run, typeCheckAst } from './process.js';
import type { RA } from './utils/types.js';

const stream = createInterface({
  input: process.stdin,
  output: process.stdout,
});
console.log(
  'Welcome to dragoninterp!\n' +
    'Enter Drewgon code to be interpreted\n' +
    'Enter :help for help\n'
);

/*
 * TODO: add tests
 * TODO: intercept Ctrl+C when input!=''
 */

async function program(): Promise<void> {
  let symbolTable: RA<Scope> = [];
  const totalInput = [];
  let pendingInput = '';
  while (true) {
    const line = await stream.question(
      pendingInput.length === 0 ? '' : chalk.gray('. ')
    );

    if (await handleCommand(line.trim(), symbolTable, totalInput)) {
      pendingInput = '';
      continue;
    }

    if (pendingInput.length > 0) pendingInput += '\n';
    pendingInput = `${pendingInput}${line}`;

    const parseResult = await inputToAst(pendingInput, symbolTable);
    if (parseResult === undefined) {
      pendingInput = '';
      continue;
    }
    const { input, ast } = parseResult;
    pendingInput = input;

    symbolTable = ast.nameAnalysisContext.symbolTable;
    let returnCalled = false;
    const result = await ast.evaluate({
      output: console.log,
      input: handleInput(stream),
      onReturnCalled() {
        returnCalled = true;
      },
    });
    console.log(chalk.gray(result?.toString() ?? 'undefined'));

    totalInput.push(pendingInput);
    pendingInput = '';
    if (returnCalled) {
      if (typeof result === 'number') process.exitCode = result;
      stream.close();
      break;
    }
  }
}

async function inputToAst(
  rawInput: string,
  symbolTable: RA<Scope>
): Promise<{ readonly input: string; readonly ast: AstNode } | undefined> {
  let input = rawInput;
  let ast: AstNode | undefined;
  try {
    ast = await run(rawInput, undefined, undefined, false, 'SLR', 'ast');
  } catch {
    // Automatically insert semicolons if necessary
    try {
      input = `${input};`;
      ast = await run(input, undefined, undefined, false, 'SLR', 'ast');
    } catch {
      ast = undefined;
    }
  }
  if (ast === undefined) return undefined;

  ast.nameAnalysisContext = {
    ...ast.nameAnalysisContext,
    symbolTable: [...symbolTable, ...ast.nameAnalysisContext.symbolTable],
  };

  const nameErrors = nameParse(ast, false);
  if (Array.isArray(nameErrors)) {
    nameErrors.forEach((error) => console.error(error));
    return undefined;
  }

  const typeErrors = typeCheckAst(ast, input);
  if (typeErrors.length > 0) {
    typeErrors.forEach((error) => console.error(error));
    return undefined;
  }
  return { input, ast };
}

stream.on('close', () => process.exit());

program();

const reSave = /^:save \s*(?<fileName>.+)$/u;
const reType = /^:type \s*(?<expression>.+)$/u;

async function handleCommand(
  line: string,
  symbolTable: RA<Scope>,
  totalInput: RA<string>
): Promise<boolean> {
  if (line === ':help') {
    console.log(
      chalk.blue(
        [
          `:help - show this help message\n`,
          `:save <fileName> - save the commands entered in the current session `,
          `into a file\n`,
          `:type <expression> - type check an expression`,
        ].join('')
      )
    );
    return true;
  }
  const fileName = reSave.exec(line)?.groups?.fileName;
  if (typeof fileName === 'string') {
    const result = await inputToAst(totalInput.join('\n'), symbolTable);
    if (result === undefined) {
      console.log(chalk.red('Unexpected error when saving'));
      return true;
    }
    const { ast } = result;
    fs.writeFileSync(
      fileName,
      ast.print({
        indent: 0,
        mode: 'pretty',
        debug: false,
        needWrapping: false,
      })
    );
    console.log(chalk.blue('Output saved'));
    return true;
  }

  const expression = reType.exec(line)?.groups?.expression;
  if (typeof expression === 'string') {
    const result = await inputToAst(expression, symbolTable);
    if (result === undefined) return true;
    const { ast } = result;
    const node = ast?.children.at(-1);
    if (typeof node === 'object') {
      const type = node.typeCheck({
        reportError: () => {
          throw new Error('Should not be called');
        },
      });
      console.log(chalk.blue(type.toString()));
    }
    return true;
  }

  return false;
}
