import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}

export async function PUT(request: Request, context: any) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    
    // Güvenli ID alma yöntemi (Tüm Next.js sürümleriyle tam uyumlu)
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;

    if (!id) {
       return NextResponse.json({ error: "Geçersiz ID" }, { status: 400 });
    }

    const expiryDate = new Date(body.passportExpiry);
    const minValidDate = new Date();
    minValidDate.setHours(0, 0, 0, 0);
    minValidDate.setMonth(minValidDate.getMonth() + 6);

    if (expiryDate < minValidDate) {
      return NextResponse.json({ error: "Pasaport bitiş tarihi en az 6 ay sonrası için geçerli olmalıdır!" }, { status: 400 });
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

    const isMinistryCleared = body.isMinistryCleared === true;
    let finalStatus = body.status || "Sözleşme Gönderildi";
    if (body.appStatus === "Onaylandı") {
      finalStatus = "Bilet Bekliyor";
    }

    const cleanPassport = body.passportNo ? String(body.passportNo).replace(/\s/g, "").toUpperCase() : "";
    const cleanRef = body.refNumber ? String(body.refNumber).trim() : "";

    // MÜKERRER KONTROLÜ - SADECE MEVCUT KİŞİ (ID) HARİÇ TUTULARAK YAPILIYOR
    if (cleanPassport) {
      const existingPassport = await prisma.candidate.findFirst({
        where: { 
          passportNo: cleanPassport,
          id: { not: id } // Kendi ID'sini dışla
        }
      });
      if (existingPassport) {
        return NextResponse.json({ error: "Bu pasaport numarasına ait başka bir personel bulunuyor!" }, { status: 400 });
      }
    }

    if (cleanRef) {
      const existingRef = await prisma.candidate.findFirst({
        where: { 
          refNumber: cleanRef,
          id: { not: id } // Kendi ID'sini dışla
        }
      });
      if (existingRef) {
        return NextResponse.json({ error: "Bu referans numarasına ait başka bir personel bulunuyor!" }, { status: 400 });
      }
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        firstName: String(body.firstName || "").trim().toLocaleUpperCase("tr-TR"),
        lastName: String(body.lastName || "").trim().toLocaleUpperCase("tr-TR"),
        fatherName: String(body.fatherName || "").trim().toLocaleUpperCase("tr-TR"),
        
        motherName: body.motherName && body.motherName.trim() !== "" ? String(body.motherName).trim().toLocaleUpperCase("tr-TR") : null,
        spouseName: body.spouseName && body.spouseName.trim() !== "" ? String(body.spouseName).trim().toLocaleUpperCase("tr-TR") : null,
        cnicNo: body.cnicNo && body.cnicNo.trim() !== "" ? String(body.cnicNo).trim() : null,
        phone: body.phone && body.phone.trim() !== "" ? body.phone.trim() : null,
        notes: body.notes && body.notes.trim() !== "" ? body.notes.trim() : null,

        gender: body.gender || "Erkek",
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        birthPlace: String(body.birthPlace || "").trim().toLocaleUpperCase("tr-TR"),
        nationality: toTitleCase(body.nationality || "Pakistan"),
        passportNo: cleanPassport,
        passportExpiry: new Date(body.passportExpiry),
        profession: toTitleCase(body.profession),
        agency: toTitleCase(body.agency),
        salary: body.salary || "33.030,00",
        status: finalStatus,
        companyId: body.companyId || null,

        refNumber: isMinistryCleared ? null : (cleanRef !== "" ? cleanRef : null),
        refExpiryDate: isMinistryCleared ? null : (body.refExpiryDate && String(body.refExpiryDate).trim() !== "" ? new Date(body.refExpiryDate) : null),
        appNumber: isMinistryCleared ? null : (body.appNumber && body.appNumber.trim() !== "" ? body.appNumber.trim() : null),
        appDate: isMinistryCleared ? null : (body.appDate && String(body.appDate).trim() !== "" ? new Date(body.appDate) : null),
        appStatus: isMinistryCleared ? "Beklemede" : (body.appStatus || "Beklemede"),
        foreignIdNo: isMinistryCleared ? null : (body.appStatus === "Harç Ödemesi" && body.foreignIdNo && body.foreignIdNo.trim() !== "" ? body.foreignIdNo.trim() : null), feeDate: isMinistryCleared ? null : (body.feeDate ? String(body.feeDate).trim() : null), feeExpiryDate: isMinistryCleared ? null : (body.feeExpiryDate ? String(body.feeExpiryDate).trim() : null),
      },
      include: { company: true }
    });
    
    return NextResponse.json(candidate, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Güncelleme başarısız" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    await prisma.candidate.delete({ where: { id } });
    return NextResponse.json({ message: "Silindi" });
  } catch (error) {
    return NextResponse.json({ error: "Silinemedi" }, { status: 400 });
  }
}
