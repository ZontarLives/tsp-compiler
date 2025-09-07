# Options Lexer Fixes - Technical Design Document

## Executive Summary

This document describes the necessary changes to fix a lexing issue in the TaleSpinner compiler where option delimiters (e.g., `<else>`) are incorrectly parsed as part of paragraph text when they appear on the same line as content. This prevents the parser from recognizing option structures in conditional statements.

## Problem Statement

### Current Behavior
When an option delimiter appears immediately after text without whitespace separation, the lexer includes it as part of a PARAGRAPH token:

```tsp
[if (wooden door is locked)]It is presently locked.<else>
    It is currently unlocked.
[/if]
```

The text `It is presently locked.<else>` is lexed as a single PARAGRAPH token instead of:
1. PARAGRAPH: `It is presently locked.`
2. OPTION_OPEN: `<`
3. WORD: `else`
4. OPTION_CLOSE: `>`

### Expected Behavior
The lexer should recognize option delimiters even when they appear inline with text, properly tokenizing them as separate OPTION tokens.

## Root Cause Analysis

### 1. PARAGRAPH Pattern Issue
The PARAGRAPH_PAT regex at line 191 includes angle brackets in its character class:
```typescript
const PARAGRAPH_PAT = /^([\w' .,!?:;\-~"@#%&*\`\(\)\+=\<\>\/\|\\]+)[\t]*/;
```

This pattern greedily matches any text containing `<` and `>`, preventing the recognition of option patterns.

### 2. Token Processing Order
In `doEntityBodyMode()` (line 463), tokens are checked in this sequence:
1. Newlines
2. Scenery (`^...^`)
3. Entity references (`~...~`)
4. Hotlinks (`[[...]]`)
5. Items (`{...}`)
6. Macros (`[...]`)
7. **Options (`<...>`)**
8. **Paragraphs/text**

Despite options being checked before paragraphs, the PARAGRAPH_PAT greedily consumes the entire string including option delimiters.

## Proposed Solution

### Approach 1: Negative Lookahead (Recommended)

Modify PARAGRAPH_PAT to use negative lookahead to prevent matching option patterns:

```typescript
// Current pattern
const PARAGRAPH_PAT = /^([\w' .,!?:;\-~"@#%&*\`\(\)\+=\<\>\/\|\\]+)[\t]*/;

// Proposed pattern with negative lookahead
const PARAGRAPH_PAT = /^((?:(?!<\w+>)[\w' .,!?:;\-~"@#%&*\`\(\)\+=\<\>\/\|\\])+)[\t]*/;
```

This regex will:
- Match characters normally included in paragraphs
- Stop matching when it encounters a pattern like `<word>`
- Allow isolated `<` or `>` characters that aren't part of options

### Approach 2: Split Text at Option Boundaries

Add a helper method to detect and split text at option boundaries:

```typescript
private splitTextAtOptions(text: string): string[] {
    // Split text at option patterns while preserving the delimiters
    return text.split(/(?=<\w+>)/);
}
```

Then modify `doStringOrWhiteSpaceOrParagraphMode()` to use this splitting logic.

### Approach 3: Enhanced Lookahead Check

Add a method to check if we're at an option boundary before consuming text:

```typescript
private isAtOptionBoundary(): boolean {
    const remaining = this.input.slice(this.index);
    const optionPattern = /^<\w+>/;
    return optionPattern.test(remaining);
}
```

## Implementation Steps

### Step 1: Update PARAGRAPH_PAT Pattern

**File**: `src/Lexer.ts`
**Line**: 191

1. Locate the PARAGRAPH_PAT definition
2. Replace with the negative lookahead version:
   ```typescript
   const PARAGRAPH_PAT = /^((?:(?!<\w+>)[\w' .,!?:;\-~"@#%&*\`\(\)\+=\<\>\/\|\\])+)[\t]*/;
   ```

### Step 2: Add Option Boundary Detection

**File**: `src/Lexer.ts`
**Location**: After line 496 (before `doStringOrWhiteSpaceOrParagraphMode`)

Add this helper method:
```typescript
private isAtOptionBoundary(): boolean {
    const remaining = this.input.slice(this.index);
    // Match option patterns like <else>, <elseif>, etc.
    const optionPattern = /^<\w+>/;
    return optionPattern.test(remaining);
}
```

### Step 3: Modify Text Consumption Logic

**File**: `src/Lexer.ts`
**Function**: `doStringOrWhiteSpaceOrParagraphMode` (line 497)

Update the function to check for option boundaries:

