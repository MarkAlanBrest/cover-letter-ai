import { NextResponse } from "next/server";
import OpenAI from "openai";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 1,
  timeout: 25_000,
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

function truncateText(text: string, maxLength: number) {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function parseJsonObject(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
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
    try {
      const data = await pdfParse(Buffer.from(bytes));
      return data.text || "";
    } catch (error) {
      console.error("PDF parsing failed:", error);
      throw new ApiError(
        "We could not read that PDF. Please try exporting it again, or upload a DOCX version.",
        400
      );
    }
  }

  if (
    fileName.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const buffer = Buffer.from(bytes);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (error) {
      console.error("DOCX parsing failed:", error);
      throw new ApiError(
        "We could not read that DOCX file. Please try saving it again or uploading a PDF.",
        400
      );
    }
  }

  if (fileName.endsWith(".doc")) {
    throw new ApiError(
      "DOC files are not supported. Please upload a PDF or DOCX file.",
      400
    );
  }

  throw new ApiError("Unsupported resume format. Please upload PDF or DOCX.", 400);
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

    const parsed = parseJsonObject(response.output_text || "");
    return {
      hiringManager:
        typeof parsed?.hiringManager === "string" ? parsed.hiringManager : "",
      companyAddress:
        typeof parsed?.companyAddress === "string" ? parsed.companyAddress : "",
    };
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

    const html = truncateText(await res.text(), 100_000);

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

    const jobAd = truncateText(String(formData.get("jobAd") || ""), 12_000);

    const hiringManagerInput = String(formData.get("hiringManager") || "");
    const companyAddressInput = String(formData.get("companyAddress") || "");

    const extraInfo = truncateText(String(formData.get("extraInfo") || ""), 3_000);
    const resume = formData.get("resume");

    if (resume instanceof File && resume.size > 5_000_000) {
      return jsonError("Resume file must be under 5MB.", 400);
    }

    if (
      !name ||
      !company ||
      !jobTitle ||
      !jobAd ||
      !resume ||
      !(resume instanceof File)
    ) {
      return jsonError("Missing required fields.", 400);
    }

    const resumeText = await extractResumeText(resume);

    if (!resumeText.trim()) {
      return jsonError("Could not read any text from the uploaded resume.", 400);
    }

    const safeResume = resumeText.slice(0, 8000);

    const [keySkills, companyContext, lookup] = await Promise.all([
      extractKeySkills(jobAd),
      extractCompanyContext(company, companyWebsite),
      !hiringManagerInput || !companyAddressInput
        ? lookupCompanyInfo(company, companyWebsite, jobTitle)
        : Promise.resolve({
            hiringManager: "",
            companyAddress: "",
          }),
    ]);
    const skillText = keySkills.join(", ");

    let hiringManager = hiringManagerInput;
    let companyAddress = companyAddressInput;

    if (!hiringManager && lookup.hiringManager) {
      hiringManager = lookup.hiringManager;
    }

    if (!companyAddress && lookup.companyAddress) {
      companyAddress = lookup.companyAddress;
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
${jobAd}

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

    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : "Something went wrong while generating the cover letter. Please try again in a moment.";

    return jsonError(message, status);
  }
}
