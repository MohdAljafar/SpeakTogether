import { supabaseAuth } from "../supabase.js";
import { prisma } from "../db.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired session" });

    const authUser = data.user;
    const user = await prisma.user.upsert({
      where: { id: authUser.id },
      update: {
        email: authUser.email,
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
        image: authUser.user_metadata?.avatar_url || null
      },
      create: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
        image: authUser.user_metadata?.avatar_url || null
      }
    });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
