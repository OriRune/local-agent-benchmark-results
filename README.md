# Agent benchmark results

Standalone Astro/React results site. This directory is the boundary
of the eventual public repository: never push the parent harness repository.

Requires Node >=22.12.0. Run `npm ci`, `npm run types:generate`, `npm run check`.
Public schemas live under `contracts/`; their copies are checksum-verified.
Generated TypeScript declarations must come from that schema pack.

A build requires an imported, validated release. Synthetic fixtures are test
inputs only and must not be used as public benchmark results. No OpenAI credential is
needed or permitted in this website. Model summaries arrive as reviewed data
with immutable generating-model attribution.

Import a locally assembled public release and verify the site:

```sh
npm run data:import -- /absolute/path/to/public-release
npm run test
npm run check
npm run build
npm run test:e2e
```

The importer verifies the release before selecting it. Keep the current
`public/data` package when copying this directory into a standalone repository;
do not copy the source campaign, private catalogs or publication working files.
The complete release verifier also runs before each build.

Imports preserve existing immutable object and release bytes. A conflicting
object, symlinked destination or invalid copied graph aborts before promoting
`latest.json`. Imports use an exclusive `public/data/.import.lock` containing
the owning PID and release ID; a second importer fails rather than racing it.
After an interrupted process, inspect that PID before removing a stale lock and
retrying. Unselected immutable files left by a failed import are safe to reuse.

