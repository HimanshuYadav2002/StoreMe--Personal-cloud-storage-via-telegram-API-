// Centralized base addresses
const HTTP_BASE = import.meta.env.VITE_HTTP_BASE;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function getClient_id() {
  return localStorage.getItem("client_id")
    ? localStorage.getItem("client_id")
    : "";
}

const LoginPage = () => {
  const [phone, setPhone] = useState("");
  const [Otp, setOtp] = useState("");
  const [client_id, setClient_id] = useState(getClient_id());
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Effect: checks for client_id changes every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      const currentId = getClient_id();
      // Only attempt to remove client if there is a valid client_id
      if (client_id !== currentId && currentId !== "") {
        localStorage.setItem("client_id", "");

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
  }, [client_id]);

  useEffect(() => {
    (async () => {
      let response = await fetch(`${HTTP_BASE}/getClientActiveStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client_id }),
      });
      const body = await response.json();
      console.log(body.message);
      if (body.message === "client found") {
        navigate("/upload");
      } else {
        setClient_id("");
        localStorage.setItem("client_id", "");
      }
    })();
  }, []);

  const sendCode = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${HTTP_BASE}/getCode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (response.ok) {
        setStep(2);
        setClient_id(data.client_id);
        localStorage.setItem("client_id", data.client_id);
      } else {
        alert(data.error || "Failed to send OTP");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${HTTP_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client_id, verify_code: Otp }),
      });
      const data = await response.json();
      if (response.ok) {
        alert("Login successful!");
        navigate("/upload");
      } else {
        alert(data.error || "Invalid OTP");
        console.log(data.detail || "Invalid OTP");
        setClient_id("");
        setStep(1);
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-12 rounded-3xl shadow-2xl border border-gray-700 max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">
          🔐 Telegram Login
        </h2>
        {step === 1 && (
          <>
            <label className="text-lg mb-2 block text-gray-300">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="+91XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-gray-700 text-white border border-gray-600 p-3 text-lg rounded-xl w-full mb-6 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              onClick={sendCode}
              disabled={loading}
              className="w-full p-3 text-lg font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 transition text-white mb-2"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <label className="text-lg mb-2 block text-gray-300">OTP Code</label>
            <input
              type="text"
              placeholder="Enter OTP"
              value={Otp}
              onChange={(e) => setOtp(e.target.value)}
              className="bg-gray-700 text-white border border-gray-600 p-3 text-lg rounded-xl w-full mb-6 focus:outline-none focus:border-green-500 transition"
            />
            <button
              onClick={verifyCode}
              disabled={loading}
              className="w-full p-3 text-lg font-semibold rounded-xl bg-green-500 hover:bg-green-600 transition text-white mb-2"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
