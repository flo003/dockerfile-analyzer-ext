import { Argument, Run } from "dockerfile-ast";
import { Range } from "vscode-languageserver";
import { shellPackageManagers } from "./shellArgumentOptions";
import {
  createShellCommand,
  ShellCommand,
  ShellCommandDiagnostics,
  ShellCommandOption,
  ShellCommandSeperationSymbols,
  ShellCommandSeperationType,
} from "../document/shellArgumentDefinition";
import { DockerfileDocument } from "./dockerfileDocument";

export class ShellArgumentParsing {
  arguments: Argument[] = [];
  argumentContent: string;
  runInstruction: Run;
  runInstructionTextContent: string;
  commands: ShellCommand[] = [];
  diagnostics: ShellCommandDiagnostics[] = [];
  overallOptions: ShellCommandOption[] = [];

  constructor(runIntstruction: Run, dockerfileDocument: DockerfileDocument) {
    this.runInstructionTextContent = runIntstruction.getTextContent();
    this.runInstruction = runIntstruction;
    this.arguments = runIntstruction.getArguments();
    this.argumentContent = runIntstruction.getArgumentsContent() ?? "";
    this.commands = this.parseCommands();
    this.tryFindingShellCommandOptions(dockerfileDocument);
  }

  parseCommands(): ShellCommand[] {
    const commands: ShellCommand[] = [];
    let previousArgument: Argument | null = null;
    let previousCommand: ShellCommand | null = null;
    for (const argument of this.arguments) {
      const argumentValueTrimmed = argument ? argument.getValue().trim() : "";
      let newCommand: ShellCommand | null = createShellCommand(
        argumentValueTrimmed,
        argument.getRange()
      );
      let newCommandText = "";
      if (previousArgument !== null && previousCommand !== null) {
        if (
          argumentValueTrimmed.startsWith(
            ShellCommandSeperationSymbols.AND_FAILURE
          )
        ) {
          previousCommand!.seperation =
            ShellCommandSeperationSymbols.AND_FAILURE;
          previousCommand!.seperationType =
            ShellCommandSeperationType.AND_FAILURE;
        } else if (
          argumentValueTrimmed.startsWith(
            ShellCommandSeperationSymbols.AND_SUCCESS
          )
        ) {
          previousCommand!.seperation =
            ShellCommandSeperationSymbols.AND_SUCCESS;
          previousCommand!.seperationType =
            ShellCommandSeperationType.AND_SUCCESS;
        } else if (
          argumentValueTrimmed.startsWith(ShellCommandSeperationSymbols.PIPE)
        ) {
          previousCommand!.seperation = ShellCommandSeperationSymbols.PIPE;
          previousCommand!.seperationType = ShellCommandSeperationType.PIPE;
        } else if (
          argumentValueTrimmed.startsWith(
            ShellCommandSeperationSymbols.GROUP_CURLY_OPEN
          ) &&
          argumentValueTrimmed.endsWith(
            ShellCommandSeperationSymbols.GROUP_CURLY_CLOSE
          )
        ) {
          /* TODO implement recursive parse until CLOSE */
        } else if (
          argumentValueTrimmed.startsWith(
            ShellCommandSeperationSymbols.GROUP_ROUND_OPEN
          ) &&
          argumentValueTrimmed.endsWith(
            ShellCommandSeperationSymbols.GROUP_ROUND_CLOSE
          )
        ) {
          /* TODO implement recursive parse until CLOSE */
        } else if (
          argumentValueTrimmed.endsWith(ShellCommandSeperationSymbols.AND)
        ) {
          const oldCommand = newCommand.command.trim();
          newCommandText = oldCommand.substring(0, oldCommand.length - 2);
          newCommand.command = newCommandText;
          previousCommand!.seperation =
            ShellCommandSeperationSymbols.AND_SUCCESS;
          previousCommand!.seperationType =
            ShellCommandSeperationType.AND_SUCCESS;
          previousCommand!.command += " " + newCommand;
          previousCommand!.range.end = newCommand.range.end;
        }
        if (
          previousCommand!.seperationType !== ShellCommandSeperationType.NONE
        ) {
          newCommand = null;
        } else {
          newCommandText = newCommand.command.trim();
          previousCommand!.command += " " + newCommandText;
          previousCommand!.range.end = newCommand.range.end;
          newCommand = previousCommand;
        }
      }
      if (newCommand && newCommandText.startsWith("--")) {
        newCommand.flags.push(newCommandText);
      } else if (newCommand && newCommandText.startsWith("-")) {
        newCommand.flags.push(newCommandText);
      }
      if (newCommand !== previousCommand && newCommand !== null) {
        commands.push(newCommand);
      }
      previousArgument = argument;
      previousCommand = newCommand;
    }

    const shellPackageManagersList = Object.keys(shellPackageManagers);
    for (const cmd of commands) {
      for (const packageManagerId of shellPackageManagersList) {
        if (cmd.command.toLowerCase().trim().startsWith(packageManagerId)) {
          cmd.packageManager = shellPackageManagers[packageManagerId];
        }
      }
      for (const packageManagerId of shellPackageManagersList) {
        if (shellPackageManagers[packageManagerId].cleanupCommands.some(ccd => ccd.every(cc => cmd.command.includes(cc)))) {
          cmd.packageManager = shellPackageManagers[packageManagerId];
        }
      }
    }
    return commands;
  }

  setupFlags(shellCommand: ShellCommand) {
    const commands = shellCommand.command.split(" ");
    const packages = [];
    for (const command of commands) {
      if (command.startsWith("--")) {
        continue;
      }
      if (command.startsWith("-")) {
        continue;
      }
      console.log(command);
      if (
        !shellCommand.packageManager!.installCommands.some(function (cmd) {
          return command.startsWith(cmd.join(" "));
        })
      ) {
        packages.push(command);
        continue;
      }
    }
    shellCommand.vars = packages;
  }

