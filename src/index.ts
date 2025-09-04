import "dotenv/config";
import express from "express";
import productRouter from "./api/product";
import categoryRouter from "./api/category";
import colorRouter from "./api/color";
import reviewRouter from "./api/review";
import paymentRouter from "./api/payment";
import { connectDB } from "./infrastructure/db/index";
import globalErrorHandlingMiddleware from "./api/middleware/global-error-handling-middleware";
import cors from "cors";
import { orderRouter } from "./api/order";
import { clerkMiddleware } from "@clerk/express";

const app = express();

// CORS configuration to handle both local development and production - MUST BE FIRST
const allowedOrigins: string[] = [
  "http://localhost:5173", 
  "https://fed-mebius.netlify.app", 
  process.env.FRONTEND_URL || "" 
].filter((origin): origin is string => Boolean(origin)); 

app.use(cors({ 
  origin: allowedOrigins,
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], 
}));

app.use(clerkMiddleware());

// Add payment routes 
app.use("/api/payments", paymentRouter);

// Middleware to parse JSON bodies
app.use(express.json()); //It conversts the incomign json payload of a  request into a javascript object found in req.body

app.use("/api/products", productRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/colors", colorRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/orders", orderRouter);

app.use(globalErrorHandlingMiddleware);

connectDB();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});