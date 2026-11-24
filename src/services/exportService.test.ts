// @vitest-environment jsdom

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Question, Round } from "../models/Question";
import * as roundHelpers from "./roundHelpers";
import { questionsToXml, nearestRoundToXml } from "../services/xmlService";
import { exportRounds } from "./exportService";

vi.mock("../services/xmlService", () => ({
    questionsToXml: vi.fn(),
    nearestRoundToXml: vi.fn()
}));

type QuestionType = Question["type"];
type EditorQuestion = Round["questions"][number];

const questionInfo = (id: number, userView: string) => ({
    id,
    userView,
    questionText: `Question ${id} & <test>?`,
    pictureBaseString: "",
    info: ""
});

const makeQuestion = (type: QuestionType, id: number): EditorQuestion => {
    const clientId = `client-${id}`;

    switch (type) {
        case "standard":
            return {
                clientId, type,
                questionInfo: questionInfo(id, "letters"),
                answer: { shortAnswer: "A", answerText: "Answer" }
            };
        case "multi":
            return {
                clientId, type,
                questionInfo: questionInfo(id, "multi"),
                answers: {
                    answerOptions: [
                        { optionText: "Incorrect", correct: false },
                        { optionText: "Correct", correct: true }
                    ]
                }
            };
        case "sequence":
            return {
                clientId, type,
                questionInfo: questionInfo(id, "sequence"),
                answer: { optionsInOrder: ["First", "Second"] }
            };
        case "numerical":
            return {
                clientId, type,
                questionInfo: questionInfo(id, "numbers"),
                answer: { value: 0 }
            };
        case "nearest":
            return {
                clientId, type,
                questionInfo: questionInfo(id, ""),
                answer: { value: 2819 }
            };
    }
};

const makeRound = (
    index: number,
    types: QuestionType[],
    title = `Round ${index}`
): Round => ({
    id: `round-${index}`,
    title,
    questions: types.map((type, i) => makeQuestion(type, index * 100 + i))
});

const fakeSqq = (questions: Question[]): string =>
    `<sqq>${questions.map(q => q.questionInfo.id).join(",")}</sqq>`;

const fakeSqn = (round: Round): string =>
    `<sqn>${round.title}:${round.questions.map(q => q.questionInfo.id).join(",")}</sqn>`;

type Download = {
    filename: string;
    blob: Blob;
    url: string;
    attachedWhenClicked: boolean;
};

const downloads: Download[] = [];
const activeUrls = new Map<string, Blob>();
let nextUrlId = 0;

const readBlob = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });

const readText = async (blob: Blob): Promise<string> =>
    new TextDecoder().decode(await readBlob(blob));

const loadDownloadedZip = async (): Promise<JSZip> => {
    expect(downloads).toHaveLength(1);
    return JSZip.loadAsync(await readBlob(downloads[0].blob));
};

beforeEach(() => {
    downloads.length = 0;
    activeUrls.clear();
    nextUrlId = 0;

    vi.mocked(questionsToXml).mockReset().mockImplementation(fakeSqq);
    vi.mocked(nearestRoundToXml).mockReset().mockImplementation(fakeSqn);

    const NativeURL = URL;

    class TestURL extends NativeURL {
        static createObjectURL(blob: Blob): string {
            const url = `blob:test-round-export-${++nextUrlId}`;
            activeUrls.set(url, blob);
            return url;
        }

        static revokeObjectURL(url: string): void {
            activeUrls.delete(url);
        }
    }

    vi.stubGlobal("URL", TestURL);
    vi.spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
            const blob = activeUrls.get(this.href);
            if (!blob) {
                throw new Error(`Missing test Blob for ${this.href}`);
            }

            downloads.push({
                blob,
                filename: this.download,
                url: this.href,
                attachedWhenClicked: document.body.contains(this)
            });
        });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

