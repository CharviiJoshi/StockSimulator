fetch("http://localhost:5174/api/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test@example.com" })
}).then(res => res.json()).then(console.log).catch(console.error);
