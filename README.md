#  markdown-it-comment-blocks

A [markdown-it](https://github.com/markdown-it/markdown-it) plugin
that turns HTML comments into components. The same Markdown file
reads as plain Markdown on GitHub and builds a richer page on your
site.

GitHub and most Markdown viewers hide HTML comments. Wrap a table in
a pair of them, and GitHub shows the table. Your site hands the same
table to a component, which can draw it as a chart:

```markdown
<!-- block:bar-chart {"value": "Score"} -->

| Model | Score |
| ----- | ----- |
| Qwen  | 23    |
| Gemma | 22    |

<!-- /block:bar-chart -->
```

The grammar borrows from WordPress block comments. The plugin has no
dependencies of its own, and it doesn't care how a component draws:
a template, a plain function, anything that returns HTML. It started
in the [Saxby lab](https://github.com/saxby-tools/lab)'s site, which
draws its report charts from Markdown tables this way.

##  Install

```bash
npm install markdown-it markdown-it-comment-blocks
```

It needs Node 22 or later and markdown-it 14 or 15.

##  Use

Give the plugin one function per component. Each takes a block and
returns HTML:

```js
import MarkdownIt from "markdown-it";
import commentBlocks from "markdown-it-comment-blocks";

const md = new MarkdownIt({ html: true });

md.use(commentBlocks, {
  components: {
    "bar-chart": (block) => {
      const column = block.options.value;
      const bars = block.table.htmlRows.map((row) => {
        return `  <li style="--value: ${row[column]}">${row.Model}</li>\n`;
      });

      return `<ul class="bar-chart">\n${bars.join("")}</ul>\n`;
    },
  },
});

md.render(source);
```

Given the Markdown above, that renders:

```html
<ul class="bar-chart">
  <li style="--value: 23">Qwen</li>
  <li style="--value: 22">Gemma</li>
</ul>
```

`html: true` is required. Without it, markdown-it prints comments as
text, so the plugin throws rather than let them show on the page.

A component's output goes into the page as it is. The example reads
`htmlRows`, which markdown-it has already escaped. `rows` holds the
raw Markdown, which suits numbers and matching; escape it before you
print it into HTML.

###  With Eleventy

Eleventy's markdown-it has `html` on already. It also passes each
page's data as `env`, so errors name the file.

```js
// eleventy.config.js
import commentBlocks from "markdown-it-comment-blocks";

import components from "./components.js";

export default function (eleventyConfig) {
  eleventyConfig.amendLibrary("md", (md) => {
    md.use(commentBlocks, { components });
  });
}
```

##  Grammar

The grammar follows WordPress block comments, with `block` as the
default namespace:

- `<!-- block:name {...} -->` opens a block.
- `<!-- /block:name -->` closes it.
- `<!-- block:name {...} /-->` is a block with no content.

A name starts with a lowercase letter, followed by lowercase letters,
digits and hyphens. Options are optional. When present, they're a
strict JSON object: quote every key, and leave out trailing commas.
Long options may span several lines:

```markdown
<!-- block:bar-chart {
  "value": "Score",
  "title": "Hidden tests passed, out of 24"
} -->
```

Put each comment on its own line. Keep both comments of a block at
the same level, not one inside a list item or quote and the other
outside it. Blocks nest. The inner block renders first, and its
output lands in the outer block's `html`.

Comments outside the namespace pass through untouched, so ordinary
notes and other tools' comments keep working.

Options can't contain `-->`, because HTML ends the comment there.
Write the dashes as `--`, which JSON reads back as `--`.
WordPress does the same.

##  Options

`components` maps each name to the function that draws it. A name
with no function stops the build.

`namespace` is the prefix before the colon, `"block"` by default.
Only comments in it are read. The default says what the comment is to
anyone reading the raw file. Pick your own, such as your site's name,
if another tool already reads `block:` comments.

```js
md.use(commentBlocks, { namespace: "docs", components });
```

##  The block

Each component gets one object:

| Field | Holds |
| --- | --- |
| `name` | The component's name, such as `"bar-chart"` |
| `options` | The parsed options, or `{}` when there are none |
| `line` | The opening comment's line, counting from 1 |
| `env` | The `env` passed to `md.render`, such as Eleventy's page data |
| `html` | The Markdown inside, rendered; `""` for a block with no content |
| `table` | The first table directly inside, or `null` |

`table` holds `columns`, the header cells in order, and two arrays
with one object per row, keyed by column. `rows` holds each cell's
raw Markdown, trimmed. `htmlRows` holds the same cell rendered, for
cells with links, code or emphasis. Given this table:

```markdown
| Task | Why                            |
| ---- | ------------------------------ |
| html | `<script>` got [through](a.md) |
```

the block's `table` is:

```js
{
  columns: ["Task", "Why"],
  rows: [{ Task: "html", Why: "`<script>` got [through](a.md)" }],
  htmlRows: [
    {
      Task: "html",
      Why: '<code>&lt;script&gt;</code> got <a href="a.md">through</a>',
    },
  ],
}
```

"Directly inside" means a table in a nested block belongs to that
block, not to the one around it. A row with fewer cells than columns
gets empty strings for the rest.

##  Errors

The plugin doesn't guess. A mistake throws a `CommentBlockError`,
which stops the build and names the file and line. These all throw:

- a name with no component;
- options that aren't valid JSON, or aren't an object in braces;
- a comment in the namespace that doesn't fit the grammar, such as a
  name with a capital letter;
- a closer that doesn't match its opener, or that has no opener;
- a block left open;
- a block that opens and closes at different levels.

Given this, with the closer misspelled:

```markdown
<!-- block:bar-chart -->

text

<!-- /block:bar-chrat -->
```

the build stops with:

```text
docs/models.md:5: "/bar-chrat" does not match "bar-chart", opened on line 1
```

The error's `line` property holds the line as a number. The file name
comes from `env.page.inputPath`, which Eleventy sets. Other builds can
pass the same shape:

```js
md.render(source, { page: { inputPath: "docs/models.md" } });
```

Without it, the message starts with `line 5:` instead.

##  Develop

```bash
npm ci
```

```bash
npm test
```

Questions and bugs go to
[GitHub issues](https://github.com/nikolowry/markdown-it-comment-blocks/issues).

##  License

[AGPL-3.0-or-later](LICENSE). The license covers the plugin's code.
In general it doesn't cover a program's output, such as the pages you
build with it; see the
[FSF's FAQ](https://www.gnu.org/licenses/gpl-faq.html#WhatCaseIsOutputGPL).
