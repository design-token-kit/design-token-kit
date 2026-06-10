import { Command } from "commander";
import { validateCommand } from "./commands/validate";
import { convertCommand } from "./commands/convert";
import { showcaseCommand } from "./commands/showcase";
import { testCommand } from "./commands/test";

const program = new Command()
    .name("dtokens")
    .description("CLI for DTCG JSON and HRDT YAML: validate, convert, showcase.")
    .addCommand(testCommand)
    .addCommand(validateCommand)
    .addCommand(convertCommand)
    .addCommand(showcaseCommand)
    .addHelpText("after", ({ command }) => command.name() === "dtokens" ? `
Examples:
  $ dtokens test tokens.json
  $ dtokens validate tokens.json
  $ dtokens validate tokens.yaml
  $ dtokens validate tokens.json tokens.dark.yaml --engine ajv
  $ dtokens convert tokens.yaml --inform hrdt --outform css --out ./dist/tokens.css
  $ dtokens convert tokens.yaml --outform dtcg
  $ dtokens convert tokens.json --outform hrdt
  $ dtokens showcase tokens.yaml
  $ dtokens showcase tokens.css
  $ dtokens showcase tokens.yaml --out out.html
  $ dtokens showcase tokens.yaml --out ./dist/showcase.html
` : "");

program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
