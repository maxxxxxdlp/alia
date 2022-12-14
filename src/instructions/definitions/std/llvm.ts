import llvm from 'llvm-bindings';

import type { LlvmContext } from '../../../quads/definitions/index.js';

export const declareLinkages = ({ builder, module }: LlvmContext): void =>
  Object.entries({
    mayhem: llvm.FunctionType.get(builder.getInt64Ty(), [], false),
    printBool: llvm.FunctionType.get(
      builder.getVoidTy(),
      [builder.getInt64Ty()],
      false
    ),
    printInt: llvm.FunctionType.get(
      builder.getVoidTy(),
      [builder.getInt64Ty()],
      false
    ),
    printString: llvm.FunctionType.get(
      builder.getVoidTy(),
      [builder.getInt8PtrTy()],
      false
    ),
    getBool: llvm.FunctionType.get(builder.getInt64Ty(), [], false),
    getInt: llvm.FunctionType.get(builder.getInt64Ty(), [], false),
  }).forEach(([name, type]) =>
    llvm.Function.Create(
      type,
      llvm.Function.LinkageTypes.ExternalWeakLinkage,
      name,
      module
    )
  );
