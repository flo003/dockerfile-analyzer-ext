import { ImageTagMetadata } from "./imageTagMetadata";

export interface ImageTagService {
  checkImageTagsByName(
    imageName: string,
    tagLastPushed: string,
    currentTag: ImageTagMetadata | null
  ): Promise<ImageTagMetadata[]>;

  checkImageTag(
    imageName: string,
    imageTag: string
  ): Promise<ImageTagMetadata | null>;

  checkImageTags(
    imageName: string,
    currentTag: ImageTagMetadata | null
  ): Promise<ImageTagMetadata[]>;
}
