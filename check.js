// Checks the arrays and array selection in index.html. Run: node check.js
const assert = require("node:assert");
const fs = require("node:fs");

const html = fs.readFileSync(`${__dirname}/index.html`, "utf8");
const logic = html.match(/<script id=logic>([\s\S]*?)<\/script>/)[1];
const { ARRAYS, fit, parse, build, interpret } = new Function(`${logic}; return { ARRAYS, fit, parse, build, interpret };`)();

assert.deepStrictEqual(ARRAYS.map((a) => a.name), [
  "L4 (2^3)", "L8 (2^7)", "L8 (2^4 4^1)", "L9 (3^4)", "L12 (2^11)", "L16 (2^15)",
  "L16 (4^5)", "L18 (2^1 3^7)", "L25 (5^6)", "L27 (3^13)", "L32 (2^31)",
]);

// Orthogonal: for each pair of columns, every pair of levels occurs equally often.
for (const { name, runs, columns } of ARRAYS) {
  columns.forEach((a, i) => columns.slice(i + 1).forEach((b) => {
    const counts = {};
    for (let run = 0; run < runs; run++) {
      const pair = `${a.values[run]},${b.values[run]}`;
      counts[pair] = (counts[pair] || 0) + 1;
    }
    assert.strictEqual(Object.keys(counts).length, a.levels * b.levels, name);
    for (const n of Object.values(counts)) assert.strictEqual(n, runs / (a.levels * b.levels), name);
  }));
}

// Published rows, in the published column order.
const publishedRow = (array, run) => {
  const p = array.columns[0].levels;
  const position = (c) => c.coefficients.reduceRight((sum, a) => sum * p + a, 0);
  return [...array.columns].sort((a, b) => position(a) - position(b)).map((c) => c.values[run]).join("");
};
const [L4, L8, , L9, , , , , L25, L27] = ARRAYS;
assert.strictEqual(publishedRow(L4, 3), "221");
assert.strictEqual(publishedRow(L8, 2), "1221122");
assert.strictEqual(publishedRow(L9, 3), "2123");
assert.strictEqual(publishedRow(L25, 5), "212345");
assert.strictEqual(publishedRow(L27, 9), "2123123123123");

// Factors fill base columns first: in L8, four factors do not use the column A+B.
const three = fit([2, 2, 2]);
assert.strictEqual(three.array.name, "L4 (2^3)");
const four = fit([2, 2, 2, 2]);
assert.strictEqual(four.array.name, "L8 (2^7)");
assert.deepStrictEqual(four.columns.map((c) => c.coefficients), [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]]);

// Selection: the fewest runs, with dummy levels when they save runs.
const selected = (...counts) => fit(counts)?.array.name;
assert.strictEqual(selected(2, 3, 3, 3), "L9 (3^4)");
assert.strictEqual(selected(...Array(7).fill(2)), "L8 (2^7)");
assert.strictEqual(selected(...Array(9).fill(2)), "L12 (2^11)");
assert.strictEqual(selected(3, 3, 3, 3, 3), "L16 (4^5)");
assert.strictEqual(selected(3, 3, 3, 3, 3, 3), "L18 (2^1 3^7)");
assert.strictEqual(selected(4, 2, 2), "L8 (2^4 4^1)");
assert.strictEqual(selected(4, 4, 4), "L16 (4^5)");
assert.strictEqual(selected(5, 2), "L25 (5^6)");
assert.strictEqual(selected(3, ...Array(7).fill(2)), "L18 (2^1 3^7)");
assert.strictEqual(selected(...Array(6).fill(4)), "L25 (5^6)");
assert.strictEqual(selected(...Array(7).fill(4)), undefined);
assert.strictEqual(selected(6), undefined);
assert.strictEqual(selected(...Array(14).fill(3)), undefined);

// A plan keeps factor order and states which level repeats.
const plan = build(parse("Pressure: low, high\nA: 1, 2, 3\nB: 1, 2, 3\nC: 1, 2, 3\n"));
assert.strictEqual(plan.runs, 9);
assert.deepStrictEqual(plan.repeats, ["Pressure has low in 6 tests and high in 3 tests"]);
assert.ok(plan.rows.every((row) => ["low", "high"].includes(row[0])));
assert.strictEqual(plan.rows.filter((row) => row[0] === "low").length, 6);

assert.throws(() => parse("Pressure"), /Line 1/);
assert.throws(() => parse("Pressure: low"), /Line 1/);
assert.throws(() => parse("  \n"), /at least one/);
assert.throws(() => build(parse("A: 1, 2, 3, 4, 5, 6")), /No plan on this page fits/);

// Interpretation: L9 with the run number as the score, so the first column has the larger effect.
const factors = parse("B: x, y, z\nA: low, mid, high");
const scored = build(factors);
const effects = interpret(factors, scored.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
const byName = Object.fromEntries(effects.map((e) => [e.name, e]));
assert.strictEqual(effects[0].name, "B");
assert.strictEqual(byName.B.effect, 6);
assert.deepStrictEqual(byName.B.highest, { level: "z", average: 8 });
assert.deepStrictEqual(byName.B.lowest, { level: "x", average: 2 });
assert.strictEqual(byName.A.effect, 2);
assert.deepStrictEqual(byName.A.highest, { level: "high", average: 6 });

// A factor with a repeated level averages over all of its runs.
const dummy = parse("P: low, high\nA: 1, 2, 3\nB: 1, 2, 3\nC: 1, 2, 3");
const dummyPlan = build(dummy);
const dummyScores = dummyPlan.rows.map((row) => (row[0] === "low" ? 10 : 4));
const dummyEffects = interpret(dummy, dummyPlan.rows, dummyScores);
assert.strictEqual(dummyEffects[0].name, "P");
assert.strictEqual(dummyEffects[0].effect, 6);

console.log("All checks passed.");
