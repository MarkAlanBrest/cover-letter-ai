import { NextResponse } from "next/server";
import OpenAI from "openai";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

async function extractResumeText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
    const parser = new PDFParse({ data: Buffer.from(bytes) });

    try {
      const data = await parser.getText();
      return data.text || "";
    } finally {
      await parser.destroy();
    }
  }

  if (
    fileName.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = Buffer.from(bytes);
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (fileName.endsWith(".doc")) {
    throw new ApiError(
      "DOC files are not supported. Please upload a PDF or DOCX file.",
      400
    );
  }

  throw new ApiError("Unsupported resume format. Please upload PDF or DOCX.", 400);
}

async function extractJobFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return "";

    const html = await res.text();
    const $ = cheerio.load(html);
    const text = $("body").text();

    return text.replace(/\s+/g, " ").trim().slice(0, 4000);
  } catch (error) {
    console.error("Job URL fetch failed:", error);
    return "";
  }
}

async function extractKeySkills(jobText: string): Promise<string[]> {
  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
Extract the 8 most important skills or qualifications from this job posting.

Return them as a simple comma separated list.

Job Posting:
${jobText}
`,
    });

    const skills = response.output_text
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return skills || [];
  } catch (error) {
    console.error("Skill extraction failed:", error);
    return [];
  }
}

async function lookupCompanyInfo(
  company: string,
  website: string,
  jobTitle: string
) {
  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
Find the hiring manager and company address if possible.

Company: ${company}
Website: ${website}
Job Title: ${jobTitle}

Rules:
- Do NOT guess a hiring manager.
- If unknown, return empty values.

Return JSON ONLY:

{
 "hiringManager": "",
 "companyAddress": ""
}
`,
    });

    const text = response.output_text || "";
    return JSON.parse(text);
  } catch (error) {
    console.error("Company lookup failed:", error);
    return {
      hiringManager: "",
      companyAddress: ""
    };
  }
}

async function extractCompanyContext(company: string, website: string) {

  if (!website) return "";

  try {

    const res = await fetch(website, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return "";

    const html = await res.text();

    const $ = cheerio.load(html);

    const text = $("body").text().replace(/\s+/g, " ").slice(0, 2000);

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
Summarize what this company does in ONE short sentence.

Company: ${company}

Website text:
${text}

Return one sentence only.
`,
    });

    return response.output_text?.trim() || "";

  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return jsonError("The AI service is not configured.", 500);
    }

    const formData = await req.formData();

    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const company = String(formData.get("company") || "");
    const companyWebsite = normalizeUrl(String(formData.get("companyWebsite") || ""));
    const jobTitle = String(formData.get("jobTitle") || "");

    const jobAd = String(formData.get("jobAd") || "");
    const jobUrl = normalizeUrl(String(formData.get("jobUrl") || ""));

    const hiringManagerInput = String(formData.get("hiringManager") || "");
    const companyAddressInput = String(formData.get("companyAddress") || "");

    const extraInfo = String(formData.get("extraInfo") || "");
    const resume = formData.get("resume");

    if (resume instanceof File && resume.size > 5_000_000) {
      return jsonError("Resume file must be under 5MB.", 400);
    }

    if (
      !name ||
      !company ||
      !jobTitle ||
      (!jobAd && !jobUrl) ||
      !resume ||
      !(resume instanceof File)
    ) {
      return jsonError("Missing required fields.", 400);
    }

    let finalJobAd = jobAd;

    if (jobUrl) {
      const extracted = await extractJobFromUrl(jobUrl);

      if (extracted.length > 200) {
        finalJobAd = extracted;
      }
    }

    if (finalJobAd.trim().length < 50) {
      return jsonError(
        "Could not read enough job posting text. Please paste the job advertisement instead of using a link.",
        400
      );
    }

    const resumeText = await extractResumeText(resume);

    if (!resumeText.trim()) {
      return jsonError("Could not read any text from the uploaded resume.", 400);
    }

    const safeResume = resumeText.slice(0, 8000);

    const keySkills = await extractKeySkills(finalJobAd);
    const skillText = keySkills.join(", ");

    const companyContext = await extractCompanyContext(
      company,
      companyWebsite
    );

    let hiringManager = hiringManagerInput;
    let companyAddress = companyAddressInput;

    if (!hiringManager || !companyAddress) {

      const lookup = await lookupCompanyInfo(
        company,
        companyWebsite,
        jobTitle
      );

      if (!hiringManager && lookup.hiringManager) {
        hiringManager = lookup.hiringManager;
      }

      if (!companyAddress && lookup.companyAddress) {
        companyAddress = lookup.companyAddress;
      }
    }

    const prompt = `
You are writing a professional cover letter.

Applicant Information
Name: ${name}
Email: ${email}
Phone: ${phone}

Company Information
Company Name: ${company}
Company Website: ${companyWebsite}
Company Address: ${companyAddress}
Hiring Manager: ${hiringManager}

Company Background
${companyContext}

Job Title: ${jobTitle}

Job Advertisement
${finalJobAd}

Resume Information
${safeResume}

Additional Information from Applicant
${extraInfo}

IMPORTANT:

The most important skills from the job posting are:
${skillText}

Writing rules:

- If company background is available, reference it naturally in the FIRST sentence.
- Emphasize experience from the resume that matches the listed skills.
- Mirror language used in the job posting when appropriate.
- Improve grammar, punctuation, and clarity.
- Keep the tone professional and confident.

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
      return jsonError("The AI did not return a cover letter. Please try again.", 502);
    }

    const cleanedLetter = coverLetter
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    return NextResponse.json({
      coverLetter: cleanedLetter,
      hiringManager,
      companyAddress
    });

  } catch (error) {

    console.error("Generate route error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error.";
    const status = error instanceof ApiError ? error.status : 500;

    return jsonError(message, status);
  }
}
