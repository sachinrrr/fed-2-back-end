import Product from "../infrastructure/db/entities/Product";
import Order from "../infrastructure/db/entities/Order";
import ValidationError from "../domain/errors/validation-error";
import NotFoundError from "../domain/errors/not-found-error";
import { Request, Response, NextFunction } from "express";
import { CreateProductDTO, UpdateProductDTO } from "../domain/dto/product";
import { randomUUID } from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import S3 from "../infrastructure/s3";
import mongoose from "mongoose";

const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract query parameters for filtering and sorting
    const { 
      categoryId, 
      colorId, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req.query;

    // Build filter object
    const filter: any = {};
    
    if (categoryId && categoryId !== 'all') {
      filter.categoryId = categoryId;
    }
    
    if (colorId && colorId !== 'all') {
      filter.colorId = colorId;
    }

    // Build sort object
    const sort: any = {};
    const validSortFields = ['name', 'price', 'createdAt'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'name';
    const order = sortOrder === 'desc' ? -1 : 1;
    sort[sortField as string] = order;

    // Execute query with filtering, sorting, and population
    const products = await Product.find(filter)
      .populate('categoryId', 'name')
      .populate('colorId', 'name hexCode')
      .sort(sort)
      .lean();

    res.json(products);
  } catch (error) {
    next(error);
  }
};

const getProductsForSearchQuery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search } = req.query;
    const results = await Product.aggregate([
      {
        $search: {
          index: "default",
          autocomplete: {
            path: "name",
            query: search,
            tokenOrder: "any",
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2,
              maxExpansions: 256,
            },
          },
          highlight: {
            path: "name",
          },
        },
      },
    ]);
    res.json(results);
  } catch (error) {
    next(error);
  }
};

const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = CreateProductDTO.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.message);
    }
    
    const product = await Product.create(result.data);
    res.status(201).send();
  } catch (error) {
    next(error);
  }
};

const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("categoryId", "name")
      .populate("colorId", "name hexCode")
      .populate("reviews");
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
};

const updateProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Validate the update data
    const result = UpdateProductDTO.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.message);
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id, 
      result.data, 
      {
        new: true,
        runValidators: true,
      }
    ).populate("categoryId", "name").populate("colorId", "name hexCode");
    
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

const deleteProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const uploadProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fileType, fileName } = req.body;

    if (!fileType || !fileName) {
      throw new ValidationError("fileType and fileName are required");
    }

    const extension = fileName.split('.').pop();
    const uniqueFileName = `${randomUUID()}.${extension}`;

    const url = await getSignedUrl(
      S3,
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        Key: uniqueFileName,
        ContentType: fileType,
      }),
      {
        expiresIn: 3600,
      }
    );

    res.status(200).json({
      url,
      publicURL: `${process.env.CLOUDFLARE_PUBLIC_DOMAIN}/${process.env.CLOUDFLARE_BUCKET_NAME}/${uniqueFileName}`,
    });    
  } catch (error) {
    next(error);
  }
};

const getTrendingProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { categoryId, limit = 8 } = req.query;

    // Aggregate orders to count product purchases
    let trendingAggregation: any[] = [
      // Match only paid orders
      {
        $match: {
          paymentStatus: "PAID"
        }
      },
      // Unwind the items array to process each item separately
      {
        $unwind: "$items"
      }
    ];

    // Add category filtering if specified
    if (categoryId && categoryId !== "ALL" && categoryId !== "") {
      trendingAggregation.push(
        // Lookup product details early for category filtering
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        // Match products by category
        {
          $match: {
            "productInfo.categoryId": new mongoose.Types.ObjectId(categoryId as string)
          }
        }
      );
    }

    // Continue with grouping and sorting
    trendingAggregation.push(
      // Group by productId and sum quantities
      {
        $group: {
          _id: "$items.productId",
          totalOrdered: {
            $sum: "$items.quantity"
          },
          orderCount: {
            $sum: 1
          }
        }
      },
      // Sort by total ordered quantity (most ordered first)
      {
        $sort: {
          totalOrdered: -1
        }
      },
      // Limit results
      {
        $limit: parseInt(limit as string) * 2 // Get more than needed in case some products don't exist
      },
      // Lookup product details
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      // Unwind product details
      {
        $unwind: "$product"
      },
      // Add the order stats to the product
      {
        $addFields: {
          "product.totalOrdered": "$totalOrdered",
          "product.orderCount": "$orderCount"
        }
      },
      // Replace root with product
      {
        $replaceRoot: {
          newRoot: "$product"
        }
      }
    );

    const trendingProducts = await Order.aggregate(trendingAggregation);

    // Populate category and color information
    const populatedProducts = await Product.populate(trendingProducts, [
      { path: 'categoryId', select: 'name' },
      { path: 'colorId', select: 'name hexCode' }
    ]);

    // Limit to requested number
    let limitedProducts = populatedProducts.slice(0, parseInt(limit as string));

    // Fill with regular products if needed
    if (limitedProducts.length < parseInt(limit as string)) {
      const existingProductIds = limitedProducts.map(p => p._id.toString());
      const additionalProductsNeeded = parseInt(limit as string) - limitedProducts.length;
      
      const filter: any = {
        _id: { $nin: existingProductIds.map(id => new mongoose.Types.ObjectId(id)) }
      };
      
      if (categoryId && categoryId !== "ALL" && categoryId !== "") {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
      }

      const additionalProducts = await Product.find(filter)
        .populate('categoryId', 'name')
        .populate('colorId', 'name hexCode')
        .limit(additionalProductsNeeded)
        .lean();

      limitedProducts = [...limitedProducts, ...additionalProducts] as any;
    }

    res.json(limitedProducts);
  } catch (error) {
    next(error);
  }
};

export {
  createProduct,
  deleteProductById,
  getAllProducts,
  getProductById,
  updateProductById,
  getProductsForSearchQuery,
  uploadProductImage,
  getTrendingProducts,
};