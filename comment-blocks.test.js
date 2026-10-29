import assert from "node:assert/strict";
import { test } from "node:test";

import MarkdownIt from "markdown-it";

import commentBlocks, { CommentBlockError } from "./comment-blocks.js";

// ---- Constants --------------------------------------------------------

const TABLE = [
  "| Model | Score |",
  "| ----- | ----- |",
  "| Qwen  | 23/24 |",
  "| Gemma | 22/24 |",
].join("\n");

// ---- Helpers ----------------------------------------------------------

// Each component echoes what it received, so tests can read it back.
function recorder() {
  const calls = [];

  const echo = (block) => {
    calls.push(block);
    return `<div data-block="${block.name}">${block.html}</div>\n`;
  };

  return { calls, components: { chart: echo, list: echo, box: echo } };
}

function render(source, components, env = {}, options = {}) {
  const md = new MarkdownIt({ html: true });

  md.use(commentBlocks, { components, ...options });

  return md.render(source, env);
}

// ---- Blocks -----------------------------------------------------------

test("a wrapping block gets its options, table and inner HTML", () => {
  const { calls, components } = recorder();
  const source = [
    '<!-- block:chart {"value": "Score", "max": 24} -->',
    "",
    TABLE,
    "",
    "<!-- /block:chart -->",
  ].join("\n");

  const html = render(source, components);
  const [block] = calls;

  assert.equal(calls.length, 1);
  assert.equal(block.name, "chart");
  assert.deepEqual(block.options, { value: "Score", max: 24 });
  assert.equal(block.line, 1);
  assert.deepEqual(block.table.columns, ["Model", "Score"]);
  assert.deepEqual(block.table.rows, [
    { Model: "Qwen", Score: "23/24" },
    { Model: "Gemma", Score: "22/24" },
  ]);
  assert.match(block.html, /<table>/);
  assert.match(html, /^<div data-block="chart"><table>/);
  assert.doesNotMatch(html, /block:chart/);
});

test("tables also come rendered, for cells with code or links", () => {
  const { calls, components } = recorder();
  const source = [
    "<!-- block:chart -->",
    "",
    "| Task | Why |",
    "| ---- | --- |",
    "| html | `<script>` got [through](a.md) |",
    "",
    "<!-- /block:chart -->",
  ].join("\n");

  render(source, components);

  const [row] = calls[0].table.rows;
  const [htmlRow] = calls[0].table.htmlRows;

  assert.equal(row.Why, "`<script>` got [through](a.md)");
  assert.equal(
    htmlRow.Why,
    '<code>&lt;script&gt;</code> got <a href="a.md">through</a>',
  );
});

test("a table right after the comment, no blank line, still counts", () => {
  const { calls, components } = recorder();

  render(`<!-- block:chart -->\n${TABLE}\n<!-- /block:chart -->`, components);

  assert.deepEqual(calls[0].table.columns, ["Model", "Score"]);
});

test("only the first table counts", () => {
  const { calls, components } = recorder();
  const second = "| Other |\n| ----- |\n| x     |";
  const source = [
    "<!-- block:chart -->",
    "",
    TABLE,
    "",
    second,
    "",
    "<!-- /block:chart -->",
  ].join("\n");

  render(source, components);

  assert.deepEqual(calls[0].table.columns, ["Model", "Score"]);
});

test("a short row's missing cells are empty strings", () => {
  const { calls, components } = recorder();
  const source = [
    "<!-- block:chart -->",
    "| Model | Score |",
    "| ----- | ----- |",
    "| Qwen  |",
    "<!-- /block:chart -->",
  ].join("\n");

  render(source, components);

  assert.deepEqual(calls[0].table.rows, [{ Model: "Qwen", Score: "" }]);
  assert.deepEqual(calls[0].table.htmlRows, [{ Model: "Qwen", Score: "" }]);
});

test("a self-closing block has no content and no table", () => {
  const { calls, components } = recorder();

  render('<!-- block:list {"limit": 3} /-->', components);

  assert.equal(calls[0].name, "list");
  assert.deepEqual(calls[0].options, { limit: 3 });
  assert.equal(calls[0].html, "");
  assert.equal(calls[0].table, null);
});

test("options may span lines, to keep long ones under 80 columns", () => {
  const { calls, components } = recorder();
  const source = [
    "<!-- block:chart {",
    '  "value": "Score",',
    '  "title": "Runs"',
    "} -->",
    "",
    TABLE,
    "",
    "<!-- /block:chart -->",
  ].join("\n");

  render(source, components);

  assert.deepEqual(calls[0].options, { value: "Score", title: "Runs" });
  assert.equal(calls[0].table.rows.length, 2);
});

test("escaped dashes carry --> inside options", () => {
  const { calls, components } = recorder();

  render('<!-- block:list {"arrow": "\\u002d\\u002d>"} /-->', components);

  assert.deepEqual(calls[0].options, { arrow: "-->" });
});

test("options are optional", () => {
  const { calls, components } = recorder();

  render("<!-- block:box -->\ntext\n<!-- /block:box -->", components);

  assert.deepEqual(calls[0].options, {});
});

