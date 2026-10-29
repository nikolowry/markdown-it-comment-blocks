#  AGENTS.md

Notes for coding agents and contributors. The [README](README.md)
says what the plugin does and how to use it. Read it, then
`comment-blocks.js` and `comment-blocks.test.js`, before you change
anything.

##  Commands

```bash
npm ci
```

```bash
npm test
```

CI runs the tests on Node 22, 24 and 26, then again against
markdown-it 14.3.3, the oldest release the peer range allows. To run
that check locally:

```bash
npm install --no-save markdown-it@14.3.3 && npm test
```

Run `npm ci` afterward to put the pinned version back.

##  Settled design

These choices are deliberate. Bring evidence before you change one.

**Markdown-first.** A file that uses these blocks must still read as
plain Markdown on GitHub, where comments are hidden. Don't add syntax
that shows up there.

**The grammar comes from WordPress block comments.**
`<!-- ns:name {json} -->` opens a block, `<!-- /ns:name -->` closes
it, and `<!-- ns:name {json} /-->` is a block with no content. Each
comment sits on its own line. Only the plugin's namespace is read;
every other comment passes through untouched.

**Options are strict JSON**, read by `JSON.parse`. The grammar only
accepts `{...}`. There is no JSON5 and no parser dependency. Options
may span lines to stay under 80 columns.

**Mistakes fail loudly.** An unknown component, bad JSON, a closer
that doesn't match, a block left open, or open and close at different
nesting levels each throws `CommentBlockError` with `file:line`. A
silent fallback would ship a table where a chart was meant to be, so
don't add a lenient mode or a warning that lets the build go on.

**A component is a plain function**, `(block) => html`, with no
template engine. The README's "The block" section is the contract for
what a component receives.

**It runs as the last core rule**, pushed when `md.use` is called.
Each block collapses into one `comment_block` token, and the inner
tokens move to `meta.children`. markdown-it's own core rules must
reach those tokens first. When the rule ran right after `inline`,
`text_join` missed them, and an escape inside a block rendered as
`<>`. A plugin used after this one that walks `state.tokens` must
also look in `meta.children`. The README's "With other plugins"
section is the public side of this.

##  Dependencies

The plugin has no runtime dependencies, and that is a feature.
markdown-it is a peer. Adding a dependency needs a strong reason;
name what it pulls in, transitive packages included.

The peer floors, 14.3.3 and 15.0.3, are the first releases in each
line with every published security fix. A change to the peer range
also changes the floor step in `.github/workflows/ci.yml` and the
Install section of the README.

##  Code style

- Hard 80-column limit, in code, comments and Markdown.
- Generous vertical whitespace. Negative space beats line economy.
- One condition per line.
- Guard clauses that return early, not `else` or `else if` chains.
- Constants at the top of the file.
- Define a function before the code that calls it, so the file reads
  in call order.
- Write functions out rather than compressing them to one-liners.
- Section headers are `// ---- Name ---` rules that end at column 74.
- Filenames use dots or hyphens, never underscores.

Comments explain why, in full sentences.

##  Tests

Every behavior has a test in `comment-blocks.test.js`. A test's name
is a sentence that states the behavior. Mistakes go under the
Mistakes header and use `assertFails`.

##  Writing

The README, comments and commit bodies use AP style at a ninth-grade
reading level. A change in behavior also updates the README.

##  Commits

- Conventional commits. The body says why, not what.
- One file per commit. Files that only work together go in one
  commit.
- No commit may leave the tree broken. `npm test` passes at every
  commit.
- Name the paths: `git commit -- <paths>`, so nothing staged earlier
  rides along.
- Commit each change when it's made. Don't amend or stack revisions
  onto an earlier commit.

##  Releases

Publishing a GitHub release runs `.github/workflows/publish.yml`,
which tests the tagged commit and publishes it to npm with
provenance. Bump `version` in `package.json` first; the workflow
stops if the tag doesn't match. Never run `npm publish` by hand, and
ask before you tag a release.

A release runs the workflow as it stood at the tagged commit, so a
fix to the workflow needs a new commit and a new tag. npm may hold a
publish until the maintainer approves it with 2FA.

`files` in `package.json` ships only `comment-blocks.js`; npm adds
the README, LICENSE and `package.json`. Check `npm publish --dry-run`
after you touch `package.json`.

`.npmrc` sets `ignore-scripts=true`, so no dependency's install
scripts run, and `save-exact=true`, so new dependencies are pinned.
Keep both.

##  License

AGPL-3.0-or-later. A new dependency must have a license compatible
with it.
