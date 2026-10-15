#!/usr/bin/env node
import { startHttp } from './http.js';
import { start } from './server.js';
import { libraryRoot } from './library-config.js';
import { importAssets } from './import.js';
const [command,...args]=process.argv.slice(2);
try {
  if(command==='import' && args.length===3 && args[1]==='--to') console.log(JSON.stringify(await importAssets(args[0],args[2]),null,2));
  else if((command==='serve' || command==='serve-http') && (args.length===0 || args.length===2 && args[0]==='--root')) {
    const root=libraryRoot(args[1]);
    if(command==='serve-http') {
      const server=await startHttp(root);
      console.error('HTTP MCP listening on '+JSON.stringify(server.address()));
    } else await start(root);
  } else if(command==='--help' || !command) console.log('Usage:\n  node src/cli.js import <file|directory|zip> --to <new-directory>\n  node src/cli.js serve --root <library-directory>\n  node src/cli.js serve-http --root <library-directory> (requires MCP_PUBLIC_URL)\nDefaults to the project library/ folder. TAILWIND_PLUS_ROOT or --root optionally overrides it.');
  else throw Error('Invalid arguments; run --help');
} catch(e){console.error(`tailwind-plus-local: ${e.message}`);process.exitCode=1;}
