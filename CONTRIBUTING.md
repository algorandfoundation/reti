# Contributing to Réti Open Pooling

We love your input! We want to make contributing to Réti Open Pooling as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, track issues and feature requests, and manage contributions. To contribute code changes:

1. Fork the repo and create your branch from `dev`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Pull Request Process

1. Update the README.md or relevant documentation with details of changes to the interface, if applicable.
2. The PR title should follow our semantic commit message format (see below).
3. Your pull request will be reviewed by the maintainers. Once approved, a maintainer will merge it.

## Commit Message Format

We follow very precise rules over how our Git commit messages should be formatted. This format leads to more readable messages that are easy to follow when looking through the project history.

Each commit message consists of a header, a body, and a footer:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

### Scope

The scope could be anything specifying place of the commit change. For example:

- contracts
- ui
- nodemgr
- docs

### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

## Development Setup

Please refer to the [README.md](README.md) for detailed setup instructions, including:

- Prerequisites (Docker, AlgoKit, PNPM)
- Quick start guide for local development
- FNet development setup
- Additional resources and documentation

The README contains the most up-to-date and complete instructions for getting the development environment running properly.

## Testing

- Run contract tests:

  ```bash
  cd contracts
  pnpm run test
  ```

  - Run UI tests:

  ```bash
  cd ui
  pnpm run test
  ```

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/algorandfoundation/reti/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/algorandfoundation/reti/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Documentation

For detailed information about the protocol, its objectives, and technical implementation, please refer to our [GitBook documentation](https://txnlab.gitbook.io/reti-open-pooling).

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
