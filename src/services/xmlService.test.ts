// @vitest-environment jsdom

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
    MultipleChoiceQuestion,
    NearestGuessQuestion,
    NumericalQuestion,
    Question,
    QuestionInfo,
    Round,
    SequenceQuestion,
    StandardQuestion
} from "../models/Question";

import {
    downloadQuestionsXml,
    exportQuestionFiles,
    exportSingleRound,
    importQuestionFile,
    importQuestionFiles,
    nearestRoundToXml,
    questionsToXml,
    xmlToQuestions
} from "./xmlService";

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const info = (id: number, userView = "letters"): QuestionInfo => ({
    id,
    userView,
    questionText: `Question ${id}?`,
    pictureBaseString: "",
    info: ""
});

const standard = (id = 1): StandardQuestion => ({
    type: "standard",
    questionInfo: info(id),
    answer: { answerText: `Full answer ${id}`, shortAnswer: `A${id}` }
});

const multi = (id = 2): MultipleChoiceQuestion => ({
    type: "multi",
    questionInfo: info(id, "multi"),
    answers: {
        answerOptions: [
            { optionText: "Wrong", correct: false },
            { optionText: "Correct", correct: true },
            { optionText: "Other", correct: false }
        ]
    }
});

const sequence = (id = 3): SequenceQuestion => ({
    type: "sequence",
    questionInfo: info(id, "sequence"),
    answer: { optionsInOrder: ["First", "Second", "Third"] }
});

const numerical = (id = 4, value: number | null = 42): NumericalQuestion => ({
    type: "numerical",
    questionInfo: info(id, "numbers"),
    answer: { value }
});

const nearest = (id = 5, value: number | null = 42): NearestGuessQuestion => ({
    type: "nearest",
    questionInfo: info(id, ""),
    answer: { value }
});

const editorQuestion = <T extends Question>(question: T) => ({
    ...question,
    clientId: `client-${question.questionInfo.id}`
});

const round = (questions: Question[], title = "Example round"): Round => ({
    id: "round-1",
    title,
    questions: questions.map(editorQuestion)
});

const xmlQuestion = (body: string) =>
    `<round><game>Quizsentials</game><questions><question>${body}</question></questions></round>`;

const xmlElement = (xml: string, selector: string): Element | null => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    return doc.querySelector(selector);
};

const fakeFile = (name: string, text: string): File => ({
    name,
    text: vi.fn().mockResolvedValue(text)
} as unknown as File);

const xmlOf = (question: Question): string => questionsToXml([question]);

