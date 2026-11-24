import JSZip from "jszip";

import type {
    Question,
    QuestionInfo,
    MultipleChoiceQuestion,
    SequenceQuestion,
    StandardQuestion,
    NumericalQuestion,
    Round
} from "../models/Question";

import { getRoundKind } from "../services/roundHelpers";

const XML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
};

const escapeXml = (value: string): string =>
    value.replace(/[&<>"']/g, character => XML_ENTITIES[character]);

const xmlElement = (
    name: string,
    value: string | number,
    indent = 3
): string => {
    const prefix = "\t".repeat(indent);
    const escaped = escapeXml(String(value));

    return escaped
        ? `${prefix}<${name}>${escaped}</${name}>`
        : `${prefix}<${name}/>`;
};

const pictureXml = (questionInfo: QuestionInfo): string | null => {
    const original = questionInfo.pictureBaseString?.trim();

    if (!original) {
        return null;
    }

    const base64 = original.replace(/^data:[^,]+;base64,/i, "");
    return xmlElement("picture", base64);
};

const questionToXml = (question: Question): string => {
    const { questionInfo } = question;

    let shortAnswer = "";
    let longAnswer = "";
    let options: string[] | null = null;

    switch (question.type) {
        case "standard":
            shortAnswer = question.answer.shortAnswer;
            longAnswer = question.answer.answerText;
            break;

        case "multi": {
            const answerOptions = question.answers.answerOptions;
            let correctIndex = -1;
            let correctCount = 0;

            options = answerOptions.map((answer, index) => {
                if (answer.correct) {
                    correctIndex = index;
                    correctCount++;
                }

                return answer.optionText;
            });

            if (correctCount !== 1 || correctIndex >= 26) {
                throw new Error(
                    `Question ${questionInfo.id} must have exactly ` +
                    "one correct answer among options A-Z."
                );
            }

            shortAnswer = String.fromCharCode(65 + correctIndex);
            break;
        }

        case "sequence":
            options = question.answer.optionsInOrder;
            break;

        case "numerical": {
            const value = question.answer.value;

            if (value === null || !Number.isFinite(value)) {
                throw new Error(
                    `Question ${questionInfo.id} requires a valid numerical answer.`
                );
            }

            shortAnswer = String(value);
            break;
        }

        case "nearest":
            throw new Error("Nearest guess questions are not yet supported.");

        default:
            throw new Error("Unrecognised question type.");
    }

    const userView =
        question.type === "numerical" ? "numbers" : questionInfo.userView;

    const lines = [
        "\t\t<question>",
        xmlElement("user_view", userView),
        xmlElement("q", questionInfo.questionText),
        xmlElement("short_answer", shortAnswer),
        xmlElement("long_answer", longAnswer)
    ];

    if (options !== null) {
        lines.push("\t\t\t<options>");

        for (const option of options) {
            lines.push(xmlElement("option", option, 4));
        }

        lines.push("\t\t\t</options>");
    }

    if (question.type !== "numerical") {
        lines.push(xmlElement("info", questionInfo.info ?? ""));
    }

    const picture = pictureXml(questionInfo);
    if (picture !== null) {
        lines.push(picture);
    }

    lines.push(
        xmlElement("id", questionInfo.id),
        "\t\t</question>"
    );

    return lines.join("\n");
};

export const questionsToXml = (questions: Question[]): string => {
    const questionElements = questions.map(questionToXml).join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
    <round>
    <game>Quizsentials</game>
    <title>Speedquizzing Helper</title>
    <points_per_question>4</points_per_question>
    <go_wide>false</go_wide>
\t<speed_bonus>true</speed_bonus>
    <questions>
${questionElements}
</questions>
</round>`;
};

const nearestQuestionToXml = (question: Round["questions"][number]): string => {
    if (question.type !== "nearest") {
        throw new Error("Invalid nearest guess question.");
    }

    const value = question.answer.value;

    if (value === null || !Number.isFinite(value)) {
        throw new Error(
            "All nearest guess questions require a numerical answer."
        );
    }

    const lines = [
        "\t\t<question>",
        xmlElement("q", question.questionInfo.questionText),
        xmlElement("short_answer", String(value)),
        xmlElement("long_answer", "")
    ];

    const picture = pictureXml(question.questionInfo);
    if (picture !== null) {
        lines.push(picture);
    }

    lines.push("\t\t</question>");
    return lines.join("\n");
};

export const nearestRoundToXml = (round: Round): string => {
    if (getRoundKind(round.questions) !== "nearest") {
        throw new Error(
            "Nearest Wins rounds must contain only nearest guess questions."
        );
    }

    const questionElements = round.questions
        .map(nearestQuestionToXml)
        .join("\n");

    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<round>",
        "\t<game>Nearest Wins</game>",
        xmlElement("title", round.title, 1),
        "\t<points_per_question>0</points_per_question>",
        "\t<questions>",
        questionElements,
        "\t</questions>",
        "</round>"
    ].join("\n");
};

const getChild = (
    parent: Element,
    name: string
): Element | undefined => {
    for (
        let child = parent.firstElementChild;
        child !== null;
        child = child.nextElementSibling
    ) {
        if (child.tagName === name) {
            return child;
        }
    }

    return undefined;
};

const getText = (parent: Element, name: string): string =>
    getChild(parent, name)?.textContent ?? "";

const getOptions = (question: Element): string[] => {
    const container = getChild(question, "options");

    if (!container) {
        return [];
    }

    const options: string[] = [];

    for (
        let child = container.firstElementChild;
        child !== null;
        child = child.nextElementSibling
    ) {
        if (child.tagName === "option") {
            options.push(child.textContent ?? "");
        }
    }

    return options;
};

const parseXmlDocument = (xml: string): XMLDocument => {
    const source = xml.trim();
    const parser = new DOMParser();

    let document = parser.parseFromString(source, "application/xml");
    let parserError = document.querySelector("parsererror");

    if (parserError) {
        const legacySource = source.replace(/ & /g, " and ");

        if (legacySource !== source) {
            document = parser.parseFromString(
                legacySource,
                "application/xml"
            );
            parserError = document.querySelector("parsererror");
        }
    }

    if (parserError) {
        console.error("XML Parsing Error:", parserError.textContent);
        throw new Error(`Invalid XML: ${parserError.textContent}`);
    }

    return document;
};

const parseQuestion = (element: Element): Question => {
    const idText = getText(element, "id").trim();
    const id = Number(idText);

    if (!idText || !Number.isSafeInteger(id)) {
        throw new Error(`Invalid question ID: ${idText}`);
    }

    const userView = getText(element, "user_view").trim();

    const questionInfo: QuestionInfo = {
        id,
        userView,
        questionText: getText(element, "q"),
        pictureBaseString: getText(element, "picture").trim(),
        info: getText(element, "info")
    };

    switch (userView) {
        case "multi": {
            const options = getOptions(element);
            const answerLetter = getText(
                element,
                "short_answer"
            ).trim().toUpperCase();

            const correctIndex = answerLetter.charCodeAt(0) - 65;

            if (
                !/^[A-Z]$/.test(answerLetter) ||
                correctIndex < 0 ||
                correctIndex >= options.length
            ) {
                throw new Error(
                    `Invalid multiple-choice answer for question ${id}`
                );
            }

            return {
                type: "multi",
                questionInfo,
                answers: {
                    answerOptions: options.map((optionText, index) => ({
                        optionText,
                        correct: index === correctIndex
                    }))
                }
            } satisfies MultipleChoiceQuestion;
        }

        case "sequence":
            return {
                type: "sequence",
                questionInfo,
                answer: {
                    optionsInOrder: getOptions(element)
                }
            } satisfies SequenceQuestion;

        case "numbers": {
            const answerText = getText(
                element,
                "short_answer"
            ).trim();

            const value = Number(answerText);

            if (!answerText || !Number.isFinite(value)) {
                throw new Error(
                    `Invalid numerical answer for question ${id}`
                );
            }

            return {
                type: "numerical",
                questionInfo,
                answer: { value }
            } satisfies NumericalQuestion;
        }

        default:
            return {
                type: "standard",
                questionInfo,
                answer: {
                    answerText: getText(element, "long_answer"),
                    shortAnswer: getText(element, "short_answer")
                }
            } satisfies StandardQuestion;
    }
};

export const xmlToQuestions = (xml: string): Question[] => {
    const document = parseXmlDocument(xml);

    const questionsElement = document.querySelector("round > questions");

    if (!questionsElement) {
        throw new Error("Could not find <questions> inside <round>.");
    }

    return Array.from(questionsElement.children)
        .filter(element => element.tagName === "question")
        .map(parseQuestion);
};

export const importQuestionFile = async (
    file: File
): Promise<Question[]> => xmlToQuestions(await file.text());

export const importQuestionFiles = async (
    files: FileList | File[]
): Promise<Question[]> => {
    const selectedFiles = Array.from(files);

    if (selectedFiles.length !== 3) {
        throw new Error("Please select exactly three XML/SQQ files.");
    }

    const results = await Promise.all(
        selectedFiles.map(file => {
            if (!/\.(xml|sqq)$/i.test(file.name)) {
                throw new Error(
                    `${file.name} is not an XML or SQQ file.`
                );
            }

            return importQuestionFile(file);
        })
    );

    return results.flat();
};

const DEFAULT_FILENAME = "questions";
const XML_MIME_TYPE = "application/xml;charset=utf-8";

const safeFileBaseName = (name: string): string => {
    const cleaned = name
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/[. ]+$/g, "");

    return cleaned || DEFAULT_FILENAME;
};

const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    try {
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};

const downloadSqq = (
    questions: Question[],
    roundName: string
): void => {
    const xml = questionsToXml(questions);
    const blob = new Blob([xml], { type: XML_MIME_TYPE });

    downloadBlob(blob, `${safeFileBaseName(roundName)}.sqq`);
};

export const exportQuestionFiles = async (
    questions: Question[],
    roundName: string
): Promise<void> => {
    const numberOfFiles = 4;
    const questionsPerFile = Math.floor(questions.length / numberOfFiles);
    const fileName = safeFileBaseName(roundName);

    const zip = new JSZip();

    for (let index = 0; index < numberOfFiles; index++) {
        const start = index * questionsPerFile;

        const end = index === numberOfFiles - 1
            ? questions.length
            : start + questionsPerFile;

        const xml = questionsToXml(questions.slice(start, end));
        zip.file(`${fileName}_${index + 1}.sqq`, xml);
    }

    const archive = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    downloadBlob(archive, `${fileName}.zip`);
};

export const exportSingleRound = (
    questions: Question[],
    roundName: string
): void => {
    downloadSqq(questions, roundName);
};

export const downloadQuestionsXml = exportSingleRound;