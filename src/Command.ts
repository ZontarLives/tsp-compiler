
import { cmdType } from './Definitions';
import Parser from "./Parser";
import {Verification} from "./Verification";

/**
 * The Command class represents every element and collection of elements that will be
 * evaluated and rendered at runtime.
 */
export type CmdType = Command | string | undefined;
export type BodyType = Command[] | string | undefined;
export type ParamType = any | string | undefined;

/**
 * The result of keyword checks at runtime will be kept in the entity's state property.
 */
export enum globalFuncKeys {
    visited = 'visited',        // determines if the location entity has been visited at least once by the player
    entries = 'entries',        // determines the number of times a location has been 'visited' by the player
    present = 'present',        // determines if the fixture/item/npc entity is in the same location as the player
    encountered = 'encountered',// determines if the fixture/item/npc entity has been 'present' at least once by the player
    carried = 'carried',        // determines if the item entity is in the player's inventory
    handled = 'handled',        // determines if the item entity has been picked up at least once by the player
    met = 'met',                // determines if the npc entity has been interacted with at least once by the player
    position = 'position',      // determines the current location of the item entity in the player's inventory
    here = 'here',              // same as 'present'
    presentitems = 'presentitems',  // determines the number of items in the player's inventory and visible locally
    visibleitems = 'visibleitems',  // determines the number of items in the player's inventory and visible locally
    this = 'this',              // reference to the containing entity
}

export enum builtInEntities {
    player = 'player',
    offstage = 'offstage',
}

// Create a type representing the keys of the stateKeys enum
export type stateKeysType = keyof typeof globalFuncKeys;

export interface EntityStates {
    [key: string]: boolean | number | string | undefined;
    // present?: boolean;      // present can be handled via a function call, it's state is not needed here
    // carried?: boolean;      // carried can be handled via a function call, it's state is not needed here
    handled?: boolean;
    visited?: boolean;
    entries?: number;
    talked?: boolean;
    met?: boolean;
    position?: string;
}

export interface CommandData {
    [key: string]: any;

    type: cmdType;
    uid: string;
    tag?: string;
    id?: string;
    displayName?: string;
    attrs?: Record<string, any>;
    flags?: Record<string, boolean>;
    states?: EntityStates;
    parameters?: string[];
    inlineText?: BodyType;
    op?: string;
    rval?: string;
    value?: string | number | boolean;
    // params?: ParamType;
    settings?: Record<string, any>;
    cmdState?: Record<string, any>;
    leadin?: BodyType;
    flowController?: string;
    cond?: string | any[] | Record<string, string | any> | undefined;
    body?: BodyType;

    line?: number;
    file?: string;
    parentEntity?: CommandData;
}

export class Command implements CommandData{

    [key: string]: any;
    
    constructor(
        public type: cmdType,
        public uid: string,
        public tag?: string,
        public id?:string,
        public displayName?:string,
        public attrs?: Record<string, any>,
        public flags?: Record<string, boolean>,
        public states?: EntityStates,
        public parameters?: string[],
        public inlineText?: BodyType,
        public op?: string,
        public rval?: string,
        public value?: string | number | boolean,
        
        // public params?: ParamType,
        public settings?: Record<string, any>,
        public cmdState?: Record<string, any>,
        public leadin?: BodyType,
        public flowController?: string,
        public cond?: any[] | string | Record<string, string | any>,
        public body?:BodyType,
        public line?:number,
        public file?:string,
        public parentEntity?: CommandData,
    ) {
        this.type = type;
        this.uid = uid;
        this.tag = tag;
        this.id = id;
        this.displayName = displayName;
        this.attrs = attrs;
        this.flags = flags;
        this.states = states;
        this.parameters = parameters;
        this.inlineText = inlineText;
        this.op = op;
        this.rval = rval;
        this.value = value;
        // this.params = params;
        this.settings = settings;
        this.cmdState = cmdState;
        this.leadin = leadin;
        this.flowController = flowController;
        this.cond = cond;
        this.body = body;
        this.line = line;
        this.file = file;
        this.parentEntity = parentEntity;
    }

    static construct(cmdData: CommandData, parentEntity: CommandData | null, parser: Parser, parentCommand?: CommandData) {
        Verification.verifyComposition(cmdData, parser, parentEntity, parentCommand);
        const cmd = new Command(
            cmdData.type,
            cmdData.uid,
            cmdData.tag,
            cmdData.id,
            cmdData.displayName,
            cmdData.attrs,
            cmdData.flags,
            cmdData.states,
            cmdData.parameters,
            cmdData.inlineText,
            cmdData.op,
            cmdData.rval,
            cmdData.value,
            // cmdDef.params,
            cmdData.settings,
            cmdData.cmdState,
            cmdData.leadin,
            cmdData.flowController,
            cmdData.cond,
            cmdData.body,
            cmdData.line,
            cmdData.file,
            cmdData.parentEntity,
        );
        return cmd;
    }

    /**
     * Returns a JSON representation of the Command object.  Does not output .file or .line properties. Converts all
     * keys to lowercase.
     */
    // toJSON() {
    //     const {line, file, ...json} = this;
    //     return json;
    // }

    toJSON() {
        // Destructure the 'line' and 'file' properties from 'this'
        const {line, file, parentEntity} = this;

        // Use the rest operator to gather the remaining properties into a new object 'json'
        const json = {...this};

        // Remove 'line' and 'file' properties from 'json'
        delete json.line;
        delete json.file;
        delete json.parentEntity;

        // Return the 'json' object
        return json;
    }

}
