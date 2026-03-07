"use client";

import { useEffect, useState } from "react";

export default function ResultsPage() {
  const [coverLetter, setCoverLetter] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("generatedCoverLetter") || "";
    setCoverLetter(saved);
  }, []);

  function formatPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  async function downloadWord(template: string) {
    if (!agreed) {
      alert(
        "You must review and agree to the responsibility statement before downloading."
      );
      return;
    }

    const stored = JSON.parse(
      sessionStorage.getItem("coverLetterData") || "{}"
    );

    const res = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template,
        coverLetter,
        name: stored.name || "",
        email: stored.email || "",
        phone: formatPhone(stored.phone || ""),

        address: stored.address || "",
        city: stored.city || "",
        state: stored.state || "",
        zip: stored.zip || "",

        company: stored.company || "",
        hiringManager: stored.hiringManager || "",
        companyAddress: stored.companyAddress || "",
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

  const templates = [
    { name: "TemplateA", image: "/templates/a.png" },
    { name: "TemplateB", image: "/templates/b.png" },
    { name: "TemplateC", image: "/templates/c.png" },
    { name: "TemplateD", image: "/templates/d.png" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-300 to-slate-500 flex justify-center p-8">
      <div className="bg-white max-w-5xl w-full rounded-xl shadow-lg p-10">

        <h1 className="text-3xl font-bold text-blue-900 mb-6">
          Your Cover Letter
        </h1>

        {/* EDITABLE COVER LETTER */}

      <textarea
  rows={20}
  value={coverLetter}
  onChange={(e) => setCoverLetter(e.target.value)}
  className="border rounded-lg p-6 w-full text-gray-800 leading-7 mb-8 resize-y font-serif"
/>

        {/* AI RESPONSIBILITY MESSAGE */}

        <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-5 mb-6">

          <p className="font-semibold mb-3 text-yellow-900">
            Important: Review Before Downloading
          </p>

          <p className="text-sm text-yellow-900 mb-4">
            This cover letter was generated using AI. It is your responsibility
            to carefully review, approve, and edit the content before using it.
            Do not blindly accept this cover letter as the final version.
            Verify all information and make any necessary changes to ensure
            accuracy and professionalism.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">

            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />

            <span className="text-sm font-medium">
              I understand that I must review and edit this cover letter before
              using it.
            </span>

          </label>

        </div>

        <h2 className="text-xl font-semibold text-blue-900 mb-6">
          Choose a Cover Letter Template
        </h2>

        {/* TEMPLATE SELECTOR */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          {templates.map((template) => (

            <div
              key={template.name}
              onClick={() => agreed && downloadWord(template.name)}
              className={`border rounded-lg shadow overflow-hidden bg-white transition
              ${
                agreed
                  ? "cursor-pointer hover:shadow-xl"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >

              <img
                src={template.image}
                alt={template.name}
                className="w-full h-72 object-contain bg-gray-50 p-4"
              />

              <div className="p-3 text-center font-medium text-gray-700">
                {template.name}
              </div>

            </div>

          ))}

        </div>

      </div>
    </main>
  );
}