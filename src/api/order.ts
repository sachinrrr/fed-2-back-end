import express from "express";
import { createOrder, getOrder, getUserOrders, getAllOrders, getSalesData, updateOrderStatus } from "../application/order";
import isAuthenticated from "./middleware/authentication-middleware";
import { isAdmin } from "./middleware/authorization-middleware";

export const orderRouter = express.Router();

orderRouter.route("/").post(isAuthenticated, createOrder);
orderRouter.route("/user").get(isAuthenticated, getUserOrders);
orderRouter.route("/admin/all").get(isAuthenticated, isAdmin, getAllOrders);
orderRouter.route("/admin/sales").get(isAuthenticated, isAdmin, getSalesData);
orderRouter.route("/admin/:id").put(isAuthenticated, isAdmin, updateOrderStatus);
orderRouter.route("/:id").get(isAuthenticated, getOrder);