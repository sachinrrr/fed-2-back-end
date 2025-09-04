import { Request, Response, NextFunction } from "express";
import UnauthorizedError from "../../domain/errors/unauthorized-error";
import { clerkClient, getAuth } from "@clerk/express";
import ForbiddenError from "../../domain/errors/forbidden-error";

const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      throw new ForbiddenError("Forbidden");
    }

    // Get user data from Clerk to check publicMetadata
    const user = await clerkClient.users.getUser(auth.userId);
    const userIsAdmin = user.publicMetadata?.role === "admin";

    if (!userIsAdmin) {
      throw new ForbiddenError("Forbidden");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export { isAdmin };