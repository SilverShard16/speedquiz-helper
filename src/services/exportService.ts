import JSZip from "jszip";

import type { Round } from "../models/Question";
import { getRoundKind } from "./roundHelpers";
import { questionsToXml, nearestRoundToXml } from "../services/xmlService";

const XML_MIME_TYPE = "application/xml;charset=utf-8";
const ARCHIVE_NAME = "Quiz_Rounds.zip";
const DOWNLOAD_URL_LIFETIME_MS = 1000;

interface ExportFile {
    filename: string;
    xml: string;
}

const createExportFile = (round: Round, index: number): ExportFile => {
    const roundNumber = index + 1;

    switch (getRoundKind(round.questions)) {
        case "empty":
            throw new Error(`Round ${roundNumber} has no questions.`);

        case "mixed":
            throw new Error(
                `Round ${roundNumber} contains a mixture of ` +
                "nearest guess and normal questions."
            );

        case "nearest":
            return {
                filename: `Round_${roundNumber}.sqn`,
                xml: nearestRoundToXml(round)
            };

        case "normal":
            return {
                filename: `Round_${roundNumber}.sqq`,
                xml: questionsToXml(round.questions)
            };

        default:
            throw new Error(`Round ${roundNumber} has an unsupported round type.`);
    }
};

const downloadFile = (blob: Blob, filename: string): void => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    try {
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
    }
};

export const exportRounds = async (rounds: Round[]): Promise<void> => {
    if (rounds.length === 0) {
        throw new Error("There are no rounds to export.");
    }

    const files = rounds.map(createExportFile);

    if (files.length === 1) {
        downloadFile(
            new Blob([files[0].xml], { type: XML_MIME_TYPE }),
            files[0].filename
        );
        return;
    }

    const zip = new JSZip();

    for (const { filename, xml } of files) {
        zip.file(filename, xml);
    }

    const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    downloadFile(blob, ARCHIVE_NAME);
};
