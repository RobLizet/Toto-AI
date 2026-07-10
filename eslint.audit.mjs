// Niet-blokkerende audit. Draai met de hand:  npx eslint -c eslint.audit.mjs .
// Geeft ~72 treffers, waarvan de meeste onschuldig zijn (`d.response || null` op een array).
// Bedoeld om met domeinkennis doorheen te lopen, niet om een build op te laten falen.
export default [
  { ignores: ["OneSignalSDKWorker.js", "node_modules/**", ".cache/**", "**/*.min.js"] },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script" },
    rules: {
      "no-restricted-syntax": ["warn", {
        selector: 'LogicalExpression[operator="||"][left.callee.name=/^(parseFloat|parseInt|Number)$/]',
        message: "Falsy-zero: parseFloat(x) || fallback gooit een geldige 0 weg. Controleer of 0 hier een echte waarde is; zo ja, gebruik ?? of een expliciete isNaN-check."
      }]
    }
  }
];
