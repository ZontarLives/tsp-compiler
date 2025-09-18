import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { cmdType } from '../src/Definitions';

describe('Simple NPC Link Parsing Tests', () => {
    
    test('Basic NPC Reference - should create npclink command', () => {
        const tspSource = `
:: Merchant --npc
A friendly shopkeeper with a warm smile.

:: Town Square --location
The bustling heart of the town.
You see ~Merchant~ behind the counter.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Verify we have both entities
        expect(result['Merchant']).toBeDefined();
        expect(result['Town Square']).toBeDefined();
        
        // Find the Town Square location
        const townSquare = result['Town Square'];
        
        // Find NPC link in the body
        const bodyArray = Array.isArray(townSquare!.body) ? townSquare!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        
        expect(npcLink).toBeDefined();
        expect(npcLink!.type).toBe(cmdType.npclink);
        expect(npcLink!.tag).toBe(cmdType.npclink);
        expect(npcLink!.id).toBe('Merchant');
    });

    test('Multiple NPC References - should create multiple npclink commands', () => {
        const tspSource = `
:: Guard --npc
A stern-looking guard.

:: Messenger --npc
A nervous-looking messenger.

:: Castle Gate --location
The imposing entrance to the castle.
~Guard~ and ~Messenger~ stand near the entrance.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Verify all entities exist
        expect(result['Guard']).toBeDefined();
        expect(result['Messenger']).toBeDefined();
        expect(result['Castle Gate']).toBeDefined();

        // Find the Castle Gate location
        const castleGate = result['Castle Gate'];
        
        // Find all NPC links in the body
        const bodyArray = Array.isArray(castleGate!.body) ? castleGate!.body : [];
        const npcLinks = bodyArray.filter((cmd: any) => cmd.type === cmdType.npclink);
        
        expect(npcLinks).toBeDefined();
        expect(npcLinks.length).toBe(2);
        
        const guardLink = npcLinks.find((link: any) => link.id === 'Guard');
        const messengerLink = npcLinks.find((link: any) => link.id === 'Messenger');
        
        expect(guardLink).toBeDefined();
        expect(guardLink!.type).toBe(cmdType.npclink);
        expect(messengerLink).toBeDefined();
        expect(messengerLink!.type).toBe(cmdType.npclink);
    });

    test('NPC Link parsing consistency with ItemLink pattern', () => {
        const tspSource = `
:: TestNPC --npc
An NPC for testing.

:: TestItem --item
An item for testing.

:: TestLocation --location
Compare ~TestNPC~ and {TestItem}.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        const location = result['TestLocation'];
        expect(location).toBeDefined();
        
        const bodyArray = Array.isArray(location!.body) ? location!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        const itemLink = bodyArray.find((cmd: any) => cmd.type === cmdType.itemlink);
        
        expect(npcLink).toBeDefined();
        expect(itemLink).toBeDefined();
        
        // Verify both follow similar structure
        expect(npcLink!.type).toBe(cmdType.npclink);
        expect(npcLink!.tag).toBe(cmdType.npclink);
        expect(npcLink!.id).toBe('TestNPC');
        
        expect(itemLink!.type).toBe(cmdType.itemlink);
        expect(itemLink!.tag).toBe(cmdType.itemlink);
        expect(itemLink!.id).toBe('TestItem');
    });

    test('No parseEntityRef calls should remain - only npclink commands created', () => {
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

        const location = result['TestLocation'];
        expect(location).toBeDefined();
        
        // Should create npclink, not entityRef
        const bodyArray = Array.isArray(location!.body) ? location!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        const entityRef = bodyArray.find((cmd: any) => cmd.type === cmdType.entityRef);
        
        expect(npcLink).toBeDefined();
        expect(entityRef).toBeUndefined(); // Should not create entityRef anymore
        expect(npcLink!.type).toBe(cmdType.npclink);
    });

    test('Verify NPC link creates correct structure', () => {
        const tspSource = `
:: ShopKeeper --npc
An old merchant.

:: Market --location
You see ~ShopKeeper~ here.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        const market = result['Market'];
        const bodyArray = Array.isArray(market!.body) ? market!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        
        expect(npcLink).toBeDefined();
        expect(npcLink!.type).toBe(cmdType.npclink);
        expect(npcLink!.tag).toBe(cmdType.npclink);  
        expect(npcLink!.id).toBe('ShopKeeper');
        expect(npcLink!.uid).toBeDefined();
        expect(npcLink!.line).toBeDefined();
        expect(npcLink!.file).toBe('test.tsp');
        expect(npcLink!.parentEntity).toBeDefined();
    });
});