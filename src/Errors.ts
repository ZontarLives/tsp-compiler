
import {errmsg, fileline, wrnclr} from "./Logger";
import {recoverErrMsg} from "./Verification";
import {CommandDefinition, OptionDefinition} from "./Definitions";
import {CommandData} from "./Command";

export type errorType = 'error' | 'warning' | 'info';
export const errorList: {file: string, line: number, msg: string, type: errorType}[] = [];

const errorMax = 40;

export function addError(cmdData: CommandData | OptionDefinition | CommandDefinition, errorMsg: string, type: errorType = 'error') {
    
    const error = recoverErrMsg(cmdData, errorMsg);
    
    let filename: string;
    let linenum: number;
    let msg: string;
    
    // Regex to split a string like "filename.ext:12 Message text" into a file name, a line number, and a message
    const regex = /^(.+):(\d+) (.*)/;
    const match = regex.exec(error);
    if (match) {
        filename = match[1];
        linenum = parseInt(match[2]);
        msg = match[3];
        errorList.push({file: filename, line: linenum, msg: msg, type: type});
    } else {
        errorList.push({file: '', line: 0, msg: `Specified ${type} message is not in the expected format: '${error}'`, type: type});
    }
}

export function addWarning(cmdData: CommandData, errorMsg: string) {
    addError(cmdData, errorMsg, 'warning');
}

export function addInfo(cmdData: CommandData, errorMsg: string) {
    addError(cmdData, errorMsg, 'info');
}

export function addErrorMessage(filename: string, linenum: number, errorMsg: string) {
    errorList.push({file: filename, line: linenum, msg: errorMsg, type: 'error'});
}
export function addWarningMessage(filename: string, linenum: number, errorMsg: string) {
    errorList.push({file: filename, line: linenum, msg: errorMsg, type: 'warning'});
}

export function addInfoMessage(filename: string, linenum: number, errorMsg: string) {
    errorList.push({file: filename, line: linenum, msg: errorMsg, type: 'info'});
}


export function buildErrorsString() {
    let errString = ''
    if (errorList.length) {
        // Sort errorList by line number
        const sortedList = errorList.sort((a, b) => {
            if (a.line < b.line) {
                return -1;
            } else if (a.line > b.line) {
                return 1;
            } else {
                return 0;
            }
        });
        sortedList.some((value, index) => {
            if (index >= errorMax) {
                errString += `... ${sortedList.length - errorMax} more errors\n`;
                return true;
            }
            if (errString.length > 0) {
                errString += `\n`;
            }
            errString += fileline(value.file, value.line) + errmsg(value.msg);
        });
        // errString += wrnclr(`\nTotal non-breaking errors: ${errorList.length}\n`);
    }
    return errString;
}

export function errorsReset() {
    errorList.length = 0;
}

export class TspError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TspError';
    }
}
