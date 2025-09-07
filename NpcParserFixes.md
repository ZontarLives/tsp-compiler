# NpcParserFixes.md

## Investigation Summary

This document analyzes the missing NPC parsing functionality in the TaleSpinner Compiler and provides a comprehensive technical design for implementing the feature.

## Current State Analysis

### What Works (Lexer Implementation)
The lexer correctly tokenizes NPC references using the `~...~` delimiter pattern:

- **File**: `src/Lexer.ts:211`
- **Pattern**: `const ENTITY_DELIM_PAT: RegExp = /^(\~)/;`
- **Token Type**: `TokenType.ENTITY_REF_DELIMITER`
- **Method**: `doEntityReferenceMode()` (lines 748-775)

The tokenization follows the same pattern as scenery links but uses `~` instead of `^`:

```typescript
// Scenery: ^...^ -> TokenType.SCENERY_DELIMITER  
// NPCs:    ~...~ -> TokenType.ENTITY_REF_DELIMITER
```

### What's Partially Working (Parser Implementation)
The parser has a `parseEntityRef()` method that handles `ENTITY_REF_DELIMITER` tokens:

- **File**: `src/Parser.ts:703-716`
- **Method**: `parseEntityRef(parentEntity: CommandData): Command`
- **Creates**: Generic `entityRef` commands, not specialized NPC commands
- **Integration**: Called in three parser contexts (lines 187, 383, 542)

### The Core Problem
The current implementation treats all `~...~` patterns as generic entity references (`cmdType.entityRef`) rather than specialized NPC references. This differs from the scenery system where `^...^` creates specialized `cmdType.scenerylink` commands.

## Expected vs. Actual Behavior

### Current Pattern (Scenery Links)
```tsp
Visible items: ^Sign^, ^Ticket Counter^

[scenery]
    [prop Sign]
        I see nothing special.
    [prop Ticket Counter] 
        I see nothing special.
[/scenery]
```
- `^Sign^` creates a `scenerylink` command
- References are validated against `[prop]` definitions
- Specialized scenery-specific validation rules apply

### Missing Pattern (NPC Links)
```tsp
People here: ~Shopkeeper~, ~Guard~

[interact]
    [greeting Shopkeeper]
        Hello there, traveler!
    [greeting Guard]
        Move along citizen.
[/interact]
```
- `~Shopkeeper~` should create an `npclink` command (currently creates generic `entityRef`)
- Should reference NPC interaction definitions
- Should have NPC-specific validation rules

## Technical Analysis

### Command Type Definitions
**File**: `src/Definitions.ts:20-36`

Current command types include:
```typescript
export enum cmdType {
    // ... other types
    scenerylink = 'scenerylink', // ✓ Specialized scenery handling
    entityRef   = 'entityRef',   // ✗ Generic entity references  
    // Missing: npclink = 'npclink'
}
```

### Entity Definitions
**File**: `src/Definitions.ts:191-196`

NPCs are properly defined as entities:
```typescript
npc: {
    type: cmdType.entity,
    id: state.required,
    attrs: state.optional,
    flags: state.optional,
    body: state.required,
},
```

### Interaction System
**File**: `src/Definitions.ts:649-655`

The `interact` macro is designed for NPCs:
```typescript
interact: {
    type: cmdType.macro,
    id: state.required,
    body: state.required,
    flow: flow.structured,
    entityContainer: 'npc',    // ← Only valid in NPC entities
    multiplicity: state.singular,
}
```

### Verification Rules
**File**: `src/Verification.ts:145-161`

Scenery verification includes NPC entities as valid containers:
```typescript
if (entityType === EntityTypes.location || entityType === EntityTypes.item
    || entityType === EntityTypes.fixed || entityType === EntityTypes.npc) {
    return; // ✓ NPCs can contain scenery references
}
```

## Technical Design for Implementation

### Phase 1: Add NPC Link Command Type

#### 1.1 Update Command Type Enum
**File**: `src/Definitions.ts:30`

