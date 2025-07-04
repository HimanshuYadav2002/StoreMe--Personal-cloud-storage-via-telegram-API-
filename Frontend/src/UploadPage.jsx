// Centralized base addresses
const HTTP_BASE = import.meta.env.VITE_HTTP_BASE;
const WS_BASE = import.meta.env.VITE_WS_BASE;

import { useState, useRef, useEffect } from "react";
import axios from "axios";
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
  const [Limit, setLimit] = useState(0);
  // Ref for file input
  const fileInputRef = useRef(null);
  // State for client_id
  const [client_id, setClient_id] = useState(getClient_id());
  const navigate = useNavigate();

  // Effect: checks for client_id changes every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      let currentId;
      // If client_id changes, remove client session and redirect
      if (localStorage.getItem("client_id") === null) {
        currentId = "";
      } else {
        currentId = localStorage.getItem("client_id");
      }
      if (client_id !== currentId) {
        localStorage.setItem("client_id", client_id);
        (async () => {
          await fetch(`${HTTP_BASE}/removeClient`, {
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
      let response = await fetch(`${HTTP_BASE}/getClientActiveStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client_id }),
      });
      const body = await response.json();
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
      const ws = new WebSocket(`${WS_BASE}/streamPhotos/${client_id}/${Limit}`);
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
      let response = await fetch(`${HTTP_BASE}/getClientActiveStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client_id }),
      });
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
        [file.name]: "Pending...",
      }));
      setProgress((prev) => ({ ...prev, [file.name]: 0 }));
    });
  };

  // Handles sequential file upload with progress updates
  const handleUpload = async () => {
    const ws = new WebSocket(`${WS_BASE}/ws/progress/${client_id}`);
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
        let response = await axios.post(`${HTTP_BASE}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.status === 200) {
          setUploadStatus((prev) => ({
            ...prev,
            [file.name]: "Uploaded✅",
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
    const ws = new WebSocket(`${WS_BASE}/ws/progress/${client_id}`);
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
          .post(`${HTTP_BASE}/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          .then((res) => {
            if (res.status === 200) {
              setUploadStatus((prev) => ({
                ...prev,
                [file.name]: "Uploaded✅",
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
      setLimit(selectedFiles.length);
      setSelectedFiles([]);
      setTimeout(() => {
        setUploadStatus({});
        setProgress({});
      }, 2000);
      ws.close();
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen min-h-screen w-full bg-gray-900 text-gray-200 font-sans">
      {/* Left - Photo Grid */}
      <div className=" flex flex-3 flex-col w-full min-h-[400px]">
        <h1 className="text-center text-2xl font-bold text-gray-100 p-4">
          Uploaded Photos
        </h1>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2 overflow-y-auto hide-scrollbar p-5">
          {thumbnails.map((thumbnail, idx) => (
            <img
              key={idx}
              src={`data:image/jpeg;base64,${thumbnail}`}
              alt="thumbnail"
              className="w-full h-full aspect-square object-cover rounded-md border-2 border-cyan-600 hover:border-4 shadow-xl hover:scale-140  transition-transform duration-200"
            />
          ))}
        </div>
      </div>

      {/* Right - Upload Section */}
      <div className="flex flex-1 flex-col px-4 bg-gray-800  min-h-[300px] min-w-[300px]">
        <h2 className="mt-4 mb-9 text-2xl font-bold text-white text-center tracking-wide">
          Upload Files
        </h2>

        <input
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={isUploading}
          ref={fileInputRef}
          className="mb-2 p-3 bg-gray-900 text-gray-300  border-2 border-gray-500 rounded-lg  focus:outline-none focus:border-cyan-400 transition"
        />
        <button
          onClick={handleParallelUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          className={`mb-6 py-2 rounded-lg font-bold transition-colors  shadow-md text-lg ${
            isUploading
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-cyan-400 text-black hover:bg-cyan-500"
          }`}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>

        <div className="overflow-y-auto hide-scrollbar ">
          {Object.keys(uploadStatus).map((fileName) => (
            <div
              key={fileName}
              className="border border-gray-600 mb-4 p-3 rounded-lg bg-gray-900 shadow-sm"
            >
              <div className="flex justify-between mb-1">
                <strong className="truncate max-w-[60%] text-cyan-300">
                  {fileName}
                </strong>
                <span className="ml-2 text-sm font-medium">
                  {uploadStatus[fileName]}
                </span>
                {progress[fileName] !== undefined && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({Math.round((progress[fileName] || 0) * 100)}%)
                  </span>
                )}
              </div>
              {progress[fileName] !== undefined && (
                <div className="progress-bar h-2 bg-gray-700 rounded mt-1">
                  <div
                    className="progress h-full bg-green-400 rounded transition-all"
                    style={{ width: `${(progress[fileName] || 0) * 100}%` }}
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
