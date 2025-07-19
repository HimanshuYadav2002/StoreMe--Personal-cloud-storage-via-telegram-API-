// Centralized base addresses
const HTTP_BASE = import.meta.env.VITE_HTTP_BASE;
const WS_BASE = import.meta.env.VITE_WS_BASE;

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// function to get client id from local storage
function getClient_id() {
  return localStorage.getItem("client_id")
    ? localStorage.getItem("client_id")
    : "";
}

function UploadPage() {
  // State variables for file selection, upload status, progress, uploading state, and thumbnails
  const [client_id, setClient_id] = useState(getClient_id());
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({});
  const [progress, setProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [thumbnailsData, setThumbnailsData] = useState([]);
  const [Limit, setLimit] = useState(0);
  const [isIntialPhotoStreaming, setIsInitialPhotoStreaming] = useState(true);
  const [SelectedImageData, setSelectedImageData] = useState();
  const [PreviousImageData, setPreviousImageData] = useState();
  const [NextImageData, setNextImageData] = useState();
  // Ref for file input
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // variable for handleThumbnailclick function
  const [OriginalImageUrl, setOriginalImageUrl] = useState(null);
  const OriginalImageChunks = useRef([]);
  const PreviousNextImageWebsocket = useRef();

  // Effect: fetches thumbnails via WebSocket when not uploading
  useEffect(() => {
    if (isUploading === false) {
      fetch(`${HTTP_BASE}/getClientActiveStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client_id }),
      })
        .then((response) => response.json())
        .then((body) => {
          if (body.message === "client found") {
            console.log("client Found");

            const ws = new WebSocket(
              `${WS_BASE}/streamPhotos/${client_id}/${Limit}/${isIntialPhotoStreaming}`
            );
            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              if (data.done) {
                ws.close();
                setIsInitialPhotoStreaming(false);
                return;
              }
              if (data) {
                setThumbnailsData((prev) => [...prev, data]);
              }
            };
            ws.onerror = (err) => {
              console.error("WebSocket error:", err);
            };
            return () => {
              if (ws.readyState === 1) ws.close();
              // Only close if open
            };
          } else {
            alert("Session Invalid !!!");
            navigate("/");
          }
        });
    }
  }, [isUploading]);

  // Effect: checks for change in client_id every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      let currentId = getClient_id();
      // If client_id changes, remove client session and redirect
      if (client_id !== currentId) {
        localStorage.setItem("client_id", client_id);
        (async () => {
          await fetch(`${HTTP_BASE}/removeClient`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: currentId }),
          });
        })();
      }
    }, 1000);
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []);

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

  // logout handle function
  const handleLogout = async () => {
    await axios.post(`${HTTP_BASE}/removeClient`, { client_id: client_id });
    navigate("/");
  };

  // Handles sequential file upload with progress updates
  const handleUpload = async () => {
    setIsUploading(true);
    let response = await fetch(`${HTTP_BASE}/getClientActiveStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client_id }),
    });
    let body = await response.json();
    if (body.message === "client found") {
      const ws = new WebSocket(`${WS_BASE}/ws/progress/${client_id}`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress((prev) => ({
          ...prev,
          [data.filename]: data.progress,
        }));
      };

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
    } else {
      alert("Session Invalid !!!");
      navigate("/");
    }
  };

  // Handles parallel file upload with progress updates
  const handleParallelUpload = () => {
    setIsUploading(true);
    fetch(`${HTTP_BASE}/getClientActiveStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client_id }),
    })
      .then((response) => response.json())
      .then((body) => {
        if (body.message === "client found") {
          const ws = new WebSocket(`${WS_BASE}/ws/progress/${client_id}`);
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress((prev) => ({
              ...prev,
              [data.filename]: data.progress,
            }));
          };

          Promise.all(
            selectedFiles.map((file) => {
              setUploadStatus((prev) => ({
                ...prev,
                [file.name]: "Uploading...",
              }));
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
        } else {
          alert("Session Invalid !!!");
          navigate("/");
        }
      });
  };

  // helper function to get next and previous message id of current selected image
  function getPrevAndNextImageId(arr, conditionFn) {
    const index = arr.findIndex(conditionFn);

    if (index === -1) {
      return { prev: null, next: null }; // No match found
    }

    const prev = index > 0 ? arr[index - 1] : null;
    const next = index < arr.length - 1 ? arr[index + 1] : null;

    return { prev, next };
  }

  // handle load currently selected image and previous and next image data
  useEffect(() => {
    if (SelectedImageData) {
      setPreviousImageData(
        getPrevAndNextImageId(
          thumbnailsData,
          (thumbnailData) =>
            thumbnailData.message_id === SelectedImageData.message_id
        ).prev
      );
      setNextImageData(
        getPrevAndNextImageId(
          thumbnailsData,
          (thumbnailData) =>
            thumbnailData.message_id === SelectedImageData.message_id
        ).next
      );
      const ws = new WebSocket(
        `${WS_BASE}/getFullSizePhoto/${client_id}/${SelectedImageData.message_id}`
      );
      PreviousNextImageWebsocket.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onmessage = (event) => {
        // Collect chunk
        OriginalImageChunks.current.push(new Uint8Array(event.data));

        const blob = new Blob(OriginalImageChunks.current, {
          type: "image/jpeg",
        });
        const objectUrl = URL.createObjectURL(blob);

        setOriginalImageUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return objectUrl;
        });
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
      };
    }
    return () => {
      URL.revokeObjectURL(OriginalImageUrl);
      setOriginalImageUrl(null);
      OriginalImageChunks.current = [];
      setPreviousImageData();
      setNextImageData();
    };
  }, [SelectedImageData]);

  const handleThumbnailClick = (thumbnailData) => {
    setSelectedImageData(thumbnailData);
  };

  const PreviousButtonClick = () => {
    PreviousNextImageWebsocket.current.close();
    setSelectedImageData(PreviousImageData);
  };
  const NextButtonClick = () => {
    PreviousNextImageWebsocket.current.close();
    setSelectedImageData(NextImageData);
  };

  const CloseFullImageView = () => {
    setNextImageData();
    setPreviousImageData();
    if (OriginalImageUrl) URL.revokeObjectURL(OriginalImageUrl);
    setOriginalImageUrl(null);
    OriginalImageChunks.current = [];
    setSelectedImageData();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen min-h-screen w-full bg-gray-900 text-gray-200 font-sans">
      {/* Left - Photo Grid */}
      <div className=" flex flex-3 flex-col w-full min-h-[400px]">
        <div className="flex justify-between mx-5 my-4">
          <h1 className="text-center text-2xl font-bold text-gray-100">
            Uploaded Photos
          </h1>
          <button
            disabled={isUploading}
            onClick={handleLogout}
            className={`text-white font-mono rounded-md px-4 ${
              isUploading
                ? "cursor-not-allowed bg-red-700"
                : " bg-red-500  hover:bg-red-600"
            }`}
          >
            Logout
          </button>
        </div>

        <div className="relative h-full overflow-y-auto hide-scrollbar">
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2  p-5">
            {thumbnailsData.map((thumbnailData, idx) => (
              <img
                onClick={() => {
                  handleThumbnailClick(thumbnailData);
                }}
                key={idx}
                src={`data:image/jpeg;base64,${thumbnailData.thumbnail}`}
                alt="thumbnail"
                className="w-full h-full aspect-square object-cover rounded-md border-2 border-cyan-600 hover:border-4 shadow-xl hover:scale-140  transition-transform duration-200"
              />
            ))}
          </div>

          {SelectedImageData && (
            <div className="fixed top-0 h-full w-full backdrop-blur-xl flex justify-between px-10">
              <button
                disabled={!PreviousImageData}
                onClick={PreviousButtonClick}
                className="rounded-xl bg-black opacity-20 text-4xl font-extrabold p-3 self-center"
              >
                {"<-"}
              </button>
              {OriginalImageUrl && (
                <img
                  src={OriginalImageUrl}
                  alt="Original Image"
                  className="aspect-auto"
                />
              )}
              <button
                disabled={!NextImageData}
                onClick={NextButtonClick}
                className="rounded-xl bg-black opacity-20 text-4xl font-extrabold p-3 self-center"
              >
                {"->"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right - Upload Section */}
      <div className="flex flex-1 flex-col px-5 bg-gray-800  min-h-[300px] min-w-[300px]">
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
