// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileToBase64 } from "./pictureService";

const makeFile = (
    content: BlobPart = "Hello, world!",
    name = "sample.jpg",
    type = "image/jpeg"
): File => new File([content], name, { type });

const utf8Base64 = (text: string): string => {
    const bytes = new TextEncoder().encode(text);
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
};

const bytesBase64 = (bytes: Uint8Array): string =>
    btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));

class ControlledFileReader {
    static instances: ControlledFileReader[] = [];

    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;

    constructor() {
        ControlledFileReader.instances.push(this);
    }

    readAsDataURL(_file: Blob): void {
    }

    complete(result: string | ArrayBuffer | null): void {
        this.result = result;
        this.onload?.();
    }

    fail(error: DOMException | null = null): void {
        this.error = error;
        this.onerror?.();
    }

    abort(): void {
        this.onabort?.();
    }
}

const startControlledRead = (file: File = makeFile()) => {
    ControlledFileReader.instances = [];
    vi.stubGlobal("FileReader", ControlledFileReader);
    const readSpy = vi.spyOn(
        ControlledFileReader.prototype,
        "readAsDataURL"
    );

    const promise = fileToBase64(file);
    const reader = ControlledFileReader.instances[0];

    expect(reader).toBeDefined();
    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(readSpy).toHaveBeenCalledWith(file);

    return { reader, promise, readSpy };
};

const expectCleanedUp = (reader: ControlledFileReader): void => {
    expect(reader.onload).toBeNull();
    expect(reader.onerror).toBeNull();
    expect(reader.onabort).toBeNull();
};

