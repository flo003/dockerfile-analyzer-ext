import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { FromMetadata } from "../document/fromMetadata";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ImageTagMetadata } from "../document/imageTagMetadata";
import { DiagnosticSource } from './definitions';

export function validateSmallerImageVersions(
  diagnostics: Diagnostic[],
  fromData: FromMetadata,
  imageTagRange: Range,
) {
  if (
    fromData &&
    fromData.currentTag !== null &&
    fromData.availableTags.length > 0
  ) {
    const currentTag = fromData.currentTag;
    const similarSmaller = fromData.availableTags
      .filter((s) => s.size < currentTag.size)
      .filter((sTag) => currentTag.compareSplitNumbersIsEqualOrLessThan(sTag))
      //.filter((sTag) => sTag.size < currentTag.size && ((currentTag.size / sTag.size) - 1) > 0.2)
      .sort((a, b) => b.similarityToCurrent - a.similarityToCurrent);
    if (similarSmaller.length > 0) {
      let similarSmallerTopTenCount = 10;
      if (similarSmaller.length < similarSmallerTopTenCount) {
        similarSmallerTopTenCount = similarSmaller.length;
      }
      const similarSmallerTopTen = similarSmaller
        .slice(0, similarSmallerTopTenCount)
        .map((s) => s.name);
      diagnostics.push({
        severity: DiagnosticSeverity.Information,
        range: {
          start: imageTagRange.start,
          end: imageTagRange.end,
        },
        
        message:
          `There are base image tags with smaller sizes: ` +
          similarSmallerTopTen.join(", "),
        source: DiagnosticSource,
      });
    }
  }
}

export function validateLatestImageVersions(
  diagnostics: Diagnostic[],
  imageName: string,
  imageTag: string,
  imageNameRange: Range,
  imageTagRange: Range,
  textDocument: TextDocument
) {
  // Latest Image Version
  if (imageTag == "latest") {
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range: {
        start: imageNameRange.start,
        end: imageTagRange.end,
      },
      message: `${imageName} should use an exact tag rather than 'latest'`,
      source: DiagnosticSource,
      relatedInformation: [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, imageNameRange),
          },
          message:
            "An exact tag helps with ensuring build failures caused by version changes",
        },
      ],
    });
  }
}

export function validateNoImageVersions(
  diagnostics: Diagnostic[],
  imageName: string | null,
  imageTag: string | null,
  imageNameRange: Range
) {
  if (imageName != null) {
    if (imageTag == null) {
      // No Image Version
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: imageNameRange.start,
          end: imageNameRange.end,
        },
        message: `${imageName} has no exact tag declared`,
        source: DiagnosticSource,
      });
    }
  }
}

export function validateImageTag(
  diagnostics: Diagnostic[],
  imageName: string | null,
  imageTag: string | null,
  imageTagRange: Range,
  textDocument: TextDocument,
  imageTagData: ImageTagMetadata,
  higherVersions: ImageTagMetadata[],
  warningImageOlderThanNumberOfDays: number
) {
  if (imageTagData.tagStatus == "active") {
    const dateTagLastPushed = imageTagData.tagLastPushed;
    const dateNow = new Date();
    const diffMs = dateNow.getTime() - dateTagLastPushed.getTime(); // milliseconds
    const diffDays = Math.floor(diffMs / 86400000); // days
    // Outdated image version
    if (diffDays > warningImageOlderThanNumberOfDays) {
      const relatedInformations = [];
      if (higherVersions.length > 0) {
        relatedInformations.push({
          location: {
            uri: textDocument.uri,
            range: imageTagRange,
          },
          message:
            "Newer tags that could be used: " +
            higherVersions
              .map((higherVersion) => higherVersion.name)
              .join(", "),
        });
      }
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: imageTagRange.start,
          end: imageTagRange.end,
        },
        message: `${imageName}:${imageTag} was updated more than ${diffDays} days ago`,
        source: DiagnosticSource,
        relatedInformation: relatedInformations,
      };
      diagnostics.push(diagnostic);
    }
  } else if (imageTagData.tagStatus == "inactive") {
    const relatedInformations = [];
    if (higherVersions.length > 0) {
      relatedInformations.push({
        location: {
          uri: textDocument.uri,
          range: imageTagRange,
        },
        message:
          "Newer tags that could be used: " +
          higherVersions.map((higherVersion) => higherVersion.name).join(", "),
      });
    }
    diagnostics.push({
      severity: DiagnosticSeverity.Information,
      range: {
        start: imageTagRange.start,
        end: imageTagRange.end,
      },
      message: `${imageName}:${imageTag} is inactive, change to a newer tag`,
      source: DiagnosticSource,
      relatedInformation: relatedInformations,
    });
  }
}
