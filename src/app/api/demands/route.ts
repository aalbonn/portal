import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";

    const demands = await prisma.demand.findMany({
      where: query ? {
        OR: [
          { companyName: { contains: query, mode: "insensitive" } },
          { professions: { contains: query, mode: "insensitive" } },
          { requesterName: { contains: query, mode: "insensitive" } },
          { cityName: { contains: query, mode: "insensitive" } },
        ],
      } : {},
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(demands);
  } catch (error) {
    console.error("GET_DEMANDS_ERROR", error);
    return NextResponse.json({ error: "Talepler yüklenirken bir hata oluştu." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, professions, headCount, requesterName, requesterPhone, cityName } = body;

    if (!companyName || !professions || !headCount || !requesterName || !cityName) {
      return NextResponse.json({ error: "Lütfen tüm zorunlu alanları doldurun." }, { status: 400 });
    }

    const creatorName = (session.user as any).nickname || session.user.name || "Sistem";

    const newDemand = await prisma.demand.create({
      data: {
        companyName: companyName.trim().toLocaleUpperCase("tr-TR"),
        professions,
        headCount: parseInt(headCount, 10) || 1,
        requesterName,
        requesterPhone: requesterPhone || "",
        cityName,
        createdByName: creatorName,
      },
    });

    return NextResponse.json(newDemand);
  } catch (error) {
    console.error("POST_DEMAND_ERROR", error);
    return NextResponse.json({ error: "Talep kaydedilemedi." }, { status: 500 });
  }
}
