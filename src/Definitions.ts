// Definitions.ts

import {TspError} from "./Errors";
import {Options} from "./Options";

/**
 * The three elements of the `command` enum represent three basic types declared in `definitions` below.
 * 
 * `definition`: A `definition` cannot be nested within other `definition` types defined in `definitions`.  A
 * `definition` can only be declared at the root level of the source document.
 * 
 * `macro`: A `macro` is structured similar to a `definition` and can be defined within any `definition` and can
 * also be nested within any other `macro`, including itself.  A `macro` cannot exist at root level, like `definitions`.
 * 
 * `statement`: Unlike `definitions` and `macros`, a `statement` contains no body and no closing tag.  It exists
 * entirely within a single set of brackets '[]'.  A statement can exist within a `definition` and a `macro`.  It
 * cannot exist at root level, like `definitions`.
 */

export enum cmdType {
    assignment  = 'assignment',  // An lval id, followed by an operator, followed by an rval id
    entity      = 'entity',      // Like definition, but executes built-in constructors at runtime
    entityRef   = 'entityRef',   // A reference to an entity in body text. Selecting brings up info about the entity
    hotlink     = 'hotlink',     // Selecting executes related code
    itemlink    = 'itemlink',    // Selecting executes related code
    fixedlink   = 'fixedlink',   // Selecting executes related code
    npclink     = 'npclink',     // Selecting executes NPC interaction code
    location    = 'location',    // Like definition, but can only exist at the root of the data tree
    macro       = 'macro',       // Execution of handler, no preserved state
    option      = 'option',      // Like macro, but exists only in the body with contentType: structure
    reference   = 'reference',   // And id referring to a `reference` entity or a `string in backticks`
    scenerylink = 'scenerylink', // Selecting executes scenery option code
    statement   = 'statement',   // An entity of shape: [tag id keywords (conditional statements))]
    tostring    = 'tostring',    // $id or $(an id) that is replaced with a string at runtime. Outputs a variable of name of entity
    system      = 'system',      // A special entity that is always present and contains system-wide settings and is singular
    text        = 'text',        // Simple string, no macros in it
    variable    = 'variable',    // A variable that can be assigned a value and referenced in the game
}

export enum optionSequence {
    repeatable = 'repeatable',
    first      = 'first',
    last       = 'last',
}

export enum state {
    absent   = 'absent',
    required = 'required',
    optional = 'optional',
    replacebody = 'replacebody',     // Used with ID.  If ID is present, it replaces the body: no endtag for macro needed
    idorchild = 'idorchild',         // Associated with ID if present, if not present its associated with parent entity
    singular = 'singular',           // When present, warns user that only one command of that type may exist under the parent entity
    parameter = 'parameter',        // A required field that is not an id, but a parameter to a command
}

export enum flow {
    inline = 'inline',              // Includes surrounding newlines.  Behaves like a regular string of text.
    structured = 'structured',      // Removes surrounding newlines one deep, output is not sent to the main stream.
                                    //  Also removes surrounding newlines from child option body contents.
    block = 'block',                // Removes bookended newlines like structured, but permits newlines within the body.
    none = 'none',                  // Removes surrouning newlines one deep, does not produce output. This allows a
                                    //   command like [set this to that] to be set apart from the main text stream.
    location = 'location',          // Is not structural, but must allow for recursive checking of possible structured body commands 
}

export enum liststyle {
    syndectic = 'syndectic',        // Default: no 'and' before last item name for [visibleitems], [visibleitems], etc.
    asyndectic = 'asyndectic',      // Insert an 'and' before the last item name for [visibleitems], [visibleitems], etc.
}

export type StateType = keyof typeof state;

export enum assignmentOperator {
    to = 'to',
    are = 'as',
}

export type AssignmentType = keyof typeof assignmentOperator;

export interface CommandShape {
    leadin?: boolean;
    options: Record<string, OptionDefinition>;
}

