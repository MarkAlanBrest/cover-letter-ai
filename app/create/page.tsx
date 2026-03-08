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
  const [address, setAddress] = useState("");
const [city, setCity] = useState("");
const [state, setState] = useState("");
const [zip, setZip] = useState("");

  const [jobInputType, setJobInputType] = useState<"url" | "text">("url");

  const [extraInfo, setExtraInfo] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [companyAddress, setCompanyAddress] = useState("");
  const [hiringManager, setHiringManager] = useState("");

  const [errors, setErrors] = useState<any>({});
  const [resumeStatus, setResumeStatus] = useState("Upload Resume Here");

  function validate() {
    const newErrors: any = {};

    if (!name) newErrors.name = "Full name is required";
    if (!company) newErrors.company = "Company name is required";
    if (!jobTitle) newErrors.jobTitle = "Job title is required";

    if (jobInputType === "url" && !jobUrl)
      newErrors.jobUrl = "Please provide the job posting URL";

    if (jobInputType === "text" && !jobAd)
      newErrors.jobAd = "Please paste the job advertisement";

    if (!resumeFile) newErrors.resume = "Please upload a resume";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function handleGenerate() {
    if (!validate()) return;

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("address", address);
formData.append("city", city);
formData.append("state", state);
formData.append("zip", zip);


      formData.append("company", company);
      formData.append("companyWebsite", companyWebsite);
      formData.append("jobTitle", jobTitle);

      formData.append("hiringManager", hiringManager);
      formData.append("companyAddress", companyAddress);

      formData.append("jobUrl", jobUrl);
      formData.append("jobAd", jobAd);

      formData.append("extraInfo", extraInfo);
      formData.append("resume", resumeFile!);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      sessionStorage.setItem("generatedCoverLetter", data.coverLetter);

      const finalManager = data.hiringManager || hiringManager;
      const finalAddress = data.companyAddress || companyAddress;
 
      sessionStorage.setItem(
        "coverLetterData",
        JSON.stringify({
          name,
          email,
          phone,
          address,
          city,
          state,
          zip,
          company,
          jobTitle,
          hiringManager: finalManager,
          companyAddress: finalAddress,
        })
      );

      router.push("/results");

    } catch (error: any) {
      alert(error.message || "Error generating cover letter.");
    } finally {
      setLoading(false);
    }
  }

  function handleResumeUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!["pdf", "doc", "docx"].includes(ext || "")) {
      setResumeStatus("❌ This is not a recognized resume format");
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
    setResumeStatus("✔ Successfully Uploaded Resume");
  }

  const inputStyle = (field: string) =>
    `border p-3 rounded w-full ${
      errors[field] ? "border-red-500 bg-red-50" : ""
    }`;

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
            className={inputStyle("name")}
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-red-600 text-sm">{errors.name}</p>}

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
          <input
  className="border p-3 rounded"
  placeholder="Street Address"
  value={address}
  onChange={(e) => setAddress(e.target.value)}
/>

<div className="grid grid-cols-3 gap-4">
  <input
    className="border p-3 rounded"
    placeholder="City"
    value={city}
    onChange={(e) => setCity(e.target.value)}
  />

  <input
    className="border p-3 rounded"
    placeholder="State"
    value={state}
    onChange={(e) => setState(e.target.value)}
  />

  <input
    className="border p-3 rounded"
    placeholder="Zip Code"
    value={zip}
    onChange={(e) => setZip(e.target.value)}
  />
</div>

        </div>

        {/* JOB INFO */}

        <h2 className="text-xl font-semibold mb-3">Job Information</h2>

        <div className="grid gap-4 mb-6">

          <input
            className={inputStyle("company")}
            placeholder="Company Name *"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          {errors.company && (
            <p className="text-red-600 text-sm">{errors.company}</p>
          )}

          <input
            className="border p-3 rounded"
            placeholder="Company Website (optional)"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
          />

          <input
            className={inputStyle("jobTitle")}
            placeholder="Job Title *"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
          {errors.jobTitle && (
            <p className="text-red-600 text-sm">{errors.jobTitle}</p>
          )}

        </div>

        {/* JOB POSTING METHOD */}

        <h2 className="text-xl font-semibold mb-2">
          Job Posting Information
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          Choose how you want to provide the job description.
        </p>

        <div className="flex gap-6 mb-6">

          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={jobInputType === "url"}
              onChange={() => setJobInputType("url")}
            />
            Use Job Posting URL
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={jobInputType === "text"}
              onChange={() => setJobInputType("text")}
            />
            Paste Job Advertisement
          </label>

        </div>

        {/* URL OPTION */}

        {jobInputType === "url" && (

          <div className="mb-6">

            <input
              className={inputStyle("jobUrl")}
              placeholder="https://company.com/jobs/..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />

            {errors.jobUrl && (
              <p className="text-red-600 text-sm mt-1">{errors.jobUrl}</p>
            )}

          </div>

        )}

        {/* TEXT OPTION */}

        {jobInputType === "text" && (

          <div className="mb-6">

            <textarea
              className={`border p-3 rounded w-full h-56 ${
                errors.jobAd ? "border-red-500 bg-red-50" : ""
              }`}
              placeholder="Paste the job advertisement here..."
              value={jobAd}
              onChange={(e) => setJobAd(e.target.value)}
            />

            {errors.jobAd && (
              <p className="text-red-600 text-sm mt-1">{errors.jobAd}</p>
            )}

          </div>

        )}

        {/* EXTRA INFO */}

        <h2 className="text-xl font-semibold mb-2">
          Additional Information (Optional)
        </h2>

        <textarea
          className="border p-3 rounded w-full h-32 mb-8"
          placeholder="Example: I recently completed OSHA 10 training and am very interested in fabrication work."
          value={extraInfo}
          onChange={(e) => setExtraInfo(e.target.value)}
        />

        {/* RESUME */}

        <h2 className="text-xl font-semibold mb-3">Upload Your Resume</h2>

        <label className="cursor-pointer bg-blue-900 text-white px-6 py-3 rounded-lg inline-block hover:bg-blue-800 transition">
          Select Resume
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleResumeUpload}
          />
        </label>

        <p className="mt-3 text-sm font-medium">{resumeStatus}</p>

        {errors.resume && (
          <p className="text-red-600 text-sm">{errors.resume}</p>
        )}

        {/* BUTTON */}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-900 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-800 transition disabled:opacity-60 mt-8"
        >
          {loading ? "Generating..." : "Generate Cover Letter"}
        </button>

      </div>
    </main>
  );
}