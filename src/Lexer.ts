/**
 * @module TspLexer
 * @description
 * This module contains the lexer for the TSP language.  It is used to tokenize the input string and generate a token
 * array.  The token array is then used by the parser to generate the AST.
 */
import {specialJoin} from "./Base";
import {TokenType} from "./TokenTypes";
import chalk from "chalk";
import {amber, cpath, intr, lexerr} from "./Logger";
import {getCommandDefinition, Verification} from "./Verification";
import {CommandDefinition, definitions, state} from "./Definitions";

const DEBUG_MODE = false;


/**
 * Class for defining lexer states, which are used to determine the current context or mode of the lexer.
 * This is used to determine which tokens are valid at any given time.
 */
class LexerStates {
    static INSIDE_ENTITY = false;
    static INSIDE_MACRO = false;
    static INSIDE_MACRO_INLINE_BODY = false;
    static INSIDE_PROPERTY_LIST = false;
    static INSIDE_SCENERY = false;
    static INSIDE_HOTLINK = false;
    static INSIDE_CONDITION = false;
    static INSIDE_STATES = false;
    static PROPERTY_ASSIGNMENT_MODE = false;

    static display() {
        if (this.INSIDE_ENTITY) {
            log(chalk.cyanBright(`INSIDE_ENTITY`));
        }
        if (this.INSIDE_MACRO) {
            log(chalk.yellowBright(`INSIDE_MACRO`));
        }
        if (this.INSIDE_MACRO_INLINE_BODY) {
            log(chalk.yellow(`INSIDE_MACRO_INLINE_BODY`));
        }
        if (this.INSIDE_PROPERTY_LIST) {
            log(chalk.magentaBright(`INSIDE_PROPERTY_LIST`));
        }
        if (this.INSIDE_SCENERY) {
            log(chalk.greenBright(`INSIDE_SCENERY`));
        }
        if (this.INSIDE_HOTLINK) {
            log(chalk.blueBright(`INSIDE_HOTLINK`));
        }
        if (this.INSIDE_CONDITION) {
            log(chalk.magentaBright(`INSIDE_CONDITION`));
        }
        if (this.INSIDE_STATES) {
            log(chalk.cyanBright(`INSIDE_STATES`));
        }
        if (this.PROPERTY_ASSIGNMENT_MODE) {
            log(chalk.cyanBright(`PROPERTY_ASSIGNMENT_MODE`));
        }

    }
}

export const RelationalOperatorPatterns = [
    "is\\s+not\\s+>=",
    "is\\s+not\\s+in",
    "is\\s+not\\s+>",
    "is\\s+not\\s+<=",
    "is\\s+not\\s+<",
    "is\\s+not",
    "is\\s+in",
    "is\\s+>=",
    "is\\s+<=",
    "is\\s+>",
    "is\\s+<",
    "is",
    "are\\s+not\\s+>=",
    "are\\s+not\\s+in",
    "are\\s+not\\s+<=",
    "are\\s+not\\s+>",
    "are\\s+not\\s+<",
    "are\\s+not",
    "are\\s+>=",
    "are\\s+<=",
    "are\\s+in",
    "are\\s+>",
    "are\\s+<",
    "are",
    "has\\s+been",
    "has\\s+not\\s+been",
];

const CodeSymbolPatterns = [
    "::",
    "--",
    "\\(",
    "\\)",
    "\\[",
    "\\]",
    "\\<",
    "\\>",
    ":",
    ",",
    "=",
    "\\|",
    "\\^",
    "`",
];

const LogicalOperatorPatterns = {
    AND: "and",
    OR: "or",
    ANDIF: "andif",
    // TODO: add 'and not' and 'or not' patterns
}

const AssignmentOperatorPatterns = {
    UNASSIG: "to\\s+not",
    ASSIGN: "to",
    INSERT: "into",
    INSIDE: "in",
}

function buildRelationalOperatorPattern(): RegExp {
    const keys = Object.values(RelationalOperatorPatterns);
    const keyPattern = keys.join('|');
    const pattern = `^(${keyPattern})\\s*`;
    return new RegExp(pattern, 'i');
}

function buildLogicalOperatorPattern(): RegExp {
    const keys = Object.values(LogicalOperatorPatterns);
    const keyPattern = specialJoin(keys, '\\b', '|', '\\b');
    const pattern = `^(${keyPattern})\\s*`;
    return new RegExp(pattern, 'i');
}

function buildAssignmentOperatorPattern(): RegExp {
    const keys = Object.values(AssignmentOperatorPatterns);
    // const keyPattern = specialJoin(keys, '\\b', '|', '\\b');
    const keyPattern = keys.join('|');
    const pattern = `^\\b(${keyPattern})\\b\\s*`;
    return new RegExp(pattern, 'i');
}