describe("questionsToXml", () => {
    it("creates a full SQQ round with the expected metadata", () => {
        const xml = questionsToXml([standard()]);

        expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
        expect(xmlElement(xml, "round > game")?.textContent).toBe("Quizsentials");
        expect(xmlElement(xml, "round > title")?.textContent).toBe("Speedquizzing Helper");
        expect(xmlElement(xml, "round > points_per_question")?.textContent).toBe("4");
        expect(xmlElement(xml, "round > go_wide")?.textContent).toBe("false");
        expect(xmlElement(xml, "round > speed_bonus")?.textContent).toBe("true");
        expect(xmlElement(xml, "round > questions > question")?.textContent).toContain("Full answer 1");
    });

    it("exports an empty array as a valid round with zero questions", () => {
        const xml = questionsToXml([]);
        expect(xmlElement(xml, "round > questions")?.children.length).toBe(0);
    });

    it("exports standard answers, info and id", () => {
        const q = standard();
        q.questionInfo.info = "A hint";
        const xml = xmlOf(q);

        expect(xmlElement(xml, "question > user_view")?.textContent).toBe("letters");
        expect(xmlElement(xml, "question > q")?.textContent).toBe("Question 1?");
        expect(xmlElement(xml, "question > short_answer")?.textContent).toBe("A1");
        expect(xmlElement(xml, "question > long_answer")?.textContent).toBe("Full answer 1");
        expect(xmlElement(xml, "question > info")?.textContent).toBe("A hint");
        expect(xmlElement(xml, "question > id")?.textContent).toBe("1");
        expect(xmlElement(xml, "question > options")).toBeNull();
    });

    it("escapes all five reserved XML characters without double-escaping", () => {
        const q = standard();
        q.questionInfo.questionText = `A & B < C > D "quoted" 'quoted' &amp;`;
        q.answer.answerText = `Rock & Roll`;
        const xml = xmlOf(q);

        expect(xml).toContain("A &amp; B &lt; C &gt; D &quot;quoted&quot; &apos;quoted&apos; &amp;amp;");
        expect(xml).toContain("Rock &amp; Roll");
        expect(xmlElement(xml, "question > q")?.textContent).toBe(q.questionInfo.questionText);
    });

    it("self-closes empty text fields", () => {
        const q = standard();
        q.answer.shortAnswer = "";
        q.answer.answerText = "";
        const xml = xmlOf(q);
        expect(xml).toContain("<short_answer/>");
        expect(xml).toContain("<long_answer/>");
        expect(xml).toContain("<info/>");
    });

    it.each([
        ["/9j/AA==", "/9j/AA=="],
        ["data:image/jpeg;base64,/9j/AA==", "/9j/AA=="],
        ["  data:image/png;base64,ABC==  ", "ABC=="]
    ])("exports picture input %s as raw base64", (source, expected) => {
        const q = standard();
        q.questionInfo.pictureBaseString = source;
        const xml = xmlOf(q);
        expect(xmlElement(xml, "question > picture")?.textContent).toBe(expected);
    });

    it("omits picture element when blank or whitespace only", () => {
        const q = standard();
        q.questionInfo.pictureBaseString = "   ";
        expect(xmlElement(xmlOf(q), "question > picture")).toBeNull();
    });

    it("exports one correct multiple-choice option as an A-Z letter", () => {
        const xml = xmlOf(multi());
        expect(xmlElement(xml, "question > short_answer")?.textContent).toBe("B");
        expect(Array.from(xmlElement(xml, "question > options")!.children)
            .map(element => element.textContent)).toEqual(["Wrong", "Correct", "Other"]);
    });

    it("supports the last valid choice, Z", () => {
        const q = multi();
        q.answers.answerOptions = Array.from({ length: 26 }, (_, index) => ({
            optionText: `Option ${index}`,
            correct: index === 25
        }));
        expect(xmlElement(xmlOf(q), "question > short_answer")?.textContent).toBe("Z");
    });

    it.each(["none", "two", "beyond-Z"])(
        "rejects invalid multiple-choice correctness: %s",
        mode => {
            const q = multi();
            if (mode === "none") {
                q.answers.answerOptions.forEach(option => { option.correct = false; });
            } else if (mode === "two") {
                q.answers.answerOptions[0].correct = true;
            } else {
                q.answers.answerOptions = Array.from({ length: 27 }, (_, index) => ({
                    optionText: String(index),
                    correct: index === 26
                }));
            }
            expect(() => xmlOf(q)).toThrow(/exactly one correct answer/);
        }
    );

    it("preserves sequence option order and empty answer fields", () => {
        const xml = xmlOf(sequence());
        expect(Array.from(xmlElement(xml, "question > options")!.children)
            .map(element => element.textContent)).toEqual(["First", "Second", "Third"]);
        expect(xml).toContain("<short_answer/>");
        expect(xml).toContain("<long_answer/>");
    });

    it("supports a sequence with zero options, retaining an empty options element", () => {
        const q = sequence();
        q.answer.optionsInOrder = [];
        expect(xmlElement(xmlOf(q), "question > options")?.children.length).toBe(0);
    });

    it.each([0, -7, 3.5, 1000000])("exports the numerical value %s", value => {
        const xml = xmlOf(numerical(4, value));
        expect(xmlElement(xml, "question > user_view")?.textContent).toBe("numbers");
        expect(xmlElement(xml, "question > short_answer")?.textContent).toBe(String(value));
        expect(xml).toContain("<long_answer/>");
        expect(xmlElement(xml, "question > info")).toBeNull();
    });

    it.each([null, Number.NaN, Infinity, -Infinity])(
        "rejects an invalid numerical answer: %s",
        value => expect(() => xmlOf(numerical(4, value))).toThrow(/valid numerical answer/)
    );

    it("rejects nearest questions in a normal SQQ serializer", () => {
        expect(() => xmlOf(nearest())).toThrow(/Nearest guess questions/);
    });

    it("does not mutate input questions", () => {
        const original: Question[] = [standard(), multi(), sequence(), numerical()];
        const before = JSON.parse(JSON.stringify(original)) as Question[];
        questionsToXml(original);
        expect(original).toEqual(before);
    });
});

