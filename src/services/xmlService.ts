import type { Question } from '../models/Question';

const escapeXml = (value: string): string => {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
};

const xmlElement = (
    name: string,
    value: string | number,
    indent = 3
): string => {
    const tabs = "\t".repeat(indent);
    const text = escapeXml(String(value));

    return text === ""
        ? `${tabs}<${name}/>`
        : `${tabs}<${name}>${text}</${name}>`;
};

const questionToXml = (question: Question): string => {
    const { questionInfo } = question;

    let shortAnswer = "";
    let longAnswer = "";
    let options: string[] | null = null;

    if ("answers" in question) {
        const answerOptions = question.answers.answerOptions;

        options = answerOptions.map(a => a.optionText);

        const correctIndexes = answerOptions
            .map((a, i) => a.correct ? i : -1)
            .filter(i => i !== -1);

        if (correctIndexes.length !== 1 ||
            correctIndexes[0] >= 26) {
            throw new Error(
                `Question ${questionInfo.id} must have exactly ` +
                "one correct answer among options A-Z."
            );
        }

        shortAnswer = String.fromCharCode(
            65 + correctIndexes[0]
        );
    }

    else if ("optionsInOrder" in question.answer) {
        options = question.answer.optionsInOrder;
    }

    else {
        shortAnswer = question.answer.shortAnswer;
        longAnswer = question.answer.answerText;
    }

    const lines: string[] = [
        "\t\t<question>",
        xmlElement("user_view", questionInfo.userView),
        xmlElement("q", questionInfo.questionText),
        xmlElement("short_answer", shortAnswer),
        xmlElement("long_answer", longAnswer)
    ];

    if (options !== null) {
        lines.push("\t\t\t<options>");

        options.forEach(option => {
            lines.push(xmlElement("option", option, 4));
        });

        lines.push("\t\t\t</options>");
    }

    lines.push(
        xmlElement("info", questionInfo.info ?? "")
    );

    if (questionInfo.pictureBaseString?.trim()) {
        const base64 = questionInfo.pictureBaseString
            .trim()
            .replace(/^data:[^,]+;base64,/i, "");

        lines.push(xmlElement("picture", base64));
    }

    lines.push(
        xmlElement("id", questionInfo.id),
        "\t\t</question>"
    );

    return lines.join("\n");
};

export const questionsToXml = (
    questions: Question[]
): string => {
    const questionElements = questions
        .map(questionToXml)
        .join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
    <round>
    <game>Quizsentials</game>
    <title>Speedquizzing Helper</title>
    <points_per_question>4</points_per_question>
    <go_wide>false</go_wide>
	<speed_bonus>true</speed_bonus>
    <questions>
${questionElements}
</questions>
</round>`;
};

const getChild = (
    parent: Element,
    name: string
): Element | undefined =>
    Array.from(parent.children).find(
        child => child.tagName === name
    );

const getText = (
    parent: Element,
    name: string
): string =>
    getChild(parent, name)?.textContent ?? "";

const getOptions = (question: Element): string[] => {
    const optionsElement = getChild(question, "options");

    if (!optionsElement) {
        return [];
    }

    return Array.from(optionsElement.children)
        .filter(element => element.tagName === "option")
        .map(element => element.textContent ?? "");
};

export const xmlToQuestions = (xml: string): Question[] => {
    const parser = new DOMParser();

    const indexOfQuestionsTag = xml.indexOf("<questions>");

    const safeXml = xml.replace(/ & /g, " and ").trim();

    const document = parser.parseFromString(
        safeXml,
        "application/xml"
    );

    const parserError = document.querySelector("parsererror");

    if (parserError) {
        console.error("XML Parsing Error:", parserError.textContent);

        throw new Error(
            `Invalid XML: ${parserError.textContent}`
        );
    }

    const questionsElement = document.querySelector("round > questions");

    if (!questionsElement) {
        throw new Error("Could not find <questions> inside <round>.");
    }

    const questionElements = Array.from(
        questionsElement.children
    ).filter(element => element.tagName === "question");

    return questionElements.map(element => {
        const idText = getText(element, "id").trim();
        const id = Number(idText);

        if (!idText || !Number.isSafeInteger(id)) {
            throw new Error(`Invalid question ID: ${idText}`);
        }

        const userView = getText(
            element,
            "user_view"
        ).trim();

        const questionInfo: QuestionInfo = {
            id,
            userView,
            questionText: getText(element, "q"),
            pictureBaseString: getText(
                element,
                "picture"
            ).trim(),
            info: getText(element, "info")
        };

        if (userView === "multi") {
            const options = getOptions(element);

            const answerLetter = getText(
                element,
                "short_answer"
            ).trim().toUpperCase();

            const correctIndex =
                answerLetter.charCodeAt(0) - 65;

            if (
                !/^[A-Z]$/.test(answerLetter) ||
                correctIndex >= options.length ||
                correctIndex < 0
            ) {
                throw new Error(
                    `Invalid multiple-choice answer for question ${id}`
                );
            }

            return {
                questionInfo,
                answers: {
                    answerOptions: options.map(
                        (optionText, index) => ({
                            optionText,
                            correct: index === correctIndex
                        })
                    )
                }
            } satisfies MultipleChoiceQuestion;
        }

        if (userView === "sequence") {
            return {
                questionInfo,
                answer: {
                    optionsInOrder: getOptions(element)
                }
            } satisfies SequenceQuestion;
        }

        return {
            questionInfo,
            answer: {
                answerText: getText(
                    element,
                    "long_answer"
                ),
                shortAnswer: getText(
                    element,
                    "short_answer"
                )
            }
        } satisfies StandardQuestion;
    });
};

export const importQuestionFiles = async (
    files: FileList | File[]
): Promise<Question[]> => {
    const selectedFiles = Array.from(files);

    if (selectedFiles.length !== 3) {
        throw new Error(
            "Please select exactly three XML files."
        );
    }

    const questionArrays = await Promise.all(
        selectedFiles.map(async file => {
            if (!file.name.toLowerCase().endsWith(".xml")) {
                throw new Error(
                    `${file.name} is not an XML file.`
                );
            }

            const xml = await file.text();

            return xmlToQuestions(xml);
        })
    );

    const combinedQuestions = questionArrays.flat();

    if (combinedQuestions.length !== 60) {
        throw new Error(
            `Expected 60 questions, but found ${combinedQuestions.length}.`
        );
    }

    return combinedQuestions;
};

export const importQuestionFile = async (
    file: File
): Question[] => {
    const xml = await file.text();
    return xmlToQuestions(xml);
};


export const exportQuestionFiles = (
    questions: Question[],
    roundName: string
): void => {
    const numberOfFiles = 4;
    const questionsPerFile = 15;

    if (questions.length !== 60) {
        throw new Error(
            `Expected 60 questions, but found ${questions.length}.`
        );
    }

    for (let i = 0; i < numberOfFiles; i++) {
        const start = i * questionsPerFile;
        const end = start + questionsPerFile;

        const questionSubset = questions.slice(
            start,
            end
        );

        const xml = questionsToXml(questionSubset);

        const blob = new Blob([xml], {
            type: "application/xml;charset=utf-8"
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${roundName !== "" ? roundName : "questions"}_${i + 1}.sqq`;

        document.body.appendChild(link);

        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};


export const downloadQuestionsXml = (questions: Question[], roundName: string) => {
    const xml = questionsToXml(questions);

    const blob = new Blob([xml], {
        type: "application/xml;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = roundName + ".sqq";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
};