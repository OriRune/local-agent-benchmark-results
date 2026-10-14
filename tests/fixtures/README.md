# Synthetic publication fixtures

`release-v1` is a tiny disposable campaign exported and assembled by the private
publication test helpers. Its questions, answers and scores are synthetic test
inputs. It exercises the real schema/hash/release importer without depending on
Python or the harness at test time. Never select this fixture as production data.

Regenerate intentionally when the contract changes, using `ExportTests.setUp`,
`ExportTests.export` and publication `assemble` in the private repository, then
copy only the assembled public fixture here. No campaign snapshots or secrets
belong in this directory.
