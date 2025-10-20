import { stringSimilarity } from '../validation/utils';

export class ImageTagMetadata {
  name: string;
  size: number;
  tagStatus: string;
  tagLastPushed: Date;
  numbersInName: { number:string, start:number, end:number, splitNumber:number[] }[] = [];
  nameWithoutNumbers: string;
  similarityToCurrent: number;
  similarityWithoutNumberToCurrent: number;

  constructor(name: string, size: number, tagStatus: string,
	tagLastPushed: Date, currentImageTag: ImageTagMetadata|null = null) {
    this.name = name;
	this.nameWithoutNumbers = name;
	this.size = size;
	this.tagStatus = tagStatus;
	this.tagLastPushed = tagLastPushed;
	this.parseImageName(name);
	this.similarityToCurrent = 0;
	this.similarityWithoutNumberToCurrent = 0;
	if (currentImageTag) {
		this.similarityToCurrent = stringSimilarity(currentImageTag.name, this.name);
		this.similarityWithoutNumberToCurrent = stringSimilarity(currentImageTag.nameWithoutNumbers, this.nameWithoutNumbers);
	}
  }

  private parseImageName(name:string) {
	let foundNumbers = false;
	const numbers = [];
	let currentNumber = '';
	let currentNumberStartIndex = -1;
	let currentNumberEndIndex = -1;
	let nameWithoutNumbersTmp = '';
	for (let index = 0; index < name.length; index++) {
		const char = name[index];
		if (
			char === '0' ||
			char === '1' ||
			char === '2' ||
			char === '3' ||
			char === '4' ||
			char === '5' ||
			char === '6' ||
			char === '7' ||
			char === '8' ||
			char === '9'
		) {
			currentNumber += char;
			if (!foundNumbers) {
				foundNumbers = true;
				currentNumberStartIndex = index;
			}
		} else if (foundNumbers && char === '.') {
			currentNumber += char;
		} else if (foundNumbers) {
			foundNumbers = false;
			currentNumberEndIndex = index;
			numbers.push({
				number: currentNumber,
				start: currentNumberStartIndex,
				end: currentNumberEndIndex,
				splitNumber: []
			});
			nameWithoutNumbersTmp += char;
		} else {
			nameWithoutNumbersTmp += char;
		}
	}
	if (foundNumbers) {
		currentNumberEndIndex = name.length - 1;
		numbers.push({
			number: currentNumber,
			start: currentNumberStartIndex,
			end: currentNumberEndIndex,
			splitNumber: []
		});
	}
	this.numbersInName = numbers;
	this.nameWithoutNumbers = nameWithoutNumbersTmp;

	this.numbersInName.forEach(numb => {
		if (numb.number.includes('.')) {
			const splits = numb.number.split('.');
			numb.splitNumber = splits.map(s => Number.parseInt(s));
		}
	});
  }

  public compareSplitNumbersIsEqualOrLessThan(imageTagMetadata: ImageTagMetadata) {
	if (this.numbersInName && imageTagMetadata.numbersInName) {
		if (this.numbersInName.length == imageTagMetadata.numbersInName.length) {
			let allEqual = this.numbersInName.length;
			let index = 0;
			for (const numb of this.numbersInName) {
				if (numb < imageTagMetadata.numbersInName[index]) {
					return true;
				} else if (numb == imageTagMetadata.numbersInName[index]) {
					allEqual--;
				}
				index++;
			}
			return allEqual == 0;
		}
	}
	return false;
  } 
}
