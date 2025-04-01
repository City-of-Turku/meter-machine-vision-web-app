'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ImageUp, Camera, Copy, Loader2, CheckCircle, XCircle } from 'lucide-react';
// import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MOCK_SWITCH = process.env.NEXT_PUBLIC_MOCK_SWITCH;

// Client-side helper functions for immediate user feedback
const isFileSizeValid = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES;
};
const isFileTypeValid = (file: File): boolean => {
    return file.type.startsWith('image/');
};


const OCRWebApp = () => {
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [results, setResults] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [useMockResults, setUseMockResults] = useState(false);

    // Colors
    const primaryColor = 'rgb(0, 98, 174)';
    const secondaryColor = 'rgb(191, 230, 246)';
    const whiteColor = '#ffffff';

    const boxStyle = {
        backgroundColor: `${whiteColor}cc`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${primaryColor}20`,
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
      };
      

    const handleImageChange = useCallback(
     async (newImage: File | null) => {
        if (!newImage) {
            setImage(null); setPreview(null); setResults([]); setError(null); return;
        }
        if (!isFileTypeValid(newImage)) {
            setError('Invalid file type...'); setImage(null); setPreview(null); setResults([]); return;
        }
        if (!isFileSizeValid(newImage)) {
            setError(`File size exceeds...`); setImage(null); setPreview(null); setResults([]); return;
        }
        setImage(newImage); setError(null);
        const reader = new FileReader();
        reader.onloadend = () => { setPreview(reader.result as string); };
        reader.onerror = () => { setError('Failed to load image preview.'); setImage(null); setPreview(null); };
        reader.readAsDataURL(newImage);
    }, []);


    const handleOCR = useCallback(async () => {
        if (!image) {
            setError('Please select an image to process.');
            return;
        }
        setLoading(true); setResults([]); setError(null);


        const formData = new FormData();
        formData.append('image', image); // Key 'image' must match API route expectation


        // API endpoint URL - App Router uses /api/ocr by default
         const apiUrl = `/api/ocr${useMockResults ? '?useMock=true' : ''}`; // Add mock param


        try {
            const response = await fetch(apiUrl, { // Call the Route Handler
                method: 'POST',
                body: formData,
                 // No 'Content-Type' header needed for FormData
            });


            const data = await response.json();


            if (!response.ok) {
                 // Use the error message from the API response
                throw new Error(data.error || `API request failed: ${response.status}`);
            }


            setResults(data.results || []);


        } catch (err: any) {
            console.error("Error calling OCR API:", err);
            setError(err.message || 'An error occurred during OCR processing.');
        } finally {
            setLoading(false);
        }
    }, [image, useMockResults]); // Add useMockResults dependency


    const handleCopy = useCallback((text: string, index: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }).catch(err => { setError('Failed to copy text.'); console.error("Copy failed: ", err); });
    }, []);


    const handleTakePhoto = useCallback(() => {
         // Note: `window` checks are good practice in Client Components
        if (typeof window === 'undefined') return;
        if (!navigator.mediaDevices?.getUserMedia) { setError('Camera not supported.'); return; }
        const input = document.createElement('input'); /* ... rest of camera logic ... */
        input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
        input.onchange = (e: any) => { if (e.target.files?.[0]) handleImageChange(e.target.files[0]); };
        input.click();
    }, [handleImageChange]);


    const handleClear = useCallback(() => {
        setImage(null); setPreview(null); setResults([]); setError(null);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const triggerInput = useCallback(() => { inputRef.current?.click(); }, []);

    const imageVariants = {};

    useEffect(() => {
        const currentPreview = preview; // Capture preview value
        return () => {
            if (currentPreview && currentPreview.startsWith('blob:')) {
                URL.revokeObjectURL(currentPreview);
            }
        };
    }, [preview]);

    return (
        <main className="min-h-screen p-4 sm:p-8" style={{background: `linear-gradient(to top, ${secondaryColor}, #ffffff)`}}>
             <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center" style={{ color: primaryColor }}>
                    Image to Text (OCR)
                </h1>
                {(MOCK_SWITCH) && (
                <div className="flex items-center space-x-2 justify-center">
                    <Switch id="mock-mode" checked={useMockResults} onCheckedChange={setUseMockResults} />
                    <Label htmlFor="mock-mode">Use Mock Results</Label>
                </div>)
                }

                 {/* Input Section*/}
                 {/*                 </div><div className="rounded-xl p-4 sm:p-6 shadow-lg" style={{ backgroundColor: `${whiteColor}cc`, backdropFilter: 'blur(8px)', border: `1px solid ${primaryColor}20` }}>

                */}
                <div style={boxStyle}>
                     {/* ... Input buttons, hidden input ref ... */}
                      <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center" style={{ color: primaryColor }}>Select Image</h2>
                      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                           <input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)} className="hidden" ref={inputRef} />
                           <Button style={{backgroundColor: primaryColor}} onClick={triggerInput}><ImageUp className="w-5 h-5 mr-2" />Choose Image</Button>
                           <Button style={{backgroundColor: primaryColor}} onClick={handleTakePhoto}><Camera className="w-5 h-5 mr-2" />Take Photo</Button>
                           <Button onClick={handleClear} disabled={!image && !preview} variant="secondary"><XCircle className="w-5 h-5 mr-2" />Clear</Button>
                      </div>
                 </div>


                {/* Preview & Process Button Section*/}
                 <AnimatePresence>
                    {preview && ( <motion.div /* ... preview structure ... */ style={boxStyle} variants={imageVariants} initial="hidden" animate="visible" exit="exit" >
                        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center" style={{ color: primaryColor }}>Image Preview</h2>
                        {/* ... img tag ... */}
                        {/* eslint-disable-next-line @next/next/no-img-element */} 
                        <img alt="preview of given image" src={preview} /* ... */ />
                        {/* ... process button ... */}
                        <div className="mt-4 flex justify-center">
                            <Button style={{backgroundColor: primaryColor}} onClick={handleOCR} disabled={loading || !image} /* ... */ >
                                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</> : <><CheckCircle className="w-5 h-5 mr-2" /> Process Image</>}
                            </Button>
                        </div>
                    </motion.div>)}
                 </AnimatePresence>

                {error && ( <div className="p-4 rounded-lg bg-red-100 border border-red-300 text-red-700" role="alert"><span className="font-semibold">Error:</span> {error}</div> )}

                {/* Results Section*/}
                {results.length > 0 && !loading && (
                    <div style={boxStyle}>
                        <h2 className="text-xl sm:text-2xl font-semibold mb-4" style={{ color: primaryColor }}>
                            OCR Results
                        </h2>

                        <ul className="space-y-3">
                        {results.map((result, index) => (
                            <li
                                key={index}
                                className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white rounded-lg px-4 py-3 shadow-sm border border-[#0062ae]/10 space-y-2 sm:space-y-0"
                            >
                                <p className="text-gray-800">
                                    {result || <span className="text-gray-400 italic">Empty line</span>}
                                </p>

                                <div className="w-full sm:w-auto">
                                    <Button
                                        onClick={() => handleCopy(result, index)}
                                        className="w-full sm:w-auto justify-center"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                    {copiedIndex === index ? (
                                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                    ) : (
                                        <Copy className="w-4 h-4 mr-2" />
                                    )}
                                    <span>Copy Text</span>
                                    </Button>
                                </div>
                            </li>
                        ))}
                        </ul>
                    </div>
                )}
            </div>
        </main>
    );
};


export default OCRWebApp;