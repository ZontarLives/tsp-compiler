import {definitions, OptionDefinition} from "./Definitions";

/**
 * The Options class is a Map of Record<string, OptionDefinition>.  The outer Map is keyed by the commandKey.  The
 * inner Map is keyed by the optionKey.  The OptionDefinition is the value.
 */
export class Options extends Map<string, Record<string, OptionDefinition>> {
    constructor() {
        super();
        for (const key in definitions) {
            const definition = definitions[key];
            if (definition.shape && definition.shape.options) {
                this.set(key, definition.shape.options);
            }
        }
    }

    /**
     * Get the option definition for the commandKey.
     *
     * Operation: If the commandKey exists in the Options object, return the value.  Otherwise, return undefined.
     * @param commandKey
     * @param optionKey
     */
    getOptionDefinition(commandKey: string, optionKey: string): OptionDefinition | undefined {
        const options = this.get(commandKey);
        if (options && options[optionKey]) {
            return options[optionKey];
        }
        return undefined;
    }

    /**
     * Get the parent keys of the optionKey.
     *
     * Operation: Iterate over all the entries in the Options object.  If the optionKey is found in any of the options,
     * return the parent key.  Otherwise, return undefined.
     *
     * @param optionKey
     */
    getOptionParents(optionKey: string): string[] | undefined {
        const parents: string[] = [];
        for (const [key, options] of this.entries()) {
            if (options[optionKey]) {
                parents.push(key);
            }
        }
        return parents.length > 0 ? parents : undefined;
    }

    /**
     * Check if the optionKey is a valid option definition. If it is, return true.  Otherwise, return false.
     *
     * Operation: Iterate over all the options in the Options object.  If the optionKey is found in any of the
     * options, return true.  Otherwise, return false.
     *
     * @param optionKey
     */
    isOptionDefinition(optionKey: string): boolean {
        for (const options of this.values()) {
            if (options[optionKey]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get the valid tags for the commandKey.
     *
     * Operation: If the commandKey exists in the Options object, return the keys.  Otherwise, return an empty array.
     *
     * @param commandKey
     */
    getValidTags(commandKey: string): string[] {
        const options = this.get(commandKey);
        if (options) {
            return Object.keys(options);
        }
        return [];
    }
}

// export const options = new Options();
