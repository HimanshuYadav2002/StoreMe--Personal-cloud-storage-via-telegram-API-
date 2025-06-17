import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

function getClient_id() {
  return localStorage.getItem("client_id");
}

const LoginPage = () => {
  const [phone, setPhone] = useState("");
  const [Otp, setOtp] = useState("");
  const [client_id, setClient_id] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (getClient_id()) {
      navigate("/upload");
    }
  },[]);

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
        setClient_id(data.client_id);
        setStep(2);
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
