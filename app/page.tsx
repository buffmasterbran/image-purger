"use client";

import React, { useState, useEffect } from "react";

interface BarcodeData {
  title: string;
  variantTitle: string;
  sku: string;
  customizationType: string;
  customizationValue: string;
  customizationFont: string;
  previewUrl: string;
  svgUrl: string;
  dxfUrl: string | null;
  color: string;
  quantity: number;
  barcode: string;
  created: string;
}

export default function Home() {
  const [barcodeUrl, setBarcodeUrl] = useState("");
  const [barcodeData, setBarcodeData] = useState<BarcodeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [dxfFile, setDxfFile] = useState<File | null>(null);
  
  // Preview URLs for uploaded files
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [svgPreview, setSvgPreview] = useState<string | null>(null);
  
  // Dialog state for gallery items
  const [showGalleryDialog, setShowGalleryDialog] = useState(false);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (svgPreview) URL.revokeObjectURL(svgPreview);
    };
  }, [imagePreview, svgPreview]);

  const fetchBarcodeData = async () => {
    if (!barcodeUrl.trim()) {
      setMessage({ type: "error", text: "Please enter a barcode" });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    // Clear previous file selections and previews when fetching new barcode
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (svgPreview) URL.revokeObjectURL(svgPreview);
    setImageFile(null);
    setSvgFile(null);
    setDxfFile(null);
    setImagePreview(null);
    setSvgPreview(null);
    
    // Reset file input elements
    const imageInput = document.getElementById("imageFile") as HTMLInputElement;
    const svgInput = document.getElementById("svgFile") as HTMLInputElement;
    const dxfInput = document.getElementById("dxfFile") as HTMLInputElement;
    if (imageInput) imageInput.value = "";
    if (svgInput) svgInput.value = "";
    if (dxfInput) dxfInput.value = "";

    try {
      // Construct the full URL from the barcode
      // If it already starts with http, use it as is, otherwise construct the URL
      let fullUrl = barcodeUrl.trim();
      if (!fullUrl.startsWith("http")) {
        // Remove leading slash if present
        const barcode = fullUrl.startsWith("/") ? fullUrl.slice(1) : fullUrl;
        fullUrl = `https://pir-prod.pirani.life/co/${barcode}`;
      }

      const response = await fetch(`/api/fetch-barcode?url=${encodeURIComponent(fullUrl)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch barcode data");
      }

      // Check if this is a gallery item (previewUrl contains "gallery")
      if (data.previewUrl && data.previewUrl.includes("gallery")) {
        setShowGalleryDialog(true);
        setBarcodeData(null);
        setMessage({ type: "error", text: "Gallery items cannot be edited" });
        return;
      }

      setBarcodeData(data);
      setMessage({ type: "success", text: "Barcode data loaded successfully" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to fetch barcode data",
      });
      setBarcodeData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcodeData) {
      setMessage({ type: "error", text: "Please fetch barcode data first" });
      return;
    }

    if (!imageFile && !svgFile && !dxfFile) {
      setMessage({ type: "error", text: "Please select at least one file to upload" });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("barcodeUrl", barcodeUrl);
      formData.append("previewUrl", barcodeData.previewUrl);
      formData.append("svgUrl", barcodeData.svgUrl);
      if (barcodeData.dxfUrl) {
        formData.append("dxfUrl", barcodeData.dxfUrl);
      }

      // Always use standard filenames regardless of uploaded filename
      if (imageFile) {
        // Create a new File object with the standard name
        const renamedImage = new File([imageFile], "preview.png", {
          type: imageFile.type || "image/png",
        });
        formData.append("imageFile", renamedImage);
      }
      if (svgFile) {
        // Create a new File object with the standard name
        const renamedSvg = new File([svgFile], "art.svg", {
          type: svgFile.type || "image/svg+xml",
        });
        formData.append("svgFile", renamedSvg);
      }
      if (dxfFile) {
        // Create a new File object with the standard name
        const renamedDxf = new File([dxfFile], "art.dxf", {
          type: dxfFile.type || "application/dxf",
        });
        formData.append("dxfFile", renamedDxf);
      }

      const response = await fetch("/api/replace-files", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to replace files");
      }

      setMessage({ type: "success", text: "Files replaced and cache purged successfully!" });
      
      // Reset file inputs
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (svgPreview) URL.revokeObjectURL(svgPreview);
      setImageFile(null);
      setSvgFile(null);
      setDxfFile(null);
      setImagePreview(null);
      setSvgPreview(null);
      
      // Reset file input elements
      const imageInput = document.getElementById("imageFile") as HTMLInputElement;
      const svgInput = document.getElementById("svgFile") as HTMLInputElement;
      const dxfInput = document.getElementById("dxfFile") as HTMLInputElement;
      if (imageInput) imageInput.value = "";
      if (svgInput) svgInput.value = "";
      if (dxfInput) dxfInput.value = "";
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to replace files",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg p-4">
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            Replace Barcode Files
          </h1>

          {/* Barcode Input */}
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                id="barcodeUrl"
                value={barcodeUrl}
                onChange={(e) => setBarcodeUrl(e.target.value)}
                placeholder="251002/PD2qqdLt"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={fetchBarcodeData}
                disabled={loading}
                className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Loading..." : "Fetch Data"}
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`mb-3 p-2 rounded text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Gallery Item Dialog */}
          {showGalleryDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Cannot Edit Gallery Items
                </h2>
                <p className="text-gray-700 mb-6">
                  YOU can't edit gallery items. Gallery items (like holiday designs) are used across multiple products and cannot be modified.
                </p>
                <button
                  onClick={() => {
                    setShowGalleryDialog(false);
                    setBarcodeUrl("");
                    setMessage(null);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison with Upload Buttons */}
          {barcodeData && (
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Preview Image Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Preview Image</h3>
                    <label
                      htmlFor="imageFile"
                      className="cursor-pointer text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Upload
                      <input
                        type="file"
                        id="imageFile"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setImageFile(file);
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setImagePreview(url);
                          } else {
                            if (imagePreview) URL.revokeObjectURL(imagePreview);
                            setImagePreview(null);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Current</p>
                      <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center max-w-[150px]">
                        <img
                          src={`${barcodeData.previewUrl}?t=${Date.now()}`}
                          alt="Current preview"
                          className="max-w-full max-h-full object-contain"
                          key={`preview-${barcodeData.previewUrl}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-gray-400 text-xs">Failed</p>';
                          }}
                        />
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border-2 border-blue-500">
                      <p className="text-xs text-blue-600 mb-1">New</p>
                      <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center max-w-[150px]">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="New preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <p className="text-gray-400 text-xs">No file selected</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SVG Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">SVG File</h3>
                    <label
                      htmlFor="svgFile"
                      className="cursor-pointer text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Upload
                      <input
                        type="file"
                        id="svgFile"
                        accept="image/svg+xml,.svg"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSvgFile(file);
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setSvgPreview(url);
                          } else {
                            if (svgPreview) URL.revokeObjectURL(svgPreview);
                            setSvgPreview(null);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Current</p>
                      <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-300 max-w-[150px]">
                        <img
                          src={`${barcodeData.svgUrl}?t=${Date.now()}`}
                          alt="Current SVG"
                          className="max-w-full max-h-full object-contain"
                          key={`svg-${barcodeData.svgUrl}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-gray-400 text-xs">Failed</p>';
                          }}
                        />
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border-2 border-blue-500">
                      <p className="text-xs text-blue-600 mb-1">New</p>
                      <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-300 max-w-[150px]">
                        {svgPreview ? (
                          <img
                            src={svgPreview}
                            alt="New SVG"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = '<p class="text-gray-400 text-xs">Failed</p>';
                            }}
                          />
                        ) : (
                          <p className="text-gray-400 text-xs">No file selected</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              {(imageFile || svgFile || dxfFile) && (
                <form onSubmit={handleSubmit} className="mt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {uploading ? "Uploading..." : "Replace Files & Purge Cache"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
