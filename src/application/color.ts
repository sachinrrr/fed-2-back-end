import Color from "../infrastructure/db/entities/Color";
import ValidationError from "../domain/errors/validation-error";
import NotFoundError from "../domain/errors/not-found-error";
import { Request, Response, NextFunction } from "express";
import { CreateColorDTO } from "../domain/dto/color";

//get all colors
const getAllColors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const colors = await Color.find().sort({ name: 1 });
    res.json(colors);
  } catch (error) {
    next(error);
  }
};

//create color
const createColor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = CreateColorDTO.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.message);
    }

    const color = await Color.create(result.data);
    res.status(201).json(color);
  } catch (error) {
    next(error);
  }
};

//get color by id
const getColorById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const colorId = req.params.id;
    const color = await Color.findById(colorId);
    
    if (!color) {
      throw new NotFoundError("Color not found");
    }
    
    res.json(color);
  } catch (error) {
    next(error);
  }
};

export { getAllColors, createColor, getColorById };
