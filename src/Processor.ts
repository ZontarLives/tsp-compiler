// Processor.ts
import fs from 'fs/promises';
import path from 'path';
import {Parser, restartUniqueIdCounter} from './Parser';
import chalk from "chalk";
import Lexer from "./Lexer";
import {combineObjectsUnique, getCommandDefinitionKeys, createRegexFragment, getOptionDefinitionKeys} from "./Base";
import {cpath, erln, errclr, headerclr, out, terminal, wrnclr} from "./Logger";
import {errorList, errorsReset, buildErrorsString, TspError} from "./Errors";
import {RelationalOperatorPatterns} from "./Lexer";
import {Verification} from "./Verification";
import {Command} from "./Command";
import {Snippets} from "./Snippets";
import {getCompilerOptions} from "ts-loader/dist/compilerSetup";
import {WhitespaceManagement} from "./WhitespaceManagement";

/**
 * Configuration options for the TSP Processor
 */
export interface ProcessorConfig {
    /** Use the new flow-based whitespace management system (default: false for backward compatibility) */
    useNewWhitespaceManagement?: boolean;
}

export class Processor {
    private config: ProcessorConfig;

    constructor(config: ProcessorConfig = {}) {
        this.config = {
            useNewWhitespaceManagement: true, // Default to new system (Phase 4)
            ...config
        };
    }

    async processTsp(filesAndDirectories: string[]) {

        restartUniqueIdCounter();
        
        // A collection of all top-level entities in the parsed tsp files
        let entities: Record<string, Command> = {};
        
        // Set up output path for compiled tsp files
        let tspOutPath = await this.setupOutputPath(filesAndDirectories);
        // Write support files to tspOut directory, including CommandDefinitionKeys.json and RegexFragment.txt
        await this.writeSupportFiles(tspOutPath);
        // Entities gathered from the processTspFiles() method will be combined with the entities
        let parsedFileEntities: Record<string, Command> = {};
        
        // Iterate through all tsp files and directories.  If a file is specified in the command line, it will be
        // processed directly.  If a directory is specified, all tsp files in the directory will be processed.
        for (const item of filesAndDirectories) {
            try {
                const stat = await fs.stat(item);
                // Process tsp files in a directory
                if (stat.isDirectory()) {
                    const files = await fs.readdir(item);
                    const tspFiles = files.filter(file => path.extname(file) === '.tsp');
                    parsedFileEntities = await this.processTspFiles(tspFiles, tspOutPath, item);
                }
                // Process tsp files specified in the command line
                else if (stat.isFile() && path.extname(item) === '.tsp') {
                    parsedFileEntities = await this.processTspFiles([item], tspOutPath, path.dirname(item));
                }
            } catch (err) {
                if (err instanceof TspError) {
                    console.error(chalk.red.bold(`\nError processing ${item}:\n`), err.message);
                } else {
                    throw err;
                }
            }
            // Combine all entities from all files into a single object
            entities = combineObjectsUnique(entities, parsedFileEntities);
        }

        Verification.verifyEntitySingularity(entities);
        Verification.verifyInitializedGlobalVariables(entities);
        Verification.verifyAllConditionals(entities);
        Verification.correctSentenceSpacingAll(entities)

        // console.log('Verification.initReferences:', JSON.stringify(Verification.initReferences, null, 3));
        
        // // Iterate Verification.initReferences and create `variable` commands for each, adding them to `entities`
        // for (const [key, value] of Object.entries(Verification.initReferences)) {
        //     const cmd = Command.construct({
        //         type: cmdType.variable,
        //         tag: 'variable',
        //         id: key,
        //         rval: value,
        //     }, parser);
        //     entities[key] = cmd;
        // }

        if (errorList.length) {
            console.error(wrnclr("Global Errors:"));
            const response = buildErrorsString().trim();
            console.error(buildErrorsString() + '\n');
            errorsReset();
        }
        
        const snippets = Snippets.generateSnippets();
        // const stateCommands = Verification.generateStateCommands();
        const projectTitle = this.convertToFilename(Verification.gameTitle);
        const cmdDefKeys = getCommandDefinitionKeys(false);
        const optionDefKeys = getOptionDefinitionKeys()

        // Combine cmdDefKeys and optionDefKeys into one array
        const combinedKeys = [...cmdDefKeys, ...optionDefKeys];


        // Wrap entities, snippets, and cmdDefKeys into outputObj
        const outputObj: Record<string, any> = {
            entities: entities,
            snippets: snippets,
            commands: combinedKeys
        };
        // outputObj['statecommands'] = stateCommands;
        // ..\tspSrc "D:\Dev\TaleSpinner 2024\tsp-interpreter-V2\shared\tspOut"  "D:\Dev\TaleSpinner 2024\tsp-interpreter-V2\dist"
        
        // Write out the final entities object to a file in the tspOut directory
        const entitiesPath = path.join(tspOutPath, projectTitle);
        // const productionPath = path.join(process.cwd(), "tsp.static.json");
        const prodPath = await this.setupProductionPath(filesAndDirectories);
        const productionPath = path.join(prodPath, "tsp_game.json");
        try {
            await fs.writeFile(entitiesPath, JSON.stringify(outputObj, null, '   '));
            // terminal(`\rFinal output file generated:\n${cpath(entitiesPath)}\n\n`);
            terminal(`\rWorking file generated: ${cpath(projectTitle)}\n\n`);
            
            await fs.writeFile(productionPath, JSON.stringify(outputObj, null, '   '));
            terminal(`\rProduction file generated:\n${cpath(productionPath)}\n\n`);

        } catch (err) {
            out(`Error writing entities.json: ${err.message}`);
        }
       
        return entities;
    }
    
