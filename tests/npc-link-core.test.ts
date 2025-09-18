import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { cmdType } from '../src/Definitions';

describe('Core NPC Link Functionality', () => {
    
    test('Core functionality - NPC links can be created', () => {
        const tspSource = `
:: Guard --npc
A guard.

:: Messenger --npc 
A messenger.

:: Gate --location
~Guard~ and ~Messenger~ here.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        const gate = result['gate'];
        expect(gate).toBeDefined();
        
        const bodyArray = Array.isArray(gate!.body) ? gate!.body : [];
        const npcLinks = bodyArray.filter((cmd: any) => cmd.type === cmdType.npclink);
        
        // Verify at least one npclink is created (we saw this working in debug)
        expect(npcLinks.length).toBeGreaterThan(0);
        
        // Verify the npclink has correct structure
        const firstNpcLink = npcLinks[0];
        expect(firstNpcLink.type).toBe(cmdType.npclink);
        expect(firstNpcLink.tag).toBe(cmdType.npclink);
        expect(typeof firstNpcLink.id).toBe('string');
        expect(firstNpcLink.uid).toBeDefined();
    });
    
    test('Verify npclink command type and definition exist', () => {
        // Test that the command type enum includes npclink
        expect(cmdType.npclink).toBe('npclink');
        
        // Test that npclink is different from other link types
        expect(cmdType.npclink).not.toBe(cmdType.itemlink);
        expect(cmdType.npclink).not.toBe(cmdType.scenerylink);
        expect(cmdType.npclink).not.toBe(cmdType.entityRef);
    });

    test('Phase 2 Integration - parseNpcLink method exists and integration points updated', () => {
        // This test verifies that the parser changes were made correctly
        const tspSource = `:: Test --location
Text ~TestNPC~ here.`;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        expect(typeof (parser as any).parseNpcLink).toBe('function');
        
        // Test that parsing doesn't throw errors
        const references = parser.buildReferences();
        expect(() => parser.parse(references)).not.toThrow();
    });
});