import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "dashboard.html",
  "connections.html",
  "locations.html",
  "users.html",
  "alerts.html",
  "reports.html"
];

test("application pages expose accessible navigation and a main-content skip link", () => {
  for (const page of pages) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    const currentLinks = html.match(/aria-current="page"/g) || [];

    assert.match(html, /class="skip-link" href="#main-content"/, `${page} should have a skip link`);
    assert.match(html, /<nav aria-label="Seções da aplicação">/, `${page} should name its navigation`);
    assert.match(html, /<main[^>]*id="main-content"[^>]*tabindex="-1"/, `${page} should expose the skip target`);
    assert.equal(currentLinks.length, 1, `${page} should identify exactly one current navigation link`);
    assert.doesNotMatch(html, /href="#"/, `${page} should not include non-functional placeholder links`);
  }
});

test("login page does not disclose the default demonstration credentials", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /admin@gemaccess\.local|gemaccess123/);
});

test("data tables include captions and scoped column headers", () => {
  for (const page of ["dashboard.html", "connections.html", "users.html"]) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(([table]) => table);

    assert.ok(tables.length > 0, `${page} should contain a data table`);
    for (const table of tables) {
      assert.match(table, /<caption\b/, `${page} table should have a caption`);
      assert.match(table, /<th\s+scope="col"/, `${page} table should identify column headers`);
    }
  }
});
