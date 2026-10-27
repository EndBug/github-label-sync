
# Changelog

## 4.0.0

Breaking changes when upgrading from `@endbug/github-label-sync@3.0.0`:

  * Node.js 20+ is still required. That requirement was already in 3.0.0.
  * Package entry points moved. The package is `"type": "module"` and exports `dist/esm/index.js` and `dist/cjs/index.cjs`. `require('@endbug/github-label-sync')` is still the sync function and still has `.defaults`. ESM has a default export and a named `githubLabelSync`. Deep imports of `lib/...` do not resolve. The CLI command is still `github-label-sync`.
  * The HTTP client is `@octokit/rest` instead of `octonode`. Failures are Octokit request errors (`status`, `request.method`, `request.url`). Callers that read octonode fields (`error.endpoint`, `error.statusCode`, `error.method`) need to change.
  * The repo argument must be exactly `owner/repo`. `owner/repo/extra` throws `Invalid repo format`.
  * An omitted `color` keeps the color already on the repo. An empty string is also treated as "not configured": the client omits `color` so GitHub can apply its default on create, or keep the current color on update.
  * Duplicate label names in the CLI throw `LabelFileError` when the objects differ. Names that exist on `Object.prototype` (`constructor`, `toString`, `__proto__`) work as real labels.
  * `--endpoint` / `endpoint` accepts a host or an absolute URL: `mydomain.com`, `mydomain.com/api/v3`, `https://mydomain.com`, `https://mydomain.com/api/v3`, the same forms with a trailing slash, and `http://` for appliances that do not speak TLS. Omit it for github.com. A value that is not a host or an absolute URL throws before any request. Paths other than `/` and `/api/v3` are rejected.

Fixes and behavior:

  * The installed CLI runs when it is launched through the npm symlink.
  * Issue search for merges uses `GET /repos/{owner}/{repo}/issues` with pagination and `state: all`, so pull requests are included.
  * `new_name` is sent on label update only when the name changes.
  * An empty description is sent as `""`, which clears an existing description. Omitting the property still keeps the current description.
  * A label file whose root is not an array throws `LabelFileError` and does not call the GitHub API. An explicit empty array still deletes repo labels that are not in the config.
  * A configured label that lists its own name as an alias, including a case-only difference such as `Bug` with alias `bug`, is applied once. It is not also merged and deleted.
  * `FF0000`, `#ff0000`, and `ff0000` are the same color. A single leading `#` is removed and hex letters are compared in lowercase.
  * Creates and renames finish before merges add the destination label. Labels that are not in the config are deleted only after merges have moved their issues and pull requests.
  * Merge log lines say that issues and pull requests move onto the destination label and that the old label is then deleted. Clearing a description is included in the log.
  * `~/labels.json` expands with the home directory. `--help` shows `labels.json` as the `--labels` default.
  * The release workflow runs the test suite before it publishes.

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