function buildPhrasePattern(): RegExp {
    let keys = Object.values(LogicalOperatorPatterns);
    keys = keys.concat(RelationalOperatorPatterns);
    keys = keys.concat(Object.values(AssignmentOperatorPatterns));

    const symbols = Object.values(CodeSymbolPatterns);
    // console.log(`symbols:\n${symbols}`);

    // TODO: specialJoin should not be needed: just place a \b before and after the capturing group.  See VSCode
    // Textmate patterns.
    const keyPattern = specialJoin(keys, '\\b', '|', '\\b') + '|' + symbols.join('|');
    // console.log(`keyPattern:\n${keyPattern}`);

    // This pattern can match a single word or a phrase, but it doesn't guarantee there is at least one space between
    // words. (works)
    const pattern = `^([\\w'. -]+?)\\s*(?=(${keyPattern}))`;

    // console.log(`pattern:\n${pattern}`); 

    // This pattern guarantees there is at least one space between words.  Use before checking for a single word.
    // (doesn't work) const testpattern = `^([\\w'.]+(?:\\s+[\\w'.]+)+?)\\s*(?=(${keyPattern}))`;
    return new RegExp(pattern, 'i');
}

function buildWordORPhrasePattern(): RegExp {
    // let phrasePattern = buildPhrasePattern().source;
    // let wordPattern = WORD_PAT.source;

    // Todo: base this regex on the defined phrase patterns -- this is a hack
    let regex = /^([\w'.]+(?:\s+[\w'.]+)+?\s*(?=(\band\b|\bor\b|\bis\s+not\s+>=\b|\bis\s+not\s+in\b|\bis\s+not\s+>\b|\bis\s+not\s+<=\b|\bis\s+not\s+<\b|\bis\s+not\b|\bis\s+in\b|\bis\s+>=\b|\bis\s+<=\b|\bis\s+>\b|\bis\s+<\b|\bis\b|\bare\s+not\s+>=\b|\bare\s+not\s+in\b|\bare\s+not\s+<=\b|\bare\s+not\s+>\b|\bare\s+not\s+<\b|\bare\s+not\b|\bare\s+>=\b|\bare\s+<=\b|\bare\s+in\b|\bare\s+>\b|\bare\s+<\b|\bare\b|\bto\b|\binto\b|\bin\b|::|--|\(|\)|\[|\]|:|,|=|\||\^|`))|^([\w']+))[ \t]*/i;

    // const pattern = `${phrasePattern}|${wordPattern}`;
    // return new RegExp(pattern);
    return regex;
}


/**
 * Patterns used throughout the lexer for matching tokens.
 **/
const LINEFEED_PAT = /^(\r?\n+|\r+)/;
const WHITESPACE_PAT = /^([ \t]+)/;
const WORD_PAT = /^([\w']+)[ \t]*/;
const KEYWORD_PAT = /^\s*([\w' .\-"@#$%&*]+)(?=\s*(?!\1))/;
// const PARAGRAPH_PAT = /^([\w' .,!?:;\-"@#$%&*\`\(\)\<\>]+)[\t]*/;
const PARAGRAPH_PAT = /^((?:(?!<\w+(?:\s*\([^)]*\))?\s*>)[\w' .,!?:;\-~"@#%&*\`\(\)\+=\<\>\/\|\\])+(?:\s+(?=[\{\[\^~]))?)\s*/;
const INLINE_PAT = /^([\w' .,!?:;\-"@#$%&*\(\)]+)[ \t]*/;
const SYMBOL_PAT = /^([^\w\s])\s*/;
const ENTITY_SYMBOL_PAT = /^([\(\)'])\s*/;
const ENTITY_PARAM_DELIM_PAT = /^(\|)\s*/;
const ENTITY_PARAM_ASSIGN_PAT = /^(:)\s*/;
const ENTITY_STATE_DELIM_PAT = /^(,)\s*/;
const ENTITY_STATE_ASSIGN_PAT = /^(=)\s*/;
const ENTITY_DECLARATION_PAT = /^(::)\s*/;
const ENTITY_TYPE_PAT = /^(--)\s*/;
const ENTITY_ID_PAT = /^\s*(.*?)\s+(?=--)/;
const SET_OPEN_PAT = /^(\()\s*/;
const SET_CLOSE_PAT = /^(\))\s*/;
// const CURLY_OPEN_PAT = /^(\{)\s*/;
// const CURLY_CLOSE_PAT = /^(\})\s*/;
const HOTLINK_OPEN_PAT = /^(\[\[)\s*/;
const HOTLINK_CLOSE_PAT = /^(\]\])/;
const ITEM_OPEN_PAT = /^(\{)\s*/;
const ITEM_CLOSE_PAT = /^(\})/;
const SCENERY_DELIM_PAT: RegExp = /^(\^)/;
const ENTITY_DELIM_PAT: RegExp = /^(\~)/;
const LINE_COMMENT_PAT = /(\/\/.*)\r?\n|\r/mg;
const MULTILINE_COMMENT_PAT = /\/\*[^]*?\*\//g
const MACRO_END_PAT = /^(\[\/)\s*/;
const MACRO_OPEN_PAT = /^(\[)\s*/;
const MACRO_CLOSE_PAT = /^(\])/;
const OPTION_OPEN_PAT: RegExp = /^(\<)\s*/;
const OPTION_CLOSE_PAT: RegExp = /^(\>)\s*/;
const INLINE_DELIM_PAT = /^(`)\s*/;
const MACRO_SETTING_PAT = /^(:)\s*/;
const MACRO_SETTING_DELIM_PAT = /^(,)\s*/;
const MACRO_SETTING_ASSIGN_PAT = /^(=)\s*/;
const NUMBER_PAT = /^(\d+(\.\d+)?)\s*/;
const WORD_TOSTRING_PAT = /^\$(\w+)/;
const SINGLE_DOLLARSIGN_PAT = /^(\$)/;
const PARAGRAPH_TOSTRING_PAT = /^\$\((.+)\)/;
const BOOLEAN_PAT = /^(true|false|on|off|yes|no)\s*/;
const LOGOP_PAT = buildLogicalOperatorPattern();
const RELOP_PAT = buildRelationalOperatorPattern();
const ASSIGNOP_PAT = buildAssignmentOperatorPattern();
const PHRASE_PAT = buildPhrasePattern();
const WORDORPHRASE_PAT = buildWordORPhrasePattern();

export type TokenData = {
    type: TokenType;
    value: string;
    pos: number;
    line: number;
    unlowered?: string;
}

/**
 * Lexer class for tokenizing the TSP language and generating a token array.
 */
export class Lexer {

    tokens: TokenData[];        // The token array
    latestToken: TokenData;     // The latest token added to the token array
    filename: string;           // The base name of the input file

    private static maxKeyLength = 50;

    private input: string;      // The input string to be tokenized
    private index: number = 0;  // The current position in the input string

    /**
     * Constructor for initializing Lexer instance.
     * @param input - The input string to be tokenized.
     */
    constructor(input: string, filename: string) {
        this.input = input;
        this.filename = filename;
        this.tokens = [];
        this.latestToken = {type: TokenType.EOF, value: '', pos: 0, line: 0};

        // Temporarily add a newline to the end of the input string, to fix certain pattern matches that look for the
        // end of a line, but find the end of the string.
        this.input += '\n';
        
        // Strip multiline comments from input, keeping newlines intact
        this.input = this.input.replace(MULTILINE_COMMENT_PAT, (match) => {
            const newlines = match.match(/\n/g) || [];
            return "\n".repeat(newlines.length);
        });

        // Strip single line comments, too, by replacingline comments with the same number of newlines to 
        // preserve line numbers
        this.input = this.input.replace(LINE_COMMENT_PAT, (match) => {
            const newlines = match.match(/\n/g) || [];
            return "\n".repeat(newlines.length);
        });

        // Strip whitespace after a newline when there is nothing after it.
        this.input = this.input.replace(/\n[ \t]+(?=\n)/g, '\n');
    }

    /**
     * Iterate the input string and match tokens using regular expressions.
     * Special mode operations are performed for entities, macros, and scenery.  These modes are used to determine
     * which tokens are valid at any given time. For example, a macro can contain any token except another macro.
     * @returns {any[]} - An array of tokens.
     * @throws {Error} - Throws an error if an unexpected token is encountered.
     *
     */
    public tokenize(): any[] {
        while (this.index < this.input.length) {
            // Consume any whitespace and newlines before doing the Entity
            if (this.consumeToken(TokenType.NEWLINES, LINEFEED_PAT)) {
            }
            else if (this.consumeToken(TokenType.WHITESPACE, WHITESPACE_PAT)) {
            }
            else if (this.doEntityMode()) {
            }
            else {
                throw lexerr(this, `Expected Entity pattern, got: '${this.getErrorOutput(this.index)}'`);
            }
        }
        this.pushToken(TokenType.EOF);
        return this.tokens;
    }


    /**
     * Consume tokens valid inside an entity.
     * @returns {boolean} - Returns true if a token is matched, false otherwise.
     * @throws {Error} - Throws an error if an unexpected token is encountered.
     * @private
     */
    private doEntityMode(): boolean {

        const startEntityToken = this.tokens[this.tokens.length - 1];
        let entityTypeMode = '';
        let entityType = '';
        let entityDefinition: CommandDefinition | undefined = undefined;
        // let entityParamMode = '';

        const closeEntity = () => {
            entityTypeMode = '';
            this.pushToken(TokenType.ENTITY_END);
        }

        if (!this.consumeToken(TokenType.ENTITY_START, ENTITY_DECLARATION_PAT)) {
            // Error, expected an Entity here
            throw lexerr(this, `Expected Entity pattern, got: '${this.getErrorOutput(startEntityToken.pos)}'`);
        }

        // Process until the next Entity declaration is found, or EOF
        while (!this.consumeToken(TokenType.ENTITY_START, ENTITY_DECLARATION_PAT) && !this.eof()) {
            if (entityTypeMode === 'done') {
                if (!this.peekToken(TokenType.SET_OPEN, SET_OPEN_PAT)) {
                    // We have an entity type and a name, but no set open, so we're done with the entity
                    closeEntity();
                    break;
                }
            }
            if (this.consumeToken(TokenType.ENTITY_TYPE, ENTITY_TYPE_PAT)) {
                if (entityTypeMode === 'done') {
                    throw lexerr(this, `Malformed Entity: type pattern "--" appears more than once`);
                }
                if (this.consumeToken(TokenType.WORD, WORD_PAT)) {
                    entityType = this.latestToken.value;
                    entityDefinition = this.getCommandDefinition(entityType);
                    entityTypeMode = 'done';
                }
                else {
                    throw lexerr(this, `Malformed Entity: missing type name`);
                }
            }

            // Entity ID
            else if (this.consumeToken(TokenType.PHRASE, ENTITY_ID_PAT)) {}

            // Parameter Mode
            else if (this.consumeToken(TokenType.SET_OPEN, SET_OPEN_PAT)) {
                if (entityDefinition && entityDefinition.attrs === state.parameter) {
                    this.doEntityStatesMode();
                }
                else {
                    this.doEntityParamMode();
                }
                // entityParamMode = 'done';
                // Final check for misplaced entity type
                if (this.peekToken(TokenType.ENTITY_TYPE, ENTITY_TYPE_PAT)) {
                    console.log(`peeking for entity type: entityTypeMode: ${entityTypeMode}`);
                    if (entityTypeMode === 'done') {
                        throw lexerr(this, `Malformed Entity: type pattern "--" appears more than once`);
                    }
                    else {
                        throw lexerr(this, `Malformed Entity: type pattern "--" must appear directy after entity declaration`);
                    }
                }
                closeEntity();
                break;
            }
            // TODO: ENTITY_SYMBOL_PAT represents all punctuation symbols that can occur in an entity.  
            //  Might be scaled down if we catch them in paramMode.
            else if (this.consumeToken(TokenType.ENTITY_SYMBOL, ENTITY_SYMBOL_PAT)) {}
            else if (this.consumeToken(TokenType.NEWLINES, LINEFEED_PAT)) {}
            else {
                throw lexerr(this, `Malformed Entity pattern ${this.blurb()}`);
            }
        }

        // Now cover all the other patterns that can occur after an entity declaration
        this.eatWhitespace();
        this.doEntityBodyMode();

        return true;

    }

    private doEntityParamMode(): boolean {

        // Continue until param mode closing token is found
        while (!this.consumeToken(TokenType.SET_CLOSE, SET_CLOSE_PAT) && !this.eof()) {
            if (this.consumeToken(TokenType.ENTITY_PARAM_DELIM, ENTITY_PARAM_DELIM_PAT)) {
            }
            else if (this.consumeToken(TokenType.ENTITY_PARAM_ASSIGN, ENTITY_PARAM_ASSIGN_PAT)) {
            }
            else if (this.peekToken(TokenType.INLINE_DELIM, INLINE_DELIM_PAT)) {
                this.doInlineMode();
            }
            else if (this.consumeToken(TokenType.PHRASE, PHRASE_PAT)) {
                // Todo: more logic needed to distinguish between left and right side of assignment ':' operator
                if (this.getTokenValue().toLowerCase() === 'flags') {
                    if (!this.consumeToken(TokenType.ENTITY_PARAM_ASSIGN, ENTITY_PARAM_ASSIGN_PAT)) {
                        throw lexerr(this, `Missing assignment operator`, this.latestToken.pos - 10);
                    }
                    return this.doEntityStatesMode();
                }
            }
            else if (this.consumeToken(TokenType.NEWLINES, LINEFEED_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Entity Attribute pattern`);
            }
        }
        return true;
    }

    private doEntityStatesMode(): boolean {
        // while (!this.peekToken(TokenType.SET_CLOSE, SET_CLOSE_PAT)
        while (!this.consumeToken(TokenType.SET_CLOSE, SET_CLOSE_PAT)
        && !this.peekToken(TokenType.ENTITY_PARAM_DELIM, ENTITY_PARAM_DELIM_PAT)
        && !this.eof()) {
            if (this.consumeToken(TokenType.ENTITY_STATE_DELIM, ENTITY_STATE_DELIM_PAT)) {
            }
            else if (this.consumeToken(TokenType.ENTITY_STATE_ASSIGN, ENTITY_STATE_ASSIGN_PAT)) {
            }
            else if (this.consumeToken(TokenType.PHRASE, WORDORPHRASE_PAT)) {
            }
            else if (this.consumeToken(TokenType.NEWLINES, LINEFEED_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Entity Flags/Parameters pattern`);
            }
        }
        return true;
    }

    // private previousEntityStartToken() {
    //     let i = this.tokens.length - 1;
    //     while (i >= 0) {
    //         if (this.tokens[i].type === TokenType.ENTITY_START) {
    //             return this.tokens[i];
    //         }
    //         i--;
    //     }
    //     // Default to current position
    //     return null;
    // }

    private doEntityBodyMode(): boolean {
        // TODO: Check for absent Entity body should happen in Parser, not here.
        // if (this.peekToken(TokenType.ENTITY_END, ENTITY_DECLARATION_PAT)) {
        //     const entityToken = this.previousEntityStartToken();
        //     if (entityToken) {
        //         addErrorMessage(this.filename, entityToken.line, `Entity '${this.blurb( entityToken.pos)}' has no
        // body`); } else { addErrorMessage(this.filename, this.getLineNumber(), `Entity has no body`); } return true;
        // }

        while (!this.peekToken(TokenType.ENTITY_START, ENTITY_DECLARATION_PAT) && !this.eof()) {
            if (this.consumeToken(TokenType.NEWLINES, LINEFEED_PAT)) {
            }
            else if (this.doSceneryMode()) {
            }
            else if (this.doEntityReferenceMode()) {
            }
            else if (this.doHotlinkMode()) {
            }
            else if (this.doItemMode()) {
            }
            else if (this.doMacroMode()) {
            }
            else if (this.doOptionMode()) {
            }
            else if (this.doStringOrWhiteSpaceOrParagraphMode()) {
            }
            else {
                // Generic body error
                throw lexerr(this, `Malformed Entity Body pattern`);
            }
        }
        return true;
    }

    private isAtOptionBoundary(): boolean {
        const remaining = this.input.slice(this.index);
        // Match option patterns like <else>, <elseif>, <elseif (condition)>, etc.
        // This matches < followed by a word, optionally followed by any content, then >
        const optionPattern = /^<\w+(?:\s*\([^)]*\))?\s*>/;
        return optionPattern.test(remaining);
    }

    private doStringOrWhiteSpaceOrParagraphMode(): boolean {

        // Handle the single '$' character when not in the form $(text)
        if (this.doToStringMode()) {
            return true;
        }
        
        // Check if we're at an option boundary before consuming text
        if (this.isAtOptionBoundary()) {
            return false; // Let doOptionMode handle it
        }
        
        if (this.peekToken(TokenType.PARAGRAPH, PARAGRAPH_PAT)) {
            const text = this.peekTokenValue(TokenType.PARAGRAPH, PARAGRAPH_PAT);
            // When the text is only whitespace, consume it as whitespace, otherwise consume it as a paragraph
            if (text.trim() === '') {
                this.consumeToken(TokenType.WHITESPACE, WHITESPACE_PAT);
            }
            else {
                this.consumeToken(TokenType.PARAGRAPH, PARAGRAPH_PAT);
            }
        }
        else if (this.consumeToken(TokenType.WHITESPACE, WHITESPACE_PAT)) {
        }
        else {
            return false;
        }
        return true;
    }

    /**
     * Method to handle macro mode.  This mode is used to determine which tokens are valid inside a macro.
     * @returns {boolean} - Returns true if a token is matched, false otherwise.
     * @throws {Error} - Throws an error if an unexpected token is encountered.
     * @private
     */
    private doMacroMode(): boolean {

        // Guard: check for macro opening pattern (`[`) or macro ending pattern (`[/`)
        if (!this.consumeToken(TokenType.MACRO_END, MACRO_END_PAT) && !this.consumeToken(TokenType.MACRO_OPEN, MACRO_OPEN_PAT)) {
            return false;
        }

        let macroCommandSet: boolean = false;

        // Keep going until the macro statement is closed (`[/`)
        while (!this.consumeToken(TokenType.MACRO_CLOSE, MACRO_CLOSE_PAT) && !this.eof()) {

            // Ensure macro statement is not accidentally nested
            if (this.consumeToken(TokenType.MACRO_OPEN, MACRO_OPEN_PAT)
                || this.consumeToken(TokenType.MACRO_END, MACRO_END_PAT)) {
                throw lexerr(this, `Unexpected opening macro symbol '[' inside macro`);
            }
            else if (this.peekToken(TokenType.MACRO_SETTING, MACRO_SETTING_PAT)) {
                this.doMacroSettingMode();
            }
            else if (this.peekToken(TokenType.SET_OPEN, SET_OPEN_PAT)) {
                this.doMacroConditionMode();
            }
            else if (this.peekToken(TokenType.INLINE_DELIM, INLINE_DELIM_PAT)) {
                this.doInlineMode();
            }
            else if (this.consumeToken(TokenType.LOGOP, LOGOP_PAT)) {
            }
            else if (this.consumeToken(TokenType.RELOP, RELOP_PAT)) {
            }
            else if (this.consumeToken(TokenType.ASSIGNOP, ASSIGNOP_PAT)) {
            }
            else if (!macroCommandSet && this.consumeToken(TokenType.WORD, WORD_PAT)) {
                macroCommandSet = true;
            }
            else if (macroCommandSet && this.consumeToken(TokenType.PHRASE, PHRASE_PAT)) {
            }
            else if (this.consumeToken(TokenType.SYMBOL, SYMBOL_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Macro pattern`);
            }
        }
        return true;
    }

    private doOptionMode(): boolean {

        // Guard: check for macro opening pattern (`[`) or macro ending pattern (`[/`)
        if (!this.consumeToken(TokenType.OPTION_OPEN, OPTION_OPEN_PAT)) {
            return false;
        }

        let optionCommandSet: boolean = false;

        // Keep going until the macro statement is closed (`[/`)
        while (!this.consumeToken(TokenType.OPTION_CLOSE, OPTION_CLOSE_PAT) && !this.eof()) {

            // Ensure macro statement is not accidentally nested
            if (this.consumeToken(TokenType.MACRO_OPEN, MACRO_OPEN_PAT)
                || this.consumeToken(TokenType.MACRO_END, MACRO_END_PAT)) {
                throw lexerr(this, `Unexpected opening macro symbol '[' inside macro`);
            }
            else if (this.consumeToken(TokenType.OPTION_OPEN, OPTION_OPEN_PAT)) {
                throw lexerr(this, `Unexpected opening option symbol '<' inside macro`);
            }
            else if (this.peekToken(TokenType.MACRO_SETTING, MACRO_SETTING_PAT)) {
                this.doMacroSettingMode();
            }
            else if (this.peekToken(TokenType.SET_OPEN, SET_OPEN_PAT)) {
                this.doMacroConditionMode();
            }
            else if (this.peekToken(TokenType.INLINE_DELIM, INLINE_DELIM_PAT)) {
                this.doInlineMode();
            }
            // else if (this.consumeToken(TokenType.LOGOP, LOGOP_PAT)) {
            // }
            // else if (this.consumeToken(TokenType.RELOP, RELOP_PAT)) {
            // }
            // else if (this.consumeToken(TokenType.ASSIGNOP, ASSIGNOP_PAT)) {
            // }
            else if (!optionCommandSet && this.consumeToken(TokenType.WORD, WORD_PAT)) {
                optionCommandSet = true;
            }
            else if (optionCommandSet && this.consumeToken(TokenType.PHRASE, PHRASE_PAT)) {
            }
            else if (this.consumeToken(TokenType.SYMBOL, SYMBOL_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Option pattern`);
            }
        }
        return true;
    }


    private doMacroConditionMode(): boolean {

        // Guard
        if (!this.consumeToken(TokenType.SET_OPEN, SET_OPEN_PAT)) {
            return false;
        }

        // Continue until condition mode closing token is found
        while (!this.consumeToken(TokenType.SET_CLOSE, SET_CLOSE_PAT) && !this.eof()) {
            if (this.consumeToken(TokenType.LOGOP, LOGOP_PAT)) {
            }
            else if (this.consumeToken(TokenType.RELOP, RELOP_PAT)) {
            }
            else if (this.consumeToken(TokenType.ASSIGNOP, ASSIGNOP_PAT)) {
            }    // Now includes 'to not'
            else if (this.doInlineMode()) {
            }
            else if (this.consumeToken(TokenType.PHRASE, PHRASE_PAT)) {
            }
            // else if (this.doToken(TokenType.PHRASE, WORD_PAT)) {}
            else if (this.consumeToken(TokenType.SYMBOL, SYMBOL_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Macro Condition pattern`);
            }
        }
        return true;
    }

    private doMacroSettingMode(): boolean {

        // Guard for macro settings mode
        if (!this.consumeToken(TokenType.MACRO_SETTING, MACRO_SETTING_PAT)) {
            return false;
        }
        while (!this.peekToken(TokenType.INLINE_DELIM, INLINE_DELIM_PAT)
        && !this.peekToken(TokenType.SET_OPEN, SET_OPEN_PAT)
        && !this.peekToken(TokenType.MACRO_CLOSE, MACRO_CLOSE_PAT)
        && !this.eof()) {

            if (this.consumeToken(TokenType.MACRO_SETTING_DELIM, MACRO_SETTING_DELIM_PAT)) {
            }
            else if (this.consumeToken(TokenType.MACRO_SETTING_ASSIGN, MACRO_SETTING_ASSIGN_PAT)) {
            }
            else if (this.consumeToken(TokenType.NUMBER, NUMBER_PAT)) {
            }
            else if (this.consumeToken(TokenType.BOOLEAN, BOOLEAN_PAT)) {
            }
            else if (this.consumeToken(TokenType.PHRASE, WORDORPHRASE_PAT)) {
            }
            // TODO: Add a pattern for matching a STRING here.  May need to use double-quotes to distinguish it from
            // inline pattern.
            else {
                throw lexerr(this, `Malformed Macro Setting pattern`);
            }
        }
        // Add token MACRO_SETTING_END to mark the end of the macro setting
        this.pushToken(TokenType.MACRO_SETTING_END);
        return true;
    }

    /**
     * Method to handle scenery mode.  This mode is used to determine which tokens are valid inside a scenery pattern.
     * @returns {boolean} - Returns true if a token is matched, false otherwise.
     * @throws {Error} - Throws an error if an unexpected token is encountered.
     * @private
     */
    private doSceneryMode(): boolean {

        if (!this.consumeToken(TokenType.SCENERY_DELIMITER, SCENERY_DELIM_PAT)) {
            return false;
        }

        const sceneryPosition = this.latestToken.pos;

        while (!this.consumeToken(TokenType.SCENERY_DELIMITER, SCENERY_DELIM_PAT) && !this.eof()) {
            // Check to ensure the scenery content is not too long
            if (this.index - sceneryPosition > Lexer.maxKeyLength) {
                throw lexerr(this, `Scenery identifier exceeds maximum length of ${Lexer.maxKeyLength}`, sceneryPosition);
            }

            if (this.doInlineMode()) {
            }

            else if (this.consumeToken(TokenType.KEYWORD, KEYWORD_PAT)) {
            }
            // Todo: faily generic symbol pattern, might need to be more specific
            else if (this.consumeToken(TokenType.SYMBOL, SYMBOL_PAT)) {
            }
            else {
                const prevToken = this.tokens[this.tokens.length - 1];
                // When last token is not type SCENERY_DELIM_PAT, user might have forgotten the closing scenery marker
                if (prevToken.type !== TokenType.SCENERY_DELIMITER) {
                    throw lexerr(this, `Malformed Scenery pattern (missing closing '^'?)`);
                }
                else {
                    // Any other error is a malformed macro
                    throw lexerr(this, `Malformed Scenery pattern`);
                }
            }
        }
        return true;
    }

    /**
     * Method to handle entity reference mode.  This mode is used to determine which tokens are valid inside an entity
     * reference pattern. This can contain fixtures, items and npc's only.
     * @returns {boolean} - Returns true if a token is matched, false otherwise.
     * @throws {Error} - Throws an error if an unexpected token is encountered.
     * @private
     */
    private doEntityReferenceMode(): boolean {

        if (!this.consumeToken(TokenType.ENTITY_REF_DELIMITER, ENTITY_DELIM_PAT)) {
            return false;
        }

        const entityRefPosition = this.latestToken.pos;

        while (!this.consumeToken(TokenType.ENTITY_REF_DELIMITER, ENTITY_DELIM_PAT) && !this.eof()) {

            // Check to ensure the scenery content is not too long
            if (this.index - entityRefPosition > Lexer.maxKeyLength) {
                throw lexerr(this, `Entity Reference identifier exceeds maximum length of ${Lexer.maxKeyLength}`, entityRefPosition);
            }

            if (this.consumeToken(TokenType.KEYWORD, KEYWORD_PAT)) {
            }
            else {
                const prevToken = this.tokens[this.tokens.length - 1];
                // When last token is not type ENTITY_DELIM_PAT, user might have forgotten the closing scenery marker
                if (prevToken.type !== TokenType.ENTITY_REF_DELIMITER) {
                    throw lexerr(this, `Malformed Entity Reference pattern (missing closing '~'?)`);
                }
                else {
                    // Any other error is a malformed macro
                    throw lexerr(this, `Malformed Entity Reference pattern`);
                }
            }
        }
        return true;
    }


    /**
     * Method to handle hotlink mode.  This mode is used to determine which tokens are valid inside a hotlink pattern.
     * @returns {boolean} - Returns true if a token is matched, false otherwise.
     * @throws {Error} - Throws an error if an unexpected token is encountered.
     * @private
     */
    private doHotlinkMode(): boolean {

        if (!this.consumeToken(TokenType.HOTLINK_OPEN, HOTLINK_OPEN_PAT)) {
            return false;
        }

        const hotlinkPosition = this.latestToken.pos;

        while (!this.consumeToken(TokenType.HOTLINK_CLOSE, HOTLINK_CLOSE_PAT) && !this.eof()) {

            // Check to ensure the scenery content is not too long
            if (this.index - hotlinkPosition > Lexer.maxKeyLength) {
                throw lexerr(this, `Hotlink identifier exceeds maximum length of ${Lexer.maxKeyLength}`, hotlinkPosition);
            }

            // If we find another hotlink open pattern, ensure hotlink was properly closed
            if (this.consumeToken(TokenType.HOTLINK_OPEN, HOTLINK_OPEN_PAT)) {
                throw lexerr(this, `Unexpected opening hotlink symbol inside hotlink (missing closing ']]'?)`);
            }
            if (this.doInlineMode()) {
            }
            else if (this.consumeToken(TokenType.KEYWORD, KEYWORD_PAT)) {
            }
            else if (this.consumeToken(TokenType.SYMBOL, SYMBOL_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Hotlink pattern`);
            }
        }
        return true;
    }

    /**
     * This must always be called before consuming a paragraph.  It checks for a '$', which is also consumed by the
     * PARAGRAPH_PAT, so we need to process this first.
     */
    private doToStringMode(): boolean {
        log(`doToStringMode at index ${cpath(this.blurb())}`);

        // Check for '$'
        if (this.peekToken(TokenType.PARAGRAPH, SINGLE_DOLLARSIGN_PAT)) {
            // If found, check that it's a proper TOSTRING pattern
            if (this.consumeToken(TokenType.TO_STRING, PARAGRAPH_TOSTRING_PAT)) {
                log(`doToStringMode: Matched PARAGRAPH_TOSTRING_PAT at index:: ${amber(this.blurb())}`);
                return true;
            }
            // Paragraph consumption will not include the '$' symbol, so we consume it here instead and return true.
            // This will result in a series of tokens like "PARAGRAPH", "SINGLE_DOLLARSIGN", "PARAGRAPH".
            this.consumeToken(TokenType.PARAGRAPH, SINGLE_DOLLARSIGN_PAT);
            return true;
        }
        log(`doToStringMode: No match at index ${intr(this.blurb())}`);
        return false;

        // if (this.consumeToken(TokenType.TO_STRING, PARAGRAPH_TOSTRING_PAT)) {
        //     log(`doToStringMode: Matched PARAGRAPH_TOSTRING_PAT at index:: ${amber(this.blurb())}`);
        // }
        // // else if (this.consumeToken(TokenType.TO_STRING, WORD_TOSTRING_PAT)) {
        // //     // log(`doToStringMode: Matched WORD_TOSTRING_PAT at index ${vsn(this.blurb())}`);
        // // }
        // else {
        //     log(`doToStringMode: No match at index ${intr(this.blurb())}`);
        //     return false;
        // }
        // return true;
    }

    private doInlineMode(): boolean {

        if (!this.consumeToken(TokenType.INLINE_DELIM, INLINE_DELIM_PAT)) {
            return false;
        }

        while (!this.consumeToken(TokenType.INLINE_DELIM, INLINE_DELIM_PAT) && !this.eof()) {
            if (this.consumeToken(TokenType.PARAGRAPH, INLINE_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Inline pattern`);
            }
        }
        return true;
    }

    private doItemMode(): boolean {

        if (!this.consumeToken(TokenType.ITEM_OPEN, ITEM_OPEN_PAT)) {
            return false;
        }

        const itemPosition = this.latestToken.pos;

        while (!this.consumeToken(TokenType.ITEM_CLOSE, ITEM_CLOSE_PAT) && !this.eof()) {

            // Check to ensure the scenery content is not too long
            if (this.index - itemPosition > Lexer.maxKeyLength) {
                throw lexerr(this, `Item identifier exceeds maximum length of ${Lexer.maxKeyLength}`, itemPosition);
            }

            // If we find another item open pattern, ensure item was properly closed
            if (this.consumeToken(TokenType.ITEM_OPEN, ITEM_OPEN_PAT)) {
                throw lexerr(this, `Unexpected opening item symbol inside item (missing closing ']]'?)`);
            }
            if (this.doInlineMode()) {
            }
            else if (this.consumeToken(TokenType.KEYWORD, KEYWORD_PAT)) {
            }
            else if (this.consumeToken(TokenType.SYMBOL, SYMBOL_PAT)) {
            }
            else {
                throw lexerr(this, `Malformed Item pattern`);
            }
        }
        return true;
    }

    /**
     * Method to match a token using a regular expression pattern.  If a match is found, the token is added to the
     * token array and the position is incremented.
     * @param type - The token type.
     * @param pattern - The regular expression pattern to match.
     * @returns {boolean} - Returns true if a match is found, false otherwise.
     */
    private consumeToken(type: TokenType, pattern: RegExp): boolean {
        const match = pattern.exec(this.input.slice(this.index));
        if (match) {
            if (type === TokenType.KEYWORD) {
                this.pushToken(type, match[1].trim());
            }
            else {
                this.pushToken(type, match[1]);
            }
            this.index += match[0].length;
            return true
        }
        return false;
    }


    private pushToken(type: TokenType, value: string = '') {
        const token: TokenData = {type: type, value, pos: this.index, line: this.getLineNumber()}

        // // Force case insensitive matching for keywords - avoid PARAGRAPH and INLINE tokens
        // if (type !== TokenType.PARAGRAPH) {
        //     token.value = token.value.toLowerCase();
        // }

        this.latestToken = token;
        this.tokens.push(token);
        this.outputTokens(type, value);
    }

    /**
     * Method to peek ahead in the input string to see if a token matches a regular expression pattern.
     * @param type
     * @param pattern
     * @private
     */
    private peekToken(type: TokenType, pattern: RegExp): boolean {
        const match = pattern.exec(this.input.slice(this.index));
        return !!match;
    }

    private peekTokenValue(type: TokenType, pattern: RegExp): string {
        const match = pattern.exec(this.input.slice(this.index));
        if (match) {
            return match[1];
        }
        return '';
    }

    private eatWhitespace() {
        while (!this.eof()) {
            if (this.consumeToken(TokenType.WHITESPACE, WHITESPACE_PAT)) {
            }
            else if (this.consumeToken(TokenType.NEWLINES, LINEFEED_PAT)) {
            }
            else {
                break;
            }
        }
        return true;
    }

    private lookbackToken(offset = 1): TokenData | null {
        if (offset <= this.tokens.length) {
            return null;
        }
        return this.tokens[this.tokens.length - offset];
    }

    /**
     * Returns the number of lines to the specified `position`.  If no index is specifiec, use the class's `sourceIndex`
     * @param pos
     * @returns {number}
     * @private
     */
    getLineNumber(pos?: number): number {
        if (!pos) {
            pos = this.index
        }
        const slice = this.input.slice(0, pos);
        return slice.split('\n').length;
    }

    /**
     * Returns a blurb of the input string at the specified `position`.  If no index is specifiec, use the class's
     * `sourceIndex`
     * @param pos
     * @returns {string}
     * @private
     */
    blurb(pos?: number): string {
        if (!pos) {
            pos = this.index
        }
        const slice = this.input.slice(pos);
        const lines = slice.split('\n');

        const line = lines[0];
        if (line.length > Lexer.maxKeyLength) {
            return line.slice(0, Lexer.maxKeyLength) + '...';
        }
        return line;
    }

    /**
     * Returns an error message with the line number and a blurb of the input string at the specified `position`.
     * If no index is specifiec, use the class's `sourceIndex`
     * @param pos
     * @returns {string}
     * @private
     */
    private getErrorOutput(pos?: number): string {
        if (!pos) {
            pos = this.index;
        }
        const line = this.getLineNumber(pos);
        const blurb = this.blurb(pos);
        return `at line ${line}: "${blurb}"`;
    }

    /**
     * Method to output the token type and value to the console.
     * @param type
     * @param value
     * @private
     */
    private outputTokens(type: TokenType, value: string) {
        LexerStates.display();
        value = value.replace(/\n|\r/g, '\\n');
        log(`Matched (${this.getLineNumber().toString().padStart(3, '0')}) ${tclr(type)}: \`${vclr(value.trim())}\``)
    }

    private getTokenValue(offset = 0): string {
        if (offset >= this.tokens.length) {
            return '';
        }
        return this.tokens[this.tokens.length - offset - 1].value;
    }

    private eof(): boolean {
        return this.index >= this.input.length;
    }
    
    private getCommandDefinition(tag:string) {
        if (definitions.hasOwnProperty(tag)) {
            return definitions[tag];
        }
        throw lexerr(this, `Undefined command definition: '${tag}'`);
    }
}

/**
 * Helper function to colorize text for output to the console.
 * @param text
 */
function tclr(text: string): string {
    return chalk.magentaBright(text);
}

/**
 * Helper function to colorize text for output to the console.
 * @param text
 */
function vclr(text: string): string {
    return chalk.yellowBright(text);
}

/**
 * Helper function to call console.log only if DEBUG_MODE is true.
 */
function log(...args: any[]) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

export default Lexer;

