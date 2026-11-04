# Contributing

Thank you for your interest in **ComfyUI ND UI Builder**.

## Before you open a pull request

- Read the [Individual Contributor License Agreement](CLA-INDIVIDUAL.md). **By submitting a contribution to this repository (for example by opening a pull request) you agree to its terms.** In short: you keep the copyright in your work; your contribution is published under the project's license, the GNU AGPL-3.0, and you also allow the copyright holder to license it under other terms in the future.
- Submit only your own work. Third-party material is accepted only under a permissive license (for example MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, Zlib) and only if you state the original copyright holder, the license and a link to the source in the pull request description and in the header of the file.
- Do **not** submit material under copyleft licenses (GPL, LGPL, AGPL, MPL, EPL, CC BY-SA and the like) or under licenses that restrict commercial use (CC BY-NC, "non-commercial", "research only" and the like), and do not submit material whose license you do not know.
- If you contribute as part of your job, make sure your employer allows it (see section 3 of the agreement).

## Development notes

- Do not start big features without writing first (open an issue), to avoid duplicate work.
- Keep changes focused, explain them in the pull request and update the documentation when behaviour changes.
- New source files start with `SPDX-License-Identifier: AGPL-3.0-only` and the copyright line of the author of the file.
- Interface texts are English keys with translations in `js/i18n/ru.json` and `js/i18n/zh.json`; `python3 tools/i18n_tool.py check` must pass.
- Tests are in `tools/bench` (see `tools/bench/README.md`); run the relevant ones before you submit.

Questions about the license or the agreement: ivan.kvento@gmail.com.
