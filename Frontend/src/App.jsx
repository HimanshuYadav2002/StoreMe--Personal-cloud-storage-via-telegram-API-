import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

function getClientId() {
  // Simple random client id for demo
  return (
    localStorage.getItem("client_id") ||
    (() => {
      const id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("client_id", id);
      return id;
    })()
  );
}

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({});
  const [progress, setProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
  const clientId = getClientId();

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/progress/${clientId}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress((prev) => ({
        ...prev,
        [data.filename]: data.progress,
      }));
      if (data.done) {
        setUploadStatus((prev) => ({
          ...prev,
          [data.filename]: "✅ Uploaded",
        }));
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [clientId]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const statusInit = {};
    files.forEach((file) => {
      statusInit[file.name] = "Pending";
    });
    setUploadStatus(statusInit);
    setProgress({});
  };

  const handleUpload = async () => {
    if (isUploading || selectedFiles.length === 0) return;
    setIsUploading(true);

    for (const file of selectedFiles) {
      setUploadStatus((prev) => ({ ...prev, [file.name]: "Uploading..." }));
      setProgress((prev) => ({ ...prev, [file.name]: 0 }));
      const formData = new FormData();
      formData.append("file", file);

      try {
        await axios.post(
          `http://127.0.0.1:8000/upload?client_id=${clientId}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
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
        {Object.keys(uploadStatus).map((fileName) => (
          <div key={fileName} style={{ marginBottom: 10 }}>
            <strong>{fileName}</strong>
            {" — "}
            {uploadStatus[fileName] || "Pending"}{" "}
            {progress[fileName] !== undefined &&
              `(${Math.round((progress[fileName] || 0) * 100)}%)`}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
