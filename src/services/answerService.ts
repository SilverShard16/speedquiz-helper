
import type { StandardQuestion } from '../models/Question';

export function getShortAnswer(answerText: string): string {
    if (
        answerText.startsWith('The ') ||
        answerText.startsWith('A ')
    ) {
        return answerText
            .slice(answerText.indexOf(' ') + 1)
            .trim()
            .charAt(0);
    }

    return answerText.charAt(0);
}

export function convertQuestionsToLastLetter(
    questions: StandardQuestion[]
): StandardQuestion[] {
    return questions.map(({ questionInfo, answer }) => ({
        type: 'standard',
        questionInfo,
        answer: {
            answerText: answer.answerText,
            shortAnswer: answer.answerText
                .trim()
                .slice(-1)
                .toUpperCase()
        }
    }));
}
