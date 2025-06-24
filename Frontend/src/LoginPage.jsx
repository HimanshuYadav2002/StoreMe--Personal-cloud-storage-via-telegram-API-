import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

function getClient_id() {
  return localStorage.getItem("client_id");
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
      const currentId = localStorage.getItem("client_id");
      // If client_id changes, remove client session and redirect
      if (client_id !== currentId) {
        if (step === 1) {
          localStorage.setItem("client_id", "");
          (async () => {
            await fetch("http://localhost:8000/removeClient", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: currentId }),
            });
          })();
        }
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
      if (body.message === "client found") {
        navigate("/upload");
      } else {
        localStorage.setItem("client_id", "");
      }
    })();
  }, []);

  const sendCode = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/getCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (response.ok) {
        setStep(2);
        setClient_id(data.client_id);
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
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client_id, verify_code: Otp }),
      });
      const data = await response.json();
      if (response.ok) {
        alert("Login successful!");
        localStorage.setItem("client_id", client_id);
        navigate("/upload");
      } else {
        alert(data.error || "Invalid OTP");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">🔐 Telegram Login</h2>
        {step === 1 && (
          <>
            <label className="login-label">Phone Number</label>
            <input
              type="text"
              placeholder="+91XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="login-input"
            />
            <button
              onClick={sendCode}
              disabled={loading}
              className="login-button"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <label className="login-label">OTP Code</label>
            <input
              type="text"
              placeholder="Enter OTP"
              value={Otp}
              onChange={(e) => setOtp(e.target.value)}
              className="login-input"
            />
            <button
              onClick={verifyCode}
              disabled={loading}
              className="login-button verify"
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
