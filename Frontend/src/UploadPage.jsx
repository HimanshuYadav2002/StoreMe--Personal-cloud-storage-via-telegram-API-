import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./UploadPage.css";
import { useNavigate } from "react-router-dom";

//function to get client id from loacl storage

function getClient_id() {
  return localStorage.getItem("client_id");
}

function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({});
  const [progress, setProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [thumbnail, setThumbnail] = useState([]);
  // input ref
  const fileInputRef = useRef(null);
  const [client_id, setClient_id] = useState(getClient_id());
  const navigate = useNavigate();

  // checks for client_id changes in every 1 sec
  useEffect(() => {
    const interval = setInterval(() => {
      const currentId = localStorage.getItem("client_id");

      if (client_id !== currentId) {
        (async () => {
          const response = await fetch("http://localhost:8000/removeClient", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: client_id }),
          });
          if (response.ok) {
            clearInterval(interval);
            alert("Session Invalid");
            navigate("/");
          }
        })();
      }
    }, 1000);

    return () => clearInterval(interval); // Cleanup
  }, []);

  // Check for client_id on mount and when uploading
  useEffect(() => {
    if (isUploading === false) {
      axios
        .post("http://127.0.0.1:8000/getPhotos", { client_id: client_id })
        .then((res) => setThumbnail(res.data.photos))
        .catch((err) => console.error(err));
    }
  }, [isUploading]);

  // make a array of all file and set it in selectedFiles and set status of all files to pending...

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    files.forEach((file) => {
      setUploadStatus((prev) => ({
        ...prev,
        [file.name]: "Pending",
      }));
    });
  };

  // when upload button get clicked

  // make a websocket request to server and server stores a active socket id in it

  // ws.onmessage() this function listem to all progress message from backend and set progress of current file in Progress which gives us realtime progress of file upload from out server----->telegram server .

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
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
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
      ws.close();
    });
  };

  return (
    <div className="container">
      {/* Left - Photo Grid */}
      <div className="gallery-section">
        <h2>Uploaded Photos</h2>
        <div className="grid">
          {thumbnail.map((thumb, i) => (
            <img
              key={i}
              src={`data:image/jpeg;base64,${thumb.data}`}
              alt={thumb.name}
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
