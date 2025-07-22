import {TokenType} from "./TokenTypes";
import {TokenData} from "./Lexer";
import {errmsg, fileline, parserr} from "./Logger";
import {TspError} from "./Errors";
import chalk from "chalk";

let DEBUG_MODE = false;

class Cursor {
    private index: number = 0;
    level: number = 0;
    private readonly tokens: TokenData[];
    private readonly filename: string;
    

    constructor(tokens: TokenData[], filename: string) {
        this.tokens = tokens;
        this.filename = filename;
    }

    /**
     * Sets the cursor to the beginning of the token list.
     * @private
     */
    reinit() {
        this.index = 0;
        this.level = 0;
    }


    /**
     * Gets the current token the parser is at.
     * @returns The current token.
     */
    peek(offset:number = 0): TokenData {
        return this.tokens[this.index + offset];
    }

    /**
     * Gets a slice of the token list.
     * @param start
     * @param end
     */
    slice(startOffset:number = 0, endOffset:number = 10) {
        return this.tokens.slice(this.index + startOffset, this.index + endOffset);
    }
    
    /**
     * Checks if the cursor is at the end of the token list.  Performs a supplimentary check to
     * ensure the cursor is not at the end of the file.
     * @returns True if the cursor is at the end of the token list.
     */
    isAtEnd(): boolean {
        if (this.index >= this.tokens.length) {
            throw this.cursorErr(`Cursor is beyond the end of the token list.`);
        }
        return this.peek().type === TokenType.EOF;
    }

    /**
     * Check if the current token is of a given type.
     * @param types Token types to check against.
     * @returns True if the current token is of the given type.
     */
    check(...types: TokenType[]): boolean {
        if (this.isAtEnd()) {
            return false;
        }
        for (const type of types) {
            if (this.peek().type === type) return true;
        }
        return false;
    }

    /**
     * Gets the token immediately before the current token.  Does not rewind the cursor. 
     * @param offset Defaults to -1.
     * @returns The previous token.
     */
    lookBehind(offset: number = -1): TokenData {
        return this.tokens[this.index + offset];
    }

    /**
     * Advances the parser by one token unless the parser is at the end of the token list.
     * @returns The token that was consumed.
     */
    advance(): TokenData {
        let result = this.tokens[this.index];
        if (!this.isAtEnd()) {
            this.index++;
        }
        
        // Attempt some clever case insensitivity
        if (result.type !== TokenType.PARAGRAPH) {
            result.unlowered = result.value;
            result.value = result.value.toLowerCase();
        }
        
        return result;
    }

    /**
     * Consume the next token of the given type, advancing the cursor.
     * @param message The error message if the token type doesn't match.
     * @param type The expected type of the token to consume.
     * @returns The consumed token.
     * @throws Error if the token type doesn't match.
     */
    consume(message: string, type: TokenType): TokenData {
        const result = this.tryConsume(message, type) 
        if (result) {
            return result;
        }
        throw this.cursorErr(`Expecting (${message}), but found ${this.peek().type} '${this.peek().value}'`);
    }
    /**
     * Tries to consume the next token of the given type, advancing the cursor.
     * @param type The expected type of the token to consume.
     * @returns TokenData if the token was consumed, false otherwise.
     */
    tryConsume(message: string, type: TokenType): false | TokenData {
        if (!this.check(type)) {
            return false;
        }
        log(this.cursorMsg('Consuming', message));
        return this.advance();
    }
    /**
     * Consumes the next token if it matches one of the given types, advancing the cursor.
     * @param message
     * @param types
     * @returns The consumed token.
     * @throws Error if the token type doesn't match any of the given types.
     */
    consumeOneOf(message: string, ...types: TokenType[]): TokenData {
        // Itereate the `types` array and consume the first token that matches
        for (const type of types) {
            if (this.check(type)) {
                log(this.cursorMsg('Consuming', message));
                return this.advance();
            }
        }
        throw this.cursorErr(`Expecting one of (${message}), but found ${this.peek().type} '${this.peek().value}'`);
    }

