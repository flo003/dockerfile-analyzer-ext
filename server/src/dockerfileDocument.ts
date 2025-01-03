import { DockerfileParser, Dockerfile, From } from "dockerfile-ast";
import { TextDocument } from "vscode-languageserver-textdocument";

import axios from "axios";

export class DockerfileDocuments {
  textDocuments: Map<string, DockerfileDocument> = new Map<
    string,
    DockerfileDocument
  >();
  async getDocument(textDocument: TextDocument): Promise<DockerfileDocument> {
    let document = this.textDocuments.get(textDocument.uri);
    if (document === undefined) {
      const text = textDocument.getText();
      const dockerfile = DockerfileParser.parse(text);
      document = {
        version: textDocument.version,
        textDocument: textDocument,
        dockerfile: dockerfile,
        fromData: new Map<string, { tagsData: any; fromData: From }>(),
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
    const oldFromKeywordsTextContent = dockerfileDocument.dockerfile
      .getFROMs()
      .map((keyword) => keyword.getTextContent());
    for (const fromKeyword of fromKeywords) {
      const imageName = fromKeyword.getImageName();
      const imageTag = fromKeyword.getImageTag();
      const textContent = fromKeyword.getTextContent();
      if (
        imageTag != null &&
        imageName != null &&
        !oldFromKeywordsTextContent.includes(textContent)
      ) {
        const imageTagData = await checkImageTag(imageName, imageTag);
        dockerfileDocument.fromData.set(textContent, {
          tagsData: imageTagData,
          fromData: fromKeyword,
        });
      }
    }

    // update to new dockerfile and new version
    dockerfileDocument.dockerfile = newDockerfile;
    dockerfileDocument.version = dockerfileDocument.textDocument.version;
    console.log(dockerfileDocument);
  }
}

export function getDockerfileDocuments(): DockerfileDocuments {
  return new DockerfileDocuments();
}

export interface DockerfileDocument {
  version: number;
  textDocument: TextDocument;
  dockerfile: Dockerfile;
  fromData: Map<string, { tagsData: any; fromData: From }>;
}

async function checkImageTagsByName(imageName: string): Promise<any[]> {
  const pageCount = 5;
  let imageDataArray: any[] = [];
  for (let i = 0; i < pageCount; i++) {
    const imageData = await getImageTags(imageName, i);
    if (imageData.length <= 0) {
      break;
    }
    imageDataArray = imageDataArray.concat(imageData);
  }
  return imageDataArray;
}

async function getImageTags(
  imageName: string,
  pageNr = 1,
  tagLastPushed = ""
): Promise<any[]> {
  let data = [];

  let params = `?sortBy=tag_last_pushed&page_size=100&sortOrder=descending&page=${pageNr}`;
  if (tagLastPushed != "") {
    // 2024-12-25T06:52:01.315117Z
    const tagLastPushedDates = tagLastPushed.split("T")[0].split("-");
    // parseInt(tagLastPushedDates[1])++;
    params += `&filter=tag_last_pushed sw "${tagLastPushedDates[0]}-${tagLastPushedDates[1]}-"`;
  }

  const imageNames = imageName.split("/");
  if (imageNames.length == 1) {
    const url =
      "https://hub.docker.com/v2/repositories/library/" +
      imageNames[0] +
      "/tags" +
      params;
    try {
      const result = await axios.get(url);
      if (result.status == 200) {
        data = result.data.results;
      }
    } catch (exc) {
      console.error(exc);
    }
  } else if (imageNames.length == 2) {
    const url =
      "https://hub.docker.com/v2/namespaces/" +
      imageNames[0] +
      "/repositories/" +
      imageNames[1] +
      "/tags" +
      params;
    try {
      const result = await axios.get(url);
      if (result.status == 200) {
        data = result.data.results;
      }
    } catch (exc) {
      console.error(exc);
    }
  }
  return data;
}

async function checkImageTag(
  imageName: string,
  imageTag: string
): Promise<any> {
  let data = {};
  const imageNames = imageName.split("/");
  let namespace = "";
  let repository = "";
  if (imageNames.length == 1) {
    namespace = "library";
    repository = imageNames[0];
  } else if (imageNames.length == 2) {
    namespace = imageName[0];
    repository = imageName[1];
  }
  const url = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags/${imageTag}`;
  try {
    const result = await axios.get(url);
    if (result.status == 200) {
      data = result.data;
    }
  } catch (exc) {
    console.error(exc);
  }
  return data;
}
