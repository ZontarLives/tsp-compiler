/**
 * @module WhitespaceManagement
 * @description
 * This module contains the new flow-property-based whitespace management system
 * to replace the brittle reduceStructuralWhitespaceAll() function.
 *
 * The system respects each command's flow property for whitespace management,
 * handles nested contexts recursively, and provides clear rules for flow type boundaries.
 */

import { Command, CommandData, BodyType } from './Command';
import { cmdType, flow, CommandDefinition, definitions } from './Definitions';
import { generateUniqueId } from './Parser';

/**
 * Context tracking interface for whitespace processing
 */
interface WhitespaceContext {
    depth: number;
    parentFlow?: flow;
    isFirstChild: boolean;
    isLastChild: boolean;
    previousSiblingType?: cmdType;
    nextSiblingType?: cmdType;
}

/**
 * WhitespaceManagement class providing flow-property-based whitespace management
 */
export class WhitespaceManagement {

    /**
     * Creates a new context for processing child commands
     * @param parentContext The parent's whitespace context
     * @param childIndex The index of the child in the parent's body array
     * @param parentBody The parent's body array
     * @returns A new WhitespaceContext for the child
     */
    private static createChildContext(
        parentContext: WhitespaceContext,
        childIndex: number,
        parentBody: Command[]
    ): WhitespaceContext {
        const isFirst = childIndex === 0;
        const isLast = childIndex === parentBody.length - 1;

        return {
            depth: parentContext.depth + 1,
            parentFlow: parentContext.parentFlow,
            isFirstChild: isFirst,
            isLastChild: isLast,
            previousSiblingType: childIndex > 0 ? parentBody[childIndex - 1].type : undefined,
            nextSiblingType: childIndex < parentBody.length - 1 ? parentBody[childIndex + 1].type : undefined
        };
    }

    /**
     * Creates a new text node Command containing the specified text
     * @param text The text content for the node
     * @returns A new Command of type text
     */
    private static createTextNode(text: string): Command {
        return new Command(
            cmdType.text,
            generateUniqueId(),
            'text',           // tag
            undefined,        // id
            undefined,        // displayName
            undefined,        // attrs
            undefined,        // flags
            undefined,        // states
            undefined,        // parameters
            undefined,        // inlineText
            undefined,        // op
            undefined,        // rval
            undefined,        // value
            undefined,        // settings
            undefined,        // cmdState
            undefined,        // leadin
            undefined,        // flowController
            undefined,        // cond
            text             // body (the actual text content)
        );
    }

    /**
     * Safely gets the command definition, accounting for options that may not have all properties
     * @param cmd The command to get the definition for
     * @param parentCmd Optional parent command for option context
     * @returns The command or option definition
     */
    private static getCommandDefinitionSafe(
        cmd: Command,
        parentCmd?: Command | null
    ): CommandDefinition {
        // Direct lookup for regular commands
        if (cmd.tag && definitions[cmd.tag]) {
            return definitions[cmd.tag];
        }

        // Default fallback - treat as inline text
        return { type: cmdType.text, flow: flow.inline } as CommandDefinition;
    }

    /**
     * Main entry point for whitespace management
     * Processes all commands in the provided collection
     * @param cmds Record of all parsed commands to process
     */
    static manageWhitespace(cmds: Record<string, Command>): void {
        for (const cmdKey in cmds) {
            const cmd = cmds[cmdKey];
            if (cmd.body) {
                const initialContext: WhitespaceContext = {
                    depth: 0,
                    parentFlow: undefined,
                    isFirstChild: true,
                    isLastChild: true,
                    previousSiblingType: undefined,
                    nextSiblingType: undefined
                };
                cmd.body = this.processWhitespace(cmd, null, initialContext);
            }
        }
    }

    /**
     * Core recursive processor that routes commands to appropriate flow handlers
     * @param cmd The command to process
     * @param parent The parent command (null for top-level entities)
     * @param context The whitespace context for this command
     * @returns Processed body content
     */
    private static processWhitespace(
        cmd: Command,
        parent: Command | null,
        context: WhitespaceContext
    ): BodyType {
        const cmdDef = this.getCommandDefinitionSafe(cmd, parent);
        const flowType = cmdDef.flow || flow.inline; // Default to inline

        // Route to appropriate handler
        switch (flowType) {
            case flow.inline:
                return this.processInlineFlow(cmd, context);
            case flow.block:
                return this.processBlockFlow(cmd, context);
            case flow.structured:
                return this.processStructuredFlow(cmd, context);
            case flow.location:
                return this.processLocationFlow(cmd, context);
            case flow.none:
                return this.processNoneFlow(cmd, context);
            default:
                return this.processInlineFlow(cmd, context); // Fallback
        }
    }

