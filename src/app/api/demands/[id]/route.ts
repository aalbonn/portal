import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { companyName, professions, headCount, requesterName, requesterPhone, cityName } = body;

    const updatedDemand = await prisma.demand.update({
      where: { id },
      data: {
        companyName: companyName ? companyName.trim().toLocaleUpperCase("tr-TR") : undefined,
        professions,
        headCount: headCount ? parseInt(headCount, 10) : undefined,
        requesterName,
        requesterPhone,
        cityName,
      },
    });

    return NextResponse.json(updatedDemand);
  } catch (error) {
    console.error("PUT_DEMAND_ERROR", error);
    return NextResponse.json({ error: "Talep güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
    }

    const { id } = await params;
    await prisma.demand.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE_DEMAND_ERROR", error);
    return NextResponse.json({ error: "Talep silinemedi." }, { status: 500 });
  }
}