describe("nearestRoundToXml", () => {
    it("writes SQN metadata and excludes SQQ-only fields", () => {
        const xml = nearestRoundToXml(round([nearest()], "Closest & Best"));
        expect(xmlElement(xml, "round > game")?.textContent).toBe("Nearest Wins");
        expect(xmlElement(xml, "round > title")?.textContent).toBe("Closest & Best");
        expect(xmlElement(xml, "round > points_per_question")?.textContent).toBe("0");
        expect(xmlElement(xml, "question > short_answer")?.textContent).toBe("42");
        expect(xml).not.toContain("<user_view>");
        expect(xml).not.toContain("<id>");
        expect(xml).not.toContain("<info>");
        expect(xml).not.toContain("<speed_bonus>");
    });

    it("includes image data when present", () => {
        const q = nearest();
        q.questionInfo.pictureBaseString = "data:image/jpeg;base64,ABC==";
        const xml = nearestRoundToXml(round([q]));
        expect(xmlElement(xml, "question > picture")?.textContent).toBe("ABC==");
    });

    it("supports multiple nearest questions and preserves their order", () => {
        const xml = nearestRoundToXml(round([nearest(10, 2819), nearest(11, 62)]));
        expect(Array.from(new DOMParser().parseFromString(xml, "application/xml")
            .querySelectorAll("question > short_answer"))
            .map(element => element.textContent)).toEqual(["2819", "62"]);
    });

    it.each([0, -3, 0.5])("permits finite nearest answer %s", value => {
        const xml = nearestRoundToXml(round([nearest(5, value)]));
        expect(xmlElement(xml, "question > short_answer")?.textContent).toBe(String(value));
    });

    it.each([null, Number.NaN, Infinity])("rejects invalid nearest answer %s", value => {
        expect(() => nearestRoundToXml(round([nearest(5, value)])))
            .toThrow(/numerical answer/);
    });

    it("rejects empty, normal, or mixed rounds", () => {
        expect(() => nearestRoundToXml(round([]))).toThrow(/only nearest/);
        expect(() => nearestRoundToXml(round([standard()]))).toThrow(/only nearest/);
        expect(() => nearestRoundToXml(round([nearest(), standard()]))).toThrow(/only nearest/);
    });
});