beforeEach(() => {
    ControlledFileReader.instances = [];
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("fileToBase64: real FileReader integration (jsdom)", () => {
    it("returns Base64 for an ordinary JPEG file", async () => {
        const text = "Hello, world!";
        const result = await fileToBase64(makeFile(text));

        expect(result).toBe(utf8Base64(text));
        expect(result).not.toContain("data:");
        expect(result).not.toContain(",");
    });

    it.each([
        ["", ""],
        ["A", "QQ=="],
        ["Hello", "SGVsbG8="],
        ["Hello, world!", "SGVsbG8sIHdvcmxkIQ=="],
        ["\n\r\t", "Cg0J"],
        ["🙂 café 日本語", utf8Base64("🙂 café 日本語")]
    ])("encodes text exactly: %j", async (input: string, expected: string) => {
        const result = await fileToBase64(makeFile(input));
        expect(result).toBe(expected);
    });

    it("correctly encodes binary data including null and 0xFF", async () => {
        const bytes = new Uint8Array([0, 1, 15, 16, 127, 128, 254, 255]);
        const result = await fileToBase64(makeFile(bytes));

        expect(result).toBe(bytesBase64(bytes));
    });

    it("does not modify the original File", async () => {
        const file = makeFile("file content", "original.jpg", "image/jpeg");
        const original = { name: file.name, size: file.size, type: file.type };

        await fileToBase64(file);

        expect({ name: file.name, size: file.size, type: file.type })
            .toEqual(original);
    });

    it.each([
        ["image/jpeg", "picture.jpg"],
        ["image/png", "picture.png"],
        ["image/webp", "picture.webp"],
        ["text/plain", "note.txt"],
        ["application/octet-stream", "data.bin"],
        ["", "extensionless"]
    ])("supports MIME %j and filename %j", async (type: string, name: string) => {
        const result = await fileToBase64(makeFile("OK", name, type));
        expect(result).toBe("T0s=");
    });

    it("handles an empty binary file", async () => {
        expect(await fileToBase64(makeFile(new Uint8Array([]))))
            .toBe("");
    });

    
    it.each([
        null,
        undefined,
        "not a File",
        42
    ])(
        "rejects invalid runtime File inputs: %s",
        async (invalidFile: unknown) => {
            await expect(
                fileToBase64(invalidFile as File)
            ).rejects.toMatchObject({
                name: "TypeError",
                message: expect.stringContaining("readAsDataURL")
            });
        }
    );


    it("handles large files without truncation", async () => {
        const bytes = new Uint8Array(128 * 1024);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = i % 256;
        }

        const result = await fileToBase64(makeFile(bytes, "large.bin"));
        expect(result).toBe(bytesBase64(bytes));
    });

    it("supports simultaneous reads and resolves the right data for each", async () => {
        const values = ["first", "second", "third", "🙂", ""];
        const results = await Promise.all(
            values.map((value, index) =>
                fileToBase64(makeFile(value, `file-${index}.txt`, "text/plain"))
            )
        );

        expect(results).toEqual(values.map(utf8Base64));
    });
});

describe("fileToBase64: controlled reader results", () => {
    it.each([
        ["data:image/jpeg;base64,SGVsbG8=", "SGVsbG8="],
        ["data:text/plain;base64,T0s=", "T0s="],
        ["data:;base64,AA==", "AA=="],
        ["data:image/png;base64,", ""],
        ["data:,", ""],
        ["prefix,a,b,c", "a,b,c"],
        [",payload", "payload"],
        ["nocomma", "nocomma"],
        ["", ""],
        ["data:invalid;xyz, raw ", " raw "]
    ])("extracts the substring after the first comma: %j", async (result: string, expected: string) => {
        const { reader, promise } = startControlledRead();
        reader.complete(result);

        await expect(promise).resolves.toBe(expected);
        expectCleanedUp(reader);
    });

    it.each([
        {
            result: null,
            description: "null"
        },
        {
            result: new ArrayBuffer(4),
            description: "ArrayBuffer"
        }
    ])(
        "rejects a $description result",
        async ({ result }) => {
            const { reader, promise } = startControlledRead();

            reader.complete(result);

            await expect(promise).rejects.toThrow(
                "Could not read the image."
            );

            expectCleanedUp(reader);
        }
    );

    it("preserves the actual FileReader error object", async () => {
        const { reader, promise } = startControlledRead();
        const error = new DOMException("Access denied", "NotReadableError");
        reader.fail(error);

        await expect(promise).rejects.toBe(error);
        expectCleanedUp(reader);
    });

    it("uses the original fallback when reader.error is null", async () => {
        const { reader, promise } = startControlledRead();
        reader.fail(null);

        await expect(promise).rejects.toThrow("Failed to read the file.");
        expectCleanedUp(reader);
    });

    it("rejects when a read is aborted", async () => {
        const { reader, promise } = startControlledRead();
        reader.abort();

        await expect(promise).rejects.toThrow("File reading was cancelled.");
        expectCleanedUp(reader);
    });

    it("ignores a second event after resolving", async () => {
        const { reader, promise } = startControlledRead();
        reader.complete("data:;base64,YQ==");
        reader.fail(new DOMException("too late"));
        reader.abort();

        await expect(promise).resolves.toBe("YQ==");
        expectCleanedUp(reader);
    });

    it("ignores a second event after rejecting", async () => {
        const { reader, promise } = startControlledRead();
        reader.fail(new DOMException("failed", "NotReadableError"));
        reader.complete("data:;base64,YQ==");

        await expect(promise).rejects.toThrow("failed");
        expectCleanedUp(reader);
    });

    it("doesn't interfere with other concurrent instances", async () => {
        ControlledFileReader.instances = [];
        vi.stubGlobal("FileReader", ControlledFileReader);

        const first = fileToBase64(makeFile("first"));
        const second = fileToBase64(makeFile("second"));
        const [reader1, reader2] = ControlledFileReader.instances;

        reader2.complete("data:;base64,c2Vjb25k");
        reader1.complete("data:;base64,Zmlyc3Q=");

        await expect(first).resolves.toBe("Zmlyc3Q=");
        await expect(second).resolves.toBe("c2Vjb25k");
        expectCleanedUp(reader1);
        expectCleanedUp(reader2);
    });
});

describe("fileToBase64: synchronous failures", () => {
    it("rejects the original error thrown by readAsDataURL", async () => {
        const error = new DOMException("File is unavailable", "NotReadableError");
        vi.stubGlobal("FileReader", ControlledFileReader);
        vi.spyOn(ControlledFileReader.prototype, "readAsDataURL")
            .mockImplementation(() => { throw error; });
            
        const promise = fileToBase64(makeFile());
        const reader = ControlledFileReader.instances[0];

        await expect(promise).rejects.toBe(error);
        expectCleanedUp(reader);
    });

    it("rejects if the FileReader constructor throws", async () => {
        const error = new Error("Cannot create reader");

        class ThrowingFileReader {
            constructor() {
                throw error;
            }
        }

        vi.stubGlobal("FileReader", ThrowingFileReader);
        await expect(fileToBase64(makeFile())).rejects.toBe(error);
    });

    it("rejects if FileReader is unavailable (for example, SSR)", async () => {
        vi.stubGlobal("FileReader", undefined);

        await expect(fileToBase64(makeFile())).rejects.toBeInstanceOf(TypeError);
    });

    it("can handle a read that triggers load synchronously", async () => {
        vi.stubGlobal("FileReader", ControlledFileReader);
        vi.spyOn(ControlledFileReader.prototype, "readAsDataURL")
            .mockImplementation(function (this: ControlledFileReader) {
                this.complete("data:;base64,c3luYw==");
            });

        const promise = fileToBase64(makeFile());
        await expect(promise).resolves.toBe("c3luYw==");
        expectCleanedUp(ControlledFileReader.instances[0]);
    });
});
