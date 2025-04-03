'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ImageUp, Camera, Copy, Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Define the structure for the extracted data
interface ExtractedData {
    meterValue: string | null;
    serialNumber: string | null;
}

const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MOCK_SWITCH_ENABLED = process.env.NEXT_PUBLIC_MOCK_SWITCH;


// Client-side helper functions
const isFileSizeValid = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES;
};
const isFileTypeValid = (file: File): boolean => {
    return file.type.startsWith('image/');
};


const MeterReaderApp = () => {
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedMeter, setCopiedMeter] = useState<boolean>(false);
    const [copiedSerial, setCopiedSerial] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [useMockResults, setUseMockResults] = useState(false);

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
        setExtractedData(null);
        setError(null);
        setCopiedMeter(false);
        setCopiedSerial(false);

        if (!newImage) {
            setImage(null); setPreview(null); return;
        }
        if (!isFileTypeValid(newImage)) {
            setError(`Invalid file type: ${newImage.type}. Please upload an image (JPEG, PNG, GIF, WEBP, BMP).`); setImage(null); setPreview(null); return;
        }
        if (!isFileSizeValid(newImage)) {
            setError(`File size exceeds ${MAX_FILE_SIZE_MB} MB limit.`); setImage(null); setPreview(null); return;
        }
        setImage(newImage);
        setError(null);

        const reader = new FileReader();
        reader.onloadend = () => { setPreview(reader.result as string); };
        reader.onerror = () => { setError('Failed to load image preview.'); setImage(null); setPreview(null); };
        reader.readAsDataURL(newImage);
    }, []);


    const handleAnalysis = useCallback(async () => {
        if (!image) {
            setError('Please select an image to process.');
            return;
        }
        setLoading(true);
        setExtractedData(null);
        setError(null);
        setCopiedMeter(false);
        setCopiedSerial(false);

        const formData = new FormData();
        formData.append('image', image);

        const apiUrl = `/api/openai${useMockResults ? '?useMock=true' : ''}`;
        console.log(`Calling API: ${apiUrl}`); // For debugging

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                 throw new Error(data.error || `API request failed: ${response.status}`);
            }

            if (data.results && typeof data.results === 'object') {
                setExtractedData({
                    meterValue: data.results.meterValue ?? null,
                    serialNumber: data.results.serialNumber ?? null
                });
                // If using mock results, clear the error state in case a previous real run failed
                if (useMockResults) setError(null);
            } else {
                 console.error("Unexpected API response format:", data);
                 setExtractedData({ meterValue: "Error", serialNumber: "Invalid API Response" });
            }

        } catch (err: any) {
            console.error("Error calling Analysis API:", err);
            setError(err.message || 'An error occurred during image analysis.');
            setExtractedData(null);
        } finally {
            setLoading(false);
        }
    }, [image, useMockResults]);

    const handleCopy = useCallback((text: string | null, type: 'meter' | 'serial') => {
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            if (type === 'meter') {
                setCopiedMeter(true);
                setTimeout(() => setCopiedMeter(false), 2000);
            } else if (type === 'serial') {
                setCopiedSerial(true);
                setTimeout(() => setCopiedSerial(false), 2000);
            }
        }).catch(err => { setError('Failed to copy text.'); console.error("Copy failed: ", err); });
    }, []);


    const handleTakePhoto = useCallback(() => {
         if (typeof window === 'undefined') return;
         if (!navigator.mediaDevices?.getUserMedia) { setError('Camera not supported on this device/browser.'); return; }
         const input = document.createElement('input');
         input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
         input.onchange = (e: any) => { if (e.target.files?.[0]) handleImageChange(e.target.files[0]); };
         input.click();
    }, [handleImageChange]);


    const handleClear = useCallback(() => {
        setImage(null); setPreview(null); setExtractedData(null); setError(null);
        setCopiedMeter(false); setCopiedSerial(false);
        // Optionally reset mock switch? Or keep its state? Keeping state for now.
        // setUseMockResults(false);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const triggerInput = useCallback(() => { inputRef.current?.click(); }, []);

    const imageVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 }
      };

    useEffect(() => {
        const currentPreview = preview;
        return () => {
            if (currentPreview && currentPreview.startsWith('blob:')) {
                URL.revokeObjectURL(currentPreview);
            }
        };
    }, [preview]);

    return (
        <main className="min-h-screen p-4 sm:p-8" style={{background: `linear-gradient(to top, ${secondaryColor}, #ffffff)`}}>
             <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center" style={{ color: primaryColor }}>
                    Meter Reader AI
                </h1>
                 {MOCK_SWITCH_ENABLED && (
                    <div className="flex items-center space-x-2 justify-center pb-2">
                         <Switch
                            id="mock-mode"
                            checked={useMockResults}
                            onCheckedChange={setUseMockResults}
                            aria-label="Toggle mock results"
                          />
                         <Label htmlFor="mock-mode" className="text-sm font-medium" style={{ color: primaryColor }}>Use Mock Results</Label>
                    </div>
                 )}

                 {/* Input Section */}
                 <div style={boxStyle}>
                     <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center" style={{ color: primaryColor }}>Upload Meter Image</h2>
                     <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                            <input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)} className="hidden" ref={inputRef} />
                            <Button style={{backgroundColor: primaryColor}} onClick={triggerInput}><ImageUp className="w-5 h-5 mr-2" />Choose Image</Button>
                            <Button style={{backgroundColor: primaryColor}} onClick={handleTakePhoto}><Camera className="w-5 h-5 mr-2" />Take Photo</Button>
                            <Button onClick={handleClear} disabled={!image && !preview} variant="outline" className='border-gray-300 hover:bg-gray-100'><XCircle className="w-5 h-5 mr-2 text-gray-600" />Clear</Button>
                     </div>
                 </div>

                 {/* Error Display Area */}
                 {error && !useMockResults && ( // Only show real errors if not using mock results
                     <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-lg bg-red-100 border border-red-300 text-red-700 flex items-start"
                        role="alert"
                     >
                        <XCircle className="w-5 h-5 mr-3 flex-shrink-0 text-red-600" />
                        <div>
                            <span className="font-semibold">Error:</span> {error}
                        </div>
                     </motion.div>
                 )}

                 {/* Preview & Process Button Section*/}
                 <AnimatePresence>
                     {preview && ( <motion.div style={boxStyle} variants={imageVariants} initial="hidden" animate="visible" exit="exit" layout >
                         <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center" style={{ color: primaryColor }}>Image Preview</h2>
                         <div className="flex justify-center max-h-96 overflow-hidden rounded-lg border border-gray-200">
                             {/* eslint-disable-next-line @next/next/no-img-element */}
                             <img
                                alt="Preview of uploaded meter"
                                src={preview}
                                className="object-contain w-auto h-auto max-w-full max-h-full"
                             />
                         </div>
                         <div className="mt-6 flex justify-center">
                                <Button
                                    style={{backgroundColor: primaryColor}}
                                    onClick={handleAnalysis}
                                    disabled={loading || !image}
                                    className="px-6 py-3 text-lg"
                                >
                                    {loading ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" />{useMockResults ? 'Faking it...' : 'Analyzing...'}</> : <><Info className="w-6 h-6 mr-2" /> Extract Data</>}
                                </Button>
                         </div>
                     </motion.div>)}
                 </AnimatePresence>

                 {/* Loading Indicator Area */}
                 {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex justify-center items-center p-6 text-lg" style={{ color: primaryColor }}
                    >
                        <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                        <span>{useMockResults ? 'Generating mock results...' : 'Processing with AI, please wait...'}</span>
                    </motion.div>
                 )}


                 {/* Results Section - Updated for structured data */}
                 {extractedData && !loading && (
                      <motion.div
                        style={boxStyle}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        layout
                      >
                          <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center" style={{ color: primaryColor }}>
                              {useMockResults ? 'Mock Extracted Data' : 'Extracted Data'} {/* Dynamic Title */}
                          </h2>

                          <div className="space-y-4">
                            {/* Meter Value */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white rounded-lg px-4 py-3 shadow-sm border border-[#0062ae]/10 space-y-2 sm:space-y-0">
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-600 mr-2">Meter Value:</span>
                                    <span className="text-gray-800 break-words">
                                        {extractedData.meterValue || <span className="text-gray-400 italic">Not found</span>}
                                    </span>
                                </div>
                                <div className="w-full sm:w-auto sm:ml-4 flex-shrink-0">
                                    <Button
                                        onClick={() => handleCopy(extractedData.meterValue, 'meter')}
                                        disabled={!extractedData.meterValue || copiedMeter}
                                        className="w-full sm:w-auto justify-center"
                                        variant="outline"
                                        size="sm"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                     >
                                        {copiedMeter ? (
                                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                        ) : (
                                            <Copy className="w-4 h-4 mr-2" />
                                        )}
                                        <span>{copiedMeter ? 'Copied!' : 'Copy'}</span>
                                     </Button>
                                </div>
                             </div>

                            {/* Serial Number */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white rounded-lg px-4 py-3 shadow-sm border border-[#0062ae]/10 space-y-2 sm:space-y-0">
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-600 mr-2">Serial Number:</span>
                                    <span className="text-gray-800 break-words">
                                         {extractedData.serialNumber || <span className="text-gray-400 italic">Not found</span>}
                                    </span>
                                </div>
                                <div className="w-full sm:w-auto sm:ml-4 flex-shrink-0">
                                    <Button
                                        onClick={() => handleCopy(extractedData.serialNumber, 'serial')}
                                        disabled={!extractedData.serialNumber || copiedSerial}
                                        className="w-full sm:w-auto justify-center"
                                        variant="outline"
                                        size="sm"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                     >
                                        {copiedSerial ? (
                                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                        ) : (
                                            <Copy className="w-4 h-4 mr-2" />
                                        )}
                                         <span>{copiedSerial ? 'Copied!' : 'Copy'}</span>
                                     </Button>
                                </div>
                             </div>

                          </div>
                      </motion.div>
                 )}
            </div>
        </main>
    );
};

export default MeterReaderApp;