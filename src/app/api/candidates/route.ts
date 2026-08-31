import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const REF_REGEX = /^\d{4}-[a-zA-Z0-9]{8}-\d{4}$/;
const APP_REGEX = /^\d{7}$/;
const FOREIGN_ID_REGEX = /^\d{11}$/;

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";

    const queryAsNumber = parseInt(query, 10);
    const isNum = !isNaN(queryAsNumber);

    const candidates = await prisma.candidate.findMany({
      where: query
        ? {
            OR: [
              ...(isNum ? [{ registrationNo: queryAsNumber }] : []),
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { fatherName: { contains: query } },
              { spouseName: { contains: query } },
              { passportNo: { contains: query } },
              { birthPlace: body.birthPlace ? String(body.birthPlace).trim().toLocaleUpperCase("tr-TR") : "",
        cnicNo: body.cnicNo ? String(body.cnicNo).trim() : null,
        nationality: { contains: query } },
              { profession: { contains: query } },
              { agency: { contains: query } },
              { refNumber: { contains: query } },
              { appNumber: { contains: query } },
              { foreignIdNo: { contains: query } },
              { createdByName: { contains: query } },
              { appCreatedByName: { contains: query } },
              { phone: { contains: query } },
              { company: { name: { contains: query } } },
            ],
          }
        : undefined,
      include: {
        company: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(candidates);
  } catch (error) {
    return NextResponse.json({ error: "Veriler alınamadı" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    if (!body.firstName || !body.lastName || !body.fatherName || !body.passportNo || !body.passportExpiry || !body.profession || !body.agency || !body.companyId || !body.birthDate || !body.birthPlace) {
      return NextResponse.json({ error: "Lütfen tüm zorunlu alanları doldurun." }, { status: 400 });
    }

    const expiryDate = new Date(body.passportExpiry);
    const minValidDate = new Date();
    minValidDate.setHours(0, 0, 0, 0);
    minValidDate.setMonth(minValidDate.getMonth() + 6);

    if (expiryDate < minValidDate) {
      return NextResponse.json({ error: "Pasaport bitiş tarihi bulunduğumuz tarihten itibaren en az 6 ay sonrası için geçerli olmalıdır!" }, { status: 400 });
    }

    
    if (body.birthDate) {
      const bDate = new Date(body.birthDate);
      const today = new Date();
      let age = today.getFullYear() - bDate.getFullYear();
      const m = today.getMonth() - bDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
          age--;
      }
      if (age < 18) {
        return NextResponse.json({ error: "Personel en az 18 yaşında olmalıdır!" }, { status: 400 });
      }
    }
if (body.refNumber) {
      if (!REF_REGEX.test(body.refNumber.trim())) {
        return NextResponse.json({ 
          error: "Referans numarası hatalı veya eksik! (Örn: 2026-asswq210-2708)" 
        }, { status: 400 });
      }
      if (!body.refExpiryDate) {
        return NextResponse.json({ error: "Referans numarası girildiğinde Referans Son Günü zorunludur!" }, { status: 400 });
      }
    }

    if (body.appNumber && !APP_REGEX.test(body.appNumber.trim())) {
      return NextResponse.json({ 
        error: "Başvuru numarası tam 7 basamaklı bir sayı olmalıdır! (Örn: 4322122)" 
      }, { status: 400 });
    }

    if (body.appStatus === "Harç Ödemesi" && body.foreignIdNo) {
      if (!FOREIGN_ID_REGEX.test(body.foreignIdNo.trim())) {
        return NextResponse.json({ error: "Yabancı Kimlik Numarası tam 11 haneli sayıdan oluşmalıdır!" }, { status: 400 });
      }
    }

    const lastCandidate = await prisma.candidate.findFirst({
      orderBy: { registrationNo: "desc" },
      select: { registrationNo: true },
    });
    const nextRegNo = (lastCandidate?.registrationNo || 0) + 1;

    let finalStatus = body.status || "Sözleşme Gönderildi";
    if (body.appStatus === "Onaylandı") {
      finalStatus = "Bilet Bekliyor";
    }

    const creator = (session?.user as any)?.nickname || session?.user?.name || "Bilinmeyen Yetkili";

    // Mükerrer Pasaport ve Referans No Kontrolü
    const cleanPassport = body.passportNo ? body.passportNo.trim().toUpperCase() : "";
    const cleanRef = body.refNumber ? body.refNumber.trim() : "";

    if (cleanPassport) {
      const existingPassport = await prisma.candidate.findFirst({
        where: { passportNo: cleanPassport }
      });
      if (existingPassport) {
        return NextResponse.json({ error: `Bu pasaport numarasına (${cleanPassport}) ait sistemde zaten kayıtlı bir personel bulunuyor!` }, { status: 400 });
      }
    }

    if (cleanRef) {
      const existingRef = await prisma.candidate.findFirst({
        where: { refNumber: cleanRef }
      });
      if (existingRef) {
        return NextResponse.json({ error: `Bu referans numarasına (${cleanRef}) ait sistemde zaten kayıtlı bir personel bulunuyor!` }, { status: 400 });
      }
    }

    const candidate = await prisma.candidate.create({
      data: {
        registrationNo: nextRegNo,
        firstName: String(body.firstName || "").trim().toLocaleUpperCase("tr-TR"),
        lastName: String(body.lastName || "").trim().toLocaleUpperCase("tr-TR"),
        fatherName: String(body.fatherName || "").trim().toLocaleUpperCase("tr-TR"),
        motherName: body.motherName ? String(body.motherName).trim().toLocaleUpperCase("tr-TR") : null,
        spouseName: body.spouseName ? String(body.spouseName).trim().toLocaleUpperCase("tr-TR") : null,
        gender: body.gender || "Erkek",
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        birthPlace: body.birthPlace ? String(body.birthPlace).trim().toLocaleUpperCase("tr-TR") : "",
        cnicNo: body.cnicNo ? String(body.cnicNo).trim() : null,
        nationality: toTitleCase(body.nationality || "Pakistan"),
        passportNo: body.passportNo.trim().toLocaleUpperCase("tr-TR"),
        passportExpiry: new Date(body.passportExpiry),
        profession: toTitleCase(body.profession),
        agency: toTitleCase(body.agency),
        salary: body.salary || "33.030,00",
        phone: body.phone || null,
        status: finalStatus,
        notes: body.notes ? body.notes.trim() : null,
        companyId: body.companyId,
        createdByName: creator,

        refNumber: body.refNumber ? body.refNumber.trim() : null,
        refExpiryDate: body.refExpiryDate ? new Date(body.refExpiryDate) : null,
        appNumber: body.appNumber ? body.appNumber.trim() : null,
        appDate: body.appDate ? new Date(body.appDate) : null,
        appStatus: body.appStatus || "Beklemede",
        foreignIdNo: body.appStatus === "Harç Ödemesi" && body.foreignIdNo ? body.foreignIdNo.trim() : null,
        appCreatedByName: body.appNumber ? creator : null,
      },
      include: { company: true }
    });
    return NextResponse.json(candidate, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Kayıt oluşturulamadı" }, { status: 400 });
  }
}