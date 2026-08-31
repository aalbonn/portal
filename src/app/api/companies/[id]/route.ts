import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    const isSuperAdmin = (session?.user as any)?.role === "SUPER_ADMIN";
    const body = await request.json();

    // İstenilen verileri arka planda kesin olarak büyük harfe zorla
    const uppercaseFields = ['name', 'companyName', 'title', 'officialTitle', 'taxOffice', 'taxDepartment', 'address', 'headquartersAddress', 'centerAddress', 'workAddress', 'foreignWorkAddress', 'foreignAddress'];
    uppercaseFields.forEach(field => {
        if (body[field]) {
            body[field] = String(body[field]).toLocaleUpperCase("tr-TR");
        }
    });


    const updatePayload: any = {
      name: body.name ? body.name.trim().toLocaleUpperCase("tr-TR") : undefined,
      taxNumber: body.taxNumber ? body.taxNumber.trim() : undefined,
      taxOffice: body.taxOffice ? body.taxOffice.trim() : undefined,
      companyAddress: body.companyAddress,
      workAddress: body.workAddress,
      contactName: body.contactName,
        officialName: body.officialName,
      contactTitle: body.contactTitle || null,
      referralPerson: body.referralPerson || null,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
    };

    if (isSuperAdmin && body.createdByName) {
      updatePayload.createdByName = body.createdByName;
    }

    const updated = await prisma.company.update({
      where: { id: params.id },
      data: updatePayload,
      include: { candidates: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Şirket güncellenemedi" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    await prisma.candidate.deleteMany({ where: { companyId: params.id } });
    await prisma.company.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Silinemedi" }, { status: 400 });
  }
}