    /**
     * Consumes the current token regardless of type, advancing the cursor.
     * @returns The consumed token.
     */
    consumeAny(): TokenData {
        log(this.cursorMsg('Pansuming', ''));
        return this.advance();
    }

    /**
     * Message to log to the console when performing a cursor operation.
     * @param type
     * @param message
     * @returns Specified message with line prefix intended for logging.
     */
    cursorMsg(type: string, message:string) {
        const currentToken = this.peek();
        const value = currentToken.type === TokenType.NEWLINES ? '\\n' : currentToken.value;
        const level = this.level > 0 ? this.level : 0;
        return this.linePrefix() + `${type} ${currentToken.type.padEnd(20, '\u22C5')} (${message.padEnd(17, ' ')}) ${value}`;
    }

    /**
     * Seek to the token of the given type, advancing the cursor past any tokens that don't match.
     * @param message Short message identifying the intent of the call.
     * @param type The type of token to seek.
     * @returns The token after the one we're seeking.
     * @throws Error if the end of the file is reached before the token is found.
     */
    seek(message: string, type: TokenType): TokenData {
        while (!this.check(type) && !this.isAtEnd()) {
            this.advance();
        }
        if (this.isAtEnd()) {
            throw this.cursorErr(`Expecting (${message}), but reached end of file.`);
        }
        log(this.cursorMsg('Seeking', message));
        // Return the token after the one we're seeking
        return this.advance();
    }

    /**
     * Checks the current token for one of possibly several given types, and if it matches, 
     * advances the cursor.  
     * Returns only true or false, see consume() for the token.
     * @param message Informational message.
     * @param types Token types to match against.
     * @returns True if a match was found and the token was consumed.
     */
    match(message: string, ...types: TokenType[] ): boolean {
        for (const type of types) {
            if (this.check(type)) {
                log(this.cursorMsg('Skipping ', message));
                this.advance();
                return true;
            }
        }
        return false;
    }

    /**
     * Rewinds the cursor by one token.
     */
    rewind(): TokenData {
        if (this.index > 0) this.index--;
        return this.peek();
    }

    /**
     * Returns the current source line number of the cursor.
     */
    line(): number {
        return this.peek().line;
    }
    /**
     * Gets the token at a given offset from the current token. Does not advance the parser. 
     * Offset defaults to 1.
     * @param offset
     * @private
     */
    lookAhead(offset: number = 1): TokenData {
        if (this.index + offset >= this.tokens.length) {
            return this.tokens[this.tokens.length - 1];
        }
        return this.tokens[this.index + offset];
    }

    /**
     * Returns a specialized error for the cursor.
     * @param msg
     */
    cursorErr(msg:string) {
        return new TspError(this.cursorErrMsg(msg));
    }

    /**
     * Returns a specialized error message for cursor-related issues.
     * @param msg
     */
    cursorErrMsg(msg:string) {
        const currentToken = this.peek();
        const value = currentToken.type === TokenType.NEWLINES ? '\\n' : currentToken.value;

        const throwmsg = fileline(this.filename, currentToken.line) + errmsg(msg);
        return throwmsg;
    }

    /**
     * Returns a string representing the current line prefix, including the line number and 
     * the level of indentation.
     */
    linePrefix() {
        const level = this.level > 0 ? this.level : 0;
        return this.linePrefixNumbers() +
            chalk.greenBright("\u22C5".repeat(level))
    }

    /**
     * Gets the line prefix for the current token, including the line number and the level of indentation.
     */
    linePrefixNumbers() {
        return chalk.yellow(`(Line ${this.peek().line.toString().padStart(3,' ')})[Lvl ${this.level.toString().padStart(1, ' ')}] `);
    }
}


export function log(...args: any[]) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}


export default Cursor;