```typescript
private doStringOrWhiteSpaceOrParagraphMode(): boolean {
    // Handle the single '$' character when not in the form $(text)
    if (this.doToStringMode()) {
        return true;
    }
    
    // Check if we're at an option boundary before consuming text
    if (this.isAtOptionBoundary()) {
        return false; // Let doOptionMode handle it
    }
    
    if (this.peekToken(TokenType.PARAGRAPH, PARAGRAPH_PAT)) {
        const text = this.peekTokenValue(TokenType.PARAGRAPH, PARAGRAPH_PAT);
        // When the text is only whitespace, consume it as whitespace
        if (text.trim() === '') {
            this.consumeToken(TokenType.WHITESPACE, WHITESPACE_PAT);
        }
        else {
            this.consumeToken(TokenType.PARAGRAPH, PARAGRAPH_PAT);
        }
    }
    else if (this.consumeToken(TokenType.WHITESPACE, WHITESPACE_PAT)) {
    }
    else {
        return false;
    }
    return true;
}
```

### Step 4: Test the Changes

Create test cases to verify the fix:

**File**: `tests/optionLexing.test.ts` (new file)

```typescript
import { Lexer } from '../src/Lexer';
import { TokenType } from '../src/TokenTypes';

describe('Option Lexing Tests', () => {
    it('should correctly lex inline options', () => {
        const input = `:: TestEntity --room
        [if (door is locked)]It is locked.<else>It is open.[/if]
        `;
        
        const lexer = new Lexer(input, 'test.tsp');
        const tokens = lexer.tokenize();
        
        // Find the tokens after the macro close
        const macroCloseIndex = tokens.findIndex(t => 
            t.type === TokenType.MACRO_CLOSE && 
            tokens[macroCloseIndex - 1]?.value === 'locked'
        );
        
        // Verify the sequence
        expect(tokens[macroCloseIndex + 1].type).toBe(TokenType.PARAGRAPH);
        expect(tokens[macroCloseIndex + 1].value).toBe('It is locked.');
        expect(tokens[macroCloseIndex + 2].type).toBe(TokenType.OPTION_OPEN);
        expect(tokens[macroCloseIndex + 3].type).toBe(TokenType.WORD);
        expect(tokens[macroCloseIndex + 3].value).toBe('else');
        expect(tokens[macroCloseIndex + 4].type).toBe(TokenType.OPTION_CLOSE);
    });
    
    it('should handle multiple inline options', () => {
        const input = `:: TestEntity --room
        [if (x is 1)]One<elseif (x is 2)>Two<else>Other[/if]
        `;
        
        const lexer = new Lexer(input, 'test.tsp');
        const tokens = lexer.tokenize();
        
        // Verify all options are correctly tokenized
        const optionOpens = tokens.filter(t => t.type === TokenType.OPTION_OPEN);
        expect(optionOpens.length).toBe(2); // <elseif> and <else>
    });
});
```

### Step 5: Run Tests

```bash
# Run the new test suite
npx jest tests/optionLexing.test.ts

# Run all tests to ensure no regression
npx jest
```

## Verification Steps

1. **Unit Testing**: Run the test suite to verify the fix works correctly
2. **Integration Testing**: Process the example TSP files that previously failed
3. **Regression Testing**: Ensure existing functionality remains intact
4. **Edge Cases**: Test various option patterns:
   - `<else>` immediately after text
   - `<elseif>` with conditions
   - Multiple options on the same line
   - Options with whitespace before/after
   - Isolated `<` or `>` characters in text

## Rollback Plan

If issues arise:
1. Revert changes to PARAGRAPH_PAT
2. Remove the helper methods
3. Restore original `doStringOrWhiteSpaceOrParagraphMode` logic

## Future Considerations

1. **Performance**: The negative lookahead may have a small performance impact on large files
2. **Extensibility**: Consider creating a more general pattern exclusion mechanism for other delimiters
3. **Documentation**: Update the language specification to clarify option delimiter behavior

## Implementation Checklist

- [ ] Backup current Lexer.ts file
- [ ] Update PARAGRAPH_PAT with negative lookahead
- [ ] Add isAtOptionBoundary helper method
- [ ] Modify doStringOrWhiteSpaceOrParagraphMode
- [ ] Create test file optionLexing.test.ts
- [ ] Run new tests
- [ ] Run full test suite
- [ ] Test with problematic TSP files
- [ ] Update any affected documentation
- [ ] Commit changes with descriptive message

## Notes for Implementers

- The DEBUG_MODE flag is currently set to `true` - this will output detailed lexing information
- The lexer uses chalk for colored console output during debugging
- Line numbers in error messages are preserved by maintaining newlines during comment stripping
- The fix should be backward compatible with existing TSP files