test("blocks nest, and the inner one renders first", () => {
  const { calls, components } = recorder();
  const source = [
    "<!-- block:box -->",
    "<!-- block:chart -->",
    TABLE,
    "<!-- /block:chart -->",
    "<!-- /block:box -->",
  ].join("\n");

  const html = render(source, components);

  assert.deepEqual(calls.map((call) => call.name), ["chart", "box"]);
  assert.match(html, /data-block="box"><div data-block="chart">/);
});

test("a nested block's table belongs to it, not to the outer block", () => {
  const { calls, components } = recorder();
  const source = [
    "<!-- block:box -->",
    "<!-- block:chart -->",
    TABLE,
    "<!-- /block:chart -->",
    "<!-- /block:box -->",
  ].join("\n");

  render(source, components);

  const [chart, box] = calls;

  assert.deepEqual(chart.table.columns, ["Model", "Score"]);
  assert.equal(box.table, null);
});

test("a block works inside a list item when both comments are in it", () => {
  const { calls, components } = recorder();
  const source = [
    "- item",
    "",
    "  <!-- block:box -->",
    "",
    "  text",
    "",
    "  <!-- /block:box -->",
  ].join("\n");

  const html = render(source, components);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].html, "<p>text</p>\n");
  assert.match(html, /<li>[\s\S]*data-block="box"/);
});

test("other comments and other namespaces pass through untouched", () => {
  const { calls, components } = recorder();
  const source = "<!-- a note -->\n\n<!-- wp:paragraph -->\n\nplain";

  const html = render(source, components);

  assert.equal(calls.length, 0);
  assert.match(html, /<!-- a note -->/);
  assert.match(html, /<!-- wp:paragraph -->/);
});

test("Markdown inside a block renders as Markdown", () => {
  const { calls, components } = recorder();

  render("<!-- block:box -->\n\n**bold**\n\n<!-- /block:box -->", components);

  assert.equal(calls[0].html, "<p><strong>bold</strong></p>\n");
});

test("the env passed to render reaches the component", () => {
  const { calls, components } = recorder();
  const env = { page: { url: "/x/" } };

  render("<!-- block:list /-->", components, env);

  assert.equal(calls[0].env, env);
});

// ---- Namespaces -------------------------------------------------------

test("a custom namespace replaces the default", () => {
  const { calls, components } = recorder();
  const source = "<!-- lab:list /-->\n\n<!-- block:list /-->";

  const html = render(source, components, {}, { namespace: "lab" });

  assert.equal(calls.length, 1);
  assert.match(html, /<!-- block:list \/-->/);
});

test("a namespace is matched literally, not as a pattern", () => {
  const { calls, components } = recorder();
  const options = { namespace: "my.site" };

  render("<!-- myxsite:list /-->", components, {}, options);
  assert.equal(calls.length, 0);

  render("<!-- my.site:list /-->", components, {}, options);
  assert.equal(calls.length, 1);
});

// ---- Mistakes ---------------------------------------------------------

function assertFails(source, pattern, env) {
  const { components } = recorder();

  assert.throws(() => render(source, components, env), (error) => {
    assert.ok(error instanceof CommentBlockError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("a misspelled closer names both blocks and the opening line", () => {
  assertFails(
    "<!-- block:chart -->\n\ntext\n\n<!-- /block:char -->",
    /line 5: "\/char" does not match "chart", opened on line 1/,
  );
});

test("a block left open fails and names the closer to add", () => {
  assertFails(
    "<!-- block:chart -->\n\ntext",
    /"chart" is never closed; add <!-- \/block:chart -->/,
  );
});

test("a closer with no opener fails", () => {
  assertFails("text\n\n<!-- /block:chart -->", /never opened/);
});

test("an unknown component fails", () => {
  assertFails("<!-- block:pie-chart /-->", /unknown component "pie-chart"/);
});

test("a name Object.prototype has is still an unknown component", () => {
  assertFails("<!-- block:constructor /-->", /unknown component/);
});

test("options that aren't JSON fail", () => {
  assertFails(
    "<!-- block:chart {foo: false} -->\n<!-- /block:chart -->",
    /"chart" options are not valid JSON/,
  );
});

test("options that aren't wrapped in braces are malformed", () => {
  assertFails('<!-- block:list ["a"] /-->', /malformed block comment/);
  assertFails(
    "<!-- block:list {} /-->\n\n<!-- block:list null /-->",
    /malformed/,
  );
});

test("a block may not open in a list item and close outside it", () => {
  assertFails(
    "- item\n\n  <!-- block:box -->\n\n  text\n\n<!-- /block:box -->",
    /different nesting levels/,
  );
});

test("errors name the file when the build provides one", () => {
  assertFails(
    "<!-- block:nope /-->",
    /^reports\/x\.md:1: unknown component/,
    { page: { inputPath: "reports/x.md" } },
  );
});

test("errors carry the line as a number", () => {
  const { components } = recorder();
  const source = "text\n\n<!-- block:nope /-->";

  assert.throws(() => render(source, components), (error) => {
    assert.equal(error.name, "CommentBlockError");
    assert.equal(error.line, 3);
    return true;
  });
});

test("markdown-it without html fails, instead of printing comments", () => {
  const { components } = recorder();
  const md = new MarkdownIt();

  md.use(commentBlocks, { components });

  assert.throws(() => md.render("<!-- block:list /-->"), /`html` option/);
});
