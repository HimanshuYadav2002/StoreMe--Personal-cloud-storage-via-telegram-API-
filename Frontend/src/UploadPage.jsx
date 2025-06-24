import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./UploadPage.css";
import { useNavigate } from "react-router-dom";

// function to get client id from local storage
function getClient_id() {
  return localStorage.getItem("client_id");
}

function UploadPage() {
  // State variables for file selection, upload status, progress, uploading state, and thumbnails
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({});
  const [progress, setProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [thumbnails, setThumbnails] = useState([]);
  // Ref for file input
  const fileInputRef = useRef(null);
  // State for client_id
  const [client_id, setClient_id] = useState(getClient_id());
  const navigate = useNavigate();

  // Effect: checks for client_id changes every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      // If client_id changes, remove client session and redirect
      const currentId = localStorage.getItem("client_id");
      if (client_id !== currentId) {
        localStorage.setItem("client_id", client_id);
        (async () => {
          localStorage.setItem("client_id", "");
          await fetch("http://localhost:8000/removeClient", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: currentId }),
          });
        })();
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [client_id, navigate]);

  useEffect(() => {
    (async () => {
      let response = await fetch(
        "http://localhost:8000/getClientActiveStatus",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: client_id }),
        }
      );
      const body = await response.json();
      console.log(body.message);
      if (body.message !== "client found") {
        localStorage.setItem("client_id", "");
        alert("Session Invalid");
        navigate("/");
      }
    })();
  }, []);

  // Effect: fetches thumbnails via WebSocket when not uploading
  useEffect(() => {
    if (isUploading === false) {
      setThumbnails([]); // Clear thumbnails before fetching new ones
      const ws = new WebSocket(`ws://127.0.0.1:8000/streamPhotos/${client_id}`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.done) {
          ws.close();
          return;
        }
        if (data.thumbnail) {
          setThumbnails((prev) => [...prev, data.thumbnail]);
        }
      };
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
      return () => {
        if (ws.readyState === 1) ws.close(); // Only close if open
      };
    }

    (async () => {
      let response = await fetch(
        "http://localhost:8000/getClientActiveStatus",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: client_id }),
        }
      );
      const body = await response.json();
      // console.log(body.message);
      if (body.message !== "client found") {
        localStorage.setItem("client_id", "");
      }
    })();
  }, [isUploading, client_id]);

  // Handles file selection and sets initial upload status and progress
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    files.forEach((file) => {
      setUploadStatus((prev) => ({
        ...prev,
        [file.name]: "Pending",
      }));
      setProgress((prev) => ({ ...prev, [file.name]: 0 }));
    });
  };

  // Handles sequential file upload with progress updates
  const handleUpload = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/progress/${client_id}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress((prev) => ({
        ...prev,
        [data.filename]: data.progress,
      }));
    };
    setIsUploading(true);

    for (const file of selectedFiles) {
      setUploadStatus((prev) => ({ ...prev, [file.name]: "Uploading..." }));
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client_id", client_id);

      try {
        let response = await axios.post(
          `http://127.0.0.1:8000/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (response.status === 200) {
          setUploadStatus((prev) => ({
            ...prev,
            [file.name]: "✅ Uploaded",
          }));
        } else {
          setUploadStatus((prev) => ({ ...prev, [file.name]: "❌ Failed" }));
        }
      } catch {
        setUploadStatus((prev) => ({ ...prev, [file.name]: "❌ Failed" }));
      }
    }

    // Reset upload state and clear file input
    setIsUploading(false);
    fileInputRef.current.value = null;
    setSelectedFiles([]);
    ws.close();
  };

  // Handles parallel file upload with progress updates
  const handleParallelUpload = () => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/progress/${client_id}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress((prev) => ({
        ...prev,
        [data.filename]: data.progress,
      }));
    };
    setIsUploading(true);
    Promise.all(
      selectedFiles.map((file) => {
        setUploadStatus((prev) => ({ ...prev, [file.name]: "Uploading..." }));
        const formData = new FormData();
        formData.append("file", file);
        formData.append("client_id", client_id);
        return axios
          .post("http://127.0.0.1:8000/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          .then((res) => {
            if (res.status === 200) {
              setUploadStatus((prev) => ({
                ...prev,
                [file.name]: "✅ Uploaded",
              }));
            } else {
              setUploadStatus((prev) => ({
                ...prev,
                [file.name]: "❌ Failed",
              }));
            }
          })
          .catch(() => {
            setUploadStatus((prev) => ({
              ...prev,
              [file.name]: "❌ Failed",
            }));
          });
      })
    ).finally(() => {
      setIsUploading(false);
      fileInputRef.current.value = null;
      setSelectedFiles([]);
      setTimeout(() => {
        setUploadStatus({});
        setProgress({});
      }, 2000);
      ws.close();
    });
  };

  return (
    <div className="container">
      {/* Left - Photo Grid */}
      <div className="gallery-section">
        <h1>Uploaded Photos</h1>
        <div className="grid">
          {thumbnails.map((thumbnail, idx) => (
            <img
              key={idx}
              src={`data:image/jpeg;base64,${thumbnail}`}
              alt="thumbnail"
              className="grid-image"
            />
          ))}
        </div>
      </div>

      {/* Right - Upload Section */}
      <div className="upload-section">
        <h2>Upload Files</h2>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={isUploading}
          ref={fileInputRef}
        />
        <button
          onClick={handleParallelUpload}
          disabled={selectedFiles.length === 0 || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>

        <div className="status-list">
          {Object.keys(uploadStatus).map((fileName) => (
            <div key={fileName} className="status-item">
              <strong>{fileName}</strong> — {uploadStatus[fileName]}{" "}
              {progress[fileName] !== undefined && (
                <span>({Math.round((progress[fileName] || 0) * 100)}%)</span>
              )}
              {progress[fileName] !== undefined && (
                <div className="progress-bar">
                  <div
                    className="progress"
                    style={{
                      width: `${(progress[fileName] || 0) * 100}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
