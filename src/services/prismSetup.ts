import Prism from 'prismjs';

// Prism language component files reference the global `Prism` variable.
// Assigning it here — BEFORE any component module is evaluated — is safe
// because importers must import this module first (ESM evaluates this
// module's body before subsequent imports in the importing module run).
(globalThis as any).Prism = Prism;

export default Prism;