```typescript
export enum cmdType {
    // ... existing types
    scenerylink = 'scenerylink',
    npclink     = 'npclink',     // ← ADD THIS
    // ... remaining types
}
```

#### 1.2 Add NPC Link Validation Rules
**File**: `src/Verification.ts` (after line 163)

```typescript
/**
 * Verifies that an NPC reference is only declared in appropriate contexts
 * and references valid NPC entities with interact macros.
 */
private static verifyNpcReferences(cmdData: CommandData) {
    if (cmdData.type === 'npclink') {
        if (!cmdData.parentEntity) {
            throw cmderr(cmdData, `NPC reference occurs outside of an entity`);
        }
        const entityType = cmdData.parentEntity.type;
        if (entityType === EntityTypes.location || entityType === EntityTypes.item
            || entityType === EntityTypes.fixed || entityType === EntityTypes.npc) {
            return;
        }
        else {
            addError(cmdData, `NPC reference occurs in invalid entity '${cmdData.parentEntity.id}'`);
            addError(cmdData, `\tNPC references are only valid in entities of type 'location', 'item', 'fixed', or 'npc'`);
        }
    }
}
```

#### 1.3 Add NPC Interaction Validation
**File**: `src/Verification.ts` (after NPC reference validation)

```typescript
/**
 * Verifies that NPC links reference valid interact definitions
 */
private static verifyNpcInteractionIds(cmdData: CommandData, parser: Parser) {
    if (cmdData.tag === 'greeting' || cmdData.tag === 'farewell') {
        // Verify that the NPC reference exists and has corresponding interactions
        if (!parser.currentNpcReferences.hasOwnProperty(cmdData.id!)) {
            addError(cmdData, `Invalid NPC reference ~${cmdData.id}~ in entity '${parser.currentEntityDef.id}' ${advisement('(will be safely ignored)')}`);
        }
    }
}
```

### Phase 2: Update Parser Implementation

#### 2.1 Add NPC Reference Tracking
**File**: `src/Parser.ts` (class properties)

```typescript
export class Parser {
    // ... existing properties
    private currentSceneryReferences: { [key: string]: Command } = {};
    private currentNpcReferences: { [key: string]: Command } = {};  // ← ADD THIS
}
```

#### 2.2 Create Specialized NPC Parser Method  
**File**: `src/Parser.ts` (after parseScenery method)

```typescript
/**
 * Parses NPC references in the form ~NpcName~ 
 * Verification rules: Can only exist in location, fixeditem, item, or npc entities.
 * @private
 */
private parseNpc(parentEntity: CommandData): Command {
    let npc: CommandData = {
        type: cmdType.npclink,
        uid: generateUniqueId(),
        tag: cmdType.npclink,
        line: this.cursor.line(),
        file: this.filename,
        parentEntity: this.currentEntityDef
    };
    this.cursor.match("opening npc delim", TokenType.ENTITY_REF_DELIMITER);
    npc.id = this.cursor.consume("npc id", TokenType.KEYWORD).value;
    npc.inlineText = this.consumeInline() || undefined;
    this.cursor.match("closing npc delim", TokenType.ENTITY_REF_DELIMITER);
    const npcReference = Command.construct(npc, parentEntity, this, parentEntity);
    
    // Add the NPC reference to the currentNpcReferences record
    this.currentNpcReferences[npcReference.id!] = npcReference;
    return npcReference;
}
```

#### 2.3 Update Parser Integration Points
**File**: `src/Parser.ts:184-189`

Replace the generic entity reference handling:

```typescript
// BEFORE (line 187-189):
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseEntityRef(entity));
}

// AFTER:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseNpc(entity));
}
```

Apply the same change to the other two integration points at lines 383 and 542.

#### 2.4 Update Verification Integration
**File**: `src/Verification.ts:119-122`

