import { Command } from "commander";
import { DtcgChecker, CheckScope } from "@design-token-kit/core";
import { hasErrors, printIssues } from "./issues";

const EXIT_VALIDATION_ERROR = 2;
const EXIT_FAILURE = 1;

export const validateCommand = new Command("validate")
    .description("Validate token files. Deprecated: use 'check --scope validate'.")
    .argument("[files...]", "Paths to token files (reads from stdin when omitted)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  unexpected error\n  2  validation errors found")
    .action(async (files: string[]) => {
        console.error("Warning: 'validate' is deprecated. Use 'check --scope validate'.");
        try {
            const sources = files.length > 0 ? files : ["-"];
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate(sources);
            printIssues(issues);
            if (hasErrors(issues)) {
                process.exit(EXIT_VALIDATION_ERROR);
            }
            console.log("Validation passed.");
        }
        catch (error) {
            console.error("Validation error:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });
