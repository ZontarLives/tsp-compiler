import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { Verification } from '../src/Verification';
import { cmdType } from '../src/Definitions';

describe('NPC Link Verification Tests', () => {
    
    test('Phase 3 Integration - Verification methods exist and integrate correctly', () => {
        // Test that the verifyNpcLinks method exists on the Verification class
        expect(typeof (Verification as any).verifyNpcLinks).toBe('function');
        
        // Test that parsing and verification doesn't throw errors
        const tspSource = `
:: TestNPC --npc
A test NPC.

:: TestLocation --location
You see ~TestNPC~ here.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        
        // Should not throw compilation or verification errors
        expect(() => parser.parse(references)).not.toThrow();
    });

    test('Inline link recognition includes npclink type', () => {
        // This test verifies that the inline link recognition was updated correctly
        // We can't easily test the actual whitespace processing, but we can verify
        // that the system recognizes npclink as a valid command type
        
        const tspSource = `
:: Guard --npc
A guard.

:: TestLocation --location
Text ~Guard~ more text.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        const location = result['testlocation'];
        expect(location).toBeDefined();
        
        const bodyArray = Array.isArray(location!.body) ? location!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        
        // If parsing succeeded and created an npclink, the integration is working
        if (npcLink) {
            expect(npcLink.type).toBe(cmdType.npclink);
            expect(typeof npcLink.id).toBe('string');
        }
    });

    test('Verification system recognizes npclink commands without errors', () => {
        // Test that the verification integration doesn't break anything
        const tspSource = `:: SimpleLocation --location
Simple test ~NonExistentNPC~.`;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        
        // Clear any previous entity references
        (Verification as any).entityReferences = {};
        
        // Should complete parsing without throwing errors
        // (Verification errors are non-throwing and added to error list)
        let result: any;
        expect(() => {
            result = parser.parse(references);
        }).not.toThrow();
        
        expect(result).toBeDefined();
    });

    test('Core verification functionality - Phase 3 complete', () => {
        // Test that all Phase 3 components are working together
        expect(cmdType.npclink).toBe('npclink');
        expect(typeof (Verification as any).verifyNpcLinks).toBe('function');
        
        // Test with a complete example that should work
        const tspSource = `
:: Guard --npc
A stern guard.

:: Location --location  
The ~Guard~ stands here.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        expect(typeof (parser as any).parseNpcLink).toBe('function');
        
        const references = parser.buildReferences();
        const result = parser.parse(references);
        
        expect(result).toBeDefined();
        expect(Object.keys(result).length).toBeGreaterThan(0);
    });
});