describe("xmlToQuestions", () => {
    it("parses an empty round", () => {
        expect(xmlToQuestions("<round><questions/></round>")).toEqual([]);
    });

    it("round-trips all four normal question types", () => {
        const input: Question[] = [standard(), multi(), sequence(), numerical(4, 0)];
        expect(xmlToQuestions(questionsToXml(input))).toEqual(input);
    });

    it("keeps valid encoded ampersands unchanged", () => {
        const xml = xmlQuestion(`<id>1</id><user_view>letters</user_view><q>A &amp; B</q><short_answer>A</short_answer><long_answer>A &amp; B</long_answer>`);
        expect(xmlToQuestions(xml)[0].questionInfo.questionText).toBe("A & B");
    });

    it("supports legacy unescaped spaced ampersands with original 'and' fallback", () => {
        const xml = xmlQuestion(`<id>1</id><user_view>letters</user_view><q>A & B</q><short_answer>A</short_answer>`);
        expect(xmlToQuestions(xml)[0].questionInfo.questionText).toBe("A and B");
    });

    it("retains picture and info fields", () => {
        const xml = xmlQuestion(`<id>6</id><user_view>letters</user_view><q>Picture?</q><short_answer>Y</short_answer><long_answer>Yes</long_answer><info>Hint &amp; tip</info><picture>  ABC==  </picture>`);
        const parsed = xmlToQuestions(xml)[0];
        expect(parsed.questionInfo.pictureBaseString).toBe("ABC==");
        expect(parsed.questionInfo.info).toBe("Hint & tip");
    });

    it("parses direct <question> children but not nested descendants", () => {
        const xml = `<round><questions>${
            `<question><id>1</id><user_view>letters</user_view><q>Direct</q><notes><question><id>2</id></question></notes></question>`
        }</questions></round>`;
        expect(xmlToQuestions(xml).map(question => question.questionInfo.id)).toEqual([1]);
    });

    it.each(["", "nope", "1.5", "9007199254740992"])(
        "rejects an invalid ID: %s",
        id => expect(() => xmlToQuestions(xmlQuestion(`<id>${id}</id>`))).toThrow(/Invalid question ID/)
    );

    it("accepts a negative safe-integer ID (current behaviour)", () => {
        expect(xmlToQuestions(xmlQuestion("<id>-1</id>"))[0].questionInfo.id).toBe(-1);
    });

    it.each(["<round>", "<round><questions><question></questions></round>", "not xml", ""])(
        "rejects malformed XML: %s",
        xml => {
            vi.spyOn(console, "error").mockImplementation(() => undefined);
            expect(() => xmlToQuestions(xml)).toThrow(/Invalid XML/);
        }
    );

    it("rejects XML without <round><questions> nesting", () => {
        expect(() => xmlToQuestions("<questions/>")).toThrow(/Could not find <questions>/);
        expect(() => xmlToQuestions("<round><other/></round>")).toThrow(/Could not find <questions>/);
    });

    it("ignores non-question children", () => {
        const xml = `<round><questions><other>ignore</other><question><id>1</id><user_view>letters</user_view></question></questions></round>`;
        expect(xmlToQuestions(xml)).toHaveLength(1);
    });

    it.each(["B", "b"])("reads multiple-choice correct letter %s", letter => {
        const xml = xmlQuestion(`<id>2</id><user_view>multi</user_view><short_answer>${letter}</short_answer><options><option>1</option><option>2</option><option>3</option></options>`);
        const parsed = xmlToQuestions(xml)[0] as MultipleChoiceQuestion;
        expect(parsed.answers.answerOptions.map(option => option.correct)).toEqual([false, true, false]);
    });

    it.each(["", "?", "D", "AA", "1"])(
        "rejects invalid multiple-choice letter: %s",
        letter => {
            const xml = xmlQuestion(`<id>2</id><user_view>multi</user_view><short_answer>${letter}</short_answer><options><option>A</option><option>B</option></options>`);
            expect(() => xmlToQuestions(xml)).toThrow(/Invalid multiple-choice answer/);
        }
    );

    it("parses a sequence without options as an empty array", () => {
        const xml = xmlQuestion(`<id>3</id><user_view>sequence</user_view><q>Order</q>`);
        const parsed = xmlToQuestions(xml)[0] as SequenceQuestion;
        expect(parsed.answer.optionsInOrder).toEqual([]);
    });

    it.each(["0", "-12", "2.5"])("parses finite numerical value %s", value => {
        const xml = xmlQuestion(`<id>4</id><user_view>numbers</user_view><short_answer>${value}</short_answer>`);
        expect((xmlToQuestions(xml)[0] as NumericalQuestion).answer.value).toBe(Number(value));
    });

    it.each(["", "Infinity", "NaN", "not a number"])(
        "rejects invalid numerical text: %s",
        value => {
            const xml = xmlQuestion(`<id>4</id><user_view>numbers</user_view><short_answer>${value}</short_answer>`);
            expect(() => xmlToQuestions(xml)).toThrow(/Invalid numerical answer/);
        }
    );

    it("falls back to standard for an unrecognised user_view", () => {
        const xml = xmlQuestion(`<id>1</id><user_view>unknown</user_view><short_answer>X</short_answer><long_answer>Answer</long_answer>`);
        expect(xmlToQuestions(xml)[0].type).toBe("standard");
    });

    it("does not support nearest-wins XML without question IDs (current limitation)", () => {
        const xml = nearestRoundToXml(round([nearest()]));
        expect(() => xmlToQuestions(xml)).toThrow(/Invalid question ID/);
    });
});

