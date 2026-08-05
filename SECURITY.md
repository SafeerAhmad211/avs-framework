# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/SafeerAhmad211/avs-framework/security/advisories/new),
or by email to `safeer@nautaresearchlabs.com`.

Please do not open a public issue for a vulnerability.

Expect an acknowledgement within five business days.

## Scope

This library performs statistical analysis on data you supply. It makes no
network requests, opens no sockets, and executes no user-supplied code. The
realistic risk surface is therefore narrow, and the following are in scope:

- Anything causing the library to write, transmit, or log applicant data.
- Deserialization or file-parsing issues reachable through the documented API.
- Dependency vulnerabilities affecting the declared dependency set.

**Statistical correctness issues are not security vulnerabilities**, but they are
taken at least as seriously. Report those through the
[methodological concern](https://github.com/SafeerAhmad211/avs-framework/issues/new?template=methodology_concern.yml)
issue template, publicly, so the correction is on the record.

## A note on the data you analyze

This framework is designed to run on de-identified, aggregate applicant flow
data. It never requires names, contact details, or government identifiers, and
the name-swap security test uses synthetic resumes exclusively. If your workflow
requires supplying real applicant PII to this library, that is a defect in the
workflow — please open an issue so the interface can be fixed.
