
export type QuestionType =
    | "standard"
    | "multi"
    | "sequence"
    | "numerical"
    | "nearest";

export interface QuestionInfo {
    id: number;
    userView: string;
    questionText: string;
    pictureBaseString: string;
    pictureFileName?: string;
    info: string;
}

export interface GenericAnswer {
    answerText: string;
    shortAnswer: string;
}

export interface MultipleChoiceAnswer {
    optionText: string;
    correct: boolean;
}

export interface MultipleChoiceAnswers {
    answerOptions: MultipleChoiceAnswer[];
}

export interface SequenceAnswer {
    optionsInOrder: string[];
}

export interface NumericAnswer {
    value: number | null;
}

interface BaseQuestion {
    questionInfo: QuestionInfo;
}

export interface StandardQuestion extends BaseQuestion {
    type: "standard";
    answer: GenericAnswer;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
    type: "multi";
    answers: MultipleChoiceAnswers;
}

export interface SequenceQuestion extends BaseQuestion {
    type: "sequence";
    answer: SequenceAnswer;
}

export interface NumericalQuestion extends BaseQuestion {
    type: "numerical";
    answer: NumericAnswer;
}

export interface NearestGuessQuestion extends BaseQuestion {
    type: "nearest";
    answer: NumericAnswer;
}

export type Question =
    | StandardQuestion
    | MultipleChoiceQuestion
    | SequenceQuestion
    | NumericalQuestion
    | NearestGuessQuestion;

export type EditorQuestion = Question & {
    clientId: string;
};

export interface Round {
    id: string;
    title: string;
    questions: EditorQuestion[];
};


type EditorQuestionOf<T extends QuestionType> =
    Extract<EditorQuestion, { type: T }>;

export function createEmptyQuestion():
    EditorQuestionOf<"standard">;

export function createEmptyQuestion(
    type: "standard"
): EditorQuestionOf<"standard">;

export function createEmptyQuestion(
    type: "multi"
): EditorQuestionOf<"multi">;

export function createEmptyQuestion(
    type: "sequence"
): EditorQuestionOf<"sequence">;

export function createEmptyQuestion(
    type: "numerical"
): EditorQuestionOf<"numerical">;

export function createEmptyQuestion(
    type: "nearest"
): EditorQuestionOf<"nearest">;

export function createEmptyQuestion(
    type: QuestionType
): EditorQuestion;

export function createEmptyQuestion(
    type: QuestionType = "standard"
): EditorQuestion {
    const questionInfo: QuestionInfo = {
        id: 0,
        userView:
            type === "standard" ? "letters" :
            type === "multi" ? "multi" :
            type === "sequence" ? "sequence" :
            type === "numerical" ? "numbers" : "",
        questionText: "",
        pictureBaseString: "",
        pictureFileName: "",
        info: ""
    };

    const base = {
        clientId: crypto.randomUUID(),
        questionInfo
    };

    switch (type) {
        case "standard":
            return {
                ...base,
                type,
                answer: {
                    answerText: "",
                    shortAnswer: ""
                }
            };

        case "multi":
            return {
                ...base,
                type,
                answers: {
                    answerOptions: Array.from(
                        { length: 4 },
                        () => ({
                            optionText: "",
                            correct: false
                        })
                    )
                }
            };

        case "sequence":
            return {
                ...base,
                type,
                answer: {
                    optionsInOrder: ["", ""]
                }
            };

        case "numerical":
        case "nearest":
            return {
                ...base,
                type,
                answer: {
                    value: null
                }
            };
    }
};