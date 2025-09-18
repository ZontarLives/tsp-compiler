# Whitespace Management System Implementation Plan

## Executive Summary

This document outlines the implementation plan for replacing the brittle `reduceStructuralWhitespaceAll()` function with a new, flow-property-based `manageWhitespace()` function that provides consistent, predictable whitespace handling throughout the TaleSpinner compiler.

## Problem Statement

The current `reduceStructuralWhitespaceAll()` function is special-case oriented and fragile:
- Hard-codes specific command types (itemlink, npclink, etc.) rather than respecting flow properties
- Difficult to maintain and extend
- Prone to breaking when new command types are added
- Doesn't properly handle nested flow contexts

## Solution Overview

Implement a new `manageWhitespace()` function that:
- Respects each command's `flow` property for whitespace management
- Handles nested contexts recursively
- Provides clear, consistent rules for flow type boundaries
- Eliminates special-case handling

## Flow Type Specifications

### 1. Text Commands (`type: cmdType.text`)
- **Behavior**: Body string is always rendered inline with surrounding text
- **Whitespace**: Preserved as-is within the text content
- **No flow property needed** - inherent behavior

### 2. Inline Flow (`flow.inline`)
- **Behavior**: Content flows inline with surrounding text
- **Whitespace**: All whitespace within body is preserved
- **Children**: Processed recursively with their own flow rules
- **Default**: Commands without explicit flow property default to inline

### 3. Block Flow (`flow.block`)
- **Behavior**: Rendered as a separate paragraph/block
- **Before**: Add two newlines (unless first child in parent)
- **After**: Add two newlines (unless last child in parent)
- **Content**: Leading/trailing whitespace trimmed from body
- **Children**: Processed recursively

### 4. Structured Flow (`flow.structured`)
- **Behavior**: No text output from the command itself
- **Whitespace**: All pure-whitespace text nodes removed
- **Children**: Manage themselves based on their own flow properties
- **Transparency**: Acts as a transparent container for child commands

### 5. Location Flow (`flow.location`)
- **Behavior**: Special case for location entities
- **Initial render**: Trims leading/trailing whitespace
- **Internal content**: Processed normally
- **Purpose**: Clean output for main view display

### 6. None Flow (`flow.none`)
- **Behavior**: Command and all its content removed from output
- **Purpose**: Non-rendering macro commands.  `flow.none` is never a default, it must be assigned explicitly.
- **Children**: Not processed (entire subtree removed)

## Boundary Rules

### Flow Type Transitions

| From Flow | To Flow | Boundary Behavior |
|-----------|---------|------------------|
| inline | block | Automatic spacing added (block adds its leading newlines) |
| block | inline | Block's trailing newlines preserved |
| block | block | Each block manages its own spacing |
| structured | any | No interference - children manage themselves |
| any | structured | No interference - structured is transparent |
| inline | inline | Natural text flow continues |

## Implementation Architecture

### Code location

All new code will be written to a sibling file named "WhitespaceManagement.ts".

### Required Imports and Dependencies

```typescript
// WhitespaceManagement.ts
import { Command, CommandData, BodyType } from './Command';
import { cmdType, flow, CommandDefinition, definitions } from './Definitions';
import { getCommandDefinition, getCommandOrOptionDef } from './Verification';
import { generateUniqueId } from './Parser';
```

### Utility Functions to Create

#### createChildContext Function
```typescript
/**
 * Creates a new context for processing child commands
 * @param parentContext The parent's whitespace context
 * @param childIndex The index of the child in the parent's body array
 * @param parentBody The parent's body array
 * @returns A new WhitespaceContext for the child
 */
private static createChildContext(
    parentContext: WhitespaceContext,
    childIndex: number,
    parentBody: Command[]
): WhitespaceContext {
    const isFirst = childIndex === 0;
    const isLast = childIndex === parentBody.length - 1;

    return {
        depth: parentContext.depth + 1,
        parentFlow: parentContext.parentFlow,
        isFirstChild: isFirst,
        isLastChild: isLast,
        previousSiblingType: childIndex > 0 ? parentBody[childIndex - 1].type : undefined,
        nextSiblingType: childIndex < parentBody.length - 1 ? parentBody[childIndex + 1].type : undefined
    };
}
```

