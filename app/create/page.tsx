"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  const [jobUrl, setJobUrl] = useState("");
  const [jobAd, setJobAd] = useState("");

  const [extraInfo, setExtraInfo] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [companyAddress, setCompanyAddress] = useState("");
  const [hiringManager, setHiringManager] = useState("");

  async function handleGenerate() {
    if (!name || !company || !jobTitle || (!jobAd && !jobUrl) || !resumeFile) {
      alert(
        "Please provide a job posting URL OR paste the job advertisement and upload a resume."
      );
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("company", company);
      formData.append("companyWebsite", companyWebsite);
      formData.append("jobTitle", jobTitle);

      formData.append("hiringManager", hiringManager);
      formData.append("companyAddress", companyAddress);

      formData.append("jobUrl", jobUrl);
      formData.append("jobAd", jobAd);

      formData.append("extraInfo", extraInfo);
      formData.append("resume", resumeFile);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(text);
        throw new Error(text);
      }

      const data = await res.json();

      if (!data.coverLetter) {
        throw new Error("Cover letter was not returned.");
      }

      // Save AI cover letter
      sessionStorage.setItem("generatedCoverLetter", data.coverLetter);

      // Use AI lookup if available, otherwise student input
      const finalManager = data.hiringManager || hiringManager;
      const finalAddress = data.companyAddress || companyAddress;

      // Save for Word template
      sessionStorage.setItem(
        "coverLetterData",
        JSON.stringify({
          name,
          email,
          phone,
          company,
          jobTitle,
          hiringManager: finalManager,
          companyAddress: finalAddress,
        })
      );

      router.push("/results");

    } catch (error: any) {
      console.error(error);
      alert(error?.message || "There was a problem generating the cover letter.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-300 to-slate-500 flex justify-center p-8">
      <div className="bg-white max-w-3xl w-full rounded-xl shadow-lg p-10">

        <h1 className="text-3xl font-bold text-blue-900 mb-6">
          Create Your Cover Letter
        </h1>

        {/* STUDENT INFO */}

        <h2 className="text-xl font-semibold mb-3">Student Information</h2>

        <div className="grid gap-4 mb-6">

          <input
            className="border p-3 rounded"
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="border p-3 rounded"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="border p-3 rounded"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

        </div>

        {/* JOB INFO */}

        <h2 className="text-xl font-semibold mb-3">Job Information</h2>

        <div className="grid gap-4 mb-6">

          <input
            className="border p-3 rounded"
            placeholder="Company Name *"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />

          <input
            className="border p-3 rounded"
            placeholder="Company Website (optional)"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
          />

          <input
            className="border p-3 rounded"
            placeholder="Job Title *"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />

          <input
            className="border p-3 rounded"
            placeholder="Hiring Manager Name (optional)"
            value={hiringManager}
            onChange={(e) => setHiringManager(e.target.value)}
          />

          <input
            className="border p-3 rounded"
            placeholder="Company Address (optional)"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
          />

        </div>

        {/* JOB URL */}

        <h2 className="text-xl font-semibold mb-2">
          Job Posting URL (Optional)
        </h2>

        <p className="text-sm text-gray-600 mb-3">
          Paste a link to the job posting (Indeed, company website, LinkedIn, etc.)
        </p>

        <input
          className="border p-3 rounded w-full mb-6"
          placeholder="https://company.com/jobs/..."
          value={jobUrl}
          onChange={(e) => setJobUrl(e.target.value)}
        />

        {/* JOB AD TEXT */}

        <h2 className="text-xl font-semibold mb-2">Job Advertisement</h2>

        <p className="text-sm text-gray-600 mb-3">
          OR copy and paste the job description below.
        </p>

        <textarea
          className="border p-3 rounded w-full h-56 mb-8"
          placeholder="Paste the job advertisement here..."
          value={jobAd}
          onChange={(e) => setJobAd(e.target.value)}
        />

        {/* EXTRA INFO */}

        <h2 className="text-xl font-semibold mb-2">
          Additional Information (Optional)
        </h2>

        <p className="text-sm text-gray-600 mb-3">
          Add anything specific you want mentioned in the cover letter.
        </p>

        <textarea
          className="border p-3 rounded w-full h-32 mb-8"
          placeholder="Example: I recently completed OSHA 10 training and am very interested in fabrication work."
          value={extraInfo}
          onChange={(e) => setExtraInfo(e.target.value)}
        />

        {/* RESUME UPLOAD */}

        <h2 className="text-xl font-semibold mb-3">Upload Your Resume</h2>

        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setResumeFile(e.target.files[0]);
            }
          }}
          className="border p-3 rounded w-full mb-8"
        />

        {/* BUTTON */}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-900 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-800 transition disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Cover Letter"}
        </button>

      </div>
    </main>
  );
}