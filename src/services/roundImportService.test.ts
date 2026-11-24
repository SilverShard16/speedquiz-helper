// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRoundKind } from "./roundHelpers";
import {
    importRoundFile,
    importRoundFiles,
    shouldCollapseImportedRounds
} from "./roundImportService";

const SQQ = `<?xml version="1.0" encoding="utf-8"?>
<round>
  <game>Quizsentials</game>
  <title>General Knowledge</title>
  <questions>
    <question>
      <user_view>letters</user_view><q>Is A &amp; B correct?</q>
      <short_answer>Y</short_answer><long_answer>Yes</long_answer>
      <info>Explanation</info><picture>YWJj</picture><id>10</id>
    </question>
    <question>
      <user_view>multi</user_view><q>Choose one</q>
      <short_answer>B</short_answer><long_answer/>
      <options><option>Wrong</option><option>Right</option></options>
      <id>11</id>
    </question>
    <question>
      <user_view>sequence</user_view><q>Order these</q>
      <short_answer/><long_answer/>
      <options><option>First</option><option>Second</option></options>
      <id>12</id>
    </question>
    <question>
      <user_view>numbers</user_view><q>What is zero?</q>
      <short_answer>0</short_answer><long_answer/><id>13</id>
    </question>
  </questions>
</round>`;

const SQN = `<?xml version="1.0" encoding="utf-8"?>
<round>
  <game>Nearest Wins</game>
  <title>World Records</title>
  <points_per_question>0</points_per_question>
  <questions>
    <question>
      <q>How heavy was the pumpkin?</q><short_answer>2819</short_answer>
      <long_answer/><picture>YWJj</picture>
    </question>
    <question>
      <q>How many books?</q><short_answer>0</short_answer><long_answer/>
    </question>
  </questions>
</round>`;

const fileWithText = (name: string, xml: string): File => {
    const file = new File([xml], name, { type: "application/xml" });
    Object.defineProperty(file, "text", {
        configurable: true,
        value: vi.fn().mockResolvedValue(xml)
    });
    return file;
};

const nearestXml = (answer: string): string =>
    SQN.replace("<short_answer>2819</short_answer>", `<short_answer>${answer}</short_answer>`);

let idCounter = 0;

beforeEach(() => {
    idCounter = 0;
    vi.stubGlobal("crypto", {
        randomUUID: () => `generated-${++idCounter}`
    });
});

afterEach(() => vi.unstubAllGlobals());

describe("importRoundFile — SQQ", () => {
    it("imports standard, multiple-choice, sequence and numerical questions", async () => {
        const round = await importRoundFile(fileWithText("test.sqq", SQQ));

        expect(round.title).toBe("General Knowledge");
        expect(round.questions).toHaveLength(4);
        expect(round.questions.map(q => q.type)).toEqual([
            "standard", "multi", "sequence", "numerical"
        ]);
        expect(getRoundKind(round.questions)).toBe("normal");

        const [standard, multi, sequence, numerical] = round.questions;
        if (!standard || standard.type !== "standard") throw new Error("Expected standard");
        expect(standard.questionInfo).toMatchObject({
            id: 10,
            questionText: "Is A & B correct?",
            pictureBaseString: "YWJj",
            info: "Explanation"
        });
        expect(standard.answer).toEqual({ shortAnswer: "Y", answerText: "Yes" });

        if (!multi || multi.type !== "multi") throw new Error("Expected multiple choice");
        expect(multi.answers.answerOptions).toEqual([
            { optionText: "Wrong", correct: false },
            { optionText: "Right", correct: true }
        ]);

        if (!sequence || sequence.type !== "sequence") throw new Error("Expected sequence");
        expect(sequence.answer.optionsInOrder).toEqual(["First", "Second"]);

        if (!numerical || numerical.type !== "numerical") throw new Error("Expected numerical");
        expect(numerical.answer.value).toBe(0);
    });

    it("accepts uppercase extensions", async () => {
        expect((await importRoundFile(fileWithText("UPPER.SQQ", SQQ))).questions).toHaveLength(4);
    });

    it("falls back to the filename when the XML title is absent", async () => {
        const withoutTitle = SQQ.replace("<title>General Knowledge</title>", "");
        expect((await importRoundFile(fileWithText("My Round.sqq", withoutTitle))).title)
            .toBe("My Round");
    });

    it("rejects the wrong file extension", async () => {
        await expect(importRoundFile(fileWithText("quiz.zip", SQQ)))
            .rejects.toThrow("Only .sqq and .sqn files are supported.");
    });

    it("rejects Nearest Wins XML mislabelled .sqq", async () => {
        await expect(importRoundFile(fileWithText("wrong.sqq", SQN)))
            .rejects.toThrow("must use the .sqn extension");
    });

    it("rejects SQQ questions with missing numeric IDs", async () => {
        const malformed = SQQ.replace("<id>10</id>", "<id/>");
        await expect(importRoundFile(fileWithText("bad.sqq", malformed)))
            .rejects.toThrow("Invalid question ID");
    });
});