describe("importQuestionFile / importQuestionFiles", () => {
    it("imports one file regardless of extension", async () => {
        const actual = await importQuestionFile(fakeFile("test.sqq", xmlOf(standard())));
        expect(actual).toEqual([standard()]);
    });

    it("propagates a file-read failure", async () => {
        const file = { name: "bad.sqq", text: vi.fn().mockRejectedValue(new Error("read failed")) } as unknown as File;
        await expect(importQuestionFile(file)).rejects.toThrow("read failed");
    });

    it("imports exactly three files in selection order", async () => {
        const files = [
            fakeFile("one.sqq", xmlOf(standard(10))),
            fakeFile("two.XML", xmlOf(standard(20))),
            fakeFile("three.sqq", xmlOf(standard(30)))
        ];
        const parsed = await importQuestionFiles(files);
        expect(parsed.map(question => question.questionInfo.id)).toEqual([10, 20, 30]);
    });

    it("preserves selection order even if file reads finish out of order", async () => {
        const files = [
            fakeFile("a.sqq", ""),
            fakeFile("b.sqq", ""),
            fakeFile("c.sqq", "")
        ];
        const resolveReads: Array<(value: string) => void> = [];

        for (const file of files) {
            vi.mocked(file.text).mockImplementation(() =>
                new Promise<string>(resolve => { resolveReads.push(resolve); })
            );
        }

        const result = importQuestionFiles(files);
        resolveReads[2](xmlOf(standard(3)));
        resolveReads[0](xmlOf(standard(1)));
        resolveReads[1](xmlOf(standard(2)));
        expect((await result).map(q => q.questionInfo.id)).toEqual([1, 2, 3]);
    });

    it("accepts an array-like FileList", async () => {
        const files = [
            fakeFile("a.sqq", xmlOf(standard(1))),
            fakeFile("b.sqq", xmlOf(standard(2))),
            fakeFile("c.sqq", xmlOf(standard(3)))
        ];
        const fileList = { 0: files[0], 1: files[1], 2: files[2], length: 3 } as unknown as FileList;
        expect((await importQuestionFiles(fileList)).map(q => q.questionInfo.id)).toEqual([1, 2, 3]);
    });

    it.each([0, 1, 2, 4])("rejects %s files", async count => {
        const files = Array.from({ length: count }, (_, index) =>
            fakeFile(`${index}.sqq`, xmlOf(standard(index + 1))));
        await expect(importQuestionFiles(files)).rejects.toThrow(/exactly three/);
    });

    it("rejects unsupported extensions before reading content", async () => {
        const bad = fakeFile("third.sqn", xmlOf(standard(3)));
        const files = [fakeFile("one.sqq", xmlOf(standard(1))), fakeFile("two.sqq", xmlOf(standard(2))), bad];
        await expect(importQuestionFiles(files)).rejects.toThrow(/not an XML or SQQ file/);
        expect(bad.text).not.toHaveBeenCalled();
    });

    it("propagates errors if a supplied XML file is invalid", async () => {
        const files = [fakeFile("one.sqq", xmlOf(standard(1))), fakeFile("two.sqq", "broken"), fakeFile("three.sqq", xmlOf(standard(3)))];
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(importQuestionFiles(files)).rejects.toThrow(/Invalid XML/);
    });

    it("does not enforce 60 questions and accepts three empty rounds", async () => {
        const empty = "<round><questions/></round>";
        expect(await importQuestionFiles([
            fakeFile("a.sqq", empty), fakeFile("b.sqq", empty), fakeFile("c.sqq", empty)
        ])).toEqual([]);
    });
});

type Download = { filename: string; blob: Blob; attachedWhenClicked: boolean };
const downloads: Download[] = [];
const blobsByUrl = new Map<string, Blob>();
let nextBlobId = 0;

