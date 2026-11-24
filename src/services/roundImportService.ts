import type { EditorQuestion, Question, Round } from "../models/Question";
import { xmlToQuestions } from "./xmlService";

export interface RoundImportError {
    filename: string;
    message: string;
}

export interface RoundImportResult {
    rounds: Round[];
    errors: RoundImportError[];
}

const getDirectChild = (parent: Element, name: string): Element | null => {
    for (
        let child = parent.firstElementChild;
        child !== null;
        child = child.nextElementSibling
    ) {
        if (child.tagName === name) return child;
    }
    return null;
};

const getChildText = (parent: Element, name: string): string =>
    getDirectChild(parent, name)?.textContent ?? "";

const fileTitle = (filename: string): string =>
    filename.replace(/\.(sqq|sqn)$/i, "");

const parseRoundDocument = (source: string): { document: XMLDocument; xml: string } => {
    const parser = new DOMParser();
    let xml = source.trim();
    let document = parser.parseFromString(xml, "application/xml");
    let error = document.querySelector("parsererror");

    if (error) {
        const repaired = xml.replace(/ & /g, " and ");
        if (repaired !== xml) {
            xml = repaired;
            document = parser.parseFromString(xml, "application/xml");
            error = document.querySelector("parsererror");
        }
    }

    if (error) {
        throw new Error("Invalid XML: " + (error.textContent?.trim() || "parse error"));
    }

    if (document.documentElement.tagName !== "round") {
        throw new Error("The file must contain a <round> root element.");
    }

    return { document, xml };
};

const parseNearestQuestions = (questionsElement: Element): EditorQuestion[] => {
    const questionElements = Array.from(questionsElement.children).filter(
        element => element.tagName === "question"
    );

    return questionElements.map((element, index): EditorQuestion => {
        const answerText = getChildText(element, "short_answer").trim();
        const value = Number(answerText);

        if (answerText === "" || !Number.isFinite(value)) {
            throw new Error(
                `Nearest Wins question ${index + 1} requires a valid numerical answer.`
            );
        }

        return {
            clientId: crypto.randomUUID(),
            type: "nearest",
            questionInfo: {
                id: index + 1,
                userView: "",
                questionText: getChildText(element, "q"),
                pictureBaseString: getChildText(element, "picture").trim(),
                info: ""
            },
            answer: { value }
        };
    });
};

export const importRoundFile = async (file: File): Promise<Round> => {
    const extension = file.name.match(/\.(sqq|sqn)$/i)?.[1]?.toLowerCase();
    if (!extension) {
        throw new Error("Only .sqq and .sqn files are supported.");
    }

    const { document, xml } = parseRoundDocument(await file.text());
    const root = document.documentElement;
    const game = getChildText(root, "game").trim();
    const questionsElement = getDirectChild(root, "questions");

    if (!questionsElement) {
        throw new Error("The round has no <questions> element.");
    }

    if (extension === "sqn" && game !== "Nearest Wins") {
        throw new Error("SQN files must contain <game>Nearest Wins</game>.");
    }
    if (extension === "sqq" && game === "Nearest Wins") {
        throw new Error("Nearest Wins rounds must use the .sqn extension.");
    }

    let questions: EditorQuestion[];

    if (extension === "sqn") {
        questions = parseNearestQuestions(questionsElement);
    } else {
        const parsedQuestions: Question[] = xmlToQuestions(xml);
        questions = parsedQuestions.map(question => ({
            ...question,
            clientId: crypto.randomUUID()
        }));
    }

    if (questions.length === 0) {
        throw new Error("The round contains no questions.");
    }

    return {
        id: crypto.randomUUID(),
        title: getChildText(root, "title").trim() || fileTitle(file.name),
        questions
    };
};

export const importRoundFiles = async (
    files: FileList | readonly File[]
): Promise<RoundImportResult> => {
    const selected = Array.from(files);
    const results = await Promise.allSettled(selected.map(importRoundFile));
    const rounds: Round[] = [];
    const errors: RoundImportError[] = [];

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            rounds.push(result.value);
        } else {
            errors.push({
                filename: selected[index]!.name,
                message: result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason)
            });
        }
    });

    return { rounds, errors };
};

export const shouldCollapseImportedRounds = (
    hasImportedBefore: boolean,
    importedCount: number
): boolean => hasImportedBefore || importedCount > 1;
