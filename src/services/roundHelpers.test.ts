import { describe, expect, it } from "vitest";

import { type EditorQuestion, type QuestionType, createEmptyQuestion } from "../models/Question";
import {
    canUseQuestionType,
    getRoundKind,
    type RoundKind,
    hasEnteredAnswer
} from "./roundHelpers";

const QUESTION_TYPES = [
    "standard",
    "multi",
    "sequence",
    "numerical",
    "nearest"
] as const satisfies readonly QuestionType[];

const NORMAL_TYPES = [
    "standard",
    "multi",
    "sequence",
    "numerical"
] as const satisfies readonly QuestionType[];

function createQuestion(type: QuestionType, index = 0): EditorQuestion {
    const questionInfo = {
        id: index + 1,
        userView: type === "nearest" ? "" : type,
        questionText: `Question ${index + 1}`,
        pictureBaseString: "",
        info: ""
    };

    const clientId = `client-${index}`;

    switch (type) {
        case "standard":
            return {
                clientId,
                type,
                questionInfo,
                answer: { answerText: "Answer", shortAnswer: "A" }
            };

        case "multi":
            return {
                clientId,
                type,
                questionInfo,
                answers: {
                    answerOptions: [
                        { optionText: "A", correct: true },
                        { optionText: "B", correct: false }
                    ]
                }
            };

        case "sequence":
            return {
                clientId,
                type,
                questionInfo,
                answer: { optionsInOrder: ["first", "second"] }
            };

        case "numerical":
            return {
                clientId,
                type,
                questionInfo,
                answer: { value: 0 }
            };

        case "nearest":
            return {
                clientId,
                type,
                questionInfo,
                answer: { value: 42 }
            };
    }
}

const makeQuestions = (
    types: readonly QuestionType[]
): EditorQuestion[] => types.map(createQuestion);

function expectedRoundKind(types: readonly QuestionType[]): RoundKind {
    if (types.length === 0) {
        return "empty";
    }

    const categories = new Set(
        types.map(type => type === "nearest" ? "nearest" : "normal")
    );

    if (categories.size > 1) {
        return "mixed";
    }

    return categories.has("nearest") ? "nearest" : "normal";
}

function combinations(length: number): QuestionType[][] {
    if (length === 0) {
        return [[]];
    }

    return combinations(length - 1).flatMap(previous =>
        QUESTION_TYPES.map(type => [...previous, type])
    );
}

const ALL_SHORT_COMBINATIONS = [0, 1, 2, 3].flatMap(combinations);