describe("download and ZIP export", () => {
    beforeEach(() => {
        downloads.length = 0;
        blobsByUrl.clear();
        
        const NativeURL = URL;
        class TestURL extends NativeURL {
            static createObjectURL(blob: Blob): string {
                const url = `blob:mock-${++nextBlobId}`;
                blobsByUrl.set(url, blob);
                return url;
            }
            static revokeObjectURL(url: string): void {
                blobsByUrl.delete(url);
            }
        }
        vi.stubGlobal("URL", TestURL);
        vi.spyOn(HTMLAnchorElement.prototype, "click")
            .mockImplementation(function (this: HTMLAnchorElement) {
                const blob = blobsByUrl.get(this.href);
                if (!blob) throw new Error(`No Blob for ${this.href}`);
                downloads.push({
                    filename: this.download,
                    blob,
                    attachedWhenClicked: document.body.contains(this)
                });
            });
    });

    const readBlob = async (blob: Blob): Promise<ArrayBuffer> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blob);
        });

    const readText = async (blob: Blob): Promise<string> =>
        new TextDecoder().decode(await readBlob(blob));

    const downloadedZip = async (): Promise<JSZip> => {
        expect(downloads).toHaveLength(1);
        return JSZip.loadAsync(await readBlob(downloads[0].blob));
    };

    it("exports one SQQ file with its round name", async () => {
        exportSingleRound([standard()], "General Knowledge");
        expect(downloads).toHaveLength(1);
        expect(downloads[0].filename).toBe("General Knowledge.sqq");
        expect(downloads[0].attachedWhenClicked).toBe(true);
        expect(xmlToQuestions(await readText(downloads[0].blob))).toEqual([standard()]);
        expect(document.querySelector('a[href="blob:mock-1"]')).toBeNull();
    });

    it("allows the older downloadQuestionsXml export name to work", () => {
        downloadQuestionsXml([standard()], "One");
        expect(downloads.map(item => item.filename)).toEqual(["One.sqq"]);
    });

    it.each(["", "  ", "\"bad/round:1?. "])(
        "sanitises an unsafe or empty filename: %j",
        name => {
            exportSingleRound([standard()], name);
            expect(downloads[0].filename).not.toMatch(/[<>:"/\\|?*]/);
            expect(downloads[0].filename).not.toBe(".sqq");
        }
    );

    it("does not download if question serialization fails", () => {
        expect(() => exportSingleRound([numerical(4, null)], "Bad"))
            .toThrow(/valid numerical/);
        expect(downloads).toHaveLength(0);
    });

    it("revokes its temporary object URL after the download begins", () => {
        vi.useFakeTimers();
        exportSingleRound([standard()], "Round");
        expect(blobsByUrl.size).toBe(1);
        vi.advanceTimersByTime(999);
        expect(blobsByUrl.size).toBe(1);
        vi.advanceTimersByTime(1);
        expect(blobsByUrl.size).toBe(0);
    });

    it("exports 60 questions into 4 real ZIP entries of 15 each", async () => {
        const questions = Array.from({ length: 60 }, (_, i) => standard(i + 1));
        await exportQuestionFiles(questions, "Quiz Night");

        expect(downloads).toHaveLength(1);
        expect(downloads[0].filename).toBe("Quiz Night.zip");

        const zip = await downloadedZip();
        expect(Object.keys(zip.files).sort()).toEqual([
            "Quiz Night_1.sqq", "Quiz Night_2.sqq",
            "Quiz Night_3.sqq", "Quiz Night_4.sqq"
        ]);

        for (let i = 1; i <= 4; i++) {
            const xml = await zip.file(`Quiz Night_${i}.sqq`)!.async("string");
            const ids = xmlToQuestions(xml).map(q => q.questionInfo.id);
            expect(ids).toEqual(Array.from({ length: 15 }, (_, j) => (i - 1) * 15 + j + 1));
        }
    });

    it("preserves the existing floor-and-remainder split for 10 questions", async () => {
        await exportQuestionFiles(Array.from({ length: 10 }, (_, i) => standard(i + 1)), "Quiz");
        const zip = await downloadedZip();
        const sizes = await Promise.all([1, 2, 3, 4].map(async i =>
            xmlToQuestions(await zip.file(`Quiz_${i}.sqq`)!.async("string")).length));
        expect(sizes).toEqual([2, 2, 2, 4]);
    });

    it("writes four files, including empty ones, when there are fewer than four questions", async () => {
        await exportQuestionFiles([standard(1), standard(2), standard(3)], "Quiz");
        const zip = await downloadedZip();
        const sizes = await Promise.all([1, 2, 3, 4].map(async i =>
            xmlToQuestions(await zip.file(`Quiz_${i}.sqq`)!.async("string")).length));
        expect(sizes).toEqual([0, 0, 0, 3]);
    });

    it("writes four empty SQQ files for zero questions (current behaviour)", async () => {
        await exportQuestionFiles([], "Quiz");
        const zip = await downloadedZip();
        expect(Object.keys(zip.files)).toHaveLength(4);
        expect(xmlToQuestions(await zip.file("Quiz_4.sqq")!.async("string"))).toEqual([]);
    });

    it("sanitises the archive name and ZIP entry paths", async () => {
        await exportQuestionFiles([standard()], "../bad:quiz");
        expect(downloads[0].filename).toBe(".._bad_quiz.zip");
        const zip = await downloadedZip();
        expect(Object.keys(zip.files)).toEqual([
            ".._bad_quiz_1.sqq", ".._bad_quiz_2.sqq",
            ".._bad_quiz_3.sqq", ".._bad_quiz_4.sqq"
        ]);
    });

    it("rejects invalid question data without starting a download", async () => {
        await expect(exportQuestionFiles([numerical(4, null)], "Bad"))
            .rejects.toThrow(/valid numerical answer/);
        expect(downloads).toHaveLength(0);
    });
});
