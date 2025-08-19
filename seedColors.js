require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const MONGODB_URL = process.env.MONGODB_URL;
    if (!MONGODB_URL) {
      throw new Error('MONGODB_URL is not defined in environment variables');
    }
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Color schema
const colorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hexCode: {
    type: String,
    required: true,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  }
});

const Color = mongoose.model('Color', colorSchema);

// Seed colors
const seedColors = async () => {
  try {
    await connectDB();
    
    // Check if colors already exist
    const existingColors = await Color.find();
    if (existingColors.length > 0) {
      console.log(`${existingColors.length} colors already exist in database`);
      return;
    }

    // Basic colors to seed
    const colors = [
      { name: "Black", hexCode: "#000000" },
      { name: "White", hexCode: "#FFFFFF" },
      { name: "Red", hexCode: "#FF0000" },
      { name: "Blue", hexCode: "#0000FF" },
      { name: "Green", hexCode: "#008000" },
      { name: "Yellow", hexCode: "#FFFF00" },
      { name: "Purple", hexCode: "#800080" },
      { name: "Orange", hexCode: "#FFA500" },
      { name: "Pink", hexCode: "#FFC0CB" },
      { name: "Gray", hexCode: "#808080" }
    ];

    // Insert colors
    const insertedColors = await Color.insertMany(colors);
    console.log(`Successfully seeded ${insertedColors.length} colors:`);
    
    insertedColors.forEach(color => {
      console.log(`- ${color.name} (${color.hexCode})`);
    });

  } catch (error) {
    console.error('Error seeding colors:', error);
  } finally {
    process.exit(0);
  }
};

seedColors();
