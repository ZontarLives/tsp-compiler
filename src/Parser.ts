import {cmdType, state, options} from './Definitions';
import Cursor from "./Cursor";
import {LogicalExpression, LogicalOperator, RelationalOperator, TokenType} from "./TokenTypes";
import {TokenData} from "./Lexer";
import {Command, CommandData, EntityStates} from "./Command";
import {combineObjectsUnique} from "./Base";
import chalk from "chalk";
import {advisement, amber, cmderr, errclr, intr, out, parserr, struc, wrnclr} from "./Logger";
import {addError, addWarning} from "./Errors";
import {EntityTypes} from "./CommonTypes";
import {
    getCommandDefinition,
    isStructuredMacro,
    Verification
} from "./Verification";

let DEBUG_MODE = false;
let DEBUG_REFERENCE_BUILD = false;

/**
 * Represents a parsed command. Commands are the basic building blocks of a TSP file. They can be entities, macros, or
 * text blocks. Commands can be nested within each other. Commands are parsed from tokens by the Parser class.
 * @class
 * @property {TokenData[]} token - Token data created by the Lexer, passed to the Parser.
 * @property {number} current - The current index of the token being parsed.
 *
 */
export class Parser {

    // Operations for each entity occur one at a time
    public currentEntityDef: CommandData = {type: cmdType.entity, uid: generateUniqueId()};
    // List of scenery references `^book^` that are found in the current entity
    public currentSceneryReferences: Record<string, CommandData> = {};
    // Entity references for determining item vs fixed link types
    private entityReferences: Record<string, CommandData> = {};

    // Reference to an created instance of an associated Cursor class
    readonly cursor: Cursor;
    // The name of the file being parsed
    readonly filename: string;

    constructor(tokens: TokenData[], filename: string) {
        this.filename = filename;
        this.cursor = new Cursor(tokens, filename);
    }

    /**
     * Parse the list of tokens into meaningful structures
     * @returns Parsed structures
     */
    parse(references: Record<string, CommandData>): Record<string, Command> {
        this.entityReferences = references;  // Store for entity type lookup
        let entities: Record<string, Command> = {};
        this.cursor.reinit();

        // Iterate through each entity reference in `references` and move on to this.parseEntityBody()
        for (const key in references) {
            while (this.cursor.match('newline', TokenType.NEWLINES, TokenType.WHITESPACE, TokenType.LINE_COMMENT)) {
                continue;
            }
            const entity: Command = this.parseEntity(references, key);
            entities = combineObjectsUnique(entities, {[entity.id!]: entity});
        }
        return entities;
    }

    /**
     * Parse a single entity.
     * @returns Parsed Entity
     * @throws Error if invalid nesting or unpermitted initial body is encountered
     */
    private parseEntity(references: Record<string, CommandData>, key: string): Command {
        if (references.hasOwnProperty(key)) {
            this.currentEntityDef = references[key];
            this.currentSceneryReferences = {};
            // Move the position past the end of the entity
            this.cursor.seek('Seeking entity end', TokenType.ENTITY_END);
            // Parse the body of the entity
            const body = this.parseEntityBody(this.currentEntityDef);
            if (this.currentEntityDef.type !== 'variable') {
                this.currentEntityDef.body = body;
            }
            // Check for end of the entity body
            if (this.cursor.check(TokenType.ENTITY_START) || this.cursor.isAtEnd()) {
                const entity = Command.construct(this.currentEntityDef, null,this);
                Verification.verifyCommandSingularity(entity, this);
                return entity;
            }
        }
        throw parserr(this, `Malformed entity ${key}`);
    }

    /**
     * Parse properties of an entity.
     * @param entity The entity to which the properties will be added.
     */
    private parseEntityAttributes(entity: CommandData) {
        let attrs: Record<string, string | any> = {};
        let flags: Record<string, string | any> = {};

        while (!this.cursor.match(`attrs close ')'`, TokenType.SET_CLOSE)) {

            this.cursor.match("attrs line comment", TokenType.LINE_COMMENT);

            if (this.cursor.match(`attrs delim '|'`, TokenType.ENTITY_PARAM_DELIM)) {
                continue;
            }

            const propKey = this.cursor.consume(`attrs id`, TokenType.PHRASE).value;
            Verification.verifyEntityParameters(entity, propKey);

            let propValue;
            this.cursor.match("attrs assign op ':'", TokenType.ENTITY_PARAM_ASSIGN,);

            // The `flags` property is special, and can have multiple comma-separated values
            if (propKey === 'flags') {
                propValue = this.parseCommaSeparatedValues(entity);
                flags = propValue;
            } else {

            // The value of the property can be one or more words (PHRASE), but it can also
            // be a `string`, so we need to check for those as well.
            if (this.cursor.check(TokenType.INLINE_DELIM)) {
                propValue = this.consumeInline();
            }
            else {
                propValue = this.cursor.consume("attrs value", TokenType.PHRASE).value;
            }
            attrs[propKey] = propValue;
            }
        }
        return {attrs, flags};
    }

    /**
     * Parse settings of an entity in the form of a series of comma-separated key-value pairs.
     * @param entity
     * @private
     */
    private parseCommaSeparatedValues(entity: CommandData) {
        let result: any = {};
        // Continue util we encounter the end of the flags
        while (this.cursor.peek().type !== TokenType.SET_CLOSE && this.cursor.peek().type !== TokenType.ENTITY_PARAM_DELIM) {
            const flagKey = this.cursor.consume("flag id", TokenType.PHRASE).value;
            // Check if the flagKey already exists in the result
            if (result.hasOwnProperty(flagKey)) {
                addWarning(entity, `Duplicate flag name '${flagKey}' found. The value will be overwritten.`);
            }
            let rval = undefined;
            if (this.cursor.peek().type === TokenType.ENTITY_STATE_ASSIGN) {
                this.cursor.match("flag assign op '=' ", TokenType.ENTITY_STATE_ASSIGN);
                rval = this.cursor.consume("flag value", TokenType.PHRASE).value;
                // if rval is a boolean represented as a string, convert it to a boolean
                rval = tryStringToPrimitive(rval);
            }
            else {
                rval = false;
            }
            result[flagKey] = rval;
            this.cursor.match("flag delim ','", TokenType.ENTITY_STATE_DELIM);
        }
        return result;
    }


