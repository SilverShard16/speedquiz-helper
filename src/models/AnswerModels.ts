export interface Answer {
  answerText: string;
  shortAnswer: string;
  pictureFileName: string;
  pictureBaseString: string;
}

export interface GenericAnswer {
  answerText: string;
  shortAnswer: string;
}

export interface MultipleChoiceAnswers {
  answerOptions: MultipleChoiceAnswer[];
}

export interface MultipleChoiceAnswer {
  optionText: string;
  correct: boolean;
}

export interface SequenceAnswer {
  optionsInOrder: string[];
}