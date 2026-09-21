# Security Policy

## Supported versions

Only the latest published version of `@promontory-studio/dokimasia` is supported.

## Scope

This package has no runtime dependencies, constructs no client, reads no environment variable and
makes no network call of its own. The SDK import is type-only. A report about a leaked key or
credential is therefore almost certainly about the host application that supplied the client, not
about this repo.

In scope here:

- A way to make `bucketRejection` classify an operational failure (`unreachable`, `refused`) as a
  quality failure, or the reverse — the bucket order is load-bearing and a way around it is a real
  defect.
- A way to make `summarize` or `rankStacks` report a pass that did not happen, or omit a failure
  that did.
- Anything in `testing/fake-openai.ts` that could bind to an unintended interface or outlive the
  test that started it.

Out of scope: a host that hardcodes a key, a probe that logs a response body, and the contents of
anyone's `inference.config.json`.

## Reporting a vulnerability

Please use GitHub's [private vulnerability reporting](https://github.com/promontory-studio/dokimasia-rk/security/advisories/new)
rather than opening a public issue. Include the version and a minimal reproduction.

There is no bug bounty. We aim to acknowledge reports within 5 business days.
