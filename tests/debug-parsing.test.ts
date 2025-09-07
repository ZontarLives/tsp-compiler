import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { cmdType } from '../src/Definitions';

describe('Debug Parsing Tests', () => {
    
    test('Debug - Check what entities are created', () => {
        const tspSource = `
:: TestNPC --npc
An NPC for testing.

:: TestLocation --location
Reference: ~TestNPC~
        `;

        console.log('TSP Source:', tspSource);

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        console.log('Tokens:', lexer.tokens.length);

        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        console.log('References:', Object.keys(references));
        
        const result = parser.parse(references);
        console.log('Result keys:', Object.keys(result));
        console.log('Result:', result);
        
        // Just test that parsing worked without errors
        expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    test('Debug - Check NPC link creation', () => {
        const tspSource = `:: Simple --location
Text ~test~ here.`;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);
        
        console.log('Simple test result:', Object.keys(result));
        
        if (result['Simple']) {
            console.log('Simple entity body:', result['Simple'].body);
            const bodyArray = Array.isArray(result['Simple'].body) ? result['Simple'].body : [];
            console.log('Body array:', bodyArray);
            
            for (const cmd of bodyArray) {
                console.log('Command:', cmd.type, cmd.id, cmd);
            }
        }
        
        expect(result['Simple']).toBeDefined();
    });
});