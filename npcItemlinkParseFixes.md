# npcItemlinkParseFixes.md

## Investigation Summary

This document analyzes the missing NPC parsing functionality in the TaleSpinner Compiler, comparing it to the itemlink pattern rather than the scenerylink pattern. The key insight is that NPCs, like items, are standalone entities that are referenced using inline delimiters.

## Corrected Understanding: Itemlink vs. Scenerylink Pattern

### Itemlink Pattern (Correct Model for NPCs)
- **Syntax**: `{itemname}` 
- **References**: Actual entity definitions (e.g., `:: Sword --item`)
- **Entity Independence**: Items exist as standalone entities
- **Inline Reference**: Creates a link to an existing item entity

### Scenerylink Pattern (Incorrect Model for NPCs)
- **Syntax**: `^sceneryname^`
- **References**: Props defined within `[scenery]` macro blocks
- **Entity Dependence**: Scenery items don't exist as standalone entities
- **Contained Definition**: Props are defined inside the parent entity's `[scenery]` block

### NPC Pattern (Should Follow Itemlink Model)
- **Syntax**: `~npcname~`
- **References**: Actual NPC entity definitions (e.g., `:: Merchant --npc`)
- **Entity Independence**: NPCs exist as standalone entities
- **Inline Reference**: Should create a link to an existing NPC entity
- **Interaction Definition**: `[interact]` macro lives *inside* the NPC entity, not as a container

## Current State Analysis

### What Works (Lexer Implementation)
The lexer correctly tokenizes both patterns:

**Itemlinks** (`src/Lexer.ts:870-899`):
- Pattern: `const ITEM_OPEN_PAT = /^(\{)\s*/;` and `ITEM_CLOSE_PAT = /^(\})/;`
- Token Types: `TokenType.ITEM_OPEN`, `TokenType.ITEM_CLOSE`
- Method: `doItemMode()`

**NPC References** (`src/Lexer.ts:748-775`):
- Pattern: `const ENTITY_DELIM_PAT: RegExp = /^(\~)/;`
- Token Type: `TokenType.ENTITY_REF_DELIMITER`
- Method: `doEntityReferenceMode()`

### Parser Implementation Comparison

**Itemlink Parser** (`src/Parser.ts:651-666`):
```typescript
private parseItem(parentEntity: CommandData): Command {
    let item: CommandData = {
        type: cmdType.itemlink,     // Specialized type
        uid: generateUniqueId(),
        tag: cmdType.itemlink,       // Consistent tag
        line: this.cursor.line(),
        file: this.filename,
        parentEntity: parentEntity
    };
    this.cursor.match("item open", TokenType.ITEM_OPEN);
    item.id = this.cursor.consume("item id", TokenType.KEYWORD).value;
    item.inlineText = this.consumeInline();
    this.cursor.match("item close", TokenType.ITEM_CLOSE);
    const result = Command.construct(item, parentEntity, this);
    return result;
}
```

**Current Entity Reference Parser** (`src/Parser.ts:703-716`):
```typescript
private parseEntityRef(parentEntity: CommandData): Command {
    let entityRef: CommandData = {
        type: cmdType.entityRef,     // Generic type (problem!)
        uid: generateUniqueId(),
        tag: cmdType.entityRef,
        line: this.cursor.line(),
        file: this.filename,
        parentEntity: parentEntity
    };
    this.cursor.match("opening entity ref delim", TokenType.ENTITY_REF_DELIMITER);
    entityRef.id = this.cursor.consume("entity ref id", TokenType.KEYWORD).value;
    this.cursor.match("closing entity ref delim", TokenType.ENTITY_REF_DELIMITER);
    return Command.construct(entityRef, parentEntity, this);
}
```

## Expected Behavior

### Item Entity and Reference Example
```tsp
:: Sword --item (location: player)
A gleaming steel blade.

:: Town Square --location
You see a {Sword} lying on the ground.
```
- `{Sword}` creates an `itemlink` command
- References the `Sword` entity defined elsewhere
- Item entity exists independently

### NPC Entity and Reference Example (Expected)
```tsp
:: Merchant --npc (location: Town Square)
A friendly shopkeeper.
[interact]
    [greeting]
        Welcome to my shop!
    [farewell]
        Come back soon!
[/interact]

:: Town Square --location
The bustling heart of town.
You see ~Merchant~ standing behind the counter.
```
- `~Merchant~` should create an `npclink` command
- References the `Merchant` entity defined elsewhere
- NPC entity exists independently with its own `[interact]` macro

## Technical Analysis

### Command Type Definitions
**File**: `src/Definitions.ts:20-36`

Current command types:
```typescript
export enum cmdType {
    // ... other types
    itemlink    = 'itemlink',    // ✓ Specialized item handling
    scenerylink = 'scenerylink', // ✓ Specialized scenery handling
    entityRef   = 'entityRef',   // ✗ Generic entity references
    // Missing: npclink = 'npclink'
}
```