#### createTextNode Function
```typescript
/**
 * Creates a new text node Command containing the specified text
 * @param text The text content for the node
 * @returns A new Command of type text
 */
private static createTextNode(text: string): Command {
    return new Command(
        cmdType.text,
        generateUniqueId(),
        'text',           // tag
        undefined,        // id
        undefined,        // displayName
        undefined,        // attrs
        undefined,        // flags
        undefined,        // states
        undefined,        // parameters
        undefined,        // inlineText
        undefined,        // op
        undefined,        // rval
        undefined,        // value
        undefined,        // settings
        undefined,        // cmdState
        undefined,        // leadin
        undefined,        // flowController
        undefined,        // cond
        text             // body (the actual text content)
    );
}
```

#### getCommandDefinitionSafe Function
Since we're in a separate file, we need a safe way to get command definitions:

```typescript
/**
 * Safely gets the command definition, accounting for options that may not have all properties
 * @param cmd The command to get the definition for
 * @param parentCmd Optional parent command for option context
 * @returns The command or option definition
 */
private static getCommandDefinitionSafe(
    cmd: Command,
    parentCmd?: Command
): CommandDefinition {
    // For options, we need to check parent context
    if (parentCmd && parentCmd.tag && cmd.tag) {
        try {
            // This will handle both regular commands and options
            const def = getCommandOrOptionDef(cmd as CommandData, parentCmd as CommandData);
            return def as CommandDefinition;
        } catch (e) {
            // Fallback to direct definition lookup
        }
    }

    // Direct lookup for regular commands
    if (cmd.tag && definitions[cmd.tag]) {
        return definitions[cmd.tag];
    }

    // Default fallback - treat as inline text
    return { type: cmdType.text, flow: flow.inline } as CommandDefinition;
}
```

### WhitespaceManagement Class Structure

```typescript
export class WhitespaceManagement {
    // Main entry point (static)
    static manageWhitespace(cmds: Record<string, Command>): void { ... }

    // Core processing function (static)
    private static processWhitespace(cmd: Command, parent: Command | null, context: WhitespaceContext): BodyType { ... }

    // Flow type handlers (all static)
    private static processInlineFlow(cmd: Command, context: WhitespaceContext): BodyType { ... }
    private static processBlockFlow(cmd: Command, context: WhitespaceContext): BodyType { ... }
    private static processStructuredFlow(cmd: Command, context: WhitespaceContext): BodyType { ... }
    private static processLocationFlow(cmd: Command, context: WhitespaceContext): BodyType { ... }
    private static processNoneFlow(cmd: Command, context: WhitespaceContext): BodyType { ... }

    // Utility functions (all static)
    private static createChildContext(parentContext: WhitespaceContext, childIndex: number, parentBody: Command[]): WhitespaceContext { ... }
    private static createTextNode(text: string): Command { ... }
    private static getCommandDefinitionSafe(cmd: Command, parentCmd?: Command): CommandDefinition { ... }
}
```

### Core Structure

```typescript
// Main entry point
static manageWhitespace(cmds: Record<string, Command>): void {
    for (const cmdKey in cmds) {
        const cmd = cmds[cmdKey];
        if (cmd.body) {
            const initialContext: WhitespaceContext = {
                depth: 0,
                parentFlow: undefined,
                isFirstChild: true,
                isLastChild: true,
                previousSiblingType: undefined,
                nextSiblingType: undefined
            };
            cmd.body = this.processWhitespace(cmd, null, initialContext);
        }
    }
}

// Context tracking
interface WhitespaceContext {
    depth: number;
    parentFlow?: flow;
    isFirstChild: boolean;
    isLastChild: boolean;
    previousSiblingType?: cmdType;
    nextSiblingType?: cmdType;
}

// Main recursive processor
private static processWhitespace(
    cmd: Command,
    parent: Command | null,
    context: WhitespaceContext
): BodyType {
    const cmdDef = this.getCommandDefinitionSafe(cmd, parent);
    const flowType = cmdDef.flow || flow.inline; // Default to inline

    // Route to appropriate handler
    switch (flowType) {
        case flow.inline:
            return this.processInlineFlow(cmd, context);
        case flow.block:
            return this.processBlockFlow(cmd, context);
        case flow.structured:
            return this.processStructuredFlow(cmd, context);
        case flow.location:
            return this.processLocationFlow(cmd, context);
        case flow.none:
            return this.processNoneFlow(cmd, context);
        default:
            return this.processInlineFlow(cmd, context); // Fallback
    }
}
```

