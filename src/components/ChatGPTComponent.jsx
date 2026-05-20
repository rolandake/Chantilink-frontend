import React from 'react';
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  (import.meta.env.PROD ? "https://chantilink-backend.onrender.com" : "http://localhost:5000");

const socket = io(SOCKET_URL);

export default function ChatGPTComponent({ userId }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.emit("joinRoom", userId);

    socket.on("receiveGPTMessage", (data) => {
      setMessages(prev => [...prev, { from: "GPT", content: data.reply }]);
    });

    return () => socket.off("receiveGPTMessage");
  }, [userId]);

  const sendMessage = () => {
    if (!input) return;
    setMessages(prev => [...prev, { from: "You", content: input }]);
    socket.emit("sendGPTMessage", { userId, message: input });
    setInput("");
  };

  return (
    <div>
      <div className="chat-box">
        {messages.map((m, i) => (
          <div key={i}><b>{m.from}:</b> {m.content}</div>
        ))}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} placeholder="Tapez un message..." />
      <button onClick={sendMessage}>Envoyer</button>
    </div>
  );
}


