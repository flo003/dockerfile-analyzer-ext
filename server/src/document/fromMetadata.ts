import { From } from 'dockerfile-ast';
import { ImageTagMetadata } from './imageTagMetadata';

export class FromMetadata {
  currentTag: ImageTagMetadata | null;
  availableTags: ImageTagMetadata[];
  fromData: From;
  constructor(fromData: From, currentTag: ImageTagMetadata|null, availableTags: ImageTagMetadata[] = []) {
	this.fromData = fromData;
	this.availableTags = availableTags;
	this.currentTag = currentTag;
  }
}