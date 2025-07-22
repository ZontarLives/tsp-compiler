// main.ts
import {Processor} from './Processor';
import {cpyw, intro, out, vsn} from "./Logger";
import {buildDefinitionOptions} from "./Definitions";
import {TspError} from "./Errors";

const args = process.argv.slice(2);

if (args.length === 0) {
    out('No file or directory specified.');
    process.exit(1);
}

// Execute the processor
execute().then(() => {});

async function execute() {

    intro(`\n`);
    intro(`*-------------------------*`);
    intro(`TaleSpinner Compiler`);
    intro(vsn(`Version 1.0.0`));
    intro(cpyw(`(c) 2024 Pete Gardner`));
    intro(`*-------------------------*\n`);
    
    buildDefinitionOptions();
    
    const processor = new Processor();
    try {
        await processor.processTsp(args);
    } catch (err) {
        if (err instanceof TspError) {
            console.error(err);
            process.exit(1);
        } else {
            throw err;
        }
    }
}
