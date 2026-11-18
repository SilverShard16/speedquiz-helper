import type { Answer } from '../models/Answer';

export function getShortAnswer(answerText: string): string {
    let startsWithSkippedWord = answerText.indexOf("The ") === 0 || answerText.indexOf("A ") === 0;

    if(startsWithSkippedWord) {
        const firstSpaceIndex = answerText.indexOf(' ');
        return answerText.substring(firstSpaceIndex + 1).trim().substring(0, 1);
    }

    return answerText.substring(0, 1);
}

// export function safeMergeAnswers(existingAnswers: Answer[], newAnswers: string[]): Answer[] {
//     let mergedAnswers = [];

// }

// function getIterationOfAnswer(answerText: string): number {

// }