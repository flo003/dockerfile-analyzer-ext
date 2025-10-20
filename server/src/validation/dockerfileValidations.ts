import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { Argument, From, Instruction } from "dockerfile-ast";

import { DockerfileDocument } from "../document/dockerfileDocument";
import { ShellArgumentParsing } from "../document/shellArgumentParsing";
import {
  ShellCommand,
  ShellCommandDiagnostics,
  ShellCommandOption,
  ShellCommandSeperationSymbols,
} from "../document/shellArgumentDefinition";
import { FromMetadata } from "../document/fromMetadata";
import {
  validateImageTag,
  validateLatestImageVersions,
  validateNoImageVersions,
  validateSmallerImageVersions,
} from "./fromValidations";
import { DiagnosticSource } from "./definitions";
import { ShellPackageManager } from "../document/shellArgumentOptions";

export class DockerfileValidations {
  dockerfileDocument: DockerfileDocument;
  warningImageOlderThanNumberOfDays: number;
  constructor(
    dockerfileDocument: DockerfileDocument,
    options = { warningImageOlderThanNumberOfDays: 60 }
  ) {
    this.dockerfileDocument = dockerfileDocument;
    this.warningImageOlderThanNumberOfDays =
      options.warningImageOlderThanNumberOfDays ?? 60;
  }

  validateMaintainer(): Diagnostic[] {
    const instructions = this.dockerfileDocument.dockerfile.getInstructions();
    const textDocument = this.dockerfileDocument.textDocument;
    const diagnostics: Diagnostic[] = [];

    const fromInstructions = this.dockerfileDocument.dockerfile.getFROMs();

    const maintainerFound: Map<From, Instruction | null> = new Map<
      From,
      Instruction | null
    >(fromInstructions.map((from) => [from, null]));
    for (const instruction of instructions) {
      const instructionArguments = instruction.getArgumentsContent();
      if (
        (instruction.getKeyword() == "LABEL" &&
          instructionArguments != null &&
          instructionArguments.startsWith("maintainer=")) ||
        instruction.getKeyword() == "MAINTAINER"
      ) {
        let foundKey = null;
        for (const key of maintainerFound.keys()) {
          if (key.getRange().start.line < instruction.getRange().start.line) {
            foundKey = key;
          }
        }
        if (foundKey != null) {
          maintainerFound.set(foundKey, instruction);
        }
      }
    }

    for (const [fromInstruction, instruction] of maintainerFound) {
      let maintainerFound = null;
      let maintainerLabelFound = null;
      if (instruction != null) {
        if (instruction.getKeyword() == "MAINTAINER") {
          maintainerFound = instruction;
        } else {
          maintainerLabelFound = instruction;
        }
      }

      if (maintainerFound) {
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: maintainerFound.getRange().start,
            end: maintainerFound.getRange().end,
          },
          message: `MAINTAINER is deprecated use - LABEL maintainer="NAME <E-MAIL>" - instead`,
          source: DiagnosticSource,
        };
        diagnostics.push(diagnostic);
      }