describe("exportRounds: round validation", () => {
    it("rejects an empty array before serializing or downloading", async () => {
        await expect(exportRounds([])).rejects.toThrow(
            "There are no rounds to export."
        );

        expect(questionsToXml).not.toHaveBeenCalled();
        expect(nearestRoundToXml).not.toHaveBeenCalled();
        expect(downloads).toHaveLength(0);
        expect(activeUrls.size).toBe(0);
    });

    it("rejects an empty round with its 1-based position", async () => {
        await expect(exportRounds([makeRound(1, [])])).rejects.toThrow(
            "Round 1 has no questions."
        );
        expect(downloads).toHaveLength(0);
    });

    it("rejects empty rounds at later positions without partially downloading", async () => {
        const rounds = [
            makeRound(1, ["standard"]),
            makeRound(2, ["nearest"]),
            makeRound(3, [])
        ];

        await expect(exportRounds(rounds)).rejects.toThrow(
            "Round 3 has no questions."
        );

        expect(downloads).toHaveLength(0);
        expect(activeUrls.size).toBe(0);
    });

    it.each([
        ["nearest", "standard"],
        ["standard", "nearest"],
        ["multi", "nearest"],
        ["nearest", "sequence"],
        ["numerical", "nearest"]
    ] as [QuestionType, QuestionType][])(
        "rejects mixed round containing %s and %s",
        async (first, second) => {
            await expect(exportRounds([
                makeRound(1, [first, second])
            ])).rejects.toThrow(
                "Round 1 contains a mixture of nearest guess and normal questions."
            );

            expect(questionsToXml).not.toHaveBeenCalled();
            expect(nearestRoundToXml).not.toHaveBeenCalled();
            expect(downloads).toHaveLength(0);
        }
    );

    it("reports the correct round position for a later mixed round", async () => {
        await expect(exportRounds([
            makeRound(1, ["nearest"]),
            makeRound(2, ["standard"]),
            makeRound(3, ["standard", "nearest"])
        ])).rejects.toThrow("Round 3 contains a mixture");
        expect(downloads).toHaveLength(0);
    });

    it("rejects an unrecognised round kind instead of silently treating it as normal", async () => {
        vi.spyOn(roundHelpers, "getRoundKind")
            .mockReturnValueOnce("unexpected" as ReturnType<typeof roundHelpers.getRoundKind>);

        await expect(exportRounds([makeRound(1, ["standard"])])).rejects.toThrow(
            "Round 1 has an unsupported round type."
        );
        expect(downloads).toHaveLength(0);
    });

    it("propagates a normal round serialization error without downloading", async () => {
        vi.mocked(questionsToXml).mockImplementationOnce(() => {
            throw new Error("SQQ serialization failed");
        });

        await expect(exportRounds([makeRound(1, ["standard"])]))
            .rejects.toThrow("SQQ serialization failed");
        expect(downloads).toHaveLength(0);
    });

    it("propagates a nearest round serialization error without downloading", async () => {
        vi.mocked(nearestRoundToXml).mockImplementationOnce(() => {
            throw new Error("SQN serialization failed");
        });

        await expect(exportRounds([makeRound(1, ["nearest"])]))
            .rejects.toThrow("SQN serialization failed");
        expect(downloads).toHaveLength(0);
    });

    it("does not download a partially serialized ZIP when a later serializer fails", async () => {
        vi.mocked(nearestRoundToXml).mockImplementationOnce(() => {
            throw new Error("Bad nearest answer");
        });

        await expect(exportRounds([
            makeRound(1, ["standard"]),
            makeRound(2, ["nearest"])
        ])).rejects.toThrow("Bad nearest answer");

        expect(questionsToXml).toHaveBeenCalledTimes(1);
        expect(downloads).toHaveLength(0);
        expect(activeUrls.size).toBe(0);
    });
});