    /**
     * Processes commands with inline flow - preserves all whitespace
     * @param cmd The command to process
     * @param context The whitespace context
     * @returns Processed body content with preserved whitespace
     */
    private static processInlineFlow(cmd: Command, context: WhitespaceContext): BodyType {
        if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

        // Process children recursively, preserving all whitespace
        return cmd.body.map((child, index) => {
            if (child instanceof Command) {
                const childContext = this.createChildContext(context, index, cmd.body as Command[]);
                child.body = this.processWhitespace(child, cmd, childContext);
            }
            return child;
        });
    }

    /**
     * Processes commands with block flow - adds block spacing and trims content
     * @param cmd The command to process
     * @param context The whitespace context
     * @returns Processed body content with block formatting
     */
    private static processBlockFlow(cmd: Command, context: WhitespaceContext): BodyType {
        if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

        const processed: Command[] = [];

        // Add leading newlines if not first child
        if (!context.isFirstChild) {
            processed.push(this.createTextNode("\n\n"));
        }

        // Process body content
        cmd.body.forEach((child, index) => {
            if (child instanceof Command) {
                if (child.type === cmdType.text) {
                    // Trim leading/trailing whitespace from text nodes
                    const text = (child.body as string).trim();
                    if (text) {
                        child.body = text;
                        processed.push(child);
                    }
                } else {
                    const childContext = this.createChildContext(context, index, cmd.body as Command[]);
                    child.body = this.processWhitespace(child, cmd, childContext);
                    processed.push(child);
                }
            }
        });

        // Add trailing newlines if not last child
        if (!context.isLastChild) {
            processed.push(this.createTextNode("\n\n"));
        }

        return processed;
    }

    /**
     * Processes commands with structured flow - removes whitespace, lets children manage themselves
     * @param cmd The command to process
     * @param context The whitespace context
     * @returns Processed body content with no whitespace output from this command
     */
    private static processStructuredFlow(cmd: Command, context: WhitespaceContext): BodyType {
        if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

        const processed: Command[] = [];

        cmd.body.forEach((child, index) => {
            if (child instanceof Command) {
                if (child.type === cmdType.text) {
                    // Remove pure whitespace text nodes
                    const text = child.body as string;
                    if (text.trim()) {
                        // This shouldn't happen in structured flow
                        // Log warning but keep the text
                        console.warn(`Text found in structured flow: "${text}"`);
                        processed.push(child);
                    }
                } else {
                    // Let children manage themselves
                    const childContext = this.createChildContext(context, index, cmd.body as Command[]);
                    child.body = this.processWhitespace(child, cmd, childContext);
                    processed.push(child);
                }
            }
        });

        return processed;
    }

    /**
     * Processes commands with location flow - trims leading/trailing whitespace for clean output
     * @param cmd The command to process
     * @param context The whitespace context
     * @returns Processed body content with trimmed boundaries
     */
    private static processLocationFlow(cmd: Command, context: WhitespaceContext): BodyType {
        if (!cmd.body || !(cmd.body instanceof Array)) return cmd.body;

        // Process children normally
        const processed = cmd.body.map((child, index) => {
            if (child instanceof Command) {
                const childContext = this.createChildContext(context, index, cmd.body as Command[]);
                child.body = this.processWhitespace(child, cmd, childContext);
            }
            return child;
        });

        // Trim leading whitespace
        if (processed.length > 0) {
            const first = processed[0];
            if (first instanceof Command && first.type === cmdType.text) {
                first.body = (first.body as string).replace(/^\s+/, '');
            }
        }

        // Trim trailing whitespace
        if (processed.length > 0) {
            const last = processed[processed.length - 1];
            if (last instanceof Command && last.type === cmdType.text) {
                last.body = (last.body as string).replace(/\s+$/, '');
            }
        }

        return processed;
    }

    /**
     * Processes commands with none flow - removes entire command from output
     * @param cmd The command to process
     * @param context The whitespace context
     * @returns undefined to remove the command entirely
     */
    private static processNoneFlow(cmd: Command, context: WhitespaceContext): BodyType {
        // Remove entire command from output
        return undefined;
    }

}