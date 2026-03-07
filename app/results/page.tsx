"use client";

import { useEffect, useState } from "react";

export default function ResultsPage() {
  const [coverLetter, setCoverLetter] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("generatedCoverLetter") || "";
    setCoverLetter(saved);
  }, []);


function formatPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }

  return phone;
}
  async function downloadWord() {

    const stored = JSON.parse(
      sessionStorage.getItem("coverLetterData") || "{}"
    );

    const res = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coverLetter,
        name: stored.name || "",
        email: stored.email || "",
        phone: formatPhone(stored.phone || ""),
        company: stored.company || "",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(text);
      alert("Download failed");
      return;
    }

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "cover-letter.docx";

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-300 to-slate-500 flex justify-center p-8">
      <div className="bg-white max-w-4xl w-full rounded-xl shadow-lg p-10">

        <h1 className="text-3xl font-bold text-blue-900 mb-6">
          Your Cover Letter
        </h1>

        <div className="border rounded p-6 whitespace-pre-wrap text-gray-800 leading-7 mb-8">
          {coverLetter || "No cover letter generated."}
        </div>

        <button
          onClick={downloadWord}
          className="bg-blue-900 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-800 transition"
        >
          Download Word Document
        </button>

      </div>
    </main>
  );
}