describe("exportRounds: single-file downloads", () => {
    it.each([
        "standard", "multi", "sequence", "numerical"
    ] as QuestionType[])(
        "exports a single %s round as SQQ",
        async type => {
            const round = makeRound(1, [type]);
            const zipSpy = vi.spyOn(JSZip.prototype, "generateAsync");

            await exportRounds([round]);

            expect(questionsToXml).toHaveBeenCalledTimes(1);
            expect(questionsToXml).toHaveBeenCalledWith(round.questions);
            expect(nearestRoundToXml).not.toHaveBeenCalled();
            expect(downloads).toHaveLength(1);
            expect(downloads[0].filename).toBe("Round_1.sqq");
            expect(downloads[0].blob.type).toBe("application/xml;charset=utf-8");
            expect(await readText(downloads[0].blob)).toBe(fakeSqq(round.questions));
            expect(zipSpy).not.toHaveBeenCalled();
            expect(downloads[0].attachedWhenClicked).toBe(true);
            expect(document.querySelector("a[href^='blob:']")).toBeNull();
        }
    );

    it("exports a single nearest round as SQN, passing the entire round", async () => {
        const round = makeRound(1, ["nearest", "nearest"], "Nearest & Wins");
        round.questions[0].questionInfo.pictureBaseString = "image-data";

        await exportRounds([round]);

        expect(nearestRoundToXml).toHaveBeenCalledTimes(1);
        expect(nearestRoundToXml).toHaveBeenCalledWith(round);
        expect(questionsToXml).not.toHaveBeenCalled();
        expect(downloads).toHaveLength(1);
        expect(downloads[0].filename).toBe("Round_1.sqn");
        expect(await readText(downloads[0].blob)).toBe(fakeSqn(round));
        expect(downloads[0].blob.type).toBe("application/xml;charset=utf-8");
    });

    it("preserves the exact XML string supplied by the serializer", async () => {
        const xml = '<?xml version="1.0"?><round><q>🧠 &amp; café</q></round>';
        vi.mocked(questionsToXml).mockReturnValueOnce(xml);

        await exportRounds([makeRound(1, ["standard"])]);
        expect(await readText(downloads[0].blob)).toBe(xml);
    });

    it("uses numeric filenames even if the round title contains unsafe characters", async () => {
        await exportRounds([makeRound(1, ["standard"], "../illegal:<title>?*")]);
        expect(downloads[0].filename).toBe("Round_1.sqq");
    });

    it("does not mutate a round or its questions", async () => {
        const round = makeRound(1, ["standard", "multi"]);
        const snapshot = JSON.parse(JSON.stringify(round)) as Round;

        Object.freeze(round.questions[0].questionInfo);
        Object.freeze(round.questions[0]);
        Object.freeze(round.questions);
        Object.freeze(round);
        const rounds = Object.freeze([round]);

        await exportRounds(rounds as unknown as Round[]);

        expect(round).toEqual(snapshot);
    });
});

describe("exportRounds: ZIP files", () => {
    it("exports two standard rounds in order with original filenames", async () => {
        const first = makeRound(1, ["standard"]);
        const second = makeRound(2, ["multi", "numerical"]);

        await exportRounds([first, second]);

        expect(downloads).toHaveLength(1);
        expect(downloads[0].filename).toBe("Quiz_Rounds.zip");
        expect(downloads[0].attachedWhenClicked).toBe(true);

        const zip = await loadDownloadedZip();
        expect(Object.keys(zip.files).sort()).toEqual([
            "Round_1.sqq", "Round_2.sqq"
        ]);
        expect(await zip.file("Round_1.sqq")!.async("string"))
            .toBe(fakeSqq(first.questions));
        expect(await zip.file("Round_2.sqq")!.async("string"))
            .toBe(fakeSqq(second.questions));
        expect(nearestRoundToXml).not.toHaveBeenCalled();
    });

    it("exports a mixed set of round types with correct extensions and contents", async () => {
        const rounds = [
            makeRound(1, ["nearest"], "Nearest 1"),
            makeRound(2, ["sequence"], "Normal"),
            makeRound(3, ["nearest", "nearest"], "Nearest 2"),
            makeRound(4, ["standard", "numerical"])
        ];

        await exportRounds(rounds);

        const zip = await loadDownloadedZip();
        expect(Object.keys(zip.files).sort()).toEqual([
            "Round_1.sqn",
            "Round_2.sqq",
            "Round_3.sqn",
            "Round_4.sqq"
        ]);

        expect(await zip.file("Round_1.sqn")!.async("string"))
            .toBe(fakeSqn(rounds[0]));
        expect(await zip.file("Round_2.sqq")!.async("string"))
            .toBe(fakeSqq(rounds[1].questions));
        expect(await zip.file("Round_3.sqn")!.async("string"))
            .toBe(fakeSqn(rounds[2]));
        expect(await zip.file("Round_4.sqq")!.async("string"))
            .toBe(fakeSqq(rounds[3].questions));

        expect(nearestRoundToXml).toHaveBeenCalledTimes(2);
        expect(questionsToXml).toHaveBeenCalledTimes(2);
    });

    it("exports multiple nearest-only rounds as an SQN ZIP", async () => {
        const rounds = [makeRound(1, ["nearest"]), makeRound(2, ["nearest"])];
        await exportRounds(rounds);

        const zip = await loadDownloadedZip();
        expect(Object.keys(zip.files).sort()).toEqual([
            "Round_1.sqn", "Round_2.sqn"
        ]);
        expect(questionsToXml).not.toHaveBeenCalled();
    });

    it("uses DEFLATE compression level 6", async () => {
        const generate = vi.spyOn(JSZip.prototype, "generateAsync");
        await exportRounds([
            makeRound(1, ["standard"]),
            makeRound(2, ["standard"])
        ]);

        expect(generate).toHaveBeenCalledTimes(1);
        expect(generate).toHaveBeenCalledWith({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });
    });

    it("can export many rounds without losing or overwriting filenames", async () => {
        const rounds = Array.from({ length: 32 }, (_, index) =>
            makeRound(index + 1, [index % 2 === 0 ? "standard" : "nearest"])
        );

        await exportRounds(rounds);

        const zip = await loadDownloadedZip();
        expect(Object.keys(zip.files)).toHaveLength(32);

        for (let index = 0; index < rounds.length; index++) {
            const filename = `Round_${index + 1}.${index % 2 === 0 ? "sqq" : "sqn"}`;
            expect(zip.file(filename)).not.toBeNull();
        }
    });

    it("does not download when ZIP compression fails", async () => {
        vi.spyOn(JSZip.prototype, "generateAsync")
            .mockRejectedValueOnce(new Error("ZIP compression failed"));

        await expect(exportRounds([
            makeRound(1, ["standard"]),
            makeRound(2, ["nearest"])
        ])).rejects.toThrow("ZIP compression failed");

        expect(downloads).toHaveLength(0);
        expect(activeUrls.size).toBe(0);
    });

    it("does not download when adding an entry to the ZIP fails", async () => {
        vi.spyOn(JSZip.prototype, "file")
            .mockImplementationOnce(() => {
                throw new Error("ZIP entry failed");
            });

        await expect(exportRounds([
            makeRound(1, ["standard"]),
            makeRound(2, ["standard"])
        ])).rejects.toThrow("ZIP entry failed");

        expect(downloads).toHaveLength(0);
    });
});

