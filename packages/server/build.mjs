import { build } from 'esbuild';
import { readFileSync } from 'fs';

// Read package.json to get all dependencies
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const dependencies = Object.keys(packageJson.dependencies || {});

// Filter out workspace dependencies (those starting with @call-break/)
// We want to bundle those, but keep node_modules external
const externalDeps = dependencies.filter(dep => !dep.startsWith('@call-break/'));

await build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  external: externalDeps,
  tsconfig: './tsconfig.json',
}).catch(() => process.exit(1));

console.log('✓ Build completed successfully');
