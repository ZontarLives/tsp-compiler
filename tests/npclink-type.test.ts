import { cmdType } from '../src/Definitions';

describe('NPC Link Command Type', () => {
    test('should have npclink command type available', () => {
        expect(cmdType.npclink).toBe('npclink');
        expect(typeof cmdType.npclink).toBe('string');
    });

    test('should have npclink alongside other link types', () => {
        expect(cmdType.itemlink).toBe('itemlink');
        expect(cmdType.npclink).toBe('npclink');
        expect(cmdType.scenerylink).toBe('scenerylink');
        expect(cmdType.hotlink).toBe('hotlink');
    });

    test('should be enumerable', () => {
        const commandTypes = Object.values(cmdType);
        expect(commandTypes).toContain('npclink');
        expect(commandTypes).toContain('itemlink');
        expect(commandTypes).toContain('scenerylink');
    });
});