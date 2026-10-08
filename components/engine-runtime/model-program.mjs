import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CUDA_JS_COMPATIBILITY} from 'cuda-js';
import {CUDA_JS_TENSOR_COMPATIBILITY} from 'cuda-js-tensor';
import {buildLatticeKnightFp32TensorProgram} from './model-program-source.mjs';
import {MODEL_IDENTITY} from './model-artifacts.mjs';
export function buildAdmittedModelProgram(){
  if(CUDA_JS_TENSOR_COMPATIBILITY.package.version!=='0.1.0-alpha.10'||CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22'||CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision!=='dc2924657bb900cdce3fba4c9def62934419db03')throw new Error('Operational model public cohort mismatch');
  const source=fs.readFileSync(new URL('./model-program-source.mjs',import.meta.url));
  if(createHash('sha256').update(source).digest('hex')!==MODEL_IDENTITY.mapperSha256)throw new Error('Original model builder source identity mismatch');
  const built=buildLatticeKnightFp32TensorProgram({itemCapacity:2});
  if(built.program.nodes.length!==2216||built.parameterLayout.byteLength!==MODEL_IDENTITY.parameterBytes||built.program.outputs[0].spec.capacityShape[1]!==4162)throw new Error('Original model program structure mismatch');
  return Object.freeze({...built,cohort:Object.freeze({tensor:CUDA_JS_TENSOR_COMPATIBILITY.package.version,cudaJs:CUDA_JS_COMPATIBILITY.package.version,cudaJsRevision:CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision})});
}
