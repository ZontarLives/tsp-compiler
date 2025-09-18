import { Parser } from '../src/Parser';
import { Lexer } from '../src/Lexer';
import { cmdType } from '../src/Definitions';

describe('NPC Link Parsing Tests', () => {
    
    test('Basic NPC Reference - should create npclink command', () => {
        const tspSource = `
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
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Find the Town Square location
        const townSquare = result['Town Square'];
        expect(townSquare).toBeDefined();
        
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
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Find the Castle Gate location
        const castleGate = result['Castle Gate'];
        expect(castleGate).toBeDefined();
        
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

    test('NPC Link with inline text - should capture inline text', () => {
        const tspSource = `
:: Shopkeeper --npc (location: Market)
An elderly merchant.

:: Market --location
You see ~Shopkeeper \`who looks busy\`~ arranging wares.
        `;

        const lexer = new Lexer(tspSource, 'test.tsp');
        lexer.tokenize();
        
        const parser = new Parser(lexer.tokens, 'test.tsp');
        const references = parser.buildReferences();
        const result = parser.parse(references);

        // Find the Market location
        const market = result['Market'];
        expect(market).toBeDefined();
        
        // Find NPC link with inline text
        const bodyArray = Array.isArray(market!.body) ? market!.body : [];
        const npcLink = bodyArray.find((cmd: any) => cmd.type === cmdType.npclink);
        expect(npcLink).toBeDefined();
        expect(npcLink!.id).toBe('Shopkeeper');
        expect(npcLink!.inlineText).toBe('who looks busy');
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
});