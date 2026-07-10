// ProMatchXI — blokkerende lint-regels.
//
// Bewust KLEIN gehouden. Een linter die honderd meldingen geeft wordt genegeerd; dan vangt hij
// ook de twee die ertoe doen niet meer. Alleen regels die aantoonbaar echte bugs hebben gevangen
// staan hier op `error`. De bredere audit staat in eslint.audit.mjs en blokkeert niets.
//
// Wat deze twee regels zouden hebben gevangen:
//   `!data.errors`                              (v218)     errors: [] is truthy
//   `predictions?.percent?.home !== null`       (v26.264)  altijd waar -> +1 op elk inzet-advies
//   `pred.percent?.home !== null` (api.js)      (v26.266)  altijd waar -> TypeError op de regel eronder
//   `_incoherent` gebruikt voor declaratie      (v26.265)  TDZ, brak elke analyse met AH-odds
//
// `node --check` vangt geen van deze: dat is syntax, geen scope of semantiek.
// De falsy-zero familie (`parseFloat("0.0") || null`, `if (base.avgConcHome)`) is NIET statisch
// te vangen zonder ruis -- 72 treffers, vrijwel allemaal onschuldig. Zie eslint.audit.mjs.

export default [
  { ignores: ["OneSignalSDKWorker.js", "node_modules/**", ".cache/**", "**/*.min.js"] },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script" },
    rules: {
      "no-use-before-define": ["error", { variables: true, functions: false, classes: false }],
      "no-restricted-syntax": ["error", {
        selector: 'BinaryExpression[operator=/^(!==|===)$/][right.raw="null"]:has(ChainExpression.left)',
        message: "Optional chaining levert undefined, niet null: `a?.b !== null` is ALTIJD waar en `a?.b === null` ALTIJD onwaar. Gebruik `a?.b != null`, en dereference daarna niet zonder ?."
      }]
    }
  },
  // cloudworker.js en sw.js zijn ES-modules (export default / addEventListener-module)
  { files: ["cloudworker.js", "sw.js"], languageOptions: { ecmaVersion: 2022, sourceType: "module" } }
];
