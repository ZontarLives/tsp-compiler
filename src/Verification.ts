/**
 * @module Verification
 * @description
 * This module contains functions for verifying the validity of parsed input data.
 * Syntax verification is handled by the Parser module.
 *
 * There are two of types of verification handled by this module:
 * 1. Compositional verification - This ensures that all properties of a Command are valid (there are none that don't
 *     belong).
 * 2. Reference verification - This ensures that all references to entities or states are valid.
 */

import {
    CommandDefinition, definitions, OptionDefinition, flatOptionsList, state,
    optionSequence, cmdType, flow, options
} from './Definitions';
import {BodyType, builtInEntities, Command, CommandData, globalFuncKeys} from './Command';
import {advisement, cmderr, cmderrMsg, errmsg, fileline, parserr} from "./Logger";
import {addError, addErrorMessage, addWarning, addWarningMessage, TspError} from "./Errors";
import {EntityParameters, LogicalExpression} from "./TokenTypes";
import Parser, {log} from "./Parser";
import {EntityTypes, EntityType} from "./CommonTypes";

const settingsSingular = [
    'start',
    'ifid',
    'tsp_version',
    'app_version',
    'author',
    'language',
    'title',
    'subtitle',
    'summary',
    'copyright',
];

class InitReference {
    id: string;
    file: string;
    line: number;
    usage: { file: string, line: number }[];
    cmd: CommandData;

    constructor(cmd: CommandData, file: string = "", line: number = 0) {
        this.id = cmd.id!;
        this.file = file;
        this.line = line;
        this.usage = [];
        this.cmd = cmd;
    }
}

export class Verification {
    static entityReferences: Record<string, CommandData> = {};
    static initReferences: Record<string, InitReference> = {
        // Start with predefined global function names
        // "visibleitems_present": new InitReference("visibleitems_present", "globalfuncs"), 
    };
    static gameTitle: string = "Game";

    constructor(message: string) {
    }
    
    /**
     * Verifies that all properties of Command are valid (there are none that don't belong).
     */
    static verifyComposition(cmdData: CommandData, parser: Parser, parentEntity: CommandData | null, parentCommand?: CommandData) {

        const macroOrOptionDef = getCommandOrOptionDef(cmdData, parentCommand);

        // Handle required properties
        if (typeof macroOrOptionDef === 'object') {
            for (const prop in macroOrOptionDef) {
                // TODO: The `presence` property is special case and should not be considered, or be removed
                if (prop === 'presence') {
                    continue;
                }
                // if ((macroOrOptionDef[prop as keyof CommandDefinition] === state.required 
                //     || macroOrOptionDef[prop as keyof CommandDefinition] === state.parameter) 
                //     && !cmdData.hasOwnProperty(prop)) {
                if (macroOrOptionDef[prop as keyof CommandDefinition] === state.required && !cmdData.hasOwnProperty(prop)) {
                    addError(cmdData, `Missing required property: "${prop}" for ${cmdData.tag}`);
                }
            }
        }

        // Then handle properties that are not allowed
        for (const prop in cmdData) {

            // Special cases that should not be considered
            if (prop === 'line' || prop === 'tag' || prop === 'body' || prop === 'leadin'
                || prop === 'shape' || prop === 'file' || prop === 'parentEntity' || prop === 'states'
                || prop === 'attrs' || prop === 'flags' || prop === 'displayName' || prop === 'uid') {
                continue;
            }
            // Extra special cases
            if (prop === 'settings' && macroOrOptionDef.hasOwnProperty('arguments')) {
                // In this case, settings are allowed and are not checked, as they are used for the [call] macro as arguments
                continue;
            }
            if (!macroOrOptionDef.hasOwnProperty(prop) && cmdData[prop] !== undefined) {
                addWarning(cmdData, `Invalid property: '${prop}' for [${cmdData.tag}]` +
                    advisement(`(Auto-removing it - Update your source file)`));
                delete cmdData[prop];
            }
        }

        // Handle missing and unexpected option properties
        if (isStructuredMacro(cmdData)) {
            this.verifyOptionPresence(cmdData, macroOrOptionDef);
        }

        // Handle macros that can only be contained by specific entities
        if (parentCommand !== undefined) {
            this.verifyMacroContainer(cmdData, macroOrOptionDef, parentCommand);
        }

        // Handle alternative verifications first, then allow common ones.
        if (cmdData.type === 'scenerylink' || cmdData.tag === 'prop') {
            this.verifySceneryReferences(cmdData);
            this.verifySceneryOptionIds(cmdData, parser);
        }
        else if (cmdData.type === 'npclink') {
            this.verifyNpcLinks(cmdData, parser);
        }
        else {
            // Handle undefined entity references (must be called after all the conditional verifications above have
            // been executed)
            this.verifyReferences(cmdData, macroOrOptionDef);
        }
    }

