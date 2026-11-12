import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const child = spawn(process.execPath, [resolve('dist-server/index.js')], {
  stdio: 'inherit',
  env: { ...process.env, ANALYSIS_MODEL: 'freehuntx/qwen3-coder:8b' }
});
child.on('exit', code => { process.exitCode = code ?? 1; });
