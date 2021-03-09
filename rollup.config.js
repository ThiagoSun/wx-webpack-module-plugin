import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import progress from 'rollup-plugin-progress';
import fileSize from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';

const inputPath = 'src/index.ts';
const commonPlugins = [
  typescript(),
  resolve(), // so Rollup can find `ms`
  commonjs(), // so Rollup can convert `ms` to an ES module
  progress(),
  fileSize(),
];

const cjs = [
  {
    input: inputPath,
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: commonPlugins,
  },
  {
    input: inputPath,
    output: [
      {
        file: `${pkg.main.split('.js')[0]}.min.js`,
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: commonPlugins.concat([terser()]),
  },
];

const esm = [
  {
    input: inputPath,
    output: [
      {
        file: pkg.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: commonPlugins,
  },
  {
    input: inputPath,
    output: [
      {
        file: `${pkg.module.split('.js')[0]}.min.js`,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: commonPlugins.concat([terser()]),
  },
];

export default [...cjs, ...esm];