Browser checks need Playwright Chromium (`npx playwright install chromium`),
or an existing compatible executable selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/absolute/path/to/chrome`. They start and stop
their own localhost preview server on port 4321 against the already-built
`dist` directory. For manual inspection, run
`npm run preview -- --host 127.0.0.1 --ignore-lock`; stop it with Ctrl-C.
The foreground flag prevents Astro's agent mode from detaching a preview daemon.
Screenshots and failure traces are saved under ignored `test-results/`.

Current browser coverage includes desktop and 360px mobile overview-to-evidence
navigation, exact-byte downloads, pinned comparisons with question restoration,
back/forward suite selection, unavailable-edition messages and persisted themes.
Model pages expose baseline configuration/condition selectors, matched thinking
tradeoffs, separate sampled repetitions and deterministic suggested comparisons.
Shared weight-format tables compare the tested quants of one checkpoint. Explicit
family metadata connects Instruct and Thinking/Reasoning versions that use separate
GGUF checkpoints; these comparisons never become single-checkpoint toggle claims.
Native reasoning has its own assessed status, backed by saved diagnostics. Observed
reasoning despite an off request retains the raw request and a distinct label.
Family and quant tables show quality alongside timing, coverage, execution-setting
differences and links to the original answers. Download size is not a RAM-fit claim.
An approved **Choosing a quant** assessment is shared by the variants of one
checkpoint, with its own analyst attribution and dated supporting charts. Adding
a quant does not rewrite an older assessment or insert it into that assessment's
charts. An uncovered selection is labeled explicitly; changed supporting results
invalidate the old assessment. Release validation independently reconstructs these
dependencies. Native Instruct/Reasoning families retain separate checkpoint
identities and are never folded into this section.
Their question links select the matching recorded answer. Overview filters and
model selections are URL-backed; a shared comparison tray carries working
selections between the overview and model pages, with explicit removal controls.
This does not establish complete accessibility, archive or deployment coverage.

Approved summaries are imported as immutable data, with a referenced fact packet.
The standalone verifier reconstructs the packet from the dataset and checks the
summary's recorded approval, dependency hash, numeric claims, coverage limitations
and provenance graph before import. Model pages show analysis only for the selected
configuration, retaining its stored analyst/date and contributor identities.
Unreviewed or missing analysis gets factual copy without an authorship badge.
Claims render as escaped text with numeric values from validated references and
expandable evidence. Summary revision selection, generation and actual editorial
review happen in the private publication workspace, never in Vercel or the browser.

`tests/fixtures/summary-release-v1` contains explicitly synthetic model responses
and review attestations for offline tests. It is outside `public/` and is not
included in normal site output. Summary evidence links preserve the selected
edition through the archive renderer, including the recorded configuration and
condition. Retained-edition browser tests verify old answers and analyst
attribution after a newer edition is imported; hosted behavior still needs the
deployment checks described below.

Vercel will use static output in `dist`; see the official [Astro Vercel guide](https://docs.astro.build/en/guides/deploy/vercel/).
React controls use [Astro's official integration](https://docs.astro.build/en/guides/integrations-guide/react/).

Retained editions are part of the deployment, not disposable caches.
`npm run data:validate` checks every ID in `public/data/editions.json`, requires the
installed manifest inventory to match, and verifies each complete object graph.
Do not delete an older edition's objects merely because the latest edition no
longer references them. To select a previous intact release locally, import its
original release package again; the importer verifies it and promotes its ID last,
while retaining later editions and their immutable bytes. This local selection
rehearsal does not verify a Vercel deployment rollback.

`tests/e2e/editions.spec.ts` uses isolated temporary imports and browser request
routing to test a synthetic regrade, old/new pinned comparisons, exact answers,
old analyst attribution, and rollback on desktop and mobile. The fixture's
responses and editorial approvals are simulated and must never be copied into
`public/data` for a production release. Its private-repository regeneration script
is `tests/generate_publication_history_fixture.py`; running the website tests does
not require that script, Python, the harness, or API access.

Run `npm run scan:dist` after building and before uploading. It independently
verifies all retained release graphs, scans plain and gzip contents for configured
private identifiers and credential patterns, inspects executable HTML, and rejects
unexpected files and symlinks. Source maps are scanned and rejected because this
site disables them. Evidence remains inert text/JSON; literal code in an answer is
not treated as a page script. The scanner does not claim to recognize every possible
secret format: keep the exporter policy and owner review as separate checks.

Findings go to ignored `.publication-reports/scan-dist.json` with paths, rule names, and
hashes; console output contains counts only, never matched values. Do not publish
that report automatically. `deployment-scan.json` pins the reviewed inline theme
and Astro hydration scripts. A dependency or theme change that alters them requires
reviewing the new code and updating those hashes. A legitimate synthetic false
positive can be recorded only with its exact path, decoded-content SHA-256, rule,
and reason in `exceptions`; changing those bytes invalidates the exception. Do not
add broad exclusions or approve a finding without inspecting it privately.

The `.github/workflows` files become active when this package is the root of the
dedicated website repository. Source-only changes build explicit synthetic data
in a disposable CI checkout; publication checks use the committed selected release,
fail if it is missing, and never generate model summaries. Both install from the
lockfile, verify contracts/types, test, build, scan, and run browser checks. These
workflows use the documented [GitHub Node setup](https://github.com/actions/setup-node)
and [Playwright browser installation](https://playwright.dev/docs/ci-intro).
They have been authored locally; a successful local run is not a GitHub Actions run.

To prepare the dedicated repository without copying the harness, run
`npm run package:site -- /absolute/new/destination`. The destination must be new
and outside this package. The command validates retained data, copies an explicit
source/configuration/test/public-data list, rejects symlinks, and writes
`PACKAGE_INVENTORY.json` with file sizes and SHA-256 hashes. It excludes the parent
harness, local dependencies, build output, `.git`, `.vercel`, environment files,
and private staging. Inspect the package, run `npm ci`, checks, build, scan and
browser tests there, then use that directory as the new repository root. An
interrupted or source-changing package operation leaves an incomplete destination
that must not be published. Packaging does not initialize or push a repository.

Vercel deployment configuration lives in `vercel.json` at the dedicated repository
root. It selects Astro static output in `dist`, installs with `npm ci`, and requires
configuration verification, type checks, the validated build, and the deployment
scan before publishing. Do not set an OpenAI API key on Vercel. Select Node 24 in
project settings and connect the dedicated website repository, with `main` as the
production branch and other branches as previews. Review the preview before
promoting a release. Keep the Vercel toolbar disabled for this site unless its
additional resources are separately reviewed against the Content Security Policy.

HTML and mutable edition pointers revalidate. Hashed assets, release manifests,
and evidence objects have immutable cache headers. Evidence downloads are served
as attachments with `application/octet-stream`, `nosniff`, and a sandboxed policy;
the viewer verifies and decodes their bytes. Page scripts use same-origin sources
and the exact inline hashes approved by the scanner. Inline styles remain allowed
for the existing chart and React style attributes. There is no blanket SPA rewrite.

Run `npm run deployment:check` to detect drift between `vercel.json` and the reviewed
policy generator. After reviewing an intentional policy or inline-script change,
run `node scripts/deployment-config.mjs --write`, inspect the diff, and rerun browser
checks. `deployment.spec.ts` applies those headers to local responses and tests
actual browser CSP enforcement; it does not emulate Vercel's routing/CDN. Hosted
verification must still check real HTTP headers, missing-route 404s, evidence byte
checksums/downloads, archive links, mobile behavior, and the selected release ID.
The configuration follows [Vercel's static configuration reference](https://vercel.com/docs/project-configuration/vercel-json)
and [Astro's Vercel deployment instructions](https://docs.astro.build/en/guides/deploy/vercel/).

For a release rollback, first verify the previous package and use `data:import` to
select it, then preview and deploy that selection while retaining all edition
objects. A Vercel deployment rollback is a separate hosting operation: select the
prior successful deployment using the hosting dashboard, then verify its real URL
and selected manifest before considering the rollback successful. Preserve newer
retained editions in a subsequent rollback release if their links must continue
working: an older deployment cannot serve editions created after it was built.
Neither a local import rollback nor these instructions prove a hosted rollback.

Model analyses are generated privately with GPT Astra through `codex exec` and
ChatGPT account authentication. The public site displays the stored generation
route and CLI/model identity; older API-authored revisions retain their original
attribution. Neither Codex login nor an API key belongs in this repository or on
Vercel. Import only approved analysis objects produced by the owner's publication
workflow.

Long evidence is displayed in bounded text pages with case-sensitive literal
search across the complete object. Paging does not truncate downloads: their
bytes still verify against the original object hash.

## Updating results, models, tests and summaries

The website consumes release packages. Prepare changed data in the owner's private
publication workspace, then import the assembled release here. The private
`publication/README.md` contains the executable exporter and summary commands;
those tools and source catalogs are deliberately absent from this website package.

| Update | Preparation in the private workspace |
| --- | --- |
| Additional results | Capture a stable snapshot, export and validate it, then recompute facts. Regenerate only summaries whose subject evidence changed. |
| New model or quantization | Update `publication/catalogs/models.json` with checkpoint, artifact, configuration and baseline identities. Keep unknown sizes or exact GGUF URLs unknown until verified. |
| New or changed test | Update `publication/catalogs/suites.json` with scoring, selection, source terms and evidence metadata. Changed questions get new versioned identities. Existing evidence types need data changes only; a new evidence type requires a renderer and contract checks. |
| New analyst or prompt | Explicitly change the private generator configuration/policy, validate access with a bounded request, and generate a new immutable revision. Earlier summaries keep their original model, settings and date. |

For Astra summaries, use the private CLI's `summaries plan`, `summaries generate`,
`summaries review` and `summaries approve` stages. Production generation uses
`codex exec` with ChatGPT account authentication. Resume the same job directory to
reuse completed analyses; do not automatically retry an uncertain invocation.
Review each claim against its linked evidence before recording a human decision.
Validation alone does not approve a draft. Preserve original machine attribution
when editing, and select approved revisions when assembling the new release.

After private `assemble` produces the release, run the import/check/build/browser
commands above, followed by `npm run scan:dist`. Preview the overview, new or changed
model/test, exact answer and summary attribution. Inspect the release change report
and an older pinned link, then deploy the dedicated website repository. Routine
result, model and existing-type test updates require no page-component edits.
Keep prior immutable editions for historical links and rollback.

## Performance and accessibility checks

With a representative real release imported and built, run
`npm run test:e2e -- performance.spec.ts accessibility.spec.ts`.
The performance checks enforce 250 KiB gzip budgets for the overview index and
serialized homepage data, 200 KiB for loaded homepage JavaScript (including
inline scripts), and no evidence-object fetch on the overview. Measurements use
Chromium at 360×800, fourfold CPU slowdown, 150 ms latency and 1.6 Mbps download
with cache disabled. They also exercise model, comparison and question pages.
Reports are local `.publication-reports/*-mobile.json`; browser screenshots live
in Playwright's disposable `test-results/` directory.

Accessibility scans use the pinned `@axe-core/playwright` development dependency
on overview, model, suite, question, comparison and edition pages in both themes
and viewport sizes. Reports preserve incomplete checks as well as violations.
Keyboard tests cover skipping navigation, searching and opening a model using
only the keyboard. Automated rules and these specific manual/keyboard checks do
not establish universal accessibility or field performance; review new controls
and evidence presentations when they are introduced.

If axe cannot determine contrast because text is partly obscured, the audit also
records its computed foreground and nearest opaque background colors. It requires
at least 4.5:1 for those samples using the [WCAG contrast calculation](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).
The report retains the original inconclusive finding; this supplemental check does
not pretend to assess occlusion itself. Keyboard table-scrolling and mobile
screenshots cover the corresponding interaction and visual states.

Question banks in newer editions support full permitted prompt text and recorded
outcome filters. Their per-suite search object loads only on interaction, and
model-page outcome filters use the selected configuration and thinking condition.
Filters select questions with at least one matching canonical attempt; they do
not change scoring denominators. Historical attempts do not enter these indexes.
Older retained editions explicitly fall back to ID/title search. Reassemble a
validated dataset with the current private exporter to add indexes as a new
immutable release; importing it requires no page-component edits.

### Withdrawing published evidence

First export, import and select a sanitized replacement that does not contain the
object to remove. The private exporter supports `withheld_objects` policy entries
with the exact public object SHA-256 and a public reason; inspect related evidence
for the same material embedded in other objects. The withdrawal workflow retires every retained edition that
contains the object, including that edition's derived indexes and analyses. It
preserves unaffected editions. It does not rewrite an immutable manifest or
silently substitute another answer for an old link.

Preview the affected editions with:

```sh
npm run data:withdraw -- --source public/data --object OBJECT_SHA256 --reason "Publication permission withdrawn."
```

Add `--out /path/to/new-data` to create a new, verified deployment-data directory.
The destination must not exist. The source directory stays unchanged. Review the
reported edition IDs, use the new directory as the site's `public/data`, then
build, scan and preview before deploying. No command here uploads or deploys it.
The command refuses to retire the selected edition; it needs the replacement
first. Re-imports that would restore withdrawn objects or editions are rejected.

`withdrawals.json` stores dated reasons and reciprocal object/edition IDs under
the versioned withdrawals contract. The selected pointer pins its checksum when
notices exist, so deleting the registry fails validation. Old pinned model,
comparison and evidence views explain withdrawal. Raw removed files return
missing-file responses; they are never replaced with different bytes under the
old hash. The registry is served with `no-store`, and the UI checks it before
loading evidence or initiating a cached download. Previously downloaded copies
and previously cached raw URLs cannot be revoked by this static website.

The checked-in `tests/fixtures/withdrawal-v2` pair is synthetic. Unit/browser
rehearsals create disposable data trees and verify preservation of the source,
removal from the new tree, old-link explanations, blocked cached downloads and a
working replacement. No real evidence has been withdrawn in the development data.

## Homepage observations

`takeaways-v1` computes optional observations from complete baseline results for
one selected suite and requested thinking mode. Quality and smaller-file cards
use the largest compatible group within one download-size band, with deterministic
identity ordering for ties between groups. The quality card lists every exact
score tie; the file-size card compares the smallest smaller artifact with the
selected highest-scoring setup, showing the recorded question or credit gap.
These are tested-setup observations, not isolated quantization effects or RAM
recommendations. Thinking cards require complete verified score and timing pairs
and report improvements, regressions, unchanged questions and mean added time.
Unsupported slots disappear. Each card exposes fact IDs, group membership,
policy/template versions and a pinned comparison link. Search does not silently
change the group or benchmark denominator.

The homepage date is explicitly the recorded campaign start, not an inferred
capture time. The full model catalog supports configuration/publisher/status
search and retains its configuration links in static HTML without JavaScript.

## Aggregate downloads and evidence coverage

The Editions page offers `/results.csv`, generated from the selected immutable
release at build time. Each row includes release/dataset/fact/configuration/condition
identities, metric and coverage, score on its original 0–1 scale, eligibility,
outcome counts and timing measurements. Null measurements are empty CSV cells;
zero remains numeric zero. This download contains no full answers or traces.
Text metadata beginning with spreadsheet formula markers (including whitespace
before a marker) or tab/newline receives a leading apostrophe. Quoting handles
commas, quotes and line breaks. Numeric values retain their signed representation.
This safety transformation applies only to CSV metadata; public JSON/text evidence
retains its permitted bytes. `/results.csv` revalidates on each deployment; keep
its embedded release ID when citing a downloaded copy.

The Tests index groups suites under the five named capabilities. Each suite and
its definition page expose availability counts for full, redacted, source-link-only,
not-recorded and withheld components. Counts include question definitions and
all saved attempts, including historical attempts; they are not a score denominator.
