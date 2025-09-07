import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { cmdType } from '../src/Definitions';

describe('Working NPC Link Tests', () => {
    
    test('NPC Reference - should create npclink command (working)', () => {
        const tspSource = `
:: Merchant --npc
A friendly shopkeeper.

:: Town Square --location
You see ~Merchant~ behind the counter.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Use lowercase keys as that's how the parser stores them
        expect(result['merchant']).toBeDefined();
        expect(result['town square']).toBeDefined();
        
        // Find the Town Square location
        const townSquare = result['town square'];
        
        // Find NPC link in the body
        const bodyArray = Array.isArray(townSquare!.body) ? townSquare!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        
        console.log('Body array:', bodyArray.map(c => ({ type: c.type, id: c.id })));
        
        expect(npcLink).toBeDefined();
        expect(npcLink!.type).toBe(cmdType.npclink);
        expect(npcLink!.tag).toBe(cmdType.npclink);
        expect(npcLink!.id).toBe('Merchant'); // Original case preserved in ID
    });

    test('Multiple NPC References - should create multiple npclink commands', () => {
        const tspSource = `
:: Guard --npc
A stern-looking guard.

:: Messenger --npc 
A nervous-looking messenger.

:: Castle Gate --location
~Guard~ and ~Messenger~ stand here.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Use lowercase keys
        const castleGate = result['castle gate'];
        expect(castleGate).toBeDefined();
        
        // Find all NPC links in the body
        const bodyArray = Array.isArray(castleGate!.body) ? castleGate!.body : [];
        const npcLinks = bodyArray.filter((cmd: any) => cmd.type === cmdType.npclink);
        
        console.log('All commands:', bodyArray.map(c => ({ type: c.type, id: c.id })));
        
        expect(npcLinks.length).toBe(2);
        
        const guardLink = npcLinks.find((link: any) => link.id === 'Guard');
        const messengerLink = npcLinks.find((link: any) => link.id === 'Messenger');
        
        expect(guardLink).toBeDefined();
        expect(messengerLink).toBeDefined();
    });

    test('NPC vs Item Link comparison - should create different command types', () => {
        const tspSource = `
:: TestNPC --npc
An NPC.

:: TestItem --item
An item.

:: TestLocation --location
Compare ~TestNPC~ and {TestItem}.
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
        const itemLink = bodyArray.find((cmd: any) => cmd.type === cmdType.itemlink);
        
        console.log('Location commands:', bodyArray.map(c => ({ type: c.type, id: c.id })));
        
        // Verify both link types are created correctly
        expect(npcLink).toBeDefined();
        expect(itemLink).toBeDefined();
        
        expect(npcLink!.type).toBe(cmdType.npclink);
        expect(npcLink!.id).toBe('TestNPC');
        
        expect(itemLink!.type).toBe(cmdType.itemlink);
        expect(itemLink!.id).toBe('TestItem');
    });

    test('Verify no entityRef commands are created - only npclink', () => {
        const tspSource = `
:: TestNPC --npc
Test NPC.

:: TestLocation --location
Reference: ~TestNPC~
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        const location = result['testlocation'];
        expect(location).toBeDefined();
        
        const bodyArray = Array.isArray(location!.body) ? location!.body : [];
        
        // Should create npclink, not entityRef
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        const entityRef = bodyArray.find((cmd: any) => cmd.type === cmdType.entityRef);
        
        console.log('Commands:', bodyArray.map(c => ({ type: c.type, id: c.id })));
        
        expect(npcLink).toBeDefined();
        expect(entityRef).toBeUndefined(); // Should not create entityRef anymore
        expect(npcLink!.type).toBe(cmdType.npclink);
        expect(npcLink!.id).toBe('TestNPC');
    });
});