    /**
     * Verifies that the macro exists within the specified entity only.  Only NPC, for example, can contain [initial]
     * macros.
     */
    private static verifyMacroContainer(cmdData: CommandData, macroOrOptionDef: CommandDefinition, parentCommand: CommandData) {
        const parentEntityTag = parentCommand.type;
        if (macroOrOptionDef.entityContainer) {
            if (parentEntityTag !== macroOrOptionDef.entityContainer) {
                addError(cmdData, `Invalid macro [${cmdData.tag}] in entity '${parentCommand.id}'`);
                addError(cmdData, `\t[${cmdData.tag}] is only valid in entities of type '${macroOrOptionDef.entityContainer}'`);
            }
        }
    }

    /**
     * Verifies that a scenery reference is only declared on Entity.type `location`, `item`, `fixed`, or `npc`.
     */
    private static verifySceneryReferences(cmdData: CommandData) {

        if (cmdData.type === 'scenerylink') {
            if (!cmdData.parentEntity) {
                throw cmderr(cmdData, `Scenery reference occurs outside of an entity`);
            }
            const entityType = cmdData.parentEntity.type
            if (entityType === EntityTypes.location || entityType === EntityTypes.item
                || entityType === EntityTypes.fixed || entityType === EntityTypes.npc) {
                return;
            }
            else {
                addError(cmdData, `Scenery reference occurs in invalid entity '${cmdData.parentEntity.id}'`);
                addError(cmdData, `\tScenery references are only valid in entities of type 'location', 'item', 'fixed', or 'npc'`);
            }
        }
    }

    private static verifySceneryOptionIds(cmdData: CommandData, parser: Parser) {
        if (cmdData.tag === 'prop') {  // Where is 'prop' properly defined?
            // Step through scenerylinks for the parent entity and verify that cmdData.id is valid
            if (!parser.currentSceneryReferences.hasOwnProperty(cmdData.id!)) {
                addError(cmdData, `Invalid scenery reference ^${cmdData.id}^ in entity '${parser.currentEntityDef.id}' ${advisement('(will be safely ignored)')}`);
            }
        }
    }

    /**
     * Verifies that NPC links reference valid NPC entities.
     * Similar to how itemlinks reference item entities.
     */
    private static verifyNpcLinks(cmdData: CommandData, parser: Parser) {
        if (cmdData.type === 'npclink') {
            // Verify the referenced NPC exists in the entity references
            const npcId = cmdData.id;
            const npcEntity = this.entityReferences[npcId!];
            
            if (!npcEntity || npcEntity.type !== EntityTypes.npc) {
                addError(cmdData, `Invalid NPC reference ~${npcId}~ - no NPC entity with this ID found`);
            }
            
            // Verify context is appropriate for NPC references
            if (!cmdData.parentEntity) {
                throw cmderr(cmdData, `NPC reference occurs outside of an entity`);
            }
            
            const entityType = cmdData.parentEntity.type;
            // NPCs can be referenced in locations, items, fixed items, or other NPCs
            if (entityType !== EntityTypes.location && 
                entityType !== EntityTypes.item &&
                entityType !== EntityTypes.fixed && 
                entityType !== EntityTypes.npc) {
                addError(cmdData, `NPC reference occurs in invalid entity '${cmdData.parentEntity.id}'`);
                addError(cmdData, `\tNPC references are only valid in entities of type 'location', 'item', 'fixed', or 'npc'`);
            }
        }
    }

