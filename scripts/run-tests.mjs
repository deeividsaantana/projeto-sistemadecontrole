import { spawnSync } from 'node:child_process';

const suites = ['tests/run-core.ts', 'tests/run-platform.ts', 'tests/run-fleet.ts'];

for (const suite of suites) {
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=2048', 'node_modules/tsx/dist/cli.mjs', suite],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) process.exit(result.status ?? 1);
}
