export const preprocessImage = async (file: File, binarize = true): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = 0.3 * r + 0.59 * g + 0.11 * b;

                if (binarize) {
                    // Apply thresholding
                    const bw = gray > 128 ? 255 : 0;
                    data[i] = data[i + 1] = data[i + 2] = bw;
                } else {
                    // Grayscale only
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas toBlob failed'));
                }
            }, 'image/png');
        };

        img.onerror = () => {
            reject(new Error('Image load failed'));
        };

        img.src = url;
    });
};