    /**
     * Verifies that the structured macro options are present if required.
     * @param cmdData
     */
    private static verifyOptionPresence(cmdData: CommandData, macroOrOptionDef: CommandDefinition) {


        // Get the optionDefs definition so we can step through its properties and test for presence === required
        const optionDefs = macroOrOptionDef.shape!.options;

        // Step through optionDefs in the definition and if they are required, verify that they are present
        for (const optionsKey in optionDefs) {
            const option = optionDefs[optionsKey as keyof OptionDefinition];
            if (option.presence === state.required && !bodyContains(cmdData.body, optionsKey)) {
                throw cmderr(cmdData, `Missing required option: ${optionsKey} for [${cmdData.tag}]`);
            }
        }

        // Iterate over all options in the body
        if (Array.isArray(cmdData.body)) {

            // We don't check this for the leadin portion of a structured macro, as that can contain any macro 
            // and it is referenced through `.leadin`.
            cmdData.body.forEach((option, index) => {

                // If the option is not defined in the optionDefs definition, throw an error
                if (!optionDefs.hasOwnProperty(option.tag!)) {
                    addError(cmdData, `Invalid option: ${option.tag} for [${cmdData.tag}]`);
                }

                const optionDef = optionDefs[option.tag as keyof OptionDefinition];

                // If the option's placement property is option.first or option.last, verify that it is the first or
                // last option in the body.
                if (optionDef.placement === optionSequence.first && index !== 0) {
                    addError(cmdData, `Option [${option.tag}] for [${cmdData.tag}] may only be the first option`);
                }
                if (optionDef.placement === optionSequence.last && index !== cmdData.body!.length - 1) {
                    addError(cmdData, `Option [${option.tag}] for [${cmdData.tag}] may only be the last option`);
                }
                // TODO: Test for optionSequence.repeatable?  Or does that take care of itself?

            });
        }

        function bodyContains(body: BodyType, tag: string): boolean {

            let result = false;
            if (Array.isArray(body)) {
                result = body.some((macro) => {
                    if (macro.tag === tag) {
                        return true;
                    }
                });
            }
            return result;
        }
    }

    /**
     * Verifies that all references to other Entities are valid.
     */
    private static verifyReferences(cmdData: CommandData, macroOrOptionDef: CommandDefinition) {

        // If the `ref` requires an ID, check the ID in `cmdData` against the imported list of 
        // entityReferences to ensure it exists.

        if (macroOrOptionDef.id == state.required) {
            if (!cmdData.id) {
                addError(cmdData, `Missing required id in [${cmdData.tag}]`);
            }
            else if (!this.ensureValidLvalReference(cmdData)) {
                addError(cmdData, `Unimplemented reference: "${cmdData.id}" in [${cmdData.tag}]`);
            }

        }
        // if (macroOrOptionDef.id == state.parameter) {
        //     if (!cmdData.id) {
        //         addError(cmdData, `Missing required parameter in [${cmdData.tag}]`);
        //     }
        // }

        // For ALL output macros (macros that result in text written to the output stream).
        // If the type is macro and the id is replacebody and inlineText is optional, then:
        //      1. If there's an ID, it represents a reference
        //      2. If there's no ID, but an inlineText, the body is contained in an `inlineText` property 
        //      3. If there's neither, then it's treated like a block macro.
        //      4. If there's both, then it's a syntax error.
        if (macroOrOptionDef.id === state.replacebody) {
            if (cmdData.id && cmdData.inlineText) {
                addError(cmdData, `Invalid [${cmdData.tag}] macro: output commands cannot have both an id and an inlineText`);
            }
        }
        else if (macroOrOptionDef.id != state.required && macroOrOptionDef.id != state.optional) {
            if (cmdData.id) {
                addError(cmdData, `Forbidden id in [${cmdData.tag}]`);
            }
        }

        if (macroOrOptionDef.rval == state.required) {
            if (!cmdData.rval) {
                addError(cmdData, `Missing required rval in [${cmdData.tag}]`);
            }
                // Ensure the rval is a valid entity reference, or a boolean, or a number, or an `inline` string
            // else if (!entityReferences.hasOwnProperty(cmdData.rval)) {
            else if (!this.checkValidRval(cmdData.rval, cmdData.id)) {
                addError(cmdData, `Invalid rval reference: ${cmdData.rval} in ${cmdData.tag} entity '${cmdData.id}'`);
            }

        }
        if (macroOrOptionDef.rval != state.required && macroOrOptionDef.rval != state.optional) {
            if (cmdData.rval) {
                addError(cmdData, `Forbidden rval in ${cmdData.tag} entity '${cmdData.id}'`);
            }
        }
        return true;
    }

