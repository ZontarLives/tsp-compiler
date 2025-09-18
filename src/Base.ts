import {definitions, flatOptionsList, cmdType} from './Definitions';
import {TspError} from "./Errors";
import {cmderr, cpyw} from "./Logger";
import {CommandData} from "./Command";

export let TspDebug = true;

export class Base {

    // Utility function to convert hex to RGB tuple
    private static hexToRgb(hex: string): [number, number, number] | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
            : null;
    }

    static log(text: string | undefined = undefined, variable: any = undefined) {
        if (TspDebug) {
            if (text && variable) {
                console.log(text, variable);
            }
            else if (text) {
                console.log(text);
            }
            else if (variable) {
                console.log(String(variable));
            }
        }
    }
}

// Export the Base.log method as 'log'
export const log = Base.log.bind(Base);


/**
 * Combines two objects, ensuring there are no duplicate keys.
 * @param obj1 First object to combine
 * @param obj2 Second object to combine
 * @returns A new object containing all unique key-value pairs from both input objects
 * @throws Error if duplicate keys are found
 */
export function combineObjectsUnique<T, U>(obj1: Record<string, T>, obj2: Record<string, U>): Record<string, T | U> {
    // Find duplicate keys
    const duplicateKeys = Object.keys(obj1).filter(key => obj2.hasOwnProperty(key));

    // Remove duplicates from obj2 and call addError for each instance
    duplicateKeys.forEach(key => {
        const cmdData1 = obj1[key] as CommandData;
        const cmdData2 = obj2[key] as CommandData;
        // addError(cmdData, `Duplicate key "${key}" found and not included: check source to decide which to keep, or
        // to rename`); delete obj2[key];
        throw cmderr(cmdData2, `Duplicate key "${key}" encountered. Original located at ${cpyw(cmdData1.file + ':' + cmdData1.line)}. Decide which to keep or change.`);
    });

    // Combine objects
    return {...obj1, ...obj2};
}

export function addObjectUnique(obj: Record<string, any>, key: string, value: any) {
    if (obj.hasOwnProperty(key)) {
        throw new TspError(`Duplicate key found: ${key}`);
    }
    obj[key] = value;
}

/**
 * Joins array elements into a string with specified strings before and after each element.
 * @param arr - The array to join.
 * @param left - The string to prepend to each element.
 * @param delimiter - The string to separate each element.
 * @param right - The string to append to each element.
 * @returns A string representation of the array.
 */
export function specialJoin<T>(arr: T[], left: string, delimiter: string, right: string): string {
    return arr.map(el => `${left}${el}${right}`).join(delimiter);
}


export function getCommandDefinitionKeys(sortByLength: boolean = true): string[] {
    // const optionKeys = Object.keys(flatOptionsList);
    const commandDefinitionKeys = Object.keys(definitions).filter(
        key => definitions[key].type !== cmdType.entity
            && definitions[key].type !== cmdType.location
            && definitions[key].type !== cmdType.system
    );

    // // Combine the two arrays
    // const commandDefinitionKeys = [...optionKeys, ...commandKeys];

    // Check commandDefinitionKeys to ensure there are no duplicates.  If a duplicate is found, throw an error.
    const duplicates = commandDefinitionKeys.filter((item, index) => commandDefinitionKeys.indexOf(item) !== index);
    if (duplicates.length > 0) {
        throw new TspError(`Duplicate keys found: ${duplicates.join(", ")}`);
    }

    // Sort keys alphabetically
    commandDefinitionKeys.sort((a, b) => {
        return a.localeCompare(b);
    });

    // Now sort keys by length, keeping the alphabetical sort
    if (sortByLength) {
        commandDefinitionKeys.sort((a, b) => {
            if (a.length === b.length) {
                return a.localeCompare(b);
            }
            return b.length - a.length;
        });
    }

    return commandDefinitionKeys;
}

export function getOptionDefinitionKeys(): string[] {
    const optionDefinitionKeys = Object.keys(flatOptionsList);

    // Check optionDefinitionKeys to ensure there are no duplicates.  If a duplicate is found, throw an error.
    const duplicates = optionDefinitionKeys.filter((item, index) => optionDefinitionKeys.indexOf(item) !== index);
    if (duplicates.length > 0) {
        throw new TspError(`Duplicate keys found: ${duplicates.join(", ")}`);
    }

    // Sort keys alphabetically
    optionDefinitionKeys.sort((a, b) => {
        return a.localeCompare(b);
    });

    // Now sort keys by length, keeping the alphabetical sort
    optionDefinitionKeys.sort((a, b) => {
        if (a.length === b.length) {
            return a.localeCompare(b);
        }
        return b.length - a.length;
    });

    return optionDefinitionKeys;
}


/**
 * Create a regex statement that uses the array passed in the arguments as OR conditions in the form of:
 * \b(key1|key2|key3)\b
 *
 * @param commandDefinitionKeys
 * @returns
 */
export function createRegexFragment(commandDefinitionKeys: string[], prefix:string = `(?i)`, suffix:string = `[ \\t]*([\\w'. ]*)`): string {
    const regexFrag = `${prefix}\\b(${commandDefinitionKeys.join("|")})\\b${suffix}`;
    return regexFrag;
}
