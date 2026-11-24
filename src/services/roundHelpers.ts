import type {
    EditorQuestion,
    QuestionType
} from "../models/Question";

export type RoundKind =
    | "empty"
    | "normal"
    | "nearest"
    | "mixed";

type NormalQuestionType = Exclude<QuestionType, "nearest">;

export type AnswerTypeLock =
    | NormalQuestionType
    | "mixed"
    | null;

export const hasEnteredAnswer = (
    question: EditorQuestion
): boolean => {
    switch (question.type) {
        case "standard":
            return Boolean(
                question.answer.answerText.trim() ||
                question.answer.shortAnswer.trim()
            );

        case "multi":
            return question.answers.answerOptions.some(
                option => option.optionText.trim() !== ""
            );

        case "sequence":
            return question.answer.optionsInOrder.some(
                option => option.trim() !== ""
            );

        case "numerical":
        case "nearest":
            return question.answer.value != null;
    }
};

export const getRoundKind = (
    questions: readonly EditorQuestion[]
): RoundKind => {
    if (questions.length === 0) {
        return "empty";
    }

    const isNearestRound =
        questions[0]!.type === "nearest";

    for (let index = 1; index < questions.length; index++) {
        if (
            (questions[index]!.type === "nearest") !==
            isNearestRound
        ) {
            return "mixed";
        }
    }

    return isNearestRound ? "nearest" : "normal";
};

export const canUseQuestionType = (
    roundKind: RoundKind,
    questionType: QuestionType
): boolean => {
    switch (roundKind) {
        case "empty":
            return true;

        case "normal":
            return questionType !== "nearest";

        case "nearest":
            return questionType === "nearest";

        case "mixed":
        default:
            return false;
    }
};