### Flow Type Handlers

#### Inline Flow Handler
```typescript
private static processInlineFlow(cmd: Command, context: WhitespaceContext): BodyType {
    if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

    // Process children recursively, preserving all whitespace
    return cmd.body.map((child, index) => {
        if (child instanceof Command) {
            const childContext = this.createChildContext(context, index, cmd.body!);
            child.body = this.processWhitespace(child, cmd, childContext);
        }
        return child;
    });
}
```

#### Block Flow Handler
```typescript
private static processBlockFlow(cmd: Command, context: WhitespaceContext): BodyType {
    if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

    const processed: Command[] = [];

    // Add leading newlines if not first child
    if (!context.isFirstChild) {
        processed.push(this.createTextNode("\n\n"));
    }

    // Process body content
    cmd.body.forEach((child, index) => {
        if (child instanceof Command) {
            if (child.type === cmdType.text) {
                // Trim leading/trailing whitespace from text nodes
                const text = (child.body as string).trim();
                if (text) {
                    child.body = text;
                    processed.push(child);
                }
            } else {
                const childContext = this.createChildContext(context, index, cmd.body!);
                child.body = this.processWhitespace(child, cmd, childContext);
                processed.push(child);
            }
        }
    });

    // Add trailing newlines if not last child
    if (!context.isLastChild) {
        processed.push(this.createTextNode("\n\n"));
    }

    return processed;
}
```

#### Structured Flow Handler
```typescript
private static processStructuredFlow(cmd: Command, context: WhitespaceContext): BodyType {
    if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

    const processed: Command[] = [];

    cmd.body.forEach((child, index) => {
        if (child instanceof Command) {
            if (child.type === cmdType.text) {
                // Remove pure whitespace text nodes
                const text = child.body as string;
                if (text.trim()) {
                    // This shouldn't happen in structured flow
                    // Log warning but keep the text
                    console.warn(`Text found in structured flow: "${text}"`);
                    processed.push(child);
                }
            } else {
                // Let children manage themselves
                const childContext = this.createChildContext(context, index, cmd.body!);
                child.body = this.processWhitespace(child, cmd, childContext);
                processed.push(child);
            }
        }
    });

    return processed;
}
```

#### Location Flow Handler
```typescript
private static processLocationFlow(cmd: Command, context: WhitespaceContext): BodyType {
    if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

    // Process children normally
    const processed = cmd.body.map((child, index) => {
        if (child instanceof Command) {
            const childContext = this.createChildContext(context, index, cmd.body!);
            child.body = this.processWhitespace(child, cmd, childContext);
        }
        return child;
    });

    // Trim leading whitespace
    if (processed.length > 0) {
        const first = processed[0];
        if (first instanceof Command && first.type === cmdType.text) {
            first.body = (first.body as string).replace(/^\s+/, '');
        }
    }

    // Trim trailing whitespace
    if (processed.length > 0) {
        const last = processed[processed.length - 1];
        if (last instanceof Command && last.type === cmdType.text) {
            last.body = (last.body as string).replace(/\s+$/, '');
        }
    }

    return processed;
}
```

#### None Flow Handler
```typescript
private static processNoneFlow(cmd: Command, context: WhitespaceContext): BodyType {
    // Remove entire command from output
    return undefined;
}
```

## Integration Plan

### Phase 1: Implementation
1. Create `manageWhitespace()` function in `WhitespaceManagement.ts`
2. Implement all flow type handlers
3. Add context tracking utilities
4. Keep `reduceStructuralWhitespaceAll()` for backward compatibility

### Phase 2: Testing
1. Create comprehensive unit tests for each flow type
2. Test boundary conditions between flow types
3. Test deeply nested structures
4. Verify example location output matches specification
5. Run regression tests on existing TSP files

### Phase 3: Migration ✅ COMPLETED

**Implementation Status: COMPLETE**

1. ✅ **Added import to `Processor.ts`**:
```typescript
import { WhitespaceManagement } from './WhitespaceManagement';
```