export interface CommandDefinition {
    [key: string]: any;
    type: cmdType;                  // Used to construct the runtime object
    tag?: StateType;                   // The name of the command
    id?: StateType;                    // The id dereferences like types, and is used as a JSON key for output. Can be rendered.
    attrs?: StateType;
    flags?: StateType;
    inlineText?: StateType;          // See detailed explanation below
    cond?: StateType;               // The args are a string of JavaScript-like code and other runtime evaluators
    op?: AssignmentType,                // The assignment operator when present
    rval?: StateType,                  // The rval, required when the `op` property is present
    value?: string | number | boolean;
    // params?: StateType,             // Used to further define entities (different than macro cond statements)
    settings?: Record<string, any>; // If present, the macro conforms its behavior based on this list of settings.
    body?: StateType;                // The text/code between a starting and ending macro pattern [macro] body [/macro]
    shape?: CommandShape;           // Presence of this indicates a structured macro with options
    entityContainer?: string;
    cmdState?: Record<string, any>; // Designer-defined state properties with defaults. Designer should know what they are and how to use them.
    flow?: flow;                    // If true, the command is a flow control command and newlines will be processed.
    flowController?: string;       // If true, the command is an operations flow control command.
    multiplicity?: StateType;
    parameters?: StateType;         // If true, the Entity is a parameterized command
    arguments?: boolean;            // If true, the command interprets settings as arguments

    line?: number;                  // For error output
    file?: string;                  // For error output
}

export interface OptionDefinition extends CommandDefinition {
    placement?: optionSequence;
    presence?: state;
    parent?: string;
}

/**
 * Example of a `definition` without an `id`:
 *  [room]
 *      Body text.
 *  [/room]
 *
 * Example of a `definition` with an `id`:
 *  [dialog one]
 *      Body text.
 *  [/dialog]
 *
 *  Example of a `macro` with an `id` and `conditional expression`:
 *  [gate Sacks Road (condition text)]
 *      Body text.
 *  [/gate]
 *
 *  Example of a `statement` with `conditional expression` only:
 *  [set (condition text)]
 *  
 *  `definitions` notes:
 *  This structure defines the SHAPE of various commands to be found in TSP source docs.
 *  The Parser utilizes this structure to assert the correct shape of the Command references in the source docs.
 *  The Parser produces a JSON file that will be used at runtime to create active instances of the Command objects.
 *  This system ends it there.  It does not attempt to interpret the code.  That is the job of the Interpreter
 *  class, which will also make use of the `definitions` structure to access the `handler` property for execution at
 *  runtime.
 */
