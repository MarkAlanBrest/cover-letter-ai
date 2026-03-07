import { NextResponse } from "next/server";
import OpenAI from "openai";
import mammoth from "mammoth";
import * as cheerio from "cheerio";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractResumeText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(Buffer.from(bytes));
    return data.text || "";
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
    throw new Error(
      "DOC files are not supported. Please upload a PDF or DOCX file."
    );
  }

  throw new Error("Unsupported resume format. Please upload PDF or DOCX.");
}

async function extractJobFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

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
}

async function lookupCompanyInfo(
  company: string,
  website: string,
  jobTitle: string
) {

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

  try {
    const text = response.output_text || "";
    return JSON.parse(text);
  } catch {
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
    });

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

    const formData = await req.formData();

    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const company = String(formData.get("company") || "");
    const companyWebsite = String(formData.get("companyWebsite") || "");
    const jobTitle = String(formData.get("jobTitle") || "");

    const jobAd = String(formData.get("jobAd") || "");
    const jobUrl = String(formData.get("jobUrl") || "");

    const hiringManagerInput = String(formData.get("hiringManager") || "");
    const companyAddressInput = String(formData.get("companyAddress") || "");

    const extraInfo = String(formData.get("extraInfo") || "");
    const resume = formData.get("resume");

    if (resume instanceof File && resume.size > 5_000_000) {
      return NextResponse.json(
        { error: "Resume file must be under 5MB." },
        { status: 400 }
      );
    }

    if (
      !name ||
      !company ||
      !jobTitle ||
      (!jobAd && !jobUrl) ||
      !resume ||
      !(resume instanceof File)
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    let finalJobAd = jobAd;

    if (jobUrl && /^https?:\/\//i.test(jobUrl)) {
      const extracted = await extractJobFromUrl(jobUrl);

      if (extracted.length > 200) {
        finalJobAd = extracted;
      }
    }

    const resumeText = await extractResumeText(resume);

    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: "Could not read any text from the uploaded resume." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "The AI did not return a cover letter." },
        { status: 500 }
      );
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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}