2. ✅ **Added configuration interface and option**:
```typescript
export interface ProcessorConfig {
    useNewWhitespaceManagement?: boolean;
}
```

3. ✅ **Updated `Processor.ts` to conditionally use new function**:
```typescript
// Apply whitespace management based on configuration
if (this.config.useNewWhitespaceManagement) {
    WhitespaceManagement.manageWhitespace(parserOutput);
} else {
    Verification.reduceStructuralWhitespaceAll(parserOutput);
}
```

4. ✅ **Added command-line flag support in `main.ts`**:
```bash
# Use old whitespace management (default)
node dist/main.js tspSrc tspOut

# Use new whitespace management
node dist/main.js tspSrc tspOut --use-new-whitespace
```

5. ✅ **Integration testing completed** - Both systems work correctly

## Migration Path for Users

### Current Status (Phase 3 Complete)
The new whitespace management system is now **fully integrated** and available alongside the existing system.

### How to Use the New System

**Command Line Usage:**
```bash
# Default behavior (old whitespace management)
node dist/main.js tspSrc tspOut

# Enable new whitespace management
node dist/main.js tspSrc tspOut --use-new-whitespace
```

**Programmatic Usage:**
```typescript
import { Processor, ProcessorConfig } from './Processor';

// Use new whitespace management
const config: ProcessorConfig = {
    useNewWhitespaceManagement: true
};
const processor = new Processor(config);
```

### Migration Strategy

**Step 1: Test with Existing Files**
```bash
# Compile with old system (current output)
node dist/main.js myProject/src myProject/out

# Compile with new system (compare output)
node dist/main.js myProject/src myProject/out-new --use-new-whitespace

# Compare the outputs to verify desired behavior
```

**Step 2: Gradual Adoption**
- The old system remains the default for backward compatibility
- Users can opt-in to the new system using the `--use-new-whitespace` flag
- Both systems can be used side-by-side during the transition period

**Step 3: Validation**
- Test with your TSP files to ensure the new whitespace management produces expected results
- The new system should provide cleaner, more predictable output
- Report any issues or unexpected behavior

### Benefits of the New System
1. **Flow-property-based**: Respects each command's flow type instead of hard-coding command names
2. **Maintainable**: No special cases for specific command types
3. **Extensible**: New commands work automatically based on their flow property
4. **Predictable**: Clear rules for each flow type (inline, block, structured, location, none)
5. **Recursive**: Properly handles deeply nested command structures

### Phase 4: Cleanup
1. After validation period, make new function default
2. Eventually remove old function
3. Update all documentation

## Example Output Validation

### Input (TSP Source)
```tsp
:: Stately Library -- location
[once]
Welcome to the Demo Adventure...
[/once]

You are in a stately library...

[scenery]
    [prop large fireplace]
        You see a large fireplace...
    [prop comfortable-looking chair]
        You see a comfortable-looking chair...
[/scenery]
```

### Expected Output (wooden door closed)
```
Welcome to the Demo Adventure...

You are in a stately library... There is a wooden door. It is presently closed.

A venerable sage is over there...

An arched doorway leads to the foyer. There is a big presentation link here. There is also a link that will rerender the location
```
Note: No trailing whitespace after final text.

## Benefits

1. **Predictable**: Clear rules based on flow properties
2. **Maintainable**: No special cases for specific command types
3. **Extensible**: New commands with flow properties work automatically
4. **Recursive**: Properly handles deeply nested structures
5. **Clean**: Separation of concerns - each flow type manages itself

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing output | Keep old function, gradual migration |
| Performance impact | Profile and optimize hot paths |
| Edge cases not covered | Comprehensive test suite |
| User confusion | Clear documentation and examples |

## Success Criteria

1. All existing TSP files compile with identical output (when desired)
2. New whitespace management is more predictable and maintainable
3. No special-case handling for specific command types
4. Performance comparable to or better than current implementation
5. Clear documentation and migration path

## Timeline

- Week 1: Implement core function and flow handlers
- Week 2: Comprehensive testing and debugging
- Week 3: Integration and migration setup
- Week 4: Documentation and final validation

## Conclusion

This new whitespace management system will provide a robust, maintainable solution that properly respects flow properties and eliminates the brittleness of the current implementation. By treating whitespace management as a property of flow types rather than command types, we create a more elegant and extensible system.