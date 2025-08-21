import { Request, Response, NextFunction } from "express";
import UnauthorizedError from "../../domain/errors/unauthorized-error";
import { clerkClient, getAuth } from "@clerk/express";
import ForbiddenError from "../../domain/errors/forbidden-error";

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);

  console.log("Auth object:", JSON.stringify(auth, null, 2));
  console.log("Session claims:", JSON.stringify(auth.sessionClaims, null, 2));
  console.log("Metadata:", JSON.stringify(auth.sessionClaims?.metadata, null, 2));

  const userIsAdmin = auth.sessionClaims?.metadata?.role === "admin";

  if (!userIsAdmin) {
    throw new ForbiddenError("Forbidden");
  }

  next();
};

export { isAdmin };