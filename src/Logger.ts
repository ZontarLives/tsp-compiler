/**
 * @module Logger
 * @description
 * This module contains functions for logging messages to the console.
 */
import chalk from 'chalk';
import {TspDebug} from "./Base";
import Lexer from "./Lexer";
import Parser from "./Parser";
import {TokenType} from "./TokenTypes";
import {TspError} from "./Errors";
import {CommandData} from "./Command";

export function clog(clr:chalk.Chalk, text: string | undefined = undefined, variable: any = undefined) {
    if (TspDebug) {
        if (text && variable) {
            console.log(clr(text), clr(String(variable)));
        } else if (text) {
            console.log(clr(text));
        } else if (variable) {
            console.log(clr(String(variable)));
        }
    }
}
export function cout(clr:chalk.Chalk, text: string | undefined = undefined, variable: any = undefined) {
    if (TspDebug) {
        let output = '';
        if (text && variable) {
            output = clr(text) + ' ' + clr(String(variable));
        } else if (text) {
            output = clr(text);
        } else if (variable) {
            output = clr(String(variable));
        }
        process.stdout.write(output);
    }
}
const rpt = chalk.hex(`#02f8a2`);
export const wrnclr = chalk.hex(`#ff9100`);
export const errclr = chalk.hex(`#ff0000`);

export const headerclr = chalk.hex(`#488cf9`);

export const amber = chalk.hex(`#d99904`);


export const cpyw = chalk.whiteBright;
export const blu = chalk.blue;
export const ylw = chalk.yellow;
export const vsn = chalk.hex(`#e3e301`);

export const erln = chalk.white;
const ermsg = chalk.hex('#C9AB02');
const erdta = chalk.blue;

const smbl = chalk.blueBright;
const tkn = chalk.yellowBright;
export const intr = chalk.hex('#02f8b5');
export const struc = chalk.hex('#10fbdc');

export const cpath = chalk.hex(`#37acff`);

export const advisement = chalk.hex(`#0080dc`);


export function out(text: string | undefined = undefined, variable: any = undefined) {
    clog(rpt, text, variable);
}

export function terminal(text: string | undefined = undefined, variable: any = undefined) {
    cout(rpt, text, variable);
}

export function intro(text: string | undefined = undefined, variable: any = undefined) {
    clog(intr, text, variable);
}

export function fileline(filename: string, line: number) {
    return erln(`${filename}:${line}`);
}

export function errmsg(msg: string) {
    return ermsg(` ${msg}`);
}

export function errdata(data: string | undefined = undefined) {
    if (data) {
        return erln(' ->') + erdta(` ${data}`);
    } else {
        
    }
}

export function lexerr(lex: Lexer, msg: string, pos:number | undefined = undefined) {
    return new TspError(lexerrMsg(lex, msg, pos));
}

export function lexerrMsg(lex: Lexer, msg: string, pos:number | undefined = undefined) {
    if (!pos) {
        pos = lex.latestToken.pos
    }
    const throwmsg = fileline(lex.filename, lex.getLineNumber()) + errmsg(msg) + errdata(lex.blurb(pos));
    return throwmsg;
}

export function cmderr(cmd: CommandData, msg: string) {
    return new TspError(cmderrMsg(cmd, msg));
}

export function cmderrMsg(cmd: CommandData, msg: string) {
    const throwmsg = fileline(cmd.file!, cmd.line!) + errmsg(msg);
    return throwmsg;    
}

export function parserr(parser:Parser, msg:string) {
    return new TspError(parseerrMsg(parser, msg));
}

export function parseerrMsg(parser:Parser, msg:string) {
    const currentToken = parser.cursor.peek();
    const value = currentToken.type === TokenType.NEWLINES ? '\\n' : currentToken.value;
    // const throwmsg = fileline(parser.filename, currentToken.line) + errmsg(`Expecting (${tkn(msg)}), but found ${smbl(currentToken.type)} '${smbl(value)}'`);
    
    const throwmsg = fileline(parser.filename, currentToken.line) + errmsg(msg);
    return throwmsg;
}

// Need invalid reference error message, maybe specific to caller.

// Function to log a message to the console via the Logger log function
export function plog(text: string | undefined = undefined, variable: any = undefined) {
    clog(rpt, text, variable);
}
