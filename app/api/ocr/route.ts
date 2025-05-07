/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer'; // Import Buffer for ArrayBuffer conversion

const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
const AZURE_KEY = process.env.AZURE_KEY;
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const OCR4 = true; // Set to true to use the new OCR API

// Helper function to check file type (now checks File object)
const isFileTypeValid = (file: File): boolean => {
    return file.type.startsWith('image/');
};

// Helper function to check file size (now checks File object)
const isFileSizeValid = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES;
};

// Core OCR logic - Modified to accept Buffer and mimetype directly
const performServerSideOCR = async (
    fileContent: Buffer, // Accept Buffer directly
    mimeType: string     // Accept mimetype
): Promise<string[]> => {
    if (!AZURE_ENDPOINT || !AZURE_KEY) {
        console.error("Server configuration error: Missing Azure credentials.");
        throw new Error("Server configuration error.");
    }

    const analyzeUrl = OCR4
    ? `${AZURE_ENDPOINT}computervision/imageanalysis:analyze?api-version=2024-02-01&model-version=latest&features=read&language=en`
    : `${AZURE_ENDPOINT}vision/v3.2/ocr?language=en&detectOrientation=true`;

    const headers = {
        'Content-Type': mimeType || 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        // Content-Length is handled automatically by fetch when body is Buffer
    };

    try {
        const response = await fetch(analyzeUrl, {
            method: 'POST',
            headers: headers,
            body: fileContent, // Send the Buffer content
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Azure OCR request failed: ${response.status} - ${errorText}`);
            throw new Error(`Azure OCR request failed: ${response.status}`);
        }

        const data = await response.json();

        // Process the response
        const lines: string[] = [];
        if (OCR4) {
            const blocks = data.readResult?.blocks || [];   
            if (blocks.length > 0) {
                blocks.forEach((block: any) => {
                    block.lines.forEach((line: any) => {
                        let lineText = "";
                        line.words.forEach((word: any) => {
                            lineText += word.text + " ";
                        });
                        lines.push(lineText.trim());
                    });
                    
                });
            }
        }
        // For the older OCR API (v3.2), process the response differently
        else {
            if (data.regions) {
                data.regions.forEach((region: any) => {
                    region.lines.forEach((line: any) => {
                        let lineText = "";
                        line.words.forEach((word: any) => {
                            lineText += word.text + " ";
                        });
                        lines.push(lineText.trim());
                    });
                });
            }
        }
        return lines;

    } catch (error: any) {
        console.error("Error during Azure OCR call:", error);
        if (error.message.includes('Azure OCR request failed')) {
            throw new Error("Error communicating with OCR service.");
        }
        throw new Error("Failed to process image with Azure OCR.");
    }
};


// --- Route Handler for POST requests ---
export async function POST(req: NextRequest) {
    // --- Mock Handling ---
    const { searchParams } = new URL(req.url);
    const useMock = searchParams.get('useMock') === 'true';

    if (useMock) {
        console.warn("Mock results requested via API query parameter.");
        await new Promise(resolve => setTimeout(resolve, 500));
        return NextResponse.json({
            results: [
                "Mock Server-Side (App Router / formData) OCR Result 1",
                "Mock Server-Side (App Router / formData) Result Line 2",
            ]
        });
    }
    // --- End Mock Handling ---

    // Check Azure credentials
    if (!AZURE_ENDPOINT || !AZURE_KEY) {
        console.error("API route error: Azure credentials not configured.");
        return NextResponse.json(
            { error: "OCR service is not configured correctly." },
            { status: 500 }
        );
    }

    // Check content type (optional but good practice)
     if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) {
        console.warn("Received request without multipart/form-data Content-Type");
        // Allow it for now, but formData() might fail if it's truly not form data
     }

    try {
        // Use built-in formData() method to parse the request body
        const formData = await req.formData();

        // Get the file from the FormData object (key should match client-side)
        const imageFile = formData.get('image') as File | null;

        if (!imageFile) {
            return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
        }

        // Server-side validation (using updated helpers)
        if (!isFileTypeValid(imageFile)) {
            return NextResponse.json({ error: 'Invalid file type. Please select an image.' }, { status: 400 });
        }

        if (!isFileSizeValid(imageFile)) {
            return NextResponse.json({ error: `File size exceeds the limit of ${MAX_FILE_SIZE_MB} MB.` }, { status: 400 });
        }

        // Get the file content as an ArrayBuffer
        const arrayBuffer = await imageFile.arrayBuffer();
        // Convert ArrayBuffer to Node.js Buffer
        const fileBuffer = Buffer.from(arrayBuffer);

        // Perform OCR using the server-side function with the Buffer
        const ocrResults = await performServerSideOCR(fileBuffer, imageFile.type);
        return NextResponse.json({ results: ocrResults });

    } catch (error: any) {
        console.error('API Route Handler Error:', error);

        // Handle specific errors if needed (e.g., formData parsing errors)
        if (error instanceof Error && error.message.includes('Failed to parse')) {
             return NextResponse.json({ error: "Error parsing uploaded file data." }, { status: 400 });
        }


        const clientMessage = error instanceof Error && (error.message.startsWith('Azure OCR') || error.message.startsWith('Failed to process') || error.message.startsWith('Error communicating') || error.message.startsWith('Server configuration error'))
                              ? error.message // Use the message from performServerSideOCR if suitable
                              : "An unexpected error occurred during image processing.";

        return NextResponse.json(
            { error: clientMessage },
            { status: 500 }
        );
    }
}