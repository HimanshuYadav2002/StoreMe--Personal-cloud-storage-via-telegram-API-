import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

//function to generate random client id on first use and storing it to browser local storage

function getClientId() {
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
  const [thumbnail, setThumbnail] = useState([]);

  // input ref
  const fileInputRef = useRef(null);
  // caliing getClient() fucntion
  const clientId = getClientId();

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/getPhotos")
      .then((res) => setThumbnail(res.data.photos))
      .catch((err) => console.error(err));
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

  const handleUpload = async () => {
    // we have made a websocket connection request

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/progress/${clientId}`);

    // this function listen to every message send

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress((prev) => ({
        ...prev,
        [data.filename]: data.progress,
      }));
    };

    // is uploading sets to true for disabling upload button

    setIsUploading(true);

    // iterating over all file objects in selectedFiles and making individual form data and then sending api request to /upload rouete and setting upload status of that file to uploaded when response code === 200

    for (const file of selectedFiles) {
      setUploadStatus((prev) => ({ ...prev, [file.name]: "Uploading..." }));
      setProgress((prev) => ({ ...prev, [file.name]: 0 }));
      const formData = new FormData();
      formData.append("file", file);

      try {
        let response = await axios.post(
          `http://127.0.0.1:8000/upload/${clientId}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (response.status === 200) {
          setUploadStatus((prev) => ({
            ...prev,
            [file.name]: "✅ Uploaded",
          }));
        } else {
          console.log(response.status);
          setUploadStatus((prev) => ({ ...prev, [file.name]: "❌ Failed" }));
        }
      } catch {
        setUploadStatus((prev) => ({ ...prev, [file.name]: "❌ Failed" }));
      }
    }

    // setting uploadig to false to enable upload button
    setIsUploading(false);
    // resettig all selected file after upload
    fileInputRef.current.value = null;
    // setting selected file to empty array[]
    setSelectedFiles([]);
    // closing web socket connecting
    ws.close();
  };

  return (
    <>
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
      <div>
        {thumbnail.map((thumb, i) => (
          <img
            key={i}
            src={`data:image/jpeg;base64,${thumb.data}`}
            alt={thumb.name}
            width="100"
            height="100"
          />
        ))}
      </div>
    </>
  );
}

export default App;
