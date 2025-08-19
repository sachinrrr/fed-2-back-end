import { Schema, model } from "mongoose";

interface IColor {
  _id: string;
  name: string;
  hexCode: string;
  __v: number;
}

const colorSchema = new Schema<IColor>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hexCode: {
    type: String,
    required: true,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    validate: {
      validator: function(v: string) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'hexCode must be a valid hex color code (e.g., #FF0000 or #F00)'
    }
  }
});

const Color = model<IColor>("Color", colorSchema);

export default Color;
