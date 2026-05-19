
# Changelog

## Fork (@endbug/github-label-sync)

This fork continues `github-label-sync` at [EndBug/github-label-sync](https://github.com/EndBug/github-label-sync).
The upstream Financial Times repository is no longer public; **3.0.0** is the continuity release on npm under `@endbug/github-label-sync`.

### Fork-specific (3.0.0)

  * Publish as `@endbug/github-label-sync` on npm (public scoped package).
  * Repository, issue tracker, and documentation point at the EndBug fork.

## 3.0.0

Aligned with upstream `github-label-sync@3.0.0` (see commit history since 2.0.0). Notable changes:

  * **Breaking:** Node.js 20+ required (`engines.node`).
  * Label merge support.
  * `delete` flag on labels (including alias behaviour).
  * Label format validation before sync.
  * Dependency and security updates (got, mocha, etc.).
  * README/requirements updated for Node 20+.

## 2.0.0 (2020-06-03)

  * Drop support for node 4,5,6,7,8,9,10,11.

## 1.3.0 (2017-08-15)

  * Support URLs in the `--labels` flag

## 1.2.1 (2017-05-16)

  * Support repositories with a lot of labels

## 1.2.0 (2016-04-25)

  * Update the default label set
    * Add "status: good starter issue"
    * Add "type: breaking"
    * Add "type: discussion"
    * Add alias for "status: wontfix"

## 1.1.0 (2016-03-15)

  * Update the default label set
    * Add alias for "status: help wanted"

## 1.0.0 (2016-03-15)

  * Initial release
