import { WhitespaceManagement } from '../src/WhitespaceManagement';
import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { cmdType } from '../src/Definitions';

describe('Whitespace Management Regression Tests', () => {

    function parseWithoutWhitespaceManagement(tspSource: string): Record<string, any> {
        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();

        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Don't apply whitespace management
        return result;
    }

    function parseWithWhitespaceManagement(tspSource: string): Record<string, any> {
        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();

        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Apply whitespace management
        WhitespaceManagement.manageWhitespace(result);
        return result;
    }

    test('entity parsing should work the same with or without whitespace management', () => {
        const tspSource = `
:: Test Item --item
A simple test item.

:: Test Location --location
You see a {Test Item} here.
        `;

        const resultWithout = parseWithoutWhitespaceManagement(tspSource);
        const resultWith = parseWithWhitespaceManagement(tspSource);

        // Both should have the same entities
        expect(Object.keys(resultWithout).sort()).toEqual(Object.keys(resultWith).sort());

        // Both should have the same entity types and basic structure
        for (const key in resultWithout) {
            expect(resultWith[key]).toBeDefined();
            expect(resultWith[key].type).toBe(resultWithout[key].type);
            expect(resultWith[key].id).toBe(resultWithout[key].id);
            expect(resultWith[key].tag).toBe(resultWithout[key].tag);
        }
    });

    test('itemlink parsing should work consistently', () => {
        const tspSource = `
:: Sword --item
A sharp sword.

:: Castle --location
You find a {Sword} on the ground.
        `;

        const resultWithout = parseWithoutWhitespaceManagement(tspSource);
        const resultWith = parseWithWhitespaceManagement(tspSource);

        // Check that itemlinks are created correctly in both cases
        const castleWithout = resultWithout['castle'];
        const castleWith = resultWith['castle'];

        expect(castleWithout).toBeDefined();
        expect(castleWith).toBeDefined();

        const bodyWithout = Array.isArray(castleWithout.body) ? castleWithout.body : [];
        const bodyWith = Array.isArray(castleWith.body) ? castleWith.body : [];

        const itemlinkWithout = bodyWithout.find((cmd: any) => cmd.type === cmdType.itemlink);
        const itemlinkWith = bodyWith.find((cmd: any) => cmd.type === cmdType.itemlink);

        expect(itemlinkWithout).toBeDefined();
        expect(itemlinkWith).toBeDefined();
        expect(itemlinkWith.id).toBe(itemlinkWithout.id);
        expect(itemlinkWith.type).toBe(itemlinkWithout.type);
    });

    test('should not affect core parsing behavior', () => {
        const tspSource = `
:: Simple Entity --location
Simple text content.
        `;

        const resultWithout = parseWithoutWhitespaceManagement(tspSource);
        const resultWith = parseWithWhitespaceManagement(tspSource);

        const entityWithout = resultWithout['simple entity'];
        const entityWith = resultWith['simple entity'];

        expect(entityWithout).toBeDefined();
        expect(entityWith).toBeDefined();

        // Core properties should be identical (uid will differ due to sequential generation)
        expect(entityWith.type).toBe(entityWithout.type);
        expect(entityWith.id).toBe(entityWithout.id);
        expect(entityWith.tag).toBe(entityWithout.tag);
        expect(entityWith.displayName).toBe(entityWithout.displayName);
    });
});