describe("getRoundKind", () => {
    it("classifies an empty array as empty", () => {
        expect(getRoundKind([])).toBe("empty");
    });

    it.each(NORMAL_TYPES)(
        "classifies a single %s question as normal",
        type => {
            expect(getRoundKind([createQuestion(type)])).toBe("normal");
        }
    );

    it("classifies a single nearest question as nearest", () => {
        expect(getRoundKind([createQuestion("nearest")])).toBe("nearest");
    });

    it("classifies any combination of normal question types as normal", () => {
        expect(getRoundKind(makeQuestions(NORMAL_TYPES))).toBe("normal");
        expect(getRoundKind(makeQuestions([...NORMAL_TYPES].reverse()))).toBe("normal");
    });

    it("classifies multiple nearest questions as nearest", () => {
        expect(getRoundKind(makeQuestions(Array(20).fill("nearest")))).toBe("nearest");
    });

    it.each([
        { label: "standard first", types: ["standard", "nearest"] },
        { label: "nearest first", types: ["nearest", "standard"] },
        { label: "nearest in middle", types: ["standard", "nearest", "multi"] },
        { label: "nearest at end", types: ["multi", "numerical", "nearest"] },
        { label: "normal in middle", types: ["nearest", "sequence", "nearest"] },
        { label: "normal at end", types: ["nearest", "nearest", "numerical"] }
    ] as const)("classifies a mixed round ($label)", ({ types }) => {
        expect(getRoundKind(makeQuestions(types))).toBe("mixed");
    });

    it.each(
        ALL_SHORT_COMBINATIONS.map(types => ({
            label: types.length === 0 ? "empty" : types.join("/"),
            types,
            expected: expectedRoundKind(types)
        }))
    )("handles every type combination of length <= 3: $label", ({ types, expected }) => {
        expect(getRoundKind(makeQuestions(types))).toBe(expected);
    });

    it("handles a large normal round", () => {
        const types = Array.from(
            { length: 10_000 },
            (_, index) => NORMAL_TYPES[index % NORMAL_TYPES.length]!
        );

        expect(getRoundKind(makeQuestions(types))).toBe("normal");
    });

    it("handles a large nearest-only round", () => {
        const questions = Array.from(
            { length: 10_000 },
            (_, index) => createQuestion("nearest", index)
        );

        expect(getRoundKind(questions)).toBe("nearest");
    });

    it("recognises a conflicting last question in a large round", () => {
        const questions = Array.from(
            { length: 10_000 },
            (_, index) => createQuestion("standard", index)
        );
        questions.push(createQuestion("nearest", questions.length));

        expect(getRoundKind(questions)).toBe("mixed");
    });

    it("stops reading after the first incompatible question", () => {
        const unreachable = createQuestion("standard", 2);
        Object.defineProperty(unreachable, "type", {
            get: () => { throw new Error("Read past the first mismatch"); }
        });

        expect(getRoundKind([
            createQuestion("nearest", 0),
            createQuestion("standard", 1),
            unreachable
        ])).toBe("mixed");
    });

    it("accepts a frozen readonly input and does not mutate it", () => {
        const first = Object.freeze(createQuestion("standard", 0));
        const second = Object.freeze(createQuestion("nearest", 1));
        const questions: readonly EditorQuestion[] = Object.freeze([first, second]);

        expect(getRoundKind(questions)).toBe("mixed");
        expect(questions[0]).toBe(first);
        expect(questions[1]).toBe(second);
    });

    it("does not change the questions or question metadata", () => {
        const questions = makeQuestions(["standard", "multi", "nearest"]);
        const original = structuredClone(questions);

        getRoundKind(questions);

        expect(questions).toEqual(original);
    });

    it("always derives the result from the current questions, not a cached result", () => {
        const questions = makeQuestions(["standard"]);

        expect(getRoundKind(questions)).toBe("normal");

        questions.push(createQuestion("nearest", 1));
        expect(getRoundKind(questions)).toBe("mixed");

        questions.shift();
        expect(getRoundKind(questions)).toBe("nearest");

        questions.pop();
        expect(getRoundKind(questions)).toBe("empty");
    });
});

describe("canUseQuestionType", () => {
    const ROUND_KINDS: readonly RoundKind[] = [
        "empty", "normal", "nearest", "mixed"
    ];

    const cases = ROUND_KINDS.flatMap(roundKind =>
        QUESTION_TYPES.map(questionType => ({
            roundKind,
            questionType,
            allowed:
                roundKind === "empty" ||
                (roundKind === "normal" && questionType !== "nearest") ||
                (roundKind === "nearest" && questionType === "nearest")
        }))
    );

    it.each(cases)(
        "returns $allowed for $questionType in $roundKind round",
        ({ roundKind, questionType, allowed }) => {
            expect(canUseQuestionType(roundKind, questionType)).toBe(allowed);
        }
    );

    it("does not depend on previous calls or call order", () => {
        expect(canUseQuestionType("normal", "nearest")).toBe(false);
        expect(canUseQuestionType("empty", "nearest")).toBe(true);
        expect(canUseQuestionType("nearest", "nearest")).toBe(true);
        expect(canUseQuestionType("normal", "standard")).toBe(true);
        expect(canUseQuestionType("mixed", "standard")).toBe(false);
        expect(canUseQuestionType("empty", "standard")).toBe(true);
    });

    it.each([
        { label: "unknown", kind: "unknown" },
        { label: "empty string", kind: "" },
        { label: "null", kind: null },
        { label: "undefined", kind: undefined }
    ])("fails closed for invalid runtime round kind: $label", ({ kind }) => {
        expect(canUseQuestionType(kind as RoundKind, "standard")).toBe(false);
    });

    it("always returns a boolean for each supported input", () => {
        for (const roundKind of ROUND_KINDS) {
            for (const questionType of QUESTION_TYPES) {
                expect(typeof canUseQuestionType(roundKind, questionType)).toBe("boolean");
            }
        }
    });
});