    /**
     * Verifies that the specified rval a valid entity reference, or a boolean, or a number, or an `inline` string
     * @param rval
     */
    private static checkValidRval(rval: string | undefined, lval?: string) {
        if (rval === undefined) {
            return false;
        }
        // Entity reference?
        if (this.entityReferences.hasOwnProperty(rval)) {
            return true;
        }
        // Boolean string?
        if (typeof rval === 'string' && rval === `true` || rval === `false` || rval === `on` || rval === `off` || rval === 'yes' || rval === 'no') {
            return true;
        }
        // Number?
        if (!isNaN(Number(rval))) {
            return true;
        }
        // Flag?
        if (typeof rval === 'string' && lval && this.entityReferences.hasOwnProperty(lval)) {
            // Check for rval existing in the flags Record<string, boolean> of the entity
            const entity = this.entityReferences[lval];
            const flags = entity.flags;
            if (flags && flags.hasOwnProperty(rval)) {
                return true;
            }
        }
        
        // Built-in function?
        if (rval in globalFuncKeys) {
            return true;
        }
        
        // Built-in Entity reference?
        if (rval in builtInEntities) {
            return true;
        }
        
        // // String?
        // if (typeof rval === 'string') {
        //     return true;
        // }

        // We do not accept plain strings as rvals at this time, so we must err.
        
        return false;
    }

    private static checkValidLval(lval: string | undefined) {
        if (lval === undefined) {
            return false;
        }
        // Entity reference?
        if (this.entityReferences.hasOwnProperty(lval)) {
            return true;
        }
        // Built-in Entity reference?
        if (lval in builtInEntities) {
            return true;
        }
        // Created reference?
        if (this.initReferences.hasOwnProperty(lval)) {
            return true;
        }
        // Global Function?
        if (lval in globalFuncKeys) {
            return true;
        }

        return false;
    }

    /**
     * Verifies that all references to entities or global variables are valid.
     */
    private static checkValidLvalToken(lval: string | undefined, cmdData: CommandData) {
        if (lval === undefined) {
            return false;
        }
        // Entity reference?
        if (this.entityReferences.hasOwnProperty(lval)) {
            return true;
        }
        // Built-in Entity reference?
        if (lval in builtInEntities) {
            return true;
        }
        if (this.initReferences.hasOwnProperty(lval)) {
            return true;
        }
        const fakecmdData = {id: lval, file: cmdData.file, line: cmdData.line} as CommandData;
        this.createVariableReference(fakecmdData);
        return true;
    }

    /**
     * Verifies that the specified lval is a valid entity reference, or a global variable.
     * If it is not an entity reference, it is added to the list of global variable references.
     * Later, when the compiler performs verification, if the global variable is not defined, an error will be
     * displayed.
     * @param cmdData
     */
    private static ensureValidLvalReference(cmdData: CommandData | undefined) {
        if (cmdData === undefined || !cmdData.id) {
            return false;
        }
        if (this.entityReferences.hasOwnProperty(cmdData.id)) {
            return true;
        }
        this.createVariableReference(cmdData);
        return true;
    }

    static verifyConditional(expression: LogicalExpression, cmdData: CommandData, parent: Command) {

        if (!this.checkValidLval(expression.lval)) {
            addError(cmdData, `Invalid lval reference '${expression.lval}' in conditional expression for macro [${cmdData.tag}]`);
        }

        // Todo: ensure the rval, which can be more than just an entity reference, is valid for the command.
        // if (!entityReferences.hasOwnProperty(expression.rval) && typeof expression.rval != 'boolean' &&
        // isNaN(Number(expression.rval))) {
        if (!this.checkValidRval(expression.rval, expression.lval)) {
            addError(parent, `Invalid rval reference '${expression.rval}' in conditional expression for macro [${cmdData.tag}]`);
        }
    }
    
    static verifyConditionalsInBody(cmd: Command, commandBody: BodyType) {
        if (commandBody !== undefined && commandBody instanceof Array) {
            commandBody.forEach((element) => {
                if (element instanceof Command) {
                    if (element.cond !== undefined && Array.isArray(element.cond)) {
                        element.cond.forEach((cond) => {
                            this.verifyConditional(cond as LogicalExpression, cmd, element);
                        });
                    }
                    if (element.body || element.leadin) {
                        this.verifyConditionalsRecursive(element);
                    }
                }
            });
        }
    }
    
    static verifyConditionalsRecursive(cmd: Command) {
        this.verifyConditionalsInBody(cmd, cmd.body);
        this.verifyConditionalsInBody(cmd, cmd.leadin);
        
        // if (body !== undefined && body instanceof Array) {
        //     body.forEach((element) => {
        //         if (element instanceof Command) {
        //             if (element.cond !== undefined) {
        //             }
        //             if (element.body) {
        //                 this.verifyConditionalsRecursive(element.body);
        //             }
        //         }
        //     });
        // }
    }

