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
    questionInfo: QuestionInfo;
    answer: GenericAnswer;
}

export interface MultipleChoiceQuestion {
    questionInfo: QuestionInfo;
    answers: MultipleChoiceAnswers;
}

export interface SequenceQuestion {
    questionInfo: QuestionInfo;
    answer: SequenceAnswer;
}