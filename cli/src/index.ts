import { Command } from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCommand } from "./commands/validate";
import { convertCommand } from "./commands/convert";
import { showcaseCommand } from "./commands/showcase";

const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

const program = new Command()
    .name("dtokens")
    .description("CLI for DTCG JSON and HRDT YAML: validate, convert, showcase.")
    .version(packageJson.version, "-v, --version", "display version")
    .addCommand(validateCommand)
    .addCommand(convertCommand)
    .addCommand(showcaseCommand)
    .action(() => { program.outputHelp(); })
    .addHelpText("after", ({ command }) => command.name() === "dtokens" ? `
Examples:
  $ dtokens validate tokens.json
  $ dtokens validate tokens.yaml
  $ dtokens convert tokens.yaml --inform hrdt --outform css --out ./dist/tokens.css
  $ dtokens convert tokens.json --outform hrdt
  $ dtokens showcase tokens.yaml --out ./dist/showcase.html
` : "");

program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
