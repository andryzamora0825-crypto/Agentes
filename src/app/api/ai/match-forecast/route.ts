import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

function isVipOrAdmin(user: any): boolean {
  const email = user?.primaryEmailAddress?.emailAddress || "";
  if (email === ADMIN_EMAIL) return true;
  const plan = (user?.publicMetadata as any)?.plan || "FREE";
  const expiresAt = (user?.publicMetadata as any)?.vipExpiresAt as number | undefined | null;
  if (plan !== "VIP") return false;
  if (!expiresAt) return true;
  return Date.now() <= Number(expiresAt);
}

// ── Base URLs API-Sports por deporte ──
const SPORT_BASE: Record<string, string> = {
  football: "https://v3.football.api-sports.io",
  basketball: "https://v1.basketball.api-sports.io",
  baseball: "https://v1.baseball.api-sports.io",
  tennis: "https://v1.tennis.api-sports.io",
};

async function fetchLastFixtures(sport: string, teamId: number, apiKey: string, last = 5): Promise<any[]> {
  try {
    const baseUrl = SPORT_BASE[sport] || SPORT_BASE.football;
    const endpoint = sport === "football" ? "/fixtures" : "/games";
    const teamParam = sport === "football" ? "team" : "team";
    const url = `${baseUrl}${endpoint}?${teamParam}=${teamId}&last=${last}`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.response || [];
  } catch {
    return [];
  }
}

// Resume los últimos N partidos en forma de "W-D-L y goles"
function summarizeFootballForm(teamId: number, fixtures: any[]): { form: string; goalsFor: number; goalsAgainst: number; summary: string } {
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  const lines: string[] = [];

  for (const f of fixtures) {
    const home = f.teams?.home;
    const away = f.teams?.away;
    const goals = f.goals;
    if (!home || !away || !goals) continue;
    const isHome = home.id === teamId;
    const ownGoals = isHome ? goals.home : goals.away;
    const rivalGoals = isHome ? goals.away : goals.home;
    gf += ownGoals || 0;
    ga += rivalGoals || 0;

    if (ownGoals === null || rivalGoals === null) continue;
    if (ownGoals > rivalGoals) wins++;
    else if (ownGoals === rivalGoals) draws++;
    else losses++;

    const rivalName = isHome ? away.name : home.name;
    const result = ownGoals > rivalGoals ? "ganó" : ownGoals === rivalGoals ? "empató" : "perdió";
    lines.push(`${result} ${ownGoals}-${rivalGoals} vs ${rivalName}`);
  }

  const form = `${wins}V-${draws}E-${losses}D`;
  return { form, goalsFor: gf, goalsAgainst: ga, summary: lines.join("; ") };
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!isVipOrAdmin(user)) {
      return NextResponse.json({ error: "Función disponible solo para agentes VIP." }, { status: 403 });
    }

    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) return NextResponse.json({ error: "Falta API_SPORTS_KEY." }, { status: 500 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Falta OPENAI_API_KEY." }, { status: 500 });

    const body = await request.json();
    const { sport = "football", homeTeam, awayTeam, homeId, awayId, league, time, odds } = body;

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({ error: "Faltan homeTeam/awayTeam." }, { status: 400 });
    }

    // Traer forma de ambos equipos en paralelo (si vienen los IDs)
    const [homeFixtures, awayFixtures] = await Promise.all([
      homeId ? fetchLastFixtures(sport, homeId, apiKey, 5) : Promise.resolve([]),
      awayId ? fetchLastFixtures(sport, awayId, apiKey, 5) : Promise.resolve([]),
    ]);

    let homeForm = "sin datos";
    let awayForm = "sin datos";
    let homeSummary = "";
    let awaySummary = "";

    if (sport === "football" && homeId) {
      const s = summarizeFootballForm(homeId, homeFixtures);
      homeForm = `${s.form} · ${s.goalsFor}GF/${s.goalsAgainst}GC`;
      homeSummary = s.summary;
    }
    if (sport === "football" && awayId) {
      const s = summarizeFootballForm(awayId, awayFixtures);
      awayForm = `${s.form} · ${s.goalsFor}GF/${s.goalsAgainst}GC`;
      awaySummary = s.summary;
    }

    // Construir prompt para GPT
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const oddsLine = odds && (odds.home || odds.away || odds.draw)
      ? `Cuotas actuales (1X2): ${homeTeam} ${odds.home ?? "?"} · Empate ${odds.draw ?? "?"} · ${awayTeam} ${odds.away ?? "?"}.`
      : "";

    const systemPrompt = `Eres un analista deportivo profesional que escribe para una casa de apuestas latinoamericana.
Tu trabajo es producir un PRONÓSTICO BREVE y COMERCIAL para redes sociales, con tono seguro, data-driven, pero genuino (no exagerado ni engañoso). Siempre en español neutro.

ESTRUCTURA EXACTA (JSON):
{
  "tldr": "una línea con el veredicto (ej: 'Barcelona favorito por estado de forma superior')",
  "analysis": "2-3 oraciones explicando POR QUÉ, citando la forma reciente y goles de cada equipo. Incluye números.",
  "pick": "el mercado sugerido en frase corta (ej: 'Barcelona gana', 'Más de 2.5 goles', 'Empate no', etc.)",
  "confidence": "Alta/Media/Baja",
  "caption": "Copy listo para IG/WhatsApp/TikTok, 3-5 líneas, con emojis, tono entusiasta pero creíble. DEBE incluir el enfrentamiento, la hora, el pick y un CTA para apostar."
}
NO inventes estadísticas que no estén en los datos. Si no hay datos suficientes, dilo con elegancia y reduce la confianza.`;

    const userContent = `Partido: ${homeTeam} vs ${awayTeam}
Liga: ${league || "sin especificar"}
Hora: ${time || "sin especificar"}
${oddsLine}

Forma reciente ${homeTeam}: ${homeForm}${homeSummary ? ` (${homeSummary})` : ""}
Forma reciente ${awayTeam}: ${awayForm}${awaySummary ? ` (${awaySummary})` : ""}

Genera el JSON pronóstico.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let forecast: any = {};
    try { forecast = JSON.parse(raw); } catch { forecast = { analysis: raw }; }

    return NextResponse.json({
      success: true,
      match: `${homeTeam} vs ${awayTeam}`,
      homeForm,
      awayForm,
      forecast,
    });
  } catch (error: any) {
    console.error("[MATCH-FORECAST] Error:", error);
    return NextResponse.json({ error: error.message || "Error generando pronóstico." }, { status: 500 });
  }
}