export const definitions: Record<string, CommandDefinition> = {
    
    /*** ENTITIES ***/
    audio: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.optional,
        flags: state.optional,
    },
    function: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.parameter,
        flags: state.absent,
        parameters: state.optional,
        body: state.required,
    },
    item: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.optional,
        flags: state.optional,
        body: state.required,
    },
    fixed: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.optional,
        flags: state.optional,
        body: state.required,
    },
    itemdefaults: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.parameter,
        flags: state.absent,
        parameters: state.required,
        body: state.required,
    },
    location: {
        type: cmdType.location,
        id: state.required,
        attrs: state.optional,
        body: state.required,
        flow: flow.location,
        //flow: flow.inline,
    },
    npc: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.optional,
        flags: state.optional,
        body: state.required,
    },
    system: {
        type: cmdType.entity,
        id: state.required,
        attrs: state.optional,
        flags: state.optional,
        body: state.required,
    },
    variable: {
        type: cmdType.variable,
        id: state.required,
        value: state.required,
        // props: state.required,
    },

    /*** TEXT ***/
    newline: {
        type: cmdType.text,
    },
    text: {
        type: cmdType.text,
        flow: flow.inline,
    },
    tostring: {
        type: cmdType.tostring,
        id: state.required,
        flow: flow.inline,
    },

    /*** INLINE LINKS ***/
    hotlink: {
        type: cmdType.hotlink,
        id: state.required,
        inlineText: state.optional,
        flow: flow.inline,
    },
    // hotprop: {
    //     type: cmdType.hotlink,
    //     id: state.required,
    //     flow: flow.inline,
    // },
    itemlink: {
        type: cmdType.itemlink,
        id: state.required,
        inlineText: state.optional,
        flow: flow.inline,
    },
    fixedlink: {
        type: cmdType.fixedlink,
        id: state.required,
        inlineText: state.optional,
        flow: flow.inline,
    },
    npclink: {
        type: cmdType.npclink,
        id: state.required,
        inlineText: state.optional,
        flow: flow.inline,
    },
    link: {
        type: cmdType.macro,
        inlineText: state.required,
        cond: state.optional,
        flow: flow.structured,
    },
    scenerylink: {
        type: cmdType.scenerylink,
        id: state.required,
        inlineText: state.optional,
        flow: flow.inline,
    },

    /*** REFERENCES ***/
    entityRef: {
        type: cmdType.entityRef,
        id: state.required,
        flow: flow.inline,
    },

    /*** STATEMENTS ***/
    visibleitems: {
        type: cmdType.statement,
        cond: state.optional,
        inlineText: state.optional,
        settings: {
            "liststyle": liststyle.syndectic,
        },
        flow: flow.inline,
    },
    call: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
        arguments: true,
    },
    clearEvent: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
    },
    // createMoment: {
    //     type: cmdType.statement,
    // },
    break: {
        type: cmdType.statement,
        cond: state.optional,  
    },
    // dismissmodal: {
    //     type: cmdType.statement,
    // },
    // dismissmodalstack: {
    //     type: cmdType.statement,
    // },
    // dismissunderlyingmodals: {
    //     type: cmdType.statement,
    // },
    // presentinventory: {
    //     type: cmdType.statement,
    //     inlineText: state.required,
    //     cond: state.optional,
    // },
    inventory: {
        type: cmdType.statement,
        inlineText: state.optional,
        settings: {
            "liststyle": liststyle.syndectic,
        },
        cond: state.optional,
    },
    // showinventory: {
    //     type: cmdType.statement,
    //     cond: state.optional,
    // },
    dismiss: {
        id: state.required,
        type: cmdType.statement,
        cond: state.optional,
    },
    dropitem: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
    },
    goto: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
    },
    hide: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
    },
    look: {
        type: cmdType.statement,
    },
    play: {
        type: cmdType.statement,  // .params is an implied optional, so it need not declare `state.optional`
        id: state.required,
        cond: state.optional,
        // Initialize settings with default values.  They are ALL optional in the command line, so this is what 
        // will be used if no params are provided.
        settings: {
            "loop": false,
            "fade": 0,
            "volume": 1,
        },
    },
    resume: {
        type: cmdType.statement,  // .params is an implied optional, so it need not declare `state.optional`
        id: state.required,
        cond: state.optional,
        // Initialize settings with default values.  They are ALL optional in the command line, so this is what 
        // will be used if no params are provided.
        settings: {
            "fade": 500,    // Microseconds to fade in or out
        },
    },
    stop: {
        type: cmdType.statement,  // .params is an implied optional, so it need not declare `state.optional`
        id: state.required,
        cond: state.optional,
        // Initialize settings with default values.  They are ALL optional in the command line, so this is what 
        // will be used if no params are provided.
        settings: {
            "fade": 500,    // Microseconds to fade in or out
        },
    },
    takeitem: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
    },
    talk: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
        inlineText: state.required,
    },
    topics: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
        flow: flow.inline,
    },
    triggerEvent: {
        type: cmdType.statement,
        id: state.required,
        cond: state.optional,
    },

    /*** ASSIGNMENTS ***/
    move: {
        type: cmdType.assignment,
        id: state.required,
        op: 'to',
        rval: state.required,
    },
    set: {
        type: cmdType.assignment,
        id: state.required,
        op: 'to',
        rval: state.required,
    },

    /*** MACROS ***/
    // In cases where 'body' is required and 'inlineText' is optional, the 'inlineText', when present, is treated 
    // as the body.  Both cannot exist at the same time (error condition)
    // addtext: {
    //     type: cmdType.macro,
    //     id: state.replacebody,
    //     body: state.required,
    //     inlineText: state.optional,
    //     cond: state.optional,
    //     flow: flow.inline,
    // },
    description: {
        type: cmdType.macro,
        cond: state.optional,
        flow: flow.block,
    },
    gate: {
        type: cmdType.macro,
        id: state.required,
        body: state.required,
        cond: state.required,
        flow: flow.inline,
    },
    i: {
        type: cmdType.macro,
        body: state.required,
        cond: state.optional,
        flow: flow.inline,
    },
    initial: {
        type: cmdType.macro,
        cond: state.optional,
        body: state.required,
        // entityContainer: 'npc',
    },
    once: {
        type: cmdType.macro,
        body: state.required,
        cond: state.optional,
        cmdState: {
            "count": 0,
        },
        inlineText: state.optional,
        flow: flow.inline,
    },
    exiting: {
        type: cmdType.macro,
        body: state.required,
        cond: state.optional,
    },
    // present: {
    //     // For ALL output macros (macros that result in text written to the output stream).
    //     // If the type is macro and the id is replacebody and inlineText is optional, then:
    //     //      1. If there's an ID, it represents a reference
    //     //      2. If there's no ID, but an inlineText, the body is contained in an `inlineText` property 
    //     //      3. If there's neither, then it's treated like a block macro.
    //     //      4. If there's both, then it's a syntax error.
    //     // TODO: Consider removing the control from id:replacebody to a new `body` state: `body: 'replaceable'`
    //     type: cmdType.macro,
    //     id: state.replacebody,
    //     body: state.required,
    //     inlineText: state.optional,
    //     cond: state.optional,
    //     settings: {
    //         "modeless": false,
    //     }
    // },
    
    // Present body contents in a Modal dialog
    present: {
        type: cmdType.macro,
        body: state.required,
        cond: state.optional,
        flow: flow.block,
    },
    
    
    /*** STRUCTURED MACROS ***/
    
    actions: {
        type: cmdType.macro,
        body: state.required,
        flow: flow.structured,
        // multiplicity: state.singular,
        settings: {
            "exclude defaults": false,
        },
        shape: {
            options: {
                action: {
                    type: cmdType.option,
                    inlineText: state.required,
                    body: state.required,
                    cond: state.optional,
                    placement: optionSequence.repeatable,
                    presence: state.required,
                    flow: flow.block,
                },
            },
        }
    },
    
    chain: {
        type: cmdType.macro,
        body: state.required,
        cond: state.optional,
        inlineText: state.optional,
        flow: flow.block,  // TODO: Should be .structured
        settings: {
            "hidelinks": false,
        },
        cmdState: {     // Presence of a state magically includes an internal 'id' for the command.
            "count": 0,
        },
        shape: {
            options: {
                intro: {
                    type: cmdType.option,
                    cond: state.optional,
                    body: state.required,
                    placement: optionSequence.first,
                    presence: state.optional,
                    flow: flow.block,
                },
                clink: {
                    type: cmdType.option,
                    cond: state.optional,
                    inlineText: state.optional,
                    body: state.required,
                    placement: optionSequence.repeatable,
                    presence: state.required,
                    flow: flow.block,
                },
            }
        }
    },
    // defaultitemactions: {
    //     type: cmdType.macro,
    //     // id: state.parameter,
    //     multiplicity: state.singular,
    //     entityContainer: 'system',
    //     flow: flow.structured,
    //     settings: {
    //         "exclude defaults": false,
    //     },
    //     shape: {
    //         options: {
    //             action: {
    //                 type: cmdType.option,
    //                 inlineText: state.required,
    //                 body: state.required,
    //                 cond: state.optional,
    //                 placement: optionSequence.repeatable,
    //                 presence: state.required,
    //                 flow: flow.block,
    //             },
    //         },
    //     },
    // },
    each: {
        type: cmdType.macro,
        body: state.required,
        cond: state.optional,
        cmdState: {
            "count": 0,
        },
        flow: flow.structured,
        shape: {
            options: {
                step: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.repeatable,
                    presence: state.optional,
                    flow: flow.inline,
                },
                loop: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.last,
                    presence: state.optional,
                    flow: flow.inline,
                },
                hold: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.last,
                    presence: state.optional,
                    flow: flow.inline,
                }
            },
        },
    },
    // TODO: Examine where flow:inline needs to go for leading and elseif/else.
    if: {
        type: cmdType.macro,
        cond: state.required,
        body: state.required,
        flow: flow.structured,  // TODO: Might need to be inline
        flowController: "true",
        shape: {
            leadin: true,   // leadin overrides `contentType` by allowing text
            options: {
                elseif: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.repeatable,
                    cond: state.required,
                    presence: state.optional,
                    // TODO: flow: flow.inline
                },
                else: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.last,
                    presence: state.optional,
                    // TODO: flow: flow.inline
                }
            },
        },
    },
    interface: {
        type: cmdType.macro,
        cond: state.optional,
        body: state.required,
        flow: flow.structured,
        multiplicity: state.singular,
        shape: {
            options: {
                option: {
                    type: cmdType.option,
                    inlineText: state.required,
                    cond: state.optional,
                    presence: state.required,
                    flow: flow.inline,
                },
            },
        },

    },
    interact: {
        type: cmdType.macro,
        id: state.required,
        body: state.required,
        flow: flow.structured,
        entityContainer: 'npc',
        multiplicity: state.singular,
        shape: {
            options: {
                greeting: {
                    type: cmdType.option,
                    cond: state.optional,
                    body: state.required,
                    placement: optionSequence.first,
                    presence: state.optional,
                    flow: flow.inline,
                },
                topic: {
                    type: cmdType.option,
                    cond: state.optional,
                    inlineText: state.required,
                    body: state.required,
                    placement: optionSequence.repeatable,
                    presence: state.required,
                    flow: flow.inline,
                },
            },
        },
    },
    itemui: {
        type: cmdType.macro,
        id: state.idorchild,
        body: state.required,
        flow: flow.structured,
        entityContainer: 'item',
        multiplicity: state.singular,
        shape: {
            leadin: true,
            options: {
            },
        },
    },
    // TODO: This may evolve into a [reference] command with the itemselect inside it.
    itemselect: {
        type: cmdType.macro,
        id: state.required,
        inlineText: state.required,
        cond: state.optional,
        body: state.required,
        flow: flow.structured,
        entityContainer: 'item',        // TODO: Ensure the entityContainer's ID is the same as this command's `id` property?
        multiplicity: state.singular,
        shape: {
            options: {
                intro: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.first,
                    presence: state.required,
                    flow: flow.block,  
                },
                choice: {
                    type: cmdType.option,
                    id: state.required,
                    body: state.required,
                    placement: optionSequence.repeatable,
                    presence: state.required,
                    flow: flow.block,
                },
                default: {
                    type: cmdType.option,
                    body: state.required,
                    placement: optionSequence.last,     // Doesn't REALLY have to be last
                    presence: state.optional,
                    flow: flow.block,
                },
            },
        },
    },
    presentitemselect: {
        type: cmdType.statement,
        inlineText: state.required,
    },
    scenery: {
        type: cmdType.macro,
        body: state.required,
        flow: flow.structured,
        multiplicity: state.singular,
        shape: {
            options: {
                prop: {
                    type: cmdType.option,
                    id: state.required,
                    body: state.required,
                    cond: state.optional,
                    placement: optionSequence.repeatable,
                    presence: state.required,
                    flow: flow.block,
                },
            },
        },
    },
    settings: {
        type: cmdType.macro,
        body: state.required,
        multiplicity: state.singular,
        shape: {
            options: {
                start: {
                    type: cmdType.option,
                    id: state.required,
                    body: state.absent,
                    presence: state.optional,
                },
                ifid: {
                    type: cmdType.option,
                    body: state.absent,
                    inlineText: state.required,
                    presence: state.optional,
                },
                tsp_version: {
                    type: cmdType.option,
                    body: state.absent,
                    inlineText: state.required,
                    presence: state.optional,
                },
                app_version: {
                    type: cmdType.option,
                    body: state.absent,
                    inlineText: state.required,
                    presence: state.optional,
                },
                author: {
                    type: cmdType.option,
                    body: state.absent,
                    inlineText: state.required,
                    presence: state.optional,
                },
                title: {
                    type: cmdType.option,
                    body: state.required,
                    presence: state.optional,
                },
                subtitle: {
                    type: cmdType.option,
                    body: state.required,
                    presence: state.optional,
                },
                summary: {
                    type: cmdType.option,
                    body: state.required,
                    presence: state.optional,
                },
                copyright: {
                    type: cmdType.option,
                    body: state.required,
                    presence: state.optional,
                },
            },
        },
    },
};

export const flatOptionsList: Record<string, OptionDefinition> = {}

/**
 * Build the options object from the definitions object
 * */
export function buildDefinitionOptions(): void {
    // Iterate over all command definitions
    for (const defKey in definitions) {
        const def = definitions[defKey];

        // Check if the command definition has a shape and options
        if (def.shape && def.shape.options) {
            for (const optionKey in def.shape.options) {

                // If the optionsKey exists in the definitions object, throw an error
                if (definitions.hasOwnProperty(optionKey)) {
                    throw new TspError(`Duplicate key found: ${optionKey}`);
                }

                flatOptionsList[optionKey] = def.shape.options[optionKey];
                flatOptionsList[optionKey].parent = defKey;
            }
        }
    }
}

export const options = new Options(); 
