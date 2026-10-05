import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const suites = [...readFileSync('tests/run.ts', 'utf8').matchAll(/import '\.\/(.+\.test)';/g)]
  .map((match) => {
    const base = `tests/${match[1]}`;
    return existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`;
  });

for (const suite of suites) {
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=1024', 'node_modules/tsx/dist/cli.mjs', suite],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) process.exit(result.status ?? 1);
}
