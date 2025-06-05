import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);

    const progressInit = {};
    const statusInit = {};
    files.forEach((file) => {
      progressInit[file.name] = 0;
      statusInit[file.name] = "Pending";
    });
    setUploadProgress(progressInit);
    setUploadStatus(statusInit);
  };

  const handleUpload = async () => {
    if (isUploading || selectedFiles.length === 0) return;

    setIsUploading(true);

    const newStatus = {};
    let completed = 0;

    await Promise.all(
      selectedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("files", file);

        try {
          const response = await axios.post(
            "http://127.0.0.1:8000/upload",
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              onUploadProgress: (event) => {
                const percent = Math.round((event.loaded * 100) / event.total);
                setUploadProgress((prev) => ({
                  ...prev,
                  [file.name]: percent,
                }));
              },
            }
          );

          if (response.status === 200) {
            newStatus[file.name] = "✅ Uploaded";
            alert(`✅ Uploaded: ${file.name}`);
          } else {
            newStatus[file.name] = `❌ Failed: ${
              result?.reason || "Unknown error"
            }`;
          }
        } catch (err) {
          console.error("Upload failed:", err);
          newStatus[file.name] = "❌ Failed";
        } finally {
          completed++;
          setUploadStatus((prev) => ({
            ...prev,
            [file.name]: newStatus[file.name],
          }));

          // After last file finishes
          if (completed === selectedFiles.length) {
            setIsUploading(false);

            const hasFailures = Object.values(newStatus).some((status) =>
              status.startsWith("❌")
            );

            if (!hasFailures) {
              // Clear everything if all succeeded
              setSelectedFiles([]);
              setUploadProgress({});
              setUploadStatus({});
              if (inputRef.current) inputRef.current.value = ""; // Clear file input
            }
          }
        }
      })
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload Multiple Files to Telegram</h2>
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        ref={inputRef}
        disabled={isUploading}
      />
      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || isUploading}
      >
        {isUploading ? "Uploading..." : "Upload"}
      </button>

      <div style={{ marginTop: 20 }}>
        {selectedFiles.map((file) => (
          <div key={file.name} style={{ marginBottom: 15 }}>
            <strong>{file.name}</strong>
            <br />
            <span>
              {uploadProgress[file.name] || 0}% - {uploadStatus[file.name]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
