// Entry do bundle. A ordem dos imports importa: ES modules executam os
// imports na ordem em que aparecem, ANTES do corpo do modulo importador.
// O shim seta globalThis.React/ReactDOM apontando pra Preact; so depois
// disso o app.jsx (que faz "const { useState } = React;") pode rodar.
import './react-shim.js';
import '../app.jsx';
