// main.ts
import {Processor, ProcessorConfig} from './Processor';
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

    // Check for whitespace management flags
    const useNewWhitespace = args.includes('--use-new-whitespace');
    const useOldWhitespace = args.includes('--use-old-whitespace');
    const filteredArgs = args.filter(arg =>
        arg !== '--use-new-whitespace' && arg !== '--use-old-whitespace'
    );

    // Default to new system unless explicitly told to use old system
    let useNewWhitespaceManagement = true;
    if (useOldWhitespace) {
        useNewWhitespaceManagement = false;
        console.warn('⚠️  DEPRECATION WARNING: --use-old-whitespace flag is deprecated.');
        console.warn('   The old whitespace management system will be removed in a future version.');
        console.warn('   Please migrate to the new flow-based whitespace management system.');
        console.warn('   See WhitespaceManagementPlan.md for migration guidance.\n');
    } else if (useNewWhitespace) {
        useNewWhitespaceManagement = true;
        console.log('ℹ️  Using new flow-based whitespace management system (now default).');
    }

    const config: ProcessorConfig = {
        useNewWhitespaceManagement: useNewWhitespaceManagement
    };

    const processor = new Processor(config);
    try {
        await processor.processTsp(filteredArgs);
    } catch (err) {
        if (err instanceof TspError) {
            console.error(err);
            process.exit(1);
        } else {
            throw err;
        }
    }
}