    /**
     * Parse elements of an Entity body in the form of a list of Command type objects.
     * @param entity
     * @private
     */
    private parseEntityBody(entity: CommandData): Command[] {
        this.cursor.level += 1;
        const commandList: Command[] = [];

        // While current token is not the start of an entity or EOF
        while (!this.cursor.check(TokenType.ENTITY_START) && !this.cursor.isAtEnd()) {
            // If the current token is a macro, parse it
            if (this.cursor.check(TokenType.MACRO_OPEN)) {
                commandList.push(this.parseMacro(entity,entity.uid, entity));
            }
            else if (this.cursor.check(TokenType.HOTLINK_OPEN)) {
                commandList.push(this.parseHotlink(entity));
            }
            else if (this.cursor.check(TokenType.ITEM_OPEN)) {
                commandList.push(this.parseItem(entity));
            }
            else if (this.cursor.check(TokenType.SCENERY_DELIMITER)) {
                commandList.push(this.parseScenery(entity));
            }
            else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
                commandList.push(this.parseNpcLink(entity));
            }
            else if (this.cursor.check(TokenType.TO_STRING)) {
                commandList.push(this.parseToString());
            }
            else if (this.cursor.check(TokenType.NEWLINES)) {
                commandList.push(this.parseNewlines());
            }
            else if (this.cursor.check(TokenType.WHITESPACE)) {
                commandList.push(this.parseStructuralWhitespace());

                // We don't want to add whitespace commands here, so we'll just skip over them
                //this.parseStructuralWhitespace();

                // TODO: ^^ Problem here is that some whitespace should be kept.  For example, after an inline command
                // like ^scene^ Perhaps it's not structural whitespace when there is trailing whitespace after a
                // non-newline token and before an ending newline token?

            }
            else if (this.cursor.check(TokenType.WORD, TokenType.PHRASE, TokenType.PARAGRAPH)) {
                commandList.push(this.parseTextBlock());
            }
            else if (this.cursor.isAtEnd()) {
            }
            else if (this.cursor.check(TokenType.MACRO_END)) {
                const errMsg = `Malformed simple macro: '${this.cursor.lookAhead().value}' does not require a closing macro`;
                addError(entity, errMsg);
                log(this.cursor.linePrefix() + errclr(errMsg));
                this.cursor.match("bad macro end open brace", TokenType.MACRO_END);
                this.cursor.match("bad macro end tag", TokenType.WORD);
                this.cursor.match("bad macro end close brace", TokenType.MACRO_CLOSE);
            }
            else {
                throw cmderr(entity, `Invalid body content for entity ${entity.tag}`);
            }
        }
        this.cursor.level -= 1;
        return commandList;
    }

    private parseMacro(parentEntity: CommandData, parentUid: string, parentCommand?: CommandData): Command {
        let macro: CommandData = {
            type: cmdType.macro,
            uid: generateUniqueId(parentUid),
            line: this.cursor.line(),
            file: this.filename,
            parentEntity: parentEntity
        };

        if (!this.cursor.check(TokenType.MACRO_OPEN)) {
            throw parserr(this, this.unexpectedTokenMsg(TokenType.MACRO_OPEN));
        }

        log(this.cursor.linePrefix() + amber(`[${this.cursor.lookAhead(1).value}] Starting Macro tag`));

        // First match must be macro open, then optionally tag, then id.
        this.cursor.match("macro open", TokenType.MACRO_OPEN);
        macro.tag = this.cursor.consume("macro tag", TokenType.WORD).value.toLowerCase();

        const macroDef = getCommandDefinition(macro);
        macro.type = macroDef.type;
        macro.flowController = macroDef.flowController;
        macro.cmdState = macroDef.cmdState;

        // When the macro is an assigment statement, which has a different structure, parse it separately.

        // Assignment pattern (must add check for inline text when taken out of sequence)
        if (this.tryAssignmentPattern(macro)) {
        }

        // More standard patterns
        else {
            if (this.cursor.check(TokenType.PHRASE)) {
                macro.id = this.cursor.consume("macro id", TokenType.PHRASE).value.toLowerCase();
            }

            /* Between here and the Body, we can have an inline body, conditionals, and settings in ANY ORDER */

            while (!this.cursor.match("macro close", TokenType.MACRO_CLOSE)) {
                // Inline text pattern
                macro.inlineText = this.tryInlineBody(macro);
                // Conditional pattern
                macro.cond = this.parseMacroConditionals(macro);
                // Settings pattern
                macro.settings = this.parseMacroSettings(macro);
            }
            // Macro close (ends the macro tag)
            // this.cursor.match("macro close", TokenType.MACRO_CLOSE);

            log(this.cursor.linePrefix() + amber(`[${macro.tag}] Done Macro tag`));
        }


        /* Body parsing starts here */

        // At this point we must check the type of the macro to determine whether or not we should parse a body.
        // To do this, we check the tag of the macro against the definitons list.
        if (this.macroCanHaveBody(macro)) {
            // Check for an option macro type
            if (isStructuredMacro(macro)) {
                // Must take a structured macro with only a leadin and no body into account: move leadin into body?
                macro.body = this.parseStructuredMacroBody(parentEntity,macro, parentUid);
            }
            else {
                macro.body = this.parseMacroBody(parentEntity, macro);
            }

            if (!macro.body) {
                if (!macro.inlineText) {
                    // There is no body or inline body for the macro.  Err when it can't also have a leadin.
                    if (!(macroDef.shape && macroDef.shape.leadin)) {
                        // If the macro body is empty, there is no need to parse for an end macro.
                        addError(macro, `Macro body and inline are empty`);
                    }
                    // // If the macro body is empty, there is no need to parse for an end macro.
                    // addError(macro, `Macro body and inline are empty`);
                }
                else {
                    // If the macro body is empty, there is no need to parse for an end macro.
                    addWarning(macro, `Macro body is empty`);
                }
            }
            this.parseEndMacro(macro.tag);  // A normal macro, as well as a structured macro, will return here.
        }
        const command = Command.construct(macro, parentEntity,this, parentCommand);
        if (macroDef.cmdState) {
            // This is a state command, so log the UID to add it to the gamefile under 'statecommands'
            log(`State command: ${command.uid}`);
        }
        return command;
    }

    // TODO, bring check for an id (lval) into this function
    tryAssignmentPattern(macro: CommandData) {
        const macroDef = getCommandDefinition(macro);
        if (macroDef.type === cmdType.assignment) {
            macro.id = this.cursor.consume("macro id", TokenType.PHRASE).value;
            macro.op = this.cursor.consume("macro assignment op 'to' or 'to not", TokenType.ASSIGNOP).value;
            if (this.cursor.check(TokenType.PHRASE)) {
                macro.rval = this.cursor.consume("macro assignment value", TokenType.PHRASE).value;
            }
            else {
                macro.rval = this.consumeInline(); //(TokenType.INLINE_DELIM, "macro inline value").value;
            }
            this.cursor.match("macro close", TokenType.MACRO_CLOSE);
            return true;
        }
        return false;
    }

    /**
     * If the cursor matches an inline body, consume it and return the value. Otherwise, return whatever is already in
     * the given macro definition.  This means we can call it and not overwrite the inlineText field of the macro if it
     * already has a value.
     *
     */
    tryInlineBody(macro: CommandData) {
        let inlineText = undefined;
        if (this.cursor.match("macro inline delim", TokenType.INLINE_DELIM)) {
            // There are cases where a macro can have both an inline body and a block body.  In this case, the 
            // inlineText field contains the backtick-quoted inline body, and the body field contains the block body. 
            // TODO: In special cases, the inline body can represent the block body for abbreviated macros like 
            //  [present `xxx`]. This case is to be implemented later.
            inlineText = this.cursor.consume("macro inline body", TokenType.PARAGRAPH).value;
            this.cursor.match("macro inlilne delim", TokenType.INLINE_DELIM)
        }
        else {
            inlineText = macro.inlineText;
        }
        return inlineText;
    }

    private parseMacroBody(parentEntity: CommandData, parentMacro: CommandData): Command[] {
        this.cursor.level += 1;
        const commandList: Command[] = [];
        log(this.cursor.linePrefix() + wrnclr(`[${parentMacro.tag}] Macro body START`));

        // While current token is not the start of an entity or EOF
        while (!this.cursor.check(TokenType.MACRO_END)) {

            this.cursor.match("macro body line comment", TokenType.LINE_COMMENT);

            // If the current token is a macro, parse it
            if (this.cursor.check(TokenType.MACRO_OPEN)) {
                commandList.push(this.parseMacro(parentEntity,parentMacro.uid));
            }
            else if (this.cursor.check(TokenType.HOTLINK_OPEN)) {
                commandList.push(this.parseHotlink(parentEntity));
            }
            else if (this.cursor.check(TokenType.ITEM_OPEN)) {
                commandList.push(this.parseItem(parentEntity));
            }
            else if (this.cursor.check(TokenType.SCENERY_DELIMITER)) {
                commandList.push(this.parseScenery(parentEntity));
            }
            else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
                commandList.push(this.parseNpcLink(parentEntity));
            }
            else if (this.cursor.check(TokenType.TO_STRING)) {
                commandList.push(this.parseToString());
            }
            else if (this.cursor.check(TokenType.WORD, TokenType.PHRASE, TokenType.PARAGRAPH)) {
                commandList.push(this.parseTextBlock());
            }
            else if (this.cursor.check(TokenType.NEWLINES)) {
                commandList.push(this.parseNewlines());
            }
            else if (this.cursor.match('whitespace', TokenType.WHITESPACE)) {
            }
            else if (this.cursor.match('entity start', TokenType.ENTITY_START)) {
                throw parserr(this, `Unexpected Entity declaration for "${this.cursor.peek().value}". (No closing tag for [${parentMacro.tag}]?)`);
            }
            else {
                throw parserr(this, `Invalid body content for block macro ${parentMacro.tag}`);
            }
        }
        log(this.cursor.linePrefix() + wrnclr(`[${parentMacro.tag}] Macro body END`));
        this.cursor.level -= 1;
        return commandList;
    }

    private parseStructuredMacroBody(parentEntity: CommandData, parentMacro: CommandData, entityUid: string): Command[] | undefined {
        const commandList: Command[] = [];

        if (!parentMacro.tag) {
            throw parserr(this, "Structured macro must have a tag");
        }

        log(this.cursor.linePrefix() + struc(`[${parentMacro.tag}] Structured macro body START (incrementing level)`));
        this.cursor.level += 1;

        this.skipAllWhitespace();

        const def = getCommandDefinition(parentMacro);

        // Handle optional leadin text if the next token is not a structured macro or an option macro for this structure
        if (def.shape!.leadin) {
            log(this.cursor.linePrefix() + struc(`[${parentMacro.tag}] Parsing structured leadin`));
            // We could potentially be sitting on the open brace of a normal macro, so do some extra checking
            //  if (!this.checkForOptionMacro()) {
             if (!this.assertOptionMacro(parentMacro.tag)) {
                log(this.cursor.linePrefix() + struc(`[${parentMacro.tag}] Processing structured leadin`));
                parentMacro.leadin = this.parseOptionBody(parentEntity, parentMacro, entityUid); // Does this expect the opening option macro to
                                                                       // be consumed? (YES)
                // Check if the structured macro ended with only a leadin, as can happen with [if] macros
                if (this.cursor.check(TokenType.MACRO_END) && this.isMacroEnd(parentMacro.tag)) {
                    log(this.cursor.linePrefix() + struc(`[${parentMacro.tag}] Structured macro ending with leadin only`));
                    this.cursor.level -= 1;
                    return undefined;
                }
            }
        }

        log(this.cursor.linePrefix() + struc(`[${parentMacro.tag}] Parsing structured option macros`));

        // Otherwise loop through the structured/option macros
        this.skipAllWhitespace();
        // while (this.checkForOptionMacro() && !this.cursor.check(TokenType.MACRO_END)) {
        while (this.assertOptionMacro(parentMacro.tag) && !this.cursor.check(TokenType.MACRO_END)) {
            commandList.push(this.parseOptionMacro(parentEntity,parentMacro, entityUid));
            this.skipAllWhitespace();
        }

        // End the structured macro
        log(this.cursor.linePrefix() + struc(`[${parentMacro.tag}] Structured macro body END (decrementing level)`));

        this.cursor.level -= 1;
        return commandList;
    }

    private parseOptionMacro(parentEntity: CommandData, parentMacro: CommandData, entityUid: string): Command {
        let option: CommandData = {
            type: cmdType.macro,
            uid: generateUniqueId(entityUid),
            line: this.cursor.line(),
            file: this.filename
        };
        log(this.cursor.linePrefix() + chalk.greenBright(`[${this.cursor.lookAhead(1).value}] Option Macro OPEN BRACE`));


        if (this.cursor.match("option open '<'", TokenType.OPTION_OPEN)) {

            option.tag = this.cursor.consume("option tag", TokenType.WORD).value;
            let optionDef = options.getOptionDefinition(parentMacro.tag!, option.tag);
            if (!optionDef) {
                throw parserr(this, `Invalid option tag <${option.tag}> in structured macro [${parentMacro.tag}]. Valid tags: <${options.getValidTags(parentMacro.tag!).join('>, <')}>`);
            }
            if (this.cursor.check(TokenType.PHRASE)) {
                option.id = this.cursor.consume("option id", TokenType.PHRASE).value;
            }

            /* Between here and the Body, we can have an inline body, conditionals, and settings in ANY ORDER */

            while (!this.cursor.match("option close '>'", TokenType.OPTION_CLOSE)) {
                // Inline text pattern
                option.inlineText = this.tryInlineBody(option);
                // Conditional pattern
                option.cond = this.parseMacroConditionals(option);
                // Settings pattern
                option.settings = this.parseMacroSettings(option);
            }

            /* Begin body parsing */

            log(this.cursor.linePrefix() + chalk.greenBright(`[${option.tag}] Option Macro CLOSE BRACE`));
            // TODO:look at the differences between calling parseOptionBody here and...  

            // let optionDef = getOptionDefinition(option);
            if (optionDef && optionDef.body && optionDef.body !== state.absent) {
                option.body = this.parseOptionBody(parentEntity,option, entityUid, parentMacro.tag);
                // The last part of the option body could possibly be a block option, ending with a option end, so 
                // check first to see if the upcoming token is a option end, and verify that it is NOT the end option for 
                // this parent structured option.
                if (this.cursor.check(TokenType.MACRO_END) && !this.isMacroEnd(parentMacro.tag!)) {
                    this.parseEndMacro(option.tag!);
                }
            }
            return Command.construct(option, parentEntity, this, parentMacro);
        }
        throw parserr(this, this.unexpectedTokenMsg(TokenType.MACRO_OPEN));
    }


    private parseOptionBody(parentEntity: CommandData, optionMacro: CommandData, entityUid: string, parentMacroTag?: string): Command[] {
        this.cursor.level += 1;
        const commandList: Command[] = [];
        
        // TODO: This is not the place to verify the option macro can have a body, as this can also be called for `leadin:` 
        // const cmdDef = getOptionDefinition(optionMacro); 
        // if (!cmdDef.body || cmdDef.body === state.absent)
        //  { 
        //      throw parserr(this, `Option macro [${optionMacro.tag}] cannot have a body`); 
        //  }

        log(this.cursor.linePrefix() + chalk.cyan(`[${optionMacro.tag}] Option body START`));

        // While current token is not another option macro or the ending macro of its parent structured macro
        // while (!this.checkForOptionMacro() && !this.isMacroEnd(optionMacro.tag!)) {
        while (!this.assertOptionMacro(parentMacroTag) && !this.isMacroEnd(optionMacro.tag!)) {

            this.cursor.match("option body line comment", TokenType.LINE_COMMENT);

            if (this.cursor.check(TokenType.MACRO_OPEN)) {
                commandList.push(this.parseMacro(parentEntity,entityUid));
            }
            else if (this.cursor.check(TokenType.HOTLINK_OPEN)) {
                commandList.push(this.parseHotlink(parentEntity));
            }
            else if (this.cursor.check(TokenType.ITEM_OPEN)) {
                commandList.push(this.parseItem(parentEntity));
            }
            else if (this.cursor.check(TokenType.SCENERY_DELIMITER)) {
                commandList.push(this.parseScenery(optionMacro));
            }
            else if (this.cursor.check(TokenType.ENTITY_REF_DELIMITER)) {
                commandList.push(this.parseNpcLink(parentEntity));
            }
            else if (this.cursor.check(TokenType.TO_STRING)) {
                commandList.push(this.parseToString());
            }
            else if (this.cursor.check(TokenType.WORD, TokenType.PHRASE, TokenType.PARAGRAPH)) {
                commandList.push(this.parseTextBlock());
            }
            else if (this.cursor.check(TokenType.NEWLINES)) {
                commandList.push(this.parseNewlines());
            }
            else if (this.cursor.match('whitespace', TokenType.WHITESPACE)) {
            }
            else {
                break;
            }
        }
        log(this.cursor.linePrefix() + chalk.cyan(`[${optionMacro.tag}] Option body END (decrementing level)`));
        this.cursor.level -= 1;
        return commandList;
    }

    private parseEndMacro(tag: string) {
        this.skipAllWhitespace()
        log(this.cursor.linePrefix() + amber(`[${tag}] Ending Macro OPEN BRACE`));
        this.cursor.match("macro end open", TokenType.MACRO_END);
        const foundTag = this.cursor.peek();
        if (foundTag.type !== TokenType.WORD || foundTag.value !== tag) {
            throw parserr(this, `Mismatched end macro tag: [/${foundTag.value}] does not match opening tag [${tag}]`);
        }
        this.cursor.match("macro end tag", TokenType.WORD)
        this.cursor.match("macro end close", TokenType.MACRO_CLOSE);
        log(this.cursor.linePrefix() + amber(`[${tag}] Ending Macro CLOSE BRACE`));
    }


    private isMacroEnd(tag: string): boolean {
        if (this.cursor.check(TokenType.MACRO_END)) {
            const foundTag = this.cursor.lookAhead(1);
            if (foundTag.type === TokenType.WORD && foundTag.value === tag) {
                return true;
            }
        }
        return false;
    }

    private parseNewlines(): Command {
        let newlines: CommandData = {
            type: cmdType.text,
            uid: generateUniqueId(),
            tag: 'newline',
            body: "\n",
            line: this.cursor.line(),
            file: this.filename
        };
        newlines.body = this.cursor.consume("newlines", TokenType.NEWLINES).value;
        return Command.construct(newlines, null,this);
    }


    private skipAllWhitespace() {
        while (this.cursor.check(TokenType.WHITESPACE) || this.cursor.check(TokenType.NEWLINES)) {
            this.cursor.advance();
        }
    }

    /**
     * Structural whitespace is whitespace that follows a non-inline macro or a text block, and is directly followed by
     * a newline.
     * @private
     */
    private parseStructuralWhitespace(): Command {
        let whiteSpace: CommandData = {
            type: cmdType.text,
            uid: generateUniqueId(),
            tag: 'text',
            body: "",
            line: this.cursor.line(),
            file: this.filename
        };

        // // Only match  whitespace that follows a non-inline macro or a text block, and is directly followed by a
        // newline // TODO: NOTE: This may need to be handled in Verification where we can get access to the previous
        // command const prevcmd = this.cursor.getLastCommand(this); if (prevToken.flow === flow.inline) { throw
        // parserr(this, `Structural whitespace must follow a non-inline macro or a text block`); }

        this.cursor.match("white space", TokenType.WHITESPACE);
        return Command.construct(whiteSpace, null, this);
    }


    private parseHotlink(parentEntity: CommandData): Command {
        let hotlink: CommandData = {
            type: cmdType.hotlink,
            uid: generateUniqueId(),
            tag: cmdType.hotlink,
            line: this.cursor.line(),
            file: this.filename,
            parentEntity: parentEntity
        };
        this.cursor.match("hotlink open", TokenType.HOTLINK_OPEN);
        hotlink.id = this.cursor.consume("hotlink id", TokenType.KEYWORD).value;
        hotlink.inlineText = this.consumeInline();
        this.cursor.match("hotlink close", TokenType.HOTLINK_CLOSE);
        const result = Command.construct(hotlink, parentEntity, this);
        return result;
    }

    private parseItem(parentEntity: CommandData): Command {
        // Peek ahead to get the entity ID without consuming tokens
        const nextToken = this.cursor.lookAhead(1);

        if (nextToken.type === TokenType.KEYWORD) {
            const referencedEntity = this.entityReferences[nextToken.value];

            // If it's a fixed entity, delegate to parseFixed
            if (referencedEntity?.type === EntityTypes.fixed) {
                return this.parseFixed(parentEntity);
            }
        }

        // Otherwise, continue with normal item parsing
        let item: CommandData = {
            type: cmdType.itemlink,
            uid: generateUniqueId(),
            tag: cmdType.itemlink,
            line: this.cursor.line(),
            file: this.filename,
            parentEntity: parentEntity
        };
        this.cursor.match("item open", TokenType.ITEM_OPEN);
        item.id = this.cursor.consume("item id", TokenType.KEYWORD).value;
        item.inlineText = this.consumeInline();
        this.cursor.match("item close", TokenType.ITEM_CLOSE);
        const result = Command.construct(item, parentEntity, this);
        return result;
    }

    private parseFixed(parentEntity: CommandData): Command {
        let item: CommandData = {
            type: cmdType.fixedlink,
            uid: generateUniqueId(),
            tag: cmdType.fixedlink,
            line: this.cursor.line(),
            file: this.filename,
            parentEntity: parentEntity
        };
        this.cursor.match("fixed open", TokenType.ITEM_OPEN);
        item.id = this.cursor.consume("fixed id", TokenType.KEYWORD).value;
        item.inlineText = this.consumeInline();
        this.cursor.match("fixed close", TokenType.ITEM_CLOSE);
        const result = Command.construct(item, parentEntity,this);
        return result;
    }
    /**
     * Parses NPC references in the form ~NpcName~
     * Similar to itemlink, references standalone NPC entities.
     * @private
     */
    private parseNpcLink(parentEntity: CommandData): Command {
        let npcLink: CommandData = {
            type: cmdType.npclink,
            uid: generateUniqueId(),
            tag: cmdType.npclink,
            line: this.cursor.line(),
            file: this.filename,
            parentEntity: parentEntity
        };
        this.cursor.match("npc link open", TokenType.ENTITY_REF_DELIMITER);
        npcLink.id = this.cursor.consume("npc id", TokenType.KEYWORD).value;
        npcLink.inlineText = this.consumeInline() || undefined;
        this.cursor.match("npc link close", TokenType.ENTITY_REF_DELIMITER);
        const result = Command.construct(npcLink, parentEntity, this);
        return result;
    }

    private consumeInline() {
        let result = '';
        if (this.cursor.match("inline delim", TokenType.INLINE_DELIM)) {
            if (!this.cursor.check(TokenType.PARAGRAPH)) {
                throw parserr(this, `Inline body must not be empty`);
            }
            result = this.cursor.consume("inline text", TokenType.PARAGRAPH).value;
            this.cursor.match("inline delim", TokenType.INLINE_DELIM)
        }
        return result;
    }

    /**
     * Verification rules:  Can only exist in a location, fixeditem, item, or npc entity.
     * @private
     */
    private parseScenery(parentEntity: CommandData): Command {
        let scenery: CommandData = {
            type: cmdType.scenerylink, 
            uid: generateUniqueId(), 
            tag: cmdType.scenerylink, 
            line: this.cursor.line(),
            file: this.filename, 
            parentEntity: this.currentEntityDef
        };
        this.cursor.match("opening scenery delim", TokenType.SCENERY_DELIMITER);
        scenery.id = this.cursor.consume("scenery id", TokenType.KEYWORD).value;
        scenery.inlineText = this.consumeInline() || undefined;
        this.cursor.match("closing scenery delim", TokenType.SCENERY_DELIMITER);
        const sceneryReference = Command.construct(scenery, parentEntity,this, parentEntity);
        // Add the scenery reference to the currentSceneryReferences record, but addError if it already exists
        this.currentSceneryReferences[sceneryReference.id!] = sceneryReference;
        return sceneryReference;
    }


    private parseToString(): Command {
        let toString: CommandData = {
            type: cmdType.tostring,
            uid: generateUniqueId(),
            tag: cmdType.tostring,
            line: this.cursor.line(),
            file: this.filename
        };
        toString.id = this.cursor.consume("tostring token", TokenType.TO_STRING).value;
        return Command.construct(toString, null,this);
    }

    /**
     * Parse the conditional expressions for a macro. If the macro already has a condition, return it. Otherwise, parse
     * the conditionals and return them.
     * @param macro
     * @private
     */
    private parseMacroConditionals(macro: CommandData): LogicalExpression[] {
        log(this.cursor.linePrefix() + chalk.blue(`[${macro.tag}] Starting conditons`));
        if (this.cursor.match("cond open", TokenType.SET_OPEN)) {
            const expressions: LogicalExpression[] = [];
            while (!this.cursor.check(TokenType.SET_CLOSE)) {
                do {
                    const lval = this.cursor.consume("cond lval", TokenType.PHRASE).value.toLowerCase();
                    const op = this.cursor.consume("cond relop", TokenType.RELOP).value as RelationalOperator;
                    const rval = this.cursor.check(TokenType.INLINE_DELIM) ?
                        this.consumeInline() :
                        this.cursor.consume("cond rval", TokenType.PHRASE).value.toLowerCase();
                    let expression: LogicalExpression = {
                        lval: lval,
                        op: op,
                        rval: rval,
                        lop: undefined,
                    }
                    // Verification.verifyConditional(expression, macro);
                    if (this.cursor.check(TokenType.LOGOP)) {
                        expression.lop = this.cursor.consume("cond logop", TokenType.LOGOP).value as LogicalOperator
                    }
                    expressions.push(expression);
                }
                    // Loop until there are no more logical operators (AND/OR) to consume
                while (this.cursor.lookBehind().type === TokenType.LOGOP);
            }
            this.cursor.match("cond close", TokenType.SET_CLOSE);
            log(this.cursor.linePrefix() + chalk.blue(`[${macro.tag}] Done conditions`));
            return expressions;
        }
        return macro.cond as LogicalExpression[];
    }

    /**
     * Parse the settings for a macro. If the macro already has settings, return them. Otherwise, parse the settings and
     * return them.
     * @param macro
     * @private
     */
    /**
     * Convert a setting value to its proper type based on the command definition
     * @param macro The macro command
     * @param settingKey The setting key
     * @param settingValue The raw string value
     * @returns The properly typed value
     */
    private convertSettingValue(macro: CommandData, settingKey: string, settingValue: any): any {
        const def = getCommandDefinition(macro);

        // If the definition has settings with defaults, use those to determine type
        if (def.settings && def.settings.hasOwnProperty(settingKey)) {
            const defaultValue = def.settings[settingKey];
            const defaultType = typeof defaultValue;

            // Convert based on the type of the default value
            switch (defaultType) {
                case 'boolean':
                    if (typeof settingValue === 'boolean') return settingValue;
                    return settingValue === 'true';
                case 'number':
                    if (typeof settingValue === 'number') return settingValue;
                    const num = parseFloat(settingValue);
                    return isNaN(num) ? settingValue : num;
                default:
                    return settingValue;
            }
        }

        // Fallback: try to auto-detect type
        if (settingValue === 'true' || settingValue === 'false') {
            return settingValue === 'true';
        } else if (!isNaN(Number(settingValue))) {
            return Number(settingValue);
        }

        return settingValue;
    }

    private parseMacroSettings(macro: CommandData): Record<string, any> {
        if (this.cursor.match("macro settings open", TokenType.MACRO_SETTING)) {
            let settings: Record<string, any> = {};
            while (!this.cursor.check(TokenType.MACRO_SETTING_END)) {
                const settingKey = this.cursor.consume("setting key", TokenType.PHRASE).value;
                if (this.cursor.check(TokenType.MACRO_SETTING_ASSIGN)) {
                    this.cursor.match("setting assign op '='", TokenType.MACRO_SETTING_ASSIGN);
                    const settingValue = this.cursor.consumeOneOf("setting value of string, number or boolean", TokenType.NUMBER, TokenType.BOOLEAN, TokenType.PHRASE).value;

                    // Convert the setting value to the appropriate type based on the definition
                    settings[settingKey] = this.convertSettingValue(macro, settingKey, settingValue);
                }
                else {
                    // If user specifies a setting that is a boolean, default it to true, as he wouldn't mention it
                    // otherwise.
                    settings[settingKey] = true;
                }
                if (this.cursor.check(TokenType.MACRO_SETTING_DELIM)) {
                    this.cursor.match("setting delim ','", TokenType.MACRO_SETTING_DELIM);
                }
                else {
                    break;
                }
            }
            this.cursor.match("macro setting end", TokenType.MACRO_SETTING_END);
            // Setting key must be validated
            Verification.verifyMacroSettings(macro, settings);
            return settings;
        }
        return macro.settings as Record<string, any>;
    }

    private parseTextBlock(): Command {
        let text: CommandData = {
            type: cmdType.text,
            uid: generateUniqueId(),
            tag: cmdType.text,
            line: this.cursor.line(),
            file: this.filename
        };

        if (this.cursor.check(TokenType.WORD, TokenType.PHRASE, TokenType.PARAGRAPH)) {
            text.body = this.cursor.consume("text block", TokenType.PARAGRAPH).value;
        }
        return Command.construct(text, null,this);
    }

    /**
     * Check the next token in the list. Does not advance the cursor.
     * @param type The type of token to check for.
     * @returns True if the next token is of the given type.
     * @private
     */
    private checkForOptionMacro(): boolean {
        if (this.cursor.check(TokenType.OPTION_OPEN)) {
            const nextToken = this.cursor.lookAhead(1);
            if (nextToken.type === TokenType.WORD) {
                return options.isOptionDefinition(nextToken.value);
            }
        }
        return false;
    }

    /**
     * Performs a check to determine if the next token is an option macro that is valid for the current structured
     * macro. If the next token is an option macro that belongs to the parent structured macro, return true. Otherwise,
     * return false.  If the next token bears the correct structure for an option macro, but is not a valid option for
     * the parent structured macro, throw an error.
     * @param parentTag
     * @private
     * @returns boolean
     * @throws Error
     */
    private assertOptionMacro(parentTag?: string) {
        if (parentTag !== undefined) {
            if (this.cursor.check(TokenType.OPTION_OPEN)) {
                const nextToken = this.cursor.lookAhead(1);
                if (nextToken.type === TokenType.WORD) {
                    if (options.isOptionDefinition(nextToken.value)) {
                        return true;
                    }
                    ;
                    throw parserr(this, `Invalid option macro <${nextToken.value}> in structured macro [${parentTag}]. Valid tags: <${options.getValidTags(parentTag).join('>, <')}>`);
                }
            }
        }
        return false;
    }

    /**
     * Returns an error message for an unexpected token.
     * @param type
     * @private
     */
    private unexpectedTokenMsg(type: TokenType) {
        return `Expecting (${type}), got ${this.cursor.peek().type} '${this.cursor.peek().value}' on line ${this.cursor.peek().line}, level ${this.cursor.level}.`;

    }

    /**
     * Checks if a given tag should have a body by looking it up in the definitions list and checking its type.
     * Must be called from parseMacro() only.
     * @param tag
     * @private
     */
    private macroCanHaveBody(macro: CommandData): boolean {
        const def = getCommandDefinition(macro);

        switch (macro.type) {
            case cmdType.macro:
                if (def.id === state.replacebody) {
                    // Special rules for macros with an id state of replacebody (see definitions.ts)
                    if (macro.id && macro.inlineText) {
                        // throw new Error(`Macro ${macro.tag} cannot have both an id and an inline body.`);
                        throw parserr(this, `Macro ${macro.tag} cannot have both an id and an inline body.`);
                    }
                    if (macro.id || macro.inlineText) {
                        return false;
                    }
                    // fall through to outer return
                }
            case cmdType.entity:
            case cmdType.option:
                log(this.cursor.linePrefix() + chalk.magenta(`[${macro.tag}] can have a body.`));
                return true;
        }
        return false;
    }

    /**
     * This method follows the same pattern as parse(), but instead of parsing the Entities and their .body properties
     * it parses the Entity patten only and saves the entity name to a list of references.  References will be used
     * in the parse() method to confirm that all properties meant to reference other entities are valid.
     * @private
     */
    buildReferences() {
        let entityReferences: Record<string, CommandData> = {};
        const debugDefault = DEBUG_MODE;
        DEBUG_MODE = DEBUG_REFERENCE_BUILD;
        log(`Commencing build of entity references for ${this.filename}  ${DEBUG_REFERENCE_BUILD ? '' : '(set DEBUG_REFERENCE_BUILD to true to see details)'}`);

        while (!this.cursor.isAtEnd()) {
            if (this.cursor.match('newline', TokenType.NEWLINES, TokenType.WHITESPACE, TokenType.LINE_COMMENT)) {
                continue;
            }
            const entity: CommandData = this.parseEntityReference();
            // Verification.createVariableDeclaration(entity);

            entityReferences = combineObjectsUnique(entityReferences, {[entity.id!]: entity});
            // Move through the file until another entity is found
            while (!this.cursor.check(TokenType.ENTITY_START) && !this.cursor.isAtEnd()) {
                this.cursor.consumeAny();
            }
        }
        log(`Completed build of entity references for ${this.filename}`);
        DEBUG_MODE = debugDefault;
        return entityReferences;

    }


    /**
     * This method is used to parse the entity pattern only, and save the entity name to a list of references.  This
     * list of references will be used in the parse() method to confirm that all properties meant to reference other
     * entities are valid.  It performs exactly the same operations as parseEntity(), but does not parse the body of
     * the entity.
     * @private
     */
    private parseEntityReference(): CommandData {
        // Gate
        if (!this.cursor.check(TokenType.ENTITY_START)) {
            throw parserr(this, this.unexpectedTokenMsg(TokenType.ENTITY_START));
        }

        this.cursor.match("entity start", TokenType.ENTITY_START);
        log(this.cursor.linePrefix() + chalk.cyanBright(`Entity START`));

        this.cursor.match("entity line comment", TokenType.LINE_COMMENT);

        const token = this.cursor.consume("entity id", TokenType.PHRASE);
        const displayName = token.unlowered;
        const id = token.value;

        log(this.cursor.linePrefix() + chalk.cyanBright(`Entity ID: ${id}`));

        // Entity type
        this.cursor.match("entity type op '--'", TokenType.ENTITY_TYPE);
        const type = this.cursor.consume("entity type", TokenType.WORD).value as cmdType;

        // Create basic Entity
        let entity: CommandData = {
            id: id,
            type: type,
            uid: generateUniqueId(),
            tag: type,
            displayName: displayName,
            line: this.cursor.line(),
            file: this.filename
        };

        // Ensure that entity.type matches one of the types in the EntityTypes enum
        // if (!Object.values(EntityTypes).includes(entity.type.toLowerCase())) {
        //     throw cmderr(entity, `Invalid entity type '${entity.type}'`);
        // }
        const entityDef = getCommandDefinition(entity);
        if (entityDef.type !== cmdType.entity && entityDef.type !== cmdType.location && entityDef.type !== cmdType.variable) {
            throw parserr(this, `Invalid entity type '${entity.type}'`);
        }

        // Process attributes (this:that, they:them)
        if (this.cursor.match("attrs open", TokenType.SET_OPEN)) {
            if (entityDef.attrs === state.parameter) {
                entity.parameters = this.parseCommaSeparatedValues(entity);
            }
            else {
                let {attrs, flags} = this.parseEntityAttributes(entity);
                // let attrs = this.parseEntityAttributes(entity);
                // Test for special case of a variable entity
                if (entity.type === cmdType.variable) {
                    entity.value = tryStringToPrimitive(attrs.value);
                }
                else {
                    entity.attrs = attrs;
                    entity.flags = flags;
                }
            }
        }

        // // Process any flags (this, that = true)
        // if (this.cursor.match("flags open", TokenType.CURLY_OPEN)) {
        //     entity.flags = this.parseEntityFlags(entity);
        // }

        this.addEntityStatesBasedOnType(entity, entity.type as string);

        // End the entity block.  Entity body to follow until EOF or next entity start.
        this.cursor.match("entity end", TokenType.ENTITY_END);
        log(this.cursor.linePrefix() + chalk.cyanBright(`Entity END`));

        // Validate entity structure based on the type
        // TODO: Reinstate this: this.validateEntityStructure(entity);

        return entity;
    }

    private addEntityStatesBasedOnType(entity: CommandData, type: string) {
        switch (type) {
            case EntityTypes.location:
                entity.states = {visited: false, entries: 0} as EntityStates;
                break;
            case EntityTypes.item:
                entity.states = {handled: false, encountered: false, position: ''} as EntityStates;
                if (entity.attrs && entity.attrs.location) {
                    entity.states.position = entity.attrs.location;
                }
                break;
            case EntityTypes.npc:
                entity.states = {met: false, encountered: false, position: ''} as EntityStates;
                if (entity.attrs && entity.attrs.location) {
                    entity.states.position = entity.attrs.location;
                }
                break;
            case EntityTypes.fixed:
                entity.states = {encountered: false} as EntityStates;
                break;
            default:
                entity.states = undefined;
        }
    }
}

