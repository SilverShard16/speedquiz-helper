import type { Question, StandardQuestion } from '../models/Question';

export function getShortAnswer(answerText: string): string {
    let startsWithSkippedWord = answerText.indexOf("The ") === 0 || answerText.indexOf("A ") === 0;

    if(startsWithSkippedWord) {
        const firstSpaceIndex = answerText.indexOf(' ');
        return answerText.substring(firstSpaceIndex + 1).trim().substring(0, 1);
    }

    return answerText.substring(0, 1);
}

export function convertQuestionsToLastLetter(questions: StandardQuestion[]): StandardQuestion[] {
    let newQuestions: StandardQuestion[] = [];

    questions.forEach((question) => {
        newQuestions.push({
            type: "standard",
            questionInfo: question.questionInfo,
            answer: {
                answerText: question.answer.answerText,
                shortAnswer: question.answer.answerText.trim().substring(question.answer.answerText.length - 1).toUpperCase()
            }
        });
    });

    return newQuestions;
}