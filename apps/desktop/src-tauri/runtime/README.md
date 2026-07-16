# Release assembly target

Release automation replaces the contents of this directory with the signed,
target-specific runtime bundle. Development source trees are never accepted as
desktop sidecars.

The finished directory must contain `sidecars.manifest.json`, its detached
`sidecars.manifest.json.minisig` signature, the Go daemon, a relocatable pinned
Python environment with its exact interpreter, the worker project and
`uv.lock`, generated Python contracts, the competitive-pulse fixture, and
optionally the built dashboard. Every file in the environment, worker,
generated-contract and dashboard roots must be listed in the signed manifest.
The desktop never executes `uv`, a system interpreter, `PATH` lookup or a user
package cache. See `../examples/sidecars.manifest.example.json`.