```typescript
// Add NPC verification alongside scenery verification
if (cmdData.type === 'scenerylink' || cmdData.tag === 'prop') {
    this.verifySceneryReferences(cmdData);
    this.verifySceneryOptionIds(cmdData, parser);
}
if (cmdData.type === 'npclink' || cmdData.tag === 'greeting' || cmdData.tag === 'farewell') {
    this.verifyNpcReferences(cmdData);
    this.verifyNpcInteractionIds(cmdData, parser);
}
```

#### 2.5 Update Inline Link Recognition
**File**: `src/Verification.ts:777-791`

Add `npclink` to the inline link type checks:

```typescript
const prevIsInlineLink = prevElement && (
    prevElement.type === cmdType.itemlink || 
    prevElement.type === cmdType.scenerylink ||
    prevElement.type === cmdType.npclink ||        // ← ADD THIS
    prevElement.type === cmdType.hotlink ||
    prevElement.type === cmdType.entityRef
);

const nextIsInlineLink = nextElement && (
    nextElement.type === cmdType.itemlink || 
    nextElement.type === cmdType.scenerylink ||
    nextElement.type === cmdType.npclink ||        // ← ADD THIS
    nextElement.type === cmdType.hotlink ||
    nextElement.type === cmdType.entityRef
);
```

### Phase 3: Clean Up Legacy Implementation

#### 3.1 Deprecate Generic Entity References (Optional)
If `~...~` patterns should exclusively create NPC links, consider marking the generic `parseEntityRef()` method as deprecated or removing it entirely.

#### 3.2 Update Error Messages
Ensure that lexer error messages in `doEntityReferenceMode()` (src/Lexer.ts:769) refer to NPC patterns specifically:

```typescript
// BEFORE:
throw lexerr(this, `Malformed Entity Reference pattern (missing closing '~'?)`);

// AFTER: 
throw lexerr(this, `Malformed NPC Reference pattern (missing closing '~'?)`);
```

## Implementation Strategy

### Priority 1 (Core Functionality)
1. Add `npclink` command type to `cmdType` enum
2. Create `parseNpc()` method mirroring `parseScenery()` pattern
3. Update parser integration points to call `parseNpc()` instead of `parseEntityRef()`
4. Add NPC reference tracking to Parser class

### Priority 2 (Validation & Error Handling)  
1. Implement `verifyNpcReferences()` validation method
2. Add NPC-specific error messages and validation rules
3. Update inline link recognition to include `npclink` type

### Priority 3 (Polish & Documentation)
1. Add comprehensive test cases with NPC entities and references
2. Update lexer error messages for clarity
3. Consider deprecating generic `entityRef` approach if not needed

## Testing Strategy

### Test Case 1: Basic NPC Reference
```tsp
:: Town Square --location
The bustling heart of the town.

People here: ~Merchant~, ~Guard~

:: Merchant --npc (location: Town Square)
[interact]
    [greeting]
        Welcome to my shop!
[/interact]
```

### Test Case 2: Error Validation
```tsp
:: Invalid Container --reference  
Invalid context: ~SomeNPC~  // Should trigger validation error
```

### Test Case 3: Missing NPC Definition
```tsp
:: Valid Location --location
Unresolved reference: ~NonExistentNPC~  // Should trigger reference error
```

## Benefits of This Implementation

1. **Consistency**: NPC references follow the same pattern as scenery references
2. **Type Safety**: Specialized command type enables targeted validation
3. **Extensibility**: Clear separation allows for NPC-specific features (dialogue trees, state tracking)
4. **Error Handling**: Better error messages and validation for NPC-specific contexts
5. **Maintainability**: Clear distinction between generic entity references and specialized NPC interactions

## Conclusion

The missing NPC parsing functionality can be implemented by following the established scenery link pattern. The lexer already correctly tokenizes NPC references, but the parser needs to create specialized `npclink` commands instead of generic `entityRef` commands. This approach maintains consistency with the existing codebase architecture while providing the specialized functionality needed for NPC interaction systems.

The implementation requires minimal changes to the core architecture and leverages existing patterns, making it a low-risk enhancement that significantly improves the language's capability to handle interactive fiction NPCs.