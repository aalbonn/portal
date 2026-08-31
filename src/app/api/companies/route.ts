import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";

    const companies = await prisma.company.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { taxNumber: { contains: query } },
              { taxOffice: { contains: query } },
              { referralPerson: { contains: query } },
              { contactName: { contains: query } },
              { officialName: { contains: query } },
              { contactTitle: { contains: query } },
              { createdByName: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : undefined,
      include: {
        candidates: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(companies);
  } catch (error) {
    return NextResponse.json({ error: "Şirketler alınamadı" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    // İstenilen verileri arka planda kesin olarak büyük harfe zorla
    const uppercaseFields = ['name', 'companyName', 'title', 'officialTitle', 'taxOffice', 'taxDepartment', 'address', 'headquartersAddress', 'centerAddress', 'workAddress', 'foreignWorkAddress', 'foreignAddress'];
    uppercaseFields.forEach(field => {
        if (body[field]) {
            body[field] = String(body[field]).toLocaleUpperCase("tr-TR");
        }
    });


    if (!body.name || !body.taxNumber || !body.taxOffice || !body.companyAddress || !body.workAddress) {
      return NextResponse.json({ error: "Lütfen zorunlu şirket alanlarını doldurun." }, { status: 400 });
    }

    const creator = (session?.user as any)?.nickname || session?.user?.name || "Bilinmeyen Yetkili";

    const company = await prisma.company.create({
      data: {
        name: body.name.trim().toLocaleUpperCase("tr-TR"),
        taxNumber: body.taxNumber.trim(),
        taxOffice: body.taxOffice.trim(),
        companyAddress: body.companyAddress,
        workAddress: body.workAddress,
        contactName: body.contactName,
        officialName: body.officialName,
      contactTitle: body.contactTitle || null,
        referralPerson: body.referralPerson || null,
        phone: body.phone || null,
        email: body.email || null,
        notes: body.notes || null,
        createdByName: creator,
      },
      include: { candidates: true }
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Şirket oluşturulamadı" }, { status: 400 });
  }
}
