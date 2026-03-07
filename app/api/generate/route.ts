import { NextResponse } from "next/server";
import OpenAI from "openai";
import mammoth from "mammoth";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractResumeText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  // ---------- PDF ----------
  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {

    // Use require for compatibility with Turbopack
    const pdfParse = require("pdf-parse");

    const data = await pdfParse(Buffer.from(bytes));

    return data.text || "";
  }

  // ---------- DOCX ----------
  if (
    fileName.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = Buffer.from(bytes);
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  // ---------- Unsupported ----------
  if (fileName.endsWith(".doc")) {
    throw new Error(
      "DOC files are not supported yet. Please upload a PDF or DOCX file."
    );
  }

  throw new Error("Unsupported resume format. Please upload PDF or DOCX.");
}

export async function POST(req: Request) {
  try {

    const formData = await req.formData();

    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const company = String(formData.get("company") || "");
    const companyWebsite = String(formData.get("companyWebsite") || "");
    const jobTitle = String(formData.get("jobTitle") || "");
    const jobAd = String(formData.get("jobAd") || "");
    const extraInfo = String(formData.get("extraInfo") || "");
    const resume = formData.get("resume");

    if (
      !name ||
      !company ||
      !jobTitle ||
      !jobAd ||
      !resume ||
      !(resume instanceof File)
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const resumeText = await extractResumeText(resume);

    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: "Could not read any text from the uploaded resume." },
        { status: 400 }
      );
    }

    // Prevent huge prompts
    const safeResume = resumeText.slice(0, 8000);

    const prompt = `
You are writing a professional cover letter.

Applicant Information
Name: ${name}
Email: ${email}
Phone: ${phone}

Company Information
Company Name: ${company}
Company Website: ${companyWebsite}
Job Title: ${jobTitle}

Job Advertisement
${jobAd}

Resume Information
${safeResume}

Additional Information from Applicant
${extraInfo}

Instructions:

Write a polished and professional cover letter tailored to the job advertisement.

IMPORTANT:
- Improve grammar, punctuation, and clarity.
- Emphasize relevant skills from the resume.
- Mirror important skills or keywords from the job advertisement.
- Use the additional applicant information if relevant.

OUTPUT RULES:

Return ONLY the body paragraphs of the cover letter.

Do NOT include:
- name
- address
- email
- phone
- company name
- date
- greeting
- closing
- signature
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const coverLetter = response.output_text?.trim();

    if (!coverLetter) {
      return NextResponse.json(
        { error: "The AI did not return a cover letter." },
        { status: 500 }
      );
    }

    const cleanedLetter = coverLetter
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({ coverLetter: cleanedLetter });

  } catch (error) {

    console.error("Generate route error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}