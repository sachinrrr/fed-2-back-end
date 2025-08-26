
import { NextFunction, Request, Response } from "express";
import Address from "../infrastructure/db/entities/Address";
import Order from "../infrastructure/db/entities/Order";
import NotFoundError from "../domain/errors/not-found-error";
import UnauthorizedError from "../domain/errors/unauthorized-error";
import { getAuth, clerkClient } from "@clerk/express";
import { validateStockAvailability, restoreProductStock } from "../utils/stockManager";

const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const { userId } = getAuth(req);

    // Validate stock availability before creating the order
    await validateStockAvailability(data.orderItems);

    const address = await Address.create(data.shippingAddress);
    const order = await Order.create({
      addressId: address._id,
      items: data.orderItems,
      userId: userId,
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);

    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate({
        path: 'items.productId',
        select: 'name price image'
      })
      .populate('addressId');
      
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.userId !== userId) {
      throw new UnauthorizedError("Unauthorized");
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);

    const orders = await Order.find({ userId })
      .populate({
        path: 'items.productId',
        select: 'name price image'
      })
      .populate('addressId')
      .sort({ createdAt: -1 }); // Most recent first

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Getting all orders with complete data population...");
    
    const orders = await Order.find()
      .populate({
        path: 'items.productId',
        select: 'name price image',
        options: { lean: true }
      })
      .populate({
        path: 'addressId',
        select: 'line_1 line_2 city phone', // Include phone field from address
        options: { lean: true }
      })
      .sort({ _id: -1 }) // Sort by ObjectId since timestamps are missing
      .lean();

    // Enhance orders with customer data from Clerk and computed dates
    const ordersWithCustomerData = await Promise.all(
      orders.map(async (order) => {
        let customerEmail = null;
        let customerName = null;
        
        try {
          // Get user details from Clerk
          if (order.userId) {
            const user = await clerkClient.users.getUser(order.userId);
            customerEmail = user.emailAddresses?.[0]?.emailAddress || null;
            customerName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.firstName || user.lastName || null;
          }
        } catch (error) {
          console.log(`Could not fetch user data for ${order.userId}:`, error instanceof Error ? error.message : 'Unknown error');
        }

        return {
          ...order,
          computedOrderDate: new Date(parseInt(order._id.toString().substring(0, 8), 16) * 1000),
          customerEmail,
          customerName,
          customerPhone: (order.addressId as any)?.phone || null
        };
      })
    );

    console.log(`Found ${orders.length} orders`);
    if (orders.length > 0) {
      console.log("Sample order with customer data:", {
        orderId: orders[0]._id,
        customerEmail: ordersWithCustomerData[0].customerEmail,
        customerPhone: ordersWithCustomerData[0].customerPhone,
        hasAddress: !!orders[0].addressId
      });
    }

    res.status(200).json(ordersWithCustomerData);
  } catch (error) {
    console.error("Error getting all orders:", error);
    next(error);
  }
};

