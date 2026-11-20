
import JSZip from "jszip";

import type { Round } from "../models/Question";
import { getRoundKind } from "./roundHelpers";
import { questionsToXml, nearestRoundToXml } from "../services/xmlService";

const downloadFile = (
    blob: Blob,
    filename: string
): void => {
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportRounds = async (
    rounds: Round[]
): Promise<void> => {
    if (rounds.length === 0) {
        throw new Error("There are no rounds to export.");
    }

    const files = rounds.map((round, index) => {
        const roundKind = getRoundKind(round.questions);

        if (roundKind === "empty") {
            throw new Error(
                `Round ${index + 1} has no questions.`
            );
        }

        if (roundKind === "mixed") {
            throw new Error(
                `Round ${index + 1} contains a mixture of ` +
                "nearest guess and normal questions."
            );
        }

        const isNearest = roundKind === "nearest";

        const extension = isNearest ? "sqn" : "sqq";

        const xml = isNearest
            ? nearestRoundToXml(round)
            : questionsToXml(round.questions);

        return {
            filename: `Round_${index + 1}.${extension}`,
            xml
        };
    });

    if (files.length === 1) {
        const blob = new Blob([files[0].xml], {
            type: "application/xml;charset=utf-8"
        });

        downloadFile(blob, files[0].filename);
        return;
    }

    const zip = new JSZip();

    files.forEach(file => {
        zip.file(file.filename, file.xml);
    });

    const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
            level: 6
        }
    });

    downloadFile(zipBlob, "Quiz_Rounds.zip");
};
