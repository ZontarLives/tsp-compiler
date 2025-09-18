# Whitespace Management Migration Guide

## Overview

Starting with this version, the TSP Compiler uses a new **flow-based whitespace management system** by default. This replaces the previous `reduceStructuralWhitespaceAll()` function with a more maintainable, predictable approach.

## What Changed

### New Default Behavior
- **New whitespace management system is now the default**
- More predictable output based on command flow properties
- Better handling of nested structures
- Cleaner separation between different content types

### Backward Compatibility
- Old system is still available via `--use-old-whitespace` flag (deprecated)
- Existing TSP files should compile without modification
- Output may differ slightly but should be functionally equivalent

## Quick Migration Steps

### 1. Test Your Existing Files
```bash
# Test with new system (default behavior)
node dist/main.js myProject/src myProject/out

# Compare with old system if needed
node dist/main.js myProject/src myProject/out-old --use-old-whitespace

# Compare outputs to verify behavior
```

### 2. Validate Output
- Check that your compiled JSON files produce expected game behavior
- Look for improved whitespace handling in text output
- Report any issues or unexpected changes

### 3. Update Build Scripts
If you have automated build scripts, they should work without changes since the new system is now default. Only update if you want to explicitly use the old system:

```bash
# Old build script (no change needed):
node dist/main.js src out

# If you need old behavior temporarily:
node dist/main.js src out --use-old-whitespace
```

## What's Better in the New System

### Flow-Based Processing
Commands are processed according to their `flow` property:

- **Inline Flow**: Preserves all whitespace (like itemlinks, npclinks)
- **Block Flow**: Adds proper spacing around blocks
- **Structured Flow**: Removes whitespace, lets children manage themselves
- **Location Flow**: Trims boundaries for clean output
- **None Flow**: Removes commands entirely from output

### Benefits
1. **Predictable**: Clear rules based on flow properties, not command types
2. **Maintainable**: No special cases for specific commands
3. **Extensible**: New commands work automatically based on their flow property
4. **Recursive**: Properly handles deeply nested structures

## Troubleshooting

### Output Looks Different
This is normal! The new system provides cleaner, more consistent whitespace handling. If the functionality is preserved, this is likely an improvement.

### Specific Issues
If you encounter problems:

1. **First**: Try the old system to verify it's related to whitespace management:
   ```bash
   node dist/main.js src out --use-old-whitespace
   ```

2. **Report**: If the new system breaks functionality, please report the issue with:
   - Your TSP source code
   - Expected vs actual output
   - Steps to reproduce

### Getting Help
- See `WhitespaceManagementPlan.md` for technical details
- Check test files in `tests/whitespace-*.test.ts` for examples
- Review the flow property definitions in `src/Definitions.ts`

## Timeline

- **Now**: New system is default, old system available with deprecation warning
- **Future Version**: Old system will be removed entirely
- **Migration Period**: At least one major version with both systems available

## Command Reference

```bash
# Use new system (default)
node dist/main.js src out

# Use old system (deprecated)
node dist/main.js src out --use-old-whitespace

# Explicitly specify new system (optional)
node dist/main.js src out --use-new-whitespace
```

## For Developers

If you're working on the TSP Compiler itself:

### Programmatic Usage
```typescript
import { Processor, ProcessorConfig } from './Processor';

// New system (default)
const processor = new Processor();

// Old system (deprecated)
const processor = new Processor({
    useNewWhitespaceManagement: false
});

// Explicit new system
const processor = new Processor({
    useNewWhitespaceManagement: true
});
```

### Adding New Commands
New commands should define their `flow` property in `src/Definitions.ts`:

```typescript
myNewCommand: {
    type: cmdType.myNewCommand,
    flow: flow.inline,  // or block, structured, location, none
    // ... other properties
}
```

The whitespace management will automatically handle your new command based on its flow type.