describe("exportRounds: browser resource cleanup", () => {
    it("keeps the object URL alive for 999 ms, then revokes it at 1000 ms", async () => {
        vi.useFakeTimers();
        await exportRounds([makeRound(1, ["standard"])]);

        expect(downloads).toHaveLength(1);
        expect(activeUrls.size).toBe(1);
        vi.advanceTimersByTime(999);
        expect(activeUrls.size).toBe(1);
        vi.advanceTimersByTime(1);
        expect(activeUrls.size).toBe(0);
    });

    it("does not leave anchor elements behind after successive downloads", async () => {
        await exportRounds([makeRound(1, ["standard"])]);
        await exportRounds([makeRound(2, ["nearest"])]);

        expect(downloads.map(download => download.filename)).toEqual([
            "Round_1.sqq", "Round_1.sqn"
        ]);
        expect(downloads.map(download => download.url)).toEqual([
            "blob:test-round-export-1", "blob:test-round-export-2"
        ]);
        expect(document.querySelectorAll("a[href^='blob:']")).toHaveLength(0);
    });

    it("removes the anchor and revokes the URL even when link.click throws", async () => {
        vi.useFakeTimers();
        vi.spyOn(HTMLAnchorElement.prototype, "click")
            .mockImplementationOnce(() => {
                throw new Error("Browser blocked download");
            });

        await expect(exportRounds([makeRound(1, ["standard"])]))
            .rejects.toThrow("Browser blocked download");

        expect(downloads).toHaveLength(0);
        expect(document.querySelectorAll("a[href^='blob:']")).toHaveLength(0);
        expect(activeUrls.size).toBe(1);

        vi.advanceTimersByTime(1000);
        expect(activeUrls.size).toBe(0);
    });

    it("removes the anchor and revokes the URL when appendChild throws", async () => {
        vi.useFakeTimers();
        vi.spyOn(document.body, "appendChild")
            .mockImplementationOnce(() => {
                throw new Error("Cannot append download link");
            });

        await expect(exportRounds([makeRound(1, ["nearest"])]))
            .rejects.toThrow("Cannot append download link");

        expect(document.querySelectorAll("a[href^='blob:']")).toHaveLength(0);
        expect(activeUrls.size).toBe(1);
        vi.advanceTimersByTime(1000);
        expect(activeUrls.size).toBe(0);
    });

    it("propagates failures from createObjectURL without triggering a click", async () => {
        vi.spyOn(URL, "createObjectURL").mockImplementationOnce(() => {
            throw new Error("Object URL unavailable");
        });

        await expect(exportRounds([makeRound(1, ["standard"])]))
            .rejects.toThrow("Object URL unavailable");

        expect(downloads).toHaveLength(0);
        expect(activeUrls.size).toBe(0);
        expect(document.querySelectorAll("a[href^='blob:']")).toHaveLength(0);
    });
});
