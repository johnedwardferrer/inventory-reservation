const ID = process.argv[2];
const URL = `http://localhost:3000/claim/${ID}`;

const results = await Promise.all(
  Array.from({ length: 50 }, () =>
    fetch(URL, { method: "POST" }).then((r) => r.json()),
  ),
);

const successes = results.filter((r) => r.claimed === true).length;
const failures = results.filter((r) => r.error).length;

console.log(`successes: ${successes}`);
console.log(`failures:  ${failures}`);
console.log(`expected:  10 successes, 40 failures`);
console.log(
  `oversold:  ${successes > 10 ? "YES — BUG CONFIRMED" : "NO — test not concurrent enough"}`,
);
