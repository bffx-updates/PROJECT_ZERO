// Entry do bundle: configura globais React/ReactDOM apontando pra Preact,
// depois carrega o app.jsx (que usa "const { useState, ... } = React" e
// "ReactDOM.createRoot(...)" como o codigo original com React+Babel-standalone).
//
// preact/compat traz a maior parte da API publica do React 18. preact/hooks
// expoe os hooks. Misturamos os dois no objeto global "React" pra cobrir
// "const { useState, useEffect, useRef, useCallback, useMemo } = React;".
import * as PreactCompat from 'preact/compat';
import * as PreactHooks from 'preact/hooks';

const ReactGlobal = { ...PreactCompat, ...PreactHooks };

if (typeof globalThis !== 'undefined') {
  globalThis.React = ReactGlobal;
  globalThis.ReactDOM = PreactCompat;
}

// Importa o app DEPOIS dos globais. ES modules garantem que esse import
// so executa apos os imports acima resolverem.
import '../app.jsx';