describe("hasEnteredAnswer", () => {
    it("does not lock an empty standard question", () => {
        const question = createEmptyQuestion("standard");

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("locks a populated standard question", () => {
        const question = createEmptyQuestion("standard");

        question.answer.answerText = "London";

        expect(hasEnteredAnswer(question)).toBe(true);
    });

    it("recognises zero as a valid numerical answer", () => {
        const question = createEmptyQuestion("numerical");

        question.answer.value = 0;

        expect(hasEnteredAnswer(question)).toBe(true);
    });

    it("unlocks an empty numerical question", () => {
        const question = createEmptyQuestion("numerical");

        question.answer.value = null;

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("does not let another question affect the lock", () => {
        const first = createEmptyQuestion("numerical");
        const second = createEmptyQuestion("standard");

        first.answer.value = 1066;

        expect(hasEnteredAnswer(first)).toBe(true);
        expect(hasEnteredAnswer(second)).toBe(false);
    });

    it("returns false when all options are empty", () => {
        const question = createEmptyQuestion("multi");

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("returns false when all options contain whitespace", () => {
        const question = createEmptyQuestion("multi");

        question.answers.answerOptions.forEach(option => {
            option.optionText = "   ";
        });

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it.each([
        { index: 0, answer: "London" },
        { index: 1, answer: "Paris" },
        { index: 2, answer: "Berlin" },
        { index: 3, answer: "Madrid" }
    ])(
        "returns true when option $index contains an answer",
        ({ index, answer }) => {
            const question = createEmptyQuestion("multi");

            question.answers.answerOptions[index].optionText = answer;

            expect(hasEnteredAnswer(question)).toBe(true);
        }
    );

    it("returns true when multiple options contain answers", () => {
        const question = createEmptyQuestion("multi");

        question.answers.answerOptions[0].optionText = "London";
        question.answers.answerOptions[2].optionText = "Paris";

        expect(hasEnteredAnswer(question)).toBe(true);
    });

    it("returns false after the last populated option is cleared", () => {
        const question = createEmptyQuestion("multi");

        question.answers.answerOptions[0].optionText = "London";

        expect(hasEnteredAnswer(question)).toBe(true);

        question.answers.answerOptions[0].optionText = "";

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("returns false when there are no options", () => {
        const question = createEmptyQuestion("multi");

        question.answers.answerOptions = [];

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("returns false when all sequence options are empty", () => {
        const question = createEmptyQuestion("sequence");

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("returns false when all options contain whitespace", () => {
        const question = createEmptyQuestion("sequence");

        question.answer.optionsInOrder = [" ", "   ", "\t"];

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it.each([
        { index: 0, answer: "First" },
        { index: 1, answer: "Second" },
        { index: 2, answer: "Third" },
        { index: 3, answer: "Fourth" }
    ])(
        "returns true when sequence position $index contains an answer",
        ({ index, answer }) => {
            const question = createEmptyQuestion("sequence");

            question.answer.optionsInOrder = Array(
                index + 1
            ).fill("");

            question.answer.optionsInOrder[index] = answer;

            expect(hasEnteredAnswer(question)).toBe(true);
        }
    );

    it("returns true when multiple sequence options contain answers", () => {
        const question = createEmptyQuestion("sequence");

        question.answer.optionsInOrder = [
            "First",
            "",
            "Third"
        ];

        expect(hasEnteredAnswer(question)).toBe(true);
    });

    it("returns false when the final answer is cleared", () => {
        const question = createEmptyQuestion("sequence");

        question.answer.optionsInOrder = ["First", ""];

        expect(hasEnteredAnswer(question)).toBe(true);

        question.answer.optionsInOrder[0] = "";

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("returns false when there are no sequence options", () => {
        const question = createEmptyQuestion("sequence");

        question.answer.optionsInOrder = [];

        expect(hasEnteredAnswer(question)).toBe(false);
    });

    it("does not count selecting a correct option as entering an answer", () => {
    const question = createEmptyQuestion("multi");

    question.answers.answerOptions.forEach((option, index) => {
        option.optionText = "";
        option.correct = index === 0;
    });

    expect(hasEnteredAnswer(question)).toBe(false);
});
});