    /**
     * Recursively iterates all Command objects within the `body` or the `leadin` of a Command object and executes
     * `verifyConditional`for each one that contains `cond` property which is of type LogicalExpression.
     * @param entites
     */
    static verifyAllConditionals(cmds:  Record<string, Command>) {
        for (const cmd in cmds) {
            this.verifyConditionalsRecursive(cmds[cmd]);
        }
    }

    static verifyEntityParameters(cmdData: CommandData, propKey: string) {

        if (!EntityParameters.hasOwnProperty(cmdData.type)) {
            addError(cmdData, `Invalid entity type: ${cmdData.type}`);
            return;
        }
        if (!EntityParameters[cmdData.type].includes(propKey)) {
            addError(cmdData, `Entity '${cmdData.id}': Invalid parameter key '${propKey}' for type '${cmdData.type}'\n`)
            addError(cmdData, `\tTypes permitted: ${EntityParameters[cmdData.type].join(', ') || 'none'}`);
        }
    }

    static verifyMacroSettings(cmdData: CommandData, settings: Record<string, any>) {
        const def = getCommandOrOptionDef(cmdData);

        if (def.hasOwnProperty('settings')) {
            for (const prop in settings) {
                if (!def.settings!.hasOwnProperty(prop)) {
                    addError(cmdData, `Invalid settings property: '${prop}' for [${cmdData.tag}]`);
                }
            }
        }
        // If the command accepts parameters, like [call], it's okay to have them and they don't need to be verified
        else if (!def.hasOwnProperty('arguments')) {
            if (Object.keys(settings).length > 0) {
                addError(cmdData, `Invalid settings: [${cmdData.tag}] does not accept settings`);
            }
        }
    }

