"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  function start() { 
    router.push("/create");
  }

  return (
<main className="min-h-screen bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center p-6">     
     
     
      <div className="bg-white max-w-2xl w-full rounded-xl shadow-lg p-10 text-center">

        <h2 className="text-2xl font-semibold mb-6">
          AI Cover Letter Generator
        </h2>

        <p className="text-gray-700 mb-8">
          Create a professional cover letter tailored to your resume, job
          advertisement, and the company you are applying to. This tool helps
          you quickly generate a strong cover letter ready to submit
          with job applications.
        </p>

        <button
          onClick={start}
          className="bg-blue-900 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-800 transition mb-10"
        >
          Start Creating Your Cover Letter
        </button>

        <div className="text-left mb-8">
          <h3 className="text-xl font-semibold mb-3">How It Works</h3>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Upload your resume.</li>
            <li>Paste the job advertisement.</li>
            <li>Add the company website (optional).</li>
            <li>Generate and download your cover letter.</li>
          </ol>
        </div>

        <div className="text-left mb-8">
          <h3 className="text-xl font-semibold mb-3">What This Tool Does</h3>
          <ul className="list-disc ml-6 text-gray-700 space-y-2">
            <li>Matches your resume to the job advertisement.</li>
            <li>Highlights your relevant skills and training.</li>
            <li>Uses company information to tailor the letter.</li>
            <li>Creates a professional Word cover letter ready to submit.</li>
          </ul>
        </div>

        <p className="text-sm text-gray-500">
          Your information is used only to generate your cover letter and is not stored.
        </p>

      </div>
    </main>
  );
}
