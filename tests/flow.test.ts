import fs from 'fs';
import path from 'path';
import {Processor} from '../src/Processor';

describe('Flow Test Suite', () => {
    // let itemsData: string;
    // let startData: string;
    
    // // Assign `itemPath` and `startPath` to the paths of the mock files
    // const itemPath = path.join(__dirname, 'mockSrc', 'items.tsp');
    // const startPath = path.join(__dirname, 'mockSrc', 'start.tsp');
    // // Assign `itemOut` and `startOut` to the paths of the mock output files
    // const itemOut = path.join(__dirname, 'mockOut', 'items.json');
    // const startOut = path.join(__dirname, 'mockOut', 'start.json');

    beforeAll(() => {
        // itemsData = fs.readFileSync(path.join(__dirname, 'mockSrc', 'items.tsp'), 'utf8');
        // startData = fs.readFileSync(path.join(__dirname, 'mockSrc', 'start.tsp'), 'utf8');
    });

    // Now you can use itemsData and startData in your tests
    test('should Lex and Parse without errors', async () => {
        
        // Combine itemPath and startPath into a single array
        const args = ['tests/mockSrc',  'tests/mockOut'];
        // Create a new Processor
        const processor = new Processor();
        // Process the files
        await processor.processTsp(args);
    });
});
