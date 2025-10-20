import { Range } from "vscode-languageserver";
import { ShellPackageManager } from './shellArgumentOptions';

export interface ShellCommand {
  command: string;
  vars: string[];
  varsRange: Range[];
  seperation: ShellCommandSeperationSymbols;
  seperationType: ShellCommandSeperationType;
  options: ShellCommandOption[];
  range: Range;
  flags: string[];
  packages: ShellCommandPackage[];
  packageManager: ShellPackageManager | null;
}

export interface ShellCommandPackage {
  name: string;
  version: string;
  range: Range;
}

export enum ShellCommandDiagnostics {
  NO_PACKAGE_LIST_CLEANUP,
}

export enum ShellCommandOption {
  UPDATE_PACKAGE_LIST,
  CLEANUP_COMMAND,
  INSTALL_PACKAGE,
  CREATE_DIRECTORY,
  CHANGE_DIRECTORY,
  PERFORM_WORK,
  UNPACK_ARCHIVE,
}

export enum ShellCommandSeperationType {
  NONE,
  AND_SUCCESS,
  AND_FAILURE,
  AND,
  PIPE,
  GROUP_CURLY,
  GROUP_ROUND,
}

export enum ShellCommandSeperationSymbols {
  NONE = "",
  AND_SUCCESS = "&&",
  AND_FAILURE = "||",
  AND = ";",
  PIPE = "|",
  GROUP_CURLY_OPEN = "{",
  GROUP_CURLY_CLOSE = "}",
  GROUP_ROUND_OPEN = "(",
  GROUP_ROUND_CLOSE = ")",
}

export function createShellCommand(
  commandText: string,
  range: Range
): ShellCommand {
  return {
    command: commandText,
    seperation: ShellCommandSeperationSymbols.NONE,
    seperationType: ShellCommandSeperationType.NONE,
    options: [],
    flags: [],
    vars: [],
    varsRange: [],
    range: range,
    packages: [],
    packageManager: null,
  };
}
