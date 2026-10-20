import fs from "node:fs";
import path from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const outputDir = ".output/chrome-mv3";

function walk(dir) {
    for (const entry of fs.readdirSync(dir, {
        withFileTypes: true,
    })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }

        if (!entry.name.endsWith(".js")) {
            continue;
        }

        console.log(`Obfuscating: ${fullPath}`);

        const code = fs.readFileSync(fullPath, "utf8");

        const result = JavaScriptObfuscator.obfuscate(code, {
            target: "browser",

            compact: true,

            identifierNamesGenerator: "hexadecimal",

            renameGlobals: true,
            renameProperties: false,

            ignoreImports: true,

            stringArray: false,
            stringArrayEncoding: ["base64"],
            stringArrayThreshold: 0.5,

            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.3,

            splitStrings: true,
            splitStringsChunkLength: 8,

            controlFlowFlattening: false,
            deadCodeInjection: false,

            selfDefending: false,
            debugProtection: false,

            sourceMap: false,
        });

        fs.writeFileSync(
            fullPath,
            result.getObfuscatedCode(),
        );
    }
}

walk(outputDir);

console.log("Obfuscation completed.");