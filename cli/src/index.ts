import { Command } from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCommand } from "./commands/check";
import { validateCommand } from "./commands/validate";
import { convertCommand } from "./commands/convert";
import { showcaseCommand } from "./commands/showcase";
import { statsCommand } from "./commands/stats";

const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

const program = new Command()
    .name("dtokens")
    .description("CLI for DTCG JSON and HRDT YAML: check, convert, showcase, stats.")
    .version(packageJson.version, "-v, --version", "display version")
    .addCommand(checkCommand)
    .addCommand(validateCommand)
    .addCommand(convertCommand)
    .addCommand(showcaseCommand)
    .addCommand(statsCommand)
    .addHelpText("after", ({ command }) => command.name() === "dtokens" ? `
Examples:
  $ dtokens check tokens.json
  $ dtokens check tokens.yaml tokens.dark.yaml
  $ dtokens check - tokens.dark.yaml < tokens.yaml
  $ dtokens check tokens.json --scope schema
  $ dtokens check tokens.json --scope lint
  $ dtokens check tokens.json --scope lint --checks layer-reference
  $ dtokens convert tokens.yaml --inform hrdt --outform css --out ./dist/tokens.css
  $ dtokens convert tokens.json --outform hrdt
  $ dtokens convert --outform css < tokens.yaml
  $ dtokens showcase tokens.yaml --out ./dist/showcase.html
  $ dtokens showcase - < tokens.yaml
  $ dtokens stats tokens.yaml
  $ dtokens stats - < tokens.yaml
  $ dtokens stats tokens.yaml --out ./dist/stats.html --open
` : "");

if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
}

program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
