import { DockerfileParser, Dockerfile, Run } from "dockerfile-ast";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
  parseShellArguments,
  ShellArgumentParsing,
} from "./shellArgumentParsing";
import { FromMetadata } from './fromMetadata';
import { ImageTagService } from './imageTagService';

export class DockerfileDocuments {
  textDocuments: Map<string, DockerfileDocument> = new Map<
    string,
    DockerfileDocument
  >();
  imageTagService: ImageTagService;

  constructor(imageTagService: ImageTagService) {
    this.imageTagService = imageTagService;
  }

  async getDocument(textDocument: TextDocument): Promise<DockerfileDocument> {
    let document = this.textDocuments.get(textDocument.uri);
    if (document === undefined) {
      document = {
        version: textDocument.version,
        textDocument: textDocument,
        dockerfile: DockerfileParser.parse(""),
        fromData: new Map<string, FromMetadata>(),
        shellArgumentParsings: [],
      };
      await this.updateDocument(document);
      this.textDocuments.set(textDocument.uri, document);
    }
    if (document.version != textDocument.version) {
      document.textDocument = textDocument;
      await this.updateDocument(document);
    }
    return document;
  }

  async updateDocument(dockerfileDocument: DockerfileDocument) {
    const text = dockerfileDocument.textDocument.getText();
    const newDockerfile = DockerfileParser.parse(text);
    // update FROM keywords data
    const fromKeywords = newDockerfile.getFROMs();
    const oldFromKeywords = dockerfileDocument.fromData;
    for (const fromKeyword of fromKeywords) {
      const imageName = fromKeyword.getImageName();
      const imageTag = fromKeyword.getImageTag();
      const textContent = fromKeyword.getTextContent();
      if (imageName != null && !oldFromKeywords.has(textContent)) {
        let imageTagData = null;
        if (imageTag != null) {
          imageTagData = await this.imageTagService.checkImageTag(imageName, imageTag);
        }
        const imageTagsData = await this.imageTagService.checkImageTags(imageName, imageTagData);
        dockerfileDocument.fromData.set(
          textContent,
          new FromMetadata(fromKeyword, imageTagData, imageTagsData)
        );
      }
    }
    const oldRunInstructionText = dockerfileDocument.shellArgumentParsings.reduce((keyValue, shell) => { keyValue.set(shell.runInstructionTextContent, shell); return keyValue; }, new Map<string, ShellArgumentParsing>());
    const shellCommandLines: ShellArgumentParsing[] =
    newDockerfile
      .getInstructions()
      .filter((instruction) => instruction.getKeyword() == "RUN")
      .map(instruction => instruction as Run)
      .map((runInstruction) => {
        const shell = oldRunInstructionText.get(runInstruction.getTextContent());
        if (shell) {
          return shell;
        }
        return parseShellArguments(runInstruction, dockerfileDocument);
      });
    dockerfileDocument.shellArgumentParsings = shellCommandLines;
    // update to new dockerfile and new version
    dockerfileDocument.dockerfile = newDockerfile;
    dockerfileDocument.version = dockerfileDocument.textDocument.version;
  }
}

export function getDockerfileDocuments(imageTagService: ImageTagService): DockerfileDocuments {
  return new DockerfileDocuments(imageTagService);
}

export interface DockerfileDocument {
  version: number;
  textDocument: TextDocument;
  dockerfile: Dockerfile;
  fromData: Map<string, FromMetadata>;
  shellArgumentParsings: ShellArgumentParsing[];
}
