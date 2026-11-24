export function fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        const cleanup = (): void => {
            reader.onload = null;
            reader.onerror = null;
            reader.onabort = null;
        };

        reader.onload = () => {
            const result = reader.result;
            cleanup();

            if (typeof result !== "string") {
                reject(new Error("Could not read the image."));
                return;
            }

            resolve(result.slice(result.indexOf(",") + 1));
        };

        reader.onerror = () => {
            const error = reader.error;
            cleanup();
            reject(error ?? new Error("Failed to read the file."));
        };

        reader.onabort = () => {
            cleanup();
            reject(new Error("File reading was cancelled."));
        };

        try {
            reader.readAsDataURL(file);
        } catch (error) {
            cleanup();
            reject(error);
        }
    });
}


export function getPictureSrc (
    base64: string,
    filename?: string
): string {
    const data = base64.trim();

    if (/^data:image\/[\w.+-]+;base64,/i.test(data)) {
        return data;
    }

    let mimeType: string;

    if (data.startsWith("/9j/")) {
        mimeType = "image/jpeg";
    } else if (data.startsWith("iVBORw0KGgo")) {
        mimeType = "image/png";
    } else if (data.startsWith("R0lGOD")) {
        mimeType = "image/gif";
    } else if (data.startsWith("UklGR")) {
        mimeType = "image/webp";
    } else {
        const extension = filename
            ?.split(".")
            .pop()
            ?.toLowerCase();

        const mimeTypes: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            bmp: "image/bmp",
            avif: "image/avif",
            svg: "image/svg+xml"
        };

        mimeType = mimeTypes[extension ?? ""] ?? "image/jpeg";
    }

    return `data:${mimeType};base64,${data}`;
};
