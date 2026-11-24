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
