import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export const runtime = "nodejs";

export async function POST(req: Request) {

  const body = await req.json();

  const coverLetter = body.coverLetter || "";
  const name = body.name || "";
  const email = body.email || "";
  const phone = body.phone || "";
  const company = body.company || "";
  const hiringManager = body.hiringManager || "";
  const companyAddress = body.companyAddress || "";

  const templatePath = path.join(
    process.cwd(),
    "templates",
    "cover-letter-template.docx"
  );

  const content = fs.readFileSync(templatePath, "binary");

  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const cleanLetter = coverLetter
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const greeting = hiringManager
    ? `Dear ${hiringManager},`
    : "Dear Hiring Manager,";

  doc.render({
    studentName: name,
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
    letterBody: cleanLetter,
  });

  const buffer = doc.getZip().generate({
    type: "uint8array",
  });

  const nodeBuffer = Buffer.from(buffer);

  return new Response(nodeBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=cover-letter.docx",
    },
  });
}