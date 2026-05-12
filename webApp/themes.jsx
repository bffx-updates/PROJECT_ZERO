// Three studio-gear inspired themes for BFMIDI webApp.
// Each theme is a complete aesthetic system: type, color, surfaces, accent, "feel".

const THEMES = {
  // 01 — RACK: warm analog studio outboard. Brushed metal, amber LCD, screws.
  //      Vibes: Universal Audio, SSL outboard, Manley.
  rack: {
    id: 'rack',
    name: 'RACK',
    tagline: 'Warm analog outboard',
    fontDisplay: '"Antonio", "Oswald", sans-serif',
    fontBody: '"Inter Tight", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    accent: '#ff8a1f',          // amber LED
    accentSoft: '#3a2410',
    accentGlow: 'rgba(255, 138, 31, .55)',
    bg: '#171311',
    bgGradient:
      'radial-gradient(120% 80% at 50% -20%, #2a221d 0%, #171311 55%, #0d0a08 100%)',
    panel: '#1f1916',
    panelLight: '#2a221d',
    line: '#3a2f28',
    lineSoft: '#28211c',
    text: '#f3ecdf',
    textDim: '#a89684',
    textFaint: '#6b5b4d',
    success: '#7fc04a',
    danger: '#e35d3a',
    // signature surface: brushed metal with subtle grain
    surface: `
      linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(0,0,0,.18) 100%),
      repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 3px),
      linear-gradient(180deg, #251e1a 0%, #1a1512 100%)
    `,
    chromeShadow:
      'inset 0 1px 0 rgba(255,255,255,.06), inset 0 -1px 0 rgba(0,0,0,.5), 0 30px 60px -30px rgba(0,0,0,.8)',
  },

  // 02 — PHOSPHOR: vintage CRT / lab oscilloscope. Phosphor green on black.
  //      Vibes: old DAW meters, Voxengo, lab equipment.
  phosphor: {
    id: 'phosphor',
    name: 'PHOSPHOR',
    tagline: 'CRT lab terminal',
    fontDisplay: '"Space Grotesk", system-ui, sans-serif',
    fontBody: '"Space Grotesk", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    accent: '#7cff5e',           // phosphor green
    accentSoft: '#0d1f0a',
    accentGlow: 'rgba(124, 255, 94, .5)',
    bg: '#06080a',
    bgGradient:
      'radial-gradient(120% 80% at 50% 0%, #0c1310 0%, #06080a 60%, #04060a 100%)',
    panel: '#0a0f10',
    panelLight: '#0e1518',
    line: '#1a2624',
    lineSoft: '#0f1715',
    text: '#d6f7d0',
    textDim: '#6b9a6a',
    textFaint: '#3a5a3a',
    success: '#7cff5e',
    danger: '#ff5e5e',
    surface: `
      linear-gradient(180deg, rgba(124,255,94,.02), rgba(0,0,0,.4)),
      repeating-linear-gradient(0deg, rgba(124,255,94,.025) 0 1px, transparent 1px 3px),
      #08100c
    `,
    chromeShadow:
      'inset 0 0 0 1px rgba(124,255,94,.08), 0 0 60px rgba(124,255,94,.06)',
  },

  // 03 — LAB: clinical white plugin. FabFilter / iZotope inspired.
  //      Vibes: precise, measured, surgical. Light theme.
  lab: {
    id: 'lab',
    name: 'LAB',
    tagline: 'Precision instrument',
    fontDisplay: '"Instrument Serif", "Cormorant Garamond", serif',
    fontBody: '"Inter Tight", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    accent: '#ec3b87',           // hot magenta
    accentSoft: '#fde1ec',
    accentGlow: 'rgba(236, 59, 135, .35)',
    bg: '#f1eee8',
    bgGradient:
      'radial-gradient(120% 80% at 50% 0%, #faf8f3 0%, #ece8df 70%, #ddd8cc 100%)',
    panel: '#ffffff',
    panelLight: '#f7f4ee',
    line: '#1a1a1a',
    lineSoft: '#d8d2c4',
    text: '#1a1a1a',
    textDim: '#6b6256',
    textFaint: '#9c9388',
    success: '#1f8f4a',
    danger: '#c5341a',
    surface: '#ffffff',
    chromeShadow:
      '0 1px 0 rgba(255,255,255,.9) inset, 0 30px 50px -30px rgba(0,0,0,.25), 0 1px 0 #1a1a1a',
  },
};

window.THEMES = THEMES;