const getSalesData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("getSalesData called with query:", req.query);
    
    const { days = 7 } = req.query;
    const daysNumber = parseInt(days as string);
    
    if (isNaN(daysNumber) || daysNumber <= 0) {
      res.status(400).json({ error: "Invalid days parameter" });
      return;
    }

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    // Temporarily look back 90 days to catch existing orders
    startDate.setDate(startDate.getDate() - 90);
    startDate.setHours(0, 0, 0, 0);

    console.log("Date range:", { startDate, endDate });

    // First, let's check if we have any orders at all
    const totalOrders = await Order.countDocuments();
    console.log("Total orders in database:", totalOrders);

    // Let's also check orders by payment status
    const paidOrders = await Order.countDocuments({ paymentStatus: "PAID" });
    const pendingOrders = await Order.countDocuments({ paymentStatus: "PENDING" });
    const refundedOrders = await Order.countDocuments({ paymentStatus: "REFUNDED" });
    console.log("Orders by payment status:", { paidOrders, pendingOrders, refundedOrders });

    // Check orders in date range
    const ordersInRange = await Order.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    const paidOrdersInRange = await Order.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      paymentStatus: "PAID"
    });
    console.log("Orders in date range:", { ordersInRange, paidOrdersInRange });

    // Also check recent order dates to understand the actual date range
    const mostRecentOrder = await Order.findOne().sort({ createdAt: -1 }).select('createdAt');
    const oldestOrder = await Order.findOne().sort({ createdAt: 1 }).select('createdAt');
    console.log("Actual order date range:", { 
      oldest: oldestOrder?.createdAt, 
      newest: mostRecentOrder?.createdAt 
    });

    // Let's also check a sample order structure
    const sampleOrder = await Order.findOne().lean();
    console.log("Sample order structure:", {
      _id: sampleOrder?._id,
      createdAt: sampleOrder?.createdAt,
      updatedAt: sampleOrder?.updatedAt,
      hasTimestamps: !!(sampleOrder?.createdAt || sampleOrder?.updatedAt)
    });

    // Real aggregation with product prices - using ObjectId timestamp since createdAt is missing
    const salesData = await Order.aggregate([
      {
        $match: {
          // Since orders don't have createdAt timestamps, we'll get all paid orders
          paymentStatus: "PAID", // Only count paid orders
          orderStatus: { $ne: "CANCELLED" } // Exclude cancelled orders
        }
      },
      {
        $addFields: {
          // Extract date from ObjectId timestamp
          createdDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $toDate: "$_id" }
            }
          }
        }
      },
      {
        $unwind: "$items"
      },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDetail"
        }
      },
      {
        $unwind: {
          path: "$productDetail",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            date: "$createdDate",
            orderId: "$_id"
          },
          orderTotal: {
            $sum: {
              $multiply: [
                { $ifNull: ["$productDetail.price", 0] },
                "$items.quantity"
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          totalSales: { $sum: "$orderTotal" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $project: {
          date: "$_id",
          totalSales: 1,
          orderCount: 1,
          _id: 0
        }
      },
      {
        $sort: { "date": 1 }
      }
    ]);

    console.log("Raw sales data:", salesData);

    // Return the raw sales data from database - no fallback, no date manipulation
    res.status(200).json(salesData);
  } catch (error) {
    console.error("Error in getSalesData:", error);
    next(error);
  }
};

// Diagnostic function to check database content
const debugOrderData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all orders with full details
    const allOrders = await Order.find()
      .populate({
        path: 'items.productId',
        select: 'name price'
      })
      .limit(5) // Limit to first 5 for debugging
      .lean();

    // Get basic counts
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ paymentStatus: "PAID" });
    const pendingOrders = await Order.countDocuments({ paymentStatus: "PENDING" });
    
    // Get recent orders with creation dates
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .select('createdAt paymentStatus orderStatus items')
      .lean();

    const debugInfo = {
      totalOrders,
      paidOrders,
      pendingOrders,
      sampleOrders: allOrders,
      recentOrders,
      note: "This is debug data to understand your database structure"
    };

    res.status(200).json(debugInfo);
  } catch (error) {
    console.error("Error in debugOrderData:", error);
    next(error);
  }
};

// Update order status (Admin only)
const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const updateData: any = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    // Handle stock restoration for cancelled orders or refunds
    const needsStockRestore = 
      (orderStatus === 'CANCELLED' && order.orderStatus !== 'CANCELLED' && order.paymentStatus === 'PAID') ||
      (paymentStatus === 'REFUNDED' && order.paymentStatus === 'PAID');

    if (needsStockRestore) {
      try {
        await restoreProductStock(order.items);
        console.log(`📦 Stock restored for ${orderStatus === 'CANCELLED' ? 'cancelled' : 'refunded'} order:`, id);
      } catch (stockError) {
        console.error("❌ Error restoring product stock:", stockError);
        // Continue with order update even if stock restoration fails
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, { new: true })
      .populate({
        path: 'items.productId',
        select: 'name price image'
      })
      .populate('addressId');

    res.status(200).json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

export { createOrder, getOrder, getUserOrders, getAllOrders, getSalesData, debugOrderData, updateOrderStatus };