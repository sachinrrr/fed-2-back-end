import express from "express";
import {
  getAllColors,
  createColor,
  getColorById,
} from "../application/color";
import isAuthenticated from "./middleware/authentication-middleware";
import { isAdmin } from "./middleware/authorization-middleware";

const colorRouter = express.Router();

colorRouter
  .route("/")
  .get(getAllColors)
  .post(isAuthenticated, isAdmin, createColor);

colorRouter
  .route("/:id")
  .get(getColorById);

export default colorRouter;