export function log(...args: any[]) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

export function isStringBoolean(value: string): boolean {
    if (typeof value !== 'string') {
        return false;
    }
    switch (value.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "on":
            return true;
        case "false":
        case "no":
        case "off":
            return true;
        default:
            return false;
    }
}

/**
 * Check given value to see if it is a boolean represented as a string, and if so, convert it to a boolean.
 * Otherwise, return the value unchanged.
 * @param value
 * @private
 */
export function tryStringToBoolean(value: string): string | boolean {
    if (typeof value !== 'string') {
        return value;
    }
    switch (value.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "on":
            return true;
        case "false":
        case "no":
        case "off":
            return false;
        default:
            return value;
    }
}

function tryStringToPrimitive(value: string): string | boolean | number {
    // Check if the string represents a boolean
    switch (value.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "on":
            return true;
        case "false":
        case "no":
        case "off":
            return false;
    }

    // Check if the string represents a number
    const numberValue = Number(value);
    if (!isNaN(numberValue)) {
        return numberValue;
    }

    // If the string does not represent a boolean or a number, return the string
    return value;
}

let UNIQUE_ID_COUNTER = 0;

export function generateUniqueId(prefix?: string) {
    if (!prefix) {
        prefix = '';
    }
    else
        prefix = prefix + '.';
    const result = prefix + (UNIQUE_ID_COUNTER++).toString().padStart(5, '0');
    return result;
}

export function restartUniqueIdCounter() {
    UNIQUE_ID_COUNTER = 0;
}


export default Parser;

