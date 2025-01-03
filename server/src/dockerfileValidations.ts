import {
  Diagnostic,
  DiagnosticSeverity,
  integer,
} from "vscode-languageserver/node";
import { From, Instruction } from "dockerfile-ast";

import { TextDocument } from "vscode-languageserver-textdocument";
import { DockerfileDocument } from "./dockerfileDocument";

export interface DockerfileValidations {
  validateFromVersions(
    fromKeywords: From[],
    textDocument: TextDocument,
    dockerfileDocument: DockerfileDocument
  ): Promise<Diagnostic[]>;
  validateMaintainer(
    instructions: Instruction[],
    textDocument: TextDocument,
    dockerfileDocument: DockerfileDocument
  ): Diagnostic[];
}

export function getValidators(): DockerfileValidations {
  /*
	const htmlLanguageService = getHTMLLanguageService();
  const cssLanguageService = getCSSLanguageService();

  const documentRegions = getLanguageModelCache<HTMLDocumentRegions>(
    10,
    60,
    (document) => getDocumentRegions(htmlLanguageService, document)
  );

  let modelCaches: LanguageModelCache<unknown>[] = [];
  modelCaches.push(documentRegions);

  let modes = Object.create(null);
  modes["html"] = getHTMLMode(htmlLanguageService);
  modes["css"] = getCSSMode(cssLanguageService, documentRegions);
	*/
  return {
    validateFromVersions,
    validateMaintainer,
  };
}

function validateMaintainer(
  instructions: Instruction[],
  textDocument: TextDocument,
  dockerfileDocument: DockerfileDocument
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let maintainerLabelFound = null;
  let maintainerFound = null;
  for (let i = 0; i < instructions.length; i++) {
    const instructionArguments = instructions[i].getArgumentsContent();
    if (
      instructions[i].getKeyword() == "LABEL" &&
      instructionArguments != null &&
      instructionArguments.startsWith("maintainer=")
    ) {
      maintainerLabelFound = instructions[i];
    }
    if (instructions[i].getKeyword() == "MAINTAINER") {
      maintainerFound = instructions[i];
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
      source: "dockerfiles-analyzer",
    };
    diagnostics.push(diagnostic);
  }

  if (!maintainerLabelFound) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      message: `To support maintanence of the image add the maintainer information as a label`,
      source: "dockerfiles-analyzer",
      relatedInformation: [
        // LABEL maintainer="NGINX Docker Maintainers <docker-maint@nginx.com>"
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign(
              {},
              {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              }
            ),
          },
          message: 'Usage LABEL maintainer="NAME <E-MAIL>"',
        },
      ],
    };
    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

async function validateFromVersions(
  fromKeywords: From[],
  textDocument: TextDocument,
  dockerfileDocument: DockerfileDocument
) {
  const diagnostics: Diagnostic[] = [];

  for (const fromKeyword of fromKeywords) {
    const imageName = fromKeyword.getImageName();
    const imageTag = fromKeyword.getImageTag();
    const imageNameRange =
      fromKeyword.getImageNameRange() ?? fromKeyword.getRange();
    const imageTagRange =
      fromKeyword.getImageTagRange() ?? fromKeyword.getRange();

    // TODO get FROM image OS info
    // Cache document infos

    if (imageTag != null) {
      if (imageName != null) {
        //const imageTags = await checkImageTagsByName(imageName);
        const imageTagData = dockerfileDocument.fromData.get(
          fromKeyword.getTextContent()
        )?.tagsData;
        if (imageTagData && imageTagData.tag_status == "active") {
          /*
          const tagLastPushedDates = imageTagData.tag_last_pushed
            .split("T")[0]
            .split("-");
          */
          const maxDayDifference = 60;
          const dateTagLastPushed = new Date(imageTagData.tag_last_pushed);
          const dateNow = new Date();
          const diffMs = dateTagLastPushed.getTime() - dateNow.getTime(); // milliseconds
          const diffDays = Math.floor(diffMs / 86400000); // days
          if (diffDays > maxDayDifference) {
            const diagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Warning,
              range: {
                start: imageTagRange.start,
                end: imageTagRange.end,
              },
              message: `${imageTagRange} was updated ${diffDays} days ago`,
              source: "dockerfiles-analyzer",
            };
            diagnostics.push(diagnostic);
          }
        }
      }

      if (imageTag == "latest") {
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: imageNameRange.start,
            end: imageNameRange.end,
          },
          message: `${imageName} should use an exact version rather than 'latest'`,
          source: "dockerfiles-analyzer",
          relatedInformation: [
            {
              location: {
                uri: textDocument.uri,
                range: Object.assign({}, imageNameRange),
              },
              message:
                "An exact version helps with ensuring build failures caused by version changes",
            },
          ],
        };
        diagnostics.push(diagnostic);
      }
      // TODO check if tag exists
      continue;
    }

    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: imageNameRange.start,
        end: imageNameRange.end,
      },
      message: `${imageName} has no exact version declared`,
      source: "dockerfiles-analyzer",
    };
    diagnostics.push(diagnostic);
  }
  return diagnostics;
}

// is semantic versioning used - higher minor, path version
// what os is being used - what package manager

// maintainer good for maintainance - LABEL maintainer="NGINX Docker Maintainers <docker-maint@nginx.com>"