    /**
     * Some commands, like `actions`, `interact`, `scenery`, etc, should only appear once under a single entity.  If
     * they appear more than once, warn the user, but try to merge the two.  This may require a specialized merge
     * function for each command.
     * @param cmdData
     * @param parser
     */
    static verifyCommandSingularity(entity: Command, parser: Parser) {

        const singularCommands: string[] = [];
        
        if (entity.body) {
            if (Array.isArray(entity.body)) {
                for(let i = entity.body.length - 1; i >= 0; i--) {
                    const cmd = entity.body[i] as Command;
                    const cmdDef = getCommandOrOptionDef(cmd);
                    if (cmd.tag && cmdDef.multiplicity === state.singular) {
                        if (singularCommands.includes(cmd.tag)) {
                            addError(cmd, `Duplicate command: [${cmd.tag}] may only appear once in an entity.  Only the last definition will be used.` +
                                advisement(`(Auto-removing the duplicate - Update your source file to merge the two.)`));
                            entity.body = (entity.body! as Command[]).filter(item => item !== cmd);
                        }
                        else {
                            singularCommands.push(cmd.tag);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Vefifies that the specified collection of entity references are singular
     */
    static verifyEntitySingularity(entityReferences: Record<string, Command>/*, parser: Parser*/) {
        // Step through the list of references and ensure that there is only one entity with the cmdData.type of
        // 'system'
        let systemEntities = 0;
        let settingsFound: Record<string, boolean> = {};
        for (const entity in entityReferences) {
            const cmdData = entityReferences[entity];
            if (cmdData.type === EntityTypes.system) {
                systemEntities++;
            }
            if (systemEntities > 1) {
                throw new TspError(`There may only be one entity of type '${EntityTypes.system}': "${cmdData.id}" is redundant`);
            }

            // Iterate the Command array in cmdData.body and ensure there is a Command of type: "macro" with tag:
            // "settings"
            if (cmdData.body !== undefined) {
                for (const cmd of cmdData.body) {
                    if (cmd instanceof Command) {
                        if (cmd.type === cmdType.macro && cmd.tag === 'settings') {
                            if (cmd.body !== undefined) {
                                // Iterate cmd.body and ensure that all tags of Command objects with the property type:
                                // "macro" are singular
                                for (const setting of cmd.body) {
                                    if (setting instanceof Command) {
                                        // Add the tag of the setting to a list of settings matching one in
                                        // `settingsSingular`. If the list already has a tag of the same name, throw an
                                        // error.
                                        if (settingsSingular.includes(setting.tag!)) {
                                            if (settingsFound.hasOwnProperty(setting.tag!)) {
                                                throw cmderr(setting, `Duplicate setting "${setting.tag}": only one setting of each type permitted`);
                                            }
                                            settingsFound[setting.tag!] = true;
                                        }
                                        if (setting.tag === 'title') {
                                            //this.gameTitle = setting.body!;
                                            if (setting.body && setting.body[0]) {
                                                if (setting.body[0].hasOwnProperty('body')) {
                                                    const cmd = setting.body[0] as Command;
                                                    this.gameTitle = cmd.body as string;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Iterate the this.initReferences object and ensure that each has a declaration. Report on each
     * instance that does not, including the included file name and line number.
     */
    static verifyInitializedGlobalVariables(entityReferences: Record<string, Command>) {
        for (const gvar in this.initReferences) {
            
            // Skip when the reference is 'this'
            if(gvar.toLowerCase() === 'this') {
                continue;
            }
            
            const globalReference = this.initReferences[gvar];
            
            // Skip when the reference is a built-in entity
            if (gvar in builtInEntities) {
                continue;
            }
            
            // Skip when the reference is a number
            if (!isNaN(Number(globalReference.id))) {
                continue;
            }
            // Check if the globalReference is in the entityReferences
            if (!entityReferences.hasOwnProperty(globalReference.id)) {
                // So far, we're not referencing any known global variables.  Now we must check for 
                // local varialbes in a function entity.
                if (this.verifyLocalVariables(globalReference)) {
                    continue;
                }
                // It's not local either, so lets report the error.
                globalReference.usage.forEach((usage) => {
                    addErrorMessage(usage.file, usage.line, `Global Variable "${gvar}" is not declared anywhere`);
                });
            }
        }
    }
    
    static verifyLocalVariables(gvar: InitReference) {
        if (gvar.cmd.parentEntity && gvar.cmd.parentEntity.parameters) {
            if (gvar.id in gvar.cmd.parentEntity.parameters) {
                return true;
            }
        }
        // addError(gvar.cmd, `Local Variable "${gvar.id}" is not declared in the parameters`);
        return false;
    }

    private static trimBodyNewlines(cmd: Command, commandBody: BodyType) {
        if (commandBody instanceof Array) {
            const firstCmd = commandBody[0];
            const lastCmd = commandBody[commandBody.length - 1];
            if (firstCmd instanceof Command && firstCmd.tag === 'newline') {
                const msg = recoverErrMsg(cmd, `Removed newline on: ${cmd.id} in ${cmd.tag}`);
                log(msg);
                commandBody.shift();
            }
            if (lastCmd instanceof Command && lastCmd.tag === 'newline') {
                const msg = recoverErrMsg(cmd, `Removed newline on: ${cmd.id} in ${cmd.tag}`);
                log(msg);
                commandBody.pop();
            }
        }
    }
    private static reduceNewlinesInBody(cmd: Command, commandBody: BodyType, parentCmd: Command) {
        if (commandBody !== undefined && commandBody instanceof Array) {
            const cmdDef = getCommandOrOptionDef(cmd, parentCmd);
            const commandFlowType = cmdDef.flow;

            // This works for Entities and Command macros
            if (!commandFlowType || commandFlowType === flow.none || commandFlowType === flow.block || commandFlowType === flow.location) {
                // Before iterating the body contents, remove any newlines from the beginning and end of the array.
                this.trimBodyNewlines(cmd, commandBody);
            }

            // Set up an array to hold the indexes of the elements to be spliced
            const spliceIndexes: number[] = [];
            // Iterate the elements of the Command or Entity's body
            commandBody.forEach((element: Command, index: number) => {
                // Ensure the element is not a string or undefined
                if (element instanceof Command) {
                    const elementData = getCommandOrOptionDef(element,  cmd);
                    // Ensure the flow is a structured flow, or just no flow at all and that we're not on the first element in the body
                    if ((!elementData.flow || elementData.flow === flow.none || elementData.flow === flow.structured || elementData.flow === flow.block) && index > 0) {
                        const prevCmd = commandBody[index - 1];
                        // When the previous command was a newline, examine it further
                        if (prevCmd instanceof Command && prevCmd.tag === 'newline') {

                            // Only proceed culling the newline if the line BEFORE it is NOT a string.  This allows the user
                            // to add newlines after a description and know they will remain there
                            if (!commandBody[index - 2] || commandBody[index - 2].type !== cmdType.text) {
                                if (prevCmd.body!.length === 1) {
                                    spliceIndexes.push(index - 1);
                                }
                                else if (prevCmd.body!.length > 2) {
                                    prevCmd.body = (prevCmd.body as string).slice(0, -1);
                                }
                            }
                        }
                    }
                    // Recurse into the element's body and leadin properties, if they exist 
                    if (element.body || element.leadin) {
                        // Do body of element
                        this.reduceNewlinesRecursive(element, cmd);
                    }
                }
            });
            // Splice commandBody at the indexes in spliceIndexes.  Must reverse iterate so as not to mess up the
            // indexing.
            for (let i = spliceIndexes.length - 1; i >= 0; i--) {
                const index = spliceIndexes[i];
                commandBody.splice(index, 1);
            }
        }
        return commandBody;
    }

    private static reduceNewlinesRecursive(cmd: Command, parentCmd: Command) {
        this.reduceNewlinesInBody(cmd, cmd.body, parentCmd);
        this.reduceNewlinesInBody(cmd, cmd.leadin, parentCmd);
    }
    
    /**
     * Receives a Record of Command objects and iterates them, calling reduceNewlinesRecursive on each.
     */
    static reduceNewlinesOnAll(cmds: Record<string, Command>) {
        for (const cmd in cmds) {
            this.reduceNewlinesRecursive(cmds[cmd], new Command(cmdType.reference,'root' ));
        }
    }
    
    
    static correctSentenceSpacing(text: string) {
        const result = text.replace(/(?<!Mrs|Mr|Ms|Dr|St)([\.\!\?]"?) +/gm, `$1&ensp;`);
        if (text !== result) {
            log(`Corrected sentence spacing in: ${text}`);
        }
        return result;
    }

    static correctSentenceSpacingInBody(cmd: Command, commandBody: BodyType) {
        if (commandBody !== undefined && commandBody instanceof Array) {
            // Iterate the elements of the Command or Entity's body
            commandBody.forEach((element: Command, index: number) => {
                // Ensure the element is not a string or undefined
                if (element instanceof Command) {
                    // If the `element` is of type text and the previous command does not have a flow of inline, trim the whitespace from the start of `element`
                    if (element.type === cmdType.text) {
                        element.body = this.correctSentenceSpacing(element.body! as string);
                    }
                    // Recurse into the element's body and leadin properties, if they exist 
                    if (element.body || element.leadin) {
                        // Do body of element
                        this.correctSentenceSpacingRecursive(element);
                    }
                }
            });
        }
        return commandBody;
    }
    
    static correctSentenceSpacingRecursive(cmd: Command) {
        this.correctSentenceSpacingInBody(cmd, cmd.body);
        this.correctSentenceSpacingInBody(cmd, cmd.leadin);
    }
    
    static correctSentenceSpacingAll(cmds: Record<string, Command>) {
        for (const cmd in cmds) {
            this.correctSentenceSpacingRecursive(cmds[cmd]);
        }
    }

    private static reduceStructuralWhitespaceInBody(cmd: Command, commandBody: BodyType, parentCmd: Command) {
        if (commandBody !== undefined && commandBody instanceof Array) {
            const cmdDef = getCommandOrOptionDef(cmd, parentCmd);
            const inlineFlow = cmdDef.hasOwnProperty('flow') && (cmdDef.flow === flow.inline || cmdDef.flow === flow.block || cmdDef.flow === flow.location);
            if (inlineFlow) {
                // Don't execute when this command is an inline flow
                return commandBody;
            }

            // // Set up an array to hold the indexes of the elements to be spliced
            // const spliceIndexes: number[] = [];
            
            // Iterate the elements of the Command or Entity's body
            commandBody.forEach((element: Command, index: number) => {
                // Ensure the element is not a string or undefined
                if (element instanceof Command) {
                    
                    // If the `element` is of type text and the previous command does not have a flow of inline, trim the whitespace from the start of `element`
                    if (element.type === cmdType.text && typeof element.body === 'string') {
                        const prevElement = index > 0 ? commandBody[index - 1] : null;
                        const nextElement = index < commandBody.length - 1 ? commandBody[index + 1] : null;
                        
                        // Check if previous element is an inline link type (itemlink, scenerylink, hotlink, etc.)
                        const prevIsInlineLink = prevElement && (
                            prevElement.type === cmdType.itemlink || 
                            prevElement.type === cmdType.npclink ||
                            prevElement.type === cmdType.scenerylink ||
                            prevElement.type === cmdType.hotlink ||
                            prevElement.type === cmdType.entityRef
                        );
                        
                        // Check if next element is an inline link type
                        const nextIsInlineLink = nextElement && (
                            nextElement.type === cmdType.itemlink || 
                            nextElement.type === cmdType.npclink ||
                            nextElement.type === cmdType.scenerylink ||
                            nextElement.type === cmdType.hotlink ||
                            nextElement.type === cmdType.entityRef
                        );
                        
                        // Trim whitespace more carefully
                        let text = element.body as string;
                        
                        // Only trim leading space if previous element is NOT an inline link
                        if (!prevIsInlineLink) {
                            text = text.replace(/^\s+/, '');
                        }
                        
                        // Only trim trailing space if next element is NOT an inline link
                        if (!nextIsInlineLink) {
                            text = text.replace(/\s+$/, '');
                        }
                        
                        element.body = text;
                    }
                    // Recurse into the element's body and leadin properties, if they exist 
                    if (element.body || element.leadin) {
                        // Do body of element
                        this.reduceStructuralWhitespaceRecursive(element, cmd);
                    }
                    
                    // TODO: If the element's body is an empty string, we should remove it from the array
                }
            });
            
            // // Splice commandBody at the indexes in spliceIndexes.  Must reverse iterate so as not to mess up the
            // // indexing.
            // for (let i = spliceIndexes.length - 1; i >= 0; i--) {
            //     const index = spliceIndexes[i];
            //     commandBody.splice(index, 1);
            // }
        }
        return commandBody;   
    }

    private static reduceStructuralWhitespaceRecursive(cmd: Command, parentCmd: Command) {
        this.reduceStructuralWhitespaceInBody(cmd, cmd.body, parentCmd);
        this.reduceStructuralWhitespaceInBody(cmd, cmd.leadin, parentCmd);
    }

    static reduceStructuralWhitespaceAll(cmds: Record<string, Command>) {
        for (const cmd in cmds) {
            this.reduceStructuralWhitespaceRecursive(cmds[cmd], new Command(cmdType.reference,'root' ));
        }
    }

    private static createVariableReference(cmd: CommandData) {
        if (cmd.id) {
            // If we encounter a reference before it's declared, create it with reference data
            if (!this.initReferences.hasOwnProperty(cmd.id)) {
                const globalReference = new InitReference(cmd);
                globalReference.usage.push({file: cmd.file!, line: cmd.line!});
                this.initReferences[cmd.id] = globalReference;
            }
            else {
                // If we encounter a reference after it's declared, add reference data when it exists
                this.initReferences[cmd.id].usage.push({file: cmd.file!, line: cmd.line!});
            }
            return;
        }
        // Throw cmderr stating that the specified Command lacks an id property
        throw cmderr(cmd, `Missing id property in [${cmd.tag}]`);
    }
    


}

export function recoverErrMsg(cmdData: CommandData | OptionDefinition | CommandDefinition, msg: string) {
    const fileline = `${cmdData.file!}:${cmdData.line!}`;
    const throwmsg = `${fileline} ${msg}`;
    return throwmsg;
}


/**
 * Check if the current token is a structured macro. Does not advance the cursor.
 * @param tag The tag of the current token.
 * @returns True if the current token is a structured macro.
 * @private
 */
export function isStructuredMacro(def: CommandData): boolean {
    if (isCommandDefinition(def)) {
        const cmdData = getCommandDefinition(def);
        if (cmdData.shape && cmdData.shape.options) {
            return true;
        }
    }
    return false;
}

export function isCommandDefinition(cmdData: CommandData): boolean {
    return definitions.hasOwnProperty(cmdData.tag!);
}

export function getCommandDefinition(cmdData: CommandData): CommandDefinition {
    if (isCommandDefinition(cmdData)) {
        return definitions[cmdData.tag!];
    }
    throw cmderr(cmdData, `Undefined command definition: [${cmdData.tag!}]`);
}

/**
 * Check if the specified token tag represents is an option macro. Does not advance the cursor.
 * @param tag The tag of the current token.
 * @returns True if the current token is an option macro.
 * @private
 */
function getCommandOrOptionDef(cmdData: CommandData, parentCommand?: CommandData): OptionDefinition | CommandDefinition {
    if (parentCommand && parentCommand.tag) {
        const cmdOption = options.getOptionDefinition(parentCommand.tag, cmdData.tag!)
        if (cmdOption) {
            return cmdOption;
        }
    }
    const cmdDef: CommandDefinition = definitions[cmdData.tag!];
    if (cmdDef) {
        return cmdDef;
    }
    throw cmderr(cmdData, `Undefined command: [${cmdData.tag!}]`);
}