### NPC Entity Definition
**File**: `src/Definitions.ts:191-196`

NPCs are properly defined as standalone entities:
```typescript
npc: {
    type: cmdType.entity,
    id: state.required,
    attrs: state.optional,
    flags: state.optional,
    body: state.required,
},
```

### Interact Macro Definition
**File**: `src/Definitions.ts:649-655`

The `interact` macro is designed to exist *within* NPC entities:
```typescript
interact: {
    type: cmdType.macro,
    id: state.required,          // ID is optional, refers to NPC itself
    body: state.required,
    flow: flow.structured,
    entityContainer: 'npc',      // Can only exist inside NPC entities
    multiplicity: state.singular, // Only one per NPC
}
```

Key insight: `entityContainer: 'npc'` means this macro goes *inside* an NPC entity, not as a container for multiple NPCs.

### Verification Rules Comparison

**Itemlinks** (no special verification found - items are validated as entities)

**Scenerylinks** (`src/Verification.ts:145-161`):
- Must exist in location, item, fixed, or npc entities
- References validated against `[prop]` definitions in `[scenery]` blocks

**Expected NPC Verification**:
- Should validate that referenced NPCs exist as entities
- Should verify NPCs are of type `npc`
- Could validate interaction states if needed

## Technical Design for Implementation

### Phase 1: Add NPC Link Command Type

#### 1.1 Update Command Type Enum
**File**: `src/Definitions.ts:30`

```typescript
export enum cmdType {
    // ... existing types
    itemlink    = 'itemlink',
    npclink     = 'npclink',     // ← ADD THIS
    scenerylink = 'scenerylink',
    // ... remaining types
}
```

### Phase 2: Create NPC Link Parser (Following Itemlink Pattern)

#### 2.1 Create parseNpcLink Method
**File**: `src/Parser.ts` (after parseItem method, around line 667)

```typescript
/**
 * Parses NPC references in the form ~NpcName~
 * Similar to itemlink, references standalone NPC entities.
 * @private
 */
private parseNpcLink(parentEntity: CommandData): Command {
    let npcLink: CommandData = {
        type: cmdType.npclink,
        uid: generateUniqueId(),
        tag: cmdType.npclink,
        line: this.cursor.line(),
        file: this.filename,
        parentEntity: parentEntity
    };
    this.cursor.match("npc link open", TokenType.ENTITY_REF_DELIMITER);
    npcLink.id = this.cursor.consume("npc id", TokenType.KEYWORD).value;
    npcLink.inlineText = this.consumeInline() || undefined;
    this.cursor.match("npc link close", TokenType.ENTITY_REF_DELIMITER);
    const result = Command.construct(npcLink, parentEntity, this);
    return result;
}
```

#### 2.2 Update Parser Integration Points
**File**: `src/Parser.ts`

Replace all three instances where `parseEntityRef` is called:

**Line 187-189**:
```typescript
// BEFORE:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseEntityRef(entity));
}

// AFTER:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseNpcLink(entity));
}
```

**Line 383-385**:
```typescript
// BEFORE:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseEntityRef(parentEntity));
}

// AFTER:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseNpcLink(parentEntity));
}
```

**Line 542-544**:
```typescript
// BEFORE:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseEntityRef(parentEntity));
}

// AFTER:
else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
    commandList.push(this.parseNpcLink(parentEntity));
}
```

### Phase 3: Add NPC Link Verification

#### 3.1 Create NPC Reference Verification
**File**: `src/Verification.ts` (after existing verification methods)

```typescript
/**
 * Verifies that NPC links reference valid NPC entities.
 * Similar to how itemlinks reference item entities.
 */
private static verifyNpcLinks(cmdData: CommandData, parser: Parser) {
    if (cmdData.type === 'npclink') {
        // Verify the referenced NPC exists in the entity list
        const npcId = cmdData.id;
        const npcEntity = parser.entities.find(e => 
            e.id === npcId && e.type === EntityTypes.npc
        );
        
        if (!npcEntity) {
            addError(cmdData, `Invalid NPC reference ~${npcId}~ - no NPC entity with this ID found`);
        }
        
        // Verify context is appropriate for NPC references
        if (!cmdData.parentEntity) {
            throw cmderr(cmdData, `NPC reference occurs outside of an entity`);
        }
        
        const entityType = cmdData.parentEntity.type;
        // NPCs can be referenced in locations, items, fixed items, or other NPCs
        if (entityType !== EntityTypes.location && 
            entityType !== EntityTypes.item &&
            entityType !== EntityTypes.fixed && 
            entityType !== EntityTypes.npc) {
            addError(cmdData, `NPC reference occurs in invalid entity '${cmdData.parentEntity.id}'`);
            addError(cmdData, `\tNPC references are only valid in entities of type 'location', 'item', 'fixed', or 'npc'`);
        }
    }
}
```

