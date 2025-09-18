# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaleSpinner Compiler (tsp-compiler) is a TypeScript-based compiler for the TaleSpinner language (.tsp files), a domain-specific language for creating interactive fiction/text adventure games. The compiler processes TSP source files and generates JSON output files that can be consumed by a game engine.

## Common Development Commands

### Building and Running
```bash
# Watch mode for TypeScript compilation
npm run tswatch
# or
./startwatch.bat

# Run the compiler (after building)
node ./dist/tsp-compiler/src/main.js tspSrc tspOut
# or
./run.bat

# The compiler expects two arguments:
# 1. Input directory containing .tsp files
# 2. Output directory for generated .json files
```

### Testing
```bash
# Run all tests (npm test is not configured, use npx instead)
npx jest

# Run tests in watch mode
npx jest --watch

# Run a specific test file
npx jest tests/flow.test.ts
```

### TypeScript Compilation
```bash
# Compile TypeScript to JavaScript
npx tsc

# Compile in watch mode
npx tsc --watch
```

## Architecture Overview

### Core Components

1. **Lexer** (`src/Lexer.ts`): Tokenizes TSP source files into a stream of tokens. Handles brackets, keywords, strings, and special characters.

2. **Parser** (`src/Parser.ts`): Converts token stream into an Abstract Syntax Tree (AST). Processes entities, macros, and nested structures.

3. **Processor** (`src/Processor.ts`): Main orchestrator that coordinates the compilation pipeline. Handles file I/O and error reporting.

4. **Verification** (`src/Verification.ts`): Validates the parsed AST for semantic correctness, checking entity references, states, and locations.

5. **Definitions** (`src/Definitions.ts`): Contains language definitions, valid keywords, and entity types.

### Data Flow

1. TSP source files → Lexer → Token stream
2. Token stream → Parser → AST
3. AST → Verification → Validated AST
4. Validated AST → JSON output files

### TSP Language Key Concepts

- **Entities**: Game objects defined with `:: EntityName --type`
- **Macros**: Commands in square brackets like `[settings]`, `[prop]`, `[scenery]`
- **States**: Entity properties that can change during gameplay
- **Locations**: Where entities exist in the game world
- **Links**: Navigation connections using `[[target `DIRECTION`]]` format

### Output Files

The compiler generates two types of JSON files:
- `.tsp.json`: Primary compiled output
- `.tso.json`: Support/metadata file

### Current Development Focus

The project is currently on the `function-parameters` branch, implementing parameter support for function macros. The todo.md file contains extensive notes on completed features and ongoing work.

### Error Handling

The compiler uses a custom error system (`src/Errors.ts`) with:
- Line and column tracking for source locations
- Error severity levels
- Detailed error messages for debugging

### Testing Strategy

Tests are located in `/tests/` using Jest with ts-jest for TypeScript support. The main integration test (`flow.test.ts`) processes sample TSP files through the full compilation pipeline.

### Important Notes

- No linting configuration exists; code style is not enforced
- The project uses Windows batch files for convenience scripts
- Strict TypeScript checking is enabled
- The compiler expects specific directory structures for input/output