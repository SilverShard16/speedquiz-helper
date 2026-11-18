export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the image.'));
        return;
      }

      resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read the file.'));
    };

    reader.onabort = () => {
      reject(new Error('File reading was cancelled.'));
    };

    reader.readAsDataURL(file);
  });
}