  tryFindingShellCommandOptions(dockerfileDocument: DockerfileDocument) {
    let updatePackage = false;
    let cleanupPackage = false;
    for (const shellCommand of this.commands) {
      if (shellCommand.packageManager != null) {
        if (
          shellCommand.packageManager.updateCommands.some((cmd) => {
            const result = cmd.every((value) => {
              return shellCommand.command.includes(value);
            });
            return result;
          })
        ) {
          shellCommand.options.push(ShellCommandOption.UPDATE_PACKAGE_LIST);
          this.overallOptions.push(ShellCommandOption.UPDATE_PACKAGE_LIST);
          updatePackage = true;
          // TODO handle apt install auto fetch flags e.g. --no-chache
        }
        if (
          shellCommand.packageManager.cleanupCommands.some((cmd) => {
            const result = cmd.every((value) => {
              return shellCommand.command.includes(value);
            });
            return result;
          })
        ) {
          shellCommand.options.push(
            ShellCommandOption.CLEANUP_COMMAND
          );
          this.overallOptions.push(
            ShellCommandOption.CLEANUP_COMMAND
          );
          cleanupPackage = true;
        }
        if (
          shellCommand.packageManager.workCommands.some((cmd) => {
            const result = cmd.every((value) => {
              return shellCommand.command.includes(value);
            });
            return result;
          })
        ) {
          shellCommand.options.push(
            ShellCommandOption.PERFORM_WORK
          );
          this.overallOptions.push(
            ShellCommandOption.PERFORM_WORK
          );
          updatePackage = true;
        }
        let installCommandTmp: string[] | null = null;
        if (
          shellCommand.packageManager.installCommands.some((cmd) => {
            const result = cmd.every((value) => {
              return shellCommand.command.includes(value);
            });
            installCommandTmp = result ? cmd : null;
            return result;
          })
        ) {
          // TODO fix range calculation - add ranges to flag creation
          shellCommand.options.push(ShellCommandOption.INSTALL_PACKAGE);
          this.overallOptions.push(ShellCommandOption.INSTALL_PACKAGE);
          const lastInstallCmd =
            installCommandTmp!.length > 0
              ? installCommandTmp![installCommandTmp!.length - 1]
              : "";
          const installCmdLength =
            shellCommand.command.indexOf(" " + lastInstallCmd) +
            lastInstallCmd.length +
            1;
          const beginRange = dockerfileDocument.textDocument.offsetAt(
            shellCommand.range.start
          );
          shellCommand.vars = shellCommand.command
            .substring(0, installCmdLength)
            .split(" ")
            .filter((cmd) => cmd.startsWith("-"))
            .concat(
              shellCommand.command.substring(installCmdLength).trim().split(" ").filter(cmd => cmd.length > 0)
            );
          let commandVarOffset = 0;
          shellCommand.varsRange = shellCommand.vars.map((varTmp) => {
            const beginOffset = shellCommand.command.indexOf(
              varTmp,
              commandVarOffset
            );
            const endOffset = beginOffset + varTmp.length;
            const start = dockerfileDocument.textDocument.positionAt(
              beginRange + beginOffset
            );
            const end = dockerfileDocument.textDocument.positionAt(
              beginRange + endOffset
            );
            commandVarOffset = endOffset;
            return Range.create(start, end);
          });
        }
        updatePackage = true;
      }
      const startText = shellCommand.command.trim();
      if (startText.startsWith("cd")) {
        shellCommand.options.push(ShellCommandOption.CHANGE_DIRECTORY);
        this.overallOptions.push(ShellCommandOption.CHANGE_DIRECTORY);
      }
      if (startText.startsWith("mkdir")) {
        shellCommand.options.push(ShellCommandOption.CREATE_DIRECTORY);
        this.overallOptions.push(ShellCommandOption.CREATE_DIRECTORY);
      }
      if (startText.startsWith("unzip") || startText.startsWith("tar")) {
        shellCommand.options.push(ShellCommandOption.UNPACK_ARCHIVE);
        this.overallOptions.push(ShellCommandOption.UNPACK_ARCHIVE);
      }
    }
    if (updatePackage && !cleanupPackage) {
      this.diagnostics.push(ShellCommandDiagnostics.NO_PACKAGE_LIST_CLEANUP);
    }

    for (const cmd of this.commands) {
      if (
        cmd.options.includes(ShellCommandOption.INSTALL_PACKAGE)
        //&&
        //cmd.vars.startsWith("-")
      ) {
        for (const [i, varTmp] of cmd.vars.entries()) {
          if (varTmp.startsWith("-")) {
            continue;
          }
          let splitVar = "=";
          if (varTmp.includes("<=")) {
            splitVar = "<=";
          } else if (varTmp.includes(">=")) {
            splitVar = ">=";
          } else if (varTmp.includes(">")) {
            splitVar = ">";
          } else if (varTmp.includes("<")) {
            splitVar = "<";
          }
          const packageTmp = varTmp.split(splitVar);
          if (packageTmp[0].includes(".") || packageTmp[0].includes("/")) {
            continue;
          }
          const packageRes = {
            name: packageTmp[0],
            version: "",
            range: cmd.varsRange[i],
          };
          if (packageTmp.length === 2) {
            packageRes.version = packageTmp[1];
          }
          cmd.packages.push(packageRes);
        }
        // add packages
      }
    }
  }
}

export function parseShellArguments(
  runInstruction: Run,
  dockerfileDocument: DockerfileDocument
): ShellArgumentParsing {
  return new ShellArgumentParsing(runInstruction, dockerfileDocument);
}
