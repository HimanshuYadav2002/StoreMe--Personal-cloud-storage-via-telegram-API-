import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const statusInit = {};
    files.forEach((file) => {
      statusInit[file.name] = "Pending";
    });
    setUploadStatus(statusInit);
  };

  const handleUpload = async () => {
    if (isUploading || selectedFiles.length === 0) return;
    setIsUploading(true);

    for (const file of selectedFiles) {
      setUploadStatus((prev) => ({ ...prev, [file.name]: "Uploading..." }));
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await axios.post(
          "http://127.0.0.1:8000/upload",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        if (response.status === 200) {
          setUploadStatus((prev) => ({ ...prev, [file.name]: "✅ Uploaded" }));
        } else {
          setUploadStatus((prev) => ({ ...prev, [file.name]: "❌ Failed" }));
        }
      } catch {
        setUploadStatus((prev) => ({ ...prev, [file.name]: "❌ Failed" }));
      }
    }

    setIsUploading(false);
    fileInputRef.current.value = null;
    setSelectedFiles([]);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload Files to Telegram</h2>
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        disabled={isUploading}
        ref={fileInputRef}
      />
      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || isUploading}
      >
        {isUploading ? "Uploading..." : "Upload"}
      </button>
      <div style={{ marginTop: 20 }}>
        {/* iterating over the upload status object just to keep history of uploaded items before selecting new items  */}
        {Object.keys(uploadStatus).map((fileName) => (
          <div key={fileName} style={{ marginBottom: 10 }}>
            <strong>{fileName}</strong> — {uploadStatus[fileName]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