#### 3.2 Update Verification Integration
**File**: `src/Verification.ts:119` (in verifyCommand method)

```typescript
// Add NPC link verification
if (cmdData.type === 'npclink') {
    this.verifyNpcLinks(cmdData, parser);
}
```

#### 3.3 Update Inline Link Recognition
**File**: `src/Verification.ts:777-791`

```typescript
// Check if previous element is an inline link type
const prevIsInlineLink = prevElement && (
    prevElement.type === cmdType.itemlink || 
    prevElement.type === cmdType.npclink ||        // ← ADD THIS
    prevElement.type === cmdType.scenerylink ||
    prevElement.type === cmdType.hotlink ||
    prevElement.type === cmdType.entityRef
);

// Check if next element is an inline link type
const nextIsInlineLink = nextElement && (
    nextElement.type === cmdType.itemlink || 
    nextElement.type === cmdType.npclink ||        // ← ADD THIS
    nextElement.type === cmdType.scenerylink ||
    nextElement.type === cmdType.hotlink ||
    nextElement.type === cmdType.entityRef
);
```

### Phase 4: Update Error Messages

#### 4.1 Update Lexer Error Messages
**File**: `src/Lexer.ts:769`

```typescript
// BEFORE:
throw lexerr(this, `Malformed Entity Reference pattern (missing closing '~'?)`);

// AFTER:
throw lexerr(this, `Malformed NPC link pattern (missing closing '~'?)`);
```

### Phase 5: Clean Up Legacy Code

#### 5.1 Deprecate or Remove parseEntityRef
Once NPC links are working, consider whether `parseEntityRef` is still needed. If not, it can be removed or marked as deprecated.

## Implementation Differences from Previous Design

### Key Corrections from scenerylink-based approach:

1. **Entity Model**: NPCs are standalone entities like items, not sub-components like scenery props
2. **Reference Type**: `~npc~` references an existing NPC entity, not a definition within a macro block
3. **Interaction Location**: `[interact]` exists inside each NPC entity, not as a container for multiple NPCs
4. **Validation Logic**: Should validate against entity definitions, not macro content
5. **Parser Pattern**: Should follow `parseItem()` pattern, not `parseScenery()` pattern

## Testing Strategy

### Test Case 1: Basic NPC Reference
```tsp
:: Merchant --npc (location: Town Square)
A friendly shopkeeper with a warm smile.
[interact]
    [greeting]
        Welcome to my humble shop!
    [farewell]
        Thank you for your patronage!
[/interact]

:: Town Square --location
The bustling heart of the town.
You see ~Merchant~ behind the counter.
```

### Test Case 2: Multiple NPC References
```tsp
:: Guard --npc (location: Castle Gate)
A stern-looking guard.
[interact]
    [greeting]
        Halt! State your business.
[/interact]

:: Messenger --npc (location: Castle Gate)
A nervous-looking messenger.
[interact]
    [greeting]
        I have urgent news!
[/interact]

:: Castle Gate --location
The imposing entrance to the castle.
~Guard~ and ~Messenger~ stand near the entrance.
```

### Test Case 3: Error Validation - Missing NPC
```tsp
:: Empty Room --location
An empty room.
You see ~NonExistentNPC~ here.  // Should trigger validation error
```

### Test Case 4: Error Validation - Wrong Context
```tsp
:: Some Reference --reference
Invalid context: ~SomeNPC~  // Should trigger context error
```

## Benefits of the Corrected Implementation

1. **Architectural Consistency**: NPCs follow the same pattern as items (standalone entities with inline references)
2. **Simplicity**: No need for complex reference tracking like scenery props
3. **Flexibility**: Each NPC can have its own unique interaction structure
4. **Maintainability**: Clear separation between entity definition and reference
5. **Extensibility**: Easy to add NPC-specific features to the entity definition
6. **Intuitive Design**: Mirrors how items work, making it easier for language users to understand

## Migration Path

If any existing code uses the generic `entityRef` pattern for NPCs:

1. Update parser to create `npclink` commands instead
2. Update any downstream processing that expects `entityRef` types
3. Add deprecation warnings for legacy patterns
4. Eventually remove `parseEntityRef` if no longer needed

## Conclusion

The NPC parsing functionality should follow the itemlink pattern, not the scenerylink pattern. This is because:

- NPCs are **standalone entities** defined with `:: NPCName --npc`
- The `[interact]` macro lives **inside** each NPC entity
- NPC references (`~npc~`) should create **npclink** commands that reference these entities
- This mirrors how **itemlinks** work with item entities

The implementation is straightforward:
1. Add `npclink` command type
2. Create `parseNpcLink()` method following `parseItem()` pattern
3. Add validation to ensure referenced NPCs exist
4. Update inline link recognition

This approach maintains consistency with the existing architecture while providing the specialized functionality needed for NPC interactions in interactive fiction.