    convertToFilename(title: string) {
        return title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.tsp.json'
    }
    
    performLex(tspContent: string, fileName: string) {
        let lexed: any;
        terminal(`Lexing...`);
        const lexer = new Lexer(tspContent, fileName);
        lexed = lexer.tokenize();
        return lexed;
    }
    
    async writeLexResult(tspObjPath: string, lexed: any) {
        await fs.writeFile(tspObjPath, JSON.stringify(lexed, null, '   '));
        // terminal(`\rLex Successful.    Output file: ${cpath(tspObjPath)}\n`);
        // Output to terminal the filename only
        terminal(`\rLex Successful: ${cpath(path.basename(tspObjPath))}\n`);
    }
    
    async processTspFiles(tspFiles: string[], tspOutPath: string, parentPath: string) {

        let entities: Record<string, Command> = {};

        for (const fileName of tspFiles) {
            const fullPath = path.join(parentPath, fileName);
            try {
                out(headerclr(`Processing file: ${fileName}`));
                
                // Create a path for the lexed output file and the parsed output file
                const tspObjPath = path.join(tspOutPath, path.basename(fileName, '.tsp') + '.tso.json');
                const tspPath = path.join(tspOutPath, path.basename(fileName, '.tsp') + '.tsp.json');

                let lexerOutput: any;
                if (!testingParserOnly) {
                    // Load the source file
                    const tspContent = await fs.readFile(fullPath, 'utf-8');
                    // Run it through the Lexer
                    lexerOutput = this.performLex(tspContent, fileName);
                    // Write out the result
                    await this.writeLexResult(tspObjPath, lexerOutput);
                } else {
                    // Load the pre-lexed output file
                    lexerOutput = await JSON.parse(await fs.readFile(tspObjPath, 'utf-8'));
                }
                
                
                terminal(`Parsing...`);
                const parser = new Parser(lexerOutput, fileName);
                const references = parser.buildReferences();
                Verification.entityReferences = combineObjectsUnique(Verification.entityReferences, references);
                const parserOutput = parser.parse(references);
                Verification.reduceNewlinesOnAll(parserOutput);

                // Apply whitespace management based on configuration
                if (this.config.useNewWhitespaceManagement) {
                    WhitespaceManagement.manageWhitespace(parserOutput);
                } else {
                    Verification.reduceStructuralWhitespaceAll(parserOutput);
                }
                
                // Log all errors in `errorList` and reset the list
                if (errorList.length) {
                    // Write out what we have so far
                    await fs.writeFile(tspPath, JSON.stringify(parserOutput, null, '   '));
                    terminal(`\rParse Successful with errors: ${cpath(path.basename(tspPath))}\n`);
                    entities = combineObjectsUnique(entities, parserOutput);

                    console.error(wrnclr(`Non-Breaking errors: ${errorList.length} (Game may not operate as expected):`));
                    console.error(buildErrorsString() + '\n');
                    errorsReset();
                    
                } else {
                    await fs.writeFile(tspPath, JSON.stringify(parserOutput, null, '   '));
                    terminal(`\rParse Successful: ${cpath(path.basename(tspPath))}\n\n`);
                    entities = combineObjectsUnique(entities, parserOutput);
                }
            } catch (err) {
                if (err instanceof TspError) {
                    console.error(errclr("Breaking error:"));
                    console.error(err.message + '\n');
                    if (errorList.length) {
                        console.error(wrnclr(`Non-Breaking errors: ${errorList.length} (Game may not operate as expected):`));
                        console.error(buildErrorsString() + '\n');
                        errorsReset();
                    }
                }
                else {
                    throw err;
                }
            }
        }
        // Use `entities` to verify that all entities are defined in the parsed files.
        return entities;
    }

