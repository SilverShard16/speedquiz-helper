import type { EditorQuestion, QuestionType } from "../models/Question";

export type RoundKind =
    | "empty"
    | "normal"
    | "nearest"
    | "mixed";

export const getRoundKind = (
    questions: readonly EditorQuestion[]
): RoundKind => {
    if (questions.length === 0) {
        return "empty";
    }

    const hasNearest = questions.some(
        question => question.type === "nearest"
    );

    const hasNormal = questions.some(
        question => question.type !== "nearest"
    );

    if (hasNearest && hasNormal) {
        return "mixed";
    }

    return hasNearest ? "nearest" : "normal";
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
            return false;
    }
};
