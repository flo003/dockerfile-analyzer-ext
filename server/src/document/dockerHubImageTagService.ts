import axios from "axios";
import { ImageTagMetadata } from "./imageTagMetadata";
import { ImageTagService } from "./imageTagService";

export class DockerHubImageTagService implements ImageTagService {
  public async checkImageTagsByName(
    imageName: string,
    tagLastPushed = "",
    currentTag: ImageTagMetadata | null = null
  ): Promise<ImageTagMetadata[]> {
    const pageCount = 5;
    let imageDataArray: ImageTagMetadata[] = [];
    for (let i = 0; i < pageCount; i++) {
      const imageData = await this.getImageTags(
        imageName,
        i,
        tagLastPushed,
        currentTag
      );
      if (imageData.length <= 0) {
        break;
      }
      imageDataArray = imageDataArray.concat(imageData);
    }
    return imageDataArray;
  }

  private async getImageTags(
    imageName: string,
    pageNr = 1,
    tagLastPushed = "",
    currentTag: ImageTagMetadata | null = null
  ): Promise<ImageTagMetadata[]> {
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
          const imageTags: ImageTagMetadata[] = [];
          const tagsData = result.data.results;
          if (tagsData) {
            for (const tagDat of tagsData) {
              imageTags.push(
                new ImageTagMetadata(tagDat.name, tagDat.full_size, tagDat.tag_status, new Date(tagDat.tag_last_pushed), currentTag)
              );
            }
            return imageTags;
          }
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
          const imageTags: ImageTagMetadata[] = [];
          const tagsData = result.data.results;
          if (tagsData) {
            for (const tagDat of tagsData) {
              imageTags.push(
                new ImageTagMetadata(tagDat.name, tagDat.full_size, tagDat.tag_status, new Date(tagDat.tag_last_pushed), currentTag)
              );
            }
            return imageTags;
          }
        }
      } catch (exc) {
        console.error(exc);
      }
    }
    return [];
  }

  public async checkImageTag(
    imageName: string,
    imageTag: string
  ): Promise<ImageTagMetadata | null> {
    const imageNames = imageName.split("/");
    let namespace = "";
    let repository = "";
    if (imageNames.length == 1) {
      namespace = "library";
      repository = imageNames[0];
    } else if (imageNames.length == 2) {
      namespace = imageNames[0];
      repository = imageNames[1];
    }
    const url = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags/${imageTag}`;
    try {
      const result = await axios.get(url);
      if (result.status == 200) {
        const tagData = result.data;
        if (tagData) {
          return new ImageTagMetadata(tagData.name, tagData.full_size, tagData.tag_status, new Date(tagData.tag_last_pushed));
        }
      }
    } catch (exc) {
      console.error(exc);
    }
    return null;
  }

  public async checkImageTags(
    imageName: string,
    currentTag: ImageTagMetadata | null = null
  ): Promise<ImageTagMetadata[]> {
    const imageNames = imageName.split("/");
    let namespace = "";
    let repository = "";
    if (imageNames.length == 1) {
      namespace = "library";
      repository = imageNames[0];
    } else if (imageNames.length == 2) {
      namespace = imageNames[0];
      repository = imageNames[1];
    }
    const url = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=100`;
    try {
      const result = await axios.get(url);
      if (result.status == 200) {
        const imageTags: ImageTagMetadata[] = [];
        const tagsData = result.data.results;
        if (tagsData) {
          for (const tagDat of tagsData) {
            imageTags.push(
              new ImageTagMetadata(tagDat.name, tagDat.full_size, tagDat.tag_status, new Date(tagDat.tag_last_pushed), currentTag)
            );
          }
          return imageTags;
        }
      }
    } catch (exc) {
      console.error(exc);
    }
    return [];
  }
}
