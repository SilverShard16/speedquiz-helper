import type { GenericAnswer, MultipleChoiceAnswers, SequenceAnswer } from '../models/AnswerModels';

export type Question = 
    | StandardQuestion
    | MultipleChoiceQuestion
    | SequenceQuestion

export interface QuestionInfo {
    id: number;
    userView: string;
    questionText: string;
    pictureBaseString: string;
    info?: string
}

export interface StandardQuestion {
    type: "standard";
    questionInfo: QuestionInfo;
    answer: GenericAnswer;
}

export interface MultipleChoiceQuestion {
    type: "multi";
    questionInfo: QuestionInfo;
    answers: MultipleChoiceAnswers;
}

export interface SequenceQuestion {
    type: "sequence";
    questionInfo: QuestionInfo;
    answer: SequenceAnswer;
}