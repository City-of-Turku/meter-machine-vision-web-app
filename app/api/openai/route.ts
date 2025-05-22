/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { OpenAI, AzureOpenAI } from "openai";

// --- Environment Variables ---
const OPENAI_PROVIDER = process.env.OPENAI_PROVIDER || 'azure'; // Default to 'azure', can be 'openai'

// For Azure OpenAI
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION;

// For Standard OpenAI
const STANDARD_OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Your standard OpenAI API Key
const STANDARD_OPENAI_MODEL = process.env.OPENAI_MODEL_NAME || 'gpt-4o'; // Default model for standard OpenAI

// --- Constants ---
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface ExtractedData {
    meterValue: string | null;
    serialNumber: string | null;
}

const isFileTypeValid = (file: File): boolean => {
    return file.type.startsWith('image/');
};

const isFileSizeValid = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES;
};

// --- Unified OpenAI Analysis Function ---
const performOpenAIAnalysis = async (
    fileContent: Buffer,
    mimeType: string
): Promise<ExtractedData> => {
    let client: OpenAI | AzureOpenAI; // Union type for the OpenAI client
    let modelToUse: string;
    let providerName: string;

    if (OPENAI_PROVIDER === 'azure') {
        if (!AZURE_ENDPOINT || !AZURE_API_KEY || !AZURE_DEPLOYMENT_NAME || !AZURE_API_VERSION) {
            console.error("Missing Azure OpenAI configuration for 'azure' provider.");
            throw new Error("Server configuration error: Azure OpenAI credentials missing.");
        }
        client = new AzureOpenAI({
            apiKey: AZURE_API_KEY,
            apiVersion: AZURE_API_VERSION,
            endpoint: AZURE_ENDPOINT,
            deployment: AZURE_DEPLOYMENT_NAME, // This is specific to the AzureOpenAI client constructor
        });
        modelToUse = AZURE_DEPLOYMENT_NAME; // For Azure, the 'model' in the chat completion create call is the deployment name
        providerName = "Azure OpenAI";
        console.log(`Using Azure OpenAI. Deployment: ${AZURE_DEPLOYMENT_NAME}`);
    } else if (OPENAI_PROVIDER === 'openai') {
        if (!STANDARD_OPENAI_API_KEY) {
            console.error("Missing OpenAI API Key for 'openai' provider.");
            throw new Error("Server configuration error: Standard OpenAI API Key missing.");
        }
        client = new OpenAI({ // Initialize the standard OpenAI client
            apiKey: STANDARD_OPENAI_API_KEY,
        });
        modelToUse = STANDARD_OPENAI_MODEL;
        providerName = "OpenAI";
        console.log(`Using Standard OpenAI. Model: ${STANDARD_OPENAI_MODEL}`);
    } else {
        console.error(`Invalid OPENAI_PROVIDER: ${OPENAI_PROVIDER}. Must be 'azure' or 'openai'.`);
        throw new Error("Server configuration error: Invalid AI provider specified.");
    }

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
        console.log(`Sending request to ${providerName} model: ${modelToUse}`);
        const response = await client.chat.completions.create({
            model: modelToUse,
            messages,
            // max_tokens: 600, // Optional: Adjust as needed
            // temperature: 0.1, // Optional: Lower temperature for more deterministic output
        });

        const choice = response.choices[0];
        if (!choice || !choice.message?.content) {
            console.error(`${providerName} response missing content:`, response);
            throw new Error("Failed to get a valid response from AI model.");
        }

        let content = choice.message.content.trim();
        console.log("Raw AI Response:", content);

        // Attempt to clean and parse the JSON response
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
            // Fallback: Try simple string matching if JSON parsing fails
            const meterMatch = content.match(/meterValue["']?\s*:\s*["']?([^,"'}]+)/i);
            const serialMatch = content.match(/serialNumber["']?\s*:\s*["']?([^,"'}]+)/i);
            return {
                meterValue: meterMatch ? meterMatch[1].trim() : "Parse Error",
                serialNumber: serialMatch ? serialMatch[1].trim() : "Parse Error"
            };
        }

    } catch (error: any) {
        console.error(`Error calling ${providerName}:`, error.response?.data || error.message || error);
        if (error.response?.data?.error?.message) {
             throw new Error(`${providerName} API Error: ${error.response.data.error.message}`);
        }
        throw new Error(`Failed to process image with ${providerName}.`);
    }
};

// --- Route Handler for POST requests ---
export async function POST(req: NextRequest) {
    const useMock = req.nextUrl.searchParams.get('useMock') === 'true';
    if (useMock) {
        console.warn(">>> Using Mock API Results <<<");
        await new Promise(resolve => setTimeout(resolve, 800));
        return NextResponse.json({
            results: {
                meterValue: "MOCK_12345.67",
                serialNumber: "MOCK_SN_987XYZ"
            }
        });
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

        // Perform analysis using the configured OpenAI provider
        const analysisResults = await performOpenAIAnalysis(fileBuffer, imageFile.type);

        // Return the structured results
        return NextResponse.json({ results: analysisResults });

    } catch (error: any) {
        console.error('API Route Handler Error:', error);
        const clientMessage = error instanceof Error && error.message ? error.message : "An unexpected error occurred during image processing.";
        return NextResponse.json(
            { error: clientMessage },
            { status: 500 }
        );
    }
}