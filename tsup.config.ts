import { defineConfig } from 'tsup';

const commonConfig = {
  dts: true,
  sourcemap: true,
  shims: true,
  noExternal: ['@octokit/rest', 'got'],
};

export default defineConfig([
  {
    ...commonConfig,
    entry: {
      index: 'src/index.ts',
      bin: 'src/bin.ts',
    },
    format: ['esm'],
    outDir: 'dist/esm',
    clean: true,
  },
  {
    ...commonConfig,
    entry: {
      index: 'src/index.cts',
      bin: 'src/bin.ts',
    },
    format: ['cjs'],
    outDir: 'dist/cjs',
    clean: true,
  },
]);