    /**
     * Sets up the output path for compiled tsp files.
     * @param filesAndDirectories
     */
    async setupOutputPath(filesAndDirectories: string[]) {
        // Set default outpath
        let tspOutPath = path.join(process.cwd(), 'tspOut');

        // If a second argument is in the command line, it is the output path for working files
        if (filesAndDirectories.length > 1) {
            // Last argument is the output path
            const outputPath = filesAndDirectories[1];
            // Determine whether or not `outputPath` is relative or absolute
            if (path.isAbsolute(outputPath)) {
                tspOutPath = outputPath;
            } else {
                tspOutPath = path.join(process.cwd(), outputPath);
            }
        }

        try {
            await fs.access(tspOutPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                try {
                    await fs.mkdir(tspOutPath);
                } catch (mkdirErr) {
                    console.error('Error creating tspOut directory:', mkdirErr.message);
                    throw mkdirErr;
                }
            }
            else {
                throw new Error ('Error accessing tspOut directory:' + err.message);
            }
        }
        return tspOutPath;
    }

    async setupProductionPath(filesAndDirectories: string[]) {
        // Set default outpath
        let tspProdPath = path.join(process.cwd());
        //terminal(`\rSetting up production path\n\n`);
        // If a third argument is in the command line, it is the PRODUCTION output path for the final game file
        if (filesAndDirectories.length > 2) {
            //terminal(`\rFound production path in args: ${filesAndDirectories[2]}\n\n`);
            // Last argument is the output path
            const outputPath = filesAndDirectories[2];
            // Determine whether or not `outputPath` is relative or absolute
            if (path.isAbsolute(outputPath)) {
                tspProdPath = outputPath;
            } else {
                tspProdPath = path.join(process.cwd(), outputPath);
            }
        }

        try {
            await fs.access(tspProdPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                try {
                    await fs.mkdir(tspProdPath);
                } catch (mkdirErr) {
                    console.error('Error creating tspOut directory:', mkdirErr.message);
                    throw mkdirErr;
                }
            }
            else {
                throw new Error ('Error accessing tspOut directory:' + err.message);
            }
        }
        return tspProdPath;
    }
    
    
    /**
     * Writes support files to tspOut directory, including CommandDefinitionKeys.json and RegexFragment.txt
     * These files include:
     * 1. CommandDefinitionKeys, which lists all command definition key in order of size, followed by alphabetical.
     * 2. RegexFragment.txt, which is a regular expression fragment that can be used to match all command 
     *    definition keys.
     * 3. RegexRelationalOperators.txt, which is a regular expression fragment that can be used to 
     *    match all relational operators.
     * 
     * @param tspOutPath
     */
    async writeSupportFiles(tspOutPath: string) {
        // Call getCommandDefinitionKeys() and write the result to a file in the tspOut directory
        const cmdDefKeys = getCommandDefinitionKeys();
        const cmdDefKeysPath = path.join(tspOutPath, 'CommandDefinitionKeys.json');
        try {
            await fs.writeFile(cmdDefKeysPath, JSON.stringify(cmdDefKeys, null, '   '));
        } catch (err) {
            out(`Error writing CommandDefinitionKeys.json: ${err.message}`);
        }

        const optionDefKeys = getOptionDefinitionKeys();
        const optionDefKeysPath = path.join(tspOutPath, 'OptionDefinitionKeys.json');
        try {
            await fs.writeFile(optionDefKeysPath, JSON.stringify(optionDefKeys, null, '   '));
        } catch (err) {
            out(`Error writing OptionDefinitionKeys.json: ${err.message}`);
        }

        // Call createRegexFragment() and write the result to a simple text file in the tspOut directory
        let commandDefinitionRegex = createRegexFragment(cmdDefKeys, `match: (?i)`, `[ \\t]*([\\w'. ]*)`);
        const regexFragPath = path.join(tspOutPath, 'CommandDefinitionRegex.txt');
        try {
            await fs.writeFile(regexFragPath, commandDefinitionRegex);
        } catch (err) {
            out(`Error writing CommandDefinitionRegex.txt: ${err.message}`);
        }

        let optionDefinitionRegex = createRegexFragment(optionDefKeys, `match: (?i)`, `[ \\t]*([\\w'. ]*)`);
        // optionDefinitionRegex += `\n\n\n`;
        // optionDefinitionRegex += createRegexFragment(optionDefKeys, `\\s*`);
        const optionRegexFragPath = path.join(tspOutPath, 'OptionDefinitionRegex.txt');
        try {
            await fs.writeFile(optionRegexFragPath, optionDefinitionRegex);
        } catch (err) {
            out(`Error writing OptionDefinitionRegex.txt: ${err.message}`);
        }
            
        // Call createRegexFragment() and write the result to a simple text file in the tspOut directory
        const regexRelOps = createRegexFragment(RelationalOperatorPatterns);
        const regexRelOpsPath = path.join(tspOutPath, 'RegexRelationalOperators.txt');
        try {
            await fs.writeFile(regexRelOpsPath, regexRelOps);
        } catch (err) {
            out(`Error writing RegexRelationalOperators.txt: ${err.message}`);
        }
    }
}

const testingParserOnly:boolean = false;
