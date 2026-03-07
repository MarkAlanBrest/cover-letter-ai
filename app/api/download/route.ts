import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -------------------------
   SAFE INPUT NORMALIZATION
--------------------------*/

function titleCase(text: string) {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeState(state: string) {
  return (state || "").toUpperCase().trim();
}

function normalizeZip(zip: string) {
  const digits = zip.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0,5)}-${digits.slice(5)}`;
  }
  return digits.slice(0,5);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}

function normalizeAddress(address: string) {

  const abbreviations: Record<string, string> = {
    avenue: "Ave.",
    ave: "Ave.",
    street: "St.",
    st: "St.",
    road: "Rd.",
    rd: "Rd.",
    drive: "Dr.",
    dr: "Dr.",
    lane: "Ln.",
    ln: "Ln.",
    boulevard: "Blvd.",
    blvd: "Blvd.",
    court: "Ct.",
    ct: "Ct.",
    place: "Pl.",
    pl: "Pl."
  };

  let cleaned = address
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned
    .split(" ")
    .map(word => {
      if (abbreviations[word]) return abbreviations[word];
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return cleaned;
}

/* -------------------------
   AI FORMATTING
--------------------------*/

async function fixFormatting(text: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional editor. Fix punctuation, capitalization, and spacing. Do not rewrite or add content."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0
    });

    return response.choices[0].message.content || text;
  } catch (err) {
    console.error("AI formatting failed, using original text");
    return text;
  }
}

export async function POST(req: Request) {

  const body = await req.json();

  const template = body.template || "TemplateA";

  /* -------------------------
     NORMALIZE USER INPUT
  --------------------------*/

  const name = titleCase(body.name || "");
  const email = normalizeEmail(body.email || "");
  const phone = normalizePhone(body.phone || "");

  const address = normalizeAddress(body.address || "");
  const city = titleCase(body.city || "");
  const state = normalizeState(body.state || "");
  const zip = normalizeZip(body.zip || "");

  const company = titleCase(body.company || "");
  const hiringManager = titleCase(body.hiringManager || "");
  const companyAddress = normalizeAddress(body.companyAddress || "");

  const coverLetter = body.coverLetter || "";

  const studentAddress = `${address}
${city}, ${state} ${zip}`;

  /* -------------------------
     TEMPLATE LOADING
  --------------------------*/

  const templatePath = path.join(
    process.cwd(),
    "templates",
    `${template}.docx`
  );

  if (!fs.existsSync(templatePath)) {
    console.error("Template not found:", templatePath);
    return new Response("Template not found", { status: 500 });
  }

  const content = fs.readFileSync(templatePath, "binary");

  const zipFile = new PizZip(content);

  const doc = new Docxtemplater(zipFile, {
    paragraphLoop: true,
    linebreaks: true,
  });

  /* -------------------------
     LETTER CLEANUP
  --------------------------*/

  const cleanLetter = coverLetter
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const formattedLetter = await fixFormatting(cleanLetter);

  const greeting = hiringManager
    ? `Dear ${hiringManager},`
    : "Dear Hiring Manager,";

  /* -------------------------
     TEMPLATE VARIABLES
  --------------------------*/

  doc.render({
    studentName: name,
    studentAddress: studentAddress,
    email: email,
    phone: phone,
    companyName: company,
    companyAddress: companyAddress,
    greeting: greeting,
    date: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    letterBody: formattedLetter,
  });

  const buffer = doc.getZip().generate({
    type: "uint8array",
  });

  const nodeBuffer = Buffer.from(buffer);

  return new Response(nodeBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=${template}.docx`,
    },
  });
}