describe("importRoundFile — SQN", () => {
    it("imports nearest questions, values, pictures, and creates editor IDs", async () => {
        const round = await importRoundFile(fileWithText("records.sqn", SQN));
        expect(round.title).toBe("World Records");
        expect(round.questions).toHaveLength(2);
        expect(getRoundKind(round.questions)).toBe("nearest");
        expect(round.questions.map(q => q.type)).toEqual(["nearest", "nearest"]);
        expect(round.questions.map(q => q.questionInfo.id)).toEqual([1, 2]);
        expect(round.questions[0]!.questionInfo.pictureBaseString).toBe("YWJj");
        expect(round.questions[0]!.questionInfo.questionText)
            .toBe("How heavy was the pumpkin?");
        const [first, second] = round.questions;
        if (!first || !second || first.type !== "nearest" || second.type !== "nearest") {
            throw new Error("Expected nearest questions");
        }
        expect(first.answer.value).toBe(2819);
        expect(second.answer.value).toBe(0);
        expect(round.id).not.toBe(first.clientId);
        expect(first.clientId).not.toBe(second.clientId);
    });

    it("supports signed and decimal nearest answers", async () => {
        const round = await importRoundFile(fileWithText("numbers.sqn", nearestXml("-12.75")));
        const first = round.questions[0];
        if (!first || first.type !== "nearest") throw new Error("Expected nearest");
        expect(first.answer.value).toBe(-12.75);
    });

    it.each([
        { answer: "", description: "empty" },
        { answer: "NaN", description: "NaN" },
        { answer: "Infinity", description: "Infinity" },
        { answer: "one thousand", description: "text" },
        { answer: "1e999", description: "overflow" }
    ])("rejects $description nearest answer", async ({ answer }) => {
        await expect(importRoundFile(fileWithText("bad.sqn", nearestXml(answer))))
            .rejects.toThrow("requires a valid numerical answer");
    });

    it("rejects a non-Nearest Wins SQN", async () => {
        await expect(importRoundFile(fileWithText("wrong.sqn", SQQ)))
            .rejects.toThrow("SQN files must contain");
    });

    it("accepts uppercase extensions", async () => {
        expect((await importRoundFile(fileWithText("UPPER.SQN", SQN))).questions).toHaveLength(2);
    });
});

describe("importRoundFile — shared validation", () => {
    it.each([
        { content: "<round>", description: "malformed XML" },
        { content: "<questions></questions>", description: "wrong root" },
        { content: "<round><title>Missing</title></round>", description: "missing questions element" },
        { content: "<round><questions /></round>", description: "empty questions" }
    ])("rejects $description", async ({ content }) => {
        await expect(importRoundFile(fileWithText("bad.sqq", content))).rejects.toThrow();
    });

    it("preserves valid ampersands and handles legacy unescaped ampersands", async () => {
        const valid = await importRoundFile(fileWithText("valid.sqq", SQQ));
        expect(valid.questions[0]!.questionInfo.questionText).toBe("Is A & B correct?");

        const legacy = SQQ.replace("A &amp; B", "A & B");
        const imported = await importRoundFile(fileWithText("legacy.sqq", legacy));
        expect(imported.questions[0]!.questionInfo.questionText).toBe("Is A and B correct?");
    });

    it("propagates file reading failures", async () => {
        const file = fileWithText("broken.sqq", SQQ);
        Object.defineProperty(file, "text", {
            configurable: true,
            value: vi.fn().mockRejectedValue(new Error("Disk read failed"))
        });
        await expect(importRoundFile(file)).rejects.toThrow("Disk read failed");
    });
});

describe("importRoundFiles", () => {
    it("imports zero files without errors", async () => {
        expect(await importRoundFiles([])).toEqual({ rounds: [], errors: [] });
    });

    it("imports any number and mixture of files in input order", async () => {
        const result = await importRoundFiles([
            fileWithText("one.sqq", SQQ),
            fileWithText("two.sqn", SQN),
            fileWithText("three.sqq", SQQ)
        ]);
        expect(result.errors).toEqual([]);
        expect(result.rounds.map(round => round.title)).toEqual([
            "General Knowledge", "World Records", "General Knowledge"
        ]);
        expect(result.rounds.map(round => getRoundKind(round.questions))).toEqual([
            "normal", "nearest", "normal"
        ]);
        expect(new Set(result.rounds.map(round => round.id)).size).toBe(3);
        expect(new Set(result.rounds.flatMap(round => round.questions.map(q => q.clientId))).size)
            .toBe(10);
    });

    it("keeps successful imports when other files are invalid", async () => {
        const result = await importRoundFiles([
            fileWithText("broken.sqn", "<invalid/>"),
            fileWithText("good.sqq", SQQ),
            fileWithText("bad.zip", SQQ),
            fileWithText("good.sqn", SQN)
        ]);
        expect(result.rounds.map(round => round.title)).toEqual([
            "General Knowledge", "World Records"
        ]);
        expect(result.errors.map(error => error.filename)).toEqual([
            "broken.sqn", "bad.zip"
        ]);
        expect(result.errors.every(error => Boolean(error.message))).toBe(true);
    });

    it("creates fresh IDs for repeated imports of the same file", async () => {
        const file = fileWithText("same.sqq", SQQ);
        const first = await importRoundFiles([file]);
        const second = await importRoundFiles([file]);
        expect(first.rounds[0]!.id).not.toBe(second.rounds[0]!.id);
        expect(first.rounds[0]!.questions[0]!.clientId)
            .not.toBe(second.rounds[0]!.questions[0]!.clientId);
    });
});

describe("shouldCollapseImportedRounds", () => {
    it.each([
        { previous: false, count: 0, expected: false },
        { previous: false, count: 1, expected: false },
        { previous: false, count: 2, expected: true },
        { previous: false, count: 10, expected: true },
        { previous: true, count: 1, expected: true },
        { previous: true, count: 5, expected: true }
    ])(
        "previous=$previous, count=$count -> collapse=$expected",
        ({ previous, count, expected }) => {
            expect(shouldCollapseImportedRounds(previous, count)).toBe(expected);
        }
    );
});