      if (!maintainerLabelFound) {
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: fromInstruction.getRange(),
          message: `To support maintanence of the image add the maintainer information as a label`,
          source: DiagnosticSource,
          relatedInformation: [
            // LABEL maintainer="NGINX Docker Maintainers <docker-maint@nginx.com>"
            {
              location: {
                uri: textDocument.uri,
                range: Object.assign(
                  {},
                  fromInstruction.getRange(),
                ),
              },
              message: 'Usage LABEL maintainer="NAME <E-MAIL>"',
            },
          ],
        };
        diagnostics.push(diagnostic);
      }
    }
    return diagnostics;
  }

  private getHigherSimilarVersions(fromData: FromMetadata, count = 10) {
    if (
      fromData &&
      fromData.currentTag !== null &&
      fromData.availableTags.length > 0
    ) {
      const currentTag = fromData.currentTag;
      if (count > fromData.availableTags.length) {
        count = fromData.availableTags.length;
      }
      return fromData.availableTags
        .filter((availableTag) => {
          if (
            !(
              availableTag.numbersInName.length ===
              currentTag.numbersInName.length
            )
          ) {
            return false;
          }
          let isHigher = false;
          const higherVersion = availableTag.numbersInName.every(
            (numb, index) => {
              isHigher =
                isHigher ||
                numb.number > currentTag.numbersInName[index].number;
              return numb.number >= currentTag.numbersInName[index].number;
            }
          );
          return higherVersion && isHigher;
        })
        .sort((a, b) => b.similarityToCurrent - a.similarityToCurrent)
        .slice(0, count - 1);
    }
    return [];
  }

  async validateFromVersions() {
    const fromKeywords = this.dockerfileDocument.dockerfile.getFROMs();
    const textDocument = this.dockerfileDocument.textDocument;
    const diagnostics: Diagnostic[] = [];

    for (const fromKeyword of fromKeywords) {
      const imageName = fromKeyword.getImageName();
      const imageTag = fromKeyword.getImageTag();
      const imageNameRange =
        fromKeyword.getImageNameRange() ?? fromKeyword.getRange();
      const imageTagRange =
        fromKeyword.getImageTagRange() ?? fromKeyword.getRange();
      const fromData = this.dockerfileDocument.fromData.get(
        fromKeyword.getTextContent()
      );
      // TODO get FROM image OS infos
      // Cache document infos

      validateNoImageVersions(diagnostics, imageName, imageTag, imageNameRange);
      if (imageName != null && imageTag !== null) {
        const imageTagData = fromData?.currentTag;
        if (imageTagData) {
          const higherVersions = this.getHigherSimilarVersions(fromData);
          validateImageTag(
            diagnostics,
            imageName,
            imageTag,
            imageTagRange,
            textDocument,
            imageTagData,
            higherVersions,
            this.warningImageOlderThanNumberOfDays
          );
        }
        if (imageTag) {
          validateLatestImageVersions(
            diagnostics,
            imageName,
            imageTag,
            imageNameRange,
            imageTagRange,
            textDocument
          );
        }
        if (fromData) {
          validateSmallerImageVersions(diagnostics, fromData, imageTagRange);
        }
      }
    }
    return diagnostics;
  }

  // COPY ./requirements.txt /tmp/requirements.txt

  async validateCopyRun(): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    const copyCommands = this.dockerfileDocument.dockerfile.getCOPYs();
    for (const copyCommand of copyCommands) {
      const argu: Argument[] = copyCommand.getArguments();
      if (argu.length == 2) {
        const dest = argu[1].getValue().split("/");
        const src = argu[0].getValue().split("/");
        const destFile = dest.at(dest.length - 1);
        const srcFile = src.at(src.length - 1);
        let copiedFile = "";
        if (destFile && destFile != "" && destFile != ".") {
          copiedFile = destFile;
        } else if (srcFile && srcFile != "") {
          copiedFile = srcFile;
        }
        if (copiedFile == "") {
          continue;
        }
        for (const shellArgumentParsing of this.dockerfileDocument
          .shellArgumentParsings) {
          if (
            shellArgumentParsing.runInstructionTextContent.includes(
              copiedFile
            ) &&
            copyCommand.getRange().end <
              shellArgumentParsing.runInstruction.getRange().start
          ) {
            const diagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Warning,
              range: {
                start: shellArgumentParsing.runInstruction.getRange().start,
                end: shellArgumentParsing.runInstruction.getRange().end,
              },
              message: `This RUN instruction contains a file from a COPY command, if you only need the file once mount the file instead: 'RUN --mount=type=bind,source=${argu[0]},target=${argu[1]}'`,
              source: DiagnosticSource,
              relatedInformation: [
                {
                  location: {
                    uri: this.dockerfileDocument.textDocument.uri,
                    range: Object.assign({}, copyCommand.getRange()),
                  },
                  message: "This COPY instruction can be removed afterwards",
                },
              ],
            };
            diagnostics.push(diagnostic);
          }
        }
      }
    }
    return diagnostics;
  }

  async validateAddInsteadOfCopy(): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    for (const copyInstruction of this.dockerfileDocument.dockerfile.getCOPYs()) {
      const argu = copyInstruction.getArguments();
      if (argu) {
        const dest = argu[1].getValue().split("/");
        const src = argu[0].getValue().split("/");
        const destFile = dest.at(dest.length - 1);
        const srcFile = src.at(src.length - 1);
        let copiedFile = "";
        if (destFile && destFile != "") {
          copiedFile = destFile;
        } else if (srcFile && srcFile != "") {
          copiedFile = srcFile;
        }
        if (copiedFile == "") {
          continue;
        }

        const copiedFileLowerCase = copiedFile.toLowerCase();
        if (
          copiedFileLowerCase.includes(".gz") ||
          copiedFileLowerCase.includes(".bz2") ||
          copiedFileLowerCase.includes(".xz") ||
          copiedFileLowerCase.includes(".tar")
        ) {
          const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Information,
            range: {
              start: copyInstruction.getRange().start,
              end: copyInstruction.getRange().end,
            },
            message: `ADD can be used instead, since it copies and extracts the file for later use`,
            source: DiagnosticSource,
          };
          diagnostics.push(diagnostic);
        }
      }
    }
    return diagnostics;
  }

  // COPY instead of ADD
  async validateCopyInsteadOfAdd(): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    for (const instruction of this.dockerfileDocument.dockerfile.getInstructions()) {
      if (instruction.getKeyword() == "ADD") {
        const argu = instruction.getArguments();
        if (argu) {
          const dest = argu[1].getValue().split("/");
          const src = argu[0].getValue().split("/");
          const destFile = dest.at(dest.length - 1);
          const srcFile = src.at(src.length - 1);
          let copiedFile = "";
          if (destFile && destFile != "") {
            copiedFile = destFile;
          } else if (srcFile && srcFile != "") {
            copiedFile = srcFile;
          }
          if (copiedFile == "") {
            continue;
          }
          // TODO fix
          const copiedFileLowerCase = copiedFile.toLowerCase();
          if (
            !(
              copiedFileLowerCase.includes(".gz") ||
              copiedFileLowerCase.includes(".bz2") ||
              copiedFileLowerCase.includes(".xz") ||
              copiedFileLowerCase.includes(".tar")
            ) &&
            !isValidUrl(copiedFileLowerCase)
          ) {
            const diagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Warning,
              range: {
                start: instruction.getRange().start,
                end: instruction.getRange().end,
              },
              message: `COPY should be used instead since it only copies the file - ADD could also extract the file`,
              source: DiagnosticSource,
            };
            diagnostics.push(diagnostic);
          }
        }
      }
    }
    return diagnostics;
  }

  async validateRUNs(): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const workDirCmds: ShellCommand[][] = [];
    let workDirCmd: ShellCommand[] = [];
    const combineRuns: ShellArgumentParsing[][] = [];
    const couldCombineRuns: ShellArgumentParsing[] = [];
    let currentShellCommandNumber = 0;
    this.dockerfileDocument.shellArgumentParsings.forEach(
      (shellCommandLine) => {
        currentShellCommandNumber++;
        if (
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.UPDATE_PACKAGE_LIST
          ) ||
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.INSTALL_PACKAGE
          ) ||
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.PERFORM_WORK
          )
        ) {
          couldCombineRuns.push(shellCommandLine);
        }
        if (
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.INSTALL_PACKAGE
          )
        ) {
          for (const cmd of shellCommandLine.commands) {
            if (cmd.options.includes(ShellCommandOption.INSTALL_PACKAGE)) {
              for (const packageTmp of cmd.packages) {
                if (packageTmp.version === "") {
                  diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: {
                      start: packageTmp.range.start,
                      end: packageTmp.range.end,
                    },
                    message: `This a package has no version specified, use '${packageTmp.name}=version' - a specific version helps with caching errors and build stability`,
                    source: DiagnosticSource,
                    relatedInformation: [
                      {
                        location: {
                          uri: this.dockerfileDocument.textDocument.uri,
                          range: {
                            start: packageTmp.range.start,
                            end: packageTmp.range.end,
                          },
                        },
                        message: `
                    To find out the package versions of your dependencies - Add a RUN command at the end of your dockerfile with a command which displays the package versions.
                    
                    example apt-package manager
                      RUN apt-get update --fix-missing -y && \
                      apt-get install -y --no-install-recommends aptitude
                      RUN \
                          aptitude versions <package> && \
                          aptitude versions <package>
                    
                    example apk-package manager
                      RUN apk list <package> && \
                          apk list <package>
                    
                    `,
                      },
                    ],
                  });
                }
              }
              const missingFlags = cmd.packageManager?.installFlags.filter(
                (flag) => {
                  if (
                    flag.flagOptions.some((flagOpt) =>
                      cmd.flags.includes(flagOpt)
                    )
                  ) {
                    return false;
                  }
                  return true;
                }
              );
              if (missingFlags && missingFlags.length > 0) {
                diagnostics.push({
                  severity: DiagnosticSeverity.Warning,
                  range: {
                    start: cmd.range.start,
                    end: cmd.range.end,
                  },
                  message: `There some flags which are recommended for installing packages: ${missingFlags
                    .map((mf) => mf.flagOptions[0])
                    .join(" ")}`,
                  source: DiagnosticSource,
                });
              }
            }
          }
        }
        if (
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.CREATE_DIRECTORY
          ) ||
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.CREATE_DIRECTORY
          )
        ) {
          shellCommandLine.commands.forEach((cmd) => {
            if (
              cmd.options.includes(ShellCommandOption.CHANGE_DIRECTORY) &&
              cmd.options.includes(ShellCommandOption.CREATE_DIRECTORY)
            ) {
              workDirCmd.push(cmd);
            } else {
              if (workDirCmd.length > 0) {
                diagnostics.push({
                  severity: DiagnosticSeverity.Warning,
                  range: {
                    start: workDirCmd[0].range.start,
                    end: workDirCmd[workDirCmd.length - 1].range.end,
                  },
                  message: `Changing and creating directories can be replaced with WORKDIR path`,
                  source: DiagnosticSource,
                  relatedInformation: [],
                });
                workDirCmds.push(workDirCmd);
              }
              workDirCmd = [];
            }
          });
        }
        if (
          shellCommandLine.diagnostics.includes(
            ShellCommandDiagnostics.NO_PACKAGE_LIST_CLEANUP
          )
        ) {
          const packageManagers = new Map<
            string,
            {
              packageManager: ShellPackageManager;
              workPackage: boolean;
              installPackage: boolean;
              updatePackage: boolean;
              cleanupPackage: boolean;
            }
          >();
          shellCommandLine.commands.forEach((cmd) => {
            if (cmd.packageManager == null) {
              return;
            }
            if (!packageManagers.has(cmd.packageManager!.type)) {
              packageManagers.set(cmd.packageManager!.type, {
                packageManager: cmd.packageManager!,
                installPackage: false,
                workPackage: false,
                updatePackage: false,
                cleanupPackage: false,
              });
            }
            const packageManagerObject = packageManagers.get(
              cmd.packageManager!.type
            );
            if (cmd.options.includes(ShellCommandOption.UPDATE_PACKAGE_LIST)) {
              packageManagerObject!.updatePackage = true;
            }
            if (cmd.options.includes(ShellCommandOption.INSTALL_PACKAGE)) {
              packageManagerObject!.installPackage = true;
            }
            if (cmd.options.includes(ShellCommandOption.PERFORM_WORK)) {
              packageManagerObject!.workPackage = true;
            }
            if (cmd.options.includes(ShellCommandOption.CLEANUP_COMMAND)) {
              packageManagerObject!.cleanupPackage = true;
            }
          });
          packageManagers.forEach((pm) => {
            if (
              (pm.updatePackage || pm.installPackage || pm.workPackage) &&
              !pm.cleanupPackage
            ) {
              // Non-removal of temporary files
              diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                  start: shellCommandLine.runInstruction.getRange().start,
                  end: shellCommandLine.runInstruction.getRange().end,
                },
                message: `Remove the temporary files to reduce image size`,
                source: DiagnosticSource,
                relatedInformation: [
                  {
                    location: {
                      uri: this.dockerfileDocument.textDocument.uri,
                      range: Object.assign(
                        {},
                        shellCommandLine.runInstruction.getRange()
                      ),
                    },
                    message: `Commands for cleanup could be ${pm.packageManager.cleanupCommands
                      .map((cmd) => cmd.join(" "))
                      .join(", ")}`,
                  },
                ],
              });
            }
          });
        }
        // maybe add check if FROM is passed
        if (couldCombineRuns.length > 1) {
          const packageManagerPerRuns = couldCombineRuns.map((ccr) =>
            ccr.commands.map((cmd) => cmd.packageManager ?? null)
          );
          for (let index = 0; index < packageManagerPerRuns.length; index++) {
            const couldCouldCombineRuns = [couldCombineRuns[index]];
            const packageManagersFirst = packageManagerPerRuns[index].map(
              (pm) => pm?.type
            );
            for (
              let nextIndex = index + 1;
              nextIndex < packageManagerPerRuns.length;
              nextIndex++
            ) {
              const element = packageManagerPerRuns[nextIndex];
              if (
                element.some(
                  (pm) =>
                    pm !== null &&
                    pm !== undefined &&
                    pm.type !== null &&
                    pm.type !== undefined &&
                    packageManagersFirst.includes(pm.type)
                )
              ) {
                couldCouldCombineRuns.push(couldCombineRuns[nextIndex]);
              }
            }

            if (
              couldCouldCombineRuns.length > 1 &&
              !combineRuns.some((combineRun) => {
                return (
                  combineRun.length == couldCouldCombineRuns.length &&
                  combineRun.every(function (element, index) {
                    return element === couldCouldCombineRuns[index];
                  })
                );
              })
            ) {
              combineRuns.push(couldCouldCombineRuns);
            }
          }
          //couldCombineRuns = [];
        }

        if (
          shellCommandLine.commands.some(
            (cmd) => cmd.seperation == ShellCommandSeperationSymbols.PIPE
          ) &&
          !shellCommandLine.argumentContent.includes("set -o pipefail")
        ) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: shellCommandLine.runInstruction.getRange().start,
              end: shellCommandLine.runInstruction.getRange().end,
            },
            message: `This RUN instruction uses a pipe to connect two commands, to make sure the command fails add - 'set -o pipefail && ' to the beginning`,
            source: DiagnosticSource,
            relatedInformation: [],
          });
        }

        if (
          shellCommandLine.overallOptions.includes(
            ShellCommandOption.UNPACK_ARCHIVE
          )
        ) {
          shellCommandLine.commands.forEach((cmd) => {
            if (cmd.options.includes(ShellCommandOption.UNPACK_ARCHIVE)) {
              diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: {
                  start: cmd.range.start,
                  end: cmd.range.end,
                },
                message: `If you are unpacking an archive and no longer need it, add, unpack and remove it in the same RUN command to reduce image size`,
                source: DiagnosticSource,
                relatedInformation: [],
              });
            }
          });
        }
      }
    );
    // Merging RUN Layers
    combineRuns.forEach((combineRun) => {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: combineRun[0].runInstruction.getRange().start,
          end: combineRun[0].runInstruction.getRange().end,
        },
        message: `RUNs both include work or update or install statements, these should be combinied into one RUN statement, to make sure there are no unnecessary layers`,
        source: DiagnosticSource,
        relatedInformation: combineRun.map((shellCmd) => {
          return {
            location: {
              uri: this.dockerfileDocument.textDocument.uri,
              range: Object.assign({}, shellCmd.runInstruction.getRange()),
            },
            message: `Part of the RUN could be combined`,
          };
        }),
      });
    });
    return diagnostics;
  }

  // is semantic versioning used - higher minor, path version
  // what os is being used - what package manager

  // maintainer good for maintainance - LABEL maintainer="NGINX Docker Maintainers <docker-maint@nginx.com>"
}

const isValidUrl = (urlString: string) => {
  try {
    return Boolean(new URL(urlString));
  } catch {
    return false;
  }
};

export function getValidators(
  dockerfileDocument: DockerfileDocument,
  options = { warningImageOlderThanNumberOfDays: 60 }
): DockerfileValidations {
  return new DockerfileValidations(dockerfileDocument, options);
}
