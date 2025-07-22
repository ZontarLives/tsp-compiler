export enum TokenType {
    ENTITY_START = "ENTITY_START",
    ENTITY_TYPE = "ENTITY_TYPE",
    ENTITY_SYMBOL = "ENTITY_SYMBOL",
    ENTITY_PARAM_DELIM = "ENTITY_PARAM_DELIM",
    ENTITY_PARAM_ASSIGN = "ENTITY_PARAM_ASSIGN",
    ENTITY_STATE_DELIM = "ENTITY_STATE_DELIM",
    ENTITY_STATE_ASSIGN = "ENTITY_STATE_ASSIGN",
    ENTITY_END = "ENTITY_END",
    SET_OPEN = "SET_OPEN",
    SET_CLOSE = "SET_CLOSE",
    CURLY_OPEN = "CURLY_OPEN",
    CURLY_CLOSE = "CURLY_CLOSE",
    MACRO_OPEN = "MACRO_OPEN",
    MACRO_CLOSE = "MACRO_CLOSE",
    MACRO_SETTING = "MACRO_SETTING",
    MACRO_SETTING_DELIM = "MACRO_SETTING_DELIM",
    MACRO_SETTING_ASSIGN = "MACRO_SETTING_ASSIGN",
    MACRO_SETTING_VALUE = "MACRO_SETTING_VALUE",
    MACRO_SETTING_END = "MACRO_SETTING_END",
    MACRO_END = "MACRO_END",
    OPTION_OPEN = "OPTION_OPEN",
    OPTION_CLOSE = "OPTION_CLOSE",
    LINE_COMMENT = "LINE_COMMENT",
    NEWLINES = "NEWLINES",
    WHITESPACE = "WHITESPACE",
    WORD = "WORD",
    PHRASE = "PHRASE",
    PARAGRAPH = "PARAGRAPH",
    KEYWORD = "KEYWORD",
    TO_STRING = "TO_STRING",
    SYMBOL = "SYMBOL",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
    SCENERY_DELIMITER = "SCENERY_DELIMITER",
    ENTITY_REF_DELIMITER = "ENTITY_REF_DELIMITER",
    HOTLINK_OPEN = "HOTLINK_OPEN",
    HOTLINK_CLOSE = "HOTLINK_CLOSE",
    INLINE_DELIM = "INLINE_DELIM",
    ITEM_OPEN = "ITEM_OPEN",
    ITEM_CLOSE = "ITEM_CLOSE",
    
    LOGOP = "LOGOP",
    RELOP = "RELOP",
    ASSIGNOP = "ASSIGNOP",
    
    EOF = "EOF",
}

export enum LogicalOperator {
    AND = "and",
    OR = "or",
    ANDIF = "andif",
}

export enum RelationalOperator {
    IS_NOT_GREATER_THAN_OR_EQUAL_TO = "is not >=",
    IS_NOT_GREATER_THAN = "is not >",
    IS_NOT_LESS_THAN_OR_EQUAL_TO = "is not <=",
    IS_NOT_LESS_THAN = "is not <",
    IS_GREATER_THAN_OR_EQUAL_TO = "is >=",
    IS_GREATER_THAN = "is >",
    IS_LESS_THAN_OR_EQUAL_TO = "is <=",
    IS_LESS_THAN = "is <",
    IS_NOT_IN = "is not in",
    IS_IN = "is in",
    IS_NOT = "is not",
    IS = "is",
    ARE_NOT_GREATER_THAN_OR_EQUAL_TO = "are not >=",
    ARE_NOT_GREATER_THAN = "are not >",
    ARE_NOT_LESS_THAN_OR_EQUAL_TO = "are not <=",
    ARE_NOT_LESS_THAN = "are not <",
    ARE_GREATER_THAN_OR_EQUAL_TO = "are >=",
    ARE_GREATER_THAN = "are >",
    ARE_LESS_THAN_OR_EQUAL_TO = "are <=",
    ARE_LESS_THAN = "are <",
    ARE_NOT_IN = "are not in",
    ARE_IN = "are in",
    ARE_NOT = "are not",
    ARE = "are",
}

export interface LogicalExpression {
    lval: string;
    op: RelationalOperator;
    rval: string;
    lop: LogicalOperator | undefined;
}


export enum AssignmentOperator {
    IS = "is",
    ARE = "are",
}

// // Todo: ensure these are matched without case sensitivity
// export const EntityEnums = {
//     location: "location",
//     item: "item",
//     npc: "npc",
//     reference: "reference",
//     fixed: "fixed",
//     rule: "rule",
//     function: "function",
//     system: "system",
//     audio: "audio",
// };
//
// export type EntityType = keyof typeof EntityEnums;

export let EntityParameters: Record<string, string[]> = {

    "location": ["audio", "flags"],
    "npc": ["location", "name", "gender", "flags"],
    "item": ["location", "flags", "defaultactions"],
    "fixed": ["location", "flags", "defaultactions"],
    "reference": [],
    "function": [],
    "audio": ["file", "volume", "loop", "fade"],
    "variable": ["value"],
    "system": ["flags"],
}
// EntityParameters[EntityTypes.LOCATION] = ["audio", "flags"];    
    



/**
 * Preserving this for now, as it is a good example of a recursive logical expression.
 export interface LogicalExpression {
 lval: LogicalExpression | any;
 op: string;
 rval: LogicalExpression | any;
 }
 */

