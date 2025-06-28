# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with 
code in this repository.

## Project Overview

This is the ks-v2 project, chess game implementation primarily targeting 
Kriegspiel variant of chess, but also able to handle other rule sets such as 
regular chess and Fischer chess (Chess960). 

## Project Structure

The project is a Python-based application (evidenced by the comprehensive Python
.gitignore configuration). The codebase is currently consists only of the 
minimal backend environment in the `backend` folder. The backend is implemented
in Python with uv as the package manager. All commands, such as ruff, should 
be wrapped in uv calls. 

## Development Environment

This project is set up for Python development with support for multiple Python 
package managers and tools:

- **Package Management**: Supports pip, pipenv, poetry, pdm, pixi, and uv 
(based on .gitignore patterns)
- **Testing**: Configured for pytest, coverage, hypothesis, tox, and nox
- **Type Checking**: Supports mypy, pyre, and pytype
- **Linting**: Configured for ruff (based on .ruff_cache/ in .gitignore)
- **Documentation**: Supports Sphinx and mkdocs
- **Web Frameworks**: Prepared for Django and Flask development

## Git Configuration

- **Repository**: git@github.com:Kriegspiel/ks-v2.git
- **Main Branch**: main
- **License**: MIT License (Copyright 2025 Kriegspiel)

## Development Workflow

Since the project is in its initial state, standard Python development commands 
will need to be established once the project structure is created. Common Python
 project commands typically include:

- Virtual environment setup
- Dependency installation
- Testing with pytest
- Linting with ruff
- Type checking with mypy

## Important Notes

- The project currently contains only foundational files (LICENSE, .gitignore, 
git configuration)
- No source code, dependencies, or build configuration exists yet
- The comprehensive .gitignore suggests preparation for a full-featured Python 
application
- Claude Code configuration is set up in .claude/settings.local.json