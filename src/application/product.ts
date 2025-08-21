import Product from "../infrastructure/db/entities/Product";
import ValidationError from "../domain/errors/validation-error";
import NotFoundError from "../domain/errors/not-found-error";
import { Request, Response, NextFunction } from "express";
import { CreateProductDTO } from "../domain/dto/product";
import { randomUUID } from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import S3 from "../infrastructure/s3";

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
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    const result = CreateProductDTO.safeParse(req.body);
    if (!result.success) {
      console.log("Validation error:", result.error);
      throw new ValidationError(result.error.message);
    }

    console.log("Validated data:", JSON.stringify(result.data, null, 2));
    
    const product = await Product.create(result.data);
    console.log("Product created:", product);
    
    res.status(201).send();
  } catch (error) {
    console.log("Create product error:", error);
    next(error);
  }
};

const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await Product.findById(req.params.id).populate("reviews");
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
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
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



    // Generate a unique filename with extension
    const extension = fileName.split('.').pop();
    const uniqueFileName = `${randomUUID()}.${extension}`;

    // Get signed URL for upload
    const url = await getSignedUrl(
      S3,
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        Key: uniqueFileName,
        ContentType: fileType,
      }),
      {
        expiresIn: 3600, // 1 hour
      }
    );

    // Return both the upload URL and the public URL
    res.status(200).json({
      url,
      publicURL: `${process.env.CLOUDFLARE_PUBLIC_DOMAIN}/${uniqueFileName}`,
    });
  } catch (error) {
    console.error("Image upload error:", error);
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
};