import { Lexer } from '../src/Lexer';
import { TokenType } from '../src/TokenTypes';

describe('Option Lexing Tests', () => {
    it('should correctly lex inline options', () => {
        const input = `:: TestEntity --location
        [if (door is locked)]It is locked.<else>It is open.[/if]
        `;
        
        const lexer = new Lexer(input, 'test.tsp');
        const tokens = lexer.tokenize();
        
        // Find the tokens after the macro close
        const macroCloseIndex = tokens.findIndex((t, idx) => 
            t.type === TokenType.MACRO_CLOSE && 
            idx > 0 && tokens[idx - 1]?.type === TokenType.SET_CLOSE
        );
        
        // Verify the sequence
        expect(tokens[macroCloseIndex + 1].type).toBe(TokenType.PARAGRAPH);
        expect(tokens[macroCloseIndex + 1].value).toBe('It is locked.');
        expect(tokens[macroCloseIndex + 2].type).toBe(TokenType.OPTION_OPEN);
        expect(tokens[macroCloseIndex + 3].type).toBe(TokenType.WORD);
        expect(tokens[macroCloseIndex + 3].value).toBe('else');
        expect(tokens[macroCloseIndex + 4].type).toBe(TokenType.OPTION_CLOSE);
    });
    
    it('should handle multiple inline options', () => {
        const input = `:: TestEntity --location
        [if (x is 1)]One<elseif>Two<else>Other[/if]
        `;
        
        const lexer = new Lexer(input, 'test.tsp');
        const tokens = lexer.tokenize();
        
        // Verify all options are correctly tokenized
        const optionOpens = tokens.filter(t => t.type === TokenType.OPTION_OPEN);
        expect(optionOpens.length).toBe(2); // <elseif> and <else>
    });

    it('should handle options with conditions in parentheses', () => {
        const input = `:: TestEntity --location
        [if (wooden door is closed)]It is presently closed.<elseif (wooden door is locked)>It is currently locked.<else>It is currently unlocked and open.[/if]
        `;
        
        const lexer = new Lexer(input, 'test.tsp');
        const tokens = lexer.tokenize();
        
        // Find the first paragraph after the first macro close
        const firstMacroClose = tokens.findIndex((t, idx) => 
            t.type === TokenType.MACRO_CLOSE && 
            idx > 0 && tokens[idx - 1]?.type === TokenType.SET_CLOSE
        );
        
        // Verify the first paragraph doesn't include <elseif>
        expect(tokens[firstMacroClose + 1].type).toBe(TokenType.PARAGRAPH);
        expect(tokens[firstMacroClose + 1].value).toBe('It is presently closed.');
        
        // Verify <elseif> is properly tokenized
        expect(tokens[firstMacroClose + 2].type).toBe(TokenType.OPTION_OPEN);
        expect(tokens[firstMacroClose + 3].type).toBe(TokenType.WORD);
        expect(tokens[firstMacroClose + 3].value).toBe('elseif');
    });
});