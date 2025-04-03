/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { AzureOpenAI } from "openai";

// Environment Variables for Azure OpenAI
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

if (!endpoint || !apiKey || !deploymentName) {
    console.error("Missing Azure OpenAI configuration.");
    throw new Error("Server configuration error.");
}

const MAX_FILE_SIZE_MB = 4; // Keep file size limits reasonable for API calls
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface ExtractedData {
    meterValue: string | null;
    serialNumber: string | null;
}

// Helper function to check file type
const isFileTypeValid = (file: File): boolean => {
    return file.type.startsWith('image/');
};

// Helper function to check file size
const isFileSizeValid = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES;
};

// Function to interact with Azure OpenAI GPT-4o
const performAzureOpenAIAnalysis = async (
    fileContent: Buffer,
    mimeType: string
): Promise<ExtractedData> => {
    if (!endpoint || !apiKey || !deploymentName || !apiVersion) {
        console.error("Server configuration error: Missing Azure OpenAI credentials.");
        throw new Error("Server configuration error.");
    }

    // Initialize the AzureOpenAI client
    const client = new AzureOpenAI({
        apiKey,
        apiVersion,
        endpoint,
        deployment: deploymentName,
    });

    // Convert image buffer to base64 data URL
    const base64Image = fileContent.toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    // Construct the prompt for GPT-4o
    const messages: any[] = [
        {
            role: "system",
            content: "You are an AI assistant specialized in reading utility meters from images. Extract the primary meter reading value and the meter's serial number. Respond ONLY with a valid JSON object containing 'meterValue' and 'serialNumber' keys. If a value cannot be found, use null for that key."
        },
        {
            role: "user",
            content: [
                {
                    type: "text",
                    text: "Analyze the image and provide the meter value and serial number in JSON format."
                },
                {
                    type: "image_url",
                    image_url: {
                       url: imageUrl,
                    },
                },
            ],
        },
    ];

    try {
        console.log(`Sending request to Azure OpenAI deployment: ${deploymentName}`);
        // console.log("endpoint:", endpoint);
        // console.log("apiversion:", apiVersion);
        const response = await client.chat.completions.create({
            model: deploymentName, // Your GPT-4o deployment name
            messages,
            max_tokens: 150, // Adjust as needed, but should be enough for JSON
            temperature: 0.1, // Lower temperature for more deterministic output
        });

        const choice = response.choices[0];
        if (!choice || !choice.message?.content) {
            console.error("Azure OpenAI response missing content:", response);
            throw new Error("Failed to get a valid response from AI model.");
        }

        let content = choice.message.content.trim();
        console.log("Raw AI Response:", content);

        // Attempt to clean and parse the JSON response
        // Sometimes the model might wrap the JSON in ```json ... ```
        if (content.startsWith('```json')) {
            content = content.substring(7, content.length - 3).trim();
        } else if (content.startsWith('```')) {
             content = content.substring(3, content.length - 3).trim();
        }


        try {
            const parsedJson = JSON.parse(content);
            const result: ExtractedData = {
                meterValue: parsedJson.meterValue ?? null,
                serialNumber: parsedJson.serialNumber ?? null
            };
            console.log("Parsed AI Result:", result);
            return result;
        } catch (parseError: any) {
            console.error("Failed to parse JSON response from AI:", content, parseError);
            // Fallback: Try simple string matching if JSON parsing fails (less reliable)
            const meterMatch = content.match(/meterValue["']?\s*:\s*["']?([^,"'}]+)/i);
            const serialMatch = content.match(/serialNumber["']?\s*:\s*["']?([^,"'}]+)/i);
            return {
                meterValue: meterMatch ? meterMatch[1].trim() : "Parse Error",
                serialNumber: serialMatch ? serialMatch[1].trim() : "Parse Error"
            };
            // throw new Error("AI model did not return valid JSON.");
        }

    } catch (error: any) {
        console.error("Error calling Azure OpenAI:", error.response?.data || error.message || error);
        if (error.response?.data?.error?.message) {
             throw new Error(`Azure OpenAI API Error: ${error.response.data.error.message}`);
        }
        throw new Error("Failed to process image with Azure OpenAI.");
    }
};

// --- Route Handler for POST requests ---
export async function POST(req: NextRequest) {
    const useMock = req.nextUrl.searchParams.get('useMock') === 'true';
    if (useMock) {
        console.warn(">>> Using Mock API Results <<<");
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800)); // Adjust delay as needed
        // Return mock data matching the ExtractedData structure
        return NextResponse.json({
            results: {
                meterValue: "MOCK_12345.67",
                serialNumber: "MOCK_SN_987XYZ"
            }
        });
    }

    // Check Azure OpenAI credentials
    if (!endpoint || !apiKey || !deploymentName) {
        console.error("API route error: Azure OpenAI credentials not configured.");
        return NextResponse.json(
            { error: "AI service is not configured correctly." },
            { status: 500 }
        );
    }

    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) {
        console.warn("Received request without multipart/form-data Content-Type");
        // Allow it, but formData() might fail
    }

    try {
        const formData = await req.formData();
        const imageFile = formData.get('image') as File | null;

        if (!imageFile) {
            return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
        }
        if (!isFileTypeValid(imageFile)) {
            return NextResponse.json({ error: 'Invalid file type. Please select an image.' }, { status: 400 });
        }
        if (!isFileSizeValid(imageFile)) {
            return NextResponse.json({ error: `File size exceeds the limit of ${MAX_FILE_SIZE_MB} MB.` }, { status: 400 });
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Perform analysis using Azure OpenAI
        const analysisResults = await performAzureOpenAIAnalysis(fileBuffer, imageFile.type);

        // Return the structured results
        return NextResponse.json({ results: analysisResults });

    } catch (error: any) {
        console.error('API Route Handler Error:', error);

        const clientMessage = error instanceof Error && error.message ? error.message : "An unexpected error occurred during image processing.";

        return NextResponse.json(
            { error: clientMessage },
            { status: 500 } // Or determine appropriate status code
        );
    }
}