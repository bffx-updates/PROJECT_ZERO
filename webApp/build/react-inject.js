// Shim React -> Preact, via esbuild "inject". Quando algum arquivo do
// bundle usa o identifier "React" ou "ReactDOM" sem declarar, esbuild
// prepende um import deste arquivo automaticamente, escopando o nome
// localmente. Mais robusto que mexer em globalThis (nao depende de
// ordem de avaliacao ES module).
import * as PreactCompat from 'preact/compat';
import * as PreactHooks from 'preact/hooks';

export const React = { ...PreactCompat, ...PreactHooks };
export const ReactDOM = PreactCompat;
