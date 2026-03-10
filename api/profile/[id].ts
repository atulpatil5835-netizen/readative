import type { VercelRequest, VercelResponse } from "@vercel/node"

type ProfileData = {
  id: string
  name?: string
  photo?: string
  email?: string
  readingScore?: number
  examScore?: number
  readPosts?: string[]
  following?: string[]
  preferredLanguage?: string
}

const profiles = new Map<string, ProfileData>()

function getIdFromQuery(id: string | string[] | undefined): string {
  if (Array.isArray(id)) return id[0] ?? ""
  return id ?? ""
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  const id = getIdFromQuery(req.query.id)
  if (!id) {
    return res.status(400).json({ error: "Profile id is required" })
  }

  if (req.method === "GET") {
    const current = profiles.get(id) ?? {
      id,
      readingScore: 0,
      examScore: 0,
      readPosts: [],
      following: [],
      preferredLanguage: "English",
    }
    return res.json(current)
  }

  if (req.method === "POST") {
    const incoming =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as ProfileData)
        : ((req.body ?? {}) as ProfileData)

    const previous = profiles.get(id) ?? { id }
    const next: ProfileData = {
      ...previous,
      ...incoming,
      id,
    }
    profiles.set(id, next)
    return res.json(next)
  }

  return res.status(405).json({ error: "Method not allowed" })
}
